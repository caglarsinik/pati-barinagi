import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { type Building, canPlaceBuilding } from '../../src/sim/entities/Building';
import { Sim } from '../../src/sim/Sim';
import { feederCovers } from '../../src/sim/systems/FeederSystem';
import { maxStaff } from '../../src/sim/systems/StaffSystem';

function runMinutes(sim: Sim, minutes: number): void {
  sim.setSpeed(4);
  const perStep = 0.5 * BALANCE.time.minutesPerRealSecond * 4;
  for (let i = 0; i < Math.ceil(minutes / perStep); i++) sim.update(0.5);
}

/** Bir binanın yakınına (en çok `maxDist` kare) makine yerleştirir. */
function placeNear(sim: Sim, type: 'feeder' | 'bowl', near: { x: number; y: number }, minDist: number, maxDist: number): Building {
  for (let d = minDist; d <= maxDist; d++) {
    for (let dy = -d; dy <= d; dy++) {
      for (let dx = -d; dx <= d; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== d) continue;
        const x = near.x + dx;
        const y = near.y + dy;
        if (Math.hypot(dx, dy) > maxDist || Math.hypot(dx, dy) < minDist) continue;
        if (!canPlaceBuilding(sim.world, type, x, y)) continue;
        const b = sim.placeBuilding(type, x, y);
        if (b) return b;
      }
    }
  }
  throw new Error('yer yok');
}

/** Köpekleri tok tutar: testte kapları yalnız makine boşaltsın/doldursun. */
function fullDogs(sim: Sim): void {
  for (const d of sim.dogs) {
    d.needs.hunger = 0;
    d.state = 'sit';
    d.stateTimer = 9999;
  }
}

describe('Otomatik yem makinesi', () => {
  it('menzildeki kabı saatte 2 porsiyon kilerden doldurur, dolunca durur', () => {
    const sim = Sim.create(1701);
    fullDogs(sim);
    const bowl = sim.buildings.find((b) => b.type === 'bowl')!;
    bowl.food = 0;
    const feeder = placeNear(sim, 'feeder', bowl, 2, 6);
    expect(feederCovers(sim, bowl)).toBe(true);
    const stock0 = sim.foodStock;
    sim.clock.totalMinutes = Math.ceil(sim.clock.totalMinutes / 60) * 60 + 5; // saat başından hemen sonra
    runMinutes(sim, 60);
    expect(bowl.food).toBeGreaterThanOrEqual(BALANCE.feeder.feedPerHour - 0.01);
    expect(sim.foodStock).toBeLessThan(stock0);
    runMinutes(sim, 6 * 60);
    expect(bowl.food).toBeCloseTo(sim.bowlCapacity(bowl), 1);
    expect(feeder.level).toBe(1);
  });

  it('kiler boşken doldurmaz; menzil dışındaki kap dolmaz', () => {
    const sim = Sim.create(1702);
    fullDogs(sim);
    const bowl = sim.buildings.find((b) => b.type === 'bowl')!;
    placeNear(sim, 'feeder', bowl, 2, 6);
    const far = placeNear(sim, 'bowl', bowl, BALANCE.feeder.radius * 2 + 2, BALANCE.feeder.radius * 2 + 12);
    expect(feederCovers(sim, far)).toBe(false);
    bowl.food = 0;
    far.food = 0;
    sim.foodStock = 0;
    runMinutes(sim, 3 * 60);
    expect(bowl.food).toBe(0);
    sim.foodStock = 50;
    runMinutes(sim, 3 * 60);
    expect(bowl.food).toBeGreaterThan(0);
    expect(far.food).toBe(0);
  });

  it('makine menzilindeki kabın yem görevi daha az acildir', () => {
    const sim = Sim.create(1703);
    fullDogs(sim);
    const bowl = sim.buildings.find((b) => b.type === 'bowl')!;
    bowl.food = 0;
    sim.tasks.refresh();
    const before = sim.tasks.tasks.find((t) => t.key === `feed:${bowl.id}`)!.urgency;
    placeNear(sim, 'feeder', bowl, 2, 6);
    sim.tasks.refresh();
    const after = sim.tasks.tasks.find((t) => t.key === `feed:${bowl.id}`)!.urgency;
    expect(after).toBeCloseTo(before * BALANCE.feeder.taskUrgencyMul, 5);
  });
});

describe('Ofis seviyesi (lisans)', () => {
  it('personel sınırı Sv1–2de 12, Sv3te 16', () => {
    const sim = Sim.create(1704);
    expect(maxStaff(sim)).toBe(BALANCE.staff.maxStaff);
    sim.licenseLevel = 2;
    expect(maxStaff(sim)).toBe(BALANCE.staff.maxStaff);
    sim.money = 1e7;
    for (let i = 0; i < BALANCE.staff.maxStaff; i++) {
      if (sim.candidates.length === 0) sim.staffSystem.refreshCandidates();
      expect(sim.command({ type: 'hire', candidateId: sim.candidates[0].id }).ok).toBe(true);
    }
    if (sim.candidates.length === 0) sim.staffSystem.refreshCandidates();
    expect(sim.command({ type: 'hire', candidateId: sim.candidates[0].id }).ok).toBe(false);
    sim.licenseLevel = 3;
    expect(maxStaff(sim)).toBe(BALANCE.staff.maxStaffTop);
    expect(sim.command({ type: 'hire', candidateId: sim.candidates[0].id }).ok).toBe(true);
  });
});
