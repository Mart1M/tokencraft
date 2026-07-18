export const COLOR_MODIFIER_TYPES = ["lighten", "darken", "alpha", "mix"] as const;
export const COLOR_MODIFIER_SPACES = ["srgb", "p3", "hsl", "lch"] as const;

export type TokenColorModifierType = (typeof COLOR_MODIFIER_TYPES)[number];
export type TokenColorModifierSpace = (typeof COLOR_MODIFIER_SPACES)[number];

export type TokenColorModifier = {
  type: TokenColorModifierType;
  space: TokenColorModifierSpace;
  value: string;
  color?: string;
  /** A Tokens Studio-compatible output format imported from an existing token. */
  format?: string;
};

export function parseTokenColorModifier(value: unknown): TokenColorModifier | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const type = record.type;
  const space = record.space;

  if (
    !COLOR_MODIFIER_TYPES.includes(type as TokenColorModifierType) ||
    !COLOR_MODIFIER_SPACES.includes(space as TokenColorModifierSpace) ||
    (typeof record.value !== "string" && typeof record.value !== "number")
  ) {
    return undefined;
  }

  if (type === "mix" && typeof record.color !== "string") {
    return undefined;
  }

  return {
    type: type as TokenColorModifierType,
    space: space as TokenColorModifierSpace,
    value: String(record.value),
    ...(typeof record.color === "string" ? { color: record.color } : {}),
    ...(typeof record.format === "string" ? { format: record.format } : {}),
  };
}

export function createDefaultColorModifier(): TokenColorModifier {
  return { type: "alpha", space: "srgb", value: "0.05" };
}
