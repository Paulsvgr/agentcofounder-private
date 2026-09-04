import { DEFAULT_TEMPLATE_OVERLAY_CONFIG, type TemplateOverlayConfig } from "./template-overlays.js";

export const OVERLAY_CHOOSER_SCHEMA = "agentcofounder.overlay_chooser.v1" as const;

/**
 * Overlays the config phase is allowed to decide. `tailwind` and `css_vocabulary`
 * are styling choices that belong to the ship stack, not to the idea text, so the
 * chooser never touches them.
 */
export type ChoosableOverlay = "persistence_primitive" | "api_client" | "stripe";

export type OverlayDecisionSource = "default" | "signal" | "implied";

export interface OverlayDecision {
  overlay: ChoosableOverlay;
  enabled: boolean;
  source: OverlayDecisionSource;
  signals: string[];
}

export interface OverlayChoice {
  schema: typeof OVERLAY_CHOOSER_SCHEMA;
  config: TemplateOverlayConfig;
  decisions: OverlayDecision[];
}

interface Signal {
  label: string;
  pattern: RegExp;
}

/** Networked-data signals: the idea talks to something over HTTP. */
const API_SIGNALS: readonly Signal[] = [
  { label: "api", pattern: /\bapis?\b/i },
  { label: "rest", pattern: /\brest(?:ful)?\b/i },
  { label: "endpoint", pattern: /\bendpoints?\b/i },
  { label: "http", pattern: /\bhttps?\b/i },
  { label: "backend", pattern: /\bback[\s-]?end\b|\bserver[\s-]?side\b/i },
  { label: "webhook", pattern: /\bwebhooks?\b/i },
  { label: "third-party", pattern: /\b(?:third|3rd)[\s-]party\b|\bexternal (?:service|data|source|api)\b/i },
  { label: "fetch-remote", pattern: /\bfetch(?:es|ing)?\b[^.!?]{0,40}\b(?:from|remote|server|api|url)\b/i },
];

/** Payment signals: the idea takes money. */
const STRIPE_SIGNALS: readonly Signal[] = [
  { label: "stripe", pattern: /\bstripe\b/i },
  { label: "payment", pattern: /\bpay\b|\bpayments?\b|\bpaid\b/i },
  { label: "checkout", pattern: /\bcheck[\s-]?out\b/i },
  { label: "subscription", pattern: /\bsubscriptions?\b/i },
  { label: "billing", pattern: /\bbilling\b|\binvoices?\b/i },
  { label: "card", pattern: /\bcredit[\s-]card\b/i },
  { label: "paywall", pattern: /\bpaywall\b/i },
  { label: "pricing-tier", pattern: /\b(?:pricing|price)[\s-](?:plan|tier)s?\b/i },
];

/** Durable-state signals: the app owns a collection that should outlive a reload. */
const PERSISTENCE_SIGNALS: readonly Signal[] = [
  { label: "save", pattern: /\bsaves?\b|\bsaved\b|\bsaving\b/i },
  { label: "persist", pattern: /\bpersist(?:s|ed|ent|ence)?\b/i },
  { label: "store", pattern: /\bstores?\b|\bstored\b|\blocal[\s-]?storage\b/i },
  { label: "survive-reload", pattern: /\b(?:survive|across|between)\b[^.!?]{0,30}\b(?:refresh|refreshes|reload|reloads|sessions?)\b/i },
  { label: "remember", pattern: /\bremember(?:s|ed)?\b/i },
  { label: "collection", pattern: /\bcollections?\b|\binventor(?:y|ies)\b|\blibrar(?:y|ies)\b|\bcatalog(?:ue)?s?\b/i },
  { label: "track", pattern: /\btracks?\b|\btracking\b|\bhistory\b|\blog\b/i },
  { label: "list", pattern: /\blist of\b|\btodos?\b|\bnotes?\b|\btasks?\b|\bentries\b/i },
];

