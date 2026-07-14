import { describe, expect, it } from "vitest";

import { inspectTokenJson } from "@/lib/github/token-scan";

describe("inspectTokenJson", () => {
  it("detects DTCG token files and counts nested tokens", () => {
    const result = inspectTokenJson(
      "tokens/core.tokens.json",
      JSON.stringify({
        color: {
          brand: {
            primary: {
              $type: "color",
              $value: "#531fff"
            }
          }
        },
        spacing: {
          md: {
            $type: "dimension",
            $value: "16px"
          }
        }
      })
    );

    expect(result.collectionName).toBe("core");
    expect(result.format).toBe("DTCG");
    expect(result.tokenCount).toBe(2);
    expect(result.metadata.tokens).toEqual([
      {
        path: "color.brand.primary",
        type: "color",
        value: "#531fff",
        raw: "#531fff",
        display: { kind: "color", text: "#531fff", color: "#531fff" },
      },
      {
        path: "spacing.md",
        type: "dimension",
        value: "16px",
        raw: "16px",
        display: { kind: "text", text: "16px" },
      },
    ]);
  });
});
