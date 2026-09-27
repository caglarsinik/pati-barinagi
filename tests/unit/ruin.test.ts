import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { Rng } from '../../src/core/Rng';
import { SaveManager } from '../../src/core/SaveManager';
import { createEgg } from '../../src/sim/entities/Egg';
import { Sim } from '../../src/sim/Sim';
import { MANUAL_ACTIONS, performAction, resolveAction } from '../../src/sim/systems/Interaction';
import { harvestFor } from '../../src/sim/systems/Materials';
import { harvestNest } from '../../src/sim/systems/NestSystem';
import { isHiddenNestFirst, ruinDirection } from '../../src/sim/systems/RuinSystem';
import { findPath } from '../../src/sim/world/Pathfinder';
import { RUIN_ID, ruinAt, ruinDoorTile } from '../../src/sim/world/Ruin';
import { generateWorld } from '../../src/sim/world/WorldGen';
import { Biome, Obj } from '../../src/sim/world/tiles';

const R = BALANCE.ruin;

/** Oyuncuyu iç odada bir kareye koyup bir yöne döndürür (0 aşağı, 1 sol, 2 sağ, 3 yukarı) ve E'ye basar. */
function pressAt(sim: Sim, x: number, y: number, facing: 0 | 1 | 2 | 3) {
  sim.player.x = x + 0.5;
  sim.player.y = y + 0.7;
  sim.player.facing = facing;
  sim.player.busy = 0;
  return performAction(sim);
}

/** Kapı önüne gelip içeri girer. */
function enter(sim: Sim): void {
  const door = ruinDoorTile(sim.world.ruin!);
  const r = pressAt(sim, door.x, door.y, 3);
  expect(r.ok).toBe(true);
  expect(sim.interior?.kind).toBe('ruin');
}

const CHEST = { x: 7, y: 5, f: 2 } as const;
const CABINET = { x: 2, y: 2, f: 1 } as const;
const DESK = { x: 1, y: 3, f: 0 } as const;

