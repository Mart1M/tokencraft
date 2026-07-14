import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/auth/session";
import { getStripePriceId } from "@/lib/billing/plans";
import { getStripe } from "@/lib/billing/stripe";
import { upsertCheckoutCustomer } from "@/lib/billing/subscription";

const checkoutSchema = z.object({
  plan: z.enum(["pro", "team"])
});

export async function POST(request: Request) {
  const authSession = await getAuthSession();
  if (!authSession) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const parsed = checkoutSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid checkout payload." }, { status: 400 });
  }

  const priceId = getStripePriceId(parsed.data.plan);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!priceId || !appUrl) {
    return NextResponse.json({ error: "Billing is not configured." }, { status: 500 });
  }

  const stripe = getStripe();
  const scope = authSession.scope;
  const customer = await stripe.customers.create({
    email: authSession.user.email,
    name: authSession.user.name ?? undefined,
    metadata: {
      scope: scope.scope,
      ownerId: scope.ownerId,
      neonUserId: authSession.user.id,
      neonOrganizationId: scope.scope === "organization" ? scope.ownerId : ""
    }
  });

  await upsertCheckoutCustomer({ ...scope, customerId: customer.id });

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customer.id,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/dashboard?checkout=success`,
    cancel_url: `${appUrl}/dashboard/settings?checkout=cancelled`,
    subscription_data: {
      metadata: {
        scope: scope.scope,
        ownerId: scope.ownerId,
        neonUserId: authSession.user.id,
        neonOrganizationId: scope.scope === "organization" ? scope.ownerId : ""
      }
    }
  });

  return NextResponse.json({ url: session.url });
}
