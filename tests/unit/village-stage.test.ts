import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { MINUTES_PER_DAY } from '../../src/core/Clock';
import { SaveManager } from '../../src/core/SaveManager';
import { drawVillageBuilding } from '../../src/render/BuildingArt';
import { Sim } from '../../src/sim/Sim';
import { performAction, resolveAction } from '../../src/sim/systems/Interaction';
import { parkSpot, villageDoorTile } from '../../src/sim/world/Village';
import { Ground } from '../../src/sim/world/tiles';

/** Saati haftanın gününe ve saate getirir (olay tetiklemeden; 0 = Pazartesi). */
function setTime(sim: Sim, weekday: number, hour: number): void {
  let d = Math.floor(sim.clock.totalMinutes / MINUTES_PER_DAY);
  while (d % 7 !== weekday) d++;
  sim.clock.totalMinutes = d * MINUTES_PER_DAY + hour * 60;
}

const find = (sim: Sim, kind: string) => sim.world.villageBuildings.find((b) => b.kind === kind);

describe('Köy kademesi ve köydeki sahiplenilen köpekler (0.20.2)', () => {
  it('itibar eşiklerinde postane ve park açılır; kademe düşmez; eski yapıların sırası değişmez', () => {
    const sim = Sim.create(2201);
    const base = sim.world.villageBuildings.map((b) => b.kind);
    sim.reputation = 90;
    sim.updateVillageStage();
    expect(sim.villageStage).toBe(1);
    sim.villageFound = true;
    const [, s2, s3] = BALANCE.village.stageReputation;
    sim.reputation = s2 - 1;
    sim.updateVillageStage();
    expect(sim.villageStage).toBe(1);
    const msgs: string[] = [];
    const grew: number[] = [];
    sim.events.on('message', (m) => msgs.push(m));
    sim.events.on('villageGrew', (e) => grew.push(e.stage));
    sim.reputation = s2;
    sim.updateVillageStage();
    expect(sim.villageStage).toBe(2);
    const post = find(sim, 'postOffice')!;
    expect(post.index).toBe(base.length);
    expect(sim.world.villageBuildings.slice(0, base.length).map((b) => b.kind)).toEqual(base);
    for (let y = post.y; y < post.y + post.h; y++) for (let x = post.x; x < post.x + post.w; x++) expect(sim.world.isSolid(x, y)).toBe(true);
    const door = villageDoorTile(post);
    expect(sim.world.isSolid(door.x, door.y)).toBe(false);
    expect(msgs.some((m) => m.includes('Postane'))).toBe(true);
    expect(find(sim, 'bench')).toBeUndefined();

    sim.reputation = s3;
    sim.updateVillageStage();
    expect(sim.villageStage).toBe(3);
    const bench = find(sim, 'bench')!;
    expect(bench.index).toBe(base.length + 1);
    for (let i = 0; i < 6; i++) {
      const p = parkSpot(sim.world, i)!;
      expect(sim.world.isSolid(p.x, p.y)).toBe(false);
      expect([Ground.Flowers0, Ground.Flowers1]).toContain(sim.world.groundAt(p.x, p.y));
    }
    sim.reputation = 5;
    sim.updateVillageStage();
    expect(sim.villageStage).toBe(3);
    expect(grew).toEqual([2, 3]);
    sim.achievements.check();
    expect(sim.achievements.unlocked.has('village-grow')).toBe(true);
    for (const [kind, w, h] of [
      ['postOffice', 4, 3],
      ['bench', 2, 1],
    ] as const) {
      const px = drawVillageBuilding(kind, w, h);
      let n = 0;
      for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) if (px.isOpaque(x, y)) n++;
      expect(n, kind).toBeGreaterThan(120);
    }
  });

  it('kayıt: kademe ve yapılar yüklemede aynı; eski kayıt 1. kademe; kademe atlayınca yapının üstündeki oyuncu kapıya çekilir', () => {
    const sim = Sim.create(2202);
    sim.villageFound = true;
    sim.reputation = 95;
    sim.updateVillageStage();
    expect(sim.villageStage).toBe(3);
    const back = Sim.fromJSON(SaveManager.parse(JSON.stringify(sim.toJSON()))!);
    expect(back.villageStage).toBe(3);
    expect(back.world.villageBuildings).toEqual(sim.world.villageBuildings);
    const post = find(back, 'postOffice')!;
    expect(back.world.isSolid(post.x + 1, post.y + 1)).toBe(true);
    const p0 = parkSpot(back.world, 0)!;
    expect(back.world.groundAt(p0.x, p0.y)).toBe(sim.world.groundAt(p0.x, p0.y));

    const old = sim.toJSON() as unknown as Record<string, unknown>;
    delete old.villageStage;
    const ob = Sim.fromJSON(SaveManager.parse(JSON.stringify(old))!);
    expect(ob.villageStage).toBe(1);
    expect(find(ob, 'postOffice')).toBeUndefined();

    // Kademe atlarken oyuncu yeni yapının üstündeyse kapısına çekilir.
    const s2 = Sim.create(2203);
    s2.villageFound = true;
    const r = s2.world.village!;
    s2.player.x = r.x + 20.5;
    s2.player.y = r.y + 12.6;
    s2.reputation = BALANCE.village.stageReputation[1];
    s2.updateVillageStage();
    expect(s2.player.collides(s2.world, s2.player.x, s2.player.y)).toBe(false);
    const d = villageDoorTile(find(s2, 'postOffice')!);
    expect(Math.floor(s2.player.x)).toBe(d.x);
    expect(Math.floor(s2.player.y)).toBe(d.y);
  });

  it('köylü sahiplenici gelir, köpeği sahiplenir; köpek köyde onunla, konuşmada ve postanede adı geçer; parkta akşamüstü', () => {
    const sim = Sim.create(2204);
    sim.villageFound = true;
    sim.villagers.update(0.1);
    expect(sim.villagers.adopterFor(1, 0)).toBeNull();
    expect(sim.villagers.adopterFor(1, 1)).not.toBeNull();
    // Köylü olarak gelecek bir sahiplenici kimliği seç (karar kimlikten türeyen ayrı RNG ile).
    let id = sim.nextId;
    while (!sim.villagers.adopterFor(id)) id++;
    const villager = sim.villagers.adopterFor(id)!;
    sim.nextId = id;
    const a = sim.adoption.spawnAdopter()!;
    expect(a.villager).toBe(villager.index);
    expect(a.name).toBe(villager.name);
    expect(a.look).toBe(villager.look);
    // Kayıt turu: sahiplenicinin köylülüğü korunur.
    const reloaded = Sim.fromJSON(SaveManager.parse(JSON.stringify(sim.toJSON()))!);
    expect(reloaded.adopters.find((x) => x.id === a.id)?.villager).toBe(villager.index);

    a.state = 'waiting';
    a.request = {};
    const dog = sim.shelterDogs()[0];
    dog.needs.health = 100;
    dog.needs.hygiene = 100;
    dog.needs.loyalty = 100;
    const r = sim.adoption.adopt(a.id, dog.id);
    expect(r.ok).toBe(true);
    expect(r.message).toContain('köyde');
    const rec = sim.adoptions.at(-1)!;
    expect(rec.villager).toBe(villager.index);
    expect(rec.genome).toEqual(dog.genome);
    expect(sim.villagers.dogOf(villager)?.name).toBe(dog.name);
    // Köpeği olan köylü bir daha sahiplenici olarak seçilmez.
    for (let k = 0; k < 200; k++) expect(sim.villagers.adopterFor(10_000 + k, 1)?.index).not.toBe(villager.index);

    // Konuşma: ilk satır köpeği üstüne.
    setTime(sim, 1, 10);
    sim.villagers.update(0.1);
    villager.inside = false;
    expect(sim.villagers.talk(villager.index).message).toContain(dog.name);

    // Postane (2. kademe): köpek sahibinin mektubu.
    sim.reputation = 95;
    sim.updateVillageStage();
    const post = find(sim, 'postOffice')!;
    const pd = villageDoorTile(post);
    sim.player.x = pd.x + 0.5;
    sim.player.y = pd.y + 0.9;
    sim.player.facing = 3;
    expect(resolveAction(sim).kind).toBe('post');
    const news = performAction(sim);
    expect(news.message).toContain(villager.name);
    expect(news.message).toContain(dog.name);

    // Park (3. kademe): işte değilse 16–19 arası parkta.
    setTime(sim, 1, 17);
    expect(sim.villagers.scheduled(villager)).toBe(villager.role === 'shopkeeper' ? 'work' : 'park');
    setTime(sim, 1, 20);
    expect(sim.villagers.scheduled(villager)).toBe('home');
  });
});
