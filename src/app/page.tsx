"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Calendar, Scissors, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Wordmark } from "@/components/layout/brand";
import { Button, ButtonLink } from "@/components/ui/primitives";

function Sketch() {
  // Line drawings only — an editorial hint of a closet, not stock photography.
  const stroke = { fill: "none", stroke: "#24211f", strokeWidth: 1.4, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  return (
    <svg viewBox="0 0 400 480" className="h-full w-full" aria-hidden>
      <g {...stroke}>
        {/* blazer */}
        <path d="M120 70 L95 82 L70 200 L88 205 L100 140 L102 250 L170 250 L172 140 L184 205 L202 200 L177 82 L152 70 L136 120 Z" fill="#efe6d8" />
        <path d="M120 70 L136 120 L152 70" />
        <path d="M136 120 L136 250" />
        <circle cx="140" cy="170" r="2.2" fill="#24211f" />
        <circle cx="140" cy="198" r="2.2" fill="#24211f" />
        {/* trousers */}
        <path d="M222 190 L300 190 L312 420 L276 420 L262 250 L250 420 L214 420 Z" fill="#d8c6a8" />
        <path d="M222 205 L300 205" />
        {/* bag */}
        <path d="M300 90 C300 60 345 60 345 90" />
        <rect x="285" y="90" width="76" height="62" rx="8" fill="#97492f" stroke="#24211f" />
        {/* loafers */}
        <path d="M90 360 C90 340 130 338 150 350 L165 362 C170 372 160 380 150 380 L98 380 C92 380 90 372 90 360 Z" fill="#24211f" />
        <path d="M120 352 L140 352" stroke="#f5f0e8" />
      </g>
    </svg>
  );
}

export default function Welcome() {
  const { status, mode, startDemo } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (status === "signed-in") router.replace("/home");
  }, [status, router]);

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Wordmark />
        {mode === "cloud" && (
          <Link href="/auth/login" className="text-sm font-medium underline-offset-4 hover:underline">
            Log in
          </Link>
        )}
      </header>
      <main className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-4 sm:px-8 lg:grid-cols-2 lg:gap-16 lg:pt-12">
        <section className="animate-fade-up">
          <p className="eyebrow mb-4">Your personal stylist · free</p>
          <h1 className="font-display text-[3rem] leading-[0.98] tracking-[-0.03em] sm:text-[4.25rem]">
            Your wardrobe,
            <br />
            <em className="font-normal text-clay">edited.</em>
          </h1>
          <p className="mt-6 max-w-md text-[1.0625rem] leading-relaxed text-ink-soft">
            Photograph the clothes you already own. Vestry cuts them out, files them into a beautiful closet, and styles outfits from
            <strong className="font-semibold text-ink"> only your real pieces</strong>.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {mode === "cloud" ? (
              <>
                <ButtonLink href="/auth/signup" size="lg" icon={<ArrowRight className="size-4" />}>
                  Create your closet
                </ButtonLink>
                <ButtonLink href="/auth/login" size="lg" variant="secondary">
                  I have an account
                </ButtonLink>
              </>
            ) : (
              <Button
                size="lg"
                icon={<ArrowRight className="size-4" />}
                onClick={startDemo}
              >
                Start building my closet
              </Button>
            )}
          </div>
          {mode === "demo" && (
            <p className="mt-4 max-w-md text-[0.8125rem] leading-relaxed text-taupe">
              Demo mode: no account needed. Your closet is stored privately in this browser only and won&apos;t sync between devices.
            </p>
          )}
          <ul className="mt-12 grid gap-5 sm:grid-cols-3">
            {[
              { icon: Scissors, title: "Instant cut-outs", body: "Background removal runs on your device." },
              { icon: Sparkles, title: "Styled for you", body: "Outfits built only from what you own." },
              { icon: Calendar, title: "Plan the week", body: "Map looks to days, trips and events." },
            ].map(({ icon: Icon, title, body }) => (
              <li key={title}>
                <Icon className="size-5 text-clay" aria-hidden />
                <p className="mt-2 text-sm font-semibold">{title}</p>
                <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-soft">{body}</p>
              </li>
            ))}
          </ul>
        </section>
        <section className="garment-stage relative mx-auto aspect-[5/6] w-full max-w-md animate-fade-in overflow-hidden rounded-[2rem] p-8 shadow-[var(--shadow-soft)] ring-1 ring-line/60">
          <Sketch />
          <div className="absolute bottom-5 left-5 right-5 flex items-center justify-between rounded-2xl bg-paper/90 px-4 py-3 text-sm shadow-[var(--shadow-soft)] backdrop-blur">
            <span>
              <span className="block font-display text-base">Camel blazer, office edit</span>
              <span className="text-[0.75rem] text-ink-soft">Tonal palette · polished loafers</span>
            </span>
            <Sparkles className="size-5 text-clay" aria-hidden />
          </div>
        </section>
      </main>
    </div>
  );
}
