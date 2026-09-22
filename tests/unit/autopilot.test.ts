import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { SaveManager } from '../../src/core/SaveManager';
import { IDLE_INPUT } from '../../src/sim/entities/Player';
import type { Building } from '../../src/sim/entities/Building';
import type { Dog } from '../../src/sim/entities/Dog';
import { Sim } from '../../src/sim/Sim';
import { PILOT_ID } from '../../src/sim/systems/Autopilot';
import { placeMess } from '../../src/sim/systems/MessSystem';
import { Obj } from '../../src/sim/world/tiles';

function runSeconds(sim: Sim, sec: number): void {
  for (let i = 0; i < Math.ceil(sec * 30); i++) sim.update(1 / 30, IDLE_INPUT);
}

function pilotOn(seed: number): Sim {
  const sim = Sim.create(seed);
  sim.setSpeed(1);
  expect(sim.command({ type: 'setAutopilot', on: true }).ok).toBe(true);
  expect(sim.autopilot).toBe(true);
  return sim;
}

describe('Otopilot 1: bakım', () => {
  it('boş yem kabını görev tahtasından seçip doldurur', () => {
    const sim = pilotOn(1301);
    const bowl = sim.buildings.find((b) => b.type === 'bowl')!;
    bowl.food = 0;
    expect(sim.foodStock).toBeGreaterThan(0);
    sim.tasks.refresh();
    runSeconds(sim, 30);
    expect(sim.stats.bowlsFilled).toBeGreaterThanOrEqual(1);
    expect(bowl.food).toBeGreaterThan(0);
    expect(sim.autopilot).toBe(true);
  });

  it('boş yalağı doldurur', () => {
    const sim = pilotOn(1302);
    const trough = sim.buildings.find((b) => b.type === 'trough')!;
    trough.water = 0;
    sim.tasks.refresh();
    runSeconds(sim, 30);
    expect(sim.stats.watered).toBeGreaterThanOrEqual(1);
  });

  it('pisliği temizler', () => {
    const sim = pilotOn(1303);
    const p = sim.player;
    const tile = placeMess(sim, p.tileX + 2, p.tileY);
    expect(tile).not.toBeNull();
    sim.tasks.refresh();
    runSeconds(sim, 20);
    expect(sim.stats.cleaned).toBeGreaterThanOrEqual(1);
    expect(sim.messTiles.size).toBe(0);
  });

  it('kiler boşsa ve para varsa bir çuval sipariş edip kabı doldurur', () => {
    const sim = pilotOn(1304);
    const bowl = sim.buildings.find((b) => b.type === 'bowl')!;
    bowl.food = 0;
    sim.foodStock = 0;
    sim.money = 5000;
    sim.tasks.refresh();
    runSeconds(sim, 4);
    expect(sim.ledger.some((e) => e.category === 'food')).toBe(true);
    expect(sim.foodStock).toBeGreaterThan(0);
    runSeconds(sim, 30);
    expect(sim.stats.bowlsFilled).toBeGreaterThanOrEqual(1);
  });

  it('parası yoksa sipariş vermez', () => {
    const sim = pilotOn(1305);
    sim.buildings.find((b) => b.type === 'bowl')!.food = 0;
    sim.foodStock = 0;
    sim.money = 0;
    runSeconds(sim, 5);
    expect(sim.ledger.some((e) => e.category === 'food')).toBe(false);
  });

  it('elle girdi ve dokunma komutları otopilotu kapatır', () => {
    const sim = pilotOn(1306);
    sim.update(1 / 30, { dx: 1, dy: 0, run: false });
    expect(sim.autopilot).toBe(false);
    sim.command({ type: 'setAutopilot', on: true });
    sim.command({ type: 'goTo', x: sim.player.tileX + 1, y: sim.player.tileY });
    expect(sim.autopilot).toBe(false);
    sim.command({ type: 'setAutopilot', on: true });
    sim.command({ type: 'interact' });
    expect(sim.autopilot).toBe(false);
    // Kapatınca üstlenilen görev serbest kalır ve yürüyüş durur.
    sim.command({ type: 'setAutopilot', on: true });
    const bowl = sim.buildings.find((b) => b.type === 'bowl')!;
    bowl.food = 0;
    sim.tasks.refresh();
    runSeconds(sim, 0.5);
    expect(sim.tasks.tasks.some((t) => t.claimedBy === PILOT_ID)).toBe(true);
    sim.command({ type: 'setAutopilot', on: false });
    expect(sim.tasks.tasks.some((t) => t.claimedBy === PILOT_ID)).toBe(false);
    expect(sim.nav.active).toBe(false);
  });

  it('yönetim modunda açılınca avatara geçer; yönetime dönünce görev bırakılır', () => {
    const sim = Sim.create(1307);
    sim.setMode('manage');
    sim.command({ type: 'setAutopilot', on: true });
    expect(sim.mode).toBe('avatar');
    sim.buildings.find((b) => b.type === 'bowl')!.food = 0;
    sim.tasks.refresh();
    runSeconds(sim, 0.5);
    expect(sim.pilot.current).not.toBeNull();
    sim.setMode('manage');
    expect(sim.pilot.current).toBeNull();
    expect(sim.tasks.tasks.some((t) => t.claimedBy === PILOT_ID)).toBe(false);
    expect(sim.autopilot).toBe(true);
  });

  it('otopilotun üstlendiği görev personele gitmez, personelin görevleri bozulmaz', () => {
    const sim = pilotOn(1308);
    const c = sim.candidates[0];
    c.role = 'caretaker';
    c.priorities = { feed: 4, water: 4, clean: 4, play: 0, groom: 0, train: 0, treat: 0 };
    expect(sim.command({ type: 'hire', candidateId: c.id }).ok).toBe(true);
    const staff = sim.staff[0];
    const bowl = sim.buildings.find((b) => b.type === 'bowl')!;
    bowl.food = 0;
    sim.tasks.refresh();
    runSeconds(sim, 0.5);
    const mine = sim.tasks.tasks.find((t) => t.claimedBy === PILOT_ID)!;
    expect(mine).toBeTruthy();
    expect(sim.tasks.bestFor(staff)?.id).not.toBe(mine.id);
    sim.tasks.releaseAll(staff.id);
    expect(mine.claimedBy).toBe(PILOT_ID);
    runSeconds(sim, 30);
    expect(sim.tasks.tasks.some((t) => t.claimedBy === PILOT_ID)).toBe(false);
  });

  it('ulaşılamaz hedef bırakılır ve bir süre yeniden denenmez', () => {
    const sim = pilotOn(1309);
    const fake = { id: 9001, type: 'feed' as const, targetId: 999999, tile: { x: 1, y: 1 }, urgency: 1, claimedBy: null, createdAt: 0, key: 'feed:999999' };
    sim.tasks.tasks.push(fake);
    runSeconds(sim, 0.5);
    expect(fake.claimedBy).toBeNull();
    expect(sim.pilot.blockedFor(fake.key)).toBeGreaterThan(BALANCE.autopilot.failCooldownSec - 2);
    expect(sim.pilot.current).toBeNull();
    runSeconds(sim, 5);
    expect(fake.claimedBy).toBeNull();
  });

  it('kayıt gidiş-dönüşünde otopilot durumu korunur', () => {
    const sim = pilotOn(1310);
    const back = Sim.fromJSON(SaveManager.parse(JSON.stringify(sim.toJSON()))!);
    expect(back.autopilot).toBe(true);
    const off = Sim.create(1311);
    expect(Sim.fromJSON(SaveManager.parse(JSON.stringify(off.toJSON()))!).autopilot).toBe(false);
  });
});

