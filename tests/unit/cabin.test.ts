import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { SaveManager } from '../../src/core/SaveManager';
import { Sim } from '../../src/sim/Sim';
import { performAction, resolveAction } from '../../src/sim/systems/Interaction';
import { RUIN_ID, ruinDoorTile } from '../../src/sim/world/Ruin';
import { signposts } from '../../src/sim/world/Signposts';

const C = BALANCE.ruin.repair;

/** Oyuncuyu bir kareye koyup bir yöne döndürür (0 aşağı, 1 sol, 2 sağ, 3 yukarı) ve E'ye basar. */
function pressAt(sim: Sim, x: number, y: number, facing: 0 | 1 | 2 | 3) {
  sim.player.x = x + 0.5;
  sim.player.y = y + 0.7;
  sim.player.facing = facing;
  sim.player.busy = 0;
  return performAction(sim);
}

function enter(sim: Sim): void {
  const door = ruinDoorTile(sim.world.ruin!);
  expect(pressAt(sim, door.x, door.y, 3).ok).toBe(true);
}

/** Yatak ve ocak: şablonda ocak (4,1) duvarda, yatak (8,2) dikey. */
const HEARTH = { x: 4, y: 2, f: 3 } as const;
const BED = { x: 7, y: 2, f: 2 } as const;

function repaired(seed: number): Sim {
  const sim = Sim.create(seed);
  sim.materials = { wood: C.wood, stone: C.stone };
  sim.money = C.money + 1000;
  expect(sim.command({ type: 'repairRuin' }).ok).toBe(true);
  return sim;
}

/** Oyun zamanını `hour` saatine kadar ilerletir. */
function advanceTo(sim: Sim, hour: number): void {
  for (let i = 0; i < 400 && sim.clock.hour !== hour; i++) sim.stepSim(10);
}

