import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { MINUTES_PER_DAY } from '../../src/core/Clock';
import { Rng } from '../../src/core/Rng';
import type { Dog } from '../../src/sim/entities/Dog';
import { randomGenome } from '../../src/sim/entities/DogGenome';
import { ACHIEVEMENTS } from '../../src/sim/systems/Achievements';
import { PAIR_LETTERS } from '../../src/sim/systems/MailSystem';
import { bondedPartner, pairIssue, pairScore } from '../../src/sim/systems/Pairs';
import { albumEntries } from '../../src/sim/systems/Stories';
import { Sim } from '../../src/sim/Sim';

/** Sağlıklı, temiz, güvenen yetişkin köpek ekler. */
function addReady(sim: Sim, name: string, seed: number): Dog {
  const s = sim.world.spawn;
  const d = sim.addDog(randomGenome(new Rng(seed)), 'egg', 20, s.x, s.y, name);
  d.needs.health = 100;
  d.needs.hygiene = 100;
  d.needs.loyalty = 100;
  return d;
}

function bond(a: Dog, b: Dog, ab = 80, ba = 80): void {
  a.friends[b.id] = ab;
  b.friends[a.id] = ba;
}

/** Bekleyen, isteksiz (her köpeğe uyan) sahiplenici. */
function waitingAdopter(sim: Sim, type: 'family' | 'student' = 'family') {
  sim.clock.totalMinutes = 10 * 60;
  const a = sim.adoption.spawnAdopter()!;
  a.state = 'waiting';
  a.type = type;
  a.request = {};
  return a;
}

