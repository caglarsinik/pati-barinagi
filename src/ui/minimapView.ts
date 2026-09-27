/**
 * Mini harita görünümü (0.22.1): yakınlaştırma kademeleri, görünen dikdörtgen, dokunuş → kare eşlemesi, kaydırma ve iki
 * parmak. Saf (DOM yok); Minimap.tsx ve testler kullanır. Birim dünya karesidir; tuval dünya genişliği kadar pikseldir,
 * kademe z'de bir kare z tuval pikseli olur (tam sayı ölçek piksel sanatını keskin tutar).
 */
export const ZOOM_LEVELS = [1, 2, 4] as const;
export type MinimapZoom = (typeof ZOOM_LEVELS)[number];

/** Görünen dikdörtgen (kare cinsinden, dünyanın içinde). */
export interface ViewRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/** Cihazda saklanan tercih: '1' | '2' | '4'; başka her şey 1. */
export function parseZoom(v: unknown): MinimapZoom {
  const n = Number(v);
  return (ZOOM_LEVELS as readonly number[]).includes(n) ? (n as MinimapZoom) : 1;
}

/** Bir kademe yakın (+1) ya da uzak (−1); uçlarda kalır. */
export function zoomStep(z: MinimapZoom, dir: 1 | -1): MinimapZoom {
  return ZOOM_LEVELS[clamp(ZOOM_LEVELS.indexOf(z) + dir, 0, ZOOM_LEVELS.length - 1)];
}

/** İki parmak: başlangıç kademesi × parmak aralığı oranı, logaritmik ölçekte en yakın kademeye yuvarlanır. */
export function pinchZoom(base: MinimapZoom, scale: number): MinimapZoom {
  if (!(scale > 0) || !Number.isFinite(scale)) return base;
  return ZOOM_LEVELS[clamp(Math.round(Math.log2(base * scale)), 0, ZOOM_LEVELS.length - 1)];
}

/** Merkez dünyanın içinde kalsın: görünen dikdörtgen kenarı aşmaz. */
export function clampCenter(cx: number, cy: number, zoom: number, W: number, H: number): { x: number; y: number } {
  const hw = W / zoom / 2;
  const hh = H / zoom / 2;
  return { x: clamp(cx, hw, W - hw), y: clamp(cy, hh, H - hh) };
}

/** Merkez etrafında görünen dikdörtgen; köşe tuval pikseline oturur (kaydırırken çizim bulanıklaşmaz). */
export function viewRect(cx: number, cy: number, zoom: number, W: number, H: number): ViewRect {
  const sw = W / zoom;
  const sh = H / zoom;
  const c = clampCenter(cx, cy, zoom, W, H);
  return { sx: Math.round((c.x - sw / 2) * zoom) / zoom, sy: Math.round((c.y - sh / 2) * zoom) / zoom, sw, sh };
}

/** Tuvaldeki nokta (tuvalin sol üstüne göre CSS pikseli) → dünya karesi. */
export function pickTile(v: ViewRect, px: number, py: number, cssW: number, cssH: number): { x: number; y: number } {
  return { x: Math.floor(v.sx + (px / cssW) * v.sw), y: Math.floor(v.sy + (py / cssH) * v.sh) };
}

/** Sürükleme: parmak (dx, dy) CSS pikseli kayınca harita onunla gelir, merkez ters yöne kayar (dünya içinde kalır). */
export function panBy(cx: number, cy: number, dx: number, dy: number, zoom: number, W: number, H: number, cssW: number, cssH: number): { x: number; y: number } {
  return clampCenter(cx - (dx / cssW) * (W / zoom), cy - (dy / cssH) * (H / zoom), zoom, W, H);
}

/** Kare görünen dikdörtgenin içinde mi (kenardan `pad` kare içeride). */
export function inView(v: ViewRect, x: number, y: number, pad = 0): boolean {
  return x >= v.sx + pad && y >= v.sy + pad && x < v.sx + v.sw - pad && y < v.sy + v.sh - pad;
}
