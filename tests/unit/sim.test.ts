import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { SaveManager } from '../../src/core/SaveManager';
import { Sim } from '../../src/sim/Sim';

describe('Sim', () => {
  it('başlangıç durumu', () => {
    const sim = Sim.create(77);
    expect(sim.money).toBe(BALANCE.economy.startMoney);
    expect(sim.speed).toBe(1);
    expect(sim.mode).toBe('avatar');
    expect(sim.player.collides(sim.world, sim.player.x, sim.player.y)).toBe(false);
  });

  it('hız ve duraklatma', () => {
    const sim = Sim.create(77);
    const t0 = sim.clock.totalMinutes;
    sim.update(1);
    expect(sim.clock.totalMinutes - t0).toBeCloseTo(BALANCE.time.minutesPerRealSecond, 5);
    sim.setSpeed(4);
    const t1 = sim.clock.totalMinutes;
    sim.update(1);
    expect(sim.clock.totalMinutes - t1).toBeCloseTo(BALANCE.time.minutesPerRealSecond * 4, 5);
    sim.togglePause();
    expect(sim.paused).toBe(true);
    const t2 = sim.clock.totalMinutes;
    sim.update(1);
    expect(sim.clock.totalMinutes).toBe(t2);
    sim.togglePause();
    expect(sim.speed).toBe(4);
    sim.changeSpeed(-1);
    expect(sim.speed).toBe(2);
    sim.setSpeed(1);
    sim.changeSpeed(-1);
    expect(sim.paused).toBe(true);
  });

  it('saat olaylarını yayar', () => {
    const sim = Sim.create(3);
    const hours: number[] = [];
    sim.events.on('hour', (h) => hours.push(h));
    sim.setSpeed(4);
    // 4x: saniyede 9.6 dk; 60 saniyede 576 dk = 9.6 saat
    for (let i = 0; i < 60; i++) sim.update(1);
    expect(hours[0]).toBe(7);
    expect(hours.length).toBe(9);
  });

  it('yönetim modunda oyuncu hareket etmez', () => {
    const sim = Sim.create(3);
    sim.setMode('manage');
    const x = sim.player.x;
    sim.update(0.5, { dx: 1, dy: 0, run: false });
    expect(sim.player.x).toBe(x);
    sim.setMode('avatar');
    sim.update(0.5, { dx: 1, dy: 0, run: false });
    expect(sim.player.x).toBeGreaterThan(x);
  });

  it('kayıt gidiş dönüş aynı dünyayı verir', () => {
    const sim = Sim.create(2024);
    sim.setSpeed(2);
    sim.update(3, { dx: 1, dy: 0, run: false });
    sim.money = 1234;
    const raw = JSON.stringify(sim.toJSON());
    const parsed = SaveManager.parse(raw);
    expect(parsed).not.toBeNull();
    const back = Sim.fromJSON(parsed!);
    expect(back.seed).toBe(2024);
    expect(back.money).toBe(1234);
    expect(back.speed).toBe(2);
    expect(back.clock.totalMinutes).toBeCloseTo(sim.clock.totalMinutes, 6);
    expect(back.player.x).toBeCloseTo(sim.player.x, 6);
    expect(back.world.ground).toEqual(sim.world.ground);
  });

  it('bozuk kayıt reddedilir, eksik alanlar toparlanır', () => {
    expect(SaveManager.parse('{"nope":1}')).toBeNull();
    expect(() => SaveManager.parse('not json')).toThrow();
    const partial = SaveManager.parse(JSON.stringify({ version: 1, seed: 5 }));
    expect(partial).not.toBeNull();
    const sim = Sim.fromJSON(partial!);
    expect(sim.money).toBe(BALANCE.economy.startMoney);
    expect(sim.speed).toBe(1);
    expect(sim.player.collides(sim.world, sim.player.x, sim.player.y)).toBe(false);
  });
});
