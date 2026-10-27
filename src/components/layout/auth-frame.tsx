"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { Wordmark } from "./brand";
import { Button } from "../ui/primitives";
import { useRouter } from "next/navigation";

export function AuthFrame({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  const { mode, startDemo } = useAuth();
  const router = useRouter();
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-5 py-6">
      <Link href="/" aria-label="Vestry home">
        <Wordmark />
      </Link>
      <main className="mt-12 flex-1 animate-fade-up">
        <h1 className="font-display text-[2.25rem] leading-tight">{title}</h1>
        {subtitle && <p className="mt-2 text-ink-soft">{subtitle}</p>}
        <div className="mt-8">
          {mode === "demo" ? (
            <div className="rounded-2xl bg-paper p-5 text-[0.9375rem] leading-relaxed ring-1 ring-line">
              <p>Cloud accounts aren&apos;t enabled on this deployment yet (Supabase isn&apos;t configured).</p>
              <p className="mt-2 text-ink-soft">You can use Vestry right away in demo mode — your closet is saved in this browser.</p>
              <Button className="mt-4 w-full" onClick={() => { startDemo(); router.replace("/home"); }}>Continue in demo mode</Button>
            </div>
          ) : (
            children
          )}
        </div>
      </main>
      {mode === "cloud" && footer && <footer className="py-6 text-center text-sm text-ink-soft">{footer}</footer>}
    </div>
  );
}
