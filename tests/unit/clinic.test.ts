import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { SaveManager } from '../../src/core/SaveManager';
import { drawInteriorItem } from '../../src/render/InteriorArt';
import { type Building, buildingDoorTile, canPlaceBuilding } from '../../src/sim/entities/Building';
import type { Facing } from '../../src/sim/entities/Player';
import { type InteriorItem, type InteriorItemType, buildInterior } from '../../src/sim/interior/Interiors';
import { Sim } from '../../src/sim/Sim';
import { treatmentCost, vaccineDaysLeft } from '../../src/sim/systems/ClinicSystem';
import { performAction, resolveAction } from '../../src/sim/systems/Interaction';
import { findPath } from '../../src/sim/world/Pathfinder';
import type { TileWorld } from '../../src/sim/world/TileWorld';

const C = BALANCE.clinic;
const I = BALANCE.dogs.illness;

function placeVet(sim: Sim): Building {
  const p = sim.world.plotInterior();
  for (let y = p.y + 2; y < p.y + p.h - 5; y++) {
    for (let x = p.x + 2; x < p.x + p.w - 5; x++) {
      if (canPlaceBuilding(sim.world, 'vetClinic', x, y)) {
        const b = sim.placeBuilding('vetClinic', x, y)!;
        b.buildLeft = 0;
        return b;
      }
    }
  }
  throw new Error('veteriner yeri yok');
}

function frontOf(w: TileWorld, item: InteriorItem): { x: number; y: number; f: Facing } | undefined {
  const cands: Array<{ x: number; y: number; f: Facing }> = [];
  for (let x = item.x; x < item.x + item.w; x++) cands.push({ x, y: item.y + item.h, f: 3 });
  for (let y = item.y; y < item.y + item.h; y++) {
    cands.push({ x: item.x - 1, y, f: 2 });
    cands.push({ x: item.x + item.w, y, f: 1 });
  }
  return cands.find((q) => w.inBounds(q.x, q.y) && !w.isSolid(q.x, q.y));
}

function faceItem(sim: Sim, type: InteriorItemType): void {
  const it = sim.interior!;
  const c = frontOf(it.world, it.items.find((i) => i.type === type)!)!;
  sim.player.x = c.x + 0.5;
  sim.player.y = c.y + 0.7;
  sim.player.facing = c.f;
  sim.player.busy = 0;
}

/** rng.chance çağrılarının olasılıklarını kaydeder (hep false döner: kimse hastalanmaz). */
function recordChances(sim: Sim): number[] {
  const seen: number[] = [];
  sim.rng.chance = (p: number) => {
    seen.push(p);
    return false;
  };
  return seen;
}

