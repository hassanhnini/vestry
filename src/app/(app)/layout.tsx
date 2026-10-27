"use client";
import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useWardrobe } from "@/lib/store";
import { AppShell } from "@/components/layout/app-shell";
import { Monogram } from "@/components/layout/brand";
import { Button, EmptyState } from "@/components/ui/primitives";

export default function AppLayout({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const { ready, error, reload } = useWardrobe();
  const router = useRouter();

  useEffect(() => {
    if (status === "signed-out") router.replace("/");
  }, [status, router]);

  if (status !== "signed-in" || !ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center" role="status" aria-label="Loading your wardrobe">
        <Monogram className="size-11 animate-pulse text-ink" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <EmptyState
          icon={<AlertCircle className="size-7" />}
          title="We couldn't open your wardrobe"
          body={<>{error} Check your connection and try again.</>}
          action={<Button onClick={() => reload()}>Try again</Button>}
        />
      </div>
    );
  }
  return <AppShell>{children}</AppShell>;
}
