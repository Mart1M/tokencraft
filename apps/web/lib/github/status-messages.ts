const GITHUB_STATUS_MESSAGES: Record<string, string> = {
  connected: "GitHub connected successfully.",
  connected_sync_failed:
    "GitHub connected, but repository sync failed. Try Refresh in settings.",
  missing_installation: "GitHub did not return an installation. Please try again.",
  missing_account: "Could not read the GitHub account for this installation.",
  missing_app_slug: "GitHub App is not configured on this environment.",
  workspace_not_found:
    "The workspace from the GitHub redirect no longer exists. Connect again from settings.",
  setup_failed: "GitHub connection failed. Please try again.",
};

export function getGitHubStatusMessage(code?: string | null) {
  if (!code) {
    return null;
  }

  return GITHUB_STATUS_MESSAGES[code] ?? "GitHub connection failed. Please try again.";
}