/** Arsa içinde w×h boş kare bulur (build.test.ts deseni). */
function freeSpot(sim: Sim, w: number, h: number): { x: number; y: number } {
  const p = sim.world.plotInterior();
  for (let y = p.y + 2; y < p.y + p.h - h - 2; y++) {
    for (let x = p.x + 2; x < p.x + p.w - w - 2; x++) {
      let ok = true;
      for (let yy = y - 1; yy <= y + h + 1 && ok; yy++) {
        for (let xx = x - 1; xx <= x + w && ok; xx++) {
          if (sim.world.isSolid(xx, yy) || sim.world.buildingIdAt(xx, yy) !== -1 || sim.world.objectAt(xx, yy) !== Obj.None) ok = false;
        }
      }
      if (ok && !sim.dogs.some((d) => d.tileX >= x - 1 && d.tileX <= x + w && d.tileY >= y - 1 && d.tileY <= y + h + 1)) return { x, y };
    }
  }
  throw new Error('boş yer yok');
}

/** Köpekleri yerinde tutar ve bütün ihtiyaçlarını doyurur; test tek bir ihtiyacı açar. */
function calmDogs(sim: Sim): Dog[] {
  const dogs = sim.shelterDogs();
  for (const d of dogs) {
    d.state = 'sit';
    d.stateTimer = 9999;
    d.needs.play = 100;
    d.needs.hygiene = 100;
    d.needs.health = 100;
    d.needs.energy = 100;
    d.petsToday = 1;
  }
  sim.policies.trainTarget = 0;
  return dogs;
}

