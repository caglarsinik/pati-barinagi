import { useEffect, useRef, useState } from 'preact/hooks';
import { app } from '../app';
import { buildingFootprint, isReady } from '../sim/entities/Building';
import { BIOME_COLORS, type Biome, Obj } from '../sim/world/tiles';
import { store } from './store';
import { t } from '../i18n';
import { signKnown, signposts } from '../sim/world/Signposts';
import { type MinimapZoom, clampCenter, inView, panBy, pickTile, pinchZoom, viewRect, zoomStep } from './minimapView';

/** Biyom renkleriyle çizilen taban; sis, yuva/in işaretleri ve oyuncu her güncellemede üstüne gelir. */
/** Harita işaretlerinin renkleri (MapMarker.color sırası). */
export const MARKER_COLORS = ['#e4514f', '#4fb3e8', '#6dbb4f', '#f6d55c', '#a66bd6'];

/** Tekerlekte art arda kademe atlamasın (dokunmatik yüzeyler çok küçük olay üretir). */
const WHEEL_GAP_MS = 180;

/**
 * Mini harita (masaüstü/tablet sağ alt) ve tam ekran harita (`inSheet`). 0.22.1: 1×/2×/4× yakınlaştırma (cihazda saklanır,
 * ikisi ortak). Panel oyuncuyu izler, tekerlek ve köşedeki +/− (fareyle) kademe değiştirir, dokununca tam ekran harita
 * açılır. Tam ekran haritada sürükleyerek kaydırılır, iki parmakla ya da tekerlekle yakınlaşır; ⌖ yeniden oyuncuya döner;
 * dokunuş `onPick(x, y, tolerans)` ile kareyi verir.
 */
