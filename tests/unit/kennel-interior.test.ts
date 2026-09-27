import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { SaveManager } from '../../src/core/SaveManager';
import { drawInteriorItem } from '../../src/render/InteriorArt';
import { type Building, buildingDoorTile, canPlaceBuilding } from '../../src/sim/entities/Building';
import type { PlayerInput } from '../../src/sim/entities/Player';
import {
  FURNITURE_BY_KIND,
  type InteriorKind,
  type InteriorMap,
  buildInterior,
  furnitureMax,
  furnitureSlots,
  interiorKindFor,
  kennelRestSpotInside,
  sanitizeFurniture,
} from '../../src/sim/interior/Interiors';
import { Sim } from '../../src/sim/Sim';
import { performAction, resolveAction } from '../../src/sim/systems/Interaction';
import { Ground } from '../../src/sim/world/tiles';

const UP: PlayerInput = { dx: 0, dy: -1, run: false };
const DOWN: PlayerInput = { dx: 0, dy: 1, run: false };
const IDLE: PlayerInput = { dx: 0, dy: 0, run: false };

function hold(sim: Sim, input: PlayerInput, sec: number, done: () => boolean = () => false): void {
  for (let i = 0; i < Math.round(sec * 60) && !done(); i++) sim.update(1 / 60, input);
}

/** Kapının üstündeki kareden yürünerek ulaşılan kareler (4 komşu BFS). */
function reachable(m: InteriorMap): Set<string> {
  const w = m.world;
  const start = { x: m.door.x, y: m.door.y - 1 };
  const seen = new Set<string>([`${start.x},${start.y}`]);
  const queue = [start];
  while (queue.length > 0) {
    const c = queue.shift()!;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const x = c.x + dx;
      const y = c.y + dy;
      if (!w.inBounds(x, y) || w.isSolid(x, y) || seen.has(`${x},${y}`)) continue;
      seen.add(`${x},${y}`);
      queue.push({ x, y });
    }
  }
  return seen;
}

/** Odanın kataloğundaki her eşyadan alınabildiği kadar. */
function fullSet(kind: InteriorKind): string[] {
  return FURNITURE_BY_KIND[kind].flatMap((f) => new Array<string>(furnitureMax(kind, f)).fill(f));
}

/** Hazır barınağın ilk küçük kulübesi; oyuncu kapı önünde, yüzü kulübeye dönük. */
function atKennel(seed: number): { sim: Sim; kennel: Building; door: { x: number; y: number } } {
  const sim = Sim.create(seed);
  const kennel = sim.buildings.find((b) => b.type === 'kennelSmall')!;
  const door = buildingDoorTile(kennel);
  sim.player.x = door.x + 0.5;
  sim.player.y = door.y + 0.9;
  sim.player.facing = 3;
  return { sim, kennel, door };
}

function placeLarge(sim: Sim): Building {
  const p = sim.world.plotInterior();
  for (let y = p.y + 2; y < p.y + p.h - 4; y++) {
    for (let x = p.x + 2; x < p.x + p.w - 4; x++) {
      if (canPlaceBuilding(sim.world, 'kennelLarge', x, y)) return sim.placeBuilding('kennelLarge', x, y)!;
    }
  }
  throw new Error('büyük kulübe yeri yok');
}

