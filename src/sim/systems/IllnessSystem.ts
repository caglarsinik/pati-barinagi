import { BALANCE } from '../../config/balance';
import { type Dog, ILLNESS_NAMES_TR, type IllnessKind } from '../entities/Dog';
import { Zone } from '../world/tiles';
import type { Sim } from '../Sim';
import { effectiveMessCount } from './MessSystem';
import { t } from '../../i18n';

/**
 * Hastalıklar: pire (kirlilik), soğuk algınlığı (kulübesiz + soğuk/yağış), mide (pislik).
 * Günde bir başlangıç zarı, saatte bir bulaşma zarı. Karantina bölgesi bulaşmayı iki yönde keser.
 * Tedavi (oyuncu, veteriner, gezici veteriner) hastalığı siler; bakımsız kalırsa birkaç günde kendiliğinden geçer.
 */
export class IllnessSystem {
  constructor(private readonly sim: Sim) {}

  /** Gün başı: yeni hastalık zarları, kendiliğinden iyileşme. */
  onDay(): void {
    const sim = this.sim;
    const I = BALANCE.dogs.illness;
    const season = sim.weatherSys.season;
    const weather = sim.weatherSys.weather;
    const coldWeather = season === 'winter' || weather === 'rain' || weather === 'storm' || weather === 'snow';
    const messy = effectiveMessCount(sim) > I.stomachMessAbove;
    for (const dog of sim.shelterDogs()) {
      if (dog.illness) {
        dog.illness.days++;
        if (dog.illness.days >= I.selfHealDays) {
          const name = t(ILLNESS_NAMES_TR[dog.illness.kind]);
          dog.illness = null;
          sim.events.emit('message', t('{name} kendiliğinden iyileşti ({illness})', { name: dog.name, illness: name }));
        }
        continue;
      }
      if (dog.needs.hygiene < I.fleaHygieneBelow && sim.rng.chance(I.fleaChance)) {
        this.infect(dog, 'flea');
        continue;
      }
      if (dog.kennelId === null && coldWeather && sim.rng.chance(I.coldChance)) {
        this.infect(dog, 'cold');
        continue;
      }
      if (messy && sim.rng.chance(I.stomachChance)) this.infect(dog, 'stomach');
    }
  }

  /** Saat başı: hasta köpekten yakındaki sağlıklı köpeğe bulaşma; karantina sınırı geçirmez. */
  onHour(): void {
    const sim = this.sim;
    const I = BALANCE.dogs.illness;
    const dogs = sim.shelterDogs();
    const sick = dogs.filter((d) => d.illness !== null);
    if (sick.length === 0) return;
    for (const s of sick) {
      const kind = s.illness!.kind;
      const rate = I.spreadPerHour[kind];
      if (rate <= 0) continue;
      const sq = this.inQuarantine(s);
      for (const other of dogs) {
        if (other === s || other.illness || other.walking) continue;
        if (Math.hypot(other.x - s.x, other.y - s.y) > I.spreadRadius) continue;
        if (this.inQuarantine(other) !== sq) continue;
        if (sim.rng.chance(rate)) this.infect(other, kind, s);
      }
    }
  }

  inQuarantine(dog: Dog): boolean {
    return this.sim.world.zoneAt(dog.tileX, dog.tileY) === Zone.Quarantine;
  }

  infect(dog: Dog, kind: IllnessKind, from?: Dog): void {
    if (dog.illness) return;
    dog.illness = { kind, days: 0 };
    this.sim.stats.illnesses++;
    const illness = t(ILLNESS_NAMES_TR[kind]);
    this.sim.events.emit('emote', { kind: 'dog', id: dog.id, emote: 'thermo', seconds: 3 });
    this.sim.events.emit(
      'message',
      from ? t('{name} hastalandı: {illness} ({from} bulaştırdı)', { name: dog.name, illness, from: from.name }) : t('{name} hastalandı: {illness}', { name: dog.name, illness }),
    );
  }

  /** Tedavi hastalığı siler. Hastalık yoksa false. */
  cure(dog: Dog): boolean {
    if (!dog.illness) return false;
    const illness = t(ILLNESS_NAMES_TR[dog.illness.kind]);
    dog.illness = null;
    this.sim.stats.cured++;
    this.sim.events.emit('message', t('{name} iyileşti: {illness}', { name: dog.name, illness }));
    return true;
  }
}
