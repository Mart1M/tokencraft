import type { ImportedTokenRow } from "@/lib/tokens/entries";
import type { TokenDisplayValue } from "@/lib/tokens/display";

export type TokenGridRow = {
  id: string;
  name: string;
  typeLabel: string;
  valueText: string;
  displayValue: TokenDisplayValue;
  draftStatus: "create" | "update" | "delete" | null;
  token: ImportedTokenRow;
};

export type TokenDraftStatus = TokenGridRow["draftStatus"];
