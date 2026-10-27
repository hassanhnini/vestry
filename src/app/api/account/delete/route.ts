// Permanently deletes the signed-in user's account, wardrobe rows (via cascade) and stored images.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { HttpError, supabaseConfigured } from "@/lib/ai/server";
import { jsonError } from "@/lib/api-utils";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    if (!supabaseConfigured()) throw new HttpError(400, "Cloud accounts are not enabled on this deployment.");
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!service) throw new HttpError(503, "Account deletion requires SUPABASE_SERVICE_ROLE_KEY on the server.");
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) throw new HttpError(401, "Please sign in again.");
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, service, { auth: { persistSession: false } });
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user) throw new HttpError(401, "Your session has expired. Please sign in again.");
    const uid = data.user.id;
    // Remove every stored object under the user's folder.
    const bucket = admin.storage.from("wardrobe");
    const { data: folders } = await bucket.list(uid, { limit: 1000 });
    for (const f of folders ?? []) {
      const { data: files } = await bucket.list(`${uid}/${f.name}`, { limit: 100 });
      const paths = (files ?? []).map((x) => `${uid}/${f.name}/${x.name}`);
      if (paths.length) await bucket.remove(paths);
    }
    const del = await admin.auth.admin.deleteUser(uid);
    if (del.error) throw new HttpError(500, "Could not delete the account. Please try again.");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}