/**
 * Explicit "do not keep state" instructions. These outrank the signals above,
 * because keyword matching cannot tell "saves my list" from "do not save my list"
 * and the negated phrasing trips the persistence patterns too.
 */
const EPHEMERAL_SIGNALS: readonly Signal[] = [
  { label: "no-persistence", pattern: /\bno\b[^.!?]{0,20}\b(?:persistence|storage|saving|database)\b/i },
  { label: "do-not-save", pattern: /\b(?:don'?t|do not|never|without)\b[^.!?]{0,20}\b(?:save|saving|persist|store|storing)\b/i },
  { label: "ephemeral", pattern: /\bephemeral\b|\bstateless\b|\bin[\s-]memory only\b|\bsingle[\s-]session\b/i },
];

function matchSignals(idea: string, signals: readonly Signal[]): string[] {
  return signals.filter((signal) => signal.pattern.test(idea)).map((signal) => signal.label);
}

export function overlayChooserV1EnabledFromEnvironment(defaultEnabled = true): boolean {
  const raw = process.env.HARNESS_OVERLAY_CHOOSER_V1;
  if (raw === undefined || raw.trim() === "") return defaultEnabled;
  const normalized = raw.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes") return true;
  if (normalized === "0" || normalized === "false" || normalized === "no") return false;
  throw new Error("HARNESS_OVERLAY_CHOOSER_V1 must be 0/1, true/false, or yes/no");
}

/**
 * Config phase: read the product idea and pick the template overlays the builder
 * agent should start from. Deterministic on purpose — the selection has to be
 * reproducible from the manifest and costs no tokens.
 */
export function chooseOverlaysFromIdea(
  idea: string,
  base: TemplateOverlayConfig = DEFAULT_TEMPLATE_OVERLAY_CONFIG,
): OverlayChoice {
  const apiSignals = matchSignals(idea, API_SIGNALS);
  const stripeSignals = matchSignals(idea, STRIPE_SIGNALS);
  const persistenceSignals = matchSignals(idea, PERSISTENCE_SIGNALS);
  const ephemeralSignals = matchSignals(idea, EPHEMERAL_SIGNALS);

  const stripe = stripeSignals.length > 0;
  // Stripe Checkout always needs a call to a session-creating backend, so the
  // HTTP client comes along with it even when the idea never says "API".
  const apiFromSignals = apiSignals.length > 0;
  const apiClient = apiFromSignals || stripe;

  const persistenceOff = ephemeralSignals.length > 0;
  const persistence = persistenceOff ? false : base.persistence_primitive;

  const decisions: OverlayDecision[] = [
    {
      overlay: "persistence_primitive",
      enabled: persistence,
      source: persistenceOff ? "signal" : "default",
      signals: persistenceOff ? ephemeralSignals : persistenceSignals,
    },
    {
      overlay: "api_client",
      enabled: apiClient,
      source: apiFromSignals ? "signal" : stripe ? "implied" : "default",
      signals: apiFromSignals ? apiSignals : stripe ? ["stripe-checkout"] : [],
    },
    {
      overlay: "stripe",
      enabled: stripe,
      source: stripe ? "signal" : "default",
      signals: stripeSignals,
    },
  ];

  return {
    schema: OVERLAY_CHOOSER_SCHEMA,
    config: {
      ...base,
      persistence_primitive: persistence,
      api_client: apiClient,
      stripe,
    },
    decisions,
  };
}

export function formatOverlayChoice(choice: OverlayChoice): string {
  const lines = choice.decisions.map((decision) => {
    const state = decision.enabled ? "ON " : "OFF";
    const why =
      decision.signals.length > 0
        ? `${decision.source}: ${decision.signals.join(", ")}`
        : "ship default";
    return `  ${state} ${decision.overlay} (${why})`;
  });
  return ["Overlay chooser v1 selection:", ...lines].join("\n");
}
