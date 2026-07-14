import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TokenCraft Neo",
  description: "Git-native design token management"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
