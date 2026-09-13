import { describe, expect, it } from 'vitest';
import { BUILDING_DEFS } from '../../src/content/buildings';
import { drawBuilding } from '../../src/render/BuildingArt';
import { buildingDoorTile, buildingFootprint, canPlaceBuilding, canRotate, kennelRestTile, solidRowsFor } from '../../src/sim/entities/Building';
import { Sim } from '../../src/sim/Sim';
import { Obj } from '../../src/sim/world/tiles';

/** Arsa içinde çevresi de boş bir yer bulur. */
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

describe('Bina döndürme', () => {
  it('kare olmayan binalar döner; katı satır kuralı alt eşiği korur', () => {
    expect(canRotate('kennelLarge')).toBe(true);
    expect(canRotate('toyTunnel')).toBe(true);
    expect(canRotate('kennelSmall')).toBe(false);
    expect(canRotate('bowl')).toBe(false);
    expect(solidRowsFor(BUILDING_DEFS.kennelLarge, 0)).toBe(1);
    expect(solidRowsFor(BUILDING_DEFS.kennelLarge, 1)).toBe(2);
    expect(solidRowsFor(BUILDING_DEFS.kitchen, 1)).toBe('all');
    expect(solidRowsFor(BUILDING_DEFS.toyTunnel, 1)).toBe(0);
  });

  it('döndürülmüş büyük kulübe 2×3 yerleşir: üst iki satır katı, alt satır eşik, kapı altta', () => {
    const sim = Sim.create(1501);
    const spot = freeSpot(sim, 3, 3);
    sim.money = 5000;
    const r = sim.command({ type: 'placeBuilding', building: 'kennelLarge', x: spot.x, y: spot.y, rot: 1 });
    expect(r.ok).toBe(true);
    const b = r.building!;
    expect(b.rot).toBe(1);
    expect(buildingFootprint(b)).toEqual({ x: spot.x, y: spot.y, w: 2, h: 3 });
    for (const col of [0, 1]) {
      expect(sim.world.isSolid(spot.x + col, spot.y)).toBe(true);
      expect(sim.world.isSolid(spot.x + col, spot.y + 1)).toBe(true);
      expect(sim.world.isSolid(spot.x + col, spot.y + 2)).toBe(false);
      expect(sim.world.buildingIdAt(spot.x + col, spot.y + 2)).toBe(b.id);
    }
    expect(sim.world.buildingIdAt(spot.x + 2, spot.y)).toBe(-1);
    expect(buildingDoorTile(b)).toEqual({ x: spot.x + 1, y: spot.y + 3 });
    expect(kennelRestTile(b, 0)).toEqual({ x: spot.x, y: spot.y + 2 });
    expect(kennelRestTile(b, 1)).toEqual({ x: spot.x + 1, y: spot.y + 2 });
    // Kayıt gidiş-dönüş döndürmeyi korur.
    const back = Sim.fromJSON(JSON.parse(JSON.stringify(sim.toJSON())));
    const bb = back.buildingById(b.id)!;
    expect(bb.rot).toBe(1);
    expect(back.world.isSolid(spot.x, spot.y + 1)).toBe(true);
    expect(back.world.isSolid(spot.x, spot.y + 2)).toBe(false);
    // Yıkım döndürülmüş ayak izini temizler.
    expect(sim.command({ type: 'demolish', x: spot.x, y: spot.y + 2 }).ok).toBe(true);
    expect(sim.world.buildingIdAt(spot.x, spot.y)).toBe(-1);
    expect(sim.world.isSolid(spot.x, spot.y + 1)).toBe(false);
  });

  it('dar boşluğa yalnız döndürülmüş hali sığar; kare bina rot 1 → 0', () => {
    const sim = Sim.create(1502);
    const w = sim.world;
    const spot = freeSpot(sim, 4, 5);
    const x0 = spot.x + 1;
    const y0 = spot.y + 1;
    for (let y = y0 - 1; y <= y0 + 3; y++) {
      w.setObject(x0 - 1, y, Obj.Fence);
      w.setObject(x0 + 2, y, Obj.Fence);
    }
    for (let x = x0; x <= x0 + 1; x++) {
      w.setObject(x, y0 - 1, Obj.Fence);
      w.setObject(x, y0 + 3, Obj.Fence);
    }
    expect(canPlaceBuilding(w, 'kennelLarge', x0, y0, 0)).toBe(false);
    expect(canPlaceBuilding(w, 'kennelLarge', x0, y0, 1)).toBe(true);
    expect(canPlaceBuilding(w, 'kennelLarge', x0, y0 + 1, 1)).toBe(false); // alt çite taşar
    sim.money = 5000;
    const r = sim.command({ type: 'placeBuilding', building: 'kennelSmall', x: x0, y: y0, rot: 1 });
    expect(r.ok).toBe(true);
    expect(r.building!.rot).toBe(0);
  });

  it('döndürülmüş dokular boyut takas eder ve boş değildir', () => {
    for (const type of ['kennelLarge', 'kitchen', 'staffRoom', 'toyTunnel', 'bench'] as const) {
      const d = BUILDING_DEFS[type];
      const a = drawBuilding(type, 0, 0);
      const b = drawBuilding(type, 0, 1);
      expect(a.w).toBe(d.w * 16);
      expect(b.w).toBe(d.h * 16);
      expect(b.h).toBe(d.w * 16 + 10);
      let opaque = 0;
      for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) if (b.isOpaque(x, y)) opaque++;
      expect(opaque, type).toBeGreaterThan(b.w * b.h * 0.3);
    }
  });
});
