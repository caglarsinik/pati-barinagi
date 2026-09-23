import type { TilePos } from '../world/TileWorld';
import type { GrowthStage } from './Dog';
import type { DogGenome } from './DogGenome';
import type { Facing } from './Player';

/** Köylü rolü (0.20.1): çizelgeyi ve iş yerini belirler. */
export type VillagerRole = 'clerk' | 'shopkeeper' | 'elder' | 'child' | 'gardener' | 'walker';

/** Köylünün bulunabileceği yerler: ev ve iş yeri içeride (görünmez), öbürleri dışarıda. `park` 0.20.2 (köpeğiyle). */
export type VillagerPlace = 'home' | 'work' | 'spot' | 'spot2' | 'plaza' | 'park';

export const VILLAGER_ROLE_NAMES_TR: Record<VillagerRole, string> = {
  clerk: 'toptancı çırağı',
  shopkeeper: 'dükkâncı',
  elder: 'köyün yaşlısı',
  child: 'köyün çocuğu',
  gardener: 'bahçıvan',
  walker: 'gezgin',
};

/** Köylünün barınaktan sahiplendiği köpek (0.20.2): sahiplendirme kaydından gelir. */
export interface VillageDog {
  name: string;
  genome: DogGenome;
  stage: GrowthStage;
}

/** Köyde yaşayan bir kişi. Kaydedilmez: tohumdan kurulur, yeri saatten çıkar. */
export class Villager {
  /** Ayak noktası (kare birimi). */
  x = 0;
  y = 0;
  facing: Facing = 0;
  moving = false;
  /** Evde ya da iş yerinde (görünmez). */
  inside = true;
  /** Vardığı yer; yoldayken null. */
  place: VillagerPlace | null = null;
  /** Çizelgeye göre gitmesi gereken yer. */
  target: VillagerPlace = 'home';
  path: TilePos[] = [];
  pathed = false;
  /** Kaç kez konuşuldu (satırlar sırayla gelir). */
  talks = 0;

  constructor(
    readonly index: number,
    readonly name: string,
    readonly role: VillagerRole,
    /** Görünüm tohumu (insan dokusu). */
    readonly look: number,
    /** Evi: köy yapısı indeksi. */
    readonly home: number,
    /** İş yeri: köy yapısı indeksi (yoksa null). */
    readonly work: number | null,
  ) {}
}
