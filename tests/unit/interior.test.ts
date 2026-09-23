import { describe, expect, it } from 'vitest';
import { SaveManager } from '../../src/core/SaveManager';
import { drawInteriorItem } from '../../src/render/InteriorArt';
import { buildingDoorTile } from '../../src/sim/entities/Building';
import type { PlayerInput } from '../../src/sim/entities/Player';
import { buildInterior, interiorItemAt } from '../../src/sim/interior/Interiors';
import { Sim } from '../../src/sim/Sim';
import type { ActionOutcome } from '../../src/sim/systems/Interaction';
import { resolveAction } from '../../src/sim/systems/Interaction';
import { Ground } from '../../src/sim/world/tiles';

const IDLE: PlayerInput = { dx: 0, dy: 0, run: false };

/** Ofis kapısının önünde, yüzü binaya dönük başlayan oyun. */
function atOfficeDoor(seed: number): { sim: Sim; door: { x: number; y: number }; officeId: number } {
  const sim = Sim.create(seed);
  const office = sim.buildings.find((b) => b.type === 'office')!;
  const door = buildingDoorTile(office);
  sim.player.x = door.x + 0.5;
  sim.player.y = door.y + 0.9;
  sim.player.facing = 3;
  return { sim, door, officeId: office.id };
}

/** Koşul sağlanana dek (en çok `sec` saniye) 30 kare/sn girdiyle ilerlet. */
function stepUntil(sim: Sim, input: PlayerInput, sec: number, done: () => boolean): void {
  for (let i = 0; i < sec * 30 && !done(); i++) sim.update(1 / 30, input);
}

describe('İç mekân altyapısı (0.16.0)', () => {
  it('ofis şablonu: boyut, kapı, duvarlar katı, masa katı, giriş noktası boş', () => {
    const m = buildInterior('office');
    expect(m.world.width).toBe(12);
    expect(m.world.height).toBe(8);
    expect(m.world.groundAt(m.door.x, m.door.y)).toBe(Ground.Doorway);
    expect(m.world.isSolid(m.door.x, m.door.y)).toBe(false);
    expect(m.world.isSolid(m.door.x - 1, m.door.y)).toBe(true);
    expect(m.world.isSolid(0, 3)).toBe(true);
    expect(m.world.isSolid(5, 1)).toBe(true);
    const desk = m.items.find((i) => i.type === 'desk')!;
    expect(m.world.isSolid(desk.x, desk.y)).toBe(true);
    expect(interiorItemAt(m, desk.x + desk.w - 1, desk.y)).toBe(desk);
    expect(interiorItemAt(m, desk.x, desk.y + 1)).toBeNull();
    expect(m.world.isSolid(Math.floor(m.spawn.x), Math.floor(m.spawn.y - 0.2))).toBe(false);
  });

  it('kapıda E ile girilir; içeride yürünür, duvardan geçilmez, zaman akar; kapıya basınca dışarı', () => {
    const { sim, door } = atOfficeDoor(1601);
    expect(resolveAction(sim).kind).toBe('enter');
    expect(sim.command({ type: 'interact' }).ok).toBe(true);
    const it = sim.interior!;
    expect(it).not.toBeNull();
    expect(sim.playerWorld).toBe(it.world);
    expect(sim.player.tileX).toBe(it.door.x);
    expect(sim.player.tileY).toBe(it.door.y - 1);
    expect(sim.playerOutside.tileX).toBe(door.x);
    expect(sim.playerOutside.tileY).toBe(door.y);
    const t0 = sim.clock.totalMinutes;
    stepUntil(sim, { dx: 0, dy: -1, run: false }, 3, () => false);
    expect(sim.interior).not.toBeNull();
    expect(sim.player.tileY).toBe(2);
    expect(sim.clock.totalMinutes).toBeGreaterThan(t0);
    stepUntil(sim, { dx: 0, dy: 1, run: false }, 5, () => sim.interior === null);
    expect(sim.interior).toBeNull();
    expect(sim.playerWorld).toBe(sim.world);
    expect(sim.player.tileX).toBe(door.x);
    expect(sim.player.tileY).toBe(door.y);
  });

  it('içeride dokun-yürü: masaya git → ofis paneli; kapıya dokun → dışarı', () => {
    const { sim, door } = atOfficeDoor(1602);
    sim.command({ type: 'interact' });
    const it = sim.interior!;
    const desk = it.items[0];
    let got: ActionOutcome | null = null;
    sim.events.on('interacted', (e) => (got = e.result));
    expect(sim.command({ type: 'goInteract', goal: { kind: 'object', tile: { x: desk.x + 1, y: desk.y } } }).ok).toBe(true);
    stepUntil(sim, IDLE, 8, () => got !== null);
    expect(got).not.toBeNull();
    expect(got!.open).toBe('computer');
    expect(resolveAction(sim).kind).toBe('computer');
    expect(sim.command({ type: 'goTo', x: it.door.x, y: it.door.y }).ok).toBe(true);
    stepUntil(sim, IDLE, 8, () => sim.interior === null);
    expect(sim.interior).toBeNull();
    expect(sim.player.tileX).toBe(door.x);
    expect(sim.player.tileY).toBe(door.y);
  });

  it('yönetim modu ve otopilot dışarı çıkarır; içeride kayıt kapı önüne yazılır', () => {
    const { sim, door, officeId } = atOfficeDoor(1603);
    expect(sim.command({ type: 'enterBuilding', buildingId: officeId }).ok).toBe(true);
    const back = Sim.fromJSON(SaveManager.parse(JSON.stringify(sim.toJSON()))!);
    expect(back.interior).toBeNull();
    expect(back.player.tileX).toBe(door.x);
    expect(back.player.tileY).toBe(door.y);
    sim.setMode('manage');
    expect(sim.interior).toBeNull();
    expect(sim.player.tileX).toBe(door.x);
    sim.setMode('avatar');
    expect(sim.command({ type: 'enterBuilding', buildingId: officeId }).ok).toBe(true);
    sim.command({ type: 'setAutopilot', on: true });
    expect(sim.interior).toBeNull();
    // Otopilot açıkken girilmez.
    expect(sim.enterBuilding(officeId).ok).toBe(false);
  });

  it('girilemeyen bina reddedilir; masa çizimi dolu', () => {
    const { sim } = atOfficeDoor(1604);
    const other = sim.buildings.find((b) => b.type !== 'office')!;
    expect(sim.enterBuilding(other.id).ok).toBe(false);
    expect(sim.interior).toBeNull();
    const desk = drawInteriorItem('desk');
    let n = 0;
    for (let y = 0; y < desk.h; y++) for (let x = 0; x < desk.w; x++) if (desk.isOpaque(x, y)) n++;
    expect(n).toBeGreaterThan(200);
    expect(n).toBeLessThan(desk.w * desk.h);
  });
});
