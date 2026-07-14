import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Instrument_Serif } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { NeonAuthProvider } from "@/components/neon-auth-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-instrument-serif"
});

export const metadata: Metadata = {
  title: "TokenCraft Neo",
  description: "Git-native design token management for design system teams"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable} ${instrumentSerif.variable}`}>
        <TooltipProvider>
          <NeonAuthProvider>{children}</NeonAuthProvider>
        </TooltipProvider>
        <Toaster richColors closeButton />
      </body>
    </html>
  );
}
