import { BALANCE } from '../../config/balance';
import { Rng, hash3 } from '../../core/Rng';
import { t } from '../../i18n';
import type { Facing } from '../entities/Player';
import { Villager, type VillagerPlace, type VillagerRole } from '../entities/Villager';
import type { Sim } from '../Sim';
import { findPath } from '../world/Pathfinder';
import type { Rect, TilePos } from '../world/TileWorld';
import { type VillageKind, villageDoorTile } from '../world/Village';

interface Slot {
  /** Bu saatten itibaren (0–23). İlk dilimden önce evde. */
  from: number;
  place: VillagerPlace;
}

interface RoleDef {
  weekdays: Slot[];
  /** Pazar günü (pazar tezgâhının kurulduğu gün) çizelgesi. */
  sunday: Slot[];
  work?: VillageKind;
  /** Köy dikdörtgenine göre dış noktalar. */
  spot: [number, number];
  spot2?: [number, number];
  plaza: [number, number];
}

/** Rol çizelgeleri (0.20.1). Noktalar köyün meydanında ya da çevresinde yürünebilir karelerdir (testte denetlenir). */
const ROLES: Record<VillagerRole, RoleDef> = {
  clerk: {
    work: 'wholesaler',
    weekdays: [
      { from: 7, place: 'work' },
      { from: 17, place: 'spot' },
      { from: 19, place: 'home' },
    ],
    sunday: [
      { from: 10, place: 'plaza' },
      { from: 16, place: 'home' },
    ],
    spot: [18, 8],
    plaza: [5, 9],
  },
  shopkeeper: {
    work: 'toyShop',
    weekdays: [
      { from: 8, place: 'work' },
      { from: 18, place: 'home' },
    ],
    sunday: [
      { from: 11, place: 'plaza' },
      { from: 15, place: 'home' },
    ],
    spot: [19, 6],
    plaza: [9, 9],
  },
  elder: {
    weekdays: [
      { from: 9, place: 'spot' },
      { from: 12, place: 'home' },
      { from: 14, place: 'spot' },
      { from: 18, place: 'home' },
    ],
    sunday: [
      { from: 10, place: 'plaza' },
      { from: 17, place: 'home' },
    ],
    spot: [15, 8],
    plaza: [8, 10],
  },
  child: {
    weekdays: [
      { from: 9, place: 'spot' },
      { from: 11, place: 'spot2' },
      { from: 12, place: 'home' },
      { from: 13, place: 'spot2' },
      { from: 15, place: 'spot' },
      { from: 17, place: 'home' },
    ],
    sunday: [
      { from: 10, place: 'plaza' },
      { from: 13, place: 'spot' },
      { from: 16, place: 'home' },
    ],
    spot: [13, 8],
    spot2: [14, 5],
    plaza: [6, 10],
  },
  gardener: {
    weekdays: [
      { from: 7, place: 'spot' },
      { from: 11, place: 'home' },
      { from: 15, place: 'spot' },
      { from: 19, place: 'home' },
    ],
    sunday: [
      { from: 10, place: 'plaza' },
      { from: 16, place: 'home' },
    ],
    spot: [8, 12],
    plaza: [14, 6],
  },
  walker: {
    weekdays: [
      { from: 8, place: 'spot' },
      { from: 10, place: 'home' },
      { from: 16, place: 'spot2' },
      { from: 18, place: 'home' },
    ],
    sunday: [
      { from: 10, place: 'plaza' },
      { from: 16, place: 'home' },
    ],
    spot: [12, 1],
    spot2: [17, 9],
    plaza: [19, 9],
  },
};

const ROLE_ORDER: readonly VillagerRole[] = ['clerk', 'shopkeeper', 'elder', 'child', 'gardener', 'walker'];
/** Rol sırasıyla ev: köydeki evlerin sırası (0, 1, 2). */
const HOME_OF: readonly number[] = [0, 1, 2, 0, 2, 1];

