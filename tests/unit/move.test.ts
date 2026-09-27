import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { BUILDING_DEFS, type BuildingType } from '../../src/content/buildings';
import { Rng } from '../../src/core/Rng';
import { type Building, buildingSize, canPlaceBuilding, kennelRestTile } from '../../src/sim/entities/Building';
import { createEgg } from '../../src/sim/entities/Egg';
import { Sim } from '../../src/sim/Sim';
import { Obj } from '../../src/sim/world/tiles';

function runMinutes(sim: Sim, minutes: number): void {
  sim.setSpeed(4);
  const perStep = 0.5 * BALANCE.time.minutesPerRealSecond * 4;
  for (let i = 0; i < Math.ceil(minutes / perStep); i++) sim.update(0.5);
}

/** Arsa içinde w×h boş yer; çevresindeki bir kare de boş ve köpeksiz. */
function freeSpot(sim: Sim, w: number, h: number): { x: number; y: number } {
  const p = sim.world.plotInterior();
  for (let y = p.y + 2; y < p.y + p.h - h - 2; y++) {
    for (let x = p.x + 2; x < p.x + p.w - w - 2; x++) {
      let ok = true;
      for (let yy = y - 1; yy <= y + h && ok; yy++) {
        for (let xx = x - 1; xx <= x + w && ok; xx++) {
          if (sim.world.isSolid(xx, yy) || sim.world.buildingIdAt(xx, yy) !== -1 || sim.world.objectAt(xx, yy) !== Obj.None) ok = false;
        }
      }
      if (ok && !sim.dogs.some((d) => d.tileX >= x - 1 && d.tileX <= x + w && d.tileY >= y - 1 && d.tileY <= y + h)) return { x, y };
    }
  }
  throw new Error('boş yer yok');
}

/** Hazır (inşaatsız) bina, ücretsiz. */
function readyBuilding(sim: Sim, type: BuildingType, rot: 0 | 1 = 0): Building {
  const s = buildingSize(BUILDING_DEFS[type], rot);
  const spot = freeSpot(sim, s.w, s.h);
  const b = sim.placeBuilding(type, spot.x, spot.y, 0, rot);
  if (!b) throw new Error('yerleşmedi');
  return b;
}

