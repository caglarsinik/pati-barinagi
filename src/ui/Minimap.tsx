import { useEffect, useRef } from 'preact/hooks';
import { app } from '../app';
import { BIOME_COLORS, type Biome, Obj } from '../sim/world/tiles';
import { store } from './store';
import { t } from '../i18n';

/** Biyom renkleriyle çizilen taban; sis, yuva/in işaretleri ve oyuncu her güncellemede üstüne gelir. */
export function Minimap({ inSheet = false }: { inSheet?: boolean } = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const baseRef = useRef<HTMLCanvasElement | null>(null);
  /** Sis katmanı: keşif sayısı değişmedikçe yeniden üretilmez. */
  const fogRef = useRef<{ canvas: HTMLCanvasElement; count: number } | null>(null);
  const version = store.version.value;
  const tile = store.playerTile.value;
  const tick = store.tick.value;

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

  useEffect(() => {
    const c = canvasRef.current;
    const base = baseRef.current;
    const sim = app.sim;
    if (!c || !base || !sim) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const w = sim.world.width;
    const h = sim.world.height;
    ctx.clearRect(0, 0, c.width, c.height);
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
    // Arsa çerçevesi
    const p = sim.world.plot;
    ctx.strokeStyle = '#f6d55c';
    ctx.lineWidth = 1;
    ctx.strokeRect(p.x + 0.5, p.y + 0.5, p.w - 1, p.h - 1);
    // Keşfedilmiş yuvalar ve inler
    for (const n of sim.world.nests) {
      const i = sim.world.idx(n.x, n.y);
      if (!explored[i]) continue;
      ctx.fillStyle = sim.world.object[i] === Obj.NestEggs ? '#fff2a8' : '#8f8f98';
      ctx.fillRect(n.x - 1, n.y - 1, 3, 3);
    }
    for (const d of sim.world.dens) {
      if (!explored[sim.world.idx(d.x, d.y)]) continue;
      ctx.fillStyle = '#ff9a3c';
      ctx.fillRect(d.x - 1, d.y - 1, 3, 3);
    }
    for (const dog of sim.dogs) {
      if (!dog.wild || !dog.following) continue;
      ctx.fillStyle = '#ff9a3c';
      ctx.fillRect(dog.tileX, dog.tileY, 2, 2);
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(tile.x - 1, tile.y - 1, 3, 3);
    ctx.fillStyle = '#e4514f';
    ctx.fillRect(tile.x, tile.y, 1, 1);
  }, [tile, version, Math.floor(tick / 5)]);

  const size = app.sim?.world.width ?? 200;
  if (inSheet) {
    return (
      <div class="minimap in-sheet">
        <canvas ref={canvasRef} width={size} height={size} />
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
      <canvas ref={canvasRef} width={size} height={size} />
    </div>
  );
}
