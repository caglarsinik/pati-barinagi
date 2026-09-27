import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { SaveManager } from '../../src/core/SaveManager';
import { Sim } from '../../src/sim/Sim';
import { MANUAL_ACTIONS, performAction, resolveAction } from '../../src/sim/systems/Interaction';
import { harvestAt, tickRegrow } from '../../src/sim/systems/Materials';
import { Obj } from '../../src/sim/world/tiles';

const M = BALANCE.materials;

function inVillage(sim: Sim, x: number, y: number): boolean {
  const v = sim.world.village;
  return !!v && x >= v.x && y >= v.y && x < v.x + v.w && y < v.y + v.h;
}

/** Arsaya en yakın, arsa ve köy dışındaki nesne; altındaki kare yürünür (oyuncu alttan bakar). Ağaçta tepe de şart. */
function nearest(sim: Sim, o: Obj, skip: Set<number> = new Set()): { x: number; y: number } {
  const w = sim.world;
  const p = w.plot;
  const cx = p.x + p.w / 2;
  const cy = p.y + p.h / 2;
  let best: { x: number; y: number } | null = null;
  let bestD = Infinity;
  for (let y = 2; y < w.height - 2; y++) {
    for (let x = 2; x < w.width - 2; x++) {
      if (w.objectAt(x, y) !== o || skip.has(w.idx(x, y)) || w.inPlot(x, y) || inVillage(sim, x, y) || w.isSolid(x, y + 1)) continue;
      if ((o === Obj.TreeTrunk && w.objectAt(x, y - 1) !== Obj.TreeTop) || (o === Obj.PineTrunk && w.objectAt(x, y - 1) !== Obj.PineTop)) continue;
      const d = Math.hypot(x - cx, y - cy);
      if (d < bestD) {
        bestD = d;
        best = { x, y };
      }
    }
  }
  if (!best) throw new Error(`nesne yok: ${Obj[o]}`);
  return best;
}

/** Oyuncu karenin altında, yüzü yukarı (baktığı kare tam o kare). */
function faceFromBelow(sim: Sim, t: { x: number; y: number }): void {
  sim.player.x = t.x + 0.5;
  sim.player.y = t.y + 1.7;
  sim.player.facing = 3;
  sim.player.busy = 0;
}

