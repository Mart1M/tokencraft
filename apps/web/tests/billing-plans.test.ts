import { describe, expect, it, vi } from "vitest";
import { getPlanFromPriceId } from "@/lib/billing/plans";

describe("getPlanFromPriceId", () => {
  it("maps configured Stripe prices to plans", () => {
    vi.stubEnv("STRIPE_PRO_PRICE_ID", "price_pro");
    vi.stubEnv("STRIPE_TEAM_PRICE_ID", "price_team");

    expect(getPlanFromPriceId("price_pro")).toBe("pro");
    expect(getPlanFromPriceId("price_team")).toBe("team");
    expect(getPlanFromPriceId("price_unknown")).toBe("free");
  });
});
