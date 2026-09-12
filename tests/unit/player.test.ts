import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { Player } from '../../src/sim/entities/Player';
import { TileWorld } from '../../src/sim/world/TileWorld';
import { Ground, Obj } from '../../src/sim/world/tiles';

function smallWorld(): TileWorld {
  const w = new TileWorld(10, 10, { x: 0, y: 0, w: 10, h: 10 });
  w.ground.fill(Ground.Grass0);
  // x=6 sütunu kaya duvarı
  for (let y = 0; y < 10; y++) w.setObject(6, y, Obj.Rock);
  w.recomputeAllSolid();
  return w;
}

describe('Player', () => {
  it('boş alanda yürür ve yöne bakar', () => {
    const w = smallWorld();
    const p = new Player(2.5, 2.5);
    for (let i = 0; i < 30; i++) p.update(1 / 60, { dx: 1, dy: 0, run: false }, w);
    expect(p.x).toBeGreaterThan(2.5);
    expect(p.facing).toBe(2);
    expect(p.moving).toBe(true);
    p.update(1 / 60, { dx: 0, dy: -1, run: false }, w);
    expect(p.facing).toBe(3);
  });

  it('duvara girmez', () => {
    const w = smallWorld();
    const p = new Player(4.5, 4.5);
    for (let i = 0; i < 240; i++) p.update(1 / 60, { dx: 1, dy: 0, run: true }, w);
    expect(p.x).toBeLessThan(6);
    expect(p.collides(w, p.x, p.y)).toBe(false);
  });

  it('harita dışına çıkmaz', () => {
    const w = smallWorld();
    const p = new Player(1.5, 1.5);
    for (let i = 0; i < 240; i++) p.update(1 / 60, { dx: -1, dy: -1, run: true }, w);
    expect(p.x).toBeGreaterThanOrEqual(BALANCE.player.hitbox.w / 2 - 0.01);
    expect(p.y).toBeGreaterThanOrEqual(BALANCE.player.hitbox.h - 0.01);
  });

  it('koşunca dayanıklılık düşer, tükenince koşamaz, dinlenince toparlar', () => {
    const w = smallWorld();
    const p = new Player(2.5, 5.5);
    let frames = 0;
    while (!p.exhausted && frames < 60 * 20) {
      p.update(1 / 60, { dx: frames % 2 ? 1 : -1, dy: 0, run: true }, w);
      frames++;
    }
    expect(p.exhausted).toBe(true);
    expect(p.stamina).toBeLessThan(1);
    // 100 dayanıklılık, saniyede 14 düşüş: ~7 saniye
    expect(frames).toBeGreaterThan(60 * 6);
    expect(frames).toBeLessThan(60 * 9);
    p.update(1 / 60, { dx: 1, dy: 0, run: true }, w);
    expect(p.running).toBe(false);
    for (let i = 0; i < 60 * 5; i++) p.update(1 / 60, { dx: 0, dy: 0, run: false }, w);
    expect(p.stamina).toBeGreaterThan(25);
    expect(p.exhausted).toBe(false);
  });

  it('kayıt gidiş dönüş ve bozuk veri', () => {
    const p = new Player(3.25, 4.75);
    p.facing = 1;
    p.stamina = 40;
    const q = Player.fromJSON(p.toJSON(), { x: 0, y: 0 });
    expect(q.x).toBe(3.25);
    expect(q.facing).toBe(1);
    expect(q.stamina).toBe(40);
    const bad = Player.fromJSON({ x: 'a', facing: 9, stamina: 999 }, { x: 1, y: 2 });
    expect(bad.x).toBe(1);
    expect(bad.facing).toBe(0);
    expect(bad.stamina).toBe(BALANCE.player.staminaMax);
  });
});
