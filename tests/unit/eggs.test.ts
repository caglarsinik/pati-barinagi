import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { SaveManager } from '../../src/core/SaveManager';
import { eggLook } from '../../src/sim/entities/Egg';
import { Sim } from '../../src/sim/Sim';
import { performAction, resolveAction } from '../../src/sim/systems/Interaction';
import { harvestNest } from '../../src/sim/systems/NestSystem';
import { Obj } from '../../src/sim/world/tiles';

function runMinutes(sim: Sim, minutes: number): void {
  sim.setSpeed(4);
  const perStep = 0.5 * BALANCE.time.minutesPerRealSecond * 4;
  for (let i = 0; i < Math.ceil(minutes / perStep); i++) sim.update(0.5);
}

function face(sim: Sim, x: number, y: number): void {
  sim.player.x = x + 0.5;
  sim.player.y = y + 1.4;
  sim.player.facing = 3;
  sim.player.busy = 0;
}

describe('Yumurtalar', () => {
  it('öğretici yuva kapının dışında ve yumurta alınabiliyor', () => {
    const sim = Sim.create(71);
    const nest = sim.world.nests.find((n) => sim.world.objectAt(n.x, n.y) === Obj.NestEggs && Math.abs(n.y - (sim.world.plot.y + sim.world.plot.h)) < 6)!;
    expect(nest).toBeTruthy();
    face(sim, nest.x, nest.y);
    expect(resolveAction(sim).kind).toBe('pickEgg');
    const r = performAction(sim);
    expect(r.ok).toBe(true);
    expect(sim.backpack.length).toBe(1);
    expect(sim.world.objectAt(nest.x, nest.y)).toBe(Obj.Nest);
    expect(sim.nestTimers.size).toBe(1);
    const egg = sim.backpack[0];
    const look = eggLook(egg);
    expect(look.hints.length).toBeGreaterThan(0);
    // Aynı yuvadan aynı sırada alınan yumurta deterministik
    const sim2 = Sim.create(71);
    const egg2 = harvestNest(sim2, nest.x, nest.y)!;
    expect(egg2.genome).toEqual(egg.genome);
    // Yuva zamanla yeniden dolar
    runMinutes(sim, (BALANCE.eggs.nestRespawnDays + 4) * 24 * 60);
    expect(sim.world.objectAt(nest.x, nest.y)).toBe(Obj.NestEggs);
  });

  it('çanta dolunca alınmaz', () => {
    const sim = Sim.create(72);
    const nests = sim.world.nests.filter((n) => sim.world.objectAt(n.x, n.y) === Obj.NestEggs);
    for (let i = 0; i < sim.backpackSlots(); i++) sim.backpack.push(harvestNest(sim, nests[i].x, nests[i].y)!);
    face(sim, nests[4].x, nests[4].y);
    expect(resolveAction(sim).kind).toBe('none');
    expect(resolveAction(sim).hint).toContain('Çanta dolu');
  });

  it('kuluçkada 3 günde çatlar, yavru kulübeye atanır', () => {
    const sim = Sim.create(73);
    const inc = sim.buildings.find((b) => b.type === 'incubator')!;
    const nest = sim.world.nests.find((n) => sim.world.objectAt(n.x, n.y) === Obj.NestEggs)!;
    const egg = harvestNest(sim, nest.x, nest.y)!;
    sim.backpack.push(egg);
    expect(sim.command({ type: 'placeEgg', buildingId: inc.id, eggId: egg.id }).ok).toBe(true);
    expect(sim.backpack.length).toBe(0);
    expect(inc.eggs.length).toBe(1);
    const dogsBefore = sim.shelterDogs().length;
    runMinutes(sim, BALANCE.eggs.hatchDays * 24 * 60 + 30);
    expect(inc.eggs.length).toBe(0);
    expect(sim.shelterDogs().length).toBe(dogsBefore + 1);
    const pup = sim.shelterDogs()[sim.shelterDogs().length - 1];
    expect(pup.stage).toBe('puppy');
    expect(pup.genome).toEqual(egg.genome);
    expect(pup.kennelId).not.toBeNull();
    expect(sim.stats.hatched).toBe(1);
    // Geri alma
    const egg2 = harvestNest(sim, sim.world.nests.find((n) => sim.world.objectAt(n.x, n.y) === Obj.NestEggs)!.x, sim.world.nests.find((n) => sim.world.objectAt(n.x, n.y) === Obj.NestEggs)!.y)!;
    sim.backpack.push(egg2);
    sim.command({ type: 'placeEgg', buildingId: inc.id, eggId: egg2.id });
    expect(sim.command({ type: 'takeEgg', buildingId: inc.id, eggId: egg2.id }).ok).toBe(true);
    expect(sim.backpack[0].hatchLeft).toBeGreaterThan(0);
  });

  it('kuluçkadan alınan yumurtanın süresi korunur: geri koyunca 3 güne dönmez', () => {
    const sim = Sim.create(73);
    const dayMin = 24 * 60;
    const total = BALANCE.eggs.hatchDays * dayMin;
    const inc = sim.buildings.find((b) => b.type === 'incubator')!;
    const nest = sim.world.nests.find((n) => sim.world.objectAt(n.x, n.y) === Obj.NestEggs)!;
    const egg = harvestNest(sim, nest.x, nest.y)!;
    expect(egg.hatchLeft).toBe(-1);
    sim.backpack.push(egg);
    sim.command({ type: 'placeEgg', buildingId: inc.id, eggId: egg.id });
    expect(egg.hatchLeft).toBe(total); // ilk giriş: tam süre
    runMinutes(sim, dayMin);
    const left = egg.hatchLeft;
    expect(left).toBeLessThan(total - dayMin + 60);
    expect(left).toBeGreaterThan(total - dayMin - 60);

    // Yanlışlıkla al → çantada sayaç durur
    const taken = sim.command({ type: 'takeEgg', buildingId: inc.id, eggId: egg.id });
    expect(taken.ok).toBe(true);
    expect(taken.message).toBeTruthy();
    runMinutes(sim, 120);
    expect(sim.backpack[0].hatchLeft).toBe(left);

    // Kaydet/yükle çantadaki ilerlemeyi silmez
    const back = Sim.fromJSON(SaveManager.parse(JSON.stringify(sim.toJSON()))!);
    expect(back.backpack[0].hatchLeft).toBe(left);

    // Geri koy → kaldığı yerden devam eder ve kalan sürede çatlar
    sim.command({ type: 'placeEgg', buildingId: inc.id, eggId: egg.id });
    expect(egg.hatchLeft).toBe(left);
    const hatchedBefore = sim.stats.hatched;
    runMinutes(sim, left + 30);
    expect(sim.stats.hatched).toBe(hatchedBefore + 1);
  });

  it('kuluçka yıkılınca yumurta ilerlemesiyle çantaya döner; bozuk kayıt süresi sınırlanır', () => {
    const sim = Sim.create(73);
    const inc = sim.buildings.find((b) => b.type === 'incubator')!;
    const nest = sim.world.nests.find((n) => sim.world.objectAt(n.x, n.y) === Obj.NestEggs)!;
    const egg = harvestNest(sim, nest.x, nest.y)!;
    sim.backpack.push(egg);
    sim.command({ type: 'placeEgg', buildingId: inc.id, eggId: egg.id });
    runMinutes(sim, 600);
    const left = egg.hatchLeft;
    expect(sim.removeBuilding(inc.id)).toBe(true);
    expect(sim.backpack[0].id).toBe(egg.id);
    expect(sim.backpack[0].hatchLeft).toBe(left);

    const raw = JSON.parse(JSON.stringify(sim.toJSON()));
    raw.backpack[0].hatchLeft = 999999;
    const back = Sim.fromJSON(SaveManager.parse(JSON.stringify(raw))!);
    expect(back.backpack[0].hatchLeft).toBe(BALANCE.eggs.hatchDays * 24 * 60);
  });

  it('haftalar geçtikçe yavru büyür', () => {
    const sim = Sim.create(74);
    const pup = sim.addDog(sim.dogs[0].genome, 'egg', 0, sim.dogs[0].x + 2, sim.dogs[0].y);
    expect(pup.stage).toBe('puppy');
    const messages: string[] = [];
    sim.events.on('message', (m) => messages.push(m));
    // 4 hafta: bot bakımı gerekmez, sadece yaş
    for (let i = 0; i < 4; i++) sim.events.emit('week', i + 2);
    expect(pup.stage).toBe('young');
    expect(messages.some((m) => m.includes(pup.name) && m.includes('genç'))).toBe(true);
    for (let i = 0; i < 8; i++) sim.events.emit('week', i + 6);
    expect(pup.stage).toBe('adult');
  });
});

