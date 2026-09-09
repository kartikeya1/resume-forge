// Pipeline entry point: snapshot in, applications out.
//
// Pure and deterministic given `now`. The UI calls this on every load rather
// than caching the result, so a classifier improvement applies to an old
// snapshot the moment it deploys.

import { buildContext, classifyThread, type Classification } from './classify';
import { applicationKey, dedupeEvents, groupCandidates, type CorrelateOptions, type ThreadCandidate } from './correlate';
import { extractFromThread, parsedRoleOf } from './extract';
import { companyKey } from './normalize';
import { DEFAULT_SETTINGS, type JobsSettings } from './settings';
import { deriveStatus } from './status';
import type {
  AgentHint,
  AppEvent,
  Application,
  BuildResult,
  EmailThread,
  ExcludedThread,
  ProvenanceSource,
  UserOverrides,
} from './types';
import { emptyOverrides } from './types';
import type { JobsSnapshot } from './snapshot';

/** Kinds that can seed an application. `status_signal` deliberately cannot. */
const SEEDING_KINDS = new Set(['application', 'recruiter_outreach', 'referral']);
const NOISE_KINDS = new Set([
  'spam_consultant',
  'marketing',
  'job_alert',
  'transactional_noise',
  'unrelated',
]);

function toEvents(thread: EmailThread, cls: Classification, hint?: AgentHint): AppEvent[] {
  const overrideById = new Map((hint?.eventOverrides ?? []).map((o) => [o.messageId, o]));
  const intentById = new Map(cls.intents.map((i) => [i.messageId, i]));

  return thread.messages.map((m) => {
    const at = Date.parse(m.at);
    const o = overrideById.get(m.id);
    const intent = intentById.get(m.id);
    const parseAgentDate = (v?: string) => {
      if (!v) return undefined;
      const t = Date.parse(v);
      return Number.isNaN(t) ? undefined : t;
    };
    const deadlineAt = parseAgentDate(o?.deadlineAt);
    const interviewAt = parseAgentDate(o?.interviewAt);

    return {
      id: m.id,
      threadId: thread.id,
      // His own replies are timeline events but never carry an intent - they
      // exist so `awaitingMyReply` and the nudge rules can see them.
      type: m.fromMe ? 'other' : (o?.type ?? intent?.type ?? 'other'),
      at,
      subject: m.subject,
      from: m.from.email,
      fromMe: m.fromMe,
      confidence: o ? 1 : (intent?.confidence ?? 0.2),
      source: o ? 'agent' : 'rules',
      deadlineAt,
      interviewAt,
      deadlineSource: deadlineAt ? 'agent' : undefined,
      note: o?.note,
    } satisfies AppEvent;
  });
}

function excluded(thread: EmailThread, cls: Classification): ExcludedThread {
  const first = thread.messages.find((m) => !m.fromMe) ?? thread.messages[0];
  return {
    threadId: thread.id,
    subject: thread.subject || first?.subject || '(no subject)',
    from: first?.from.email ?? '',
    at: Date.parse(first?.at ?? new Date(0).toISOString()),
    kind: cls.kind,
    reasons: cls.reasons,
  };
}

export interface BuildOptions {
  now?: number;
  overrides?: UserOverrides;
  softJoinWindowDays?: number;
  /** User-tuned thresholds; falls back to DEFAULT_SETTINGS. */
  settings?: JobsSettings;
}

