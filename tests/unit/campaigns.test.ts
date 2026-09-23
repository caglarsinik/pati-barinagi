import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { MINUTES_PER_DAY } from '../../src/core/Clock';
import { ADOPTER_TYPES } from '../../src/sim/entities/AdopterType';
import type { AdoptionRecord } from '../../src/sim/systems/AdoptionSystem';
import { Sim } from '../../src/sim/Sim';

function at(sim: Sim, day: number, hour = 6): void {
  sim.clock.totalMinutes = (day - 1) * MINUTES_PER_DAY + hour * 60;
}

function rec(key: number, score: number, extra: Partial<AdoptionRecord> = {}): AdoptionRecord {
  return { day: 1, dogName: `Köpek${key}`, adopterName: `Aile ${key}`, fee: 200, score, key, family: key, type: 'family', look: 1, ...extra };
}

const S = BALANCE.stories;

describe('Sahiplendirme günü ve bağış kampanyası (0.21.3)', () => {
  it('sahiplendirme günü: bedelli, sahiplendirme açıkken ve haftada bir; ertesi gün sahipleniciler katlanır (tavan 6), sabırları uzar', () => {
    const closed = Sim.create(2801);
    closed.command({ type: 'setPolicy', policy: { adoptionsOpen: false } });
    expect(closed.command({ type: 'announceAdoptionDay' }).ok).toBe(false);

    const sim = Sim.create(2802);
    at(sim, 2, 12);
    const m0 = sim.money;
    expect(sim.command({ type: 'announceAdoptionDay' }).ok).toBe(true);
    expect(sim.money).toBe(m0 - S.adoptionDayCost);
    expect(sim.ledger[sim.ledger.length - 1].category).toBe('event');
    expect(sim.flags.adoptionDay).toBe(3);
    expect(sim.campaigns.adoptionDayTomorrow()).toBe(true);
    expect(sim.command({ type: 'announceAdoptionDay' }).ok).toBe(false);

    // Aynı tohum, aynı gün: ilan edilen günde planlı sahiplenici ≥ 3 ve ≤ 6, normal günden fazla.
    const plain = Sim.create(2802);
    for (const s of [sim, plain]) {
      s.reputation = 90;
      at(s, 3, 6);
      s.adoption.planDay();
    }
    expect(sim.campaigns.isAdoptionDay()).toBe(true);
    expect(sim.adoption.pendingArrivals()).toBeGreaterThanOrEqual(3);
    expect(sim.adoption.pendingArrivals()).toBeLessThanOrEqual(S.adoptionDayMax);
    expect(sim.adoption.pendingArrivals()).toBeGreaterThan(plain.adoption.pendingArrivals());
    // Sabır: tip ve dekor üstüne ×1,5.
    at(sim, 3, 10);
    const a = sim.adoption.spawnAdopter()!;
    const base = BALANCE.adoption.patienceMinutes * ADOPTER_TYPES[a.type].patienceMul + sim.decorScore() * BALANCE.decor.patiencePerPoint;
    expect(a.patienceLeft).toBeCloseTo(base * S.adoptionDayPatienceMul);
    // Aynı hafta yeniden ilan yok; sonraki hafta olur.
    expect(sim.campaigns.adoptionDayIssue()).not.toBeNull();
    at(sim, 8, 12);
    expect(sim.campaigns.adoptionDayIssue()).toBeNull();
  });

  it('gün sonunda en az 3 sahiplendirme olduysa itibar +2; azsa yok', () => {
    const sim = Sim.create(2803);
    at(sim, 4, 23);
    sim.flags.adoptionDay = 4;
    sim.adoptions.push(rec(1, 80, { day: 4 }), rec(2, 60, { day: 4 }));
    const rep0 = sim.reputation;
    sim.campaigns.onDay(5);
    expect(sim.reputation).toBe(rep0);
    sim.adoptions.push(rec(3, 90, { day: 4 }));
    const msgs: string[] = [];
    sim.events.on('message', (m) => msgs.push(m));
    sim.campaigns.onDay(5);
    expect(sim.reputation).toBe(Math.min(100, rep0 + S.adoptionDayRep));
    expect(msgs.some((m) => m.includes('Başarılı sahiplendirme günü'))).toBe(true);
    // Başka günün sonu etkilemez.
    sim.campaigns.onDay(6);
    expect(sim.reputation).toBe(Math.min(100, rep0 + S.adoptionDayRep));
  });

  it("bağış kampanyası: bedelli, haftada bir, 3 gün 11:00'de; mutlu aileler bir kez, köylüler; itibar tabanı ve günlük tavan", () => {
    const sim = Sim.create(2804);
    sim.reputation = 30;
    at(sim, 2, 9);
    const m0 = sim.money;
    expect(sim.command({ type: 'startCampaign' }).ok).toBe(true);
    expect(sim.money).toBe(m0 - S.campaignCost);
    expect(sim.flags.campaignLeft).toBe(S.campaignDays);
    expect(sim.command({ type: 'startCampaign' }).ok).toBe(false);
    // Mezunsuz: yalnız itibar tabanı.
    const r0 = sim.campaigns.campaignRound();
    expect(r0.families).toBe(0);
    expect(r0.amount).toBe(Math.round((30 * S.campaignRepMul) / 10) * 10);
    // Mutlu aileler (aile başına bir kez); zayıf ve geri getirenler bağışlamaz; köylüler de katılır.
    sim.adoptions.push(rec(10, 90), rec(11, 95, { family: 10 }), rec(12, 60), rec(13, 90, { returned: true }), rec(14, 75, { type: 'artist' }));
    sim.villageFound = true;
    const r1 = sim.campaigns.campaignRound();
    expect(r1.families).toBe(2);
    expect(r1.villagers).toBe(sim.villagers.list.length);
    expect(r1.amount).toBeGreaterThan(r0.amount);
    expect(sim.flags.campaignLeft).toBe(S.campaignDays - 2);
    // Son gün saat 11'de; sonra kampanya biter.
    at(sim, 3, 10);
    sim.stepSim(61);
    expect(sim.flags.campaignLeft).toBe(0);
    expect(sim.campaigns.campaignIssue()).not.toBeNull();
    // Tavan.
    for (let i = 0; i < 60; i++) sim.adoptions.push(rec(100 + i, 99));
    sim.flags.campaignLeft = 1;
    expect(sim.campaigns.campaignRound().amount).toBe(S.campaignDailyMax);
    // Sonraki hafta yeniden başlatılabilir.
    at(sim, 9, 9);
    expect(sim.campaigns.campaignIssue()).toBeNull();
  });

  it('kampanya ana RNG sırasını değiştirmez; bayraklar kayıtla döner, eski kayıtta sıfır', () => {
    const x = Sim.create(2805);
    const y = Sim.create(2805);
    y.adoptions.push(rec(1, 90), rec(2, 80));
    y.flags.campaignLeft = 2;
    y.campaigns.campaignRound();
    y.campaigns.onDay(2);
    expect(x.rng.next()).toBe(y.rng.next());

    const sim = Sim.create(2806);
    at(sim, 2, 9);
    sim.command({ type: 'announceAdoptionDay' });
    sim.command({ type: 'startCampaign' });
    const back = Sim.fromJSON(JSON.parse(JSON.stringify(sim.toJSON())));
    expect(back.flags.adoptionDay).toBe(3);
    expect(back.flags.adoptionDayWeek).toBe(sim.flags.adoptionDayWeek);
    expect(back.flags.campaignLeft).toBe(S.campaignDays);
    expect(back.flags.campaignWeek).toBe(sim.flags.campaignWeek);
    const old = JSON.parse(JSON.stringify(sim.toJSON()));
    for (const k of ['adoptionDay', 'adoptionDayWeek', 'campaignLeft', 'campaignWeek']) delete old.flags[k];
    const ob = Sim.fromJSON(old);
    expect(ob.flags.adoptionDay).toBe(0);
    expect(ob.flags.campaignLeft).toBe(0);
  });
});
