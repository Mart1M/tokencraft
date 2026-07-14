import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth/session";

type GitHubConnectState = {
  returnTo?: string;
};

function encodeState(state: GitHubConnectState) {
  return Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
}

export async function GET(request: Request) {
  const session = await getAuthSession();
  const requestUrl = new URL(request.url);

  if (!session) {
    return NextResponse.redirect(new URL("/auth/sign-in", requestUrl));
  }

  const appSlug = process.env.GITHUB_APP_SLUG;
  if (!appSlug) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?github=missing_app_slug", requestUrl)
    );
  }

  const returnTo = requestUrl.searchParams.get("returnTo");
  const installUrl = new URL(`https://github.com/apps/${appSlug}/installations/new`);
  installUrl.searchParams.set(
    "state",
    encodeState({
      ...(returnTo ? { returnTo } : {}),
    })
  );

  return NextResponse.redirect(installUrl);
}