const NAMES = ['Ayşe Teyze', 'Hasan Amca', 'Elif', 'Mehmet', 'Zeynep', 'Mustafa', 'Fatma Nine', 'Ali', 'Emine', 'Kerem', 'Selin', 'Yusuf Dede'];

/** Konuşma satırları: ipucu ve köy dedikodusu (0.20.1). */
export const TALK_LINES: readonly string[] = [
  'Toptancıda çuvallar ucuz; en az üç çuval alman gerekiyor.',
  'Pazar günleri meydanda tezgâh kurulur, oyuncaklar indirimli olur.',
  'Vitamin alan köpek o gün pek hastalanmaz derler.',
  'İnlerde sokak köpekleri yaşıyor; ödül mamasıyla güvenlerini kazanırsın.',
  'Kuluçkaya ısı lambası koyarsan yumurtalar daha çabuk çatlar.',
  'Sabahları çeşmenin suyu buz gibi oluyor.',
  'Fırtınada yola çıkma, çabuk yorulursun.',
  'Yuva evinde iki dost köpek eşleşirse yavruları soylu olur.',
  'Bisikletle köy yolu çabuk biter; dükkânda satılıyor.',
  'Bir gün barınağından bir köpek sahiplenmek istiyorum.',
];

function facingFor(dx: number, dy: number): Facing {
  if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? 1 : 2;
  return dy < 0 ? 3 : 0;
}

/**
 * Köylüler (0.20.1): köy bulununca tohumdan kurulur (ana RNG'ye dokunmaz, kaydedilmez). Sabah evden iş yerine ya da
 * meydandaki noktalarına gider, akşam eve döner; Pazar meydanda toplanır. Oyuncu köyün yakınındayken yol bularak adım adım
 * yürürler, uzaktayken saate göre yerlerine yerleşirler.
 */
export class VillagerSystem {
  readonly list: Villager[] = [];

  constructor(private readonly sim: Sim) {}

  /** Köy bulunduysa köylüleri kurar ve saate göre yerleştirir. */
  private ensure(): boolean {
    if (this.list.length > 0) return true;
    const sim = this.sim;
    const w = sim.world;
    if (!sim.villageFound || !w.village) return false;
    const houses = w.villageBuildings.filter((b) => b.kind === 'house').map((b) => b.index);
    if (houses.length === 0) return false;
    const rng = new Rng(hash3(sim.seed, 0x7111a9e, 0));
    const pool = [...NAMES];
    ROLE_ORDER.forEach((role, i) => {
      const name = pool.splice(rng.int(0, pool.length - 1), 1)[0];
      const def = ROLES[role];
      const work = def.work ? (w.villageBuildings.find((b) => b.kind === def.work)?.index ?? null) : null;
      const home = houses[HOME_OF[i] % houses.length];
      const v = new Villager(i, name, role, hash3(sim.seed, 0x100c, i) >>> 0, home, work);
      this.list.push(v);
      this.settle(v, this.scheduled(v));
    });
    return true;
  }

  /** Çizelgeye göre şu an olması gereken yer. */
  scheduled(v: Villager): VillagerPlace {
    const c = this.sim.clock;
    const def = ROLES[v.role];
    const slots = c.weekday === BALANCE.shop.marketWeekday ? def.sunday : def.weekdays;
    let place: VillagerPlace = 'home';
    for (const s of slots) if (c.hour >= s.from) place = s.place;
    if ((place === 'work' && v.work === null) || (place === 'spot2' && !def.spot2)) place = 'spot';
    return place;
  }

  /** Yerin karesi: ev ve iş yerinde kapı önü, öbürlerinde köydeki nokta. */
  placeTile(v: Villager, place: VillagerPlace): TilePos | null {
    const w = this.sim.world;
    const r = w.village;
    if (!r) return null;
    const def = ROLES[v.role];
    if (place === 'home' || place === 'work') {
      const idx = place === 'home' ? v.home : v.work;
      const vb = idx === null ? undefined : w.villageBuildings[idx];
      return vb ? villageDoorTile(vb) : null;
    }
    const rel = place === 'spot' ? def.spot : place === 'spot2' ? def.spot2 : def.plaza;
    return rel ? { x: r.x + rel[0], y: r.y + rel[1] } : null;
  }

