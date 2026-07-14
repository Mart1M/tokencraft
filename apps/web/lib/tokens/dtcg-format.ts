function formatPrimitive(value: unknown) {
  if (value === null || value === undefined) {
    return "—";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

function formatArrayValue(value: unknown[], type?: string) {
  if (type === "fontFamily" && value.every((item) => typeof item === "string")) {
    return value.join(", ");
  }

  if (
    type === "cubicBezier" &&
    value.length === 4 &&
    value.every((item) => typeof item === "number")
  ) {
    return `cubic-bezier(${value.join(", ")})`;
  }

  if (type === "shadow" && value.every((item) => item && typeof item === "object")) {
    return `${value.length} layer${value.length === 1 ? "" : "s"}`;
  }

  if (type === "gradient") {
    return `${value.length} stop${value.length === 1 ? "" : "s"}`;
  }

  return JSON.stringify(value).slice(0, 160);
}

const MODE_KEYS = new Set(["light", "dark", "default", "compact", "hover", "active"]);

function looksLikeModeMap(value: Record<string, unknown>) {
  const keys = Object.keys(value);
  return keys.length > 0 && keys.every((key) => MODE_KEYS.has(key));
}

function formatObjectValue(value: Record<string, unknown>, type?: string): string {
  if (looksLikeModeMap(value)) {
    return Object.entries(value)
      .map(([mode, modeValue]) => `${mode}: ${formatDtcgTokenValue(modeValue, type)}`)
      .join(" · ");
  }

  if (type === "border") {
    const parts = [value.width, value.style, value.color].filter(Boolean).map(formatPrimitive);
    return parts.join(" ") || JSON.stringify(value).slice(0, 160);
  }

  if (type === "typography") {
    const parts = ["fontSize", "lineHeight", "fontWeight", "fontFamily"]
      .map((key) => (value[key] ? `${key}: ${formatPrimitive(value[key])}` : null))
      .filter(Boolean);

    return parts.join(" · ") || JSON.stringify(value).slice(0, 160);
  }

  if (type === "transition") {
    const parts = ["duration", "delay", "timingFunction"]
      .map((key) => (value[key] ? formatPrimitive(value[key]) : null))
      .filter(Boolean);

    return parts.join(" · ") || JSON.stringify(value).slice(0, 160);
  }

  if (type === "asset" && typeof value.url === "string") {
    return value.format ? `${value.url} (${formatPrimitive(value.format)})` : value.url;
  }

  if (type === "strokeStyle" && "dashArray" in value) {
    const dashArray = Array.isArray(value.dashArray)
      ? value.dashArray.map(formatPrimitive).join(" ")
      : formatPrimitive(value.dashArray);

    return value.lineCap
      ? `dashed ${dashArray}, ${formatPrimitive(value.lineCap)}`
      : `dashed ${dashArray}`;
  }

  if (type === "shadow" && ("blur" in value || "offsetX" in value)) {
    return [
      value.offsetX,
      value.offsetY,
      value.blur,
      value.spread,
      value.color,
    ]
      .filter((part) => part !== undefined && part !== null && part !== "")
      .map(formatPrimitive)
      .join(" ");
  }

  if (type === "dimension" && "default" in value) {
    return Object.entries(value)
      .map(([variant, variantValue]) => `${variant}: ${formatPrimitive(variantValue)}`)
      .join(" · ");
  }

  const keys = Object.keys(value);
  if (keys.length <= 4) {
    return keys.map((key) => `${key}: ${formatPrimitive(value[key])}`).join(" · ");
  }

  return JSON.stringify(value).slice(0, 160);
}

export function formatDtcgTokenValue(value: unknown, type?: string): string {
  if (value === null || value === undefined) {
    return "—";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return formatArrayValue(value, type);
  }

  if (typeof value === "object") {
    return formatObjectValue(value as Record<string, unknown>, type);
  }

  return String(value);
}
