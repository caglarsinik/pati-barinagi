import { BALANCE } from '../../config/balance';
import { isReady } from '../entities/Building';
import { NEIGHBORS8, type TilePos } from '../world/TileWorld';
import { Obj, Zone } from '../world/tiles';
import type { Sim } from '../Sim';

/**
 * Pislik: köpeğin olduğu kareye, doluysa komşu bir kareye bırakılır. `preferZone` verilirse önce o
 * bölgedeki komşular denenir (tuvalet alanındaki pislik alanın içinde kalsın).
 */
export function placeMess(sim: Sim, x: number, y: number, preferZone?: Zone): TilePos | null {
  const w = sim.world;
  const free = (tx: number, ty: number): boolean =>
    w.inPlotInterior(tx, ty) && w.objectAt(tx, ty) === Obj.None && !w.isSolid(tx, ty);
  const neighbor = (onlyZone: boolean): TilePos | null => {
    for (const [dx, dy] of NEIGHBORS8) {
      const tx = x + dx;
      const ty = y + dy;
      if (onlyZone && w.zoneAt(tx, ty) !== preferZone) continue;
      if (free(tx, ty)) return { x: tx, y: ty };
    }
    return null;
  };
  let tile: TilePos | null = null;
  if (free(x, y)) tile = { x, y };
  else if (preferZone !== undefined) tile = neighbor(true) ?? neighbor(false);
  else tile = neighbor(false);
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

// ---------------------------------------------------------------------------
// Tuvalet alanı: alandaki pislik "kapsanır" — alan dolana kadar etkisi azdır.
// ---------------------------------------------------------------------------

/** Kare tuvalet bölgesinde mi (pislik olsun olmasın). */
export function isContainedMess(sim: Sim, tileIdx: number): boolean {
  return sim.world.zone[tileIdx] === Zone.Toilet;
}

/** Tuvalet alanındaki pislik sayısı. */
export function toiletMessCount(sim: Sim): number {
  let n = 0;
  for (const i of sim.messTiles) if (sim.world.zone[i] === Zone.Toilet) n++;
  return n;
}

/** Alan dışındaki (serbest) pislik sayısı. */
export function looseMessCount(sim: Sim): number {
  return sim.messTiles.size - toiletMessCount(sim);
}

/** İlk kapsanan ya da serbest pislik karesi (uyarı odağı için). */
export function firstMessTile(sim: Sim, contained: boolean): TilePos | null {
  const w = sim.world;
  for (const i of sim.messTiles) {
    if ((w.zone[i] === Zone.Toilet) !== contained) continue;
    return { x: i % w.width, y: Math.floor(i / w.width) };
  }
  return null;
}

/** Kareye `binRadius` içinde hazır bir çöp kutusu var mı. */
export function binNear(sim: Sim, x: number, y: number): boolean {
  const r = BALANCE.toilet.binRadius;
  return sim.buildings.some((b) => b.type === 'bin' && isReady(b) && Math.abs(b.x - x) <= r && Math.abs(b.y - y) <= r);
}

/** Tuvalet alanının herhangi bir karesine yakın çöp kutusu var mı. */
export function binNearToilet(sim: Sim): boolean {
  return sim.world.zoneTiles(Zone.Toilet).some((t) => binNear(sim, t.x, t.y));
}

/** Alanın kapasitesi: temel + yakın çöp kutusu bonusu. */
export function toiletCapacity(sim: Sim): number {
  const T = BALANCE.toilet;
  return T.capacity + (binNearToilet(sim) ? T.binCapacityBonus : 0);
}

/** Alan doldu: kapsanan pislikler artık serbest gibi sayılır. */
export function toiletFull(sim: Sim): boolean {
  return toiletMessCount(sim) >= toiletCapacity(sim);
}

/** Denetim ve hastalık için etkin pislik sayısı: serbest + kapsanan × (doluysa 1, değilse azaltılmış). */
export function effectiveMessCount(sim: Sim): number {
  const contained = toiletMessCount(sim);
  const loose = sim.messTiles.size - contained;
  return loose + contained * (toiletFull(sim) ? 1 : BALANCE.toilet.containedInspectionMul);
}

/** Köpek bu kareye basınca hijyen cezası: pislik değilse ya da kapsanan-ve-alan-dolu-değilse 0. */
export function messHygienePenalty(sim: Sim, tileIdx: number): number {
  const w = sim.world;
  if (w.object[tileIdx] !== Obj.Mess) return 0;
  if (w.zone[tileIdx] === Zone.Toilet && !toiletFull(sim)) return 0;
  return BALANCE.dogs.needs.hygieneMessPenalty;
}

/** Temizlik görev süresi çarpanı: yakın çöp kutusu işi hızlandırır. */
export function cleanMinutesMul(sim: Sim, tile: TilePos): number {
  return binNear(sim, tile.x, tile.y) ? BALANCE.toilet.binCleanMul : 1;
}