export function buildApplications(snapshot: JobsSnapshot, opts: BuildOptions = {}): BuildResult {
  const now = opts.now ?? Date.now();
  const overrides = opts.overrides ?? emptyOverrides();
  const settings = opts.settings ?? DEFAULT_SETTINGS;
  const windowSince = Date.parse(snapshot.window.since);

  const hints = snapshot.hints ?? [];
  const ctx = buildContext(snapshot.threads, hints);

  const candidates: ThreadCandidate[] = [];
  const review: ExcludedThread[] = [];
  const excludedThreads: ExcludedThread[] = [];
  const statusSignals: { events: AppEvent[]; companyKey: string; roleKey: string | null }[] = [];

  for (const thread of snapshot.threads) {
    const cls = classifyThread(thread, ctx);

    if (NOISE_KINDS.has(cls.kind)) {
      excludedThreads.push(excluded(thread, cls));
      continue;
    }
    if (cls.kind === 'unknown') {
      review.push(excluded(thread, cls));
      continue;
    }

    const hint = ctx.hints.get(thread.id);
    const extracted = extractFromThread(thread, cls.vendor, hint);
    const events = toEvents(thread, cls, hint);
    const parsedRole = parsedRoleOf(extracted.role);

    if (cls.kind === 'status_signal') {
      statusSignals.push({
        events: events.filter((e) => !e.fromMe),
        companyKey: extracted.company ? companyKey(extracted.company.value) : '',
        roleKey: parsedRole?.key ?? null,
      });
      continue;
    }

    if (!SEEDING_KINDS.has(cls.kind)) {
      excludedThreads.push(excluded(thread, cls));
      continue;
    }

    const times = events.map((e) => e.at).filter((t) => !Number.isNaN(t));
    candidates.push({
      threadId: thread.id,
      kind: cls.kind,
      vendor: cls.vendor?.id,
      company: extracted.company,
      companyKey: extracted.company ? companyKey(extracted.company.value) : '',
      role: extracted.role,
      parsedRole,
      reqIds: extracted.reqIds,
      events,
      firstAt: times.length ? Math.min(...times) : now,
      lastAt: times.length ? Math.max(...times) : now,
      hint,
      needsReview: cls.confidence < 0.7 || !extracted.company,
      classificationReasons: cls.reasons,
    });
  }

  const correlateOpts: CorrelateOptions = {
    now,
    overrides,
    softJoinWindowDays: opts.softJoinWindowDays,
  };
  const groups = groupCandidates(candidates, correlateOpts);

  const applications: Application[] = [];
  const orphanEvents: AppEvent[] = [];

  for (const group of groups) {
    const members = group.members;
    const allEvents = dedupeEvents(members.flatMap((m) => m.events));

    // Best available company/role across the group, preferring the most
    // trustworthy provenance rather than whichever thread came first.
    const bestCompany = pickField(members.map((m) => m.company));
    const bestRole = pickField(members.map((m) => m.role));
    const ck = bestCompany ? companyKey(bestCompany.value) : '';
    const parsedRole = members.find((m) => m.parsedRole)?.parsedRole ?? null;
    const reqIds = Array.from(new Set(members.flatMap((m) => m.reqIds.map((r) => r.id)))).sort();

    // Attach any status signal (an iimjobs "role withdrawn" relay) that names
    // this company and role.
    for (const sig of statusSignals) {
      if (sig.companyKey && sig.companyKey === ck) {
        allEvents.push(...sig.events);
        sig.companyKey = '__attached__';
      }
    }
    allEvents.sort((a, b) => a.at - b.at);

    const needsReview = members.some((m) => m.needsReview) || !bestCompany;
    const status = deriveStatus({
      events: allEvents,
      now,
      needsReview,
      windowSince: Number.isNaN(windowSince) ? undefined : windowSince,
      cfg: settings,
    });

    const id = applicationKey({
      companyKey: ck,
      roleKey: parsedRole?.key ?? null,
      reqIds,
      threadIds: group.threadIds,
    });

    const applyEvent = allEvents.find((e) => e.type === 'applied' || e.type === 'ack');
    const override = overrides.fields[id];

    applications.push({
      id,
      company: override?.company ?? bestCompany?.value ?? null,
      companyKey: ck,
      role: override?.role ?? bestRole?.value ?? null,
      roleKey: parsedRole?.key ?? null,
      reqIds,
      vendor: members.find((m) => m.vendor)?.vendor,
      status: override?.status ?? status.status,
      statusRuleId: override?.status ? 'user-override' : status.ruleId,
      statusReason: override?.status ? 'You set this status by hand.' : status.reason,
      decidedBy: override?.status ? 'user' : status.decidedBy,
      flags: status.flags,
      appliedAt: applyEvent?.at ?? null,
      firstAt: allEvents.length ? allEvents[0].at : now,
      lastAt: allEvents.length ? allEvents[allEvents.length - 1].at : now,
      events: allEvents,
      threadIds: group.threadIds,
      provenance: {
        company: (override?.company ? 'user' : bestCompany?.source ?? 'none') as ProvenanceSource,
        role: (override?.role ? 'user' : bestRole?.source ?? 'none') as ProvenanceSource,
      },
      agentReason: members.find((m) => m.hint?.reason)?.hint?.reason,
      mergeRuleIds: group.ruleIds,
      classificationByThread: Object.fromEntries(
        members.map((m) => [m.threadId, m.classificationReasons])
      ),
      edited: !!override,
      archived: override?.archived,
      notes: override?.notes,
    });
  }

  for (const sig of statusSignals) {
    if (sig.companyKey !== '__attached__') orphanEvents.push(...sig.events);
  }

  // Manual entries carry no threads and skip classify/correlate entirely - a
  // LinkedIn Easy Apply or a referral over WhatsApp never generated mail to
  // reason about. Its status is exactly what the user set: there is no rule
  // ladder to run over zero events.
  for (const man of overrides.manual) {
    const fieldOverride = overrides.fields[man.id];
    applications.push({
      id: man.id,
      company: fieldOverride?.company ?? man.company,
      companyKey: companyKey(fieldOverride?.company ?? man.company),
      role: fieldOverride?.role ?? man.role ?? null,
      roleKey: null,
      reqIds: [],
      status: fieldOverride?.status ?? man.status,
      statusRuleId: 'user-manual',
      statusReason: 'Added by hand - no email to derive this from.',
      decidedBy: 'user',
      flags: {
        recruiterReplied: false, awaitingMyReply: false, iReplied: false,
        deadlineAt: null, deadlineSource: null, deadlineMissed: false,
        interviewAt: null, interviewMissed: false,
        staleDays: Math.max(0, Math.floor((now - man.createdAt) / 86_400_000)),
        duplicateMessages: 0, talentPooled: false, needsReview: false, conflicting: false,
      },
      appliedAt: null,
      firstAt: man.createdAt,
      lastAt: man.createdAt,
      events: [],
      threadIds: [],
      provenance: { company: 'user', role: 'user' },
      mergeRuleIds: [],
      classificationByThread: {},
      edited: true,
      archived: fieldOverride?.archived ?? man.archived,
      notes: fieldOverride?.notes ?? man.notes,
    });
  }

  applications.sort((a, b) => b.lastAt - a.lastAt);

  return {
    applications,
    review,
    excluded: excludedThreads,
    orphanEvents,
    counts: {
      threads: snapshot.threads.length,
      applications: applications.length,
      excluded: excludedThreads.length,
      review: review.length,
    },
  };
}

