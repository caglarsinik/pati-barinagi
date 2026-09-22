import { t } from '../../i18n';
import { clamp100 } from '../entities/Dog';
import type { Sim } from '../Sim';

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  check: (sim: Sim) => boolean;
}

/** Başarım tanımları; metinler Türkçe anahtar, çeviri t() ile. */
export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-egg', name: 'İlk yumurta', desc: 'Dünyada bir yumurta bul.', check: (s) => s.stats.eggsFound >= 1 },
  { id: 'hatch-1', name: 'Çıt çıt', desc: 'İlk yumurtayı çatlat.', check: (s) => s.stats.hatched >= 1 },
  { id: 'hatch-5', name: 'Kuluçka ustası', desc: '5 yumurta çatlat.', check: (s) => s.stats.hatched >= 5 },
  { id: 'stray-1', name: 'Sokak dostu', desc: 'Bir sokak köpeğini evcilleştir.', check: (s) => s.stats.strays >= 1 },
  { id: 'stray-3', name: 'Güven veren', desc: '3 sokak köpeğini barınağa kazandır.', check: (s) => s.stats.strays >= 3 },
  { id: 'dogs-5', name: 'Barınak büyüyor', desc: 'Aynı anda 5 köpeğe bak.', check: (s) => s.shelterDogs().length >= 5 },
  { id: 'dogs-12', name: 'Kalabalık aile', desc: 'Aynı anda 12 köpeğe bak.', check: (s) => s.shelterDogs().length >= 12 },
  { id: 'adopt-1', name: 'Yeni yuva', desc: 'İlk köpeği sahiplendir.', check: (s) => s.stats.adopted >= 1 },
  { id: 'adopt-10', name: 'Çöpçatan', desc: '10 köpek sahiplendir.', check: (s) => s.stats.adopted >= 10 },
  { id: 'adopt-25', name: 'Yuva bulan', desc: '25 köpek sahiplendir.', check: (s) => s.stats.adopted >= 25 },
  { id: 'match-95', name: 'Mükemmel eşleşme', desc: '95 puan ve üstü bir eşleşme yap.', check: (s) => s.adoptions.some((a) => a.score >= 95) },
  { id: 'inspection', name: 'Temiz barınak', desc: 'Haftalık denetimde 1,4 ve üstü çarpan al.', check: (s) => s.weeks.some((w) => (w.inspection?.multiplier ?? 0) >= 1.4) },
  { id: 'rich', name: 'Kasada bereket', desc: '20.000 ₺ biriktir.', check: (s) => s.money >= 20000 },
  { id: 'staff-3', name: 'Tam kadro', desc: '3 personel çalıştır.', check: (s) => s.staff.length >= 3 },
  { id: 'trained-6', name: 'Baş eğitmen', desc: 'Bir köpeğe 6 beceriyi de öğret.', check: (s) => s.shelterDogs().some((d) => d.trainingLevel() >= 6) },
  { id: 'bff', name: 'Can dostlar', desc: 'İki köpek 50 dostluk puanına ulaşsın.', check: (s) => s.shelterDogs().some((d) => Object.values(d.friends).some((v) => v >= 50)) },
  { id: 'walker', name: 'Gezgin dost', desc: 'Tasma bilen köpeklerle 10 gezinti yap.', check: (s) => s.stats.walks >= 10 },
  { id: 'year-shelter', name: 'Yılın Barınağı', desc: '50 sahiplendirme ve 90 itibara ulaş.', check: (s) => s.victory !== null },
  { id: 'lineage-1', name: 'İlk soy', desc: 'Yuva evinden gelen ilk yavru doğsun.', check: (s) => s.stats.bredHatched >= 1 },
  { id: 'lineage-legend', name: 'Efsanevi soy', desc: 'Yuva evinden efsanevi bir yavru doğsun.', check: (s) => s.stats.bredLegendary >= 1 },
  { id: 'healer', name: 'Şifacı', desc: '10 hastalığı tedaviyle geçir.', check: (s) => s.stats.cured >= 10 },
  { id: 'builder', name: 'Mimar', desc: '10 inşaat yap.', check: (s) => s.stats.built >= 10 },
  { id: 'explorer', name: 'Kâşif', desc: 'Haritanın yarısını keşfet.', check: (s) => s.exploredCount >= s.world.width * s.world.height * 0.5 },
  { id: 'legendary', name: 'Efsane', desc: 'Efsanevi bir köpeğe bak.', check: (s) => s.shelterDogs().some((d) => d.genome.rarity === 'legendary') },
  { id: 'senior', name: 'Ak sakal', desc: 'Bir köpek barınağında yaşlansın.', check: (s) => s.shelterDogs().some((d) => d.stage === 'senior') },
  { id: 'year', name: 'Bir yıl', desc: '52 hafta dayan.', check: (s) => s.clock.week >= 53 },
  { id: 'license-3', name: 'Büyük lisans', desc: 'Lisansı 3. seviyeye çıkar.', check: (s) => s.licenseLevel >= 3 },
];

export class AchievementSystem {
  unlocked = new Set<string>();

  constructor(private readonly sim: Sim) {}

  /** Her sim dakikasında; yeni açılanlar duyurulur ve küçük itibar verir. */
  check(): void {
    for (const a of ACHIEVEMENTS) {
      if (this.unlocked.has(a.id)) continue;
      let ok = false;
      try {
        ok = a.check(this.sim);
      } catch {
        ok = false;
      }
      if (!ok) continue;
      this.unlocked.add(a.id);
      this.sim.reputation = clamp100(this.sim.reputation + 1);
      this.sim.events.emit('achievement', a);
      this.sim.events.emit('message', t('Başarım: {name}', { name: t(a.name) }));
    }
  }

  toJSON(): string[] {
    return [...this.unlocked];
  }

  load(data: unknown): void {
    if (!Array.isArray(data)) return;
    const ids = new Set(ACHIEVEMENTS.map((a) => a.id));
    for (const id of data) if (typeof id === 'string' && ids.has(id)) this.unlocked.add(id);
  }
}
