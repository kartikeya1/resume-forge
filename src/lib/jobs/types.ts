// Jobs Forge core types.
//
// The pipeline is a pure reducer: an agent hands us a snapshot of Gmail threads
// (plus its own judgments as `AgentHint`s), and everything downstream is
// deterministic and `now`-injected so it can be tested in node.
//
// Deliberately NOT reusing `AppStatus` from ../store: that is a manual
// per-resume field the user sets by hand, this is derived from mail. They will
// diverge, and sharing the union would couple two unrelated lifecycles.

export interface EmailAddress {
  /** Lowercased by the agent. */
  email: string;
  name?: string;
}

export interface EmailMessage {
  /** Gmail message id - the stable identity of an event. */
  id: string;
  /** ISO 8601. */
  at: string;
  from: EmailAddress;
  to?: EmailAddress[];
  cc?: EmailAddress[];
  /** True when this is one of his own sent replies (the Civica thread). */
  fromMe: boolean;
  subject: string;
  /** Agent-trimmed plain text, ~500 chars. */
  snippet: string;
  /** Optional fuller text. Present only where the agent judged it load-bearing. */
  bodyText?: string;
  /** List-Unsubscribe present - a strong bulk-mail signal. */
  hasUnsubscribe?: boolean;
  /** List-Id header. */
  listId?: string;
  /** Gmail label ids (CATEGORY_PROMOTIONS, IMPORTANT, UNREAD, ...). */
  labels?: string[];
}

export interface EmailThread {
  /** Gmail thread id. */
  id: string;
  /** Subject of the first message. */
  subject: string;
  /** Chronological, oldest first. */
  messages: EmailMessage[];
}

// ---- Events ----------------------------------------------------------------

export type EventType =
  | 'applied'
  | 'ack'
  | 'under_review'
  | 'shortlisted'
  | 'assessment'
  | 'action_required'
  | 'interview_invite'
  | 'interview_scheduled'
  | 'interview_reminder'
  | 'interview_missed'
  | 'offer'
  | 'rejection'
  | 'role_withdrawn'
  | 'talent_pool'
  | 'outreach'
  | 'referred'
  | 'nudge'
  | 'survey'
  | 'other';

export interface AppEvent {
  /** Gmail message id. */
  id: string;
  threadId: string;
  type: EventType;
  at: number;
  subject: string;
  from: string;
  fromMe: boolean;
  /** 0..1 - how sure we are of `type`. */
  confidence: number;
  /** 'agent' when an AgentHint set this, else 'rules'. */
  source: 'agent' | 'rules';
  /** Collapsed identical copies (Paytm sent its rejection three times). */
  duplicateCount?: number;
  /** Agent-parsed, from body prose the browser never sees. */
  deadlineAt?: number;
  interviewAt?: number;
  /** Where a deadline came from - only agent-sourced ones may kill an app. */
  deadlineSource?: 'agent' | 'rules';
  note?: string;
}

// ---- Classification --------------------------------------------------------

export type ThreadKind =
  | 'application' // he applied - an ATS or a human confirms it
  | 'recruiter_outreach' // inbound, no application yet
  | 'referral' // "you have been referred"
  | 'status_signal' // contributes events, can never create an application
  | 'spam_consultant'
  | 'marketing'
  | 'job_alert'
  | 'transactional_noise'
  | 'unrelated'
  | 'unknown'; // low confidence - goes to the review drawer, never silently dropped

/** Where a field's value came from, so the UI can always explain itself. */
export type ProvenanceSource =
  | 'agent'
  | 'user'
  | 'sender-localpart'
  | 'sender-subdomain'
  | 'sender-domain'
  | 'subject-template'
  | 'body'
  | 'none';

export interface Field<T> {
  value: T;
  source: ProvenanceSource;
  confidence: number;
}

// ---- Status ----------------------------------------------------------------

export type JobStatus =
  | 'lead'
  | 'applied'
  | 'in_review'
  | 'action_needed'
  | 'interviewing'
  | 'offer'
  | 'rejected'
  | 'role_closed'
  | 'lapsed'
  | 'ghosted'
  | 'withdrawn'; // manual only, never derived

export interface AppFlags {
  /** A real human wrote in this thread - the single highest-value signal. */
  recruiterReplied: boolean;
  /** Last inbound message asks something and he has not answered it. */
  awaitingMyReply: boolean;
  /** He replied at least once. */
  iReplied: boolean;
  deadlineAt: number | null;
  deadlineSource: 'agent' | 'rules' | null;
  deadlineMissed: boolean;
  interviewAt: number | null;
  interviewMissed: boolean;
  /** Days since the last event. */
  staleDays: number;
  duplicateMessages: number;
  talentPooled: boolean;
  needsReview: boolean;
  /** An anomaly worth a human look (an offer after a rejection). */
  conflicting: boolean;
}

