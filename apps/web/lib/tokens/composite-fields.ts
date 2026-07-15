export type CompositeFieldInput = "text" | "color";

export type CompositeFieldDefinition = {
  key: string;
  label: string;
  input?: CompositeFieldInput;
  placeholder?: string;
};

export const TOKEN_COMPOSITE_FIELDS: Record<string, CompositeFieldDefinition[]> = {
  shadow: [
    { key: "offsetX", label: "Offset X", placeholder: "0px" },
    { key: "offsetY", label: "Offset Y", placeholder: "0px" },
    { key: "blur", label: "Blur", placeholder: "0px" },
    { key: "spread", label: "Spread", placeholder: "0px" },
    { key: "color", label: "Color", input: "color", placeholder: "#000000" },
    { key: "inset", label: "Inset", placeholder: "false" },
  ],
  border: [
    { key: "width", label: "Width", placeholder: "1px" },
    { key: "lineWidth", label: "Line width", placeholder: "1px" },
    { key: "style", label: "Style", placeholder: "solid" },
    { key: "strokeStyle", label: "Stroke style" },
    { key: "color", label: "Color", input: "color", placeholder: "#000000" },
  ],
  typography: [
    { key: "fontFamily", label: "Font family", placeholder: "Inter, sans-serif" },
    { key: "fontSize", label: "Font size", placeholder: "16px" },
    { key: "fontWeight", label: "Font weight", placeholder: "400" },
    { key: "lineHeight", label: "Line height", placeholder: "24px" },
    { key: "letterSpacing", label: "Letter spacing", placeholder: "0px" },
  ],
  transition: [
    { key: "duration", label: "Duration", placeholder: "200ms" },
    { key: "delay", label: "Delay", placeholder: "0ms" },
    { key: "timingFunction", label: "Timing function", placeholder: "ease" },
  ],
  asset: [
    { key: "url", label: "URL", placeholder: "https://example.com/logo.svg" },
    { key: "format", label: "Format", placeholder: "svg" },
  ],
  strokeStyle: [
    { key: "dashArray", label: "Dash array", placeholder: "4 2" },
    { key: "lineCap", label: "Line cap", placeholder: "round" },
  ],
  // Tokens Studio "composition" tokens reference other tokens by category.
  composition: [
    { key: "typography", label: "Typography", placeholder: "{path.to.typography}" },
    { key: "border", label: "Border", placeholder: "{path.to.border}" },
    { key: "boxShadow", label: "Box shadow", placeholder: "{path.to.shadow}" },
    { key: "fill", label: "Fill", placeholder: "{path.to.color}" },
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