describe('Sokak köpekleri', () => {
  it('inlerde vahşi köpekler doğar ve barınak sayımına girmez', () => {
    const sim = Sim.create(75);
    expect(sim.world.dens.length).toBe(BALANCE.eggs.strayDens);
    const wild = sim.dogs.filter((d) => d.wild);
    expect(wild.length).toBe(BALANCE.eggs.strayDens);
    expect(sim.shelterDogs().length).toBe(1);
    for (const d of wild) expect(sim.world.isSolid(d.tileX, d.tileY)).toBe(false);
    // Vahşiler yerinde oyalanır, inden çok uzaklaşmaz
    runMinutes(sim, 6 * 60);
    for (const d of wild) expect(Math.hypot(d.x - d.den!.x, d.y - d.den!.y)).toBeLessThan(8);
  });

  it('böğürtlen toplanır, ödülle evcilleşir, barınağa girince katılır', () => {
    const sim = Sim.create(76);
    // Böğürtlen çalısı
    let bush: { x: number; y: number } | null = null;
    for (let y = 0; y < sim.world.height && !bush; y++) for (let x = 0; x < sim.world.width && !bush; x++) if (sim.world.objectAt(x, y) === Obj.BerryBush) bush = { x, y };
    expect(bush).not.toBeNull();
    face(sim, bush!.x, bush!.y);
    expect(resolveAction(sim).kind).toBe('berries');
    expect(performAction(sim).ok).toBe(true);
    expect(sim.treats).toBe(BALANCE.eggs.treatsPerBush);
    expect(sim.world.objectAt(bush!.x, bush!.y)).toBe(Obj.Bush);
    sim.treats = 5;

    const wild = sim.dogs.find((d) => d.wild)!;
    wild.state = 'sit';
    wild.stateTimer = 999;
    sim.player.x = wild.x;
    sim.player.y = wild.y + 1.2;
    sim.player.facing = 3;
    sim.player.busy = 0;
    for (let i = 0; i < BALANCE.eggs.tameTreats; i++) {
      sim.player.busy = 0;
      const r = resolveAction(sim);
      expect(r.kind).toBe('treatWild');
      expect(performAction(sim).ok).toBe(true);
    }
    expect(wild.following).toBe(true);
    expect(sim.treats).toBe(5 - BALANCE.eggs.tameTreats);
    // Oyuncu barınağa ışınlanır; köpek yakalayıp arsaya girince katılır
    const p = sim.world.plotInterior();
    sim.player.x = p.x + p.w / 2;
    sim.player.y = p.y + p.h - 4;
    runMinutes(sim, 30);
    expect(wild.wild).toBe(false);
    expect(wild.following).toBe(false);
    expect(sim.shelterDogs().length).toBe(2);
    expect(sim.stats.strays).toBe(1);
  });
});

