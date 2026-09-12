import { BALANCE } from '../../config/balance';
import {
  BUILDING_DEFS,
  type BuildingType,
  PLOT_EXPANSION_COST,
  PLOT_EXPANSION_STEP,
  REFUND_RATE,
  TILE_TOOL_DEFS,
  type TileTool,
} from '../../content/buildings';
import { type Building, buildingDef, canPlaceBuilding } from '../entities/Building';
import type { TilePos } from '../world/TileWorld';
import { Biome, Ground, Obj, Zone } from '../world/tiles';
import type { Sim } from '../Sim';

export interface BuildResult {
  ok: boolean;
  message?: string;
  /** Yerleşen/etkilenen kare sayısı ya da bina. */
  building?: Building;
  count?: number;
  cost?: number;
}

/** Bina yerleştirme: para, yer, üstünde canlı var mı kontrolleri. */
export function tryPlaceBuilding(sim: Sim, type: BuildingType, x: number, y: number): BuildResult {
  const def = BUILDING_DEFS[type];
  if (!def || !def.buildable) return { ok: false, message: 'Bu bina inşa edilemez' };
  if (sim.money < def.cost) return { ok: false, message: `Yeterli para yok (${def.cost} ${BALANCE.economy.currency})` };
  if (!canPlaceBuilding(sim.world, type, x, y)) return { ok: false, message: 'Buraya sığmıyor' };
  if (occupiedByCreature(sim, x, y, def.w, def.h)) return { ok: false, message: 'Üstünde biri var' };
  const b = sim.placeBuilding(type, x, y, def.buildMinutes);
  if (!b) return { ok: false, message: 'Yerleştirilemedi' };
  sim.money -= def.cost;
  sim.stats.built++;
  return { ok: true, building: b, cost: def.cost, message: def.buildMinutes > 0 ? `${def.name} inşa ediliyor` : `${def.name} yerleştirildi` };
}

function occupiedByCreature(sim: Sim, x: number, y: number, w: number, h: number): boolean {
  const inside = (px: number, py: number): boolean => px >= x && py >= y && px < x + w && py < y + h;
  if (inside(sim.player.tileX, sim.player.tileY)) return true;
  for (const d of sim.dogs) if (inside(d.tileX, d.tileY)) return true;
  return false;
}

/** Çit/kapı/yol: kare listesine uygular; geçersiz kareler atlanır, sadece yerleşenler ödenir. */
export function tryPlaceTiles(sim: Sim, tool: TileTool, tiles: TilePos[]): BuildResult {
  const def = TILE_TOOL_DEFS[tool];
  const w = sim.world;
  const valid: TilePos[] = [];
  for (const t of tiles) {
    if (!w.inPlot(t.x, t.y)) continue;
    if (w.buildingIdAt(t.x, t.y) !== -1) continue;
    const o = w.objectAt(t.x, t.y);
    if (tool === 'path') {
      if (o !== Obj.None || w.groundAt(t.x, t.y) === Ground.Path) continue;
    } else if (tool === 'gate') {
      // Kapı çit yerine ya da boşa konabilir; pisliğin üstüne değil.
      if (o !== Obj.None && o !== Obj.Fence) continue;
    } else {
      if (o !== Obj.None && o !== Obj.Gate) continue;
      if (occupiedByCreature(sim, t.x, t.y, 1, 1)) continue;
    }
    valid.push(t);
  }
  if (valid.length === 0) return { ok: false, message: 'Uygun kare yok' };
  const affordable = Math.floor(sim.money / def.cost);
  if (affordable <= 0) return { ok: false, message: 'Yeterli para yok' };
  const placed = valid.slice(0, affordable);
  for (const t of placed) {
    if (tool === 'path') w.setGround(t.x, t.y, Ground.Path);
    else if (tool === 'gate') w.setObject(t.x, t.y, Obj.Gate);
    else w.setObject(t.x, t.y, Obj.Fence);
  }
  const cost = placed.length * def.cost;
  sim.money -= cost;
  return { ok: true, count: placed.length, cost, message: `${placed.length} ${def.name.toLowerCase()} (${cost} ${BALANCE.economy.currency})` };
}

/** Yıkım: karedeki bina, çit, kapı ya da yol kaldırılır; yarısı iade edilir. */
export function tryDemolish(sim: Sim, x: number, y: number): BuildResult {
  const w = sim.world;
  const bid = w.buildingIdAt(x, y);
  if (bid !== -1) {
    const b = sim.buildingById(bid);
    if (!b) return { ok: false };
    const def = buildingDef(b);
    if (!def.buildable) return { ok: false, message: `${def.name} yıkılamaz` };
    const refund = Math.round(def.cost * REFUND_RATE);
    sim.removeBuilding(b.id);
    sim.money += refund;
    return { ok: true, message: `${def.name} yıkıldı (+${refund} ${BALANCE.economy.currency})` };
  }
  const o = w.objectAt(x, y);
  if (o === Obj.Fence || o === Obj.Gate) {
    const refund = Math.round(TILE_TOOL_DEFS[o === Obj.Fence ? 'fence' : 'gate'].cost * REFUND_RATE);
    w.setObject(x, y, Obj.None);
    sim.money += refund;
    return { ok: true, message: `Kaldırıldı (+${refund} ${BALANCE.economy.currency})` };
  }
  if (w.groundAt(x, y) === Ground.Path && w.inPlot(x, y)) {
    w.setGround(x, y, Ground.Plot);
    sim.money += Math.round(TILE_TOOL_DEFS.path.cost * REFUND_RATE);
    return { ok: true };
  }
  return { ok: false, message: 'Burada yıkılacak bir şey yok' };
}

