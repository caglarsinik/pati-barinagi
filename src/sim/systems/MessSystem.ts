import { NEIGHBORS8, type TilePos } from '../world/TileWorld';
import { Obj } from '../world/tiles';
import type { Sim } from '../Sim';

/** Pislik: köpeğin olduğu kareye, doluysa komşu bir kareye bırakılır. */
export function placeMess(sim: Sim, x: number, y: number): TilePos | null {
  const w = sim.world;
  const free = (tx: number, ty: number): boolean =>
    w.inPlotInterior(tx, ty) && w.objectAt(tx, ty) === Obj.None && !w.isSolid(tx, ty);
  let tile: TilePos | null = null;
  if (free(x, y)) tile = { x, y };
  else {
    for (const [dx, dy] of NEIGHBORS8) {
      if (free(x + dx, y + dy)) {
        tile = { x: x + dx, y: y + dy };
        break;
      }
    }
  }
  if (!tile) return null;
  w.setObject(tile.x, tile.y, Obj.Mess);
  sim.messTiles.add(w.idx(tile.x, tile.y));
  return tile;
}

export function cleanMess(sim: Sim, x: number, y: number): boolean {
  const w = sim.world;
  if (w.objectAt(x, y) !== Obj.Mess) return false;
  w.setObject(x, y, Obj.None);
  sim.messTiles.delete(w.idx(x, y));
  sim.stats.cleaned++;
  return true;
}

/** Kayıt yüklendikten sonra pislik kümesini dünyadan yeniden kurar. */
export function rebuildMessSet(sim: Sim): void {
  sim.messTiles.clear();
  const w = sim.world;
  for (let i = 0; i < w.object.length; i++) if (w.object[i] === Obj.Mess) sim.messTiles.add(i);
}
