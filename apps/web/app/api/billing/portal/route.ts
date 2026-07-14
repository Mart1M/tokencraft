import { NextResponse } from "next/server";
import { toDbScope } from "@/lib/auth/scope";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getStripe } from "@/lib/billing/stripe";

export async function POST() {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    return NextResponse.json({ error: "NEXT_PUBLIC_APP_URL is not configured." }, { status: 500 });
  }

  const scope = session.scope;
  const subscription = await prisma.subscription.findUnique({
    where: {
      scope_ownerId: {
        scope: toDbScope(scope.scope),
        ownerId: scope.ownerId
      }
    }
  });

  if (!subscription?.stripeCustomerId) {
    return NextResponse.json({ error: "No Stripe customer exists for this scope." }, { status: 404 });
  }

  const portal = await getStripe().billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${appUrl}/dashboard`
  });

  return NextResponse.json({ url: portal.url });
}
