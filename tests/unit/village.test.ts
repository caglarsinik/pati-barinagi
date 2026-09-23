import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { SaveManager } from '../../src/core/SaveManager';
import { drawVillageBuilding } from '../../src/render/BuildingArt';
import { IDLE_INPUT } from '../../src/sim/entities/Player';
import { Sim } from '../../src/sim/Sim';
import { performAction, resolveAction } from '../../src/sim/systems/Interaction';
import { villageDoorTile, wholesaleBagPrice } from '../../src/sim/world/Village';
import { generateWorld } from '../../src/sim/world/WorldGen';
import { Biome, Ground } from '../../src/sim/world/tiles';

describe('Köy ve yem toptancısı (0.18.2)', () => {
  it('güney yolunun ucunda deterministik köy; arsa, yuva ve inlerle çakışmaz; binalar katı, yol bandı açık', () => {
    for (const seed of [1821, 7, 424242]) {
      const w = generateWorld(seed);
      const v = w.village!;
      expect(v, `tohum ${seed}`).not.toBeNull();
      expect(v.y + v.h).toBeLessThanOrEqual(w.height - 2);
      expect(v.y).toBeGreaterThan(w.plot.y + BALANCE.world.plotMaxH);
      expect(w.villageBuildings.map((b) => b.kind)).toEqual(['wholesaler', 'house', 'toyShop', 'house', 'fountain', 'house']);
      for (const b of w.villageBuildings) {
        for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) expect(w.isSolid(x, y)).toBe(true);
        const d = villageDoorTile(b);
        if (b.kind !== 'house' || b.y < v.y + 8) expect(w.isSolid(d.x, d.y), `${b.kind} kapısı`).toBe(false);
      }
      const inV = (x: number, y: number) => x >= v.x - 1 && y >= v.y - 1 && x <= v.x + v.w && y <= v.y + v.h;
      expect(w.nests.some((n) => inV(n.x, n.y))).toBe(false);
      expect(w.dens.some((d) => inV(d.x, d.y))).toBe(false);
      // Yol bandı köyün baştan sonuna açık.
      const col = v.x + 11;
      for (let y = v.y; y < v.y + v.h; y++) {
        expect(w.biome[w.idx(col, y)]).toBe(Biome.Road);
        expect(w.ground[w.idx(col, y)]).toBe(Ground.Path);
        expect(w.isSolid(col, y)).toBe(false);
      }
      expect(generateWorld(seed).villageBuildings).toEqual(w.villageBuildings);
    }
  });

  it('köye varınca bulunur ve başarım açılır; kayıtta korunur; köy kayıttan yüklenince aynı yerde', () => {
    const sim = Sim.create(1822);
    const v = sim.world.village!;
    expect(sim.villageFound).toBe(false);
    sim.player.x = v.x + 11.5;
    sim.player.y = v.y + 6.7;
    sim.update(1 / 30, IDLE_INPUT);
    expect(sim.villageFound).toBe(true);
    sim.achievements.check();
    expect(sim.achievements.unlocked.has('village')).toBe(true);
    const back = Sim.fromJSON(SaveManager.parse(JSON.stringify(sim.toJSON()))!);
    expect(back.villageFound).toBe(true);
    expect(back.world.villageBuildings).toEqual(sim.world.villageBuildings);
    expect(back.world.nests.some((n) => n.x >= v.x && n.x < v.x + v.w && n.y >= v.y && n.y < v.y + v.h)).toBe(false);
  });

  it('toptancıya E ile ya da dokun-git ile girilir; tezgâh toptan paneli; en az 3 çuval, indirimli fiyat, yalnız içeride', () => {
    const sim = Sim.create(1823);
    const shop = sim.world.villageBuildings.find((b) => b.kind === 'wholesaler')!;
    const door = villageDoorTile(shop);
    sim.player.x = door.x + 0.5;
    sim.player.y = door.y + 0.9;
    sim.player.facing = 3;
    const r = resolveAction(sim);
    expect(r.kind).toBe('enterVillage');
    expect(r.hint).toContain('Yem toptancısı');
    expect(sim.command({ type: 'buyWholesale', bags: 5 }).ok).toBe(false);
    expect(performAction(sim).ok).toBe(true);
    expect(sim.interior?.kind).toBe('wholesaler');
    const counter = sim.interior!.items.find((i) => i.type === 'shopCounter')!;
    sim.player.x = counter.x + 1.5;
    sim.player.y = counter.y + 1.7;
    sim.player.facing = 3;
    expect(resolveAction(sim).kind).toBe('wholesale');
    expect(performAction(sim).open).toBe('wholesale');
    sim.money = 10000;
    const food0 = sim.foodStock;
    const price = wholesaleBagPrice();
    expect(price).toBe(Math.round(BALANCE.economy.foodBagPrice * BALANCE.village.wholesaleMul));
    expect(sim.command({ type: 'buyWholesale', bags: 1 }).ok).toBe(true);
    expect(sim.money).toBe(10000 - BALANCE.village.minBags * price);
    expect(sim.foodStock).toBe(food0 + BALANCE.village.minBags * BALANCE.economy.foodBagPortions);
    // Kapıdan çık, sonra dokun-git (köy hedefi) ile yeniden gir.
    sim.exitInterior();
    sim.player.y += 3;
    expect(sim.command({ type: 'goInteract', goal: { kind: 'village', index: shop.index } }).ok).toBe(true);
    for (let i = 0; i < 30 * 5 && !sim.interior; i++) sim.update(1 / 30, IDLE_INPUT);
    expect(sim.interior?.kind).toBe('wholesaler');
    // Oyuncak dükkânı henüz kapalı; çizimler dolu.
    const toy = sim.world.villageBuildings.find((b) => b.kind === 'toyShop')!;
    sim.exitInterior();
    const td = villageDoorTile(toy);
    sim.player.x = td.x + 0.5;
    sim.player.y = td.y + 0.9;
    sim.player.facing = 3;
    expect(resolveAction(sim).hint).toContain('yakında');
    for (const kind of ['wholesaler', 'toyShop', 'house', 'fountain'] as const) {
      const px = drawVillageBuilding(kind, 4, 3);
      let n = 0;
      for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) if (px.isOpaque(x, y)) n++;
      expect(n, kind).toBeGreaterThan(200);
    }
  });
});
