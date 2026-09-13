import { describe, expect, it, vi } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { canPlaceBuilding } from '../../src/sim/entities/Building';
import { Sim } from '../../src/sim/Sim';
import { runInspection } from '../../src/sim/systems/EconomySystem';
import {
  cleanMinutesMul,
  effectiveMessCount,
  looseMessCount,
  messHygienePenalty,
  placeMess,
  toiletCapacity,
  toiletFull,
  toiletMessCount,
} from '../../src/sim/systems/MessSystem';
import type { TilePos } from '../../src/sim/world/TileWorld';
import { Obj, Zone } from '../../src/sim/world/tiles';

/** Oyun dakikası cinsinden ilerletir (hız 4x, yarım saniyelik adımlar). */
function runMinutes(sim: Sim, minutes: number): void {
  sim.setSpeed(4);
  const perStep = 0.5 * BALANCE.time.minutesPerRealSecond * 4;
  for (let i = 0; i < Math.ceil(minutes / perStep); i++) sim.update(0.5);
}

/** Köpeği tuvalete hazırlar: tok, dinç, mesane dolu. */
function readyDog(sim: Sim, potty: number) {
  const dog = sim.dogs[0];
  dog.skills.potty = potty;
  dog.needs.hunger = 10;
  dog.needs.thirst = 10;
  dog.needs.energy = 90;
  dog.needs.bladder = 95;
  return dog;
}

function zoneTiles(sim: Sim): TilePos[] {
  return [...sim.world.zoneTiles(Zone.Toilet)];
}

/** Arsa içinde bölge dışı, binasız boş bir kare (sol üstten tarar). */
function freeLooseTile(sim: Sim): TilePos {
  const w = sim.world;
  const r = w.plotInterior();
  for (let y = r.y + 1; y < r.y + r.h - 1; y++) {
    for (let x = r.x + 1; x < r.x + r.w - 1; x++) {
      if (!w.isSolid(x, y) && w.objectAt(x, y) === Obj.None && w.zoneAt(x, y) === Zone.None && w.buildingIdAt(x, y) === -1) return { x, y };
    }
  }
  throw new Error('boş kare yok');
}

/** Alanın ilk n karesine pislik koyar. */
function fillToilet(sim: Sim, from: number, to: number): void {
  const tiles = zoneTiles(sim);
  for (let k = from; k < to; k++) expect(placeMess(sim, tiles[k].x, tiles[k].y, Zone.Toilet)).toEqual(tiles[k]);
}