describe('Taşı aracı (0.22.2)', () => {
  it('yerleşim denetimi taşınan binanın kendi karelerini boş sayar', () => {
    const sim = Sim.create(61);
    const b = readyBuilding(sim, 'kennelSmall');
    expect(canPlaceBuilding(sim.world, 'kennelSmall', b.x + 1, b.y)).toBe(false);
    expect(canPlaceBuilding(sim.world, 'kennelSmall', b.x + 1, b.y, 0, b.id)).toBe(true);
    expect(sim.command({ type: 'moveBuilding', id: b.id, x: b.x + 1, y: b.y }).ok).toBe(true);
    expect(sim.world.buildingIdAt(b.x - 1, b.y)).toBe(-1);
    expect(sim.world.buildingIdAt(b.x + 1, b.y)).toBe(b.id);
  });

  it('ofis taşınmaz; aynı yer, başka binanın üstü ve üstünde köpek olan yer reddedilir', () => {
    const sim = Sim.create(61);
    const office = sim.buildings.find((b) => b.type === 'office')!;
    const r0 = sim.command({ type: 'moveBuilding', id: office.id, x: office.x + 1, y: office.y });
    expect(r0.ok).toBe(false);
    expect(r0.message).toBe('Ofis taşınamaz');
    const k = readyBuilding(sim, 'kennelSmall');
    expect(sim.command({ type: 'moveBuilding', id: k.id, x: k.x, y: k.y }).message).toBe('Zaten burada');
    const other = sim.buildings.find((b) => b.type === 'kennelSmall' && b.id !== k.id)!;
    expect(sim.command({ type: 'moveBuilding', id: k.id, x: other.x, y: other.y }).message).toBe('Buraya sığmıyor');
    const spot = freeSpot(sim, 2, 2);
    const dog = sim.shelterDogs()[0];
    dog.x = spot.x + 0.5;
    dog.y = spot.y + 0.5;
    expect(sim.command({ type: 'moveBuilding', id: k.id, x: spot.x, y: spot.y }).message).toBe('Üstünde biri var');
    expect(sim.stats.moved).toBe(0);
  });

  it('gece uyuyan sakinli kulübe yerinde taşınır: köpek uyanır, yeni yerine yürüyüp uyur; para ve kimlik aynı', () => {
    const sim = Sim.create(62);
    const dog = sim.shelterDogs()[0];
    const k = sim.buildingById(dog.kennelId!)!;
    sim.clock.totalMinutes = 22 * 60;
    Object.assign(dog.needs, { hunger: 0, thirst: 0, bladder: 0, energy: 50 });
    const rest0 = kennelRestTile(k, k.occupants.indexOf(dog.id));
    dog.x = rest0.x + 0.5;
    dog.y = rest0.y + 0.5;
    dog.state = 'sleep';
    const seen = { moved: 0, removed: 0, added: 0 };
    sim.events.on('buildingMoved', () => seen.moved++);
    sim.events.on('buildingRemoved', () => seen.removed++);
    sim.events.on('buildingAdded', () => seen.added++);
    const money = sim.money;
    const old = { x: k.x, y: k.y };
    const spot = freeSpot(sim, 2, 2);
    const r = sim.command({ type: 'moveBuilding', id: k.id, x: spot.x, y: spot.y });
    expect(r.ok).toBe(true);
    expect(r.message).toBe('Küçük kulübe taşındı');
    expect(sim.world.buildingIdAt(old.x, old.y)).toBe(-1);
    expect(sim.world.buildingIdAt(spot.x, spot.y)).toBe(k.id);
    expect(sim.world.isSolid(spot.x, spot.y)).toBe(true);
    expect(dog.state).toBe('idle');
    expect(dog.kennelId).toBe(k.id);
    expect(k.occupants).toEqual([dog.id]);
    expect(seen).toEqual({ moved: 1, removed: 0, added: 0 });
    expect(sim.money).toBe(money);
    expect(sim.stats.moved).toBe(1);
    runMinutes(sim, 90);
    const rest1 = kennelRestTile(k, 0);
    expect([dog.tileX, dog.tileY]).toEqual([rest1.x, rest1.y]);
    expect(dog.state).toBe('sleep');
  });

  it('taşınan kabın görevi tahtadan düşer, üstlenen personel bırakır; tahta yeni yerde yeniden üretir', () => {
    const sim = Sim.create(63);
    const bowl = sim.buildings.find((b) => b.type === 'bowl')!;
    bowl.food = 0;
    sim.foodStock = 30;
    sim.tasks.refresh();
    const task = sim.tasks.tasks.find((x) => x.key === `feed:${bowl.id}`)!;
    expect(task.tile).toEqual({ x: bowl.x, y: bowl.y });
    sim.staffSystem.refreshCandidates();
    expect(sim.staffSystem.hire(sim.candidates[0].id).ok).toBe(true);
    const s = sim.staff[0];
    s.state = 'toTask';
    s.taskId = task.id;
    s.path = [{ x: task.tile.x, y: task.tile.y }];
    sim.tasks.claim(task, s.id);
    const spot = freeSpot(sim, 1, 1);
    expect(sim.command({ type: 'moveBuilding', id: bowl.id, x: spot.x, y: spot.y }).ok).toBe(true);
    expect(sim.tasks.byId(task.id)).toBeUndefined();
    expect(s.state).toBe('idle');
    expect(s.taskId).toBeNull();
    expect(s.path).toEqual([]);
    sim.tasks.refresh();
    expect(sim.tasks.tasks.find((x) => x.key === `feed:${bowl.id}`)?.tile).toEqual({ x: spot.x, y: spot.y });
  });

  it('içindekiler korunur (kuluçka yumurtası ve süresi); döndürme korunur ya da değişir; kayıt turu', () => {
    const sim = Sim.create(64);
    const inc = sim.buildings.find((b) => b.type === 'incubator')!;
    const egg = createEgg(sim.nextId++, new Rng(5), 'rare', sim.clock.day);
    sim.backpack.push(egg);
    expect(sim.command({ type: 'placeEgg', buildingId: inc.id, eggId: egg.id }).ok).toBe(true);
    const left = inc.eggs[0].hatchLeft;
    const bag = sim.backpack.length;
    const incSize = buildingSize(BUILDING_DEFS.incubator, inc.rot);
    const s1 = freeSpot(sim, incSize.w, incSize.h);
    expect(sim.command({ type: 'moveBuilding', id: inc.id, x: s1.x, y: s1.y }).ok).toBe(true);
    expect(inc.eggs.map((e) => e.id)).toEqual([egg.id]);
    expect(inc.eggs[0].hatchLeft).toBe(left);
    expect(sim.backpack.length).toBe(bag);

    const kl = readyBuilding(sim, 'kennelLarge', 1);
    const s2 = freeSpot(sim, 3, 3);
    // Döndürme verilmezse eskisi kalır.
    expect(sim.command({ type: 'moveBuilding', id: kl.id, x: s2.x, y: s2.y }).ok).toBe(true);
    expect(kl.rot).toBe(1);
    const s3 = freeSpot(sim, 3, 3);
    expect(sim.command({ type: 'moveBuilding', id: kl.id, x: s3.x, y: s3.y, rot: 0 }).ok).toBe(true);
    expect(kl.rot).toBe(0);
    expect(sim.world.buildingIdAt(s3.x + 2, s3.y)).toBe(kl.id);
    const back = Sim.fromJSON(JSON.parse(JSON.stringify(sim.toJSON())));
    const kl2 = back.buildingById(kl.id)!;
    expect([kl2.x, kl2.y, kl2.rot]).toEqual([kl.x, kl.y, kl.rot]);
    expect(back.buildingById(inc.id)!.eggs.map((e) => e.id)).toEqual([egg.id]);
    expect(back.stats.moved).toBe(3);
  });
});
