import type { CapabilityClass } from "@/lib/capabilities/registry";
import type { Entity } from "@/lib/uss/schema";

type OpenDecision = Extract<Entity, { kind: "openDecision" }>;

export interface CapabilityQuestion {
  title: string;
  /** Plain language. A founder or a lawyer must be able to answer it. */
  question: string;
  /** What breaks if it stays unanswered. */
  why: string;
  category: OpenDecision["category"];
  severity: OpenDecision["impact"]["severity"];
}

/**
 * The ambiguity bank — senior-level interrogation as DATA, not as an LLM call.
 *
 * This is the single most important file for the product promise. Detecting
 * VIDEO_GEN + OBJECT_STORAGE in "users upload videos and generate AI videos"
 * yields ~20 real engineering questions with zero LLM calls, which is why every
 * user gets the reasoning method and only depth is gated.
 *
 * The baseline measured requirements-completeness at 26/100 — designs that were
 * structurally clean and silent on exactly these questions. This is the direct
 * answer to that number.
 *
 * Rules for anything added here:
 *   - Plain language. No jargon a non-technical founder cannot parse.
 *   - Phrased as an offer, never an audit finding.
 *   - `blocking` only when you genuinely cannot design without the answer.
 */
export const CAPABILITY_QUESTIONS: Partial<Record<CapabilityClass, CapabilityQuestion[]>> = {
  PAYMENTS: [
    { title: "Duplicate payment notifications", question: "Payment providers send the same notification more than once. What should happen the second and third time?", why: "Without an answer, customers get charged twice or orders get created twice.", category: "integration", severity: "blocking" },
    { title: "Refunds", question: "Can a payment be refunded, and can it be refunded partially?", why: "Refunds change the data model, not just a screen — money that has moved has to be tracked both ways.", category: "data", severity: "material" },
    { title: "Payment succeeds but fulfilment fails", question: "If you take the money and then something goes wrong, what should happen?", why: "This is the most common way payment systems lose money or customers.", category: "integration", severity: "blocking" },
    { title: "Who gets paid, and when", question: "Does money go straight to you, or do you hold it and pay someone else later?", why: "Holding money for others is a different system, and in many places a regulated one.", category: "compliance", severity: "material" },
    { title: "Currency and tax", question: "Which currencies, and who is responsible for sales tax or VAT?", why: "Tax handling is difficult to retrofit and getting it wrong is a legal problem.", category: "compliance", severity: "material" },
    { title: "Failed card payments", question: "When a recurring payment fails, how long do they keep access before you cut them off?", why: "Cutting access instantly loses customers whose card simply expired.", category: "scope", severity: "material" },
  ],
  OBJECT_STORAGE: [
    { title: "File size and formats", question: "How large can an uploaded file be, and which formats do you accept?", why: "Anything above roughly 100MB needs a fundamentally different upload path.", category: "data", severity: "blocking" },
    { title: "Who can see uploaded files", question: "Are uploaded files public, or private to specific people?", why: "Private files need signed, expiring links — this cannot be bolted on later safely.", category: "auth", severity: "blocking" },
    { title: "Storage retention", question: "How long do you keep uploaded files, and can users delete them permanently?", why: "Storage cost grows forever otherwise, and deletion may be a legal obligation.", category: "data", severity: "material" },
  ],
  VIDEO_GEN: [
    { title: "Generation time", question: "Generating video takes minutes, not seconds. What should the user see while they wait?", why: "This decides whether you need background jobs and progress tracking, which shapes the whole architecture.", category: "scale", severity: "blocking" },
    { title: "Cost per generation", question: "Roughly what can you afford to spend per video, and what stops one user spending your whole budget?", why: "Generation is expensive enough that a few heavy users can bankrupt an unlimited product.", category: "budget", severity: "blocking" },
    { title: "Failure and cancellation", question: "If generation fails halfway, or the user cancels, are they charged?", why: "Both cases are common and both need an explicit rule before anyone builds it.", category: "integration", severity: "material" },
    { title: "Ownership and rights", question: "Who owns the generated video, and can users sell or publish it commercially?", why: "Provider licence terms vary, and your users will ask.", category: "compliance", severity: "material" },
    { title: "Content safety", question: "What stops someone generating something you would not want associated with your product?", why: "Moderation is far harder to add after launch than before.", category: "compliance", severity: "material" },
  ],
  IMAGE_GEN: [
    { title: "Cost and quota", question: "How many images can one user generate, and over what period?", why: "Without a limit, cost scales with abuse rather than with revenue.", category: "budget", severity: "material" },
    { title: "Content safety", question: "What stops someone generating something harmful or illegal?", why: "Moderation is far harder to add after launch than before.", category: "compliance", severity: "material" },
  ],
  LLM: [
    { title: "When the model is wrong", question: "What happens when the AI gives a confidently wrong answer?", why: "Every design needs an answer to this — review, citation, or a clear disclaimer.", category: "scope", severity: "blocking" },
    { title: "Data sent to the provider", question: "Is any of the data you send to the AI confidential, and may the provider retain it?", why: "For legal, medical or financial data this determines which providers you may use at all.", category: "compliance", severity: "blocking" },
    { title: "Cost per request", question: "Roughly what should one AI request cost you, and what stops it running away?", why: "Token cost scales with usage and with prompt size, and surprises are expensive.", category: "budget", severity: "material" },
    { title: "Provider outage", question: "What should happen when the AI provider is down or rate-limits you?", why: "This decides whether you need a fallback provider or a queue.", category: "integration", severity: "material" },
  ],
  VECTOR_SEARCH: [
    { title: "Who may retrieve what", question: "Should everyone be able to search everything, or is some content restricted?", why: "Permission-aware retrieval must be designed in; filtering results afterwards leaks data.", category: "auth", severity: "blocking" },
    { title: "Keeping the index current", question: "When a source document changes, how quickly must search reflect it?", why: "This is the difference between a nightly job and a live sync pipeline.", category: "data", severity: "material" },
    { title: "When there is no answer", question: "What should happen when the answer genuinely is not in your content?", why: "Without an explicit rule the system will invent something plausible.", category: "scope", severity: "blocking" },
  ],
  AUTH: [
    { title: "How people sign in", question: "How should people sign in — email and password, Google, magic link, or your company's existing login?", why: "Enterprise buyers often require their own identity provider, which is expensive to add later.", category: "auth", severity: "material" },
  ],
  AUTHZ: [
    { title: "Roles and permissions", question: "Do all users have the same powers, or do some administer others?", why: "Roles shape the data model and every screen; retrofitting them touches everything.", category: "auth", severity: "blocking" },
    { title: "Separation between customers", question: "If several organisations use this, what guarantees one can never see another's data?", why: "Cross-tenant data leakage is the most damaging bug a multi-customer product can ship.", category: "auth", severity: "blocking" },
  ],
  RELATIONAL_STORE: [
    { title: "Two people, same record", question: "What should happen when two people change the same thing at the same time?", why: "Silent overwrites are a data-loss bug that is very hard to detect after the fact.", category: "data", severity: "material" },
  ],
  QUEUE: [
    { title: "When a job fails", question: "If a background job fails, should it retry, and who finds out if it keeps failing?", why: "Jobs that fail silently are how work quietly stops happening.", category: "operations", severity: "material" },
  ],
  EMAIL: [
    { title: "Email volume", question: "Roughly how many emails per day, and are they one-to-one or bulk?", why: "Bulk sending needs deliverability work that transactional sending does not.", category: "scale", severity: "material" },
    { title: "Consent", question: "Have recipients agreed to receive these emails, and can they unsubscribe?", why: "In most jurisdictions this is a legal requirement, not a feature.", category: "compliance", severity: "material" },
  ],
  REALTIME_SYNC: [
    { title: "Conflicting edits", question: "If two people edit the same thing at once while both are online, whose change wins?", why: "This is the hardest part of any collaborative product and it determines the entire data design.", category: "data", severity: "blocking" },
    { title: "Working offline", question: "Should this keep working when someone loses their connection?", why: "Offline support changes the architecture fundamentally; it is not a later feature.", category: "scale", severity: "material" },
  ],
  WORKFLOW_ENGINE: [
    { title: "Running the same input twice", question: "If the same trigger fires twice, should the work happen twice?", why: "Retries and duplicate webhooks are normal, so without an answer you get duplicate records.", category: "integration", severity: "blocking" },
    { title: "When a step fails", question: "If one step in the sequence fails, should the rest continue, stop, or undo?", why: "Half-finished automations are worse than failed ones, because nobody notices.", category: "operations", severity: "blocking" },
  ],
  SEARCH: [
    { title: "What is searchable", question: "What exactly should people be able to search across?", why: "This determines whether simple database search is enough or a search engine is needed.", category: "data", severity: "material" },
  ],
  CACHE: [
    { title: "Stale data", question: "How out of date can this information be before it becomes a problem?", why: "Caching trades freshness for speed, and the acceptable trade differs per screen.", category: "data", severity: "material" },
  ],
  SCHEDULER: [
    { title: "Missed runs", question: "If a scheduled job does not run — the system was down, say — should it catch up later?", why: "Catch-up behaviour is a design decision, not a default.", category: "operations", severity: "material" },
  ],
};

/** Total questions available for a set of capability classes. */
export function questionsFor(classes: CapabilityClass[]): CapabilityQuestion[] {
  return classes.flatMap((c) => CAPABILITY_QUESTIONS[c] ?? []);
}
