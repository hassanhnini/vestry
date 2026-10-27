// Editorial flat-lay composition shared by the on-screen board and the exported collage.
import { roleOf, orderItems } from "@/lib/stylist/engine";
import type { ClothingItem, Role } from "@/lib/types";

export interface Slot {
  item: ClothingItem;
  /** percentages of the board */
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
}

export function composeBoard(items: ClothingItem[]): Slot[] {
  const ordered = orderItems(items);
  const has = (r: Role) => ordered.some((i) => roleOf(i) === r);
  const outer = has("outer");
  const side = has("bag") || has("accessory");
  const slots: Slot[] = [];
  let acc = 0;
  let tops = 0;
  for (const item of ordered) {
    const r = roleOf(item);
    switch (r) {
      case "outer":
        slots.push({ item, x: 3, y: 4, w: 46, h: 56, z: 1 });
        break;
      case "top": {
        const base = outer ? { x: 40, y: 3, w: 42, h: 40 } : { x: side ? 16 : 26, y: 3, w: 48, h: 42 };
        // A second (layering) top sits slightly offset behind the first.
        slots.push({ item, ...base, x: base.x + tops * 8, y: base.y + tops * 4, z: 3 - tops });
        tops++;
        break;
      }
      case "one-piece":
        slots.push({ item, x: outer ? 34 : side ? 14 : 22, y: 4, w: 46, h: 76, z: 2 });
        break;
      case "bottom":
        slots.push({ item, x: outer ? 30 : side ? 16 : 26, y: 40, w: 42, h: 54, z: 2 });
        break;
      case "shoes":
        slots.push({ item, x: 70, y: 74, w: 27, h: 22, z: 4 });
        break;
      case "bag":
        slots.push({ item, x: 68, y: 42, w: 30, h: 30, z: 4 });
        break;
      default: {
        const spots = [
          { x: 76, y: 6, w: 20, h: 20 },
          { x: 4, y: 74, w: 20, h: 20 },
          { x: 76, y: 24, w: 18, h: 16 },
        ];
        const s = spots[acc++ % spots.length];
        slots.push({ item, ...s, z: 5 });
      }
    }
  }
  return slots;
}
