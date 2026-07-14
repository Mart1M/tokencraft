import { AuthView } from "@neondatabase/auth/react";

const validPaths = new Set([
  "sign-in",
  "sign-up",
  "forgot-password",
  "reset-password",
  "callback"
]);

export default async function AuthPage({
  params
}: {
  params: Promise<{ path?: string[] }>;
}) {
  const { path = ["sign-in"] } = await params;
  const viewPath = path.join("/");

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
      <div className="w-full max-w-md">
        <AuthView path={validPaths.has(viewPath) ? viewPath : "sign-in"} />
      </div>
    </main>
  );
}
