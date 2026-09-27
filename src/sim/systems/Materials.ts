import { BALANCE } from '../../config/balance';
import { Rng, hash3 } from '../../core/Rng';
import { t } from '../../i18n';
import type { TilePos, TileWorld } from '../world/TileWorld';
import { Obj } from '../world/tiles';
import type { Sim } from '../Sim';

/**
 * Odun ve taş (M18, 0.23.0): arsa ve köy dışındaki ağaç, çam, kaya ve kütükten E ile ya da dokunarak toplanır; araçtan
 * bağımsızdır. Ağaç kesilince gövde kütüğe döner, tepe kalkar ve kütük birkaç gün sonra yeniden ağaç olur (ayrı RNG, ana
 * sıra değişmez). Kaya ve doğal kütük bir kez toplanır. Otopilot toplamaz (`MANUAL_ACTIONS`).
 */
export type MaterialKind = 'wood' | 'stone';
export type HarvestKind = 'chop' | 'mine' | 'uproot';

export interface Materials {
  wood: number;
  stone: number;
}

/** Kesilen ağacın kütüğü: yeniden ağaç olacağı gün ve türü. */
export interface Regrow {
  day: number;
  pine: boolean;
}

export interface Harvest {
  kind: HarvestKind;
  /** Hedef kare: ağaçta gövde (tepesine bakılsa da). */
  tile: TilePos;
  material: MaterialKind;
  /** Verim (çanta üst sınırından önce). */
  amount: number;
  stamina: number;
  pine: boolean;
}

function inVillage(w: TileWorld, x: number, y: number): boolean {
  const v = w.village;
  return !!v && x >= v.x && y >= v.y && x < v.x + v.w && y < v.y + v.h;
}

const isTrunk = (o: Obj): boolean => o === Obj.TreeTrunk || o === Obj.PineTrunk;

/** Ağaç tepesi karesi mi (altında gövde olan)? Tepeye dokunuş ya da bakış gövdeyi hedefler. */
export function isTreeTop(w: TileWorld, x: number, y: number): boolean {
  const o = w.objectAt(x, y);
  return (o === Obj.TreeTop || o === Obj.PineTop) && isTrunk(w.objectAt(x, y + 1));
}

/** Karede toplanabilecek şey; arsa ve köyde yok. */
export function harvestAt(w: TileWorld, x: number, y: number): Harvest | null {
  if (isTreeTop(w, x, y)) y += 1;
  if (w.inPlot(x, y) || inVillage(w, x, y)) return null;
  const M = BALANCE.materials;
  const tile = { x, y };
  switch (w.objectAt(x, y)) {
    case Obj.TreeTrunk:
      return { kind: 'chop', tile, material: 'wood', amount: M.treeWood, stamina: M.chopStamina, pine: false };
    case Obj.PineTrunk:
      return { kind: 'chop', tile, material: 'wood', amount: M.pineWood, stamina: M.chopStamina, pine: true };
    case Obj.Rock:
      return { kind: 'mine', tile, material: 'stone', amount: M.rockStone, stamina: M.mineStamina, pine: false };
    case Obj.Stump:
      return { kind: 'uproot', tile, material: 'wood', amount: M.stumpWood, stamina: M.uprootStamina, pine: false };
    default:
      return null;
  }
}

/** E'nin ipucu: yapılabiliyorsa iş ve verim. */
export function harvestHint(h: Harvest): string {
  switch (h.kind) {
    case 'chop':
      return h.pine ? t('E: çamı kes (+{n} odun)', { n: h.amount }) : t('E: ağacı kes (+{n} odun)', { n: h.amount });
    case 'mine':
      return t('E: kayayı kır (+{n} taş)', { n: h.amount });
    default:
      return t('E: kütüğü sök (+{n} odun)', { n: h.amount });
  }
}

/** Neden yapılamıyor (ipucu ve E ortak); yapılabiliyorsa null. */
export function harvestIssue(sim: Sim, h: Harvest): string | null {
  const max = BALANCE.materials.max;
  if (sim.materials[h.material] >= max) return h.material === 'wood' ? t('Odun deposu dolu ({n})', { n: max }) : t('Taş deposu dolu ({n})', { n: max });
  if (sim.player.stamina < h.stamina) return t('Çok yorgunsun: biraz soluklan');
  return null;
}

