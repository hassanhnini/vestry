"use client";
// Renders a shareable PNG collage from the user's actual garment images (no generated imagery).
import type { Repo } from "@/lib/data/repo";
import type { ClothingItem } from "@/lib/types";
import { composeBoard } from "./layout";

export async function renderCollage(items: ClothingItem[], repo: Repo, title: string): Promise<Blob> {
  const W = 1080, H = 1350;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H + 140;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#f5f0e8";
  ctx.fillRect(0, 0, c.width, c.height);
  const g = ctx.createRadialGradient(W / 2, H * 0.15, 40, W / 2, H * 0.4, H);
  g.addColorStop(0, "#fffdf9");
  g.addColorStop(0.7, "#f4eee5");
  g.addColorStop(1, "#eee6da");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const slots = composeBoard(items).sort((a, b) => a.z - b.z);
  for (const s of slots) {
    const path = s.item.imageCutout ?? s.item.imageOriginal;
    const blob = await repo.getImageBlob(path);
    if (!blob) continue;
    const bmp = await createImageBitmap(blob);
    const bw = (s.w / 100) * W, bh = (s.h / 100) * H;
    const scale = Math.min(bw / bmp.width, bh / bmp.height);
    const dw = bmp.width * scale, dh = bmp.height * scale;
    const dx = (s.x / 100) * W + (bw - dw) / 2, dy = (s.y / 100) * H + (bh - dh) / 2;
    ctx.save();
    if (s.item.imageCutout) {
      ctx.shadowColor = "rgba(36,33,31,0.16)";
      ctx.shadowBlur = 28;
      ctx.shadowOffsetY = 12;
    }
    ctx.drawImage(bmp, dx, dy, dw, dh);
    ctx.restore();
    bmp.close();
  }
  ctx.fillStyle = "#24211f";
  ctx.font = "500 44px 'Fraunces Variable', Georgia, serif";
  ctx.fillText(title.slice(0, 40), 56, H + 80);
  ctx.fillStyle = "#8a7d70";
  ctx.font = "600 22px 'Inter Tight Variable', sans-serif";
  ctx.fillText("STYLED FROM MY OWN WARDROBE · VESTRY", 56, H + 118);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("encode"))), "image/png"));
}
