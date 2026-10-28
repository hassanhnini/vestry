"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { BarChart3, Bookmark, ChevronRight, LogOut, Settings } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useWardrobe } from "@/lib/store";
import { STYLE_BY_ID, colorLabel } from "@/lib/taxonomy";
import type { StyleProfile } from "@/lib/types";
import { ClimateField, ColorsField, FitComfortField, OccasionsField, StylesField } from "@/components/profile/profile-fields";
import { Button, Card, Field, Input, PageHeader, Textarea } from "@/components/ui/primitives";
import { Sheet, useOverlay } from "@/components/ui/overlay";

type Section = "name" | "styles" | "love" | "avoid" | "occasions" | "climate" | "fit" | "notes";

export default function ProfilePage() {
  const { user, mode, signOut } = useAuth();
  const { profile, saveProfile, items, outfits } = useWardrobe();
  const { toast, confirm } = useOverlay();
  const [editing, setEditing] = useState<Section | null>(null);
  const [draft, setDraft] = useState<StyleProfile>(profile);

  const rows: { id: Section; label: string; value: string }[] = [
    { id: "name", label: "Name", value: profile.displayName || "Not set" },
    { id: "styles", label: "Styles", value: profile.styles.map((s) => STYLE_BY_ID[s]?.label).join(", ") || "Not set" },
    { id: "love", label: "Colours I love", value: profile.favoriteColors.map(colorLabel).join(", ") || "Not set" },
    { id: "avoid", label: "Colours I avoid", value: profile.avoidColors.map(colorLabel).join(", ") || "None" },
    { id: "occasions", label: "Usual occasions", value: profile.occasions.join(", ") || "Not set" },
    { id: "climate", label: "Climate & city", value: [profile.climate, profile.city].filter(Boolean).join(" · ") || "Not set" },
    { id: "fit", label: "Fit & comfort", value: `${profile.fit === "tailored" ? "Tailored" : profile.fit === "relaxed" ? "Relaxed" : "Mixed"} · comfort ${profile.comfort}/5` },
    { id: "notes", label: "Styling notes", value: profile.notes || "None" },
  ];
  const editors: Record<Section, ReactNode> = {
    name: (
      <Field label="Name" htmlFor="pname">
        <Input id="pname" maxLength={40} value={draft.displayName} onChange={(e) => setDraft({ ...draft, displayName: e.target.value })} />
      </Field>
    ),
    styles: <StylesField value={draft} onChange={(x) => setDraft({ ...draft, ...x })} />,
    love: <ColorsField kind="favoriteColors" value={draft} onChange={(x) => setDraft({ ...draft, ...x })} />,
    avoid: <ColorsField kind="avoidColors" value={draft} onChange={(x) => setDraft({ ...draft, ...x })} />,
    occasions: <OccasionsField value={draft} onChange={(x) => setDraft({ ...draft, ...x })} />,
    climate: (
      <div className="space-y-5">
        <ClimateField value={draft} onChange={(x) => setDraft({ ...draft, ...x })} />
        <Field label="City (optional)" htmlFor="pcity">
          <Input id="pcity" maxLength={60} value={draft.city ?? ""} onChange={(e) => setDraft({ ...draft, city: e.target.value || undefined })} />
        </Field>
      </div>
    ),
    fit: <FitComfortField value={draft} onChange={(x) => setDraft({ ...draft, ...x })} />,
    notes: (
      <Field label="Anything the stylist should know?" htmlFor="pnotes" hint="e.g. 'I prefer midi lengths', 'no high heels for work'. Shared with the AI stylist only if you use it.">
        <Textarea id="pnotes" maxLength={300} value={draft.notes ?? ""} onChange={(e) => setDraft({ ...draft, notes: e.target.value || undefined })} />
      </Field>
    ),
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Profile" title={profile.displayName || "Your profile"} subtitle={mode === "cloud" ? user?.email : "Demo mode · stored on this device"} />
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Pieces", value: items.filter((i) => !i.archived).length, href: "/closet" },
          { label: "Outfits", value: outfits.length, href: "/outfits" },
          { label: "Favourites", value: items.filter((i) => i.favorite).length + outfits.filter((o) => o.favorite).length, href: "/outfits" },
        ].map((s) => (
          <Link key={s.label} href={s.href} className="rounded-[1.25rem] bg-paper p-4 ring-1 ring-line/70 transition hover:shadow-[var(--shadow-soft)]">
            <span className="block font-display text-3xl">{s.value}</span>
            <span className="text-[0.8125rem] text-ink-soft">{s.label}</span>
          </Link>
        ))}
      </div>

      <h2 className="mb-3 mt-10 font-display text-2xl">Style profile</h2>
      <Card className="divide-y divide-line/70">
        {rows.map((r) => (
          <button key={r.id} onClick={() => { setDraft(profile); setEditing(r.id); }} className="flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-ivory/60">
            <span className="w-36 shrink-0 text-sm text-ink-soft">{r.label}</span>
            <span className="min-w-0 flex-1 truncate text-[0.9375rem]">{r.value}</span>
            <ChevronRight className="size-4 shrink-0 text-taupe" aria-hidden />
          </button>
        ))}
      </Card>

      <Card className="mt-8 divide-y divide-line/70">
        {[
          { href: "/insights", label: "Wardrobe insights", icon: BarChart3 },
          { href: "/outfits", label: "Saved outfits", icon: Bookmark },
          { href: "/settings", label: "Settings & privacy", icon: Settings },
        ].map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="flex items-center gap-4 px-5 py-4 transition hover:bg-ivory/60">
            <Icon className="size-5 text-clay" aria-hidden />
            <span className="flex-1 text-[0.9375rem]">{label}</span>
            <ChevronRight className="size-4 text-taupe" aria-hidden />
          </Link>
        ))}
      </Card>

      <Button
        variant="ghost"
        className="mt-6"
        icon={<LogOut className="size-4" />}
        onClick={async () => {
          const ok = await confirm({
            title: mode === "demo" ? "Leave demo mode?" : "Log out?",
            body: mode === "demo" ? "Your demo closet stays saved in this browser. You can pick up where you left off." : "You can log back in any time.",
            confirmLabel: mode === "demo" ? "Leave demo" : "Log out",
          });
          if (ok) await signOut();
        }}
      >
        {mode === "demo" ? "Leave demo" : "Log out"}
      </Button>

      <Sheet
        open={!!editing}
        onClose={() => setEditing(null)}
        title={rows.find((r) => r.id === editing)?.label ?? ""}
        size="lg"
        footer={
          <div className="flex gap-2 pb-1">
            <Button variant="secondary" className="flex-1" onClick={() => setEditing(null)}>Cancel</Button>
            <Button
              className="flex-1"
              onClick={async () => {
                await saveProfile({ ...draft, displayName: draft.displayName.trim(), onboarded: true });
                setEditing(null);
                toast("Profile updated.");
              }}
            >
              Save
            </Button>
          </div>
        }
      >
        {editing && editors[editing]}
      </Sheet>
    </div>
  );
}
