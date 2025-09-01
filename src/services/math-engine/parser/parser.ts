import { Token } from "../types";

// Operator precedence and associativity
const PRECEDENCE: Record<string, number> = {
  "+": 1,
  "-": 1,
  "*": 2,
  "/": 2,
  "^": 3,
};
const RIGHT_ASSOCIATIVE = new Set(["^"]);

/**
 * Convert infix tokens to Reverse Polish Notation using Shunting-yard algorithm
 * Handles unary operators by converting ±x to 0±x
 * Security: No dynamic code execution, pure token manipulation
 */
export function toRPN(tokens: Token[]): Token[] {
  const output: Token[] = [];
  const operators: Token[] = [];

  let prev: Token | null = null;

  const pushOperator = (op: Token) => {
    if (op.t !== "op")
      throw new Error("Internal: pushOperator expects operator");

    while (operators.length) {
      const top = operators[operators.length - 1];

      if (top.t === "op") {
        const topPrec = PRECEDENCE[top.v];
        const opPrec = PRECEDENCE[op.v];

        if (
          (RIGHT_ASSOCIATIVE.has(op.v) && topPrec > opPrec) ||
          (!RIGHT_ASSOCIATIVE.has(op.v) && topPrec >= opPrec)
        ) {
          output.push(operators.pop()!);
          continue;
        }
      } else if (top.t === "name") {
        // Function application has highest precedence
        output.push(operators.pop()!);
        continue;
      }
      break;
    }
    operators.push(op);
  };

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    // Handle unary operators by converting to 0±x
    if (token.t === "op" && (token.v === "+" || token.v === "-")) {
      const isUnary =
        !prev || prev.t === "op" || prev.t === "lpar" || prev.t === "comma";
      if (isUnary) {
        output.push({ t: "num", v: 0 }); // Push implicit 0
      }
    }

    if (token.t === "num") {
      output.push(token);
    } else if (token.t === "name") {
      // Check if this is a function (followed by '(')
      const next = tokens[i + 1];
      if (next?.t === "lpar") {
        operators.push(token); // Function name to be applied later
      } else {
        output.push(token); // Variable or constant
      }
    } else if (token.t === "op") {
      pushOperator(token);
    } else if (token.t === "lpar") {
      operators.push(token);
    } else if (token.t === "comma") {
      // Pop until we find the opening parenthesis
      while (operators.length && operators[operators.length - 1].t !== "lpar") {
        output.push(operators.pop()!);
      }
      if (!operators.length) {
        throw new Error("Misplaced comma");
      }
    } else if (token.t === "rpar") {
      // Pop until we find the opening parenthesis
      while (operators.length && operators[operators.length - 1].t !== "lpar") {
        output.push(operators.pop()!);
      }
      if (!operators.length) {
        throw new Error("Unmatched closing parenthesis");
      }
      operators.pop(); // Remove the '('

      // If there's a function name on top, output it
      if (operators.length && operators[operators.length - 1].t === "name") {
        output.push(operators.pop()!);
      }
    }

    prev = token;
  }

  // Pop remaining operators
  while (operators.length) {
    const op = operators.pop()!;
    if (op.t === "lpar" || op.t === "rpar") {
      throw new Error("Unmatched parenthesis");
    }
    output.push(op);
  }

  return output;
}
