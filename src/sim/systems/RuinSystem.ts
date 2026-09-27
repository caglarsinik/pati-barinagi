import { BALANCE } from '../../config/balance';
import { Rng, hash3 } from '../../core/Rng';
import { t } from '../../i18n';
import { createEgg, eggDescription } from '../entities/Egg';
import type { Rect, TilePos } from '../world/TileWorld';
import { RUIN_ID, reachableFrom, ruinDoorTile } from '../world/Ruin';
import { Biome, Obj } from '../world/tiles';
import type { Sim } from '../Sim';
import type { ActionOutcome } from './Interaction';
import { DIRECTION_NAMES_TR } from './QuestSystem';

/**
 * Terk edilmiş ev (M18, 0.23.2): keşif, köylü ipucu ve evdeki bulgular. Sandık bir kez para ve nadir bir yumurta verir
 * (çanta doluysa yumurta sandıkta bekler), dolaptaki keskin aletler ağaçtan ve kayadan fazladan malzeme sağlar, günlük Nuri
 * Usta'nın hikâyesini anlatır ve gizli yuvayı haritaya işler (ilk yumurtası efsanevi). Bütün rastgelelik ayrı RNG'lerle.
 */
export interface RuinState {
  found: boolean;
  /** Sandık: 0 kapalı, 1 para alındı ve yumurta çantada yer bekliyor, 2 boş. */
  chest: number;
  /** Dolaptaki keskin balta ve kazma alındı. */
  tools: boolean;
  /** Günlük okundu (gizli yuva açıldı). */
  journal: boolean;
  /** Günlükteki gizli yuva (ilk yumurtası efsanevi). */
  nest: TilePos | null;
}

export function defaultRuinState(): RuinState {
  return { found: false, chest: 0, tools: false, journal: false, nest: null };
}

/** Nuri Usta'nın günlüğü (üç sayfa). */
export const JOURNAL_PAGES_TR: readonly string[] = [
  "Bu barınağı kırk yıl önce köyün sokak köpekleri için kurdum. İlk köpeğim Karabaş'tı; kapının önünde uyur, beni herkesten önce karşılardı.",
  "Yıllar geçti, dizlerim tutmaz oldu. Barınağı belediyeye bırakıp bu eve çekildim. Ormanın sesi havlamaya benzemiyor ama alıştım.",
  "Karabaş'ın soyu hâlâ bu ormanda yaşıyor. Yuvalarını haritama işaretledim: ilk yumurtayı bulan efsanevi bir dost edinecek. Barınağa iyi bak.",
];

export function ruinStateFromJSON(raw: unknown, inBounds: (x: number, y: number) => boolean): RuinState {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof RuinState, unknown>>;
  const n = s.nest as Partial<TilePos> | null | undefined;
  const nest = n && Number.isInteger(n.x) && Number.isInteger(n.y) && inBounds(n.x!, n.y!) ? { x: n.x!, y: n.y! } : null;
  const chest = typeof s.chest === 'number' && Number.isFinite(s.chest) ? Math.max(0, Math.min(2, Math.floor(s.chest))) : 0;
  const journal = s.journal === true;
  return { found: s.found === true || journal || chest > 0 || s.tools === true, chest, tools: s.tools === true, journal, nest: journal ? nest : null };
}

/** Keşif: evin `foundRadius` karesine yaklaşınca bir kez duyurulur. */
export function checkRuinFound(sim: Sim): void {
  const site = sim.world.ruin;
  if (!site || sim.ruin.found) return;
  const p = sim.player;
  if (Math.hypot(p.x - (site.x + site.w / 2), p.y - (site.y + site.h / 2)) > BALANCE.ruin.foundRadius) return;
  sim.ruin.found = true;
  sim.events.emit('message', t("🏚️ Ormanda terk edilmiş bir ev buldun: eski barınakçı Nuri Usta'nın evi"));
}

/** Evin barınağa (arsa merkezine) göre yönü: "kuzeydoğu" gibi. */
export function ruinDirection(sim: Sim): string {
  const site = sim.world.ruin;
  if (!site) return '';
  const p = BALANCE.world.plot;
  const a = Math.atan2(site.y + site.h / 2 - (p.y + p.h / 2), site.x + site.w / 2 - (p.x + p.w / 2));
  return t(DIRECTION_NAMES_TR[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8]);
}

/** Köylünün ipucu: ev daha bulunmadıysa yönüyle; bulunduysa null. */
export function ruinTalkLine(sim: Sim): string | null {
  if (!sim.world.ruin || sim.ruin.found) return null;
  return t("Eski barınakçı Nuri Usta'nın evi barınaktan {dir} yönünde, ormanın içindeymiş. Yıllardır kimse uğramamış.", { dir: ruinDirection(sim) });
}

/** Sandıktaki yumurta: her oyunda aynı (ayrı RNG), yalnız alındığı an kimlik alır. */
function chestEgg(sim: Sim) {
  return createEgg(sim.nextId++, new Rng(hash3(sim.seed, RUIN_ID, 0xc4e57)), 'rare', sim.clock.day);
}

