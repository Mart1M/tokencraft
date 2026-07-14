import { revalidatePath } from "next/cache";

import { getAuthSession } from "@/lib/auth/session";
import {
  redirectToSignIn,
  redirectToWorkspaceSettingsPage,
  tokensPagePath,
  workspaceSettingsPath
} from "@/lib/workspaces/repository-route-utils";
import {
  syncWorkspaceRepositories,
  TokenOperationError
} from "@/lib/workspaces/token-operations";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const session = await getAuthSession();
  const { workspaceId } = await params;

  if (!session) {
    return redirectToSignIn(request);
  }

  try {
    const { workspaceSlug } = await syncWorkspaceRepositories(session.scope, workspaceId);
    revalidatePath(tokensPagePath(workspaceSlug));
    revalidatePath(workspaceSettingsPath(workspaceSlug));
    return redirectToWorkspaceSettingsPage(request, workspaceSlug);
  } catch (error) {
    const message =
      error instanceof TokenOperationError
        ? error.message
        : "Failed to refresh repositories.";

    return redirectToWorkspaceSettingsPage(request, workspaceId, message);
  }
}
