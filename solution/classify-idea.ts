/**
 * Decide what an idea needs, without asking a model.
 *
 * Every turn re-sends the whole prompt, so guidance the idea cannot use is paid
 * for on every step and never earns anything. A tic-tac-toe run carried roughly
 * 1,200 tokens of record-keeping guidance across thirteen calls — about 16,000
 * tokens spent describing a storage layer it never touched.
 *
 * Matching is deterministic keyword scoring: no model call, no tokens, no
 * latency. The judging idea is unseen, so the default is deliberately generous
 * — when nothing scores clearly, everything is included. Being occasionally
 * wasteful is cheaper than being confidently wrong about an idea we have never
 * read.
 */

/** What an idea needs from the template. */
export interface IdeaNeeds {
  /** Records that persist and are added to, edited, and removed. */
  collection: boolean;
  /** Any persistence at all, including a single stored value. */
  persistence: boolean;
  /** Values derived by arithmetic rather than stored. */
  calculation: boolean;
  /** Behaviour that advances on its own: timers, countdowns, intervals. */
  time: boolean;
  /** Turn-taking, win conditions, scores. */
  game: boolean;
  /** Money — amounts owed, paid, charged, or split. */
  money: boolean;
  /** The stylesheet whose vocabulary suits this shape. */
  stylesheet: StylesheetName;
  /** True when nothing matched clearly and everything is being included. */
  uncertain: boolean;
}

export type StylesheetName = "records" | "focus" | "board";

interface Signal {
  key: keyof Omit<IdeaNeeds, "stylesheet" | "uncertain">;
  words: readonly string[];
  /** How many distinct words must appear before the signal counts. */
  threshold: number;
}

const SIGNALS: readonly Signal[] = [
  {
    // Deliberately narrow. Generic words like "each", "every" and "keep" appear
    // in almost any description -- an early version read both a game and a bill
    // splitter as record collections because of them. These are phrases that
    // only make sense when there is a list of things being maintained.
    key: "collection",
    threshold: 2,
    words: [
      "put in each", "add a", "adding", "take it off", "remove", "delete",
      "edit", "fix it", "correct that", "see everything", "one list",
      "in a list", "entries", "each one", "cross it off", "tick it off",
      "note down each", "how many i", "all of them", "the whole lot",
    ],
  },
  {
    key: "persistence",
    threshold: 1,
    words: [
      "remember", "saved", "still be there", "come back", "store",
      "over time", "tomorrow", "next time", "persist", "history",
    ],
  },
  {
    key: "calculation",
    threshold: 2,
    words: [
      "calculate", "work out", "how much", "total", "sum", "split", "divide",
      "per person", "each pays", "percentage", "convert", "average", "count",
    ],
  },
  {
    key: "time",
    threshold: 2,
    words: [
      "minute", "minutes", "hour", "second", "countdown", "counts down",
      "timer", "interval", "break", "start and pause", "pause", "reset",
      "elapsed", "due", "overdue", "schedule",
    ],
  },
  {
    key: "game",
    threshold: 2,
    words: [
      "play", "player", "players", "turn", "turns", "win", "wins", "won",
      "draw", "score", "board", "game", "against", "opponent",
    ],
  },
  {
    key: "money",
    threshold: 2,
    words: [
      "pay", "paid", "owe", "owes", "money", "cost", "price", "bill",
      "invoice", "charge", "amount", "tip", "£", "$", "€", "euro", "kr",
    ],
  },
];

/**
 * Count how many distinct terms appear, respecting word boundaries.
 *
 * Substring matching produced false positives that mattered: "every" fired on
 * "everyone", turning a bill splitter into a record collection. A term made of
 * several words is matched as a phrase, still on boundaries at each end.
 */
function countMatches(text: string, words: readonly string[]): number {
  let found = 0;
  for (const word of words) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    // Currency symbols are not word characters, so \b would never match them.
    const boundary = /^[a-z0-9]/u.test(word) ? "\\b" : "";
    const trailing = /[a-z0-9]$/u.test(word) ? "\\b" : "";
    if (new RegExp(`${boundary}${escaped}${trailing}`, "u").test(text)) found += 1;
  }
  return found;
}

