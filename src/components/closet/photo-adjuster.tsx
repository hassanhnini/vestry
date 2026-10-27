"use client";
import { useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { RotateCcw, RotateCw } from "lucide-react";
import { Button, Chip } from "../ui/primitives";
import { Sheet } from "../ui/overlay";
import type { Adjustments } from "@/lib/image/pipeline";

const ASPECTS = [
  { label: "4:5", value: 4 / 5 },
  { label: "Square", value: 1 },
  { label: "3:4", value: 3 / 4 },
  { label: "Wide", value: 4 / 3 },
];

export function PhotoAdjuster({ open, src, onClose, onApply }: { open: boolean; src: string; onClose: () => void; onApply: (a: Adjustments) => void }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [aspect, setAspect] = useState(4 / 5);
  const [area, setArea] = useState<Area | null>(null);

  return (
    <Sheet open={open} onClose={onClose} title="Adjust photo" size="lg">
      <div className="relative h-[52dvh] overflow-hidden rounded-2xl bg-ink">
        <Cropper
          image={src}
          crop={crop}
          zoom={zoom}
          rotation={rotation}
          aspect={aspect}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onRotationChange={setRotation}
          onCropComplete={(_, px) => setArea(px)}
          objectFit="contain"
        />
      </div>
      <div className="mt-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {ASPECTS.map((a) => (
            <Chip key={a.label} size="sm" selected={aspect === a.value} onClick={() => setAspect(a.value)}>
              {a.label}
            </Chip>
          ))}
          <div className="ml-auto flex gap-1">
            <Button variant="secondary" size="sm" icon={<RotateCcw className="size-4" />} onClick={() => setRotation((r) => (r + 270) % 360)} aria-label="Rotate left">
              <span className="sr-only">Rotate left</span>
            </Button>
            <Button variant="secondary" size="sm" icon={<RotateCw className="size-4" />} onClick={() => setRotation((r) => (r + 90) % 360)} aria-label="Rotate right">
              <span className="sr-only">Rotate right</span>
            </Button>
          </div>
        </div>
        <label className="flex items-center gap-3 text-sm text-ink-soft">
          Zoom
          <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1 accent-[#97492f]" aria-label="Zoom" />
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onApply({ rotation, crop: area ? { x: Math.round(area.x), y: Math.round(area.y), width: Math.round(area.width), height: Math.round(area.height) } : null });
            }}
          >
            Apply & reprocess
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
