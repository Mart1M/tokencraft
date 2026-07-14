"use client";

import { AuthUIProvider } from "@neondatabase/auth/react";
import { authClient } from "@/lib/auth/neon-client";

export function NeonAuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <div className="neon-auth-ui">
      <AuthUIProvider
        authClient={authClient}
        redirectTo="/dashboard"
        magicLink={false}
        multiSession={false}
        apiKey={false}
        passkey={false}
        oneTap={false}
      >
        {children}
      </AuthUIProvider>
    </div>
  );
}