describe('Terk edilmiş ev (0.23.2)', () => {
  // CI yavaş (0.23.2'de 20 tohum + her birinde A* 5 sn sınırını aştı): 12 tohum, kare denetimleri tek expect'te toplanır,
  // yol ve aynı yer denetimi ilk 4 tohumda; süre payı 30 sn.
  it('12 tohumda ev: uzakta, arsa/köy/yol dışında, yuva ve in yok, açıklık temiz; güney yolundan ulaşılır, aynı tohum aynı yer', () => {
    const gen = BALANCE.world.plot;
    for (let k = 1; k <= 12; k++) {
      const seed = k * 7919;
      const w = generateWorld(seed);
      const r = w.ruin!;
      expect(r).not.toBeNull();
      const d = Math.hypot(r.x + r.w / 2 - (gen.x + gen.w / 2), r.y + r.h / 2 - (gen.y + gen.h / 2));
      expect(d).toBeGreaterThanOrEqual(R.minDist);
      expect(d).toBeLessThanOrEqual(R.maxDist);
      const c = r.clearing;
      const maxPlot = { x: gen.x - R.plotPad, y: gen.y - R.plotPad, w: BALANCE.world.plotMaxW + 2 * R.plotPad, h: BALANCE.world.plotMaxH + 2 * R.plotPad };
      const overlap = (a: typeof c, b: typeof c): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      expect(overlap(c, maxPlot)).toBe(false);
      const v = w.village!;
      expect(overlap(c, { x: v.x - R.villagePad, y: v.y - R.villagePad, w: v.w + 2 * R.villagePad, h: v.h + 2 * R.villagePad })).toBe(false);
      let road = 0;
      for (let y = c.y - R.roadPad; y < c.y + c.h + R.roadPad; y++) for (let x = c.x - R.roadPad; x < c.x + c.w + R.roadPad; x++) if (w.biomeAt(x, y) === Biome.Road) road++;
      expect(road).toBe(0);
      expect([...w.nests, ...w.dens].filter((n) => n.x >= c.x - 1 && n.y >= c.y - 1 && n.x <= c.x + c.w && n.y <= c.y + c.h)).toEqual([]);
      // Açıklıkta ağaç, kaya, çalı yok (gövdesi altta kalan tepe hariç); yalnız ev katı.
      const bad: string[] = [];
      for (let y = c.y; y < c.y + c.h; y++) {
        for (let x = c.x; x < c.x + c.w; x++) {
          const o = w.objectAt(x, y);
          const objOk = o === Obj.None || ((o === Obj.TreeTop || o === Obj.PineTop) && y === c.y + c.h - 1);
          if (!objOk || w.isSolid(x, y) !== ruinAt(w, x, y)) bad.push(`${x},${y}`);
        }
      }
      expect(bad).toEqual([]);
      const door = ruinDoorTile(r);
      expect(w.isSolid(door.x, door.y)).toBe(false);
      if (k <= 4) {
        const path = findPath(w, { x: Math.floor(gen.x + gen.w / 2), y: gen.y + gen.h }, door, { maxNodes: 80000, throughGates: true });
        expect(path).not.toBeNull();
        expect(generateWorld(seed).ruin).toEqual(r);
      }
    }
  }, 30000);

  it('yaklaşınca bulunur (başarım), kapıda E ile girilir, kapıya yürüyünce dışarı; otopilot girmez', () => {
    const sim = Sim.create(2301);
    const site = sim.world.ruin!;
    const door = ruinDoorTile(site);
    const msgs: string[] = [];
    sim.events.on('message', (m) => msgs.push(m));
    expect(sim.ruin.found).toBe(false);
    sim.player.x = door.x + 0.5;
    sim.player.y = door.y + 6.7;
    sim.update(0.05);
    expect(sim.ruin.found).toBe(false);
    sim.player.y = door.y + 2.7;
    sim.update(0.05);
    expect(sim.ruin.found).toBe(true);
    expect(msgs.some((m) => m.includes('Nuri Usta'))).toBe(true);
    sim.achievements.check();
    expect(sim.achievements.unlocked.has('ruin')).toBe(true);
    // Kapıda ipucu ve giriş.
    sim.player.x = door.x + 0.5;
    sim.player.y = door.y + 0.7;
    sim.player.facing = 3;
    expect(resolveAction(sim)).toMatchObject({ kind: 'enterRuin' });
    enter(sim);
    expect(sim.interior!.buildingId).toBe(RUIN_ID);
    expect(resolveAction(sim).hint).toMatch(/Terk edilmiş ev/);
    sim.exitInterior();
    expect(sim.interior).toBeNull();
    expect(Math.floor(sim.player.x)).toBe(door.x);
    expect(MANUAL_ACTIONS.has('enterRuin')).toBe(true);
  });

  it('sandık bir kez 400 ₺ ve nadir yumurta verir; çanta doluysa yumurta sandıkta bekler', () => {
    const sim = Sim.create(2302);
    enter(sim);
    const rng = new Rng(9);
    while (sim.backpack.length < sim.backpackSlots()) sim.backpack.push(createEgg(sim.nextId++, rng, 'common', 1));
    const m0 = sim.money;
    const r1 = pressAt(sim, CHEST.x, CHEST.y, CHEST.f);
    expect(r1.ok).toBe(true);
    expect(sim.money).toBe(m0 + R.chestMoney);
    expect(sim.ruin.chest).toBe(1);
    expect(r1.message).toMatch(/yer aç/);
    expect(resolveAction(sim)).toMatchObject({ kind: 'none' });
    sim.backpack.pop();
    expect(resolveAction(sim)).toMatchObject({ kind: 'ruinChest' });
    const r2 = pressAt(sim, CHEST.x, CHEST.y, CHEST.f);
    expect(r2.ok).toBe(true);
    expect(sim.money).toBe(m0 + R.chestMoney);
    expect(sim.ruin.chest).toBe(2);
    const egg = sim.backpack[sim.backpack.length - 1];
    expect(egg.genome.rarity).toBe('rare');
    expect(resolveAction(sim).hint).toBe('Sandık boş');
    // Aynı dünyada yumurta hep aynı: çantası boş başka bir oyunda tek açışta alınan yumurtayla aynı soy.
    const twin = Sim.create(2302);
    enter(twin);
    twin.backpack = [];
    pressAt(twin, CHEST.x, CHEST.y, CHEST.f);
    expect(twin.ruin.chest).toBe(2);
    expect(twin.backpack[0].genome).toEqual(egg.genome);
  });

  it('dolaptaki keskin aletler ağaçtan ve kayadan +1 verir, kütükten değil', () => {
    const sim = Sim.create(2303);
    const w = sim.world;
    const find = (o: Obj): { x: number; y: number } => {
      for (let y = 5; y < w.height - 5; y++) {
        for (let x = 5; x < w.width - 5; x++) if (w.objectAt(x, y) === o && !w.inPlot(x, y) && !(w.village && x >= w.village.x && x < w.village.x + w.village.w && y >= w.village.y && y < w.village.y + w.village.h)) return { x, y };
      }
      throw new Error('yok');
    };
    const tree = find(Obj.TreeTrunk);
    const rock = find(Obj.Rock);
    const stump = find(Obj.Stump);
    const M = BALANCE.materials;
    expect(harvestFor(sim, tree.x, tree.y)!.amount).toBe(M.treeWood);
    enter(sim);
    const r = pressAt(sim, CABINET.x, CABINET.y, CABINET.f);
    expect(r.ok).toBe(true);
    expect(sim.ruin.tools).toBe(true);
    expect(resolveAction(sim)).toMatchObject({ kind: 'none' });
    expect(harvestFor(sim, tree.x, tree.y)!.amount).toBe(M.treeWood + R.toolBonus);
    expect(harvestFor(sim, rock.x, rock.y)!.amount).toBe(M.rockStone + R.toolBonus);
    expect(harvestFor(sim, stump.x, stump.y)!.amount).toBe(M.stumpWood);
  });

  it('günlük gizli yuvayı açar: kapıdan 12–20 kare, ulaşılır, ilk yumurtası efsanevi; ikinci okuma yuva eklemez', () => {
    const sim = Sim.create(2304);
    const nests0 = sim.world.nests.length;
    enter(sim);
    const r = pressAt(sim, DESK.x, DESK.y, DESK.f);
    expect(r).toMatchObject({ ok: true, open: 'journal' });
    const nest = sim.ruin.nest!;
    expect(nest).not.toBeNull();
    const door = ruinDoorTile(sim.world.ruin!);
    const d = Math.hypot(nest.x - door.x, nest.y - door.y);
    expect(d).toBeGreaterThanOrEqual(R.nestMinDist);
    expect(d).toBeLessThanOrEqual(R.nestMaxDist);
    expect(sim.world.objectAt(nest.x, nest.y)).toBe(Obj.NestEggs);
    expect(sim.world.nests.length).toBe(nests0 + 1);
    expect(findPath(sim.world, door, nest, { maxNodes: 20000, adjacentOk: true })).not.toBeNull();
    expect(pressAt(sim, DESK.x, DESK.y, DESK.f)).toMatchObject({ ok: true, open: 'journal' });
    expect(sim.world.nests.length).toBe(nests0 + 1);
    sim.exitInterior();
    expect(isHiddenNestFirst(sim, nest.x, nest.y, 0)).toBe(true);
    const egg = harvestNest(sim, nest.x, nest.y)!;
    expect(egg.genome.rarity).toBe('legendary');
    expect(isHiddenNestFirst(sim, nest.x, nest.y, sim.nestHarvests.get(sim.world.idx(nest.x, nest.y)) ?? 0)).toBe(false);
  });

  it('kayıt: durum ve gizli yuva korunur; eski kayıtta varsayılan, açıklıkta kalan kütük temizlenir; ana RNG aynı', () => {
    const sim = Sim.create(2305);
    const twin = Sim.create(2305);
    enter(sim);
    pressAt(sim, CABINET.x, CABINET.y, CABINET.f);
    pressAt(sim, DESK.x, DESK.y, DESK.f);
    sim.backpack = [];
    pressAt(sim, CHEST.x, CHEST.y, CHEST.f);
    sim.exitInterior();
    const data = sim.toJSON();
    const back = Sim.fromJSON(SaveManager.parse(JSON.stringify(data))!);
    expect(back.ruin).toEqual(sim.ruin);
    const nest = back.ruin.nest!;
    expect(back.world.objectAt(nest.x, nest.y)).toBe(Obj.NestEggs);
    expect(back.world.nests.some((n) => n.x === nest.x && n.y === nest.y)).toBe(true);
    // Eski kayıt (0.23.1): ev durumu yok; açıklıkta o zaman kesilmiş ağacın kütüğü kayıtta.
    const c = sim.world.ruin!.clearing;
    const i = sim.world.idx(c.x + 1, c.y + 1);
    const old = { ...data, ruin: undefined, objectChanges: [...(data.objectChanges as number[]), i, Obj.Stump] };
    const legacy = Sim.fromJSON(SaveManager.parse(JSON.stringify(old))!);
    // Oyuncu kapının önünde kaydetti: yüklenince ev yeniden bulunur, bulgular sıfırdan.
    expect(legacy.ruin).toEqual({ found: true, chest: 0, tools: false, journal: false, nest: null });
    expect(legacy.world.objectAt(c.x + 1, c.y + 1)).toBe(Obj.None);
    // Bozuk değerler kırpılır.
    const bad = Sim.fromJSON(SaveManager.parse(JSON.stringify({ ...data, ruin: { found: 'x', chest: 9, tools: 1, journal: true, nest: { x: -5, y: 3 } } }))!);
    expect(bad.ruin).toEqual({ found: true, chest: 2, tools: false, journal: true, nest: null });
    // Bütün bu işler ana RNG'ye dokunmadı.
    expect(sim.rng.next()).toBe(twin.rng.next());
  });

  it('köylü ev bulunmadıysa yönünü söyler, bulununca söylemez', () => {
    const sim = Sim.create(2306);
    sim.villageFound = true;
    sim.villagers.ensure();
    const v = sim.villagers.list[0];
    v.inside = false;
    const first = sim.villagers.talk(v.index).message!;
    expect(first).toContain('Nuri Usta');
    expect(first).toContain(ruinDirection(sim));
    const second = sim.villagers.talk(v.index).message!;
    expect(second).not.toContain('Nuri Usta');
    sim.ruin.found = true;
    for (let k = 0; k < 4; k++) expect(sim.villagers.talk(v.index).message).not.toContain('Nuri Usta');
  });
});
