import { createNeonAuth } from "@neondatabase/auth/next/server";

export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL!,
  cookies: {
    secret: process.env.NEON_AUTH_COOKIE_SECRET!,
    sessionDataTtl: 300,
    // GitHub redirects back to /api/github/setup via a top-level cross-site
    // navigation after app installation. `strict` (the SDK default) drops
    // the session cookie on that request, which logs the user out mid-flow.
    // `lax` still sends cookies for top-level GET navigations like this one.
    sameSite: "lax"
  }
});