describe('Orman evi (0.23.3)', () => {
  it('ocakta E onarım panelini açar; malzeme şart; onarınca bedel düşer, oda orman evi olur, başarım açılır', () => {
    const sim = Sim.create(2331);
    enter(sim);
    expect(sim.interior!.kind).toBe('ruin');
    expect(pressAt(sim, HEARTH.x, HEARTH.y, HEARTH.f)).toMatchObject({ ok: true, open: 'repair' });
    // Taş yetmez: parayla yerine konmaz, hiçbir şey harcanmaz.
    sim.materials = { wood: 99, stone: C.stone - 1 };
    sim.money = 5000;
    const noStone = sim.command({ type: 'repairRuin' });
    expect(noStone.ok).toBe(false);
    expect(noStone.message).toMatch(/Onarım için/);
    expect(sim.materials).toEqual({ wood: 99, stone: C.stone - 1 });
    expect(sim.money).toBe(5000);
    sim.materials = { wood: C.wood, stone: C.stone };
    sim.money = C.money - 1;
    expect(sim.command({ type: 'repairRuin' }).ok).toBe(false);
    sim.money = 5000;
    let events = 0;
    sim.events.on('cabinRepaired', () => events++);
    const r = sim.command({ type: 'repairRuin' });
    expect(r.ok).toBe(true);
    expect(sim.materials).toEqual({ wood: 0, stone: 0 });
    expect(sim.money).toBe(5000 - C.money);
    expect(sim.ruin.repaired).toBe(true);
    expect(sim.world.cabin).toBe(true);
    expect(events).toBe(1);
    expect(sim.interior!.kind).toBe('cabin');
    expect(sim.interior!.buildingId).toBe(RUIN_ID);
    sim.achievements.check();
    expect(sim.achievements.unlocked.has('cabin')).toBe(true);
    expect(sim.command({ type: 'repairRuin' }).message).toMatch(/zaten/);
    // Dışarıda kapı ipucu orman evi der.
    sim.exitInterior();
    const door = ruinDoorTile(sim.world.ruin!);
    sim.player.x = door.x + 0.5;
    sim.player.y = door.y + 0.7;
    sim.player.facing = 3;
    expect(resolveAction(sim).hint).toBe('E: orman evi · içeri gir');
  });

  it('ocak günde bir dayanıklılığı doldurur; yatak 20:00 öncesi uyutmaz, sonra sabaha kadar ve oyuncu evde uyanır', () => {
    const sim = repaired(2332);
    enter(sim);
    expect(sim.interior!.kind).toBe('cabin');
    sim.player.stamina = 10;
    const warm = pressAt(sim, HEARTH.x, HEARTH.y, HEARTH.f);
    expect(warm.ok).toBe(true);
    expect(sim.player.stamina).toBe(BALANCE.player.staminaMax);
    sim.player.stamina = 10;
    expect(resolveAction(sim).kind).toBe('none');
    expect(pressAt(sim, HEARTH.x, HEARTH.y, HEARTH.f).ok).toBe(false);
    expect(sim.player.stamina).toBe(10);
    // Yatak: sabah erken.
    expect(pressAt(sim, BED.x, BED.y, BED.f).ok).toBe(false);
    advanceTo(sim, 21);
    const day = sim.clock.day;
    const slept = pressAt(sim, BED.x, BED.y, BED.f);
    expect(slept.ok).toBe(true);
    expect(sim.clock.hour).toBe(BALANCE.time.nightEndHour);
    expect(sim.clock.day).toBe(day + 1);
    expect(sim.interior!.kind).toBe('cabin');
    // Yeni günde ocak yeniden ısıtır.
    sim.player.stamina = 10;
    expect(pressAt(sim, HEARTH.x, HEARTH.y, HEARTH.f).ok).toBe(true);
  });

  it('tabela yalnız onarılınca çıkar; barınak tabelasından orman evine hızlı seyahat', () => {
    const plain = Sim.create(2333);
    expect(signposts(plain.world).some((s) => s.id === 'cabin')).toBe(false);
    const sim = repaired(2333);
    const signs = signposts(sim.world);
    const cabin = signs.find((s) => s.id === 'cabin')!;
    expect(cabin).toBeDefined();
    expect(sim.world.isSolid(cabin.x, cabin.y)).toBe(false);
    for (const s of signs) sim.world.explored[sim.world.idx(s.x, s.y)] = 1;
    const home = signs.find((s) => s.id === 'shelter')!;
    sim.player.x = home.x + 0.5;
    sim.player.y = home.y + 1.2;
    const r = sim.travel('cabin');
    expect(r.ok).toBe(true);
    expect(Math.hypot(sim.player.x - (cabin.x + 0.5), sim.player.y - (cabin.y + 1))).toBeLessThan(2);
  });

  it('gece dışarıda bayılınca yakın ev: orman evine yakınsa orada, barınağa yakınsa ofiste uyanır', () => {
    const near = repaired(2334);
    const door = ruinDoorTile(near.world.ruin!);
    const msgs: string[] = [];
    near.events.on('message', (m) => msgs.push(m));
    near.player.x = door.x + 0.5;
    near.player.y = door.y + 3.7;
    const slept = near.stats.slept;
    for (let i = 0; i < 400 && near.stats.slept === slept; i++) near.stepSim(10);
    expect(near.stats.slept).toBe(slept + 1);
    expect(Math.hypot(near.player.tileX - door.x, near.player.tileY - door.y)).toBeLessThanOrEqual(1);
    expect(msgs.some((m) => m.includes('orman evinde'))).toBe(true);

    const far = repaired(2334);
    const p = far.world.plot;
    far.player.x = p.x + p.w / 2 + 0.5;
    far.player.y = p.y + p.h + 2.7;
    const slept2 = far.stats.slept;
    for (let i = 0; i < 400 && far.stats.slept === slept2; i++) far.stepSim(10);
    const office = far.buildings.find((b) => b.type === 'office')!;
    expect(Math.abs(far.player.tileX - (office.x + 1))).toBeLessThanOrEqual(1);
    expect(far.world.inPlot(far.player.tileX, far.player.tileY)).toBe(true);
  });

  it('kayıt: onarım ve ocak günü korunur, tabela ve oda yüklemede geri gelir; eski kayıtta onarılmamış', () => {
    const sim = repaired(2335);
    sim.ruin.warmDay = 3;
    const data = sim.toJSON();
    const back = Sim.fromJSON(SaveManager.parse(JSON.stringify(data))!);
    expect(back.ruin.repaired).toBe(true);
    expect(back.ruin.warmDay).toBe(3);
    expect(back.world.cabin).toBe(true);
    expect(signposts(back.world).some((s) => s.id === 'cabin')).toBe(true);
    expect(back.enterRuin().ok).toBe(true);
    expect(back.interior!.kind).toBe('cabin');
    const ruin = { ...(data.ruin as Record<string, unknown>), repaired: undefined, warmDay: undefined };
    const legacy = Sim.fromJSON(SaveManager.parse(JSON.stringify({ ...data, ruin }))!);
    expect(legacy.ruin.repaired).toBe(false);
    expect(legacy.world.cabin).toBe(false);
    expect(signposts(legacy.world).some((s) => s.id === 'cabin')).toBe(false);
  });
});
