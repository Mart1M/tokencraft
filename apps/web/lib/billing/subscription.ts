import type Stripe from "stripe";
import { prisma } from "@/lib/db/prisma";
import { getPlanFromPriceId, toDbPlan } from "@/lib/billing/plans";
import { toDbScope, type ActorScope } from "@/lib/auth/scope";

function toDbStatus(status: Stripe.Subscription.Status) {
  switch (status) {
    case "active":
      return "ACTIVE";
    case "trialing":
      return "TRIALING";
    case "past_due":
      return "PAST_DUE";
    case "canceled":
      return "CANCELED";
    case "unpaid":
      return "UNPAID";
    default:
      return "INCOMPLETE";
  }
}

export async function upsertCheckoutCustomer(params: ActorScope & { customerId: string }) {
  return prisma.subscription.upsert({
    where: {
      scope_ownerId: {
        scope: toDbScope(params.scope),
        ownerId: params.ownerId
      }
    },
    create: {
      scope: toDbScope(params.scope),
      ownerId: params.ownerId,
      stripeCustomerId: params.customerId
    },
    update: {
      stripeCustomerId: params.customerId
    }
  });
}

export async function syncStripeSubscription(subscription: Stripe.Subscription) {
  const scope = subscription.metadata.scope === "organization" ? "organization" : "user";
  const ownerId = subscription.metadata.ownerId;

  if (!ownerId) {
    throw new Error("Stripe subscription is missing ownerId metadata.");
  }

  const priceId = subscription.items.data[0]?.price.id;
  const plan = getPlanFromPriceId(priceId);

  return prisma.subscription.upsert({
    where: {
      scope_ownerId: {
        scope: toDbScope(scope),
        ownerId
      }
    },
    create: {
      scope: toDbScope(scope),
      ownerId,
      plan: toDbPlan(plan),
      status: toDbStatus(subscription.status),
      stripeCustomerId:
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer.id,
      stripeSubscriptionId: subscription.id,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000)
    },
    update: {
      plan: toDbPlan(plan),
      status: toDbStatus(subscription.status),
      stripeCustomerId:
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer.id,
      stripeSubscriptionId: subscription.id,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000)
    }
  });
}
