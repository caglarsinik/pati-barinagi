import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { MINUTES_PER_DAY } from '../../src/core/Clock';
import { Sim } from '../../src/sim/Sim';
import { performAction, resolveAction } from '../../src/sim/systems/Interaction';
import type { Quest, QuestKind } from '../../src/sim/systems/QuestSystem';
import { questBoardTile } from '../../src/sim/world/Village';

/** Köyü bulunmuş oyun: ilk oyun dakikasında pano asılır. */
function villageSim(seed: number, prepare?: (sim: Sim) => void): Sim {
  const sim = Sim.create(seed);
  sim.villageFound = true;
  prepare?.(sim);
  sim.stepSim(1);
  return sim;
}
const quest = (sim: Sim, kind: QuestKind): Quest => sim.quests.list.find((q) => q.kind === kind)!;
/** Panonun altında, panoya bakarak. */
const atBoard = (sim: Sim): void => {
  const b = questBoardTile(sim.world)!;
  sim.player.x = b.x + 0.5;
  sim.player.y = b.y + 1.7;
  sim.player.facing = 3;
};
/** (x, y) karesinin boş bir komşusunda, kareye bakarak. */
const standBy = (sim: Sim, x: number, y: number): void => {
  const w = sim.world;
  for (const [dx, dy, f] of [
    [0, 1, 3],
    [-1, 0, 2],
    [1, 0, 1],
    [0, -1, 0],
  ] as const) {
    if (w.isSolid(x + dx, y + dy)) continue;
    sim.player.x = x + dx + 0.5;
    sim.player.y = y + dy + 0.7;
    sim.player.facing = f;
    return;
  }
  throw new Error('komşu yok');
};

