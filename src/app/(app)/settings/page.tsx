"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Cloud, Download, HardDrive, ShieldCheck, Trash2, UserX } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useWardrobe } from "@/lib/store";
import { useAiStatus } from "@/lib/ai/status";
import { Badge, Button, Card, Chip, PageHeader } from "@/components/ui/primitives";
import { useOverlay } from "@/components/ui/overlay";

function Section({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6">
      <h2 className="mb-3 font-display text-2xl">{title}</h2>
      <Card className="divide-y divide-line/70">{children}</Card>
    </section>
  );
}
function Row({ title, body, action }: { title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-[0.9375rem] font-medium">{title}</p>
        {body && <div className="mt-0.5 text-[0.8125rem] leading-relaxed text-ink-soft">{body}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export default function SettingsPage() {
  const { mode, user, signOut, getToken } = useAuth();
  const { repo, profile, saveProfile, reload } = useWardrobe();
  const { status: ai, checked } = useAiStatus();
  const { toast, confirm } = useOverlay();
  const router = useRouter();
  const [bgProvider, setBgProvider] = useState<"local" | "server">(() => {
    try {
      return localStorage.getItem("vestry.bgProvider") === "server" ? "server" : "local";
    } catch {
      return "local";
    }
  });
  const [busy, setBusy] = useState<string | null>(null);


  const exportData = async () => {
    if (!repo) return;
    setBusy("export");
    try {
      const snap = await repo.exportAll();
      const blob = new Blob([JSON.stringify(snap, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vestry-export-${snap.exportedAt.slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast("Export downloaded.");
    } finally {
      setBusy(null);
    }
  };

  const clearData = async () => {
    const ok = await confirm({
      title: "Delete all wardrobe data?",
      body: "Every item, photo, outfit, plan and wear record will be permanently deleted. This can't be undone. Consider exporting first.",
      confirmLabel: "Delete everything",
      destructive: true,
    });
    if (!ok || !repo) return;
    setBusy("clear");
    try {
      await repo.clearAll();
      await reload();
      toast("All wardrobe data deleted.");
      router.replace("/home");
    } catch (e) {
      toast(`Couldn't delete: ${(e as Error).message}`, "error");
    } finally {
      setBusy(null);
    }
  };

  const deleteAccount = async () => {
    const ok = await confirm({
      title: "Delete your account?",
      body: "Your account, closet, photos and outfits will be permanently deleted from our servers. This can't be undone.",
      confirmLabel: "Delete account",
      destructive: true,
    });
    if (!ok) return;
    setBusy("account");
    try {
      const token = await getToken();
      const res = await fetch("/api/account/delete", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Request failed");
      await signOut();
      toast("Your account has been deleted.");
      router.replace("/");
    } catch (e) {
      toast(`Couldn't delete account: ${(e as Error).message}`, "error");
    } finally {
      setBusy(null);
    }
  };

  const providerName = ai?.provider === "claude" ? "Claude (Anthropic)" : ai?.provider === "gemini" ? "Gemini (Google)" : null;

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <div>
        <Link href="/profile" className="-ml-2 mb-2 inline-flex h-11 items-center gap-1.5 rounded-full px-2 text-sm text-ink-soft hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden /> Profile
        </Link>
        <PageHeader eyebrow="Settings" title="Settings & privacy" />
      </div>

      <Section id="storage" title="Account & storage">
        {mode === "demo" ? (
          <Row
            title="Demo mode"
            body="Your closet is stored privately in this browser (IndexedDB). It isn't uploaded anywhere and won't sync to other devices. Clearing your browser data will erase it — export regularly if it matters to you."
            action={<Badge tone="warn"><HardDrive className="size-3.5" /> This device only</Badge>}
          />
        ) : (
          <Row title="Signed in" body={user?.email} action={<Badge tone="success"><Cloud className="size-3.5" /> Synced</Badge>} />
        )}
        <Row title="Log out" action={<Button size="sm" variant="secondary" onClick={() => signOut()}>Log out</Button>} />
      </Section>

      <Section title="Photos & AI">
        <Row
          title="Background removal"
          body={
            <>
              Runs on your device with an open model — photos don&apos;t leave your phone or computer.
              {ai?.bgServer && " This server also offers remove.bg (uses limited free credits)."}
            </>
          }
          action={
            <div className="flex gap-2">
              <Chip size="sm" selected={bgProvider === "local"} onClick={() => { setBgProvider("local"); try { localStorage.setItem("vestry.bgProvider", "local"); } catch {} }}>On-device</Chip>
              {ai?.bgServer && (
                <Chip size="sm" selected={bgProvider === "server"} onClick={() => { setBgProvider("server"); try { localStorage.setItem("vestry.bgProvider", "server"); } catch {} }}>remove.bg</Chip>
              )}
            </div>
          }
        />
        <Row
          title="Cut-out quality"
          body="High quality downloads a larger model once (~90 MB). Fast is lighter (~45 MB) and better for older phones."
          action={
            <div className="flex gap-2">
              <Chip size="sm" selected={profile.bgModel === "medium"} onClick={() => saveProfile({ bgModel: "medium" })}>High quality</Chip>
              <Chip size="sm" selected={profile.bgModel === "small"} onClick={() => saveProfile({ bgModel: "small" })}>Fast</Chip>
            </div>
          }
        />
        <Row
          title="Cloud AI tagging & styling"
          body={
            !checked ? "Checking…" : providerName ? (
              <>Uses {providerName} ({ai?.model}). When on, a small preview of each cut-out and a text list of your closet (names, categories, colours — no photos) are sent to the provider. Off means everything stays on-device.</>
            ) : (
              <>No cloud AI is configured on this server, so tagging uses on-device colour measurement and you confirm categories. The on-device stylist is fully available.</>
            )
          }
          action={
            providerName ? (
              <Chip size="sm" selected={profile.cloudAi} onClick={() => saveProfile({ cloudAi: !profile.cloudAi }).then(() => toast(profile.cloudAi ? "Cloud AI turned off." : "Cloud AI turned on."))}>
                {profile.cloudAi ? "On" : "Off"}
              </Chip>
            ) : (
              <Badge>Not configured</Badge>
            )
          }
        />
      </Section>

      <Section title="Your data">
        <Row title="Export my data" body="Download all your wardrobe records as JSON (photos stay in your storage)." action={<Button size="sm" variant="secondary" loading={busy === "export"} icon={<Download className="size-4" />} onClick={exportData}>Export</Button>} />
        <Row title="Delete all wardrobe data" body="Removes every item, photo, outfit, plan and wear record." action={<Button size="sm" variant="danger" loading={busy === "clear"} icon={<Trash2 className="size-4" />} onClick={clearData}>Delete data</Button>} />
        {mode === "cloud" && (
          <Row title="Delete account" body="Permanently deletes your account and everything in it." action={<Button size="sm" variant="danger" loading={busy === "account"} icon={<UserX className="size-4" />} onClick={deleteAccount}>Delete account</Button>} />
        )}
      </Section>

      <Section title="Privacy">
        <Row
          title="Privacy by design"
          body={
            <ul className="mt-1 list-disc space-y-1 pl-4">
              <li>We never infer personal characteristics (age, body shape, ethnicity) from photos, and never ask for body photos or measurements.</li>
              <li>Your photos are private. In cloud mode they live in a private bucket and are shown through short-lived signed links.</li>
              <li>Outfit suggestions only ever use items in your own closet.</li>
              <li>Vestry is free. Optional cloud AI runs on the operator&apos;s API key and is rate-limited.</li>
            </ul>
          }
          action={<ShieldCheck className="size-6 text-sage" aria-hidden />}
        />
      </Section>
    </div>
  );
}
