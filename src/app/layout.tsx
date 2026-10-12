import type { Metadata } from "next";
import { Caveat, Fraunces, Geist } from "next/font/google";
import Script from "next/script";
import { THEME_CSS, THEME_SCRIPT } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "David's own private Sudoku",
  description:
    "A paper-and-ink Sudoku. Fill the grid, keep notes, undo a step, and take a hint. New puzzles come from Mt. Sudoku at the difficulty you choose.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${fraunces.variable} ${caveat.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex h-dvh flex-col overflow-hidden">
        <style href="sudoku-themes" precedence="default">
          {THEME_CSS}
        </style>
        <Script id="sudoku-theme" strategy="beforeInteractive">
          {THEME_SCRIPT}
        </Script>
        {children}
      </body>
    </html>
  );
}
