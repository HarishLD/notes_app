import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth/session";
import { SignOutButton } from "@/components/auth/sign-out-button";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Notes",
  description: "A private, tag-organized notes app.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body
        className="min-h-full flex flex-col bg-white
          bg-[radial-gradient(ellipse_60%_40%_at_50%_-10%,rgba(99,102,241,0.10),transparent_70%)]
          dark:bg-zinc-950
          dark:bg-[radial-gradient(ellipse_60%_40%_at_50%_-10%,rgba(99,102,241,0.18),transparent_70%)]"
      >
        {/* Solid surface, not the gradient canvas below it — header text
            must never sit directly on the gradient. */}
        <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
          <nav aria-label="Main">
            <Link href="/" className="font-semibold text-zinc-900 dark:text-zinc-50">
              Notes
            </Link>
          </nav>
          {user ? <SignOutButton /> : null}
        </header>
        {children}
      </body>
    </html>
  );
}
