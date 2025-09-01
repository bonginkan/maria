/**
 * Numeric evaluation engine - safe expression evaluation without eval()
 * Implements RPN evaluation with property-based testing compliance
 */
import type { ASTNode, NumericEvalResult, _Token } from './types.js';
import { tokenize } from './parser/tokenizer.js';
import { parseExpression } from './parser/parser.js';

const MATH_CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  e: Math.E,
} as const;

const MATH_FUNCTIONS: Record<string, (x: number) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  exp: Math.exp,
  log: Math.log,
  sqrt: Math.sqrt,
  abs: Math.abs,
} as const;

/**
 * Safe expression evaluation - NO eval() or Function() 
 * Uses custom tokenizer → AST → evaluation pipeline
 */
export function evaluate(
  expr: string, 
  vars: Record<string, number> = {},
  maxSteps: number = 200
): NumericEvalResult {
  const warnings: string[] = [];
  const steps: string[] = [];
  
  if (!expr.trim()) {
    throw new Error('Empty expression');
  }

  if (expr.length > 5000) {
    throw new Error('Expression too long (>5000 chars)');
  }

  try {
    // Step 1: Tokenize
    const tokens = tokenize(expr);
    steps.push(`tokenized: ${tokens.length} tokens`);
    
    // Step 2: Parse to AST
    const ast = parseExpression(tokens);
    steps.push(`parsed to AST: ${ast.k}`);
    
    // Step 3: Evaluate AST with safety checks
    const value = evaluateAST(ast, { ...MATH_CONSTANTS, ...vars }, warnings, maxSteps);
    
    // Step 4: Numerical stability checks
    if (!Number.isFinite(value)) {
      if (Number.isNaN(value)) {
        warnings.push('Result is NaN - domain error');
      } else {
        warnings.push('Result is infinite - overflow/underflow');
      }
    }
    
    if (Math.abs(value) > 1e308) {
      warnings.push('Result near overflow boundary');
    }
    
    if (Math.abs(value) < 1e-308 && value !== 0) {
      warnings.push('Result near underflow boundary');
    }

    return { 
      value: Number.isFinite(value) ? value : 0,
      warnings: warnings.length > 0 ? warnings : undefined,
      steps: steps.length > 0 ? steps : undefined 
    };
    
  } catch (error) {
    throw new Error(`Evaluation failed: ${(error as Error).message}`);
  }
}

/**
 * Recursive AST evaluation with domain checking
 */
function evaluateAST(
  node: ASTNode, 
  context: Record<string, number>,
  warnings: string[],
  stepsRemaining: number
): number {
  if (stepsRemaining <= 0) {
    throw new Error('Max evaluation steps exceeded');
  }

  switch (node.k) {
    case 'num':
      return node.v;
      
    case 'var':
      if (!(node.name in context)) {
        throw new Error(`Undefined variable: ${node.name}`);
      }
      return context[node.name];
      
    case 'un':
      {
        const operand = evaluateAST(node.x, context, warnings, stepsRemaining - 1);
      }
        return node.op === '+' ? operand : -operand;
      
    case 'bin': {
      const left = evaluateAST(node.l, context, warnings, stepsRemaining - 1);
      const right = evaluateAST(node.r, context, warnings, stepsRemaining - 1);
      
      switch (node.op) {
        case '+':
          return left + right;
        case '-':
          return left - right;
        case '*':
          return left * right;
        case '/':
          if (right === 0) {
            warnings.push('Division by zero');
            return NaN;
          }
          return left / right;
        case '^':
          // Domain checking for power operations
          if (left < 0 && Math.abs(right % 1) > 1e-10) {
            warnings.push('Negative base with non-integer exponent');
            return NaN;
          }
          return Math.pow(left, right);
        default:
          throw new Error(`Unknown binary operator: ${node.op}`);
      }
    }
      
    case 'fun': {
        const arg = evaluateAST(node.x, context, warnings, stepsRemaining - 1);
        const func = MATH_FUNCTIONS[node.name];
      
        if (!func) {
          throw new Error(`Unknown function: ${node.name}`);
        }
      
        // Domain validation for specific functions
        switch (node.name) {
          case 'log':
            if (arg <= 0) {
              warnings.push('Logarithm of non-positive number');
              return NaN;
            }
            break;
          case 'sqrt':
            if (arg < 0) {
              warnings.push('Square root of negative number');
              return NaN;
            }
            break;
        }
      
        return func(arg);
      }
      
    default: {
        // Type-safe exhaustiveness check
        const _never: never = node;
        throw new Error(`Unknown AST node type: ${JSON.stringify(node)}`);
      }
  }
}

/**
 * Substitute variables in expression string (for preprocessing)
 */
export function substituteVariables(
  expr: string, 
  vars: Record<string, number>
): string {
  let result = expr;
  
  // Sort by length descending to avoid partial replacements
  const sortedVars = Object.entries(vars)
    .sort(([a], [b]) => b.length - a.length);
    
  for (const [name, value] of sortedVars) {
    // Use word boundaries to avoid partial matches
    const regex = new RegExp(`\\b${name}\\b`, 'g');
    result = result.replace(regex, value.toString());
  }
  
  return result;
}

/**
 * Basic algebraic simplification (constant folding)
 */
export function simplifyExpression(expr: string): string {
  // Simple patterns for constant folding
  let simplified = expr;
  
  // Remove unnecessary parentheses around single numbers
  simplified = simplified.replace(/\((\d+(?:\.\d+)?)\)/g, '$1');
  
  // Simplify obvious operations
  simplified = simplified.replace(/\+\s*0\b/g, '');
  simplified = simplified.replace(/\b0\s*\+/g, '');
  simplified = simplified.replace(/\*\s*1\b/g, '');
  simplified = simplified.replace(/\b1\s*\*/g, '');
  
  return simplified.trim();
}

/**
 * Validate mathematical properties for testing
 */
export function validateMathProperties(
  expr: string, 
  vars: Record<string, number> = {}
): { valid: boolean; violations: string[] } {
  const violations: string[] = [];
  
  try {
    const result = evaluate(expr, vars);
    
    // Check for mathematical property violations
    if (result.warnings) {
      violations.push(...result.warnings);
    }
    
    // Additional domain-specific checks
    if (expr.includes('sin') || expr.includes('cos')) {
      // Trigonometric identity check: sin²(x) + cos²(x) ≈ 1
      const sinExpr = expr.replace(/sin/g, 'sin').replace(/cos/g, 'sin');
      const cosExpr = expr.replace(/sin/g, 'cos').replace(/cos/g, 'cos');
      
      try {
        const sinVal = evaluate(sinExpr, vars).value;
        const cosVal = evaluate(cosExpr, vars).value;
        const identity = sinVal * sinVal + cosVal * cosVal;
        
        if (Math.abs(identity - 1) > 1e-12) {
          violations.push('Trigonometric identity violation detected');
        }
      } catch (innerError) {
        // Ignore inner error during identity check
      }
    }
    
    return { valid: violations.length === 0, violations };
  } catch (error) {
    violations.push(`Evaluation error: ${(error as Error).message}`);
    return { valid: false, violations };
  }
}