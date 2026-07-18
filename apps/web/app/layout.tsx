import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Instrument_Serif } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";

const themeInitializationScript = `(() => {
  try {
    const savedTheme = localStorage.getItem("tokencraft-theme");
    const isDark = savedTheme === "dark";
    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";
  } catch {}
})();`;

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-instrument-serif"
});

export const metadata: Metadata = {
  title: "TokenCraft",
  description: "A local-first design token editor for your project's *.tokens.json files"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitializationScript }} />
      </head>
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable} ${instrumentSerif.variable}`}>
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster richColors closeButton />
      </body>
    </html>
  );
}