/** Hazır bina yerleştirir (para verilir, inşaat anında biter). */
function placeReady(sim: Sim, type: 'groomStation' | 'vetClinic', w: number, h: number): Building {
  sim.money = 20000;
  const spot = freeSpot(sim, w, h);
  expect(sim.command({ type: 'placeBuilding', building: type, x: spot.x, y: spot.y }).ok).toBe(true);
  const b = sim.buildings.find((x) => x.type === type)!;
  b.buildLeft = 0;
  return b;
}

describe('Otopilot 2: köpek işleri', () => {
  it('keyfi düşük köpekle oynar (araç: oyna)', () => {
    const sim = pilotOn(1320);
    const [dog] = calmDogs(sim);
    dog.needs.play = 10;
    sim.tasks.refresh();
    runSeconds(sim, 30);
    expect(sim.stats.played).toBeGreaterThanOrEqual(1);
    expect(sim.tool).toBe('play');
  });

  it('eğitim hedefi olan köpeği eğitir (araç: eğit)', () => {
    const sim = pilotOn(1321);
    calmDogs(sim);
    sim.policies.trainTarget = 6;
    sim.tasks.refresh();
    runSeconds(sim, 30);
    expect(sim.stats.trained).toBeGreaterThanOrEqual(1);
    expect(sim.tool).toBe('train');
  });

  it('uyuyan ya da bitkin köpeğe oyun/eğitim görevi almaz, ceza da vermez', () => {
    const sim = pilotOn(1322);
    const [dog] = calmDogs(sim);
    dog.needs.play = 10;
    dog.needs.energy = 5; // playMinEnergy altı
    sim.tasks.refresh();
    runSeconds(sim, 5);
    expect(sim.stats.played).toBe(0);
    expect(sim.pilot.blockedFor(`play:${dog.id}`)).toBe(0);
    expect(sim.tasks.tasks.some((t) => t.claimedBy === PILOT_ID)).toBe(false);
  });

  it('kirli köpeği istasyon yoksa fırçalar (araç: temizle)', () => {
    const sim = pilotOn(1323);
    const [dog] = calmDogs(sim);
    dog.needs.hygiene = 10;
    sim.tasks.refresh();
    runSeconds(sim, 30);
    expect(sim.stats.groomed).toBeGreaterThanOrEqual(1);
    expect(sim.tool).toBe('clean');
    expect(dog.needs.hygiene).toBeGreaterThan(10);
  });

  it('tımar istasyonunun yanındaki kirli köpeği istasyonda yıkar', () => {
    const sim = pilotOn(1324);
    const [dog] = calmDogs(sim);
    const st = placeReady(sim, 'groomStation', 2, 2);
    dog.x = st.x + 1.5;
    dog.y = st.y + 3.5;
    dog.needs.hygiene = 10;
    sim.tasks.refresh();
    runSeconds(sim, 40);
    expect(sim.stats.groomed).toBeGreaterThanOrEqual(1);
    expect(dog.needs.hygiene).toBeGreaterThan(90); // yıkama 100 yapar, fırçalama bu kadar çıkaramaz
  });

  it('hasta köpeği klinik varsa tedavi eder; klinik yoksa görevi atlar, kara listeye almaz', () => {
    const sim = pilotOn(1325);
    const [dog] = calmDogs(sim);
    dog.needs.health = 40;
    sim.tasks.refresh();
    runSeconds(sim, 5);
    expect(sim.stats.treated).toBe(0);
    expect(sim.pilot.blockedFor(`treat:${dog.id}`)).toBe(0);
    expect(sim.tasks.tasks.find((t) => t.type === 'treat')?.claimedBy ?? null).toBeNull();

    const clinic = placeReady(sim, 'vetClinic', 3, 3);
    const m0 = sim.money;
    dog.x = clinic.x + 1.5;
    dog.y = clinic.y + 4.5;
    sim.tasks.refresh();
    runSeconds(sim, 40);
    expect(sim.stats.treated).toBeGreaterThanOrEqual(1);
    expect(sim.money).toBeLessThan(m0);
    expect(dog.needs.health).toBeGreaterThan(40);
  });

  it('iş yokken bugün sevilmemiş köpekleri birer kez sever (araç: sev)', () => {
    const sim = pilotOn(1326);
    const dogs = calmDogs(sim);
    for (const d of dogs) d.petsToday = 0;
    sim.command({ type: 'setTool', tool: 'call' });
    runSeconds(sim, 40);
    expect(sim.stats.petted).toBeGreaterThanOrEqual(1);
    expect(sim.stats.petted).toBeLessThanOrEqual(dogs.length);
    expect(sim.tool).toBe('pet');
    for (const d of dogs) expect(d.petsToday).toBeLessThanOrEqual(1);
  });
});
