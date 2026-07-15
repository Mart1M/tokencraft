export type TokenTypeOption = {
  value: string;
  label: string;
};

// Common DTCG token $type values, including the composite types this app
// already knows how to render fields for (see composite-fields.ts).
export const TOKEN_TYPE_OPTIONS: TokenTypeOption[] = [
  { value: "color", label: "Color" },
  { value: "dimension", label: "Dimension" },
  { value: "fontFamily", label: "Font family" },
  { value: "fontWeight", label: "Font weight" },
  { value: "duration", label: "Duration" },
  { value: "cubicBezier", label: "Cubic bezier" },
  { value: "number", label: "Number" },
  { value: "string", label: "String" },
  { value: "boolean", label: "Boolean" },
  { value: "gradient", label: "Gradient" },
  { value: "typography", label: "Typography" },
  { value: "border", label: "Border" },
  { value: "shadow", label: "Shadow" },
  { value: "transition", label: "Transition" },
  { value: "strokeStyle", label: "Stroke style" },
  { value: "asset", label: "Asset" },
];
