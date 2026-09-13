import { describe, expect, it } from 'vitest';
import { IDLE_INPUT } from '../../src/sim/entities/Player';
import { Sim } from '../../src/sim/Sim';
import type { TilePos } from '../../src/sim/world/TileWorld';

/** Gerçek zamanlı kareler (30 fps), klavye boş. */
function runSeconds(sim: Sim, sec: number, input = IDLE_INPUT): void {
  const dt = 1 / 30;
  for (let i = 0; i < Math.ceil(sec / dt); i++) sim.update(dt, input);
}

function footTile(sim: Sim): TilePos {
  return { x: sim.player.tileX, y: sim.player.tileY };
}

/** Oyuncunun yakınında yürünebilir bir kare (doğuya doğru tarar). */
function freeTileEast(sim: Sim, dist: number): TilePos {
  const w = sim.world;
  const p = footTile(sim);
  for (let d = dist; d < dist + 12; d++) {
    for (let dy = 0; dy <= 2; dy++) {
      const c = { x: p.x + d, y: p.y + dy };
      if (w.inBounds(c.x, c.y) && !w.isSolid(c.x, c.y)) return c;
    }
  }
  throw new Error('boş kare yok');
}

describe('Dokun-git (PlayerNav)', () => {
  it('kareye yürür ve varınca durur', () => {
    const sim = Sim.create(1001);
    sim.setSpeed(1);
    const target = freeTileEast(sim, 6);
    expect(sim.command({ type: 'goTo', x: target.x, y: target.y }).ok).toBe(true);
    expect(sim.nav.active).toBe(true);
    runSeconds(sim, 6);
    expect(sim.nav.active).toBe(false);
    const p = sim.player;
    expect(Math.hypot(p.x - (target.x + 0.5), p.y - 0.2 - (target.y + 0.5))).toBeLessThan(1);
  });

  it('arsa dışından kapıdan geçip içeri girer', () => {
    const sim = Sim.create(1002);
    sim.setSpeed(1);
    // Oyuncuyu doğu kapısının dışına koy (yol oradan başlar).
    const plot = sim.world.plot;
    sim.player.x = plot.x + plot.w + 3.5;
    sim.player.y = plot.y + Math.floor(plot.h / 2) + 0.7;
    expect(sim.world.inPlotInterior(sim.player.tileX, sim.player.tileY)).toBe(false);
    const dog = sim.dogs[0];
    expect(sim.command({ type: 'goTo', x: dog.tileX + 2, y: dog.tileY }).ok).toBe(true);
    runSeconds(sim, 20);
    expect(sim.nav.active).toBe(false);
    expect(sim.world.inPlotInterior(sim.player.tileX, sim.player.tileY)).toBe(true);
  });

  it('köpeğe dokununca yanına gider, ona dönüp sever', () => {
    const sim = Sim.create(1003);
    sim.setSpeed(1);
    const dog = sim.dogs[0];
    dog.state = 'sit';
    dog.stateTimer = 9999;
    sim.player.x = dog.x + 3;
    sim.player.y = dog.y + 0.2;
    const events: string[] = [];
    sim.events.on('interacted', (e) => events.push(`${e.kind}:${e.result.ok}`));
    const l0 = dog.needs.loyalty;
    expect(sim.command({ type: 'goInteract', goal: { kind: 'dog', id: dog.id } }).ok).toBe(true);
    runSeconds(sim, 5);
    expect(sim.nav.active).toBe(false);
    expect(sim.stats.petted).toBe(1);
    expect(dog.needs.loyalty).toBeGreaterThan(l0);
    expect(events).toEqual(['pet:true']);
  });

  it('binaya dokununca kapı önüne gidip E yapar (yem kabı doldurulur)', () => {
    const sim = Sim.create(1004);
    sim.setSpeed(1);
    const bowl = sim.buildings.find((b) => b.type === 'bowl')!;
    bowl.food = 0;
    sim.player.x = bowl.x + 4.5;
    sim.player.y = bowl.y + 3.7;
    expect(sim.command({ type: 'goInteract', goal: { kind: 'building', id: bowl.id } }).ok).toBe(true);
    runSeconds(sim, 6);
    expect(sim.nav.active).toBe(false);
    expect(bowl.food).toBeGreaterThan(0);
  });

  it('klavye girişi ve yönetim modu yolu iptal eder', () => {
    const sim = Sim.create(1005);
    sim.setSpeed(1);
    const target = freeTileEast(sim, 8);
    sim.command({ type: 'goTo', x: target.x, y: target.y });
    expect(sim.nav.active).toBe(true);
    sim.update(1 / 30, { dx: 1, dy: 0, run: false });
    expect(sim.nav.active).toBe(false);
    sim.command({ type: 'goTo', x: target.x, y: target.y });
    expect(sim.nav.active).toBe(true);
    sim.setMode('manage');
    expect(sim.nav.active).toBe(false);
    sim.setMode('avatar');
    sim.command({ type: 'goTo', x: target.x, y: target.y });
    expect(sim.command({ type: 'cancelNav' }).ok).toBe(true);
    expect(sim.nav.active).toBe(false);
  });

  it('ulaşılamaz hedef mesaj verir, meşgulken hareket etmez', () => {
    const sim = Sim.create(1006);
    sim.setSpeed(1);
    const msgs: string[] = [];
    sim.events.on('message', (m) => msgs.push(m));
    expect(sim.command({ type: 'goTo', x: 0, y: 0 }).ok).toBe(false);
    expect(sim.nav.active).toBe(false);
    expect(msgs.some((m) => m.includes('yol yok'))).toBe(true);
    const target = freeTileEast(sim, 6);
    sim.player.setBusy(2, 'pet');
    const x0 = sim.player.x;
    sim.command({ type: 'goTo', x: target.x, y: target.y });
    runSeconds(sim, 1);
    expect(sim.player.x).toBe(x0);
    expect(sim.nav.active).toBe(true);
    runSeconds(sim, 6);
    expect(sim.nav.active).toBe(false);
    expect(sim.player.x).not.toBe(x0);
  });
});
