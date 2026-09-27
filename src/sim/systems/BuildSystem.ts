import { BALANCE } from '../../config/balance';
import {
  BUILDING_DEFS,
  type BuildingType,
  PLOT_EXPANSION_COST,
  PLOT_EXPANSION_STEP,
  REFUND_RATE,
  TILE_TOOL_DEFS,
  type TileTool,
  type TileToolDef,
} from '../../content/buildings';
import { type Building, buildingDef, canPlaceBuilding, buildingSize, normalizeRot, type Rotation } from '../entities/Building';
import type { TilePos, TileWorld } from '../world/TileWorld';
import { Biome, Ground, Obj, Zone } from '../world/tiles';
import type { Sim } from '../Sim';
import { t } from '../../i18n';

export interface BuildResult {
  ok: boolean;
  message?: string;
  /** Yerleşen/etkilenen kare sayısı ya da bina. */
  building?: Building;
  count?: number;
  cost?: number;
}

/** Bina bedeli (0.23.1): ödenecek para, harcanacak odun/taş ve malzemenin sağladığı indirim. */
export interface BuildQuote {
  money: number;
  wood: number;
  stone: number;
  discount: number;
}

/**
 * Malzemeyle öde (0.23.1): tarifteki odun/taş çantadakiyle sınırlı kullanılır (yetmezse kısmi); her odun `woodValue`, her taş
 * `stoneValue` ₺ indirir, indirim fiyatın en çok `maxShare` kadarı. Anahtar kapalıysa ya da tarif yoksa tam fiyat.
 */
export function quoteBuilding(sim: Sim, type: BuildingType): BuildQuote {
  const def = BUILDING_DEFS[type];
  const M = BALANCE.materials;
  if (!def.mats || !sim.policies.useMaterials) return { money: def.cost, wood: 0, stone: 0, discount: 0 };
  const wood = Math.min(def.mats.wood ?? 0, sim.materials.wood);
  const stone = Math.min(def.mats.stone ?? 0, sim.materials.stone);
  const discount = Math.min(Math.floor(def.cost * M.maxShare), wood * M.woodValue + stone * M.stoneValue);
  return { money: def.cost - discount, wood, stone, discount };
}

/** "🪵6 🪨2" (sıfır olan yazılmaz). */
export function matsLabel(m: { wood?: number; stone?: number }): string {
  const parts: string[] = [];
  if (m.wood) parts.push(`🪵${m.wood}`);
  if (m.stone) parts.push(`🪨${m.stone}`);
  return parts.join(' ');
}

/** Kare başına malzeme: çit "🪵1", kapı "🪵2", yol "🪨½". */
export function tileMatLabel(def: TileToolDef): string {
  const per = def.mat.n / def.mat.tiles;
  return `${def.mat.kind === 'wood' ? '🪵' : '🪨'}${per === 0.5 ? '½' : per}`;
}

/** Kare aracı şu an malzemeyle mi ödenir (anahtar açık, çantada en az bir birim). */
export function tileMatReady(sim: Sim, tool: TileTool): boolean {
  const m = TILE_TOOL_DEFS[tool].mat;
  return sim.policies.useMaterials && sim.materials[m.kind] >= m.n;
}

