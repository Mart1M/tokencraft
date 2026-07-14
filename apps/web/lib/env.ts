import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  NEON_AUTH_BASE_URL: z.string().url(),
  NEON_AUTH_COOKIE_SECRET: z.string().min(32),
  STRIPE_MODE: z.enum(["test", "live"]).default("test"),
  STRIPE_TEST_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_TEST_WEBHOOK_SECRET: z.string().min(1).optional(),
  STRIPE_TEST_PRO_PRICE_ID: z.string().min(1).optional(),
  STRIPE_TEST_TEAM_PRICE_ID: z.string().min(1).optional(),
  STRIPE_LIVE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_LIVE_WEBHOOK_SECRET: z.string().min(1).optional(),
  STRIPE_LIVE_PRO_PRICE_ID: z.string().min(1).optional(),
  STRIPE_LIVE_TEAM_PRICE_ID: z.string().min(1).optional(),
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  STRIPE_PRO_PRICE_ID: z.string().min(1).optional(),
  STRIPE_TEAM_PRICE_ID: z.string().min(1).optional(),
  GITHUB_APP_ID: z.string().min(1),
  GITHUB_APP_SLUG: z.string().min(1).optional(),
  GITHUB_APP_PRIVATE_KEY: z.string().min(1),
  GITHUB_WEBHOOK_SECRET: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url()
});

export function getServerEnv() {
  return serverEnvSchema.parse(process.env);
}