describe('Uyku ve keşif', () => {
  it('ofiste uyuyunca sabah olur, köpekler o sırada yaşar', () => {
    const sim = Sim.create(77);
    const office = sim.buildings.find((b) => b.type === 'office')!;
    sim.clock.totalMinutes = 21 * 60;
    face(sim, office.x + 1, office.y + 2);
    // 0.16.0: kapıda E içeri sokar; ofis paneli içerideki masada.
    expect(resolveAction(sim).kind).toBe('enter');
    expect(performAction(sim).ok).toBe(true);
    const desk = sim.interior!.items[0];
    sim.player.x = desk.x + 0.5;
    sim.player.y = desk.y + 1.7;
    sim.player.facing = 3;
    expect(resolveAction(sim).kind).toBe('office');
    expect(performAction(sim).open).toBe('office');
    const h0 = sim.dogs[0].needs.hunger;
    expect(sim.command({ type: 'sleep' }).ok).toBe(true);
    expect(sim.clock.hour).toBe(6);
    expect(sim.clock.day).toBe(2);
    expect(sim.dogs[0].needs.hunger).toBeGreaterThan(h0);
    expect(sim.player.stamina).toBe(BALANCE.player.staminaMax);
  });

  it('gece dışarıda kalınca 02:00’de bayılır ve ofiste uyanır', () => {
    const sim = Sim.create(78);
    sim.player.x = 20.5;
    sim.player.y = 20.5;
    sim.clock.totalMinutes = 1 * 60 + 50;
    runMinutes(sim, 20);
    expect(sim.clock.hour).toBe(6);
    expect(sim.world.inPlot(sim.player.tileX, sim.player.tileY)).toBe(true);
  });

  it('keşif sisi kalkar ve kayıtta korunur', () => {
    const sim = Sim.create(79);
    const c0 = sim.exploredCount;
    expect(c0).toBeGreaterThan(100);
    sim.player.x += 12;
    sim.update(0.1, { dx: 0, dy: 0, run: false });
    expect(sim.exploredCount).toBeGreaterThan(c0);
    const nest = sim.world.nests.find((n) => sim.world.objectAt(n.x, n.y) === Obj.NestEggs)!;
    sim.backpack.push(harvestNest(sim, nest.x, nest.y)!);
    sim.treats = 3;
    const back = Sim.fromJSON(SaveManager.parse(JSON.stringify(sim.toJSON()))!);
    expect(back.exploredCount).toBe(sim.exploredCount);
    expect(back.world.explored).toEqual(sim.world.explored);
    expect(back.backpack.length).toBe(1);
    expect(back.backpack[0].genome).toEqual(sim.backpack[0].genome);
    expect(back.treats).toBe(3);
    expect(back.nestTimers.size).toBe(1);
    expect(back.world.objectAt(nest.x, nest.y)).toBe(Obj.Nest);
    expect(back.dogs.filter((d) => d.wild).length).toBe(BALANCE.eggs.strayDens);
    expect(back.world.dens).toEqual(sim.world.dens);
  });
});
