import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { SaveManager } from '../../src/core/SaveManager';
import { IDLE_INPUT } from '../../src/sim/entities/Player';
import { Sim } from '../../src/sim/Sim';
import { Biome } from '../../src/sim/world/tiles';

const MAX = BALANCE.map.maxMarkers;

describe('Harita işaretleri (0.18.1)', () => {
  it('ekle/sil, en çok 5, renkler farklı ve boşalan renk yeniden kullanılır, harita dışı ret, kayıt', () => {
    const sim = Sim.create(1811);
    for (let i = 0; i < MAX; i++) expect(sim.command({ type: 'addMarker', x: 10 + i, y: 20 }).ok).toBe(true);
    const extra = sim.command({ type: 'addMarker', x: 50, y: 50 });
    expect(extra.ok).toBe(false);
    expect(extra.message).toContain('En çok');
    expect(new Set(sim.markers.map((m) => m.color)).size).toBe(MAX);
    expect(sim.command({ type: 'addMarker', x: -1, y: 5 }).ok).toBe(false);
    const second = sim.markers[1];
    expect(sim.command({ type: 'removeMarker', id: second.id }).ok).toBe(true);
    expect(sim.markers.length).toBe(MAX - 1);
    expect(sim.command({ type: 'addMarker', x: 60.7, y: 61.2 }).ok).toBe(true);
    const last = sim.markers[sim.markers.length - 1];
    expect(last.color).toBe(second.color);
    expect([last.x, last.y]).toEqual([60, 61]);
    const back = Sim.fromJSON(SaveManager.parse(JSON.stringify(sim.toJSON()))!);
    expect(back.markers).toEqual(sim.markers);
    const raw = JSON.parse(JSON.stringify(sim.toJSON()));
    raw.markers.push({ id: 99, x: 5000, y: 1, color: 1 }, { id: 'x' });
    expect(Sim.fromJSON(SaveManager.parse(JSON.stringify(raw))!).markers.length).toBe(MAX);
  });

  it('işarete git: güney yolunun ucundaki uzak işarete yürür; içerideyken ve yönetim modunda ret', () => {
    const sim = Sim.create(1812);
    const w = sim.world;
    let far = { x: 0, y: 0 };
    for (let y = 0; y < w.height; y++) {
      for (let x = 0; x < w.width; x++) if (w.biome[w.idx(x, y)] === Biome.Road && y > far.y && !w.isSolid(x, y)) far = { x, y };
    }
    expect(far.y - (w.plot.y + w.plot.h)).toBeGreaterThan(40);
    expect(sim.command({ type: 'addMarker', x: far.x, y: far.y }).ok).toBe(true);
    const m = sim.markers[0];

    const office = sim.buildings.find((b) => b.type === 'office')!;
    sim.enterBuilding(office.id);
    expect(sim.command({ type: 'goToMarker', id: m.id }).message).toContain('dışarı');
    sim.exitInterior();
    sim.setMode('manage');
    expect(sim.command({ type: 'goToMarker', id: m.id }).ok).toBe(false);
    sim.setMode('avatar');

    const t0 = performance.now();
    expect(sim.command({ type: 'goToMarker', id: m.id }).ok).toBe(true);
    expect(performance.now() - t0).toBeLessThan(500);
    expect(sim.nav.active).toBe(true);
    for (let i = 0; i < 60 * 30 && sim.nav.active; i++) sim.update(1 / 30, IDLE_INPUT);
    expect(Math.hypot(sim.player.tileX - far.x, sim.player.tileY - far.y)).toBeLessThan(2);
  });
});