describe('Tuvalet alanı', () => {
  it('eğitimli köpek alana yapar; alandaki pislik kapsanır', () => {
    const sim = Sim.create(1201);
    const dog = readyDog(sim, 100);
    runMinutes(sim, 120);
    expect(sim.messTiles.size).toBe(1);
    const i = [...sim.messTiles][0];
    expect(sim.world.zone[i]).toBe(Zone.Toilet);
    expect(messHygienePenalty(sim, i)).toBe(0);
    expect(effectiveMessCount(sim)).toBeCloseTo(BALANCE.toilet.containedInspectionMul);
    expect(dog.needs.bladder).toBeLessThan(50);
    expect(sim.stats.messes).toBe(1);
  });

  it('yarı eğitimli köpek zara göre alana gider ya da olduğu yere yapar', () => {
    const a = Sim.create(1202);
    const origA = a.rng.chance.bind(a.rng);
    vi.spyOn(a.rng, 'chance').mockImplementation((p) => (p === 0.5 ? true : origA(p)));
    readyDog(a, 50);
    runMinutes(a, 120);
    expect(toiletMessCount(a)).toBe(1);
    expect(looseMessCount(a)).toBe(0);

    const b = Sim.create(1202);
    const origB = b.rng.chance.bind(b.rng);
    vi.spyOn(b.rng, 'chance').mockImplementation((p) => (p === 0.5 ? false : origB(p)));
    readyDog(b, 50);
    runMinutes(b, 30);
    expect(looseMessCount(b)).toBe(1);
    expect(toiletMessCount(b)).toBe(0);
  });

  it('tuvalet bölgesi silinmişse eğitimli köpek olduğu yere yapar', () => {
    const sim = Sim.create(1203);
    for (const t of zoneTiles(sim)) sim.world.setZone(t.x, t.y, Zone.None);
    readyDog(sim, 100);
    runMinutes(sim, 30);
    expect(looseMessCount(sim)).toBe(1);
  });

  it('hijyen cezası: serbest pislik düşürür, kapsanan düşürmez, alan dolunca düşürür', () => {
    const sim = Sim.create(1204);
    const w = sim.world;
    const P = BALANCE.dogs.needs.hygieneMessPenalty;
    const loose = freeLooseTile(sim);
    expect(placeMess(sim, loose.x, loose.y)).toEqual(loose);
    expect(messHygienePenalty(sim, w.idx(loose.x, loose.y))).toBe(P);
    const tiles = zoneTiles(sim);
    fillToilet(sim, 0, 1);
    const ci = w.idx(tiles[0].x, tiles[0].y);
    expect(messHygienePenalty(sim, ci)).toBe(0);
    expect(messHygienePenalty(sim, w.idx(tiles[1].x, tiles[1].y))).toBe(0); // pislik yok
    fillToilet(sim, 1, toiletCapacity(sim));
    expect(toiletFull(sim)).toBe(true);
    expect(messHygienePenalty(sim, ci)).toBe(P);
  });

  it('alan dolunca uyarı çıkar ve denetimde tam sayılır', () => {
    const sim = Sim.create(1205);
    const cap = toiletCapacity(sim);
    const tiles = zoneTiles(sim);
    fillToilet(sim, 0, cap - 1);
    expect(toiletFull(sim)).toBe(false);
    sim.alerts.refresh();
    expect(sim.alerts.alerts.some((a) => a.id === 'toiletFull')).toBe(false);
    expect(sim.alerts.alerts.some((a) => a.id === 'mess')).toBe(false);
    let item = runInspection(sim).items.find((i) => i.name === 'Pislik')!;
    expect(item.value).toBe(`0 (+${cap - 1})`);
    expect(item.effect).toBeCloseTo(-Math.min(1, ((cap - 1) * BALANCE.toilet.containedInspectionMul) / 5));
    fillToilet(sim, cap - 1, cap);
    expect(toiletFull(sim)).toBe(true);
    sim.alerts.refresh();
    const alert = sim.alerts.alerts.find((a) => a.id === 'toiletFull')!;
    expect(alert).toBeDefined();
    expect(alert.severity).toBe('warn');
    expect(alert.tile).toEqual(tiles[0]);
    item = runInspection(sim).items.find((i) => i.name === 'Pislik')!;
    expect(item.value).toBe(`0 (+${cap})`);
    expect(item.effect).toBeCloseTo(-Math.min(1, cap / 5));
  });

  it('personel aciliyeti: kapsanan düşük, serbest yüksek, alan dolunca yükselir', () => {
    const sim = Sim.create(1206);
    const T = BALANCE.toilet;
    const tiles = zoneTiles(sim);
    const loose = freeLooseTile(sim);
    fillToilet(sim, 0, 1);
    placeMess(sim, loose.x, loose.y);
    sim.tasks.refresh();
    const urg = (t: TilePos): number => sim.tasks.tasks.find((k) => k.type === 'clean' && k.tile.x === t.x && k.tile.y === t.y)!.urgency;
    expect(urg(tiles[0])).toBeCloseTo(T.staffUrgencyBase + T.staffUrgencyPerMess);
    expect(urg(loose)).toBeCloseTo(0.5);
    fillToilet(sim, 1, toiletCapacity(sim));
    sim.tasks.refresh();
    expect(urg(tiles[0])).toBeCloseTo(T.staffUrgencyFull);
  });

  it('başlangıç çöp kutusu tuvalet alanının yanındadır', () => {
    const sim = Sim.create(1208);
    const T = BALANCE.toilet;
    expect(toiletCapacity(sim)).toBe(T.capacity + T.binCapacityBonus);
    expect(cleanMinutesMul(sim, zoneTiles(sim)[0])).toBe(T.binCleanMul);
  });

  it('çöp kutusu yakınsa kapasite artar ve temizlik hızlanır', () => {
    const sim = Sim.create(1207);
    const T = BALANCE.toilet;
    const tiles = zoneTiles(sim);
    for (const b of [...sim.buildings]) if (b.type === 'bin') sim.removeBuilding(b.id);
    expect(toiletCapacity(sim)).toBe(T.capacity);
    expect(cleanMinutesMul(sim, tiles[0])).toBe(1);
    const spot = { x: tiles[0].x, y: tiles[0].y - 2 };
    expect(canPlaceBuilding(sim.world, 'bin', spot.x, spot.y)).toBe(true);
    sim.placeBuilding('bin', spot.x, spot.y, 0);
    expect(toiletCapacity(sim)).toBe(T.capacity + T.binCapacityBonus);
    expect(cleanMinutesMul(sim, tiles[0])).toBe(T.binCleanMul);
    const far = freeLooseTile(sim);
    expect(Math.max(Math.abs(far.x - spot.x), Math.abs(far.y - spot.y))).toBeGreaterThan(T.binRadius);
    expect(cleanMinutesMul(sim, far)).toBe(1);
  });
});
