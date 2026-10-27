import { NextResponse } from "next/server";
import { HttpError } from "./ai/server";

export function jsonError(e: unknown) {
  if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
  // Never log request bodies (they may contain personal photos).
  console.error("[api] unexpected error:", e instanceof Error ? e.message : "unknown");
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}