/** Sandık: ilk açışta para; yumurta çantada yer varsa hemen, yoksa sonraki açışta. */
export function openRuinChest(sim: Sim): ActionOutcome {
  const R = sim.ruin;
  if (R.chest >= 2) return { ok: false, message: t('Sandık boş') };
  const room = sim.backpack.length < sim.backpackSlots();
  let money = 0;
  if (R.chest === 0) {
    money = BALANCE.ruin.chestMoney;
    sim.addIncome('event', money, t("Nuri Usta'nın sandığı"));
    R.chest = 1;
  }
  if (!room) {
    return { ok: money > 0, message: money > 0 ? t('💰 Sandıktan {n} ₺ çıktı. Dipte bir yumurta var: çantada yer aç.', { n: money }) : t('Çanta dolu: yumurtayı almak için yer aç') };
  }
  const egg = chestEgg(sim);
  sim.backpack.push(egg);
  sim.stats.eggsFound++;
  R.chest = 2;
  sim.player.setBusy(0.7, 'pick');
  return {
    ok: true,
    message: money > 0 ? t('💰 Sandıktan {n} ₺ ve bir yumurta çıktı: {desc}', { n: money, desc: eggDescription(egg) }) : t('Sandıktaki yumurtayı aldın: {desc}', { desc: eggDescription(egg) }),
  };
}

/** Dolap: keskin balta ve kazma (ağaç ve kayadan +1). */
export function openRuinCabinet(sim: Sim): ActionOutcome {
  if (sim.ruin.tools) return { ok: false };
  sim.ruin.tools = true;
  sim.player.setBusy(0.7, 'pick');
  return { ok: true, message: t('🪓 Keskin bir balta ve kazma buldun: ağaçtan ve kayadan +{n}', { n: BALANCE.ruin.toolBonus }) };
}

/** Günlük: her okuyuşta sayfalar açılır; ilk okuyuşta gizli yuva haritaya işlenir. */
export function readRuinJournal(sim: Sim): ActionOutcome {
  if (sim.ruin.journal) return { ok: true, open: 'journal' };
  sim.ruin.journal = true;
  const spot = hiddenNestSpot(sim);
  if (!spot) return { ok: true, open: 'journal' };
  sim.world.setObject(spot.x, spot.y, Obj.NestEggs);
  if (!sim.world.nests.some((n) => n.x === spot.x && n.y === spot.y)) sim.world.nests.push({ ...spot });
  sim.ruin.nest = spot;
  return { ok: true, open: 'journal', message: t('📜 Günlüğün son sayfasında bir yuva işaretli: haritada mor nokta') };
}

function inRect(r: Rect, x: number, y: number, pad: number): boolean {
  return x >= r.x - pad && y >= r.y - pad && x < r.x + r.w + pad && y < r.y + r.h + pad;
}

/**
 * Gizli yuvanın yeri: kapıdan `nestMinDist`–`nestMaxDist` kare, yürünerek ulaşılan boş ve geçilebilir kara karesi; açıklık,
 * en büyük arsa ve köyün dışında, başka yuva ve inlerden en az `nestClear` kare uzakta. Aynı dünyada hep aynı kare (karma sırası).
 */
export function hiddenNestSpot(sim: Sim): TilePos | null {
  const w = sim.world;
  const site = w.ruin;
  if (!site) return null;
  const R = BALANCE.ruin;
  const door = ruinDoorTile(site);
  const reach = reachableFrom(w, door, R.nestMaxDist + 2);
  const gen = BALANCE.world.plot;
  const maxPlot: Rect = { x: gen.x, y: gen.y, w: BALANCE.world.plotMaxW, h: BALANCE.world.plotMaxH };
  const near = (list: readonly TilePos[], x: number, y: number): boolean => list.some((n) => Math.hypot(n.x - x, n.y - y) < R.nestClear);
  let best: { i: number; h: number } | null = null;
  for (let y = door.y - R.nestMaxDist; y <= door.y + R.nestMaxDist; y++) {
    for (let x = door.x - R.nestMaxDist; x <= door.x + R.nestMaxDist; x++) {
      if (!w.inBounds(x, y)) continue;
      const d = Math.hypot(x - door.x, y - door.y);
      if (d < R.nestMinDist || d > R.nestMaxDist) continue;
      const i = w.idx(x, y);
      if (!reach[i] || w.object[i] !== Obj.None || w.isSolid(x, y)) continue;
      const b = w.biome[i] as Biome;
      if (b !== Biome.Forest && b !== Biome.Meadow && b !== Biome.Hills && b !== Biome.Flowers) continue;
      if (inRect(site.clearing, x, y, 1) || inRect(maxPlot, x, y, 2) || (w.village && inRect(w.village, x, y, 2))) continue;
      if (near(w.nests, x, y) || near(w.dens, x, y)) continue;
      const h = hash3(sim.seed, i, 0x9e57) >>> 0;
      if (!best || h < best.h) best = { i, h };
    }
  }
  return best ? { x: best.i % w.width, y: Math.floor(best.i / w.width) } : null;
}

/** Gizli yuvanın ilk yumurtası mı (efsanevi)? */
export function isHiddenNestFirst(sim: Sim, x: number, y: number, harvests: number): boolean {
  const n = sim.ruin.nest;
  return harvests === 0 && n !== null && n.x === x && n.y === y;
}
