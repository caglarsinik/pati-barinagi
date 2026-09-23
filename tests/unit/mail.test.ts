import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { MINUTES_PER_DAY } from '../../src/core/Clock';
import { Sim } from '../../src/sim/Sim';
import type { AdoptionRecord } from '../../src/sim/systems/AdoptionSystem';
import { GREAT_LETTERS, HARD_LETTERS, OK_LETTERS, TYPE_SCENE, VILLAGE_LETTERS } from '../../src/sim/systems/MailSystem';

/** Günün saatine atlar (dakika da verilebilir). */
function at(sim: Sim, day: number, hour: number, minute = 0): void {
  sim.clock.totalMinutes = (day - 1) * MINUTES_PER_DAY + hour * 60 + minute;
}

/** Masada harika eşleşmeyle sahiplendirir; kaydı döndürür. */
function adoptGood(sim: Sim): AdoptionRecord {
  const dog = sim.shelterDogs()[0];
  dog.needs.health = 100;
  dog.needs.hygiene = 100;
  dog.needs.loyalty = 100;
  const a = sim.adoption.spawnAdopter()!;
  a.state = 'waiting';
  a.request = { temperament: dog.genome.temperament };
  expect(sim.command({ type: 'adopt', adopterId: a.id, dogId: dog.id }).ok).toBe(true);
  return sim.adoptions[sim.adoptions.length - 1];
}

/** Elle kayıt: mektup günü 1. */
function rec(key: number, score: number, villager?: number): AdoptionRecord {
  return { day: 1, dogName: `Köpek${key}`, adopterName: 'Ayşe Kaya', fee: 100, score, key, type: 'retiree', look: 1, letterDay: 1, ...(villager !== undefined ? { villager } : {}) };
}

