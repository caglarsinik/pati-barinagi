import { describe, expect, it } from 'vitest';
import { debugEnabled, freeTileNear, summarize } from '../../src/debug/touchDebug';
import { Sim } from '../../src/sim/Sim';
import { Obj } from '../../src/sim/world/tiles';

describe('Dokunma test kancası (saf parçalar)', () => {
  it('yalnız ?debug=1 ile açılır', () => {
    expect(debugEnabled('?debug=1')).toBe(true);
    expect(debugEnabled('?touch=1&debug=1')).toBe(true);
    expect(debugEnabled('?debug=0')).toBe(false);
    expect(debugEnabled('')).toBe(false);
  });

  it('özet başarısız senaryoları adlandırır', () => {
    expect(summarize([{ name: 'a', ok: true, detail: '' }])).toBe('1/1 ok');
    expect(summarize([{ name: 'a', ok: true, detail: '' }, { name: 'b', ok: false, detail: '' }])).toBe('1/2 ok · başarısız: b');
  });

  it('boş kare yürünebilir, nesnesiz ve köpeklerden uzak', () => {
    const sim = Sim.create(1401);
    const t = freeTileNear(sim, 4)!;
    expect(t).not.toBeNull();
    const w = sim.world;
    expect(w.isSolid(t.x, t.y)).toBe(false);
    expect(w.objectAt(t.x, t.y)).toBe(Obj.None);
    expect(w.buildingIdAt(t.x, t.y)).toBe(-1);
    expect(Math.max(Math.abs(t.x - sim.player.tileX), Math.abs(t.y - sim.player.tileY))).toBeGreaterThanOrEqual(4);
    for (const d of sim.dogs) expect(Math.hypot(d.x - (t.x + 0.5), d.y - (t.y + 0.5))).toBeGreaterThanOrEqual(2);
  });
});
