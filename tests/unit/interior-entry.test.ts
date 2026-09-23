import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { buildingDoorTile } from '../../src/sim/entities/Building';
import type { PlayerInput } from '../../src/sim/entities/Player';
import { Sim } from '../../src/sim/Sim';
import { performAction, resolveAction } from '../../src/sim/systems/Interaction';

const UP: PlayerInput = { dx: 0, dy: -1, run: false };
const IDLE: PlayerInput = { dx: 0, dy: 0, run: false };

/** Kilerin kapı önünde, yüzü kilere dönük. */
function atShed(seed: number) {
  const sim = Sim.create(seed);
  const shed = sim.buildings.find((b) => b.type === 'shed')!;
  const door = buildingDoorTile(shed);
  sim.player.x = door.x + 0.5;
  sim.player.y = door.y + 0.9;
  sim.player.facing = 3;
  return { sim, shed, door };
}

function hold(sim: Sim, input: PlayerInput, sec: number): void {
  for (let i = 0; i < Math.round(sec * 60); i++) sim.update(1 / 60, input);
}

describe('İç mekân giriş kuralı (0.17.0)', () => {
  it('kapıda E hâlâ hızlı iş (kiler paneli), ipucu ↑ ile girişi söyler', () => {
    const { sim } = atShed(1701);
    const r = resolveAction(sim);
    expect(r.kind).toBe('shed');
    expect(r.hint).toContain('↑ içeri');
    expect(performAction(sim).open).toBe('shed');
    expect(sim.interior).toBeNull();
  });

  it('kapıda ↑ basılı tutunca kilere girer; kısa basışlar birikmez', () => {
    const { sim } = atShed(1702);
    const half = BALANCE.interior.pushEnterSec * 0.6;
    hold(sim, UP, half);
    hold(sim, IDLE, 0.05);
    hold(sim, UP, half);
    expect(sim.interior).toBeNull();
    hold(sim, UP, BALANCE.interior.pushEnterSec + 0.1);
    expect(sim.interior?.kind).toBe('pantry');
  });

  it('kapı karesi dokunuşu (enter hedefi) kapıya yürüyüp içeri sokar; bina dokunuşu hızlı iş', () => {
    const { sim, shed, door } = atShed(1703);
    sim.player.y = door.y + 2.9;
    let open: string | undefined;
    sim.events.on('interacted', (e) => (open = e.result.open));
    expect(sim.command({ type: 'goInteract', goal: { kind: 'building', id: shed.id } }).ok).toBe(true);
    hold(sim, IDLE, 4);
    expect(open).toBe('shed');
    expect(sim.interior).toBeNull();
    sim.player.y = door.y + 2.9;
    expect(sim.command({ type: 'goInteract', goal: { kind: 'enter', id: shed.id } }).ok).toBe(true);
    hold(sim, IDLE, 4);
    expect(sim.interior?.kind).toBe('pantry');
    expect(sim.interior?.buildingId).toBe(shed.id);
  });

  it('ofiste E yine içeri sokar; ↑ ile de girilir', () => {
    const sim = Sim.create(1704);
    const office = sim.buildings.find((b) => b.type === 'office')!;
    const door = buildingDoorTile(office);
    sim.player.x = door.x + 0.5;
    sim.player.y = door.y + 0.9;
    sim.player.facing = 3;
    expect(resolveAction(sim).kind).toBe('enter');
    hold(sim, UP, BALANCE.interior.pushEnterSec + 0.1);
    expect(sim.interior?.kind).toBe('office');
  });
});
