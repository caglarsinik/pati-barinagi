import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { SaveManager } from '../../src/core/SaveManager';
import { drawBuilding } from '../../src/render/BuildingArt';
import { canPlaceBuilding, isReady } from '../../src/sim/entities/Building';
import type { Staff } from '../../src/sim/entities/Staff';
import { Sim } from '../../src/sim/Sim';

const W = BALANCE.staff.toilet;

function hire(sim: Sim): Staff {
  if (sim.candidates.length === 0) sim.staffSystem.refreshCandidates();
  const c = sim.candidates[0];
  c.role = 'caretaker';
  c.attrs = { speed: 3, diligence: 3, empathy: 3, stamina: 3, skill: 3 };
  sim.money = 1e6;
  expect(sim.command({ type: 'hire', candidateId: c.id }).ok).toBe(true);
  const s = sim.staff.find((x) => x.id === c.id)!;
  s.schedule = new Array(24).fill(1) as typeof s.schedule;
  return s;
}

/** Oyun dakikası ilerlet (1x hızda küçük adımlar: tuvalet süresi gözden kaçmasın). */
function runMinutes(sim: Sim, minutes: number, each?: () => void): void {
  sim.setSpeed(1);
  const perStep = 0.5 * BALANCE.time.minutesPerRealSecond;
  for (let i = 0; i < Math.ceil(minutes / perStep); i++) {
    sim.update(0.5);
    each?.();
  }
}

function placeToilet(sim: Sim) {
  const p = sim.world.plotInterior();
  for (let y = p.y + 2; y < p.y + p.h - 3; y++) {
    for (let x = p.x + 2; x < p.x + p.w - 2; x++) {
      if (canPlaceBuilding(sim.world, 'staffToilet', x, y)) return sim.placeBuilding('staffToilet', x, y)!;
    }
  }
  throw new Error('WC yeri yok');
}

describe('Personel tuvaleti (0.16.2)', () => {
  it('vardiyada saatte artar; WC yokken 90 üstünde moral düşer, verim ×0,9, uyarı çıkar', () => {
    const sim = Sim.create(1621);
    const s = hire(sim);
    runMinutes(sim, 20);
    expect(s.onDuty).toBe(true);
    s.bladder = 0;
    runMinutes(sim, 60);
    expect(s.bladder).toBeGreaterThan(W.perHour - 1.5);
    expect(s.bladder).toBeLessThan(W.perHour + 1.5);

    s.bladder = 0;
    const low = s.efficiency('feed');
    s.bladder = 95;
    expect(s.efficiency('feed') / low).toBeCloseTo(W.efficiencyMul, 5);

    s.energy = 100;
    s.state = 'idle';
    s.bladder = 0;
    s.morale = 60;
    sim.staffSystem.onHour();
    const calm = s.morale - 60;
    s.bladder = 95;
    s.morale = 60;
    sim.staffSystem.onHour();
    expect(calm - (s.morale - 60)).toBeCloseTo(W.moraleLossPerHour, 5);
    // Taban: sıkışma morali moraleFloor altına indirmez (yalnız WC yüzünden istifa olmaz).
    s.morale = W.moraleFloor + 1;
    sim.staffSystem.onHour();
    expect(s.morale).toBeCloseTo(Math.min(W.moraleFloor + 1 + calm, Math.max(W.moraleFloor, W.moraleFloor + 1 + calm - W.moraleLossPerHour)), 5);

    sim.alerts.refresh();
    const a = sim.alerts.alerts.find((x) => x.id === 'staffToilet');
    expect(a?.severity).toBe('warn');
  });

  it('WC varken eşikte WC’ye yürür, içeride kalır, boşaltıp işe döner; uyarı kalkar', () => {
    const sim = Sim.create(1622);
    const s = hire(sim);
    const wc = placeToilet(sim);
    runMinutes(sim, BALANCE.staff.decisionIntervalMin + 70);
    expect(isReady(wc)).toBe(true);
    s.bladder = W.goAbove + 5;
    let sawToilet = false;
    let done = false;
    runMinutes(sim, 90, () => {
      if (s.state === 'toilet') sawToilet = true;
      else if (sawToilet && !done) {
        done = true;
        expect(s.bladder).toBeLessThan(2);
      }
    });
    expect(sawToilet).toBe(true);
    expect(done).toBe(true);
    expect(s.bladder).toBeLessThan(W.goAbove);
    sim.alerts.refresh();
    expect(sim.alerts.alerts.some((x) => x.id === 'staffToilet')).toBe(false);
  });

  it('kayıt gidiş-dönüşü; WC çizimi dolu', () => {
    const sim = Sim.create(1623);
    const s = hire(sim);
    runMinutes(sim, 20);
    s.bladder = 42;
    const back = Sim.fromJSON(SaveManager.parse(JSON.stringify(sim.toJSON()))!);
    expect(back.staff.find((x) => x.id === s.id)!.bladder).toBe(42);
    const px = drawBuilding('staffToilet');
    let n = 0;
    for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) if (px.isOpaque(x, y)) n++;
    expect(n).toBeGreaterThan(200);
  });
});
