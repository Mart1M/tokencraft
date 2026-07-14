import { revalidatePath } from "next/cache";

import { getAuthSession } from "@/lib/auth/session";
import {
  readRepositoryId,
  redirectToSignIn,
  redirectToTokensPage,
  redirectToWorkspaceSettingsPage,
  tokensPagePath,
  workspaceSettingsPath
} from "@/lib/workspaces/repository-route-utils";
import {
  selectWorkspaceRepository,
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

  const repositoryId = await readRepositoryId(request);
  if (!repositoryId) {
    return redirectToWorkspaceSettingsPage(request, workspaceId, "Invalid repository payload.");
  }

  try {
    const { workspaceSlug, autoImported } = await selectWorkspaceRepository(
      session.scope,
      workspaceId,
      repositoryId
    );
    revalidatePath(tokensPagePath(workspaceSlug));
    revalidatePath(workspaceSettingsPath(workspaceSlug));

    if (autoImported) {
      return redirectToTokensPage(request, workspaceSlug);
    }

    return redirectToWorkspaceSettingsPage(request, workspaceSlug);
  } catch (error) {
    const message =
      error instanceof TokenOperationError
        ? error.message
        : "Failed to select repository.";

    return redirectToWorkspaceSettingsPage(request, workspaceId, message);
  }
}
