import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth/neon";

const publicRoutePrefixes = [
  "/",
  "/pricing",
  "/auth",
  "/api/auth",
  "/api/stripe/webhook",
  "/api/github/webhook"
];

function isPublicRoute(pathname: string) {
  return publicRoutePrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

const protect = auth.middleware({ loginUrl: "/auth/sign-in" });

function isSelfAuthenticatingApiRoute(pathname: string) {
  return pathname === "/api/workspaces" || pathname.startsWith("/api/workspaces/");
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicRoute(pathname) || isSelfAuthenticatingApiRoute(pathname)) {
    return NextResponse.next();
  }

  return protect(request);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)"
  ]
};
