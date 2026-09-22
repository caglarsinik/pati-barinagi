import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GAME } from '../../src/config/game';
import { SaveManager } from '../../src/core/SaveManager';
import { Sim } from '../../src/sim/Sim';

/** Düğümde localStorage yok: Map tabanlı sahte depo. */
class MemoryStorage {
  private m = new Map<string, string>();
  get length(): number {
    return this.m.size;
  }
  clear(): void {
    this.m.clear();
  }
  getItem(k: string): string | null {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string): void {
    this.m.set(k, String(v));
  }
  removeItem(k: string): void {
    this.m.delete(k);
  }
  key(i: number): string | null {
    return [...this.m.keys()][i] ?? null;
  }
}

const g = globalThis as unknown as { localStorage?: MemoryStorage };

describe('Kayıt yuvaları', () => {
  beforeEach(() => {
    g.localStorage = new MemoryStorage();
  });
  afterEach(() => {
    delete g.localStorage;
  });

  it('üç yuva bağımsız yazılır, okunur ve silinir; boş yuva null', () => {
    expect(SaveManager.listSlots()).toEqual([null, null, null]);
    const a = Sim.create(2101, 'easy');
    const b = Sim.create(2102, 'hard');
    a.money = 1234;
    b.clock.totalMinutes += 3 * 1440;
    expect(SaveManager.write(0, a.toJSON())).toBe(true);
    expect(SaveManager.write(2, b.toJSON())).toBe(true);
    const list = SaveManager.listSlots();
    expect(list.length).toBe(GAME.saveSlots);
    expect(list[0]).toMatchObject({ slot: 0, money: 1234, difficulty: 'easy', day: 1, victory: false });
    expect(list[1]).toBeNull();
    expect(list[2]).toMatchObject({ slot: 2, difficulty: 'hard', day: 4 });
    expect(SaveManager.read(2)!.seed).toBe(2102);
    SaveManager.remove(0);
    expect(SaveManager.listSlots()[0]).toBeNull();
    expect(SaveManager.listSlots()[2]).not.toBeNull();
  });

  it('özet zaferi gösterir; bozuk yuva özet vermez', () => {
    const s = Sim.create(2103);
    s.victory = { day: 40, week: 6 };
    SaveManager.write(1, s.toJSON());
    expect(SaveManager.summary(1)!.victory).toBe(true);
    g.localStorage!.setItem(SaveManager.key(2), '{bozuk');
    expect(SaveManager.summary(2)).toBeNull();
  });

  it('son kullanılan yuva hatırlanır; geçersiz değer 0 olur', () => {
    expect(SaveManager.lastSlot()).toBe(0);
    SaveManager.setLastSlot(2);
    expect(SaveManager.lastSlot()).toBe(2);
    g.localStorage!.setItem(SaveManager.lastSlotKey, '7');
    expect(SaveManager.lastSlot()).toBe(0);
  });

  it('eski tek kayıt (anahtar .0) Yuva 1 olarak görünür', () => {
    const old = Sim.create(2104);
    g.localStorage!.setItem(`${GAME.saveKeyPrefix}0`, JSON.stringify(old.toJSON()));
    expect(SaveManager.listSlots()[0]?.slot).toBe(0);
  });
});