  update(dtMin: number): void {
    if (!this.ensure()) return;
    const near = this.playerNear();
    for (const v of this.list) this.updateOne(v, dtMin, near);
  }

  private region(): Rect | undefined {
    const r = this.sim.world.village;
    return r ? { x: r.x - 1, y: r.y - 1, w: r.w + 2, h: r.h + 2 } : undefined;
  }

  /** Oyuncu köyün yakınında mı (içeride değil). */
  private playerNear(): boolean {
    const r = this.sim.world.village;
    if (!r || this.sim.interior) return false;
    const p = this.sim.player;
    const cx = Math.max(r.x, Math.min(p.x, r.x + r.w));
    const cy = Math.max(r.y, Math.min(p.y, r.y + r.h));
    return Math.hypot(p.x - cx, p.y - cy) <= BALANCE.villagers.nearTiles;
  }

  private updateOne(v: Villager, dtMin: number, near: boolean): void {
    const want = this.scheduled(v);
    if (want !== v.target) {
      v.target = want;
      v.path = [];
      v.pathed = false;
    }
    if (v.place === v.target) {
      v.moving = false;
      return;
    }
    const dest = this.placeTile(v, v.target);
    if (!near || !dest) {
      this.settle(v, v.target);
      return;
    }
    if (!v.pathed) {
      v.pathed = true;
      // Evden ya da işten çıkış: kapı önünde belirir.
      v.inside = false;
      const path = findPath(this.sim.world, { x: Math.floor(v.x), y: Math.floor(v.y) }, dest, { region: this.region(), maxNodes: 4000 });
      if (!path) {
        this.settle(v, v.target);
        return;
      }
      v.path = path;
      v.place = null;
    }
    let budget = BALANCE.villagers.speed * dtMin;
    while (budget > 0 && v.path.length > 0) {
      const n = v.path[0];
      const tx = n.x + 0.5;
      const ty = n.y + 0.6;
      const dx = tx - v.x;
      const dy = ty - v.y;
      const d = Math.hypot(dx, dy);
      if (d > 0) v.facing = facingFor(dx, dy);
      if (d <= budget) {
        v.x = tx;
        v.y = ty;
        budget -= d;
        v.path.shift();
      } else {
        v.x += (dx / d) * budget;
        v.y += (dy / d) * budget;
        budget = 0;
      }
    }
    v.moving = v.path.length > 0;
    if (v.path.length === 0) this.settle(v, v.target);
  }

  private settle(v: Villager, place: VillagerPlace): void {
    const tile = this.placeTile(v, place);
    if (tile) {
      v.x = tile.x + 0.5;
      v.y = tile.y + 0.6;
    }
    v.place = place;
    v.target = place;
    v.inside = place === 'home' || place === 'work';
    v.path = [];
    v.pathed = false;
    v.moving = false;
    if (!v.inside) v.facing = 0;
  }

  /** (x, y) noktasında görünen köylü (gövde merkezine uzaklık). */
  at(x: number, y: number, reach: number = BALANCE.villagers.talkReach): Villager | null {
    let best: Villager | null = null;
    let bestD = reach;
    for (const v of this.list) {
      if (v.inside) continue;
      const d = Math.hypot(v.x - x, v.y - 0.35 - y);
      if (d <= bestD) {
        best = v;
        bestD = d;
      }
    }
    return best;
  }

  /** E ile konuş: köylü oyuncuya döner, sıradaki satırı söyler. */
  talk(index: number): { ok: boolean; message?: string } {
    const v = this.list[index];
    if (!v || v.inside) return { ok: false };
    const p = this.sim.player;
    v.facing = facingFor(p.x - v.x, p.y - v.y);
    const base = hash3(this.sim.seed, v.index, this.sim.clock.day) >>> 0;
    const line = TALK_LINES[(base + v.talks++) % TALK_LINES.length];
    return { ok: true, message: t('{name}: “{line}”', { name: v.name, line: t(line) }) };
  }
}
