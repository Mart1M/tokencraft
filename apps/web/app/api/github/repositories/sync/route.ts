import { revalidatePath } from "next/cache";

import { getAuthSession } from "@/lib/auth/session";
import {
  accountSettingsPath,
  redirectToAccountSettingsPage,
  redirectToSignIn,
} from "@/lib/workspaces/repository-route-utils";
import {
  syncScopeRepositories,
  TokenOperationError,
} from "@/lib/workspaces/token-operations";

export async function POST(request: Request) {
  const session = await getAuthSession();

  if (!session) {
    return redirectToSignIn(request);
  }

  try {
    await syncScopeRepositories(session.scope);
    revalidatePath(accountSettingsPath());
    revalidatePath("/dashboard");
    return redirectToAccountSettingsPage(request);
  } catch (error) {
    const message =
      error instanceof TokenOperationError
        ? error.message
        : "Failed to refresh repositories.";

    return redirectToAccountSettingsPage(request, message);
  }
}
