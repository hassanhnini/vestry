"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useWardrobe } from "@/lib/store";
import { useAiStatus } from "@/lib/ai/status";
import type { StyleProfile } from "@/lib/types";
import { Monogram, Wordmark } from "@/components/layout/brand";
import { ClimateField, ColorsField, FitComfortField, OccasionsField, StylesField } from "@/components/profile/profile-fields";
import { Button, Field, Input, cx } from "@/components/ui/primitives";
import { useOverlay } from "@/components/ui/overlay";

export default function Onboarding() {
  const { status } = useAuth();
  const { ready } = useWardrobe();
  const router = useRouter();
  useEffect(() => {
    if (status === "signed-out") router.replace("/");
  }, [status, router]);
  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center" role="status" aria-label="Loading">
        <Monogram className="size-11 animate-pulse text-ink" />
      </div>
    );
  }
  return <OnboardingFlow />;
}

function OnboardingFlow() {
  const { profile, saveProfile, items } = useWardrobe();
  const { status: ai } = useAiStatus();
  const { toast } = useOverlay();
  const router = useRouter();
  const [p, setP] = useState<StyleProfile>(profile);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const steps = [
    { title: "What should we call you?", body: "Just for your greeting.", node: (
      <Field label="First name or nickname" htmlFor="name">
        <Input id="name" autoComplete="given-name" maxLength={40} value={p.displayName} onChange={(e) => setP({ ...p, displayName: e.target.value })} placeholder="e.g. Alex" />
      </Field>
    ) },
    { title: "Which styles feel like you?", body: "Pick as many as you like — the stylist leans on these when you don't choose one.", node: <StylesField value={p} onChange={(x) => setP({ ...p, ...x })} /> },
    { title: "Colours you love", body: "We'll favour these.", node: <ColorsField kind="favoriteColors" value={p} onChange={(x) => setP({ ...p, ...x })} /> },
    { title: "Colours you'd rather not wear", body: "We'll keep these out of suggestions.", node: <ColorsField kind="avoidColors" value={p} onChange={(x) => setP({ ...p, ...x })} /> },
    { title: "Where do you usually dress for?", body: "Your most common occasions.", node: <OccasionsField value={p} onChange={(x) => setP({ ...p, ...x })} /> },
    { title: "Your climate", body: "Helps with layering and seasons. City is optional and stays in your profile.", node: (
      <div className="space-y-5">
        <ClimateField value={p} onChange={(x) => setP({ ...p, ...x })} />
        <Field label="City (optional)" htmlFor="city">
          <Input id="city" maxLength={60} value={p.city ?? ""} onChange={(e) => setP({ ...p, city: e.target.value || undefined })} placeholder="e.g. Manchester" />
        </Field>
      </div>
    ) },
    { title: "Fit & comfort", body: "No measurements or body photos — ever.", node: <FitComfortField value={p} onChange={(x) => setP({ ...p, ...x })} /> },
    ...(ai?.provider
      ? [{ title: "Smarter tagging with cloud AI?", body: "Optional. Background removal always stays on your device.", node: (
          <div className="space-y-3">
            {[true, false].map((v) => (
              <button
                key={String(v)}
                type="button"
                aria-pressed={p.cloudAi === v}
                onClick={() => setP({ ...p, cloudAi: v })}
                className={cx("w-full rounded-2xl border p-4 text-left transition", p.cloudAi === v ? "border-ink bg-ink text-paper" : "border-line bg-paper")}
              >
                <span className="block font-medium">{v ? `Yes, use ${ai.provider === "claude" ? "Claude" : "Gemini"} to tag my clothes` : "No, keep tagging on my device"}</span>
                <span className={cx("mt-0.5 block text-[0.8125rem]", p.cloudAi === v ? "text-paper/75" : "text-ink-soft")}>
                  {v ? "A small preview of each cut-out garment is sent for category, colour and material detection." : "Colours are measured on-device; you confirm the category yourself."}
                </span>
              </button>
            ))}
          </div>
        ) }]
      : []),
  ];

  const finish = async (skipped: boolean) => {
    setSaving(true);
    try {
      await saveProfile({ ...p, displayName: p.displayName.trim(), onboarded: true });
      if (skipped) toast("You can set your style profile any time from Profile.", "info");
      router.replace(items.length ? "/home" : "/add");
    } catch (e) {
      toast(`Couldn't save: ${(e as Error).message}`, "error");
      setSaving(false);
    }
  };

  const s = steps[step];
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-5 pb-8 pt-5">
      <header className="flex items-center justify-between">
        <Wordmark />
        <Button variant="ghost" size="sm" onClick={() => finish(true)} disabled={saving}>
          Skip
        </Button>
      </header>
      <div className="mt-8 flex gap-1.5" aria-label={`Step ${step + 1} of ${steps.length}`} role="progressbar" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={step + 1}>
        {steps.map((_, i) => (
          <span key={i} className={cx("h-1 flex-1 rounded-full transition", i <= step ? "bg-ink" : "bg-line")} />
        ))}
      </div>
      <main key={step} className="mt-8 flex-1 animate-fade-up">
        <p className="eyebrow">Your style profile · optional</p>
        <h1 className="mt-2 font-display text-[2rem] leading-tight">{s.title}</h1>
        <p className="mt-2 text-ink-soft">{s.body}</p>
        <div className="mt-7">{s.node}</div>
      </main>
      <p className="mt-8 flex items-center gap-2 text-[0.75rem] text-taupe">
        <ShieldCheck className="size-4" aria-hidden /> We never infer personal characteristics from your photos.
      </p>
      <footer className="pb-safe mt-4 flex gap-2">
        {step > 0 && (
          <Button variant="secondary" size="lg" onClick={() => setStep(step - 1)} aria-label="Back" icon={<ArrowLeft className="size-4" />}>
            <span className="sr-only">Back</span>
          </Button>
        )}
        <Button size="lg" className="flex-1" loading={saving} onClick={() => (step < steps.length - 1 ? setStep(step + 1) : finish(false))}>
          {step < steps.length - 1 ? "Continue" : "Finish"}
        </Button>
      </footer>
    </div>
  );
}
