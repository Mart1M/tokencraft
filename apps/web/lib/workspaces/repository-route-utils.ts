import { NextResponse } from "next/server";

export function accountSettingsPath() {
  return "/dashboard/settings";
}

export function tokensPagePath(workspaceSlug: string) {
  return `/dashboard/workspaces/${workspaceSlug}/tokens`;
}

export function workspaceSettingsPath(workspaceSlug: string) {
  return `/dashboard/workspaces/${workspaceSlug}/settings`;
}

export function redirectToTokensPage(
  request: Request,
  workspaceSlug: string,
  error?: string
) {
  const url = new URL(tokensPagePath(workspaceSlug), request.url);
  if (error) {
    url.searchParams.set("error", error);
  }

  return NextResponse.redirect(url, 303);
}

export function redirectToWorkspaceSettingsPage(
  request: Request,
  workspaceSlug: string,
  error?: string
) {
  const url = new URL(workspaceSettingsPath(workspaceSlug), request.url);
  if (error) {
    url.searchParams.set("error", error);
  }

  return NextResponse.redirect(url, 303);
}

export function redirectToAccountSettingsPage(
  request: Request,
  error?: string
) {
  const url = new URL(accountSettingsPath(), request.url);
  if (error) {
    url.searchParams.set("error", error);
  }

  return NextResponse.redirect(url, 303);
}

export function redirectToSignIn(request: Request) {
  return NextResponse.redirect(new URL("/auth/sign-in", request.url), 303);
}

export async function readRepositoryId(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as {
      repositoryId?: string;
    } | null;
    return typeof body?.repositoryId === "string" ? body.repositoryId : null;
  }

  const formData = await request.formData();
  const repositoryId = formData.get("repositoryId");
  return typeof repositoryId === "string" && repositoryId.length > 0
    ? repositoryId
    : null;
}
