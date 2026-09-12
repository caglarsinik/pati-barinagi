import { BALANCE } from '../../config/balance';
import { type Building, buildingDef, isReady, kennelRestTile } from '../entities/Building';
import { type Dog, clamp100 } from '../entities/Dog';
import type { Facing } from '../entities/Player';
import { findPath } from '../world/Pathfinder';
import type { TilePos } from '../world/TileWorld';
import { Obj, Zone } from '../world/tiles';
import type { Sim } from '../Sim';
import { placeMess } from './MessSystem';

/**
 * Köpek davranışı: ihtiyaçlara göre hedef seçer, yol bulur, yürür, eylemi yapar.
 * Kararlar durum bitince ya da her `decisionIntervalMin` dakikada bir yeniden verilir.
 */
export class DogBrain {
  constructor(private readonly sim: Sim) {}

  update(dtMin: number): void {
    for (const dog of this.sim.dogs) this.updateDog(dog, dtMin);
  }

  private updateDog(dog: Dog, dtMin: number): void {
    dog.stateTimer -= dtMin;
    dog.moving = false;
    switch (dog.state) {
      case 'toBowl':
      case 'toToilet':
      case 'toKennel':
      case 'toToy':
      case 'wander':
        this.followPath(dog, dtMin);
        if (dog.path.length === 0) this.onArrive(dog);
        else if (dog.stateTimer <= 0) this.decide(dog); // takıldıysa yeniden düşün
        break;
      case 'eat':
        if (dog.stateTimer <= 0) this.finishEat(dog);
        break;
      case 'toilet':
        if (dog.stateTimer <= 0) this.finishToilet(dog);
        break;
      case 'play':
        if (dog.stateTimer <= 0) {
          const toy = dog.targetBuildingId !== null ? this.sim.buildingById(dog.targetBuildingId) : null;
          const gain = toy ? (buildingDef(toy).playGain ?? BALANCE.dogs.selfPlayGain) : BALANCE.dogs.selfPlayGain;
          dog.needs.play = clamp100(dog.needs.play + gain);
          this.setIdle(dog, 5);
        }
        break;
      case 'sleep':
        if (this.shouldWake(dog)) this.setIdle(dog, 1);
        break;
      case 'interact':
        if (dog.stateTimer <= 0) this.setIdle(dog, 1);
        break;
      case 'sit':
      case 'lie':
      case 'idle':
      default:
        if (dog.stateTimer <= 0) this.decide(dog);
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Karar
  // ---------------------------------------------------------------------------

  decide(dog: Dog): void {
    const sim = this.sim;
    const n = dog.needs;
    const clock = sim.clock;
    const B = BALANCE.dogs;

    // Gece ya da bitkinlik: kulübeye git, uyu.
    if ((clock.isNight() && n.energy < 95) || n.energy < B.sleepBelowEnergy) {
      if (dog.kennelId !== null) {
        const kennel = sim.buildingById(dog.kennelId);
        if (kennel) {
          const rest = kennelRestTile(kennel, kennel.occupants.indexOf(dog.id));
          if (dog.tileX === rest.x && dog.tileY === rest.y) {
            this.setState(dog, 'sleep', 0);
            return;
          }
          if (this.goTo(dog, rest, 'toKennel', kennel.id)) return;
        }
      }
      this.setState(dog, 'sleep', 0);
      return;
    }

    // Açlık: dolu bir kap bul.
    if (n.hunger >= B.eatAboveHunger) {
      const bowl = this.findBowl(dog);
      if (bowl && this.goTo(dog, { x: bowl.x, y: bowl.y }, 'toBowl', bowl.id)) return;
    }

    // Tuvalet.
    if (n.bladder >= B.toiletAboveBladder) {
      if (dog.isPottyTrained()) {
        const target = this.nearestZoneTile(dog, Zone.Toilet);
        if (target && this.goTo(dog, target, 'toToilet')) return;
      }
      this.setState(dog, 'toilet', B.toiletDurationMin);
      return;
    }

    // Can sıkıntısı: oyuncak ya da oyun bahçesi.
    if (n.play < B.selfPlayBelow) {
      const toy = this.nearestToy(dog);
      if (toy && this.goTo(dog, { x: toy.x, y: toy.y }, 'toToy', toy.id)) return;
      const yard = this.randomZoneTile(dog, Zone.Play);
      if (yard && this.goTo(dog, yard, 'wander')) return;
    }

    // Boş zaman.
    const r = sim.rng.next();
    if (n.energy < 40 && r < 0.6) {
      this.setState(dog, 'lie', sim.rng.int(15, 40));
      return;
    }
    if (r < 0.5) {
      const target = this.randomWanderTarget(dog);
      if (target && this.goTo(dog, target, 'wander')) return;
      this.setState(dog, 'sit', sim.rng.int(5, 15));
    } else if (r < 0.75) {
      this.setState(dog, 'sit', sim.rng.int(8, 20));
    } else {
      this.setState(dog, 'lie', sim.rng.int(10, 30));
    }
  }

  private onArrive(dog: Dog): void {
    const B = BALANCE.dogs;
    switch (dog.state) {
      case 'toBowl': {
        const bowl = dog.targetBuildingId !== null ? this.sim.buildingById(dog.targetBuildingId) : null;
        if (bowl && bowl.food > 0) {
          this.setState(dog, 'eat', B.eatDurationMin);
          dog.facing = 0;
        } else this.setIdle(dog, 2);
        break;
      }
      case 'toToilet':
        this.setState(dog, 'toilet', B.toiletDurationMin);
        break;
      case 'toKennel':
        this.setState(dog, 'sleep', 0);
        break;
      case 'toToy':
        this.setState(dog, 'play', B.selfPlayDurationMin);
        break;
      case 'wander':
      default:
        this.setIdle(dog, this.sim.rng.int(2, 8));
        break;
    }
  }

  private finishEat(dog: Dog): void {
    const bowl = dog.targetBuildingId !== null ? this.sim.buildingById(dog.targetBuildingId) : null;
    if (bowl && bowl.food > 0) {
      const want = dog.portion();
      const eaten = Math.min(want, bowl.food);
      bowl.food = Math.max(0, bowl.food - eaten);
      const ratio = eaten / want;
      dog.needs.hunger = clamp100(dog.needs.hunger - BALANCE.dogs.mealHungerRelief * ratio);
      dog.needs.bladder = clamp100(dog.needs.bladder + BALANCE.dogs.bladderAfterMeal * ratio);
      this.sim.stats.fed++;
    }
    dog.targetBuildingId = null;
    this.setIdle(dog, 3);
  }

  private finishToilet(dog: Dog): void {
    dog.needs.bladder = 0;
    const inToiletZone = this.sim.world.zoneAt(dog.tileX, dog.tileY) === Zone.Toilet;
    if (!inToiletZone) {
      placeMess(this.sim, dog.tileX, dog.tileY);
      this.sim.stats.messes++;
    }
    this.setIdle(dog, 2);
  }

  private shouldWake(dog: Dog): boolean {
    const clock = this.sim.clock;
    if (dog.needs.energy >= 100 && !clock.isNight()) return true;
    if (!clock.isNight() && dog.needs.energy > 60) return true;
    if (dog.needs.hunger > 90 && dog.needs.energy > 30) return true;
    return false;
  }

  // ---------------------------------------------------------------------------
  // Hareket
  // ---------------------------------------------------------------------------

  /** Hedefe yol bulup yürüme durumuna geçer. Yol yoksa false. */
  private goTo(dog: Dog, target: TilePos, state: Dog['state'], buildingId: number | null = null): boolean {
    const from = { x: dog.tileX, y: dog.tileY };
    const path = findPath(this.sim.world, from, target, { region: this.sim.world.plotInterior(), maxNodes: 4000 });
    if (!path) return false;
    dog.path = path;
    dog.targetBuildingId = buildingId;
    // Yürüme için üst sınır: yol uzunluğuna göre; takılırsa yeniden karar verilir.
    this.setState(dog, state, Math.max(10, (path.length / dog.speed()) * 2 + 5));
    if (path.length === 0) this.onArrive(dog);
    return true;
  }

  private followPath(dog: Dog, dtMin: number): void {
    let budget = dog.speed() * dtMin;
    while (budget > 0 && dog.path.length > 0) {
      const next = dog.path[0];
      const tx = next.x + 0.5;
      const ty = next.y + 0.5;
      const dx = tx - dog.x;
      const dy = ty - dog.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= budget) {
        dog.x = tx;
        dog.y = ty;
        budget -= dist;
        dog.path.shift();
        this.onTileChanged(dog);
      } else {
        dog.x += (dx / dist) * budget;
        dog.y += (dy / dist) * budget;
        budget = 0;
      }
      if (Math.abs(dx) >= Math.abs(dy)) dog.facing = (dx < 0 ? 1 : 2) as Facing;
      else dog.facing = (dy < 0 ? 3 : 0) as Facing;
      dog.moving = true;
    }
    if (dog.moving) dog.animTime += dtMin;
  }

  private onTileChanged(dog: Dog): void {
    const w = this.sim.world;
    const i = w.idx(dog.tileX, dog.tileY);
    if (i === dog.lastTileIdx) return;
    dog.lastTileIdx = i;
    if (w.object[i] === Obj.Mess) dog.needs.hygiene = clamp100(dog.needs.hygiene - BALANCE.dogs.needs.hygieneMessPenalty);
  }

  // ---------------------------------------------------------------------------
  // Yardımcılar
  // ---------------------------------------------------------------------------

  private setState(dog: Dog, state: Dog['state'], minutes: number): void {
    dog.state = state;
    dog.stateTimer = minutes;
    if (state !== 'toBowl' && state !== 'toToilet' && state !== 'toKennel' && state !== 'toToy' && state !== 'wander') dog.path = [];
  }

  private setIdle(dog: Dog, minutes: number): void {
    dog.targetBuildingId = null;
    this.setState(dog, 'idle', minutes);
  }

  /** En yakın hazır oyuncak. */
  private nearestToy(dog: Dog): Building | null {
    let best: Building | null = null;
    let bestD = Infinity;
    for (const b of this.sim.buildings) {
      if (buildingDef(b).playGain === undefined || !isReady(b)) continue;
      const d = Math.hypot(b.x + 0.5 - dog.x, b.y + 0.5 - dog.y);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
  }

  private randomZoneTile(dog: Dog, zone: Zone): TilePos | null {
    const tiles = this.sim.world.zoneTiles(zone).filter((t) => !this.sim.world.isSolid(t.x, t.y));
    if (tiles.length === 0) return null;
    const t = tiles[this.sim.rng.int(0, tiles.length - 1)];
    return dog.tileX === t.x && dog.tileY === t.y ? null : t;
  }

  /** En yakın dolu ve hazır kap. */
  private findBowl(dog: Dog): Building | null {
    let best: Building | null = null;
    let bestD = Infinity;
    for (const b of this.sim.buildings) {
      if (b.type !== 'bowl' || b.food <= 0 || !isReady(b)) continue;
      const d = Math.hypot(b.x + 0.5 - dog.x, b.y + 0.5 - dog.y);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
  }

  private nearestZoneTile(dog: Dog, zone: Zone): TilePos | null {
    let best: TilePos | null = null;
    let bestD = Infinity;
    for (const t of this.sim.world.zoneTiles(zone)) {
      if (this.sim.world.isSolid(t.x, t.y)) continue;
      const d = Math.hypot(t.x + 0.5 - dog.x, t.y + 0.5 - dog.y);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    return best;
  }

  private randomWanderTarget(dog: Dog): TilePos | null {
    const w = this.sim.world;
    const r = w.plotInterior();
    for (let tries = 0; tries < 8; tries++) {
      const x = dog.tileX + this.sim.rng.int(-6, 6);
      const y = dog.tileY + this.sim.rng.int(-6, 6);
      if (x < r.x || y < r.y || x >= r.x + r.w || y >= r.y + r.h) continue;
      if (w.isSolid(x, y) || w.buildingIdAt(x, y) !== -1) continue;
      return { x, y };
    }
    return null;
  }
}
