import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/billing/stripe";
import { syncStripeSubscription } from "@/lib/billing/subscription";
import { getStripeWebhookSecret } from "@/lib/billing/plans";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = getStripeWebhookSecret();

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 400 });
  }

  let event: Stripe.Event;
  const body = await request.text();

  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid Stripe signature." }, { status: 400 });
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    await syncStripeSubscription(event.data.object);
  }

  return NextResponse.json({ received: true });
}
