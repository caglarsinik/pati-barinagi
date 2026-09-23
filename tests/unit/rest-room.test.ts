import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { SaveManager } from '../../src/core/SaveManager';
import { drawInteriorItem } from '../../src/render/InteriorArt';
import { type Building, buildingDoorTile, canPlaceBuilding } from '../../src/sim/entities/Building';
import type { Staff } from '../../src/sim/entities/Staff';
import { buildInterior, sanitizeFurniture } from '../../src/sim/interior/Interiors';
import { Sim } from '../../src/sim/Sim';
import { performAction, resolveAction } from '../../src/sim/systems/Interaction';

const R = BALANCE.staff.rest;

function placeRoom(sim: Sim): Building {
  const p = sim.world.plotInterior();
  for (let y = p.y + 2; y < p.y + p.h - 4; y++) {
    for (let x = p.x + 2; x < p.x + p.w - 4; x++) {
      if (canPlaceBuilding(sim.world, 'staffRoom', x, y)) {
        const b = sim.placeBuilding('staffRoom', x, y)!;
        b.buildLeft = 0;
        return b;
      }
    }
  }
  throw new Error('oda yeri yok');
}

function hire(sim: Sim): Staff {
  sim.staffSystem.refreshCandidates();
  const c = sim.candidates[0];
  c.role = 'caretaker';
  c.attrs = { speed: 3, diligence: 3, empathy: 3, stamina: 3, skill: 3 };
  sim.money = 1e6;
  expect(sim.command({ type: 'hire', candidateId: c.id }).ok).toBe(true);
  const s = sim.staff.find((x) => x.id === c.id)!;
  s.schedule = new Array(24).fill(1) as typeof s.schedule;
  return s;
}

/** Personeli odanın kapısında molaya oturtur; bir kısa güncelleme odaya "girmesini" sağlar. */
function restAt(sim: Sim, room: Building, staff: Staff[], energy = 10): void {
  sim.staffSystem.update(0.01);
  const door = buildingDoorTile(room);
  for (const s of staff) {
    s.x = door.x + 0.5;
    s.y = door.y + 0.5;
    s.path = [];
    s.state = 'resting';
    s.energy = energy;
  }
  sim.staffSystem.update(0.01);
}