/** Bina yerleştirme: para, yer, üstünde canlı var mı kontrolleri. Malzemeyle ödemede tarif çantadan düşer (0.23.1). */
export function tryPlaceBuilding(sim: Sim, type: BuildingType, x: number, y: number, rotIn: Rotation = 0): BuildResult {
  const def = BUILDING_DEFS[type];
  if (!def || !def.buildable) return { ok: false, message: t('Bu bina inşa edilemez') };
  const rot = normalizeRot(type, rotIn);
  const size = buildingSize(def, rot);
  const q = quoteBuilding(sim, type);
  if (sim.money < q.money) return { ok: false, message: t('Yeterli para yok ({cost} ₺)', { cost: q.money }) };
  if (!canPlaceBuilding(sim.world, type, x, y, rot)) return { ok: false, message: t('Buraya sığmıyor') };
  if (occupiedByCreature(sim, x, y, size.w, size.h)) return { ok: false, message: t('Üstünde biri var') };
  const b = sim.placeBuilding(type, x, y, def.buildMinutes, rot);
  if (!b) return { ok: false, message: t('Yerleştirilemedi') };
  b.paid = { money: q.money, wood: q.wood, stone: q.stone };
  sim.materials.wood -= q.wood;
  sim.materials.stone -= q.stone;
  sim.addExpense('building', q.money, q.discount > 0 ? t('{name} (malzemeyle −{n} ₺)', { name: t(def.name), n: q.discount }) : t(def.name));
  sim.stats.built++;
  const msg = def.buildMinutes > 0 ? t('{name} inşa ediliyor', { name: t(def.name) }) : t('{name} yerleştirildi', { name: t(def.name) });
  const mats = matsLabel(q);
  return { ok: true, building: b, cost: q.money, message: mats ? `${msg} (${mats})` : msg };
}

function occupiedByCreature(sim: Sim, x: number, y: number, w: number, h: number): boolean {
  const inside = (px: number, py: number): boolean => px >= x && py >= y && px < x + w && py < y + h;
  if (inside(sim.player.tileX, sim.player.tileY)) return true;
  for (const d of sim.dogs) if (inside(d.tileX, d.tileY)) return true;
  return false;
}

/**
 * Binayı taşır (0.22.2): içindekilerle yerinde (kimlik, sakinler, yumurtalar, eşyalar, seviye korunur); döndürülebilir. Ofis
 * taşınmaz (sahiplenici kuyruğu ve bayılma noktası kapısına bağlı). Bedel `BALANCE.build.moveCostRate` (varsayılan ücretsiz).
 */
export function tryMoveBuilding(sim: Sim, id: number, x: number, y: number, rotIn?: Rotation): BuildResult {
  const b = sim.buildingById(id);
  if (!b) return { ok: false, message: t('Burada bina yok') };
  const def = buildingDef(b);
  if (!def.buildable) return { ok: false, message: t('{name} taşınamaz', { name: t(def.name) }) };
  if (sim.interior?.buildingId === b.id) return { ok: false, message: t('İçerideyken taşınamaz') };
  const rot = normalizeRot(b.type, rotIn ?? b.rot);
  if (x === b.x && y === b.y && rot === b.rot) return { ok: false, message: t('Zaten burada') };
  if (!canPlaceBuilding(sim.world, b.type, x, y, rot, b.id)) return { ok: false, message: t('Buraya sığmıyor') };
  const size = buildingSize(def, rot);
  if (occupiedByCreature(sim, x, y, size.w, size.h)) return { ok: false, message: t('Üstünde biri var') };
  const cost = Math.round(def.cost * BALANCE.build.moveCostRate);
  if (cost > 0 && sim.money < cost) return { ok: false, message: t('Yeterli para yok ({cost} ₺)', { cost }) };
  sim.moveBuilding(b, x, y, rot);
  if (cost > 0) sim.addExpense('building', cost, t('Taşıma: {name}', { name: t(def.name) }));
  return { ok: true, building: b, cost, message: t('{name} taşındı', { name: t(def.name) }) };
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
  if (valid.length === 0) return { ok: false, message: t('Uygun kare yok') };
  // Malzemeyle öde (0.23.1): önce malzemenin karşıladığı kareler (çit 1 odun, kapı 2 odun, yol 2 kareye 1 taş), kalanı parayla.
  const mat = sim.policies.useMaterials ? def.mat : null;
  const byMat = mat ? Math.min(valid.length, Math.floor(sim.materials[mat.kind] / mat.n) * mat.tiles) : 0;
  const byMoney = Math.min(valid.length - byMat, Math.floor(sim.money / def.cost));
  if (byMat + byMoney <= 0) return { ok: false, message: t('Yeterli para yok') };
  const placed = valid.slice(0, byMat + byMoney);
  const matSet = tool === 'path' ? sim.matPaths : sim.matTiles;
  placed.forEach((p, k) => {
    if (tool === 'path') w.setGround(p.x, p.y, Ground.Path);
    else if (tool === 'gate') w.setObject(p.x, p.y, Obj.Gate);
    else w.setObject(p.x, p.y, Obj.Fence);
    // Malzemeyle konan kare yıkılınca iade vermez; parayla konan (ya da üstüne parayla yeniden konan) verir.
    if (k < byMat) matSet.add(w.idx(p.x, p.y));
    else matSet.delete(w.idx(p.x, p.y));
  });
  const used = mat ? Math.ceil(byMat / mat.tiles) * mat.n : 0;
  if (mat) sim.materials[mat.kind] -= used;
  const cost = byMoney * def.cost;
  const name = t(def.name).toLowerCase();
  sim.addExpense('building', cost, `${placed.length} ${name}`);
  const mats = mat && used > 0 ? matsLabel({ [mat.kind]: used }) : '';
  const n = placed.length;
  const message = !mats ? t('{n} {name} ({cost} ₺)', { n, name, cost }) : cost > 0 ? t('{n} {name} ({mats} + {cost} ₺)', { n, name, mats, cost }) : t('{n} {name} ({mats})', { n, name, mats });
  return { ok: true, count: n, cost, message };
}

