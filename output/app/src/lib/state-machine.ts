/** Explicit lifecycle transitions for records that move between states. */

export interface StateMachine<State extends string> {
  states: readonly State[];
  initial: State;
  can: (from: State, to: State) => boolean;
  next: (from: State) => State[];
  apply: (from: State, to: State) => { ok: true; state: State } | { ok: false; reason: string };
  isFinal: (state: State) => boolean;
}

export function createStateMachine<State extends string>(definition: {
  initial: State;
  transitions: Readonly<Record<State, readonly State[]>>;
}): StateMachine<State> {
  const states = Object.keys(definition.transitions) as State[];
  const can = (from: State, to: State): boolean =>
    (definition.transitions[from] ?? []).includes(to);

  return {
    states,
    initial: definition.initial,
    can,
    next: (from) => [...(definition.transitions[from] ?? [])],
    apply: (from, to) =>
      can(from, to)
        ? { ok: true, state: to }
        : { ok: false, reason: `Cannot move from "${from}" to "${to}"` },
    isFinal: (state) => (definition.transitions[state] ?? []).length === 0,
  };
}