export interface StatusResult {
  status: JobStatus;
  /** e.g. 'R4-interview-missed' - lets a test pin the exact rule. */
  ruleId: string;
  /** Human sentence, rendered verbatim in the UI. */
  reason: string;
  flags: AppFlags;
  decidedBy: 'rules' | 'agent' | 'user';
}

// ---- The agent's escape hatch ----------------------------------------------

/**
 * What the agent knows that the browser cannot.
 *
 * Roughly a third of real applications cannot be fully resolved by rules:
 * Ashby's transactional subjects never name the employer, Keka is multi-tenant
 * with byte-identical subjects for different companies, and assessment
 * deadlines live in body prose. Precedence is always
 * user override > agent hint > rules, with the winner recorded in provenance.
 */
export interface AgentHint {
  threadId: string;
  kind?: ThreadKind;
  company?: string;
  companyDomain?: string;
  role?: string;
  reqId?: string;
  location?: string;
  /** Threads sharing an applicationKey ALWAYS merge. Beats every heuristic. */
  applicationKey?: string;
  /** Never merge with these thread ids. Agent-adjudicated split. */
  distinctFrom?: string[];
  /** Per-message corrections - the agent read the body, the browser did not. */
  eventOverrides?: Array<{
    messageId: string;
    type: EventType;
    at?: string;
    deadlineAt?: string;
    interviewAt?: string;
    note?: string;
  }>;
  /** 0..1. Below 0.5 the hint's `kind` is advisory only. */
  confidence?: number;
  /** Shown verbatim in the UI "why?" popover. */
  reason?: string;
}

// ---- Output ----------------------------------------------------------------

export interface Application {
  /** Stable across re-imports so user overrides survive a new snapshot. */
  id: string;
  company: string | null;
  companyKey: string;
  role: string | null;
  roleKey: string | null;
  reqIds: string[];
  vendor?: string;
  status: JobStatus;
  statusRuleId: string;
  statusReason: string;
  decidedBy: 'rules' | 'agent' | 'user';
  flags: AppFlags;
  appliedAt: number | null;
  firstAt: number;
  lastAt: number;
  events: AppEvent[];
  threadIds: string[];
  /** Field-level provenance, for the "why?" popover. */
  provenance: {
    company: ProvenanceSource;
    role: ProvenanceSource;
  };
  /** The agent's own explanation, passed through untouched. */
  agentReason?: string;
  /** Rule ids that joined these threads together (J0-J8), for the "why?" popover. */
  mergeRuleIds: string[];
  /** classifyThread's fired rules, per source thread. */
  classificationByThread: Record<string, string[]>;
  /** True when the user has hand-edited this application. */
  edited?: boolean;
  archived?: boolean;
  notes?: string;
}

/** User corrections. Always win over hints and rules. */
export interface FieldOverride {
  company?: string;
  role?: string;
  status?: JobStatus;
  archived?: boolean;
  notes?: string;
}

/**
 * An application that never generated email - a LinkedIn Easy Apply, a
 * referral over WhatsApp, a walk-in. It carries no threads, so it skips the
 * whole classify/correlate pipeline and is appended after buildApplications
 * runs. Its status is never derived - the user set it and it stays put.
 */
export interface ManualApplication {
  id: string;
  company: string;
  role?: string;
  status: JobStatus;
  createdAt: number;
  notes?: string;
  archived?: boolean;
}

export interface UserOverrides {
  /** Groups of threadIds forced into one application. */
  merge: string[][];
  /** Groups of threadIds forced apart. */
  split: string[][];
  /** Keyed by Application.id. */
  fields: Record<string, FieldOverride>;
  /** Applications with no source thread at all. */
  manual: ManualApplication[];
  /** Review-drawer threads the user has looked at and decided are not a job. */
  dismissedReview: string[];
}

export function emptyOverrides(): UserOverrides {
  return { merge: [], split: [], fields: {}, manual: [], dismissedReview: [] };
}

/** A thread we could not place - surfaced in the review drawer, never dropped. */
export interface ExcludedThread {
  threadId: string;
  subject: string;
  from: string;
  at: number;
  kind: ThreadKind;
  /** Rule ids in fire order. */
  reasons: string[];
}

export interface BuildResult {
  applications: Application[];
  /** Non-noise threads we could not confidently place. */
  review: ExcludedThread[];
  /** Deliberately filtered noise, kept for the "excluded (n)" drawer. */
  excluded: ExcludedThread[];
  /** Status events with no application to attach to. */
  orphanEvents: AppEvent[];
  counts: {
    threads: number;
    applications: number;
    excluded: number;
    review: number;
  };
}
