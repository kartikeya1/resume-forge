// The snapshot file: what the agent writes and the page reads.
//
// Mirrors the validation posture of ../persistIO.ts - reject only when the file
// is clearly not ours, and tolerate every other kind of shape drift by dropping
// the bad part into `warnings` and carrying on. The failure mode to avoid is a
// blank dashboard because one thread in ninety had a malformed date.

import type { AgentHint, EmailMessage, EmailThread } from './types';

export const SNAPSHOT_KIND = 'jobs-forge-snapshot';
export const SNAPSHOT_VERSION = 1;

export interface JobsSnapshot {
  kind: typeof SNAPSHOT_KIND;
  version: number;
  /** ISO - when the agent ran. Drives the "as of" chip and the staleness nudge. */
  generatedAt: string;
  mailbox?: string;
  /**
   * What the agent ACTUALLY scanned. Without this the dashboard cannot tell
   * "no rejection yet" from "the agent did not look that far back".
   */
  window: { since: string; until: string };
  threads: EmailThread[];
  hints?: AgentHint[];
  counts?: { scanned?: number; kept?: number; skipped?: number };
  agent?: { model?: string; notes?: string };
}

export class InvalidSnapshotError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'InvalidSnapshotError';
  }
}

export interface ParsedSnapshot {
  snapshot: JobsSnapshot;
  warnings: string[];
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function isoOrNull(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : v;
}

function coerceAddress(v: unknown): { email: string; name?: string } | null {
  if (typeof v === 'string') return { email: v.toLowerCase() };
  if (!isObj(v)) return null;
  const email = str(v.email).toLowerCase();
  if (!email) return null;
  const name = str(v.name);
  return name ? { email, name } : { email };
}

function coerceAddresses(v: unknown): { email: string; name?: string }[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v.map(coerceAddress).filter((a): a is { email: string; name?: string } => !!a);
  return out.length ? out : undefined;
}

function coerceMessage(v: unknown, warnings: string[], threadId: string): EmailMessage | null {
  if (!isObj(v)) {
    warnings.push(`Thread ${threadId}: a message was not an object and was skipped.`);
    return null;
  }
  const id = str(v.id);
  const at = isoOrNull(v.at);
  const from = coerceAddress(v.from);
  if (!id || !at || !from) {
    warnings.push(
      `Thread ${threadId}: a message was skipped (missing ${!id ? 'id' : !at ? 'a parseable date' : 'sender'}).`
    );
    return null;
  }
  return {
    id,
    at,
    from,
    to: coerceAddresses(v.to),
    cc: coerceAddresses(v.cc),
    fromMe: v.fromMe === true,
    subject: str(v.subject),
    snippet: str(v.snippet),
    bodyText: typeof v.bodyText === 'string' ? v.bodyText : undefined,
    hasUnsubscribe: v.hasUnsubscribe === true ? true : undefined,
    listId: typeof v.listId === 'string' ? v.listId : undefined,
    labels: Array.isArray(v.labels) ? v.labels.filter((l): l is string => typeof l === 'string') : undefined,
  };
}

function coerceThread(v: unknown, warnings: string[]): EmailThread | null {
  if (!isObj(v)) {
    warnings.push('A thread was not an object and was skipped.');
    return null;
  }
  const id = str(v.id);
  if (!id) {
    warnings.push('A thread with no id was skipped.');
    return null;
  }
  if (!Array.isArray(v.messages)) {
    warnings.push(`Thread ${id} has no messages array and was skipped.`);
    return null;
  }
  const messages = v.messages
    .map((m) => coerceMessage(m, warnings, id))
    .filter((m): m is EmailMessage => !!m)
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  if (!messages.length) {
    warnings.push(`Thread ${id} had no usable messages and was skipped.`);
    return null;
  }
  return { id, subject: str(v.subject, messages[0].subject), messages };
}

function coerceHint(v: unknown): AgentHint | null {
  if (!isObj(v)) return null;
  const threadId = str(v.threadId);
  if (!threadId) return null;
  const h: AgentHint = { threadId };
  if (typeof v.kind === 'string') h.kind = v.kind as AgentHint['kind'];
  for (const k of ['company', 'companyDomain', 'role', 'reqId', 'location', 'applicationKey', 'reason'] as const) {
    if (typeof v[k] === 'string') h[k] = v[k] as string;
  }
  if (Array.isArray(v.distinctFrom)) {
    h.distinctFrom = v.distinctFrom.filter((t): t is string => typeof t === 'string');
  }
  if (typeof v.confidence === 'number') h.confidence = v.confidence;
  if (Array.isArray(v.eventOverrides)) {
    h.eventOverrides = v.eventOverrides
      .filter(isObj)
      .filter((o) => typeof o.messageId === 'string' && typeof o.type === 'string')
      .map((o) => ({
        messageId: o.messageId as string,
        type: o.type as NonNullable<AgentHint['eventOverrides']>[number]['type'],
        at: typeof o.at === 'string' ? o.at : undefined,
        deadlineAt: typeof o.deadlineAt === 'string' ? o.deadlineAt : undefined,
        interviewAt: typeof o.interviewAt === 'string' ? o.interviewAt : undefined,
        note: typeof o.note === 'string' ? o.note : undefined,
      }));
  }
  return h;
}

/** Reserved for future schema changes; v1 is the only version so far. */
export function migrateSnapshot(raw: Record<string, unknown>, from: number): Record<string, unknown> {
  void from;
  return raw;
}

export function parseSnapshot(raw: unknown): ParsedSnapshot {
  const warnings: string[] = [];
  if (!isObj(raw)) throw new InvalidSnapshotError('This file is not a JSON object.');
  if (raw.kind !== SNAPSHOT_KIND) {
    throw new InvalidSnapshotError(
      'This does not look like a Jobs Forge snapshot. Expected a file written by the agent per JOBS-FORGE.md.'
    );
  }

  const version = typeof raw.version === 'number' ? raw.version : 1;
  let obj = raw;
  if (version < SNAPSHOT_VERSION) obj = migrateSnapshot(raw, version);
  if (version > SNAPSHOT_VERSION) {
    // Parse anyway. Refusing would leave a blank dashboard, which is worse than
    // rendering a newer file with fields we happen to ignore.
    warnings.push(
      `This snapshot was written by a newer agent (v${version}); some fields may be ignored.`
    );
  }

  const generatedAt = isoOrNull(obj.generatedAt) ?? new Date(0).toISOString();
  if (!isoOrNull(obj.generatedAt)) {
    warnings.push('The snapshot has no valid generatedAt timestamp, so freshness cannot be shown.');
  }

  const w = isObj(obj.window) ? obj.window : {};
  const since = isoOrNull(w.since);
  const until = isoOrNull(w.until);
  if (!since) {
    warnings.push(
      'The snapshot does not say how far back it scanned, so "no response yet" cannot be distinguished from "not scanned".'
    );
  }

  const rawThreads = Array.isArray(obj.threads) ? obj.threads : [];
  if (!Array.isArray(obj.threads)) warnings.push('The snapshot has no threads array.');
  const threads = rawThreads.map((t) => coerceThread(t, warnings)).filter((t): t is EmailThread => !!t);

  const hints = Array.isArray(obj.hints)
    ? obj.hints.map(coerceHint).filter((h): h is AgentHint => !!h)
    : [];

  return {
    snapshot: {
      kind: SNAPSHOT_KIND,
      version,
      generatedAt,
      mailbox: str(obj.mailbox) || undefined,
      window: {
        since: since ?? generatedAt,
        until: until ?? generatedAt,
      },
      threads,
      hints,
      counts: isObj(obj.counts)
        ? {
            scanned: typeof obj.counts.scanned === 'number' ? obj.counts.scanned : undefined,
            kept: typeof obj.counts.kept === 'number' ? obj.counts.kept : undefined,
            skipped: typeof obj.counts.skipped === 'number' ? obj.counts.skipped : undefined,
          }
        : undefined,
      agent: isObj(obj.agent)
        ? {
            model: str(obj.agent.model) || undefined,
            notes: str(obj.agent.notes) || undefined,
          }
        : undefined,
    },
    warnings,
  };
}

export function parseSnapshotText(text: string): ParsedSnapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new InvalidSnapshotError('This file is not valid JSON.');
  }
  return parseSnapshot(raw);
}
