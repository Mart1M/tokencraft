import Stripe from "stripe";
import { getStripeSecretKey } from "@/lib/billing/plans";

let stripeClient: Stripe | null = null;

export function getStripe() {
  if (!stripeClient) {
    const secretKey = getStripeSecretKey();
    if (!secretKey) {
      throw new Error("Stripe secret key is required.");
    }

    stripeClient = new Stripe(secretKey, {
      apiVersion: "2025-02-24.acacia"
    });
  }

  return stripeClient;
}
