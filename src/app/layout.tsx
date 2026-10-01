import type { Metadata } from "next";
import { Fraunces, Geist } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sudoku",
  description:
    "A paper-and-ink Sudoku. Fill the grid, keep notes, undo a step, and take a hint. Every puzzle has one solution.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${fraunces.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <Script id="sudoku-theme" strategy="beforeInteractive">
          {`try{var t=localStorage.getItem("sudoku.theme");if(t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`}
        </Script>
        {children}
      </body>
    </html>
  );
}