describe('Odun ve taş (0.23.0)', () => {
  it('ağaç: +3 odun, gövde kütüğe döner, tepe kalkar, dayanıklılık düşer ve iş sürerken yenilenmez, kütük 5–8 günde büyüyecek', () => {
    const sim = Sim.create(2301);
    const t = nearest(sim, Obj.TreeTrunk);
    faceFromBelow(sim, t);
    const r = resolveAction(sim);
    expect(r.kind).toBe('chop');
    expect(r.hint).toContain(`+${M.treeWood}`);
    expect(r.tile).toEqual(t);
    const out = performAction(sim);
    expect(out.ok).toBe(true);
    expect(out.message).toContain(`+${M.treeWood}`);
    expect(sim.materials.wood).toBe(M.treeWood);
    expect(sim.world.objectAt(t.x, t.y)).toBe(Obj.Stump);
    expect(sim.world.objectAt(t.x, t.y - 1)).toBe(Obj.None);
    expect(sim.world.isSolid(t.x, t.y)).toBe(true);
    expect(sim.player.stamina).toBe(BALANCE.player.staminaMax - M.chopStamina);
    expect(sim.stats.chopped).toBe(1);
    expect(sim.stats.woodGathered).toBe(M.treeWood);
    const rg = sim.regrow.get(sim.world.idx(t.x, t.y))!;
    expect(rg.pine).toBe(false);
    expect(rg.day).toBeGreaterThanOrEqual(sim.clock.day + M.regrowDaysMin);
    expect(rg.day).toBeLessThanOrEqual(sim.clock.day + M.regrowDaysMax);
    // İş sürerken soluklanılmaz; bitince dayanıklılık yeniden dolar.
    expect(sim.player.busyAction).toBe('chop');
    const s0 = sim.player.stamina;
    for (let i = 0; i < 20; i++) sim.update(1 / 30);
    expect(sim.player.stamina).toBe(s0);
    for (let i = 0; i < 40; i++) sim.update(1 / 30);
    expect(sim.player.busy).toBe(0);
    expect(sim.player.stamina).toBeGreaterThan(s0);
  });

  it('çam +2, kaya +2 taş (yeniden çıkmaz), doğal kütük +1; kesilen ağacın kütüğü sökülünce yeniden büyümez', () => {
    const sim = Sim.create(2302);
    const pine = nearest(sim, Obj.PineTrunk);
    faceFromBelow(sim, pine);
    expect(resolveAction(sim).hint).toContain('çam');
    expect(performAction(sim).ok).toBe(true);
    expect(sim.materials.wood).toBe(M.pineWood);
    expect(sim.regrow.get(sim.world.idx(pine.x, pine.y))!.pine).toBe(true);

    const rock = nearest(sim, Obj.Rock);
    faceFromBelow(sim, rock);
    expect(resolveAction(sim).kind).toBe('mine');
    expect(performAction(sim).ok).toBe(true);
    expect(sim.materials.stone).toBe(M.rockStone);
    expect(sim.world.objectAt(rock.x, rock.y)).toBe(Obj.None);
    expect(sim.world.isSolid(rock.x, rock.y)).toBe(false);
    expect(sim.regrow.has(sim.world.idx(rock.x, rock.y))).toBe(false);
    expect(sim.stats.mined).toBe(1);

    // Kesilen çamın kütüğünü sök: +1 odun, kare boşalır, yeniden büyüme sırası silinir.
    faceFromBelow(sim, pine);
    const r = resolveAction(sim);
    expect(r.kind).toBe('uproot');
    expect(performAction(sim).ok).toBe(true);
    expect(sim.materials.wood).toBe(M.pineWood + M.stumpWood);
    expect(sim.world.objectAt(pine.x, pine.y)).toBe(Obj.None);
    expect(sim.regrow.has(sim.world.idx(pine.x, pine.y))).toBe(false);
    expect(sim.stats.uprooted).toBe(1);
    expect(sim.stats.stoneGathered).toBe(M.rockStone);
  });

  it('yorgunken ve çanta doluyken yapılmaz; üst sınıra kadar toplanır', () => {
    const sim = Sim.create(2303);
    const a = nearest(sim, Obj.TreeTrunk);
    faceFromBelow(sim, a);
    sim.player.stamina = M.chopStamina - 1;
    let r = resolveAction(sim);
    expect(r.kind).toBe('none');
    expect(r.hint).toContain('yorgun');
    expect(performAction(sim).ok).toBe(false);
    sim.player.stamina = BALANCE.player.staminaMax;
    sim.materials.wood = M.max - 1;
    const out = performAction(sim);
    expect(out.ok).toBe(true);
    expect(sim.materials.wood).toBe(M.max);
    const b = nearest(sim, Obj.TreeTrunk, new Set([sim.world.idx(a.x, a.y)]));
    faceFromBelow(sim, b);
    r = resolveAction(sim);
    expect(r.kind).toBe('none');
    expect(r.hint).toContain(`${M.max}`);
    expect(performAction(sim).ok).toBe(false);
    expect(sim.world.objectAt(b.x, b.y)).toBe(Obj.TreeTrunk);
  });

  it('arsada ve köyde toplanmaz; ağaç tepesine bakınca gövde hedeflenir; tepede köpek varsa köpek önce; otopilot kesmez', () => {
    const sim = Sim.create(2304);
    const w = sim.world;
    const pi = w.plotInterior();
    w.setObject(pi.x + 3, pi.y + 4, Obj.TreeTrunk);
    w.setObject(pi.x + 3, pi.y + 3, Obj.TreeTop);
    expect(harvestAt(w, pi.x + 3, pi.y + 4)).toBeNull();
    const v = w.village!;
    let vx = -1;
    let vy = -1;
    for (let y = v.y; y < v.y + v.h && vx < 0; y++) for (let x = v.x; x < v.x + v.w && vx < 0; x++) if (!w.isSolid(x, y) && w.objectAt(x, y) === Obj.None) [vx, vy] = [x, y];
    w.setObject(vx, vy, Obj.Rock);
    expect(harvestAt(w, vx, vy)).toBeNull();

    const t = nearest(sim, Obj.TreeTrunk);
    expect(harvestAt(w, t.x, t.y - 1)?.tile).toEqual(t);
    // Soldan tepe karesine bakış.
    sim.player.x = t.x - 1 + 0.5;
    sim.player.y = t.y - 1 + 0.7;
    sim.player.facing = 2;
    let r = resolveAction(sim);
    expect(r.kind).toBe('chop');
    expect(r.tile).toEqual(t);
    const dog = sim.shelterDogs()[0];
    dog.x = t.x + 0.5;
    dog.y = t.y - 1 + 0.6;
    r = resolveAction(sim);
    expect(r.kind).not.toBe('chop');

    // Otopilot varınca kesmez (köy işleri gibi elle yapılır).
    expect(MANUAL_ACTIONS.has('chop') && MANUAL_ACTIONS.has('mine') && MANUAL_ACTIONS.has('uproot')).toBe(true);
    dog.x = w.plot.x + 5.5;
    dog.y = w.plot.y + 8.5;
    faceFromBelow(sim, t);
    sim.autopilot = true;
    let outcome: boolean | null = null;
    sim.events.on('interacted', (e) => (outcome = e.result.ok));
    expect(sim.nav.goInteract({ kind: 'object', tile: t })).toBe(true);
    expect(outcome).toBe(false);
    expect(sim.materials.wood).toBe(0);
    expect(w.objectAt(t.x, t.y)).toBe(Obj.TreeTrunk);
  });

  it('yeniden büyüme: günü gelince ağaç ve tepesi geri gelir; tepe karesi doluysa ertesi gün; arsaya katılan kütük sıradan çıkar', () => {
    const sim = Sim.create(2305);
    const w = sim.world;
    const t = nearest(sim, Obj.TreeTrunk);
    faceFromBelow(sim, t);
    performAction(sim);
    const i = w.idx(t.x, t.y);
    const due = sim.regrow.get(i)!.day;
    tickRegrow(sim, due - 1);
    expect(w.objectAt(t.x, t.y)).toBe(Obj.Stump);
    w.setObject(t.x, t.y - 1, Obj.Flowers);
    tickRegrow(sim, due);
    expect(w.objectAt(t.x, t.y)).toBe(Obj.Stump);
    expect(sim.regrow.get(i)!.day).toBe(due + 1);
    w.setObject(t.x, t.y - 1, Obj.None);
    tickRegrow(sim, due + 1);
    expect(w.objectAt(t.x, t.y)).toBe(Obj.TreeTrunk);
    expect(w.objectAt(t.x, t.y - 1)).toBe(Obj.TreeTop);
    expect(w.isSolid(t.x, t.y)).toBe(true);
    expect(sim.regrow.has(i)).toBe(false);
    // Gün olayıyla da işler (Sim 'day' olayına bağlı).
    const p2 = nearest(sim, Obj.PineTrunk);
    faceFromBelow(sim, p2);
    sim.player.stamina = BALANCE.player.staminaMax;
    performAction(sim);
    const j = w.idx(p2.x, p2.y);
    sim.events.emit('day', sim.regrow.get(j)!.day);
    expect(w.objectAt(p2.x, p2.y)).toBe(Obj.PineTrunk);
    expect(w.objectAt(p2.x, p2.y - 1)).toBe(Obj.PineTop);
    // Arsanın içine düşen kütük (genişletme) büyümez, sıradan çıkar.
    const pi = w.plotInterior();
    w.setObject(pi.x + 2, pi.y + 2, Obj.Stump);
    const k = w.idx(pi.x + 2, pi.y + 2);
    sim.regrow.set(k, { day: 1, pine: false });
    tickRegrow(sim, sim.clock.day);
    expect(sim.regrow.has(k)).toBe(false);
    expect(w.objectAt(pi.x + 2, pi.y + 2)).toBe(Obj.Stump);
  });

  it('kayıt turu: çanta, kütükler ve yeniden büyüme sırası korunur; eski kayıtta sıfır; ana RNG sırası değişmez', () => {
    const sim = Sim.create(2306);
    const twin = Sim.create(2306);
    const t = nearest(sim, Obj.TreeTrunk);
    faceFromBelow(sim, t);
    performAction(sim);
    const rock = nearest(sim, Obj.Rock);
    faceFromBelow(sim, rock);
    performAction(sim);
    // Ayrı RNG: ana sıra ikizle aynı kalır.
    expect(sim.rng.next()).toBe(twin.rng.next());
    const data = sim.toJSON();
    const back = Sim.fromJSON(SaveManager.parse(JSON.stringify(data))!);
    expect(back.materials).toEqual({ wood: M.treeWood, stone: M.rockStone });
    expect([...back.regrow.entries()]).toEqual([...sim.regrow.entries()]);
    expect(back.world.objectAt(t.x, t.y)).toBe(Obj.Stump);
    expect(back.world.objectAt(t.x, t.y - 1)).toBe(Obj.None);
    expect(back.world.objectAt(rock.x, rock.y)).toBe(Obj.None);
    expect(back.stats.chopped).toBe(1);
    expect(back.stats.mined).toBe(1);
    // Eski kayıt: alanlar yok → sıfır; bozuk değerler kırpılır.
    const old = { ...data } as Record<string, unknown>;
    delete old.materials;
    delete old.regrow;
    const legacy = Sim.fromJSON(SaveManager.parse(JSON.stringify(old))!);
    expect(legacy.materials).toEqual({ wood: 0, stone: 0 });
    expect(legacy.regrow.size).toBe(0);
    const bad = Sim.fromJSON(SaveManager.parse(JSON.stringify({ ...data, materials: { wood: 500, stone: -3 }, regrow: [1, 'x', 0, -5, 3, 1] }))!);
    expect(bad.materials).toEqual({ wood: M.max, stone: 0 });
    expect(bad.regrow.size).toBe(0);
  });
});
