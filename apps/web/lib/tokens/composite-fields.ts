export type CompositeFieldInput = "text" | "color";

export type CompositeFieldDefinition = {
  key: string;
  label: string;
  input?: CompositeFieldInput;
  placeholder?: string;
  /** Token types that can safely be referenced from this field. */
  aliasTypes?: string[];
};

export const TOKEN_COMPOSITE_FIELDS: Record<string, CompositeFieldDefinition[]> = {
  shadow: [
    { key: "offsetX", label: "Offset X", placeholder: "0px", aliasTypes: ["dimension"] },
    { key: "offsetY", label: "Offset Y", placeholder: "0px", aliasTypes: ["dimension"] },
    { key: "blur", label: "Blur", placeholder: "0px", aliasTypes: ["dimension"] },
    { key: "spread", label: "Spread", placeholder: "0px", aliasTypes: ["dimension"] },
    { key: "color", label: "Color", input: "color", placeholder: "#000000", aliasTypes: ["color"] },
    { key: "inset", label: "Inset", placeholder: "false" },
  ],
  border: [
    { key: "width", label: "Width", placeholder: "1px", aliasTypes: ["dimension", "number"] },
    { key: "lineWidth", label: "Line width", placeholder: "1px", aliasTypes: ["dimension", "number"] },
    { key: "style", label: "Style", placeholder: "solid", aliasTypes: ["strokeStyle"] },
    { key: "strokeStyle", label: "Stroke style", aliasTypes: ["strokeStyle"] },
    { key: "color", label: "Color", input: "color", placeholder: "#000000", aliasTypes: ["color"] },
  ],
  typography: [
    { key: "fontFamily", label: "Font family", placeholder: "Inter, sans-serif", aliasTypes: ["fontFamily"] },
    { key: "fontSize", label: "Font size", placeholder: "16px", aliasTypes: ["dimension"] },
    { key: "fontWeight", label: "Font weight", placeholder: "400", aliasTypes: ["fontWeight", "number"] },
    { key: "lineHeight", label: "Line height", placeholder: "24px", aliasTypes: ["dimension", "number"] },
    { key: "letterSpacing", label: "Letter spacing", placeholder: "0px", aliasTypes: ["dimension"] },
  ],
  transition: [
    { key: "duration", label: "Duration", placeholder: "200ms", aliasTypes: ["duration"] },
    { key: "delay", label: "Delay", placeholder: "0ms", aliasTypes: ["duration"] },
    { key: "timingFunction", label: "Timing function", placeholder: "ease", aliasTypes: ["cubicBezier"] },
  ],
  asset: [
    { key: "url", label: "URL", placeholder: "https://example.com/logo.svg" },
    { key: "format", label: "Format", placeholder: "svg" },
  ],
  strokeStyle: [
    { key: "dashArray", label: "Dash array", placeholder: "4 2" },
    { key: "lineCap", label: "Line cap", placeholder: "round" },
  ],
};

export function getCompositeFieldsForType(type?: string) {
  if (!type) {
    return null;
  }

  return TOKEN_COMPOSITE_FIELDS[type] ?? null;
}

export function getCompositeFieldKeys(type: string) {
  return TOKEN_COMPOSITE_FIELDS[type]?.map((field) => field.key) ?? [];
}

export function isCompositeTokenType(type?: string) {
  return Boolean(type && TOKEN_COMPOSITE_FIELDS[type]);
}
