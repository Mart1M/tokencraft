export type StoredTokenRawValue =
  | string
  | number
  | boolean
  | null
  | StoredTokenRawValue[]
  | { [key: string]: StoredTokenRawValue };

export function toStoredTokenRawValue(value: unknown): StoredTokenRawValue | undefined {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => toStoredTokenRawValue(item))
      .filter((item): item is StoredTokenRawValue => item !== undefined);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .map(([key, item]) => {
          const next = toStoredTokenRawValue(item);
          return next === undefined ? null : ([key, next] as const);
        })
        .filter((entry): entry is [string, StoredTokenRawValue] => entry !== null)
    );
  }

  return undefined;
}