describe('Köylü görevleri (0.20.4)', () => {
  it('pano: köy bulunmadan ilan yok; bulununca her türden bir ilan, farklı köylüler, tohumla aynı; ana RNG değişmez', () => {
    const none = Sim.create(2401);
    none.stepSim(1);
    expect(none.quests.list).toHaveLength(0);
    for (const seed of [2401, 2402, 2403]) {
      const a = villageSim(seed);
      const b = villageSim(seed);
      const board = questBoardTile(a.world)!;
      expect(a.world.isSolid(board.x, board.y)).toBe(false);
      expect(a.quests.list.map((q) => q.kind).sort()).toEqual(['lost', 'pup', 'treats']);
      expect(new Set(a.quests.list.map((q) => q.villager)).size).toBe(3);
      expect(a.quests.list.every((q) => q.state === 'offer')).toBe(true);
      expect(JSON.stringify(a.quests.toJSON())).toBe(JSON.stringify(b.quests.toJSON()));
      // Kayıp köpeğin yeri: yürünebilir, arsanın en büyük hâlinin ve köyün dışında, köye uzak.
      const d = quest(a, 'lost').dog!;
      const w = a.world;
      const p = w.plot;
      const v = w.village!;
      expect(w.isSolid(d.spotX, d.spotY)).toBe(false);
      expect(d.spotX >= p.x - 2 && d.spotX < p.x + BALANCE.world.plotMaxW + 2 && d.spotY >= p.y - 2 && d.spotY < p.y + BALANCE.world.plotMaxH + 2).toBe(false);
      expect(Math.hypot(d.spotX - (v.x + v.w / 2), d.spotY - (v.y + v.h / 2))).toBeGreaterThanOrEqual(BALANCE.quests.lost.minDist);
    }
    const x = Sim.create(2404);
    const y = villageSim(2404);
    x.stepSim(1);
    expect(y.quests.list.length).toBeGreaterThan(0);
    expect(x.rng.next()).toBe(y.rng.next());
  });

  it('kabul panoda; süre dolunca görev düşer; Pazartesi alınmayan ilanlar iner, kabul edilen kalır', () => {
    const sim = villageSim(2402);
    const treats = quest(sim, 'treats');
    expect(sim.command({ type: 'questAccept', id: treats.id }).ok).toBe(false);
    atBoard(sim);
    expect(resolveAction(sim).kind).toBe('quests');
    expect(performAction(sim).open).toBe('quests');
    expect(sim.command({ type: 'questAccept', id: treats.id }).ok).toBe(true);
    expect(treats.until).toBe(sim.clock.totalMinutes + BALANCE.quests.days.treats * MINUTES_PER_DAY);
    const msgs: string[] = [];
    sim.events.on('message', (m) => msgs.push(m));
    sim.clock.totalMinutes = treats.until + 1;
    sim.stepSim(1);
    expect(sim.quests.list.some((q) => q.id === treats.id)).toBe(false);
    expect(msgs.some((m) => m.includes('Görev süresi doldu'))).toBe(true);

    // Cuma kabul edilen köpek isteği (6 gün) haftayı aşar: Pazartesi yeni ilanlar asılır, o kalır.
    const pup = quest(sim, 'pup');
    const oldIds = sim.quests.list.map((q) => q.id);
    sim.clock.totalMinutes = 4 * MINUTES_PER_DAY + 10 * 60;
    expect(sim.command({ type: 'questAccept', id: pup.id }).ok).toBe(true);
    sim.clock.totalMinutes = 7 * MINUTES_PER_DAY + 7 * 60;
    sim.stepSim(1);
    expect(sim.quests.week).toBe(2);
    expect(sim.quests.list).toHaveLength(3);
    expect(sim.quests.list.find((q) => q.id === pup.id)?.state).toBe('active');
    const fresh = sim.quests.list.filter((q) => q.id !== pup.id);
    expect(fresh.every((q) => q.state === 'offer' && !oldIds.includes(q.id) && q.kind !== 'pup')).toBe(true);
    // Vazgeçmek cezasız.
    const rep = sim.reputation;
    expect(sim.command({ type: 'questAbandon', id: pup.id }).ok).toBe(true);
    expect(sim.reputation).toBe(rep);
    expect(sim.quests.list).toHaveLength(2);
  });

  it('kayıp köpek: köylünün sahiplendiği köpek kaybolur; E ile bulunur, peşinden gelir, panoda teslimle ödül', () => {
    // Bütün köylülerin barınaktan köpeği var: kayıp köpek onlardan birinin, köpek isteği ilanı çıkmaz.
    const sim = villageSim(2403, (s) => {
      s.villagers.ensure();
      for (const v of s.villagers.list) {
        const g = s.shelterDogs()[0].genome;
        s.adoptions.push({ day: 1, dogName: `Köpek${v.index}`, adopterName: v.name, fee: 100, score: 90, villager: v.index, genome: { ...g }, stage: 'adult' });
      }
    });
    expect(sim.quests.list.some((q) => q.kind === 'pup')).toBe(false);
    const q = quest(sim, 'lost');
    const d = q.dog!;
    expect(d.own).toBe(true);
    expect(d.name).toBe(`Köpek${q.villager}`);
    expect(sim.quests.dogAway(q.villager)).toBe(true);
    expect(sim.quests.lostDog()).toBeNull();
    atBoard(sim);
    expect(sim.command({ type: 'questAccept', id: q.id }).ok).toBe(true);
    expect(sim.quests.lostDog()).toBe(d);
    expect(sim.quests.searchArea()).not.toBeNull();
    expect(sim.command({ type: 'questDeliver', id: q.id }).ok).toBe(false);

    standBy(sim, d.spotX, d.spotY);
    expect(resolveAction(sim).kind).toBe('lostDog');
    expect(performAction(sim).ok).toBe(true);
    expect(d.found).toBe(true);
    expect(sim.quests.searchArea()).toBeNull();
    // Oyuncunun izinden gelir; uzağa atlayınca yanına ışınlanır.
    for (let i = 0; i < 16; i++) {
      sim.player.x += 0.25;
      sim.quests.follow(1 / 30);
    }
    for (let i = 0; i < 90; i++) sim.quests.follow(1 / 30);
    expect(Math.hypot(d.x - sim.player.x, d.y - sim.player.y)).toBeLessThan(2);
    atBoard(sim);
    sim.quests.follow(1 / 30);
    expect(Math.hypot(d.x - sim.player.x, d.y - sim.player.y)).toBeLessThan(1.5);

    const money = sim.money;
    const rep = sim.reputation;
    const r = sim.command({ type: 'questDeliver', id: q.id });
    expect(r.ok).toBe(true);
    expect(sim.money).toBe(money + BALANCE.quests.lost.reward);
    expect(sim.reputation).toBe(Math.min(100, rep + BALANCE.quests.lost.rep));
    expect(sim.stats.quests).toBe(1);
    expect(sim.quests.lostDog()).toBeNull();
    expect(sim.quests.dogAway(q.villager)).toBe(false);
    expect(sim.ledger[sim.ledger.length - 1]?.category).toBe('quest');
  });

  it('köpek isteği: tasmadaki uygun köpeği köylü sahiplenir, köyde sahibinin yanında görünür', () => {
    const sim = villageSim(2404);
    const q = quest(sim, 'pup');
    atBoard(sim);
    sim.command({ type: 'questAccept', id: q.id });
    const dog = sim.shelterDogs()[0];
    dog.needs.health = 100;
    dog.needs.hygiene = 100;
    dog.needs.loyalty = 100;
    dog.x = sim.player.x + 1;
    dog.y = sim.player.y;
    // Tasmada değilken ve uymayan köpekle olmaz.
    expect(sim.command({ type: 'questDeliver', id: q.id }).ok).toBe(false);
    dog.walking = true;
    if (q.coat !== undefined) dog.genome.coat = (q.coat + 1) % 8;
    else dog.genome.temperament = q.temperament === 'calm' ? 'bold' : 'calm';
    expect(sim.quests.issue(q)).toContain('istenen köpek değil');
    if (q.coat !== undefined) dog.genome.coat = q.coat;
    else dog.genome.temperament = q.temperament!;
    expect(sim.quests.issue(q)).toBeNull();
    const adopted = sim.stats.adopted;
    const r = sim.command({ type: 'questDeliver', id: q.id });
    expect(r.ok).toBe(true);
    expect(sim.dogById(dog.id)).toBeUndefined();
    expect(sim.stats.adopted).toBe(adopted + 1);
    const v = sim.villagers.list[q.villager];
    expect(sim.villagers.dogOf(v)?.name).toBe(dog.name);
    expect(sim.adoptions[sim.adoptions.length - 1]?.villager).toBe(q.villager);
  });

  it('ödül maması: çantada yeterliyse ilanı asan köylüyle konuşunca teslim; eksikse hatırlatma', () => {
    const sim = villageSim(2405);
    const q = quest(sim, 'treats');
    const v = sim.villagers.list[q.villager];
    v.inside = false;
    // İlan asılıyken köylü panoyu söyler.
    expect(sim.quests.talk(v.index)?.message).toContain('panosuna');
    atBoard(sim);
    sim.command({ type: 'questAccept', id: q.id });
    sim.treats = 0;
    const remind = sim.quests.talk(v.index)!;
    expect(remind.ok).toBe(true);
    expect(sim.quests.list.some((x) => x.id === q.id)).toBe(true);
    expect(sim.quests.talkHint(v.index)).toBeNull();
    sim.treats = q.treats! + 1;
    expect(sim.quests.talkHint(v.index)).toContain(v.name);
    const money = sim.money;
    const r = sim.quests.talk(v.index)!;
    expect(r.ok).toBe(true);
    expect(sim.treats).toBe(1);
    expect(sim.money).toBe(money + q.reward);
    // Görevi olmayan köylüde köylü sistemi konuşur.
    expect(sim.quests.talk(v.index)).toBeNull();
  });

  it('kayıt: görevler ve bulunmuş köpeğin yeri kayıtla döner; eski kayıt görevsiz yüklenir ve pano yeniden asılır', () => {
    const sim = villageSim(2406);
    const q = quest(sim, 'lost');
    atBoard(sim);
    sim.command({ type: 'questAccept', id: q.id });
    const d = q.dog!;
    d.found = true;
    d.x = sim.player.x + 1;
    d.y = sim.player.y;
    const back = Sim.fromJSON(JSON.parse(JSON.stringify(sim.toJSON())));
    expect(back.quests.toJSON()).toEqual(sim.quests.toJSON());
    expect(back.quests.lostDog()?.found).toBe(true);
    back.stepSim(1);
    expect(back.quests.list.map((x) => x.id)).toEqual(sim.quests.list.map((x) => x.id));

    const old = JSON.parse(JSON.stringify(sim.toJSON()));
    delete old.quests;
    delete old.stats.quests;
    const ob = Sim.fromJSON(old);
    expect(ob.quests.list).toHaveLength(0);
    expect(ob.stats.quests).toBe(0);
    ob.stepSim(1);
    expect(ob.quests.list.length).toBeGreaterThan(0);
  });
});