describe('Can dostları: ikili sahiplendirme (0.21.4)', () => {
  it('can dostu karşılıklı dostluk ≥70 olan en güçlü köpek; tek yönlü ya da zayıf dostluk sayılmaz', () => {
    const sim = Sim.create(2901);
    const a = addReady(sim, 'Akçe', 1);
    const b = addReady(sim, 'Boncuk', 2);
    const c = addReady(sim, 'Ceviz', 3);
    const d = addReady(sim, 'Duman', 4);
    bond(a, b, 80, 75);
    bond(a, c, 95, 40);
    bond(a, d, 90, 85);
    expect(bondedPartner(sim, a)?.id).toBe(d.id);
    expect(bondedPartner(sim, c)).toBeNull();
    d.friends[a.id] = 60;
    expect(bondedPartner(sim, a)?.id).toBe(b.id);
    b.friends[a.id] = BALANCE.stories.bondMin - 1;
    expect(bondedPartner(sim, a)).toBeNull();
  });

  it('ikisini birlikte ver: ikisi de gider, ücret ×1,7, ek itibar, iki kayıt aynı anahtarla, tek mektup ikisinden söz eder; öğrenci almaz', () => {
    const sim = Sim.create(2902);
    const a = addReady(sim, 'Akçe', 11);
    const b = addReady(sim, 'Boncuk', 12);
    bond(a, b);
    const student = waitingAdopter(sim, 'student');
    expect(pairIssue(sim, student, a, b)).toContain('iki köpeğe bakamaz');
    expect(sim.command({ type: 'adoptPair', adopterId: student.id, dogId: a.id, partnerId: b.id }).ok).toBe(false);

    const fam = waitingAdopter(sim, 'family');
    expect(pairIssue(sim, fam, a, b)).toBeNull();
    const score = pairScore(fam, a, b);
    const fee = Math.round((fam.fee * BALANCE.stories.pairFeeMul) / 10) * 10;
    const B = BALANCE.adoption;
    const rep = (score >= 70 ? B.repGood + Math.round((score - 70) / 10) : B.repOk) + BALANCE.stories.pairRep;
    const rep0 = sim.reputation;
    const adopted = sim.stats.adopted;
    const r = sim.command({ type: 'adoptPair', adopterId: fam.id, dogId: a.id, partnerId: b.id });
    expect(r.ok).toBe(true);
    expect(sim.dogById(a.id)).toBeUndefined();
    expect(sim.dogById(b.id)).toBeUndefined();
    expect(sim.stats.adopted).toBe(adopted + 2);
    expect(sim.reputation).toBe(Math.min(100, rep0 + rep));
    expect(sim.ledger.some((e) => e.category === 'adoption' && e.amount === fee)).toBe(true);
    const [ra, rb] = sim.adoptions.slice(-2);
    expect(ra.key).toBe(fam.id);
    expect(rb.key).toBe(fam.id);
    expect(ra.pair).toBe('Boncuk');
    expect(rb.pair).toBe('Akçe');
    expect(ra.letterDay).toBeDefined();
    expect(rb.letterDay).toBeUndefined();
    expect(ACHIEVEMENTS.find((x) => x.id === 'bonded-pair')!.check(sim)).toBe(true);

    // Tek mektup: ikisinden söz eder, fotoğrafta ikisi.
    sim.clock.totalMinutes = (ra.letterDay! - 1) * MINUTES_PER_DAY + 11 * 60;
    const got = sim.mail.deliverDue();
    expect(got).toHaveLength(1);
    const L = got[0];
    expect(PAIR_LETTERS).toContain(L.line);
    expect(L.dog2).toBe('Boncuk');
    expect(L.genome2).toEqual(rb.genome);
    expect(sim.mail.text(L)).toContain('Akçe');
    expect(sim.mail.text(L)).toContain('Boncuk');
    // Albümde ikisi de, aynı mektupla ve 💞 bağıyla.
    const entries = albumEntries(sim).slice(0, 2);
    expect(entries.map((e) => e.pair).sort()).toEqual(['Akçe', 'Boncuk']);
    expect(entries.every((e) => e.letter?.id === L.id)).toBe(true);
  });

  it('can dostu tek başına verilince kalan üzülür: sadakat ve oyun keyfi düşer, mesaj', () => {
    const sim = Sim.create(2903);
    const a = addReady(sim, 'Akçe', 21);
    const b = addReady(sim, 'Boncuk', 22);
    bond(a, b);
    b.needs.loyalty = 80;
    b.needs.play = 70;
    const msgs: string[] = [];
    sim.events.on('message', (m) => msgs.push(m));
    const fam = waitingAdopter(sim, 'family');
    expect(sim.command({ type: 'adopt', adopterId: fam.id, dogId: a.id }).ok).toBe(true);
    expect(b.needs.loyalty).toBe(80 - BALANCE.stories.separationLoyalty);
    expect(b.needs.play).toBe(70 - BALANCE.stories.separationPlay);
    expect(msgs.some((m) => m.includes('Boncuk') && m.includes('özlüyor'))).toBe(true);
    expect(bondedPartner(sim, b)).toBeNull();
  });

  it("birlikte puan 50'nin altındaysa ikili yok; can dostu olmayanlar birlikte verilemez; kayıt turu", () => {
    const sim = Sim.create(2904);
    const a = addReady(sim, 'Akçe', 31);
    const b = addReady(sim, 'Boncuk', 32);
    const c = addReady(sim, 'Ceviz', 33);
    bond(a, b);
    const fam = waitingAdopter(sim, 'family');
    expect(pairIssue(sim, fam, a, c)).toContain('can dostu değil');
    // Yaşlı iki köpek ve ikisinin de uymadığı istek: birlikte puan 50'nin altına iner.
    a.ageWeeks = b.ageWeeks = BALANCE.dogs.growth.seniorAtWeek + 1;
    a.genome.temperament = 'calm';
    b.genome.temperament = 'calm';
    a.genome.energy = 3;
    b.genome.energy = 3;
    fam.request = { temperament: 'bold', minTraining: 3, pottyTrained: true, energy: 'high' };
    expect(pairScore(fam, a, b)).toBeLessThan(BALANCE.stories.pairMinScore);
    expect(pairIssue(sim, fam, a, b)).toContain('uymuyor');
    fam.request = {};
    expect(sim.command({ type: 'adoptPair', adopterId: fam.id, dogId: a.id, partnerId: b.id }).ok).toBe(true);
    const back = Sim.fromJSON(JSON.parse(JSON.stringify(sim.toJSON())));
    expect(back.adoptions.slice(-2).map((r) => r.pair)).toEqual(['Boncuk', 'Akçe']);
  });
});
