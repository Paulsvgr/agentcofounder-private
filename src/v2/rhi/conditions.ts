export interface ConditionContext {
  done: boolean;
  slice: number;
  max_slices: number;
  last_action: string | null;
  last_l0_exists: boolean;
  last_l0_passed: boolean | null;
  product_test_count: number;
  report_status: string | null;
  has_report: boolean;
  last_agent: string;
  task_kind: string;
}

type Token =
  | { kind: "id"; value: string }
  | { kind: "string"; value: string }
  | { kind: "number"; value: number }
  | { kind: "op"; value: string };

type Literal = string | number | boolean | null;

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  while (index < source.length) {
    const char = source[index]!;
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    if (char === '"' || char === "'") {
      const quote = char;
      index += 1;
      let value = "";
      while (index < source.length && source[index] !== quote) {
        value += source[index];
        index += 1;
      }
      if (source[index] !== quote) throw new Error("Unterminated string in condition");
      index += 1;
      tokens.push({ kind: "string", value });
      continue;
    }
    if (/[0-9]/.test(char) || (char === "-" && /[0-9]/.test(source[index + 1] ?? ""))) {
      const start = index;
      index += 1;
      while (index < source.length && /[0-9]/.test(source[index]!)) index += 1;
      tokens.push({ kind: "number", value: Number(source.slice(start, index)) });
      continue;
    }
    const two = source.slice(index, index + 2);
    if (["==", "!=", ">=", "<=", "&&", "||"].includes(two)) {
      tokens.push({ kind: "op", value: two });
      index += 2;
      continue;
    }
    if (["!", ">", "<", "(", ")"].includes(char)) {
      tokens.push({ kind: "op", value: char });
      index += 1;
      continue;
    }
    if (/[A-Za-z_]/.test(char)) {
      const start = index;
      index += 1;
      while (index < source.length && /[A-Za-z0-9_]/.test(source[index]!)) index += 1;
      tokens.push({ kind: "id", value: source.slice(start, index) });
      continue;
    }
    throw new Error(`Unexpected character in condition: ${char}`);
  }
  return tokens;
}

class Parser {
  private index = 0;
  constructor(
    private readonly tokens: Token[],
    private readonly context: ConditionContext,
  ) {}

  parse(): boolean {
    const value = this.parseOr();
    if (this.index !== this.tokens.length) throw new Error("Unexpected trailing tokens in condition");
    return this.truthy(value);
  }

  private parseOr(): Literal {
    let left = this.parseAnd();
    while (this.match("||")) {
      const right = this.parseAnd();
      left = this.truthy(left) || this.truthy(right);
    }
    return left;
  }

  private parseAnd(): Literal {
    let left = this.parseNot();
    while (this.match("&&")) {
      const right = this.parseNot();
      left = this.truthy(left) && this.truthy(right);
    }
    return left;
  }

  private parseNot(): Literal {
    if (this.match("!")) return !this.truthy(this.parseNot());
    return this.parseComparison();
  }

  private parseComparison(): Literal {
    const left = this.parsePrimary();
    const op = this.peek();
    if (op?.kind === "op" && ["==", "!=", ">=", "<=", ">", "<"].includes(op.value)) {
      this.index += 1;
      const right = this.parsePrimary();
      return this.compare(left, op.value, right);
    }
    return left;
  }

  private parsePrimary(): Literal {
    const token = this.peek();
    if (!token) throw new Error("Unexpected end of condition");
    if (token.kind === "op" && token.value === "(") {
      this.index += 1;
      const inner = this.parseOr();
      if (!this.match(")")) throw new Error("Expected )");
      return inner;
    }
    this.index += 1;
    if (token.kind === "string") return token.value;
    if (token.kind === "number") return token.value;
    if (token.kind === "id") return this.resolve(token.value);
    throw new Error(`Unexpected token in condition: ${token.value}`);
  }

  private resolve(name: string): Literal {
    if (name === "true") return true;
    if (name === "false") return false;
    if (name === "null") return null;
    if (name in this.context) return this.context[name as keyof ConditionContext] as Literal;
    throw new Error(`Unknown condition identifier: ${name}`);
  }

  private compare(left: Literal, op: string, right: Literal): boolean {
    if (op === "==") return left === right;
    if (op === "!=") return left !== right;
    if (typeof left !== "number" || typeof right !== "number") {
      throw new Error(`Cannot order ${String(left)} and ${String(right)}`);
    }
    if (op === ">") return left > right;
    if (op === "<") return left < right;
    if (op === ">=") return left >= right;
    return left <= right;
  }

  private truthy(value: Literal): boolean {
    return Boolean(value);
  }

  private peek(): Token | undefined {
    return this.tokens[this.index];
  }

  private match(op: string): boolean {
    const token = this.peek();
    if (token?.kind === "op" && token.value === op) {
      this.index += 1;
      return true;
    }
    return false;
  }
}

export function evaluateCondition(expression: string, context: ConditionContext): boolean {
  const trimmed = expression.trim();
  if (trimmed === "") throw new Error("Condition must not be empty");
  return new Parser(tokenize(trimmed), context).parse();
}