describe('Kulübe içi (0.22.3)', () => {
  it('iki şablon: boyut, kapı, eşyalar katı ve her birinin önü ulaşılır; pano tam donanımda da ulaşılır', () => {
    expect(interiorKindFor('kennelSmall')).toBe('kennel');
    expect(interiorKindFor('kennelLarge')).toBe('kennelLarge');
    for (const [kind, w, h, n] of [
      ['kennel', 8, 6, 6],
      ['kennelLarge', 10, 6, 7],
    ] as const) {
      const empty = buildInterior(kind);
      expect(empty.world.width).toBe(w);
      expect(empty.world.height).toBe(h);
      expect(empty.world.groundAt(empty.door.x, empty.door.y)).toBe(Ground.Doorway);
      expect(empty.items.map((i) => i.type)).toEqual(['kennelBoard']);
      const full = buildInterior(kind, fullSet(kind));
      expect(full.items.length, kind).toBe(n);
      const reach = reachable(full);
      for (const it of full.items) {
        expect(full.world.isSolid(it.x, it.y), it.type).toBe(true);
        const around: Array<[number, number]> = [];
        for (let x = it.x; x < it.x + it.w; x++) around.push([x, it.y + it.h], [x, it.y - 1]);
        for (let y = it.y; y < it.y + it.h; y++) around.push([it.x - 1, y], [it.x + it.w, y]);
        expect(
          around.some(([x, y]) => reach.has(`${x},${y}`)),
          `${kind} ${it.type}`,
        ).toBe(true);
      }
      const board = full.items.find((i) => i.type === 'kennelBoard')!;
      expect([0, 1].some((k) => reach.has(`${board.x + k},${board.y + 1}`)), kind).toBe(true);
      expect(full.world.isSolid(full.door.x, full.door.y)).toBe(false);
    }
  });

  it('yuva sayısı: küçükte bir yatak, büyükte iki; kayıttan gelen liste odaya göre kırpılır', () => {
    expect(furnitureSlots('kennel', 'dogBed')).toBe(1);
    expect(furnitureSlots('kennelLarge', 'dogBed')).toBe(2);
    expect(furnitureMax('kennel', 'dogBed')).toBe(1);
    expect(furnitureMax('kennelLarge', 'dogBed')).toBe(2);
    expect(furnitureMax('kennelLarge', 'blanket')).toBe(1);
    // Eski odalar değişmez.
    expect(furnitureMax('restRoom', 'sofa')).toBe(2);
    expect(furnitureMax('kitchen', 'oven2')).toBe(1);
    expect(sanitizeFurniture('kennel', ['dogBed', 'dogBed', 'blanket', 'sofa', 'kennelWindow', 7])).toEqual(['dogBed', 'blanket', 'kennelWindow']);
    expect(sanitizeFurniture('kennelLarge', ['dogBed', 'dogBed', 'dogBed', 'dogToy', 'dogToy'])).toEqual(['dogBed', 'dogBed', 'dogToy']);
    expect(sanitizeFurniture('restRoom', ['dogBed'])).toEqual([]);
  });

  it('kapıda E kulübe paneli (ipucu ↑ içeri); ↑ basılı tutunca girer; kapıya yürüyünce kapı önüne çıkar', () => {
    const { sim, kennel, door } = atKennel(2231);
    const r = resolveAction(sim);
    expect(r.kind).toBe('kennel');
    expect(r.hint).toContain('↑ içeri');
    expect(performAction(sim).open).toBe('kennel');
    expect(sim.interior).toBeNull();
    hold(sim, UP, BALANCE.interior.pushEnterSec + 0.4, () => sim.interior !== null);
    expect(sim.interior?.kind).toBe('kennel');
    expect(sim.interior?.buildingId).toBe(kennel.id);
    expect(sim.player.tileY).toBe(sim.interior!.door.y - 1);
    expect(resolveAction(sim).hint).toContain('Kulübe içi');
    hold(sim, DOWN, 4, () => sim.interior === null);
    expect(sim.interior).toBeNull();
    expect(sim.player.tileX).toBe(door.x);
    expect(sim.player.tileY).toBe(door.y);
  });

  it('eşikte kapı sütunundan ↑ girer, öbür sütundan girmez; uzaktan kapıya dokunuş (enter) yürüyüp girer', () => {
    const { sim, kennel, door } = atKennel(2232);
    sim.player.x = door.x - 1 + 0.5;
    sim.player.y = door.y - 1 + 0.7;
    hold(sim, UP, 0.6);
    expect(sim.interior).toBeNull();
    sim.player.x = door.x + 0.5;
    sim.player.y = door.y - 1 + 0.7;
    hold(sim, UP, BALANCE.interior.pushEnterSec + 0.2, () => sim.interior !== null);
    expect(sim.interior?.buildingId).toBe(kennel.id);
    sim.exitInterior();
    sim.player.y = door.y + 3.9;
    expect(sim.command({ type: 'goInteract', goal: { kind: 'enter', id: kennel.id } }).ok).toBe(true);
    hold(sim, IDLE, 5, () => sim.interior !== null);
    expect(sim.interior?.kind).toBe('kennel');
  });

  it('pano eşya panelini açar; beş eşya alınır ve hemen yerinde; küçükte ikinci yatak yok, büyükte iki; kayıtta korunur', () => {
    const { sim, kennel } = atKennel(2233);
    sim.money = 5000;
    const dog = sim.shelterDogs()[0];
    if (dog.kennelId !== kennel.id) expect(sim.command({ type: 'assignKennel', dogId: dog.id, buildingId: kennel.id }).ok).toBe(true);
    expect(sim.enterBuilding(kennel.id).ok).toBe(true);
    const board = sim.interior!.items.find((i) => i.type === 'kennelBoard')!;
    sim.player.x = board.x + 0.5;
    sim.player.y = board.y + 1.7;
    sim.player.facing = 3;
    expect(resolveAction(sim).kind).toBe('restShop');
    const r = performAction(sim);
    expect(r.open).toBe('furniture');
    expect(r.building?.id).toBe(kennel.id);
    let changed = 0;
    sim.events.on('interiorChanged', () => changed++);
    for (const f of ['dogBed', 'blanket', 'dogBowl', 'dogToy', 'kennelWindow'] as const) {
      const before = sim.money;
      expect(sim.command({ type: 'buyFurniture', buildingId: kennel.id, item: f }).ok, f).toBe(true);
      expect(sim.money, f).toBe(before - BALANCE.interior.furniture[f].cost);
    }
    expect(changed).toBe(5);
    const second = sim.command({ type: 'buyFurniture', buildingId: kennel.id, item: 'dogBed' });
    expect(second.ok).toBe(false);
    expect(second.message).toContain('yer kalmadı');
    expect(sim.interior!.items.map((i) => i.type).sort()).toEqual(['blanket', 'dogBed', 'dogBowl', 'dogToy', 'kennelBoard', 'window']);
    // Yatağa bakınca sahibi: uyanıkken adı, uyurken "uyuyor".
    const bed = sim.interior!.items.find((i) => i.type === 'dogBed')!;
    sim.player.x = bed.x + 0.5;
    sim.player.y = bed.y + 1.7;
    sim.player.facing = 3;
    dog.state = 'idle';
    expect(resolveAction(sim).hint).toContain(dog.name);
    dog.state = 'sleep';
    expect(resolveAction(sim).hint).toContain('uyuyor');

    const large = placeLarge(sim);
    large.buildLeft = 10;
    expect(sim.command({ type: 'buyFurniture', buildingId: large.id, item: 'dogBed' }).ok).toBe(false);
    large.buildLeft = 0;
    expect(sim.command({ type: 'buyFurniture', buildingId: large.id, item: 'dogBed' }).ok).toBe(true);
    expect(sim.command({ type: 'buyFurniture', buildingId: large.id, item: 'dogBed' }).ok).toBe(true);
    expect(sim.command({ type: 'buyFurniture', buildingId: large.id, item: 'dogBed' }).ok).toBe(false);
    expect(sim.command({ type: 'buyFurniture', buildingId: large.id, item: 'sofa' }).ok).toBe(false);
    sim.money = 10;
    expect(sim.command({ type: 'buyFurniture', buildingId: large.id, item: 'kennelWindow' }).ok).toBe(false);

    const back = Sim.fromJSON(SaveManager.parse(JSON.stringify(sim.toJSON()))!);
    expect(back.buildingById(kennel.id)!.furniture).toEqual(['dogBed', 'blanket', 'dogBowl', 'dogToy', 'kennelWindow']);
    expect(back.buildingById(large.id)!.furniture).toEqual(['dogBed', 'dogBed']);
    expect(back.enterBuilding(large.id).ok).toBe(true);
    expect(back.interior!.items.filter((i) => i.type === 'dogBed').length).toBe(2);
  });

  it('içerideki yatış yeri: sıranın yatağı varsa yatakta, yoksa sıradaki halıda', () => {
    expect(kennelRestSpotInside(buildInterior('kennel'), 0)).toEqual({ x: 4, y: 4, bed: false });
    expect(kennelRestSpotInside(buildInterior('kennel'), 1)).toBeNull();
    expect(kennelRestSpotInside(buildInterior('kennel', ['dogBed']), 0)).toEqual({ x: 3, y: 3, bed: true });
    const one = buildInterior('kennelLarge', ['dogBed']);
    expect(kennelRestSpotInside(one, 0)).toEqual({ x: 4, y: 3, bed: true });
    expect(kennelRestSpotInside(one, 1)).toEqual({ x: 7, y: 4, bed: false });
    expect(kennelRestSpotInside(buildInterior('kennelLarge', ['dogBed', 'dogBed']), 1)).toEqual({ x: 7, y: 3, bed: true });
  });

  it('yeni eşya çizimleri dolu', () => {
    for (const type of ['kennelBoard', 'dogBed', 'blanket', 'dogBowl', 'dogToy'] as const) {
      const px = drawInteriorItem(type);
      let n = 0;
      for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) if (px.isOpaque(x, y)) n++;
      expect(n, type).toBeGreaterThan(60);
      expect(n, type).toBeLessThan(px.w * px.h);
    }
  });
});
