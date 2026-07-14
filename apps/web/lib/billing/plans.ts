import type { BillingPlan } from "@tokencraft/core";

export const BILLING_PLANS: Record<
  Exclude<BillingPlan, "enterprise">,
  {
    name: string;
    stripePriceEnv?: "STRIPE_PRO_PRICE_ID" | "STRIPE_TEAM_PRICE_ID";
    stripeTestPriceEnv?: "STRIPE_TEST_PRO_PRICE_ID" | "STRIPE_TEST_TEAM_PRICE_ID";
    stripeLivePriceEnv?: "STRIPE_LIVE_PRO_PRICE_ID" | "STRIPE_LIVE_TEAM_PRICE_ID";
  }
> = {
  free: { name: "Free" },
  pro: {
    name: "Pro",
    stripePriceEnv: "STRIPE_PRO_PRICE_ID",
    stripeTestPriceEnv: "STRIPE_TEST_PRO_PRICE_ID",
    stripeLivePriceEnv: "STRIPE_LIVE_PRO_PRICE_ID"
  },
  team: {
    name: "Team",
    stripePriceEnv: "STRIPE_TEAM_PRICE_ID",
    stripeTestPriceEnv: "STRIPE_TEST_TEAM_PRICE_ID",
    stripeLivePriceEnv: "STRIPE_LIVE_TEAM_PRICE_ID"
  }
};

export function getStripeMode() {
  return process.env.STRIPE_MODE === "live" ? "live" : "test";
}

export function getStripeSecretKey() {
  const mode = getStripeMode();
  const modeKey =
    mode === "live" ? process.env.STRIPE_LIVE_SECRET_KEY : process.env.STRIPE_TEST_SECRET_KEY;

  return modeKey ?? process.env.STRIPE_SECRET_KEY;
}

export function getStripeWebhookSecret() {
  const mode = getStripeMode();
  const modeSecret =
    mode === "live"
      ? process.env.STRIPE_LIVE_WEBHOOK_SECRET
      : process.env.STRIPE_TEST_WEBHOOK_SECRET;

  return modeSecret ?? process.env.STRIPE_WEBHOOK_SECRET;
}

export function getStripePriceId(plan: Exclude<BillingPlan, "free" | "enterprise">) {
  const config = BILLING_PLANS[plan];
  const mode = getStripeMode();
  const modeEnv = mode === "live" ? config.stripeLivePriceEnv : config.stripeTestPriceEnv;
  const modePrice = modeEnv ? process.env[modeEnv] : undefined;
  const fallbackPrice = config.stripePriceEnv ? process.env[config.stripePriceEnv] : undefined;

  return modePrice ?? fallbackPrice;
}

export function getPlanFromPriceId(priceId: string | null | undefined): BillingPlan {
  if (!priceId) return "free";
  if (
    priceId === process.env.STRIPE_PRO_PRICE_ID ||
    priceId === process.env.STRIPE_TEST_PRO_PRICE_ID ||
    priceId === process.env.STRIPE_LIVE_PRO_PRICE_ID
  ) {
    return "pro";
  }
  if (
    priceId === process.env.STRIPE_TEAM_PRICE_ID ||
    priceId === process.env.STRIPE_TEST_TEAM_PRICE_ID ||
    priceId === process.env.STRIPE_LIVE_TEAM_PRICE_ID
  ) {
    return "team";
  }
  return "free";
}

export function toDbPlan(plan: BillingPlan) {
  return plan.toUpperCase() as "FREE" | "PRO" | "TEAM" | "ENTERPRISE";
}
