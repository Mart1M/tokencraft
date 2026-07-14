# TokenCraft Neo

Git-native design token management SaaS scaffold.

## Stack

- Next.js App Router in `apps/web`
- Neon Auth with user and organization scopes
- Neon Postgres metadata through Prisma
- Stripe Checkout, Customer Portal and subscription webhooks
- GitHub App installation and webhook foundation
- Shared domain types in `packages/core`

Design token values are not stored in the application database. Neon stores only SaaS metadata such as workspaces, billing state and GitHub installation references.

## Setup

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local
pnpm db:generate
pnpm dev
```

Run Prisma migrations after configuring `DATABASE_URL`:

```bash
pnpm db:migrate
```

Stripe is configured with separate test/live variables. Set `STRIPE_MODE=test`
locally and `STRIPE_MODE=live` in production, then use the matching
`STRIPE_TEST_*` or `STRIPE_LIVE_*` price IDs.

## Current Scope

This scaffold intentionally stops before repository scanning, token parsing, draft sessions, commits and pull request creation. The UI and domain types are ready for those workflows in the next phase.
