import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { SaveManager } from '../../src/core/SaveManager';
import { Sim } from '../../src/sim/Sim';

function runMinutes(sim: Sim, minutes: number): void {
  sim.setSpeed(4);
  const perStep = 0.5 * BALANCE.time.minutesPerRealSecond * 4;
  for (let i = 0; i < Math.ceil(minutes / perStep); i++) sim.update(0.5);
}

/** k. haftayı kapatır (Pazartesi 06:00 tiki). */
function closeWeekN(sim: Sim, k: number): void {
  sim.clock.totalMinutes = k * 7 * 24 * 60 + 5 * 60 + 55;
  const bowl = sim.buildings.find((b) => b.type === 'bowl')!;
  bowl.food = 4;
  runMinutes(sim, 10);
}

const L = BALANCE.economy.loan;
const BK = BALANCE.economy.bankruptcy;

describe('Kredi', () => {
  it('kredi alınır, ikinci kredi reddedilir, tam ödeme kapatır', () => {
    const sim = Sim.create(1401);
    const m0 = sim.money;
    expect(sim.command({ type: 'repayLoan' }).ok).toBe(false); // borç yok
    expect(sim.command({ type: 'takeLoan' }).ok).toBe(true);
    expect(sim.money).toBe(m0 + L.amount);
    expect(sim.loan).toBe(L.amount);
    expect(sim.ledger.some((e) => e.category === 'loan' && e.amount === L.amount)).toBe(true);
    expect(sim.command({ type: 'takeLoan' }).ok).toBe(false);
    expect(sim.command({ type: 'repayLoan' }).ok).toBe(true);
    expect(sim.loan).toBe(0);
    expect(sim.money).toBe(m0);
    expect(sim.ledger.some((e) => e.category === 'loan' && e.amount === -L.amount)).toBe(true);
  });

  it('kasa yetmiyorsa kısmi ödeme, kasa sıfırsa ret', () => {
    const sim = Sim.create(1402);
    sim.command({ type: 'takeLoan' });
    sim.money = 2000;
    expect(sim.command({ type: 'repayLoan' }).ok).toBe(true);
    expect(sim.loan).toBe(L.amount - 2000);
    expect(sim.money).toBe(0);
    expect(sim.command({ type: 'repayLoan' }).ok).toBe(false);
  });

  it('hafta sonunda faiz işler ve raporda görünür', () => {
    const sim = Sim.create(1403);
    sim.command({ type: 'takeLoan' });
    closeWeekN(sim, 1);
    const interest = Math.round(L.amount * L.weeklyInterest);
    expect(sim.weeks.length).toBe(1);
    expect(sim.weeks[0].expense.interest).toBe(interest);
    expect(sim.ledger.some((e) => e.category === 'interest' && e.amount === -interest)).toBe(true);
    expect(sim.loan).toBe(L.amount); // anapara değişmez
    sim.alerts.refresh();
    expect(sim.alerts.alerts.some((a) => a.id === 'loan')).toBe(true);
  });
});

describe('İflas', () => {
  it('kasa üst üste 3 hafta eşiğin altındaysa oyun biter', () => {
    const sim = Sim.create(1404);
    const events: number[] = [];
    sim.events.on('gameOver', (g) => events.push(g.week));
    sim.money = -5000;
    closeWeekN(sim, 1);
    expect(sim.negativeWeeks).toBe(1);
    expect(sim.gameOver).toBeNull();
    sim.alerts.refresh();
    const debt = sim.alerts.alerts.find((a) => a.id === 'debt')!;
    expect(debt.text).toContain(`1/${BK.weeks}`);
    sim.money = -5000;
    closeWeekN(sim, 2);
    expect(sim.negativeWeeks).toBe(2);
    expect(sim.gameOver).toBeNull();
    sim.money = -5000;
    closeWeekN(sim, 3);
    expect(sim.negativeWeeks).toBe(BK.weeks);
    expect(sim.gameOver).toEqual({ reason: 'bankrupt', week: 4 });
    expect(events).toEqual([4]);
    expect(sim.speed).toBe(0);
    // Oyun durur: komut reddedilir, saat ilerlemez.
    expect(sim.command({ type: 'takeLoan' }).ok).toBe(false);
    const t0 = sim.clock.totalMinutes;
    sim.setSpeed(4);
    sim.update(0.5);
    expect(sim.clock.totalMinutes).toBe(t0);
  });

  it('araya iyi bir hafta girince sayaç sıfırlanır', () => {
    const sim = Sim.create(1405);
    sim.money = -5000;
    closeWeekN(sim, 1);
    expect(sim.negativeWeeks).toBe(1);
    sim.money = 10000;
    closeWeekN(sim, 2);
    expect(sim.negativeWeeks).toBe(0);
    sim.money = -5000;
    closeWeekN(sim, 3);
    closeWeekN(sim, 4);
    expect(sim.negativeWeeks).toBe(2);
    expect(sim.gameOver).toBeNull();
    // Eşik: -(maaş + tampon); tam sınırda değil, biraz üstünde kalınca sayılmaz.
    sim.money = -(sim.weeklyWages() + BK.buffer) + 200;
    closeWeekN(sim, 5);
    expect(sim.negativeWeeks).toBe(0);
  });

  it('kredi, sayaç ve iflas kayıtta korunur; eski kayıtta sıfır', () => {
    const sim = Sim.create(1406);
    sim.command({ type: 'takeLoan' });
    sim.negativeWeeks = 2;
    sim.gameOver = { reason: 'bankrupt', week: 9 };
    const raw = JSON.parse(JSON.stringify(sim.toJSON()));
    const back = Sim.fromJSON(raw);
    expect(back.loan).toBe(L.amount);
    expect(back.negativeWeeks).toBe(2);
    expect(back.gameOver).toEqual({ reason: 'bankrupt', week: 9 });
    delete raw.loan;
    delete raw.negativeWeeks;
    delete raw.gameOver;
    const old = Sim.fromJSON(SaveManager.parse(JSON.stringify(raw))!);
    expect(old.loan).toBe(0);
    expect(old.negativeWeeks).toBe(0);
    expect(old.gameOver).toBeNull();
  });
});