/** Yıkım: karedeki bina, çit, kapı ya da yol kaldırılır; ödenenin yarısı iade edilir (malzemeyle konan kare iade vermez). */
export function tryDemolish(sim: Sim, x: number, y: number): BuildResult {
  const w = sim.world;
  const bid = w.buildingIdAt(x, y);
  if (bid !== -1) {
    const b = sim.buildingById(bid);
    if (!b) return { ok: false };
    const def = buildingDef(b);
    if (!def.buildable) return { ok: false, message: t('{name} yıkılamaz', { name: t(def.name) }) };
    // 0.23.1: fiyat değil ödenen esas (malzemeyle ucuza kurup yıkarak para basılmasın); malzemenin yarısı çantaya, üst sınıra kadar.
    const refund = Math.round(b.paid.money * REFUND_RATE);
    const back = { wood: giveMaterial(sim, 'wood', Math.floor(b.paid.wood * REFUND_RATE)), stone: giveMaterial(sim, 'stone', Math.floor(b.paid.stone * REFUND_RATE)) };
    sim.removeBuilding(b.id);
    sim.addIncome('refund', refund, t(def.name));
    const mats = matsLabel(back);
    return {
      ok: true,
      message: mats ? t('{name} yıkıldı (+{refund} ₺, +{mats})', { name: t(def.name), refund, mats }) : t('{name} yıkıldı (+{refund} ₺)', { name: t(def.name), refund }),
    };
  }
  const o = w.objectAt(x, y);
  if (o === Obj.Fence || o === Obj.Gate) {
    const byMat = sim.matTiles.delete(w.idx(x, y));
    w.setObject(x, y, Obj.None);
    if (byMat) return { ok: true, message: t('Kaldırıldı (malzemeyle konduğu için iade yok)') };
    const refund = Math.round(TILE_TOOL_DEFS[o === Obj.Fence ? 'fence' : 'gate'].cost * REFUND_RATE);
    sim.addIncome('refund', refund, t('Çit'));
    return { ok: true, message: t('Kaldırıldı (+{refund} ₺)', { refund }) };
  }
  if (w.groundAt(x, y) === Ground.Path && w.inPlot(x, y)) {
    const byMat = sim.matPaths.delete(w.idx(x, y));
    w.setGround(x, y, Ground.Plot);
    if (!byMat) sim.addIncome('refund', Math.round(TILE_TOOL_DEFS.path.cost * REFUND_RATE), t('Yol'));
    return { ok: true };
  }
  return { ok: false, message: t('Burada yıkılacak bir şey yok') };
}

