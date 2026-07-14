import { auth } from "@/lib/auth/neon";
import { resolveActorScope, type ActorScope } from "@/lib/auth/scope";

export interface AuthenticatedUser {
  id: string;
  email?: string;
  name?: string | null;
}

export interface AuthSession {
  user: AuthenticatedUser;
  scope: ActorScope;
}

interface NeonSessionPayload {
  user?: {
    id?: string;
    email?: string;
    name?: string | null;
  };
  session?: {
    activeOrganizationId?: string | null;
  };
}

export async function getAuthSession(): Promise<AuthSession | null> {
  const { data } = await auth.getSession();
  let session = data as NeonSessionPayload | null;
  let userId = session?.user?.id;

  if (!userId) {
    const { data: freshData } = await auth.getSession({
      query: { disableCookieCache: "true" }
    });
    session = freshData as NeonSessionPayload | null;
    userId = session?.user?.id;
  }

  if (!userId || !session) return null;

  const orgId = session.session?.activeOrganizationId ?? null;

  return {
    user: {
      id: userId,
      email: session.user?.email,
      name: session.user?.name
    },
    scope: resolveActorScope({ userId, orgId })
  };
}
