import Color from "colorjs.io";

import type { ImportedTokenRow } from "@/lib/tokens/entries";
import { getRowModeDisplayValue } from "@/lib/tokens/display";

type PreviewResult = { color?: string; error?: string };

type NumberExpressionParser = {
  expression: string;
  index: number;
};

function parseNumberExpression(expression: string): number | undefined {
  const parser: NumberExpressionParser = { expression, index: 0 };

  function skipWhitespace() {
    while (/\s/.test(parser.expression[parser.index] ?? "")) parser.index += 1;
  }

  function parsePrimary(): number | undefined {
    skipWhitespace();
    const character = parser.expression[parser.index];

    if (character === "(") {
      parser.index += 1;
      const value = parseAdditive();
      skipWhitespace();
      if (parser.expression[parser.index] !== ")") return undefined;
      parser.index += 1;
      return value;
    }

    const match = parser.expression.slice(parser.index).match(/^(?:\d+(?:\.\d*)?|\.\d+)/);
    if (!match) return undefined;
    parser.index += match[0].length;
    return Number(match[0]);
  }

  function parseUnary(): number | undefined {
    skipWhitespace();
    const character = parser.expression[parser.index];
    if (character === "+" || character === "-") {
      parser.index += 1;
      const value = parseUnary();
      return value === undefined ? undefined : character === "-" ? -value : value;
    }
    return parsePrimary();
  }

  function parseMultiplicative(): number | undefined {
    let value = parseUnary();
    while (value !== undefined) {
      skipWhitespace();
      const operation = parser.expression[parser.index];
      if (operation !== "*" && operation !== "/") break;
      parser.index += 1;
      const right = parseUnary();
      if (right === undefined || (operation === "/" && right === 0)) return undefined;
      value = operation === "*" ? value * right : value / right;
    }
    return value;
  }

  function parseAdditive(): number | undefined {
    let value = parseMultiplicative();
    while (value !== undefined) {
      skipWhitespace();
      const operation = parser.expression[parser.index];
      if (operation !== "+" && operation !== "-") break;
      parser.index += 1;
      const right = parseMultiplicative();
      if (right === undefined) return undefined;
      value = operation === "+" ? value + right : value - right;
    }
    return value;
  }

  const result = parseAdditive();
  skipWhitespace();
  return result !== undefined && parser.index === expression.length && Number.isFinite(result)
    ? result
    : undefined;
}

function getAliasPath(value: string) {
  const match = value.trim().match(/^\{([^}]+)\}$/);
  return match?.[1];
}

export function resolveColorModifierPreview(
  rows: ImportedTokenRow[],
  token: ImportedTokenRow,
  mode: string,
): PreviewResult {
  const byPath = new Map(rows.map((row) => [row.name, row]));
  const colorStack = new Set<string>();
  const numberStack = new Set<string>();

  function getText(row: ImportedTokenRow) {
    return getRowModeDisplayValue(row, mode)?.text?.trim();
  }

  function resolveNumber(path: string): number | undefined {
    if (numberStack.has(path)) return undefined;
    const row = byPath.get(path);
    const text = row ? getText(row) : undefined;
    if (!text) return undefined;

    numberStack.add(path);
    const alias = getAliasPath(text);
    const result = alias ? resolveNumber(alias) : parseNumberExpression(text);
    numberStack.delete(path);
    return result;
  }

  function resolveAmount(expression: string): number | undefined {
    const replaced = expression.replace(/\{([^}]+)\}/g, (_match, path: string) => {
      const value = resolveNumber(path.trim());
      return value === undefined ? "NaN" : String(value);
    });

    const result = parseNumberExpression(replaced);
    return result !== undefined && result >= 0 && result <= 1 ? result : undefined;
  }

  function resolveColor(path: string): string | undefined {
    if (colorStack.has(path)) return undefined;
    const row = byPath.get(path);
    if (!row || row.type !== "color") return undefined;

    colorStack.add(path);
    const text = getText(row);
    const alias = text ? getAliasPath(text) : undefined;
    const base = alias ? resolveColor(alias) : text;

    if (!base) {
      colorStack.delete(path);
      return undefined;
    }

    const modifier = row.colorModifier;
    if (!modifier) {
      try {
        const color = new Color(base);
        const result = color.to("srgb").toString({ format: "hex", inGamut: true });
        colorStack.delete(path);
        return result;
      } catch {
        colorStack.delete(path);
        return undefined;
      }
    }

    const amount = resolveAmount(modifier.value);
    const mixColor = modifier.type === "mix" && modifier.color
      ? (() => {
          const reference = getAliasPath(modifier.color!);
          return reference ? resolveColor(reference) : modifier.color;
        })()
      : undefined;

    if (amount === undefined || (modifier.type === "mix" && !mixColor)) {
      colorStack.delete(path);
      return undefined;
    }

    try {
      const color = new Color(base);
      let result: Color;

      if (modifier.type === "alpha") {
        color.alpha = amount;
        result = color;
      } else if (modifier.type === "mix") {
        result = color.mix(new Color(mixColor!), amount, { space: modifier.space }) as Color;
      } else {
        const target = color.to(modifier.space) as Color;
        if (modifier.type === "lighten") {
          if (modifier.space === "lch") {
            const lightness = Number(target.lch.l);
            const chroma = Number(target.lch.c);
            target.set("lch.l", lightness + (100 - lightness) * amount);
            target.set("lch.c", Math.max(0, chroma * (1 - amount)));
          } else if (modifier.space === "hsl") {
            const lightness = Number(target.hsl.l);
            target.set("hsl.l", lightness + (100 - lightness) * amount);
          } else {
            for (const channel of ["r", "g", "b"] as const) {
              const key = `${modifier.space}.${channel}`;
              target.set(key, Number(target.get(key)) + (1 - Number(target.get(key))) * amount);
            }
          }
        } else if (modifier.space === "lch") {
          target.set("lch.l", Number(target.lch.l) * (1 - amount));
          target.set("lch.c", Math.max(0, Number(target.lch.c) * (1 - amount)));
        } else if (modifier.space === "hsl") {
          target.set("hsl.l", Number(target.hsl.l) * (1 - amount));
        } else {
          for (const channel of ["r", "g", "b"] as const) {
            const key = `${modifier.space}.${channel}`;
            target.set(key, Number(target.get(key)) * (1 - amount));
          }
        }
        result = target;
      }

      const resolved = result.to("srgb").toString({ format: "hex", inGamut: true });
      colorStack.delete(path);
      return resolved;
    } catch {
      colorStack.delete(path);
      return undefined;
    }
  }

  const color = resolveColor(token.name);
  return color
    ? { color }
    : { error: "Unable to resolve this color modifier." };
}
