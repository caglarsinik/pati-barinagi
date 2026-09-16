import { BALANCE } from '../../config/balance';
import { type Building, buildingDef, buildingDoorTile, isReady, kennelRestTile } from '../entities/Building';
import { type Dog, clamp100 } from '../entities/Dog';
import type { Facing } from '../entities/Player';
import { findPath } from '../world/Pathfinder';
import type { TilePos } from '../world/TileWorld';
import { Zone } from '../world/tiles';
import type { Sim } from '../Sim';
import { messHygienePenalty, placeMess } from './MessSystem';
import { t } from '../../i18n';

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
    if (dog.walking) {
      // Gezintide dışarıda rahatlama: pislik bırakmaz, kısa durur.
      if (dog.state === 'toilet') {
        if (dog.stateTimer <= 0) {
          dog.needs.bladder = 0;
          this.setState(dog, 'idle', 0);
        }
        return;
      }
      if (dog.walkReturning) this.returnHome(dog, dtMin);
      else this.followPlayer(dog, dtMin);
      return;
    }
    if (dog.wild) {
      this.updateWild(dog, dtMin);
      return;
    }
    if (this.maybeFlee(dog, dtMin)) return;
    switch (dog.state) {
      case 'toBowl':
      case 'toTrough':
      case 'toToilet':
      case 'toKennel':
      case 'toQuarantine':
      case 'toToy':
      case 'wander':
        this.followPath(dog, dtMin);
        if (dog.path.length === 0) this.onArrive(dog);
        else if (dog.stateTimer <= 0) this.decide(dog); // takıldıysa yeniden düşün
        break;
      case 'eat':
        if (dog.stateTimer <= 0) this.finishEat(dog);
        break;
      case 'drink':
        if (dog.stateTimer <= 0) this.finishDrink(dog);
        break;
      case 'toilet':
        if (dog.stateTimer <= 0) this.finishToilet(dog);
        break;
      case 'play':
        if (dog.stateTimer <= 0) {
          const toy = dog.targetBuildingId !== null ? this.sim.buildingById(dog.targetBuildingId) : null;
          const gain = toy ? (buildingDef(toy).playGain ?? BALANCE.dogs.selfPlayGain) : BALANCE.dogs.selfPlayGain;
          dog.needs.play = clamp100(dog.needs.play + gain);
          dog.needs.thirst = clamp100(dog.needs.thirst + BALANCE.dogs.needs.thirstAfterPlay * 0.5);
          this.setIdle(dog, 5);
        }
        break;
      case 'sleep':
        if (this.shouldWake(dog)) this.setIdle(dog, 1);
        break;
      case 'interact':
        if (dog.stateTimer <= 0) this.setIdle(dog, 1);
        break;
      case 'toFriend':
        this.followPath(dog, dtMin);
        if (dog.path.length === 0) this.arriveAtFriend(dog);
        else if (dog.stateTimer <= 0) {
          this.cancelPlaydate(dog);
          this.decide(dog);
        }
        break;
      case 'waitFriend': {
        const mate = dog.playmateId !== null ? this.sim.dogById(dog.playmateId) : undefined;
        if (!mate || mate.playmateId !== dog.id || dog.stateTimer <= 0) {
          this.cancelPlaydate(dog);
          this.setIdle(dog, 2);
        }
        break;
      }
      case 'playTogether':
        if (dog.stateTimer <= 0) this.finishPlayTogether(dog);
        break;
      case 'growl':
      case 'bark':
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
  // Vahşi köpek: ininin çevresinde oyalanır, evcilleşince oyuncuyu izler
  // ---------------------------------------------------------------------------

  private updateWild(dog: Dog, dtMin: number): void {
    if (dog.following) {
      this.followPlayer(dog, dtMin);
      return;
    }
    if (dog.state === 'wander') {
      this.followPath(dog, dtMin);
      if (dog.path.length === 0 || dog.stateTimer <= 0) this.setState(dog, 'sit', this.sim.rng.int(3, 10));
      return;
    }
    if (dog.stateTimer > 0) return;
    const p = this.sim.player;
    const den = dog.den ?? { x: dog.tileX, y: dog.tileY };
    const nearPlayer = Math.hypot(p.x - dog.x, p.y - dog.y) < 5;
    if (nearPlayer) {
      // Oyuncuya dön ve merakla bekle.
      const dx = p.x - dog.x;
      const dy = p.y - dog.y;
      dog.facing = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 1 : 2) : dy < 0 ? 3 : 0;
      this.setState(dog, 'sit', 2);
      return;
    }
    const r = this.sim.rng.next();
    if (r < 0.45) {
      const w = this.sim.world;
      for (let tries = 0; tries < 6; tries++) {
        const tx = den.x + this.sim.rng.int(-3, 3);
        const ty = den.y + this.sim.rng.int(-3, 3);
        if (!w.inBounds(tx, ty) || w.isSolid(tx, ty)) continue;
        const path = findPath(w, { x: dog.tileX, y: dog.tileY }, { x: tx, y: ty }, {
          region: { x: den.x - 6, y: den.y - 6, w: 13, h: 13 },
          maxNodes: 400,
        });
        if (!path) continue;
        dog.path = path;
        this.setState(dog, 'wander', 20);
        return;
      }
      this.setState(dog, 'sit', this.sim.rng.int(4, 12));
    } else if (r < 0.75) this.setState(dog, 'sit', this.sim.rng.int(5, 15));
    else this.setState(dog, 'lie', this.sim.rng.int(8, 25));
  }

  private followPlayer(dog: Dog, dtMin: number): void {
    const sim = this.sim;
    const p = sim.player;
    const w = sim.world;
    const inside = w.inPlotInterior(dog.tileX, dog.tileY);
    if (dog.walking) {
      if (!inside) dog.walkLeftPlot = true;
      else if (dog.walkLeftPlot) {
        sim.finishWalk(dog);
        return;
      }
    } else if (inside) {
      sim.joinShelter(dog);
      this.setIdle(dog, 1);
      return;
    }
    if (dog.walking && !inside && dog.needs.bladder >= BALANCE.dogs.toiletAboveBladder) {
      this.setState(dog, 'toilet', BALANCE.dogs.toiletDurationMin);
      dog.path = [];
      return;
    }
    const dist = Math.hypot(p.x - dog.x, p.y - 0.3 - dog.y);
    if (dist > BALANCE.eggs.followCatchUpDistance) {
      // Çok geride kaldı: oyuncunun yanına ışınla.
      const spot = this.freeTileNear(p.tileX, p.tileY) ?? { x: p.tileX, y: p.tileY };
      dog.x = spot.x + 0.5;
      dog.y = spot.y + 0.5;
      dog.path = [];
      return;
    }
    if (dist > 1.6) {
      if (dog.path.length === 0 || dog.stateTimer <= 0) {
        const path = findPath(w, { x: dog.tileX, y: dog.tileY }, { x: p.tileX, y: p.tileY }, { maxNodes: 2500, adjacentOk: true, throughGates: true });
        dog.path = path ?? [];
        dog.stateTimer = 1.5;
      }
      if (dog.path.length > 0) this.followPath(dog, dtMin);
      return;
    }
    dog.path = [];
    const dx = p.x - dog.x;
    const dy = p.y - dog.y;
    dog.facing = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 1 : 2) : dy < 0 ? 3 : 0;
  }

  private freeTileNear(x: number, y: number): TilePos | null {
    const w = this.sim.world;
    for (let r = 1; r <= 3; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (!w.isSolid(x + dx, y + dy)) return { x: x + dx, y: y + dy };
        }
      }
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Karar
  // ---------------------------------------------------------------------------

  decide(dog: Dog): void {
    const sim = this.sim;
    const n = dog.needs;
    const clock = sim.clock;
    const B = BALANCE.dogs;
    const S = B.social;
    const TP = B.temperament;
    const temper = dog.genome.temperament;

    // Gece ya da bitkinlik: kulübeye git, uyu (dolu mesane geceyi erteler, tuvalet dalına düşer).
    const mustPee = n.bladder >= B.toiletAboveBladder && n.energy > B.wakeForToiletEnergyAbove;
    if ((clock.isNight() && n.energy < 95 && !mustPee) || n.energy < B.sleepBelowEnergy) {
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

    // Karantina: bulaşıcı hastalığı olan köpek politika açıksa alanda kalır (acil ihtiyaçlar hariç).
    if (dog.illness && sim.policies.quarantineSick) {
      const inQ = sim.world.zoneAt(dog.tileX, dog.tileY) === Zone.Quarantine;
      const urgent = n.thirst >= B.drinkAboveThirst || n.hunger >= B.eatAboveHunger || n.bladder >= B.toiletAboveBladder;
      if (!urgent) {
        if (inQ) {
          this.setState(dog, sim.rng.next() < 0.6 ? 'lie' : 'sit', sim.rng.int(10, 30));
          return;
        }
        const target = this.nearestZoneTile(dog, Zone.Quarantine);
        if (target && this.goTo(dog, target, 'toQuarantine')) return;
      }
    }

    // Susuzluk: dolu bir yalak bul (açlıktan önce; su daha çabuk zarar verir).
    if (n.thirst >= B.drinkAboveThirst) {
      const trough = this.findTrough(dog);
      if (trough && this.goTo(dog, { x: trough.x, y: trough.y }, 'toTrough', trough.id)) return;
    }

    // Açlık: dolu bir kap bul.
    if (n.hunger >= B.eatAboveHunger) {
      const bowl = this.findBowl(dog);
      if (bowl && this.goTo(dog, { x: bowl.x, y: bowl.y }, 'toBowl', bowl.id)) return;
    }

    // Tuvalet: eğitim yüzdesi kadar olasılıkla tuvalet alanına gider (0 ve 100'de zar atılmaz).
    if (n.bladder >= B.toiletAboveBladder) {
      const p = dog.skills.potty / 100;
      const useArea = p >= 1 || (p > 0 && this.sim.rng.chance(p));
      if (useArea) {
        const target = this.nearestZoneTile(dog, Zone.Toilet);
        if (target && this.goTo(dog, target, 'toToilet')) return;
      }
      this.setState(dog, 'toilet', B.toiletDurationMin);
      return;
    }

    // Dost oyunu: yakında oynamak isteyen bir köpek varsa birlikte oynarlar.
    if (n.play < S.seekBelowPlay && n.energy >= B.playMinEnergy && this.startPlaydate(dog)) return;

    // Can sıkıntısı: oyuncak ya da oyun bahçesi (oyuncu huylu daha erken arar).
    if (n.play < (temper === 'playful' ? TP.playfulSelfPlayBelow : B.selfPlayBelow)) {
      const toy = this.nearestToy(dog);
      if (toy && this.goTo(dog, { x: toy.x, y: toy.y }, 'toToy', toy.id)) return;
      const yard = this.randomZoneTile(dog, Zone.Play);
      if (yard && this.goTo(dog, yard, 'wander')) return;
    }

    // Havlama: sıkıldı ya da aç ve çaresi yok.
    if ((n.play < S.barkPlayBelow || n.hunger > S.barkHungerAbove) && sim.rng.chance(S.barkChance)) {
      this.setState(dog, 'bark', S.barkDurationMin);
      return;
    }

    // Boş zaman.
    const r = sim.rng.next();
    if (n.energy < 40 && r < 0.6) {
      this.setState(dog, 'lie', sim.rng.int(15, 40));
      return;
    }
    const lieBias = temper === 'calm' ? TP.calmLieMul : 1;
    if (r < 0.5 / lieBias) {
      const target = this.randomWanderTarget(dog);
      if (target && this.goTo(dog, target, 'wander')) return;
      this.setState(dog, 'sit', sim.rng.int(5, 15));
    } else if (r < 0.75 / lieBias) {
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
      case 'toTrough': {
        const trough = dog.targetBuildingId !== null ? this.sim.buildingById(dog.targetBuildingId) : null;
        if (trough && trough.water > 0) {
          this.setState(dog, 'drink', B.drinkDurationMin);
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
      case 'toQuarantine':
        this.setState(dog, 'lie', this.sim.rng.int(10, 30));
        break;
      case 'toToy':
        this.setState(dog, 'play', B.selfPlayDurationMin);
        break;
      case 'toFriend':
        this.arriveAtFriend(dog);
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

  private finishDrink(dog: Dog): void {
    const trough = dog.targetBuildingId !== null ? this.sim.buildingById(dog.targetBuildingId) : null;
    if (trough && trough.water > 0) {
      const B = BALANCE.dogs;
      const use = Math.min(B.drinkWaterUse, trough.water);
      trough.water = Math.max(0, trough.water - use);
      dog.needs.thirst = clamp100(dog.needs.thirst - B.drinkRelief * (use / B.drinkWaterUse));
      this.sim.stats.drinks++;
    }
    dog.targetBuildingId = null;
    this.setIdle(dog, 2);
  }

  private finishToilet(dog: Dog): void {
    dog.needs.bladder = 0;
    // Alanda da pislik bırakır; alanın içinde kalması için komşu seçimi bölgeyi tercih eder.
    const inToiletZone = this.sim.world.zoneAt(dog.tileX, dog.tileY) === Zone.Toilet;
    placeMess(this.sim, dog.tileX, dog.tileY, inToiletZone ? Zone.Toilet : undefined);
    this.sim.stats.messes++;
    this.setIdle(dog, 2);
  }

  // ---------------------------------------------------------------------------
  // Dost oyunu (köpek-köpek)
  // ---------------------------------------------------------------------------

  /** Yakında oynamak isteyen en uygun köpeği bulur, ikisini buluşma noktasına yollar. */
  private startPlaydate(dog: Dog): boolean {
    const S = BALANCE.dogs.social;
    if (dog.playmateId !== null) return false;
    const me = dog.genome.temperament;
    let best: Dog | null = null;
    let bestScore = 0;
    for (const other of this.sim.dogs) {
      if (other === dog || other.wild || other.playmateId !== null || other.isAsleep()) continue;
      if (other.illness && this.sim.policies.quarantineSick) continue;
      if (other.state !== 'idle' && other.state !== 'wander' && other.state !== 'sit' && other.state !== 'lie') continue;
      if (other.needs.play >= S.partnerBelowPlay || other.needs.energy < BALANCE.dogs.playMinEnergy) continue;
      const dist = Math.hypot(other.x - dog.x, other.y - dog.y);
      if (dist > S.radius) continue;
      const aff = dog.affinity(other.id);
      if (me === 'shy' && aff < S.shyMinAffinity) continue;
      const compat = S.compat[me] * S.compat[other.genome.temperament];
      const score = (compat * (1 + aff / 100) * (me === 'playful' ? S.playfulInitiateMul : 1)) / (1 + dist / 4);
      if (score > bestScore) {
        bestScore = score;
        best = other;
      }
    }
    if (!best) return false;
    const w = this.sim.world;
    let meet: TilePos = { x: Math.floor((dog.x + best.x) / 2), y: Math.floor((dog.y + best.y) / 2) };
    const yard = this.nearestZoneTile(dog, Zone.Play);
    if (yard && Math.hypot(yard.x + 0.5 - dog.x, yard.y + 0.5 - dog.y) <= S.yardRadius) meet = yard;
    if (w.isSolid(meet.x, meet.y) || w.buildingIdAt(meet.x, meet.y) !== -1) meet = this.freeTileNear(meet.x, meet.y) ?? meet;
    const side = this.freeTileNear(meet.x, meet.y) ?? meet;
    dog.playmateId = best.id;
    best.playmateId = dog.id;
    if (!this.goTo(dog, meet, 'toFriend') || !this.goTo(best, side, 'toFriend')) {
      this.cancelPlaydate(dog);
      this.setIdle(dog, 1);
      return false;
    }
    return true;
  }

  private arriveAtFriend(dog: Dog): void {
    const mate = dog.playmateId !== null ? this.sim.dogById(dog.playmateId) : undefined;
    if (!mate || mate.playmateId !== dog.id) {
      this.cancelPlaydate(dog);
      this.setIdle(dog, 2);
      return;
    }
    if (mate.state === 'waitFriend') {
      this.beginPlayTogether(dog, mate);
      return;
    }
    this.setState(dog, 'waitFriend', BALANCE.dogs.social.meetTimeoutMin);
  }

  private beginPlayTogether(a: Dog, b: Dog): void {
    const S = BALANCE.dogs.social;
    this.setState(a, 'playTogether', S.durationMin);
    this.setState(b, 'playTogether', S.durationMin);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const horizontal = Math.abs(dx) >= Math.abs(dy);
    a.facing = (horizontal ? (dx < 0 ? 1 : 2) : dy < 0 ? 3 : 0) as Facing;
    b.facing = (horizontal ? (dx < 0 ? 2 : 1) : dy < 0 ? 0 : 3) as Facing;
  }

  /** Oyun bitti: keyif, dostluk ve sosyallik artar; cesur×cesur bazen hırlaşmayla biter. */
  private finishPlayTogether(dog: Dog): void {
    const S = BALANCE.dogs.social;
    const sim = this.sim;
    const mate = dog.playmateId !== null ? sim.dogById(dog.playmateId) : undefined;
    const paired = !!mate && mate.playmateId === dog.id;
    const pair: Dog[] = paired && mate ? [dog, mate] : [dog];
    const bothBold = paired && dog.genome.temperament === 'bold' && mate!.genome.temperament === 'bold';
    const social = pair.every((d) => d.skills.social >= 100);
    const growl = bothBold && !social && sim.rng.chance(S.growlChanceBoldBold);
    for (const d of pair) {
      const other = d === dog ? mate : dog;
      const active = d === dog || d.state === 'playTogether';
      d.playmateId = null;
      if (growl) {
        if (other) d.addAffinity(other.id, S.growlAffinity);
        d.needs.play = clamp100(d.needs.play - S.growlPlayLoss);
        if (active) this.setState(d, 'growl', S.growlDurationMin);
        sim.events.emit('emote', { kind: 'dog', id: d.id, emote: 'alert', seconds: 2 });
      } else {
        d.needs.play = clamp100(d.needs.play + S.playGain);
        d.needs.thirst = clamp100(d.needs.thirst + BALANCE.dogs.needs.thirstAfterPlay * 0.5);
        d.needs.energy = clamp100(d.needs.energy - S.energyCost);
        if (other) d.addAffinity(other.id, S.affinityGain);
        d.skills.social = clamp100(d.skills.social + S.socialSkillGain);
        if (active) this.setIdle(d, 3);
        sim.events.emit('emote', { kind: 'dog', id: d.id, emote: 'paw', seconds: 2 });
      }
    }
    if (growl && mate) {
      sim.stats.growls++;
      sim.flags.growlUntil = sim.clock.totalMinutes + S.growlAlertMin;
      sim.flags.growlA = dog.name;
      sim.flags.growlB = mate.name;
      sim.events.emit('message', t('Hırlaşma: {a} ve {b}', { a: dog.name, b: mate.name }));
    } else if (paired) sim.stats.playdates++;
  }

  private cancelPlaydate(dog: Dog): void {
    const mate = dog.playmateId !== null ? this.sim.dogById(dog.playmateId) : undefined;
    dog.playmateId = null;
    if (mate && mate.playmateId === dog.id) {
      mate.playmateId = null;
      if (mate.state === 'toFriend' || mate.state === 'waitFriend' || mate.state === 'playTogether') this.setIdle(mate, 1);
    }
  }

  // ---------------------------------------------------------------------------
  // Huy ve beceriler
  // ---------------------------------------------------------------------------

  /** Çekingen köpek güven kazanmadan bir insan bitişiğine gelince birkaç kare kaçar. */
  private maybeFlee(dog: Dog, dtMin: number): boolean {
    const TP = BALANCE.dogs.temperament;
    dog.fleeTimer = Math.max(0, dog.fleeTimer - dtMin);
    if (dog.genome.temperament !== 'shy' || dog.needs.loyalty >= TP.shyFleeLoyaltyBelow || dog.fleeTimer > 0) return false;
    if (dog.state !== 'idle' && dog.state !== 'wander' && dog.state !== 'sit' && dog.state !== 'lie') return false;
    const near = this.nearestHuman(dog, TP.shyFleeTriggerDistance);
    if (!near) return false;
    dog.fleeTimer = TP.shyFleeCooldownMin;
    const dx = dog.x - near.x;
    const dy = dog.y - near.y;
    const len = Math.hypot(dx, dy) || 1;
    const target = { x: Math.floor(dog.x + (dx / len) * TP.shyFleeDistance), y: Math.floor(dog.y + (dy / len) * TP.shyFleeDistance) };
    const w = this.sim.world;
    if (!w.inPlotInterior(target.x, target.y) || w.isSolid(target.x, target.y)) return false;
    return this.goTo(dog, target, 'wander');
  }

  /** Yarıçap içindeki en yakın insan (oyuncu, görevdeki personel, sahiplenici). */
  private nearestHuman(dog: Dog, radius: number): { x: number; y: number } | null {
    const sim = this.sim;
    let best: { x: number; y: number } | null = null;
    let bestD = radius;
    const consider = (x: number, y: number): void => {
      const d = Math.hypot(x - dog.x, y - dog.y);
      if (d < bestD) {
        bestD = d;
        best = { x, y };
      }
    };
    if (sim.mode === 'avatar') consider(sim.player.x, sim.player.y - 0.2);
    for (const s of sim.staff) if (s.onDuty) consider(s.x, s.y);
    for (const a of sim.adopters) consider(a.x, a.y);
    return best;
  }

  /** "Otur" bilen köpek, oyuncu birkaç saniye bitişiğinde durunca oturur (gerçek saniye ile). */
  updateNearPlayer(dtSec: number): void {
    const K = BALANCE.dogs.skills;
    const p = this.sim.player;
    for (const dog of this.sim.dogs) {
      if (dog.wild || dog.walking || dog.skills.sit < 100) continue;
      const near = Math.hypot(p.x - dog.x, p.y - 0.2 - dog.y) <= K.sitNearDistance;
      const idle = dog.state === 'idle' || dog.state === 'wander' || dog.state === 'sit' || dog.state === 'lie';
      if (!near || !idle) {
        dog.nearPlayerSec = 0;
        continue;
      }
      dog.nearPlayerSec += dtSec;
      if (dog.nearPlayerSec >= K.sitNearSeconds && dog.state !== 'sit') {
        this.setState(dog, 'sit', K.sitMinutes);
        const dx = p.x - dog.x;
        const dy = p.y - dog.y;
        dog.facing = (Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 1 : 2) : dy < 0 ? 3 : 0) as Facing;
      }
    }
  }

  /** "Gel": köpeği verilen karenin yanına yürütür. */
  summon(dog: Dog, tile: TilePos): boolean {
    this.cancelPlaydate(dog);
    const spot = this.freeTileNear(tile.x, tile.y) ?? tile;
    return this.goTo(dog, spot, 'wander');
  }

  /** "Tasma": köpek oyuncunun peşine takılır; arsadan çıkıp geri girince gezinti biter. */
  startWalk(dog: Dog): void {
    this.cancelPlaydate(dog);
    dog.walking = true;
    dog.walkReturning = false;
    dog.walkLeftPlot = !this.sim.world.inPlotInterior(dog.tileX, dog.tileY);
    dog.path = [];
    dog.targetBuildingId = null;
    this.setState(dog, 'idle', 0);
  }

  /** Gezintiyi bitir: içerideyse hemen, dışarıdaysa kendi başına eve döner. */
  endWalk(dog: Dog): void {
    if (this.sim.world.inPlotInterior(dog.tileX, dog.tileY)) {
      this.sim.finishWalk(dog);
      return;
    }
    dog.walkReturning = true;
    dog.path = [];
  }

  private returnHome(dog: Dog, dtMin: number): void {
    const sim = this.sim;
    const w = sim.world;
    if (w.inPlotInterior(dog.tileX, dog.tileY)) {
      sim.finishWalk(dog);
      return;
    }
    if (dog.path.length === 0) {
      const office = sim.buildings.find((b) => b.type === 'office');
      const door = office ? buildingDoorTile(office) : { x: Math.floor(w.spawn.x), y: Math.floor(w.spawn.y) };
      const path = findPath(w, { x: dog.tileX, y: dog.tileY }, door, { maxNodes: 8000, adjacentOk: true, throughGates: true });
      if (!path || path.length === 0) {
        dog.x = door.x + 0.5;
        dog.y = door.y + 0.5;
        dog.path = [];
        sim.finishWalk(dog);
        return;
      }
      dog.path = path;
    }
    this.followPath(dog, dtMin);
  }

  private shouldWake(dog: Dog): boolean {
    const clock = this.sim.clock;
    const B = BALANCE.dogs;
    // Dolu mesane: gece de olsa kalkıp tuvalete gider (çok bitkinse uyur).
    if (dog.needs.bladder >= B.toiletAboveBladder && dog.needs.energy > B.wakeForToiletEnergyAbove) return true;
    if (dog.needs.energy >= 100 && !clock.isNight()) return true;
    if (!clock.isNight() && dog.needs.energy > 60) return true;
    if (dog.needs.hunger > 90 && dog.needs.energy > 30) return true;
    if (dog.needs.thirst > 90 && dog.needs.energy > 30) return true;
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
      if (!this.sim.gates.canEnter(next)) break;
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
    const pen = messHygienePenalty(this.sim, i);
    if (pen > 0) dog.needs.hygiene = clamp100(dog.needs.hygiene - pen);
  }

  // ---------------------------------------------------------------------------
  // Yardımcılar
  // ---------------------------------------------------------------------------

  private setState(dog: Dog, state: Dog['state'], minutes: number): void {
    dog.state = state;
    dog.stateTimer = minutes;
    if (state !== 'toBowl' && state !== 'toTrough' && state !== 'toToilet' && state !== 'toKennel' && state !== 'toQuarantine' && state !== 'toToy' && state !== 'toFriend' && state !== 'wander') dog.path = [];
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

  /** En yakın sulu ve hazır yalak. */
  private findTrough(dog: Dog): Building | null {
    let best: Building | null = null;
    let bestD = Infinity;
    for (const b of this.sim.buildings) {
      if (b.type !== 'trough' || b.water <= 0 || !isReady(b)) continue;
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
    const TP = BALANCE.dogs.temperament;
    const radius = dog.genome.temperament === 'bold' ? TP.boldWanderRadius : TP.wanderRadius;
    for (let tries = 0; tries < 8; tries++) {
      const x = dog.tileX + this.sim.rng.int(-radius, radius);
      const y = dog.tileY + this.sim.rng.int(-radius, radius);
      if (x < r.x || y < r.y || x >= r.x + r.w || y >= r.y + r.h) continue;
      if (w.isSolid(x, y) || w.buildingIdAt(x, y) !== -1) continue;
      return { x, y };
    }
    return null;
  }
}