export function Minimap({
  inSheet = false,
  onPick,
  selected = null,
}: { inSheet?: boolean; onPick?: (x: number, y: number, tol: number) => void; selected?: number | null } = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const baseRef = useRef<HTMLCanvasElement | null>(null);
  /** Sis katmanı: keşif sayısı değişmedikçe yeniden üretilmez. */
  const fogRef = useRef<{ canvas: HTMLCanvasElement; count: number } | null>(null);
  /** Tam ekran haritada sürükleyerek seçilen merkez (kare); null: oyuncuyu izler. */
  const [center, setCenter] = useState<{ x: number; y: number } | null>(null);
  const gesture = useRef<{
    pts: Map<number, { x: number; y: number }>;
    start: { x: number; y: number; cx: number; cy: number } | null;
    moved: boolean;
    multi: boolean;
    pinch: { dist: number; zoom: MinimapZoom } | null;
  }>({ pts: new Map(), start: null, moved: false, multi: false, pinch: null });
  const lastWheel = useRef(0);
  const version = store.version.value;
  const tile = store.playerTile.value;
  const tick = store.tick.value;
  const zoom = store.minimapZoom.value;
  const W = app.sim?.world.width ?? 200;
  const H = app.sim?.world.height ?? 200;
  const focus = inSheet && center ? center : { x: tile.x + 0.5, y: tile.y + 0.5 };
  const view = viewRect(focus.x, focus.y, zoom, W, H);

  useEffect(() => {
    const sim = app.sim;
    if (!sim) return;
    const w = sim.world.width;
    const h = sim.world.height;
    const base = document.createElement('canvas');
    base.width = w;
    base.height = h;
    const ctx = base.getContext('2d');
    if (!ctx) return;
    const img = ctx.createImageData(w, h);
    for (let i = 0; i < w * h; i++) {
      const c = BIOME_COLORS[sim.world.biome[i] as Biome];
      img.data[i * 4] = (c >> 16) & 0xff;
      img.data[i * 4 + 1] = (c >> 8) & 0xff;
      img.data[i * 4 + 2] = c & 0xff;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    baseRef.current = base;
  }, [version]);

  // Seçilen işaret görünen alanın dışındaysa harita ona kayar (listeden seçince).
  useEffect(() => {
    if (!inSheet || selected === null || zoom === 1) return;
    const m = app.sim?.markers.find((x) => x.id === selected);
    if (m && !inView(view, m.x, m.y, 2)) setCenter(clampCenter(m.x + 0.5, m.y + 0.5, zoom, W, H));
  }, [selected]);

  useEffect(() => {
    const c = canvasRef.current;
    const base = baseRef.current;
    const sim = app.sim;
    if (!c || !base || !sim) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const w = sim.world.width;
    const h = sim.world.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    // Görünen alan kademe kadar büyütülür; aşağıdaki çizimler dünya karesi cinsinden kalır.
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(zoom, 0, 0, zoom, -view.sx * zoom, -view.sy * zoom);
    /** Bir tuval pikseli (kare cinsinden): nokta işaretleri her kademede aynı boyda kalır. */
    const px = 1 / zoom;
    const dot = (x: number, y: number, size: number): void => ctx.fillRect(x + 0.5 - (size * px) / 2, y + 0.5 - (size * px) / 2, size * px, size * px);
    ctx.drawImage(base, 0, 0);
    // Sis: keşfedilmemiş kareler koyu; keşif sayısı değişmediyse önbellekten.
    const explored = sim.world.explored;
    if (!fogRef.current || fogRef.current.count !== sim.exploredCount || fogRef.current.canvas.width !== w) {
      const fog = ctx.createImageData(w, h);
      for (let i = 0; i < w * h; i++) {
        if (explored[i]) continue;
        fog.data[i * 4] = 12;
        fog.data[i * 4 + 1] = 10;
        fog.data[i * 4 + 2] = 22;
        fog.data[i * 4 + 3] = 215;
      }
      const fogCanvas = fogRef.current?.canvas ?? document.createElement('canvas');
      fogCanvas.width = w;
      fogCanvas.height = h;
      fogCanvas.getContext('2d')?.putImageData(fog, 0, 0);
      fogRef.current = { canvas: fogCanvas, count: sim.exploredCount };
    }
    ctx.drawImage(fogRef.current.canvas, 0, 0);
    // Barınak binaları (0.22.1): yakınlaşınca arsada ne nerede görünsün; yapımdaki soluk.
    for (const b of sim.buildings) {
      const f = buildingFootprint(b);
      ctx.fillStyle = isReady(b) ? '#a8764a' : '#6f5d4c';
      ctx.fillRect(f.x, f.y, f.w, f.h);
    }
    // Arsa çerçevesi
    const p = sim.world.plot;
    ctx.strokeStyle = '#f6d55c';
    ctx.lineWidth = px;
    ctx.strokeRect(p.x + px / 2, p.y + px / 2, p.w - px, p.h - px);
    // Keşfedilmiş yuvalar ve inler
    for (const n of sim.world.nests) {
      const i = sim.world.idx(n.x, n.y);
      if (!explored[i]) continue;
      ctx.fillStyle = sim.world.object[i] === Obj.NestEggs ? '#fff2a8' : '#8f8f98';
      dot(n.x, n.y, 3);
    }
    for (const d of sim.world.dens) {
      if (!explored[sim.world.idx(d.x, d.y)]) continue;
      ctx.fillStyle = '#ff9a3c';
      dot(d.x, d.y, 3);
    }
    // Köy binaları (0.18.2), keşfedildiyse.
    for (const vb of sim.world.villageBuildings) {
      if (!explored[sim.world.idx(vb.x, vb.y + vb.h - 1)]) continue;
      ctx.fillStyle = vb.kind === 'fountain' ? '#6faae0' : vb.kind === 'market' ? '#e27aa8' : '#7d5430';
      ctx.fillRect(vb.x, vb.y, vb.w, vb.h);
    }
    // Terk edilmiş ev (0.23.2), bulunduysa; günlükteki gizli yuva mor nokta.
    const ruin = sim.world.ruin;
    if (ruin && sim.ruin.found) {
      ctx.fillStyle = sim.ruin.repaired ? '#c98b4f' : '#8a7a66';
      ctx.fillRect(ruin.x, ruin.y, ruin.w, ruin.h);
    }
    const hidden = sim.ruin.nest;
    if (hidden) {
      ctx.fillStyle = '#c77dff';
      dot(hidden.x, hidden.y, 5);
    }
    // Yol tabelaları (0.20.3), keşfedildiyse.
    ctx.fillStyle = '#e8c547';
    for (const s of signposts(sim.world)) if (signKnown(sim.world, s)) dot(s.x, s.y, 3);
    // Kayıp köpek görevi (0.20.4): görüldüğü alan turuncu çerçeve.
    const area = sim.quests.searchArea();
    if (area) {
      ctx.strokeStyle = '#ff7b3a';
      ctx.strokeRect(area.x - area.r + px / 2, area.y - area.r + px / 2, 2 * area.r, 2 * area.r);
    }
    for (const dog of sim.dogs) {
      if (!dog.wild || !dog.following) continue;
      ctx.fillStyle = '#ff9a3c';
      dot(dog.tileX, dog.tileY, 2);
    }
    // İşaretler (0.18.1): koyu çerçeveli renkli kare, seçili olan beyaz halkalı; oyuncu üstte kalır.
    for (const m of sim.markers) {
      if (m.id === selected) {
        ctx.fillStyle = '#ffffff';
        dot(m.x, m.y, 9);
      }
      ctx.fillStyle = '#24203a';
      dot(m.x, m.y, 7);
      ctx.fillStyle = MARKER_COLORS[m.color] ?? MARKER_COLORS[0];
      dot(m.x, m.y, 5);
    }
    ctx.fillStyle = '#ffffff';
    dot(tile.x, tile.y, 3);
    ctx.fillStyle = '#e4514f';
    dot(tile.x, tile.y, 1);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }, [tile, version, Math.floor(tick / 5), app.sim?.markers.map((m) => m.id).join(',') ?? '', selected, zoom, view.sx, view.sy]);

  const setZoom = (z: MinimapZoom): void => {
    if (z !== zoom) app.setMinimapZoom(z);
  };
  const onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    const now = performance.now();
    if (now - lastWheel.current < WHEEL_GAP_MS || e.deltaY === 0) return;
    lastWheel.current = now;
    setZoom(zoomStep(zoom, e.deltaY < 0 ? 1 : -1));
  };

  // Tam ekran harita: dokun (işaret), sürükle (kaydır), iki parmak (yakınlaştır).
  const rect = (): DOMRect | null => canvasRef.current?.getBoundingClientRect() ?? null;
  const spread = (pts: Map<number, { x: number; y: number }>): number => {
    const [a, b] = [...pts.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };
  const onDown = (e: PointerEvent): void => {
    const g = gesture.current;
    try {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } catch {
      /* işaretçi çoktan bitmiş: yakalamadan sürer */
    }
    g.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (g.pts.size === 1) {
      g.start = { x: e.clientX, y: e.clientY, cx: focus.x, cy: focus.y };
      g.moved = false;
      g.multi = false;
      g.pinch = null;
    } else if (g.pts.size === 2) {
      g.multi = true;
      g.start = null;
      g.pinch = { dist: Math.max(1, spread(g.pts)), zoom };
    }
  };
  const onMove = (e: PointerEvent): void => {
    const g = gesture.current;
    if (!g.pts.has(e.pointerId)) return;
    g.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (g.pinch && g.pts.size >= 2) {
      setZoom(pinchZoom(g.pinch.zoom, spread(g.pts) / g.pinch.dist));
      return;
    }
    const st = g.start;
    const r = rect();
    if (!st || !r) return;
    const dx = e.clientX - st.x;
    const dy = e.clientY - st.y;
    if (!g.moved && Math.hypot(dx, dy) < 6) return;
    g.moved = true;
    setCenter(panBy(st.cx, st.cy, dx, dy, zoom, W, H, r.width, r.height));
  };
  const onUp = (e: PointerEvent): void => {
    const g = gesture.current;
    if (!g.pts.delete(e.pointerId)) return;
    if (g.pts.size < 2) g.pinch = null;
    if (g.pts.size > 0) return;
    const tap = g.start !== null && !g.moved && !g.multi;
    g.start = null;
    const r = rect();
    if (!tap || !onPick || !r) return;
    const at = pickTile(view, e.clientX - r.left, e.clientY - r.top, r.width, r.height);
    // Dokunuş toleransı ekranda ~16 px: uzakta geniş, yakında dar.
    onPick(at.x, at.y, Math.max(1.5, 16 * (view.sw / r.width)));
  };
  const onCancel = (e: PointerEvent): void => {
    const g = gesture.current;
    g.pts.delete(e.pointerId);
    if (g.pts.size === 0) {
      g.start = null;
      g.pinch = null;
    }
  };

  if (inSheet) {
    return (
      <div class="minimap in-sheet">
        <canvas ref={canvasRef} width={W} height={H} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onCancel} onWheel={onWheel} />
        <div class="minimap-zoom sheet">
          <button class="btn small" disabled={zoom === 1} title={t('Uzaklaştır')} onClick={() => setZoom(zoomStep(zoom, -1))}>
            −
          </button>
          <span class="mm-level">{zoom}×</span>
          <button class="btn small" disabled={zoom === 4} title={t('Yakınlaştır')} onClick={() => setZoom(zoomStep(zoom, 1))}>
            +
          </button>
          <button class="btn small" disabled={center === null} title={t('Haritayı bana ortala')} onClick={() => setCenter(null)}>
            ⌖
          </button>
        </div>
      </div>
    );
  }
  if (store.minimapHidden.value) {
    return (
      <button class="minimap-show btn small" title={t('Mini haritayı göster')} onClick={() => app.setMinimap(false)}>
        🗺️
      </button>
    );
  }
  return (
    <div class="minimap panel" title={t('Mini harita: sarı nokta dolu yuva, turuncu nokta sokak köpeği ini')}>
      <button class="btn small minimap-toggle" title={t('Mini haritayı gizle')} onClick={() => app.setMinimap(true)}>
        ✕
      </button>
      <canvas ref={canvasRef} width={W} height={H} title={t('Dokun: tam ekran harita')} onClick={() => (store.panel.value = 'map')} onWheel={onWheel} />
      {!store.touch.value && (
        <div class="minimap-zoom over">
          <button class="mm-btn" disabled={zoom === 1} title={t('Uzaklaştır')} onClick={() => setZoom(zoomStep(zoom, -1))}>
            −
          </button>
          <button class="mm-btn" disabled={zoom === 4} title={t('Yakınlaştır')} onClick={() => setZoom(zoomStep(zoom, 1))}>
            +
          </button>
        </div>
      )}
    </div>
  );
}
