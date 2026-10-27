"use client";
import type { ReactNode } from "react";
import { AuthProvider } from "@/lib/auth";
import { WardrobeProvider } from "@/lib/store";
import { OverlayProvider } from "@/components/ui/overlay";
import { AiStatusProvider } from "@/lib/ai/status";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <WardrobeProvider>
        <AiStatusProvider>
          <OverlayProvider>{children}</OverlayProvider>
        </AiStatusProvider>
      </WardrobeProvider>
    </AuthProvider>
  );
}
