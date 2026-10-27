import { NextResponse } from "next/server";
import { aiStatus } from "@/lib/ai/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(aiStatus(), { headers: { "Cache-Control": "no-store" } });
}