/** Bölge boyama: dikdörtgen içindeki uygun arsa kareleri (bina ve çit hariç). */
export function paintZone(sim: Sim, zone: Zone, x0: number, y0: number, x1: number, y1: number): BuildResult {
  const w = sim.world;
  const ax = Math.min(x0, x1);
  const bx = Math.max(x0, x1);
  const ay = Math.min(y0, y1);
  const by = Math.max(y0, y1);
  let n = 0;
  for (let y = ay; y <= by; y++) {
    for (let x = ax; x <= bx; x++) {
      if (!w.inPlotInterior(x, y)) continue;
      if (w.buildingIdAt(x, y) !== -1) continue;
      const o = w.objectAt(x, y);
      if (o === Obj.Fence || o === Obj.Gate) continue;
      if (w.zoneAt(x, y) === zone) continue;
      w.setZone(x, y, zone);
      n++;
    }
  }
  return { ok: n > 0, count: n, message: n > 0 ? undefined : 'Bölge değişmedi' };
}

export type ExpandDir = 'east' | 'south';

/** Arsayı doğuya ya da güneye 16 kare genişletir: alan temizlenir, çit taşınır, yol kapıları açılır. */
export function tryExpandPlot(sim: Sim, dir: ExpandDir): BuildResult {
  const w = sim.world;
  const p = w.plot;
  const step = PLOT_EXPANSION_STEP;
  const next = dir === 'east' ? { x: p.x, y: p.y, w: p.w + step, h: p.h } : { x: p.x, y: p.y, w: p.w, h: p.h + step };
  if (next.w > BALANCE.world.plotMaxW || next.h > BALANCE.world.plotMaxH) return { ok: false, message: 'Arsa bu yönde daha fazla büyüyemez' };
  if (next.x + next.w >= w.width - 3 || next.y + next.h >= w.height - 3) return { ok: false, message: 'Harita kenarına dayandı' };
  if (sim.money < PLOT_EXPANSION_COST) return { ok: false, message: `Yeterli para yok (${PLOT_EXPANSION_COST} ${BALANCE.economy.currency})` };

  const oldRight = p.x + p.w - 1;
  const oldBottom = p.y + p.h - 1;
  // Eski kenar çitini kaldır (yolun geçtiği kapılar dahil); köşeler yeni çitle yeniden gelir.
  if (dir === 'east') {
    for (let y = p.y; y <= oldBottom; y++) clearFence(sim, oldRight, y);
  } else {
    for (let x = p.x; x <= oldRight; x++) clearFence(sim, x, oldBottom);
  }
  // Yeni alanı temizle.
  const nx0 = dir === 'east' ? oldRight : p.x;
  const ny0 = dir === 'south' ? oldBottom : p.y;
  for (let y = ny0; y < next.y + next.h; y++) {
    for (let x = nx0; x < next.x + next.w; x++) {
      if (!w.inBounds(x, y)) continue;
      const i = w.idx(x, y);
      const o = w.object[i] as Obj;
      if (o !== Obj.None && o !== Obj.Fence && o !== Obj.Gate) w.setObject(x, y, Obj.None);
      // Ağaç tepesi, alt karesi arsa dışında kalan ağaca ait olabilir: onu da kaldır.
      if (o === Obj.TreeTop || o === Obj.PineTop) {
        if (w.inBounds(x, y + 1) && (w.objectAt(x, y + 1) === Obj.TreeTrunk || w.objectAt(x, y + 1) === Obj.PineTrunk)) w.setObject(x, y + 1, Obj.None);
      }
      if (o === Obj.TreeTrunk || o === Obj.PineTrunk) {
        if (w.inBounds(x, y - 1)) w.setObject(x, y - 1, Obj.None);
      }
      const road = w.biomeAt(x, y) === Biome.Road;
      w.setBiome(x, y, Biome.Plot);
      w.setGround(x, y, road ? Ground.Path : Ground.Plot);
      w.setZone(x, y, Zone.None);
    }
  }
  w.nests = w.nests.filter((n) => !(n.x >= next.x && n.y >= next.y && n.x < next.x + next.w && n.y < next.y + next.h));
  w.plot = next;
  // Yeni çevre çiti: sadece eksik olan kareler (kapıya denk gelen yol kareleri kapı olur).
  const right = next.x + next.w - 1;
  const bottom = next.y + next.h - 1;
  const fenceAt = (x: number, y: number): void => {
    const o = w.objectAt(x, y);
    if (o === Obj.Fence || o === Obj.Gate) return;
    const road = w.groundAt(x, y) === Ground.Path;
    w.setObject(x, y, road ? Obj.Gate : Obj.Fence);
  };
  for (let x = next.x; x <= right; x++) {
    fenceAt(x, next.y);
    fenceAt(x, bottom);
  }
  for (let y = next.y; y <= bottom; y++) {
    fenceAt(next.x, y);
    fenceAt(right, y);
  }
  sim.money -= PLOT_EXPANSION_COST;
  sim.stats.built++;
  return { ok: true, cost: PLOT_EXPANSION_COST, message: dir === 'east' ? 'Arsa doğuya genişledi' : 'Arsa güneye genişledi' };
}

function clearFence(sim: Sim, x: number, y: number): void {
  const o = sim.world.objectAt(x, y);
  if (o === Obj.Fence || o === Obj.Gate) sim.world.setObject(x, y, Obj.None);
}

/** İnşaat sayacı: her sim dakikası binaların kalan süresi düşer. */
export function tickConstruction(sim: Sim, dtMin: number): void {
  for (const b of sim.buildings) {
    if (b.buildLeft <= 0) continue;
    b.buildLeft = Math.max(0, b.buildLeft - dtMin);
    if (b.buildLeft === 0) {
      sim.events.emit('buildingReady', b);
      sim.events.emit('message', `${buildingDef(b).name} hazır`);
    }
  }
}