/**
 * Toplar: malzeme çantaya (üst sınıra kadar), dünya değişir (gövde kütüğe döner ve tepe kalkar; kaya ve kütük kalkar),
 * dayanıklılık düşer. Kesilen ağacın kütüğü yeniden büyüme sırasına girer; kütük sökülünce sıradan çıkar. Toplanan miktar.
 */
export function harvest(sim: Sim, h: Harvest): number {
  const w = sim.world;
  const M = BALANCE.materials;
  const { x, y } = h.tile;
  const gain = Math.min(h.amount, M.max - sim.materials[h.material]);
  if (gain <= 0) return 0;
  sim.materials[h.material] += gain;
  sim.player.stamina = Math.max(0, sim.player.stamina - h.stamina);
  const i = w.idx(x, y);
  if (h.kind === 'chop') {
    w.setObject(x, y, Obj.Stump);
    const top = w.objectAt(x, y - 1);
    if (top === Obj.TreeTop || top === Obj.PineTop) w.setObject(x, y - 1, Obj.None);
    const rng = new Rng(hash3(sim.seed, i, 0x7ee ^ sim.clock.day));
    sim.regrow.set(i, { day: sim.clock.day + rng.int(M.regrowDaysMin, M.regrowDaysMax), pine: h.pine });
    sim.stats.chopped++;
  } else {
    w.setObject(x, y, Obj.None);
    // Kesilen ağacın kütüğü sökülünce yeniden büyümez.
    sim.regrow.delete(i);
    if (h.kind === 'mine') sim.stats.mined++;
    else sim.stats.uprooted++;
  }
  if (h.material === 'wood') sim.stats.woodGathered += gain;
  else sim.stats.stoneGathered += gain;
  return gain;
}

/**
 * Gün başı: günü gelen kütükler yeniden ağaç olur. Üst kare (tepenin yeri) doluysa ertesi gün yeniden denenir; kare arsaya
 * katıldıysa ya da kütük artık yoksa sıradan çıkar.
 */
export function tickRegrow(sim: Sim, day: number): void {
  const w = sim.world;
  for (const [i, r] of sim.regrow) {
    if (r.day > day) continue;
    const x = i % w.width;
    const y = Math.floor(i / w.width);
    if (w.objectAt(x, y) !== Obj.Stump || w.inPlot(x, y) || inVillage(w, x, y)) {
      sim.regrow.delete(i);
      continue;
    }
    const topFree = y > 0 && w.objectAt(x, y - 1) === Obj.None && w.buildingIdAt(x, y - 1) === -1 && !w.inPlot(x, y - 1) && !inVillage(w, x, y - 1);
    if (!topFree) {
      r.day = day + 1;
      continue;
    }
    w.setObject(x, y, r.pine ? Obj.PineTrunk : Obj.TreeTrunk);
    w.setObject(x, y - 1, r.pine ? Obj.PineTop : Obj.TreeTop);
    sim.regrow.delete(i);
  }
}

/** Kayıt: [kare, gün, çam(0/1), …] düz dizi. */
export function regrowToJSON(regrow: ReadonlyMap<number, Regrow>): number[] {
  const out: number[] = [];
  for (const [i, r] of regrow) out.push(i, r.day, r.pine ? 1 : 0);
  return out;
}

export function regrowFromJSON(data: unknown, cells: number): Map<number, Regrow> {
  const m = new Map<number, Regrow>();
  if (!Array.isArray(data)) return m;
  for (let k = 0; k + 2 < data.length; k += 3) {
    const [i, day, pine] = [data[k], data[k + 1], data[k + 2]];
    if (!Number.isInteger(i) || i < 0 || i >= cells || typeof day !== 'number' || !Number.isFinite(day)) continue;
    m.set(i as number, { day: Math.floor(day), pine: pine === 1 });
  }
  return m;
}

/** Kayıttan gelen çanta malzemeleri (eski kayıtta 0). */
export function materialsFromJSON(data: unknown): Materials {
  const src = (data && typeof data === 'object' ? data : {}) as Partial<Record<MaterialKind, unknown>>;
  const read = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(BALANCE.materials.max, Math.floor(v))) : 0);
  return { wood: read(src.wood), stone: read(src.stone) };
}
