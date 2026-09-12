import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { BUILDING_DEFS, PLOT_EXPANSION_COST, TILE_TOOL_DEFS } from '../../src/content/buildings';
import { SaveManager } from '../../src/core/SaveManager';
import { isReady } from '../../src/sim/entities/Building';
import { Sim } from '../../src/sim/Sim';
import { Ground, Obj, Zone } from '../../src/sim/world/tiles';

function runMinutes(sim: Sim, minutes: number): void {
  sim.setSpeed(4);
  const perStep = 0.5 * BALANCE.time.minutesPerRealSecond * 4;
  for (let i = 0; i < Math.ceil(minutes / perStep); i++) sim.update(0.5);
}

/** Arsa içinde boş bir kare bulur. */
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

describe('İnşa', () => {
  it('bina yerleşir, para düşer, inşaat bitince kullanılır', () => {
    const sim = Sim.create(61);
    const spot = freeSpot(sim, 2, 2);
    const m0 = sim.money;
    const r = sim.command({ type: 'placeBuilding', building: 'kennelSmall', x: spot.x, y: spot.y });
    expect(r.ok).toBe(true);
    expect(sim.money).toBe(m0 - BUILDING_DEFS.kennelSmall.cost);
    const b = r.building!;
    expect(isReady(b)).toBe(false);
    expect(sim.world.isSolid(spot.x, spot.y)).toBe(true);
    expect(sim.kennelCapacity()).toBe(2); // yeni kulübe henüz sayılmaz
    runMinutes(sim, BUILDING_DEFS.kennelSmall.buildMinutes + 10);
    expect(isReady(b)).toBe(true);
    expect(sim.kennelCapacity()).toBe(3);
    // Üstüne başka bina konamaz
    expect(sim.command({ type: 'placeBuilding', building: 'bowl', x: spot.x, y: spot.y }).ok).toBe(false);
  });

  it('para yoksa ya da çit dışına yerleşmez', () => {
    const sim = Sim.create(62);
    const spot = freeSpot(sim, 3, 3);
    sim.money = 10;
    expect(sim.command({ type: 'placeBuilding', building: 'vetClinic', x: spot.x, y: spot.y }).ok).toBe(false);
    sim.money = 100000;
    const p = sim.world.plot;
    expect(sim.command({ type: 'placeBuilding', building: 'bowl', x: p.x - 3, y: p.y + 5 }).ok).toBe(false);
    expect(sim.command({ type: 'placeBuilding', building: 'bowl', x: p.x, y: p.y + 5 }).ok).toBe(false); // çit satırı
    expect(sim.command({ type: 'placeBuilding', building: 'office', x: spot.x, y: spot.y }).ok).toBe(false); // inşa edilemez
  });

  it('çit çizgisi, kapı ve yol yerleşir; yıkım iade eder', () => {
    const sim = Sim.create(63);
    const spot = freeSpot(sim, 6, 1);
    const tiles = Array.from({ length: 6 }, (_, i) => ({ x: spot.x + i, y: spot.y }));
    const m0 = sim.money;
    const r = sim.command({ type: 'placeTiles', tool: 'fence', tiles });
    expect(r.ok).toBe(true);
    expect(sim.money).toBe(m0 - 6 * TILE_TOOL_DEFS.fence.cost);
    for (const t of tiles) expect(sim.world.objectAt(t.x, t.y)).toBe(Obj.Fence);
    // Çitin ortasına kapı
    expect(sim.command({ type: 'placeTiles', tool: 'gate', tiles: [tiles[2]] }).ok).toBe(true);
    expect(sim.world.objectAt(tiles[2].x, tiles[2].y)).toBe(Obj.Gate);
    expect(sim.world.isSolid(tiles[2].x, tiles[2].y)).toBe(false);
    // Yol
    const pathTile = { x: spot.x, y: spot.y + 1 };
    expect(sim.command({ type: 'placeTiles', tool: 'path', tiles: [pathTile] }).ok).toBe(true);
    expect(sim.world.groundAt(pathTile.x, pathTile.y)).toBe(Ground.Path);
    // Yıkım
    const m1 = sim.money;
    expect(sim.command({ type: 'demolish', x: tiles[0].x, y: tiles[0].y }).ok).toBe(true);
    expect(sim.world.objectAt(tiles[0].x, tiles[0].y)).toBe(Obj.None);
    expect(sim.money).toBe(m1 + Math.round(TILE_TOOL_DEFS.fence.cost * 0.5));
    const bowl = sim.buildings.find((b) => b.type === 'bowl')!;
    const m2 = sim.money;
    expect(sim.command({ type: 'demolish', x: bowl.x, y: bowl.y }).ok).toBe(true);
    expect(sim.buildings.some((b) => b.type === 'bowl')).toBe(false);
    expect(sim.money).toBe(m2 + Math.round(BUILDING_DEFS.bowl.cost * 0.5));
    const office = sim.buildings.find((b) => b.type === 'office')!;
    expect(sim.command({ type: 'demolish', x: office.x, y: office.y }).ok).toBe(false);
  });

  it('bölge boyama binaları ve çitleri atlar', () => {
    const sim = Sim.create(64);
    const office = sim.buildings.find((b) => b.type === 'office')!;
    const r = sim.command({ type: 'paintZone', zone: Zone.Play, x0: office.x - 2, y0: office.y - 2, x1: office.x + 4, y1: office.y + 4 });
    expect(r.ok).toBe(true);
    expect(sim.world.zoneAt(office.x - 1, office.y - 1)).toBe(Zone.Play);
    expect(sim.world.zoneAt(office.x, office.y)).toBe(Zone.None);
    expect(sim.world.zoneTiles(Zone.Play).length).toBeGreaterThan(20);
    // Silme
    sim.command({ type: 'paintZone', zone: Zone.None, x0: office.x - 2, y0: office.y - 2, x1: office.x + 4, y1: office.y + 4 });
    expect(sim.world.zoneTiles(Zone.Play).length).toBe(0);
  });

  it('arsa doğuya genişler: çit taşınır, yol kapısı açılır, yuvalar temizlenir', () => {
    const sim = Sim.create(65);
    const p0 = { ...sim.world.plot };
    const oldRight = p0.x + p0.w - 1;
    const gateY = Math.floor(p0.y + p0.h / 2);
    expect(sim.world.objectAt(oldRight, gateY)).toBe(Obj.Gate);
    const nestsBefore = sim.world.nests.length;
    const m0 = sim.money;
    const r = sim.command({ type: 'expandPlot', dir: 'east' });
    expect(r.ok).toBe(true);
    expect(sim.money).toBe(m0 - PLOT_EXPANSION_COST);
    const p1 = sim.world.plot;
    expect(p1.w).toBe(p0.w + 16);
    const newRight = p1.x + p1.w - 1;
    // Eski doğu çiti gitti, yeni doğu çiti geldi, yol yeni çitte kapı
    expect(sim.world.objectAt(oldRight, p0.y + 5)).toBe(Obj.None);
    expect(sim.world.objectAt(newRight, p0.y + 5)).toBe(Obj.Fence);
    let gates = 0;
    for (let y = p1.y; y < p1.y + p1.h; y++) if (sim.world.objectAt(newRight, y) === Obj.Gate) gates++;
    expect(gates).toBeGreaterThanOrEqual(1);
    // Üst ve alt çit uzadı
    expect(sim.world.objectAt(oldRight + 8, p1.y)).toBe(Obj.Fence);
    expect(sim.world.objectAt(oldRight + 8, p1.y + p1.h - 1)).toBe(Obj.Fence);
    // Yeni alan temiz ve inşa edilebilir
    for (let y = p1.y + 1; y < p1.y + p1.h - 1; y++) {
      for (let x = oldRight + 1; x < newRight; x++) {
        const o = sim.world.objectAt(x, y);
        expect(o === Obj.None || o === Obj.Gate).toBe(true);
        expect(sim.world.inPlotInterior(x, y)).toBe(true);
      }
    }
    expect(sim.world.nests.length).toBeLessThanOrEqual(nestsBefore);
    expect(sim.command({ type: 'placeBuilding', building: 'bowl', x: oldRight + 5, y: p1.y + 5 }).ok).toBe(true);
    // Kayıt gidiş dönüşünde arsa boyutu korunur
    const back = Sim.fromJSON(SaveManager.parse(JSON.stringify(sim.toJSON()))!);
    expect(back.world.plot).toEqual(p1);
    expect(back.world.object).toEqual(sim.world.object);
    expect(back.world.solid).toEqual(sim.world.solid);
    // Sınır: 3 kez doğuya sonra dur
    sim.money = 100000;
    expect(sim.command({ type: 'expandPlot', dir: 'east' }).ok).toBe(true);
    expect(sim.command({ type: 'expandPlot', dir: 'east' }).ok).toBe(true);
    expect(sim.command({ type: 'expandPlot', dir: 'east' }).ok).toBe(false);
  });

  it('mutfak kap kapasitesini ikiye katlar', () => {
    const sim = Sim.create(66);
    const bowl = sim.buildings.find((b) => b.type === 'bowl')!;
    expect(sim.bowlCapacity(bowl)).toBe(4);
    const spot = freeSpot(sim, 3, 2);
    const r = sim.command({ type: 'placeBuilding', building: 'kitchen', x: spot.x, y: spot.y });
    expect(r.ok).toBe(true);
    expect(sim.bowlCapacity(bowl)).toBe(4);
    runMinutes(sim, BUILDING_DEFS.kitchen.buildMinutes + 10);
    expect(sim.bowlCapacity(bowl)).toBe(8);
  });
});
