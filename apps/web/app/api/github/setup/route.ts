import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth/session";
import { getGitHubAppInstallation } from "@/lib/github/app";
import { normalizeInstallationId } from "@/lib/github/installation-id";
import { syncInstallationRepositories } from "@/lib/github/repositories";
import { linkGitHubInstallationToScope } from "@/lib/workspaces/github-connection";

type GitHubConnectState = {
  returnTo?: string;
};

function decodeState(rawState: string | null): GitHubConnectState {
  if (!rawState) {
    return {};
  }

  try {
    return JSON.parse(Buffer.from(rawState, "base64url").toString("utf8")) as GitHubConnectState;
  } catch {
    return {};
  }
}

function settingsRedirect(requestUrl: URL, github: string, returnTo?: string) {
  const path = returnTo?.startsWith("/") ? returnTo : "/dashboard/settings";

  return NextResponse.redirect(new URL(`${path}?github=${github}`, requestUrl));
}

export async function GET(request: Request) {
  const session = await getAuthSession();
  const requestUrl = new URL(request.url);

  if (!session) {
    return NextResponse.redirect(new URL("/auth/sign-in", requestUrl));
  }

  const installationId = requestUrl.searchParams.get("installation_id");
  const state = decodeState(requestUrl.searchParams.get("state"));

  if (!installationId) {
    return settingsRedirect(requestUrl, "missing_installation", state.returnTo);
  }

  try {
    const installation = await getGitHubAppInstallation(installationId);
    const accountLogin = installation.account?.login;
    const numericInstallationId = normalizeInstallationId(installationId);

    if (!accountLogin) {
      return settingsRedirect(requestUrl, "missing_account", state.returnTo);
    }

    const githubInstallation = await linkGitHubInstallationToScope(session.scope, {
      installationId: numericInstallationId,
      accountLogin,
      accountType: installation.account?.type === "Organization" ? "ORGANIZATION" : "USER",
    });

    try {
      await syncInstallationRepositories(githubInstallation);
    } catch {
      return settingsRedirect(requestUrl, "connected_sync_failed", state.returnTo);
    }

    return settingsRedirect(requestUrl, "connected", state.returnTo);
  } catch (error) {
    console.error("GitHub setup failed:", error);
    return settingsRedirect(requestUrl, "setup_failed", state.returnTo);
  }
}
