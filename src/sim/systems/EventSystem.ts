import { BALANCE } from '../../config/balance';
import { t } from '../../i18n';
import { tameTreatsFor } from './Interaction';
import { type Dog, clamp100 } from '../entities/Dog';
import type { TilePos } from '../world/TileWorld';
import { Obj } from '../world/tiles';
import type { Sim } from '../Sim';
import { runInspection } from './EconomySystem';

export interface GameEvent {
  day: number;
  key: string;
  text: string;
}

export interface Escape {
  dogId: number;
  day: number;
}

/**
 * Rastgele olaylar: belirli saatlerde zar atılır. Hepsi mesaj ve olay kaydı üretir;
 * bazıları para/itibar değiştirir, kaçan köpek dünyaya salınır.
 */
export class EventSystem {
  log: GameEvent[] = [];
  escapes: Escape[] = [];

  constructor(private readonly sim: Sim) {}

  private record(key: string, text: string): void {
    this.log.push({ day: this.sim.clock.day, key, text });
    if (this.log.length > 30) this.log.shift();
    this.sim.events.emit('gameEvent', { day: this.sim.clock.day, key, text });
    this.sim.events.emit('message', text);
  }

  onHour(h: number): void {
    const sim = this.sim;
    const E = BALANCE.events;
    const rng = sim.rng;
    const dogs = sim.shelterDogs();
    switch (h) {
      case 8:
        if (rng.chance(E.newspaperChance) && sim.stats.adopted >= 1) {
          sim.reputation = clamp100(sim.reputation + 5);
          sim.flags.extraAdoptersDay = sim.clock.day + 1;
          this.record('newspaper', t('Gazete barınağı yazdı: itibar +5, yarın daha çok ziyaretçi bekle.'));
        }
        break;
      case 9:
        if (sim.clock.weekday !== 0 && dogs.length > 0 && rng.chance(E.inspectionChance)) this.surpriseInspection();
        break;
      case 11:
        if (rng.chance(E.donationChance + sim.reputation / 1000)) {
          const amount = Math.round((100 + sim.reputation * 6 + rng.int(0, 200)) / 10) * 10;
          sim.addIncome('donation', amount, t('Bağış'));
          this.record('donation', t('Bir hayırsever {amount} ₺ bağışladı!', { amount }));
        }
        break;
      case 14:
        if (rng.chance(E.discountChance)) {
          sim.flags.foodDiscountDay = sim.clock.day;
          this.record('discount', t('Yem toptancısında indirim: bugün çuvallar yarı fiyatına.'));
        }
        break;
      case 16:
        if (rng.chance(E.vetChance) && dogs.some((d) => d.needs.health < 80)) {
          let healed = 0;
          for (const d of dogs) {
            if (d.needs.health < 90) {
              d.needs.health = 90;
              healed++;
            }
          }
          this.record('vet', t('Gezici veteriner uğradı: {n} köpek ücretsiz muayene edildi.', { n: healed }));
        }
        break;
      case 23:
        this.maybeEscape();
        break;
      default:
        break;
    }
    if (h === 6) this.checkLostEscapes();
  }

  private surpriseInspection(): void {
    const sim = this.sim;
    const E = BALANCE.events;
    const report = runInspection(sim);
    if (report.multiplier >= 1.1) {
      const bonus = report.dogsCounted * E.inspectionBonusPerDog;
      sim.addIncome('aid', bonus, t('Sürpriz denetim ödülü'));
      sim.reputation = clamp100(sim.reputation + 3);
      this.record('inspection', t('Sürpriz denetim: müfettiş çok memnun kaldı (+{bonus} ₺, itibar +3).', { bonus }));
    } else if (report.multiplier <= 0.8) {
      sim.addExpense('upkeep', E.inspectionFine, t('Sürpriz denetim cezası'));
      sim.reputation = clamp100(sim.reputation - 3);
      this.record('inspection', t('Sürpriz denetim: eksikler bulundu, {fine} ₺ ceza ve itibar -3.', { fine: E.inspectionFine }));
    } else {
      this.record('inspection', t('Sürpriz denetim geçildi; müfettiş notlar aldı.'));
    }
  }