/** Çantaya malzeme ekler (üst sınırı aşan kısım kaybolur); eklenen miktarı döndürür. */
function giveMaterial(sim: Sim, kind: 'wood' | 'stone', n: number): number {
  const gain = Math.max(0, Math.min(n, BALANCE.materials.max - sim.materials[kind]));
  sim.materials[kind] += gain;
  return gain;
}

/** Kayıttaki malzemeli kareler (0.23.1): arsa içinde ve hâlâ çit/kapı (ya da yol) olanlar kalır. */
export function matTilesFromJSON(raw: unknown, w: TileWorld, layer: 'fence' | 'path'): Set<number> {
  const out = new Set<number>();
  if (!Array.isArray(raw)) return out;
  for (const i of raw) {
    if (!Number.isInteger(i) || i < 0 || i >= w.object.length) continue;
    const x = i % w.width;
    const y = Math.floor(i / w.width);
    if (!w.inPlot(x, y)) continue;
    const o = w.objectAt(x, y);
    if (layer === 'path' ? w.groundAt(x, y) === Ground.Path : o === Obj.Fence || o === Obj.Gate) out.add(i);
  }
  return out;
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
  return { ok: n > 0, count: n, message: n > 0 ? undefined : t('Bölge değişmedi') };
}

/** Arsa genişletme bedeli: kuruluş çekirdeğinden ilk genişletme ucuzdur (0.19.0). */
export function plotExpansionCost(sim: Sim): number {
  const p = sim.world.plot;
  const c = BALANCE.world.plotCore;
  return p.w <= c.w && p.h <= c.h ? BALANCE.world.firstExpansionCost : PLOT_EXPANSION_COST;
}

export type ExpandDir = 'east' | 'south';

/** Arsayı doğuya ya da güneye 16 kare genişletir: alan temizlenir, çit taşınır, yol kapıları açılır. */
export function tryExpandPlot(sim: Sim, dir: ExpandDir): BuildResult {
  const w = sim.world;
  const p = w.plot;
  const step = PLOT_EXPANSION_STEP;
  const next = dir === 'east' ? { x: p.x, y: p.y, w: p.w + step, h: p.h } : { x: p.x, y: p.y, w: p.w, h: p.h + step };
  if (next.w > BALANCE.world.plotMaxW || next.h > BALANCE.world.plotMaxH) return { ok: false, message: t('Arsa bu yönde daha fazla büyüyemez') };
  if (next.x + next.w >= w.width - 3 || next.y + next.h >= w.height - 3) return { ok: false, message: t('Harita kenarına dayandı') };
  const cost = plotExpansionCost(sim);
  if (sim.money < cost) return { ok: false, message: t('Yeterli para yok ({cost} ₺)', { cost }) };

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
  sim.addExpense('land', cost, t('Parsel'));
  sim.stats.built++;
  return { ok: true, cost, message: dir === 'east' ? t('Arsa doğuya genişledi') : t('Arsa güneye genişledi') };
}

function clearFence(sim: Sim, x: number, y: number): void {
  const o = sim.world.objectAt(x, y);
  if (o === Obj.Fence || o === Obj.Gate) {
    sim.world.setObject(x, y, Obj.None);
    sim.matTiles.delete(sim.world.idx(x, y));
  }
}

/** İnşaat sayacı: her sim dakikası binaların kalan süresi düşer. */
export function tickConstruction(sim: Sim, dtMin: number): void {
  for (const b of sim.buildings) {
    if (b.buildLeft <= 0) continue;
    b.buildLeft = Math.max(0, b.buildLeft - dtMin);
    if (b.buildLeft === 0) {
      sim.events.emit('buildingReady', b);
      sim.events.emit('message', t('{name} hazır', { name: t(buildingDef(b).name) }));
    }
  }
}
