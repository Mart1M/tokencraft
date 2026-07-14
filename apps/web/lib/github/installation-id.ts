export function normalizeInstallationId(value: string | number | bigint) {
  return typeof value === "bigint" ? value : BigInt(value);
}
