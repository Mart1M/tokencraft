import type { ImportedTokenRow } from "@/lib/tokens/entries";
import type { TokenDisplayValue } from "@/lib/tokens/display";

export type TokenGridRow = {
  id: string;
  name: string;
  typeLabel: string;
  modeValues: Record<string, TokenDisplayValue | null>;
  draftStatus: "create" | "update" | "delete" | null;
  token: ImportedTokenRow;
};