describe('Sahiplendirme mektupları (0.21.1)', () => {
  it("iyi eşleşmede 3–7 gün sonrası mektup günü; o gün saat 11:00'de tek mektup: tipe göre satır ve fotoğraf sahnesi, bağış ve itibar", () => {
    const sim = Sim.create(2601);
    at(sim, 1, 10);
    const r = adoptGood(sim);
    expect(r.score).toBeGreaterThanOrEqual(70);
    expect(r.letterDay).toBeGreaterThanOrEqual(1 + BALANCE.stories.letterMinDays);
    expect(r.letterDay).toBeLessThanOrEqual(1 + BALANCE.stories.letterMaxDays);
    // Saatten önce yok; 11:00'i geçince gelir.
    at(sim, r.letterDay!, 10, 30);
    sim.stepSim(20);
    expect(sim.mail.list).toHaveLength(0);
    const msgs: string[] = [];
    sim.events.on('message', (m) => msgs.push(m));
    at(sim, r.letterDay!, 10, 59);
    sim.stepSim(2);
    expect(sim.mail.list).toHaveLength(1);
    const L = sim.mail.list[0];
    expect(GREAT_LETTERS[r.type!]).toContain(L.line);
    expect(L.scene).toBe(TYPE_SCENE[r.type!]);
    expect(L.genome).toEqual(r.genome);
    expect(L.from).toBe(r.adopterName);
    expect(L.donation % 10).toBe(0);
    expect(L.donation).toBeGreaterThanOrEqual(BALANCE.stories.donationMin);
    expect(L.donation).toBeLessThanOrEqual(BALANCE.stories.donationMax);
    expect(L.rep).toBe(1);
    expect(sim.ledger.some((e) => e.category === 'donation' && e.amount === L.donation && e.note.includes(L.from))).toBe(true);
    expect(msgs.some((m) => m.includes('📬'))).toBe(true);
    expect(r.lettered).toBe(true);
    expect(sim.mail.text(L)).toContain(r.dogName);
    // Ertesi gün yeni mektup yok; okundu.
    at(sim, r.letterDay! + 1, 10, 59);
    sim.stepSim(2);
    expect(sim.mail.list).toHaveLength(1);
    expect(sim.mail.unread()).toBe(1);
    expect(sim.command({ type: 'readMail', id: L.id }).ok).toBe(true);
    expect(sim.mail.unread()).toBe(0);
  });

  it('geri gelecek köpeğe mektup yok; idare eden ve zayıf eşleşme bağışsız; köylü mektubu köy sahnesiyle', () => {
    const sim = Sim.create(2602);
    at(sim, 1, 10);
    const dog = sim.shelterDogs()[0];
    dog.needs.health = 100;
    dog.needs.hygiene = 100;
    dog.needs.loyalty = 100;
    const a = sim.adoption.spawnAdopter()!;
    a.state = 'waiting';
    a.request = { temperament: dog.genome.temperament === 'calm' ? 'bold' : 'calm', minTraining: 3, pottyTrained: true };
    const chance = sim.rng.chance;
    sim.rng.chance = () => true;
    expect(sim.command({ type: 'adopt', adopterId: a.id, dogId: dog.id }).ok).toBe(true);
    sim.rng.chance = chance;
    const back = sim.adoptions[sim.adoptions.length - 1];
    expect(sim.pendingReturns).toHaveLength(1);
    expect(back.letterDay).toBeUndefined();

    sim.adoptions.push(rec(9060, 60), rec(9030, 30), rec(9090, 90, 2));
    at(sim, 2, 11);
    const got = sim.mail.deliverDue();
    expect(got).toHaveLength(3);
    const [ok, hard, village] = got;
    expect(OK_LETTERS).toContain(ok.line);
    expect(ok.donation).toBe(0);
    expect(ok.rep).toBe(0);
    expect(ok.scene).toBe(TYPE_SCENE.retiree);
    expect(HARD_LETTERS).toContain(hard.line);
    expect(hard.donation).toBe(0);
    expect(VILLAGE_LETTERS).toContain(village.line);
    expect(village.scene).toBe('village');
    expect(village.donation).toBeGreaterThan(0);
  });

  it('günde en çok 2 itibar; posta en çok 40 mektup, önce okunmuş eski düşer', () => {
    const sim = Sim.create(2603);
    for (let i = 0; i < 4; i++) sim.adoptions.push(rec(9100 + i, 95));
    at(sim, 2, 11);
    expect(sim.mail.deliverDue().map((l) => l.rep)).toEqual([1, 1, 0, 0]);
    sim.mail.list[0].read = true;
    const firstId = sim.mail.list[0].id;
    for (let i = 0; i < 37; i++) sim.adoptions.push(rec(9200 + i, 60));
    sim.mail.deliverDue();
    expect(sim.mail.list).toHaveLength(BALANCE.stories.maxLetters);
    expect(sim.mail.list.some((l) => l.id === firstId)).toBe(false);
    expect(sim.command({ type: 'readMail' }).ok).toBe(true);
    expect(sim.mail.unread()).toBe(0);
  });

  it('kayıt turu; eski kayıtlara mektup yok; mektup ana RNG sırasını değiştirmez', () => {
    const sim = Sim.create(2604);
    at(sim, 1, 10);
    const r = adoptGood(sim);
    at(sim, r.letterDay!, 11);
    expect(sim.mail.deliverDue()).toHaveLength(1);
    const back = Sim.fromJSON(JSON.parse(JSON.stringify(sim.toJSON())));
    expect(back.mail.toJSON()).toEqual(sim.mail.toJSON());
    expect(back.adoptions[back.adoptions.length - 1].lettered).toBe(true);
    back.adoptions.push({ day: 1, dogName: 'Eski', adopterName: 'Eski Aile', fee: 100, score: 95 });
    expect(back.mail.deliverDue()).toHaveLength(0);
    const old = JSON.parse(JSON.stringify(sim.toJSON()));
    delete old.mail;
    expect(Sim.fromJSON(old).mail.list).toHaveLength(0);

    const x = Sim.create(2605);
    const y = Sim.create(2605);
    y.adoptions.push(rec(9300, 95), rec(9301, 55));
    expect(y.mail.deliverDue()).toHaveLength(2);
    expect(x.rng.next()).toBe(y.rng.next());
  });
});