const SOURCE_RANK: Record<ProvenanceSource, number> = {
  user: 7,
  agent: 6,
  'sender-localpart': 5,
  'sender-subdomain': 4,
  'sender-domain': 3,
  'subject-template': 2,
  body: 1,
  none: 0,
};

function pickField<T>(
  fields: ({ value: T; source: ProvenanceSource; confidence: number } | null)[]
): { value: T; source: ProvenanceSource; confidence: number } | null {
  let best: { value: T; source: ProvenanceSource; confidence: number } | null = null;
  for (const f of fields) {
    if (!f) continue;
    if (!best || SOURCE_RANK[f.source] > SOURCE_RANK[best.source]) best = f;
  }
  return best;
}

export * from './types';
export { parseSnapshot, parseSnapshotText, InvalidSnapshotError, SNAPSHOT_KIND, SNAPSHOT_VERSION } from './snapshot';
export type { JobsSnapshot } from './snapshot';
export { STATUS_CONFIG, deriveStatus, deriveFlags } from './status';
export { DEFAULT_SETTINGS, coerceSettings, isCustomised, SETTING_KEYS, SETTING_LABELS, SETTING_UNITS, settingLimits } from './settings';
export type { JobsSettings } from './settings';
export { reconcileOverrides } from './correlate';
