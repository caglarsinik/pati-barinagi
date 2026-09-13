import { BALANCE } from '../../config/balance';
import { type Dog, clamp100 } from '../entities/Dog';
import type { Sim } from '../Sim';
import { Zone } from '../world/tiles';
import type { WeatherModifiers } from './WeatherSystem';

/** İhtiyaçların zamanla değişimi. Davranış (yeme, tuvalet) DogBrain'de; burada sadece sürekli akış var. */
export class NeedsSystem {
  constructor(private readonly sim: Sim) {}

  update(dtMin: number): void {
    const dtH = dtMin / 60;
    const wm = this.sim.weatherSys.modifiers();
    for (const dog of this.sim.dogs) if (!dog.wild) this.updateDog(dog, dtH, wm);
  }

  private updateDog(dog: Dog, dtH: number, wm: WeatherModifiers): void {
    const B = BALANCE.dogs.needs;
    const S = BALANCE.dogs.senior;
    const senior = dog.stage === 'senior';
    const n = dog.needs;
    const asleep = dog.isAsleep();
    const night = this.sim.clock.isNight();

    const hungerRate = (dog.stage === 'puppy' ? B.hungerPerHourPuppy : dog.genome.size === 'L' ? B.hungerPerHourLarge : B.hungerPerHour) * wm.hunger;
    n.hunger = clamp100(n.hunger + hungerRate * (asleep ? 0.5 : 1) * dtH);
    n.thirst = clamp100(n.thirst + B.thirstPerHour * wm.thirst * (asleep ? 0.4 : 1) * dtH);

    let playRate = dog.genome.temperament === 'playful' ? B.playDecayPerHour * 1.3 : dog.genome.temperament === 'calm' ? B.playDecayPerHour * 0.75 : B.playDecayPerHour;
    if (senior) playRate *= S.playDecayMul;
    if (!asleep) {
      const inYard = this.sim.world.zoneAt(dog.tileX, dog.tileY) === Zone.Play;
      n.play = clamp100(n.play - playRate * dtH + (inYard ? B.playYardGainPerHour * wm.playYard * dtH : 0));
    }

    n.bladder = clamp100(n.bladder + B.bladderPerHour * (asleep ? 0.4 : 1) * dtH);
    n.hygiene = clamp100(n.hygiene - B.hygieneDecayPerHour * (asleep ? 1 : wm.hygiene) * dtH);

    if (asleep) n.energy = clamp100(n.energy + B.energyRegenPerHour * (dog.kennelId === null ? 0.5 : 1) * dtH);
    else n.energy = clamp100(n.energy - (night ? B.energyDecayPerHour * 2 : B.energyDecayPerHour) * wm.energy * dtH);

    if (n.hunger > B.healthDropHungerAbove || n.hygiene < B.healthDropHygieneBelow) {
      n.health = clamp100(n.health - B.healthDropPerHour * (senior ? S.healthDecayMul : 1) * dtH);
    } else if (n.hunger < 60 && n.thirst < 70 && n.hygiene > 50 && n.play > 30) {
      n.health = clamp100(n.health + B.healthRegenPerHour * (senior ? S.healthRegenMul : 1) * dtH);
    }
    if (n.thirst > B.thirstHarmAbove) n.health = clamp100(n.health - B.thirstHarmPerHour * dtH);
    // Soğuk: kulübesiz köpek gece üşür.
    if (wm.cold > 0 && night && dog.kennelId === null) n.health = clamp100(n.health - wm.cold * dtH);
  }

  /** Gün değişince: ilgisiz kalan köpeklerin sadakati düşer, sevme sayacı sıfırlanır. */
  onDay(day: number): void {
    for (const dog of this.sim.dogs) {
      if (dog.wild) continue;
      dog.petsToday = 0;
      if (day - dog.lastInteractionDay >= 2) dog.needs.loyalty = clamp100(dog.needs.loyalty - BALANCE.dogs.needs.loyaltyDecayPerDay);
    }
  }
}
