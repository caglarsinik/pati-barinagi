import { type Building, isReady, kennelRestTile } from '../entities/Building';
import type { Dog } from '../entities/Dog';
import { KENNEL_FURNITURE } from '../interior/Interiors';
import type { Sim } from '../Sim';

/**
 * Kulübe eşyalarının etkileri (0.22.4). Sayılar `BALANCE.kennelComfort`; kancalar NeedsSystem (uyku enerjisi, uykuda
 * kirlenme ve susama, keyif düşüşü), ClinicSystem.illnessChanceMul (battaniye), Sim.decorScore (pencere) ve haftalık
 * denetimin "Konfor" kalemi. Yatak köpeğin kulübedeki sırasına göredir (büyük kulübede tek yatak ilk köpeğin); gerisi ortak.
 */
export interface KennelComfort {
  bed: boolean;
  blanket: boolean;
  bowl: boolean;
  toy: boolean;
  window: boolean;
  /** Köpeğe işleyen eşya sayısı (0–5). */
  count: number;
}

const NONE: KennelComfort = { bed: false, blanket: false, bowl: false, toy: false, window: false, count: 0 };

function isKennel(b: Building): boolean {
  return b.type === 'kennelSmall' || b.type === 'kennelLarge';
}

/** Köpeğin kulübesindeki eşyalar; kulübesizse ya da kulübe hazır değilse hepsi yok. */
export function kennelComfort(sim: Sim, dog: Dog): KennelComfort {
  if (dog.kennelId === null) return NONE;
  const k = sim.buildingById(dog.kennelId);
  if (!k || k.furniture.length === 0 || !isReady(k)) return NONE;
  const slot = k.occupants.indexOf(dog.id);
  const beds = k.furniture.filter((f) => f === 'dogBed').length;
  const bed = slot >= 0 && beds > slot;
  const blanket = k.furniture.includes('blanket');
  const bowl = k.furniture.includes('dogBowl');
  const toy = k.furniture.includes('dogToy');
  const window = k.furniture.includes('kennelWindow');
  return { bed, blanket, bowl, toy, window, count: [bed, blanket, bowl, toy, window].filter(Boolean).length };
}

/** Köpek kendi kulübesinin eşiğinde (yatış karesinde) mi? Yatak, battaniye ve su kabı yalnız orada uyurken işler. */
export function atKennelRest(sim: Sim, dog: Dog): boolean {
  if (dog.kennelId === null) return false;
  const k = sim.buildingById(dog.kennelId);
  if (!k) return false;
  const rest = kennelRestTile(k, k.occupants.indexOf(dog.id));
  return dog.tileX === rest.x && dog.tileY === rest.y;
}

/** Kulübede kaç çeşit eşya var (0–5; büyük kulübenin ikinci yatağı çeşit saymaz). */
export function kennelFurnishing(b: Building): number {
  return KENNEL_FURNITURE.filter((f) => b.furniture.includes(f)).length;
}

/** Hazır kulübelerin ortalama döşenmişliği (0–1); kulübe yoksa null. Haftalık denetimin "Konfor" kalemi. */
export function furnishedRatio(sim: Sim): number | null {
  const kennels = sim.buildings.filter((b) => isKennel(b) && isReady(b));
  if (kennels.length === 0) return null;
  return kennels.reduce((s, b) => s + kennelFurnishing(b), 0) / (kennels.length * KENNEL_FURNITURE.length);
}
