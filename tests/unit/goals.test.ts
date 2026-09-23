import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { SaveManager } from '../../src/core/SaveManager';
import { EN } from '../../src/i18n/en';
import { Sim } from '../../src/sim/Sim';
import { GOALS, GOAL_CHAIN_VERSION, goalReward, goalShowTool } from '../../src/sim/systems/Goals';

const byId = (id: string) => GOALS.find((g) => g.id === id)!;

describe('Belediye hedef zinciri (0.19.1)', () => {
  it('zincir: benzersiz kimlikler, kuruluşla başlar, zaferle biter, ödül toplamı, çeviriler', () => {
    const ids = GOALS.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(GOALS.length).toBeGreaterThanOrEqual(20);
    expect(ids.slice(0, 3)).toEqual(['kennel', 'bowlTrough', 'incubator']);
    expect(ids[ids.length - 1]).toBe('victory');
    expect(goalReward(byId('victory'))).toBe(0);
    const total = GOALS.reduce((a, g) => a + goalReward(g), 0);
    expect(total).toBeGreaterThan(6000);
    expect(total).toBeLessThan(8000);
    for (const g of GOALS) {
      expect(EN[g.title], g.title).toBeTruthy();
      expect(EN[g.desc], g.desc).toBeTruthy();
    }
  });

  it('yalnız sıradaki hedef ödüllenir; önceden yapılan hedef sırası gelince hemen tamamlanır; her hedef bir kez', () => {
    const sim = Sim.create(1911, 'normal', 'guided');
    const got: string[] = [];
    const msgs: string[] = [];
    sim.events.on('goal', (g) => got.push(g.id));
    sim.events.on('message', (m) => msgs.push(m));
    // Sonraki bir hedef (personel) önceden sağlanır: sırası gelmeden ödül yok.
    sim.stats.hired = 1;
    sim.goals.check();
    expect(got).toEqual([]);
    expect(sim.goals.current?.id).toBe('kennel');

    for (const id of ['kennel', 'bowlTrough', 'incubator']) sim.goals.done.add(id);
    expect(sim.goals.current?.id).toBe('eggFound');
    expect(sim.goals.upcoming(3).map((g) => g.id)).toEqual(['eggFound', 'eggPlaced', 'fillBowl']);
    const m0 = sim.money;
    const rep0 = sim.reputation;
    sim.stats.eggsFound = 1;
    sim.goals.check();
    sim.goals.check();
    expect(got).toEqual(['eggFound']);
    expect(sim.money).toBe(m0 + goalReward(byId('eggFound')));
    expect(sim.reputation).toBe(Math.min(100, rep0 + BALANCE.goals.reputation));
    expect(msgs.at(-1)).toContain('Sıradaki: Yumurtayı kuluçkaya koy');
    expect(sim.ledger.at(-1)).toMatchObject({ category: 'aid', amount: goalReward(byId('eggFound')) });

    sim.stats.hatched = 1;
    sim.stats.bowlsFilled = 1;
    sim.stats.petted = 1;
    sim.stats.cleaned = 1;
    for (let i = 0; i < 6; i++) sim.goals.check();
    // Kiler kurulmadığı için zincir kilerde durur.
    expect(got).toEqual(['eggFound', 'eggPlaced', 'fillBowl', 'petClean']);
    expect(sim.goals.current?.id).toBe('shed');
    expect(goalShowTool(sim, sim.goals.current!)).toBe('shed');

    sim.goals.done.add('shed');
    sim.stats.slept = 1;
    sim.stats.strays = 1;
    const m1 = sim.money;
    for (let i = 0; i < 3; i++) sim.goals.check();
    // Uyku, sokak köpeği ve önceden yapılmış personel hedefi sırayla, ödüllü tamamlanır.
    expect(got.slice(4)).toEqual(['sleep', 'stray', 'hire']);
    expect(sim.money).toBe(m1 + goalReward(byId('sleep')) + goalReward(byId('stray')) + goalReward(byId('hire')));
    // Çatlama da önceden sağlandı: sırası gelince tamamlanır; sonra sahiplendirme bekler.
    sim.goals.check();
    expect(got.at(-1)).toBe('hatch');
    sim.goals.check();
    expect(sim.goals.current?.id).toBe('adopt1');
    expect(sim.goals.current?.panel).toBe('adoption');
    expect(new Set(got).size).toBe(got.length);
  });

  it('Göster: bina hedefi eksik binayı seçer; arsa ve panel hedefleri', () => {
    const sim = Sim.create(1912, 'normal', 'guided');
    expect(goalShowTool(sim, byId('bowlTrough'))).toBe('bowl');
    for (const d of sim.shelterDogs()) {
      d.x = 108.5;
      d.y = 106.5;
    }
    expect(sim.command({ type: 'placeBuilding', building: 'bowl', x: 93, y: 92 }).ok).toBe(true);
    expect(goalShowTool(sim, byId('bowlTrough'))).toBe('trough');
    expect(goalShowTool(sim, byId('eggFound'))).toBeNull();
    expect(byId('expand').plot).toBe(true);
    expect(byId('village').panel).toBe('map');
    // Arsa hedefi başlangıç türüne göre: kuruluşta çekirdekten, hazır barınakta 40×32'den büyüme.
    expect(byId('expand').check(sim)).toBe(false);
    sim.money = 10000;
    expect(sim.command({ type: 'expandPlot', dir: 'east' }).ok).toBe(true);
    expect(byId('expand').check(sim)).toBe(true);
    const ready = Sim.create(1912);
    expect(byId('expand').check(ready)).toBe(false);
  });

  it('zafer halkası ödülsüz; zincir bitince yeni ödül yok', () => {
    const sim = Sim.create(1913);
    for (const g of GOALS) if (g.id !== 'victory') sim.goals.done.add(g.id);
    expect(sim.goals.current?.id).toBe('victory');
    sim.goals.check();
    expect(sim.goals.current?.id).toBe('victory');
    sim.victory = { day: 30, week: 5 };
    const m0 = sim.money;
    const l0 = sim.ledger.length;
    const msgs: string[] = [];
    sim.events.on('message', (m) => msgs.push(m));
    sim.goals.check();
    expect(sim.goals.current).toBeNull();
    expect(sim.goals.upcoming(3)).toEqual([]);
    expect(sim.money).toBe(m0);
    expect(sim.ledger.length).toBe(l0);
    expect(msgs).toEqual(['🎯 Hedef tamam: Yılın Barınağı']);
    sim.goals.check();
    expect(msgs).toHaveLength(1);
  });

  it('kayıt: güncel zincir aynen döner; eski ve 0.19.0 kayıtları ödülsüz ve sessizce yetişir', () => {
    // Güncel kayıt: sonraki bir hedef sağlanmış olsa da tamam sayılmaz, sırası gelince ödüllenir.
    const sim = Sim.create(1914, 'normal', 'guided');
    sim.goals.done.add('kennel');
    sim.stats.hired = 1;
    const json = sim.toJSON();
    expect(json.goals).toEqual({ v: GOAL_CHAIN_VERSION, done: ['kennel'] });
    const back = Sim.fromJSON(SaveManager.parse(JSON.stringify(json))!);
    expect([...back.goals.done]).toEqual(['kennel']);
    expect(back.goals.current?.id).toBe('bowlTrough');

    // Hedef alanı olmayan eski kayıt: sağlanan her hedef ödülsüz tamam; para ve defter değişmez.
    const old = Sim.create(1915);
    old.stats.hired = 2;
    old.stats.adopted = 12;
    old.villageFound = true;
    old.licenseLevel = 2;
    const oj = old.toJSON() as unknown as Record<string, unknown>;
    delete oj.goals;
    delete oj.starter;
    const ob = Sim.fromJSON(SaveManager.parse(JSON.stringify(oj))!);
    for (const id of ['kennel', 'bowlTrough', 'incubator', 'shed', 'hire', 'adopt1', 'village', 'adopt10', 'license2']) {
      expect(ob.goals.done.has(id), id).toBe(true);
    }
    expect(ob.goals.done.has('dogs5')).toBe(false);
    expect(ob.goals.current?.id).toBe('eggFound');
    expect(ob.money).toBe(old.money);
    expect(ob.ledger.filter((e) => e.note.startsWith('Belediye'))).toEqual([]);

    // 0.19.0 kaydı ({ index }): ilk kuruluş hedefleri tamam, sonra sessiz yetişme.
    const g19 = Sim.create(1916, 'normal', 'guided');
    g19.stats.eggsFound = 1;
    const gj = g19.toJSON() as unknown as Record<string, unknown>;
    gj.goals = { index: 2 };
    const gb = Sim.fromJSON(SaveManager.parse(JSON.stringify(gj))!);
    expect(gb.goals.done.has('kennel')).toBe(true);
    expect(gb.goals.done.has('bowlTrough')).toBe(true);
    expect(gb.goals.done.has('eggFound')).toBe(true);
    expect(gb.goals.current?.id).toBe('incubator');
    // Bozuk kimlikler yok sayılır.
    const bad = Sim.create(1917, 'normal', 'guided').toJSON() as unknown as Record<string, unknown>;
    bad.goals = { v: GOAL_CHAIN_VERSION, done: ['kennel', 'yok-boyle-hedef', 42] };
    expect([...Sim.fromJSON(SaveManager.parse(JSON.stringify(bad))!).goals.done]).toEqual(['kennel']);
  });
});