describe('Veteriner odası içi (0.17.2)', () => {
  it('aşı: veteriner yokken ret; ücret, 4 hafta, tekrar yok, kayıtta korunur, süre dolunca biter', () => {
    const sim = Sim.create(1731);
    const dog = sim.shelterDogs()[0];
    sim.money = 1000;
    const none = sim.command({ type: 'vaccinate', dogId: dog.id });
    expect(none.ok).toBe(false);
    expect(none.message).toContain('veteriner');
    placeVet(sim);
    expect(sim.command({ type: 'vaccinate', dogId: dog.id }).ok).toBe(true);
    expect(sim.money).toBe(1000 - C.vaccineCost);
    expect(vaccineDaysLeft(sim, dog)).toBe(C.vaccineWeeks * 7);
    expect(sim.stats.vaccinated).toBe(1);
    const again = sim.command({ type: 'vaccinate', dogId: dog.id });
    expect(again.ok).toBe(false);
    expect(again.message).toContain('zaten aşılı');
    const back = Sim.fromJSON(SaveManager.parse(JSON.stringify(sim.toJSON()))!);
    expect(back.dogById(dog.id)!.vaccinatedUntil).toBe(dog.vaccinatedUntil);
    sim.clock.totalMinutes += (C.vaccineWeeks * 7 + 1) * 24 * 60;
    expect(vaccineDaysLeft(sim, dog)).toBe(0);
  });

  it('aşılı köpekte günlük hastalanma ve saatlik bulaşma eşiği yarı; aşısızda değişmez', () => {
    const sim = Sim.create(1732);
    const dog = sim.shelterDogs()[0];
    dog.illness = null;
    dog.needs.hygiene = 0;
    let seen = recordChances(sim);
    sim.illness.onDay();
    expect(seen[0]).toBeCloseTo(I.fleaChance, 10);
    dog.vaccinatedUntil = sim.clock.totalMinutes + 1000;
    seen = recordChances(sim);
    sim.illness.onDay();
    expect(seen[0]).toBeCloseTo(I.fleaChance * C.vaccineMul, 10);

    const sick = sim.addDog(dog.genome, 'stray', 20, dog.x + 1, dog.y);
    sick.illness = { kind: 'flea', days: 0 };
    seen = recordChances(sim);
    sim.illness.onHour();
    expect(seen).toEqual([I.spreadPerHour.flea * C.vaccineMul]);
    dog.vaccinatedUntil = 0;
    seen = recordChances(sim);
    sim.illness.onHour();
    expect(seen).toEqual([I.spreadPerHour.flea]);
  });

  it('kapıda E hâlâ tedavi eder; ilaç dolabı ücreti %30 düşürür', () => {
    const sim = Sim.create(1733);
    const vet = placeVet(sim);
    const door = buildingDoorTile(vet);
    const dog = sim.shelterDogs()[0];
    dog.x = door.x + 1.5;
    dog.y = door.y + 0.6;
    dog.state = 'sit';
    dog.stateTimer = 9999;
    dog.illness = { kind: 'cold', days: 0 };
    sim.player.x = door.x + 0.5;
    sim.player.y = door.y + 0.9;
    sim.player.facing = 3;
    const r = resolveAction(sim);
    expect(r.kind).toBe('treat');
    expect(r.hint).toContain(`${BALANCE.economy.treatmentPrice}`);
    expect(r.hint).toContain('↑ içeri');
    sim.money = 5000;
    expect(sim.command({ type: 'buyFurniture', buildingId: vet.id, item: 'medCabinet' }).ok).toBe(true);
    const cost = treatmentCost(sim);
    expect(cost).toBe(Math.round(BALANCE.economy.treatmentPrice * (1 - C.medCabinetDiscount)));
    const before = sim.money;
    expect(performAction(sim).ok).toBe(true);
    expect(sim.money).toBe(before - cost);
    expect(dog.illness).toBeNull();
  });

  it('içeride muayene masası sağlık panelini, resepsiyon eşya panelini açar; tam donanımlı odada erişim ve çizimler', () => {
    const sim = Sim.create(1734);
    const vet = placeVet(sim);
    expect(sim.enterBuilding(vet.id).ok).toBe(true);
    expect(sim.interior?.kind).toBe('clinic');
    expect(sim.interior!.items.map((i) => i.type)).toEqual(['xray', 'examTable', 'reception', 'waitChairs']);
    faceItem(sim, 'examTable');
    expect(performAction(sim).open).toBe('clinic');
    faceItem(sim, 'reception');
    expect(performAction(sim).open).toBe('furniture');
    const m = buildInterior('clinic', ['medCabinet']);
    const start = { x: Math.floor(m.spawn.x), y: Math.floor(m.spawn.y - 0.2) };
    for (const item of m.items) {
      expect(m.world.isSolid(item.x, item.y), item.type).toBe(true);
      const front = frontOf(m.world, item);
      expect(front, item.type).toBeDefined();
      expect(findPath(m.world, start, front!, { maxNodes: 400 }), item.type).not.toBeNull();
      const px = drawInteriorItem(item.type);
      let n = 0;
      for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) if (px.isOpaque(x, y)) n++;
      expect(n, item.type).toBeGreaterThan(60);
    }
  });
});