/**
 * Pick the stylesheet whose vocabulary fits the shape.
 *
 * `board` suits a fixed grid of controls, `focus` a single dominant readout,
 * `records` a form beside a list. When unsure, `records` is the safe pick: it
 * styles the widest range of markup.
 */
function pickStylesheet(needs: Omit<IdeaNeeds, "stylesheet" | "uncertain">): StylesheetName {
  if (needs.game) return "board";
  if (needs.time && !needs.collection) return "focus";
  if (needs.calculation && !needs.collection) return "focus";
  return "records";
}

export function classifyIdea(idea: string): IdeaNeeds {
  const text = idea.toLowerCase();

  const matched = {
    collection: false,
    persistence: false,
    calculation: false,
    time: false,
    game: false,
    money: false,
  };

  let strongest = 0;
  for (const signal of SIGNALS) {
    const hits = countMatches(text, signal.words);
    strongest = Math.max(strongest, hits);
    if (hits >= signal.threshold) matched[signal.key] = true;
  }

  // Nothing scored clearly. Rather than guess at an idea we cannot read, treat
  // every capability as required so no guidance is withheld.
  const uncertain = strongest < 2;
  if (uncertain) {
    return {
      collection: true,
      persistence: true,
      calculation: true,
      time: true,
      game: true,
      money: true,
      stylesheet: "records",
      uncertain: true,
    };
  }

  // A collection is stored by definition, even when the idea never says so.
  if (matched.collection) matched.persistence = true;

  return { ...matched, stylesheet: pickStylesheet(matched), uncertain: false };
}

/**
 * Guidance blocks that apply only to some shapes.
 *
 * Everything unconditional stays in the system prompt. Only what an idea might
 * not need lives here, so a run pays for what it uses.
 */
export const CONDITIONAL_GUIDANCE: Readonly<Record<string, string>> = {
  collection: [
    "## Records",
    "",
    "This idea keeps a collection of records. Use `useCollection` from `src/lib/`",
    "rather than hand-rolling storage; its API is given under **Provided primitives**.",
    "Show a short guiding message wherever the collection can be empty, and confirm",
    "before deleting anything the user cannot recreate.",
  ].join("\n"),

  persistence: [
    "## Persistence",
    "",
    "Required data must survive a page refresh. Keep reads tolerant of missing or",
    "malformed stored values, and keep a failed write from losing the session.",
  ].join("\n"),

  calculation: [
    "## Derived values",
    "",
    "Values this idea computes are derived from current state on render, never",
    "stored separately and never allowed to drift. Handle zero, empty and",
    "out-of-range inputs without producing NaN or a blank result.",
  ].join("\n"),

  time: [
    "## Time",
    "",
    "Behaviour that advances on its own needs its interval cleared on unmount.",
    "In tests control the clock with `vi.useFakeTimers()`, advance inside `act()`,",
    "and restore real timers afterwards — never wait on the real clock.",
  ].join("\n"),

  game: [
    "## Turn-based state",
    "",
    "Keep whose turn it is, the outcome, and any running tally as separate pieces",
    "of state. Starting a fresh round must not reset a tally the idea says to keep.",
  ].join("\n"),

  money: [
    "## Amounts",
    "",
    "Money is entered as text and must be validated before use. Round only for",
    "display. No payment provider is available and none may be added: model the",
    "state the idea describes — owed, paid, settled — behind the same boundary as",
    "any other data, so a real provider could be added later without touching the UI.",
  ].join("\n"),
};

/** Assemble the guidance an idea actually needs, in a stable order. */
export function guidanceFor(needs: IdeaNeeds): string {
  const order: (keyof IdeaNeeds)[] = [
    "collection", "persistence", "calculation", "time", "game", "money",
  ];
  return order
    .filter((key) => needs[key] === true)
    .map((key) => CONDITIONAL_GUIDANCE[key])
    .filter(Boolean)
    .join("\n\n");
}