describe('Dinlenme odası (0.16.3)', () => {
  it('eşya alımı: para düşer, sınır, hazır değilken ve para yetmezken ret; kayıtta korunur', () => {
    const sim = Sim.create(1631);
    const room = placeRoom(sim);
    sim.money = 5000;
    expect(sim.command({ type: 'buyFurniture', buildingId: room.id, item: 'sofa' }).ok).toBe(true);
    expect(sim.money).toBe(5000 - BALANCE.interior.furniture.sofa.cost);
    expect(sim.command({ type: 'buyFurniture', buildingId: room.id, item: 'sofa' }).ok).toBe(true);
    const third = sim.command({ type: 'buyFurniture', buildingId: room.id, item: 'sofa' });
    expect(third.ok).toBe(false);
    expect(third.message).toContain('yer kalmadı');
    sim.money = 10;
    expect(sim.command({ type: 'buyFurniture', buildingId: room.id, item: 'tv' }).ok).toBe(false);
    sim.money = 5000;
    room.buildLeft = 10;
    expect(sim.command({ type: 'buyFurniture', buildingId: room.id, item: 'tv' }).ok).toBe(false);
    room.buildLeft = 0;
    expect(sim.command({ type: 'buyFurniture', buildingId: room.id, item: 'tv' }).ok).toBe(true);
    expect(room.furniture).toEqual(['sofa', 'sofa', 'tv']);
    const back = Sim.fromJSON(SaveManager.parse(JSON.stringify(sim.toJSON()))!);
    expect(back.buildingById(room.id)!.furniture).toEqual(['sofa', 'sofa', 'tv']);
    expect(sanitizeFurniture('restRoom', ['sofa', 'sofa', 'sofa', 'tv', 'x', 3])).toEqual(['sofa', 'sofa', 'tv']);
    expect(sanitizeFurniture('pantry', ['sofa'])).toEqual([]);
  });

  it('odaya girilir; pano eşya panelini açar; içerideyken alınan eşya hemen yerinde', () => {
    const sim = Sim.create(1632);
    const room = placeRoom(sim);
    const door = buildingDoorTile(room);
    sim.player.x = door.x + 0.5;
    sim.player.y = door.y + 0.9;
    sim.player.facing = 3;
    expect(resolveAction(sim).kind).toBe('enter');
    expect(performAction(sim).ok).toBe(true);
    expect(sim.interior?.kind).toBe('restRoom');
    expect(sim.interior!.items.map((i) => i.type)).toEqual(['restBoard']);
    const board = sim.interior!.items[0];
    sim.player.x = board.x + 0.5;
    sim.player.y = board.y + 1.7;
    sim.player.facing = 3;
    expect(resolveAction(sim).kind).toBe('restShop');
    const r = performAction(sim);
    expect(r.open).toBe('furniture');
    expect(r.building?.id).toBe(room.id);
    let changed = 0;
    sim.events.on('interiorChanged', () => changed++);
    sim.money = 5000;
    sim.command({ type: 'buyFurniture', buildingId: room.id, item: 'sofa' });
    sim.command({ type: 'buyFurniture', buildingId: room.id, item: 'fridge' });
    expect(changed).toBe(2);
    expect(sim.interior!.items.map((i) => i.type).sort()).toEqual(['fridge', 'restBoard', 'sofa']);
    const sofa = sim.interior!.items.find((i) => i.type === 'sofa')!;
    expect(sim.interior!.world.isSolid(sofa.x, sofa.y)).toBe(true);
    // Tam donanımlı oda: her eşya katı, çizimi dolu.
    const full = buildInterior('restRoom', ['sofa', 'sofa', 'coffee', 'tv', 'fridge']);
    expect(full.items.length).toBe(6);
    for (const it of full.items) {
      expect(full.world.isSolid(it.x, it.y), it.type).toBe(true);
      const px = drawInteriorItem(it.type);
      let n = 0;
      for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) if (px.isOpaque(x, y)) n++;
      expect(n, it.type).toBeGreaterThan(80);
    }
    expect(full.world.isSolid(full.door.x, full.door.y - 1)).toBe(false);
  });

  it('kanepe iki kişiye +%25, üçüncüye yok; kahve + TV moral; buzdolabı enerjiyi 100’e kadar doldurur', () => {
    const sim = Sim.create(1633);
    const room = placeRoom(sim);
    const staff = [hire(sim), hire(sim), hire(sim)];
    restAt(sim, room, staff);
    for (const s of staff) expect(s.insideId).toBe(room.id);
    expect(sim.staffSystem.restingIn(room).length).toBe(3);
    for (const s of staff) expect(sim.staffSystem.restRate(s)).toBe(BALANCE.staff.restRegenRoom);

    room.furniture.push('sofa');
    expect(sim.staffSystem.seatsIn(room)).toBe(R.seatsPerSofa);
    const rates = staff.map((s) => sim.staffSystem.restRate(s));
    expect(rates.filter((r) => r === BALANCE.staff.restRegenRoom * (1 + R.sofaRegenBonus)).length).toBe(2);
    expect(rates.filter((r) => r === BALANCE.staff.restRegenRoom).length).toBe(1);

    const s0 = staff[0];
    s0.morale = 50;
    sim.staffSystem.onHour();
    const plain = s0.morale - 50;
    room.furniture.push('coffee', 'tv');
    s0.morale = 50;
    sim.staffSystem.onHour();
    expect(s0.morale - 50 - plain).toBeCloseTo(R.coffeeMoralePerHour + R.tvMoralePerHour, 5);

    // Buzdolabı yokken 80'de, varken 100'de moladan döner.
    restAt(sim, room, [s0], 90);
    sim.staffSystem.update(1);
    expect(s0.state).not.toBe('resting');
    room.furniture.push('fridge');
    restAt(sim, room, [s0], 90);
    sim.staffSystem.update(1);
    expect(s0.state).toBe('resting');
    s0.energy = 99.99;
    sim.staffSystem.update(1);
    expect(s0.state).not.toBe('resting');
  });
});
