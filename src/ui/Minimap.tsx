import { useEffect, useRef } from 'preact/hooks';
import { app } from '../app';
import { BIOME_COLORS, type Biome } from '../sim/world/tiles';
import { store } from './store';

/** Biyom renkleriyle tek seferlik çizilen taban + her karede oyuncu işareti. */
export function Minimap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const baseRef = useRef<HTMLCanvasElement | null>(null);
  const version = store.version.value;
  const tile = store.playerTile.value;

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
    if (!c || !base) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(base, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(tile.x - 1, tile.y - 1, 3, 3);
    ctx.fillStyle = '#e4514f';
    ctx.fillRect(tile.x, tile.y, 1, 1);
  }, [tile, version]);

  const size = app.sim?.world.width ?? 200;
  return (
    <div class="hud minimap panel" title="Mini harita">
      <canvas ref={canvasRef} width={size} height={size} />
    </div>
  );
}