  /** Güveni düşük bir köpek gece kaçabilir; dışarıda bir yere saklanır. */
  private maybeEscape(): void {
    const sim = this.sim;
    const E = BALANCE.events;
    // "Bekle" bilen köpek kaçmaz; cesur köpek daha kolay kaçar.
    const candidates = sim.shelterDogs().filter((d) => d.needs.loyalty < E.escapeLoyaltyBelow && !d.isAsleep() && !d.walking && d.skills.stay < 100);
    for (const dog of candidates) {
      const chance = E.escapeChancePerDog * (dog.genome.temperament === 'bold' ? BALANCE.dogs.temperament.boldEscapeMul : 1);
      if (!sim.rng.chance(chance)) continue;
      const spot = this.hideSpot();
      if (!spot) return;
      sim.assignKennel(dog, null);
      dog.wild = true;
      dog.following = false;
      dog.trust = tameTreatsFor(dog) - 1;
      dog.den = { ...spot };
      dog.x = spot.x + 0.5;
      dog.y = spot.y + 0.5;
      dog.path = [];
      dog.state = 'idle';
      dog.stateTimer = 0;
      this.escapes.push({ dogId: dog.id, day: sim.clock.day });
      this.record('escape', t('{name} çitten atlayıp kaçtı! Böğürtlen ödülüyle geri getir, {days} gün içinde bulmazsan gider.', { name: dog.name, days: E.escapeDays }));
      return;
    }
  }

  /** Kapıya yakın, arsa dışında, yürünebilir bir saklanma yeri. */
  private hideSpot(): TilePos | null {
    const w = this.sim.world;
    const p = w.plot;
    const rng = this.sim.rng;
    for (let tries = 0; tries < 60; tries++) {
      const side = rng.int(0, 3);
      const dist = rng.int(8, 16);
      let x = p.x + rng.int(0, p.w - 1);
      let y = p.y + rng.int(0, p.h - 1);
      if (side === 0) y = p.y - dist;
      else if (side === 1) y = p.y + p.h + dist;
      else if (side === 2) x = p.x - dist;
      else x = p.x + p.w + dist;
      if (!w.inBounds(x, y) || w.isSolid(x, y) || w.objectAt(x, y) !== Obj.None || w.inPlot(x, y)) continue;
      return { x, y };
    }
    return null;
  }

  /** Süresi dolan kaçaklar bir daha bulunamaz. */
  private checkLostEscapes(): void {
    const sim = this.sim;
    const E = BALANCE.events;
    for (const e of [...this.escapes]) {
      const dog = sim.dogById(e.dogId);
      if (!dog || !dog.wild) {
        this.escapes = this.escapes.filter((x) => x !== e);
        continue;
      }
      if (sim.clock.day - e.day >= E.escapeDays) {
        sim.removeDog(dog.id);
        sim.reputation = clamp100(sim.reputation - 2);
        this.escapes = this.escapes.filter((x) => x !== e);
        this.record('lost', t('{name} bulunamadı; başka bir yere gitmiş olmalı (itibar -2).', { name: dog.name }));
      }
    }
  }

  /** Kaçak geri gelince listeden düşer. */
  onDogJoined(dog: Dog): void {
    this.escapes = this.escapes.filter((e) => e.dogId !== dog.id);
  }

  toJSON(): { log: GameEvent[]; escapes: Escape[] } {
    return { log: [...this.log], escapes: [...this.escapes] };
  }

  load(data: unknown): void {
    const d = data as { log?: GameEvent[]; escapes?: Escape[] } | null;
    if (!d) return;
    if (Array.isArray(d.log)) this.log = d.log.filter((e) => e && typeof e.day === 'number' && typeof e.text === 'string').slice(-30);
    if (Array.isArray(d.escapes)) this.escapes = d.escapes.filter((e) => e && typeof e.dogId === 'number' && typeof e.day === 'number');
  }
}
