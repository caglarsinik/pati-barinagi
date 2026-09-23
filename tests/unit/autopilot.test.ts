import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { SaveManager } from '../../src/core/SaveManager';
import { IDLE_INPUT } from '../../src/sim/entities/Player';
import { type Building, canPlaceBuilding } from '../../src/sim/entities/Building';
import type { Dog } from '../../src/sim/entities/Dog';
import { Sim } from '../../src/sim/Sim';
import { PILOT_ID } from '../../src/sim/systems/Autopilot';
import { GOALS } from '../../src/sim/systems/Goals';
import { placeMess } from '../../src/sim/systems/MessSystem';
import { harvestNest } from '../../src/sim/systems/NestSystem';
import { Obj } from '../../src/sim/world/tiles';
import { landingTile, signposts } from '../../src/sim/world/Signposts';
import { questBoardTile } from '../../src/sim/world/Village';

function runSeconds(sim: Sim, sec: number): void {
  for (let i = 0; i < Math.ceil(sec * 30); i++) sim.update(1 / 30, IDLE_INPUT);
}

function pilotOn(seed: number): Sim {
  const sim = Sim.create(seed);
  // Belediye hedef ödülleri (0.19.1) para ölçen otopilot testlerini bozmasın.
  for (const g of GOALS) sim.goals.done.add(g.id);
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

/** Oyuncunun doğusunda, arsa içinde, pislik konabilen uzak bir kare. */
function farMessTile(sim: Sim, minDist: number): { x: number; y: number } {
  const p = sim.player;
  for (let dx = minDist; dx < minDist + 12; dx++) {
    for (const dy of [0, 1, -1, 2, -2]) {
      const t = placeMess(sim, p.tileX + dx, p.tileY + dy);
      if (t) return t;
    }
  }
  throw new Error('uzak kare yok');
}

describe('Otopilot 3: yumurta, böğürtlen, uyku, koşu', () => {
  it('çantadaki yumurtayı kuluçkaya koyar', () => {
    const sim = pilotOn(1330);
    calmDogs(sim);
    const inc = sim.buildings.find((b) => b.type === 'incubator')!;
    const nest = sim.world.nests.find((n) => sim.world.objectAt(n.x, n.y) === Obj.NestEggs)!;
    const egg = harvestNest(sim, nest.x, nest.y)!;
    sim.backpack.push(egg);
    runSeconds(sim, 40);
    // Çantadaki yumurta kuluçkada; sonrasında yakın yuvadan yenisini toplayıp onu da koymuş olabilir.
    expect(inc.eggs.some((e) => e.id === egg.id)).toBe(true);
    expect(sim.backpack.some((e) => e.id === egg.id)).toBe(false);
  });

  it('keşfedilmiş yakın yuvadan yumurta alır, keşfedilmemiş yuvaya gitmez', () => {
    const sim = pilotOn(1331);
    calmDogs(sim);
    const w = sim.world;
    const nest = w.nests.find((n) => w.objectAt(n.x, n.y) === Obj.NestEggs && Math.hypot(n.x - sim.player.x, n.y - sim.player.y) < BALANCE.autopilot.nestRadius)!;
    expect(nest).toBeTruthy();
    for (const n of w.nests) w.explored[w.idx(n.x, n.y)] = 0;
    runSeconds(sim, 5);
    expect(sim.stats.eggsFound).toBe(0);
    w.explored[w.idx(nest.x, nest.y)] = 1;
    runSeconds(sim, 60);
    expect(sim.stats.eggsFound).toBe(1);
    expect(w.objectAt(nest.x, nest.y)).toBe(Obj.Nest);
  });

  it('ödül maması azken keşfedilmiş çalıdan böğürtlen toplar, doluyken toplamaz', () => {
    const sim = pilotOn(1332);
    calmDogs(sim);
    const w = sim.world;
    const p = sim.player;
    let bush: { x: number; y: number } | null = null;
    for (let dx = 4; dx < 12 && !bush; dx++) {
      const x = p.tileX + dx;
      const y = p.tileY;
      if (w.inBounds(x, y) && !w.isSolid(x, y) && w.buildingIdAt(x, y) === -1 && w.objectAt(x, y) === Obj.None) bush = { x, y };
    }
    expect(bush).not.toBeNull();
    w.setObject(bush!.x, bush!.y, Obj.BerryBush);
    w.explored[w.idx(bush!.x, bush!.y)] = 1;
    sim.treats = BALANCE.eggs.treatsMax;
    runSeconds(sim, 5);
    expect(w.objectAt(bush!.x, bush!.y)).toBe(Obj.BerryBush);
    sim.treats = 0;
    runSeconds(sim, 30);
    expect(sim.treats).toBeGreaterThan(0);
    expect(w.objectAt(bush!.x, bush!.y)).toBe(Obj.Bush);
  });

  it('gece ofise girip yatakta sabaha kadar uyur, sabah kapıdan çıkar; gündüz uyumaz; boş kap varsa önce onu doldurur', () => {
    const sim = pilotOn(1333);
    calmDogs(sim);
    let entered = 0;
    sim.events.on('interiorChanged', (it) => {
      if (it) entered++;
    });
    sim.clock.totalMinutes = 12 * 60;
    runSeconds(sim, 10);
    expect(sim.stats.slept).toBe(0);
    sim.clock.totalMinutes = 21 * 60;
    const bowl = sim.buildings.find((b) => b.type === 'bowl')!;
    bowl.food = 0;
    sim.tasks.refresh();
    runSeconds(sim, 60);
    expect(sim.stats.bowlsFilled).toBeGreaterThanOrEqual(1);
    expect(sim.stats.slept).toBe(1);
    // Uyandıktan sonra koşu sürdüğü için saat 06:00'yı biraz geçmiş olabilir.
    expect(sim.clock.hour).toBeGreaterThanOrEqual(BALANCE.time.nightEndHour);
    expect(sim.clock.hour).toBeLessThan(BALANCE.time.nightEndHour + 4);
    expect(sim.pilot.blockedFor('sleep')).toBe(0);
    expect(sim.autopilot).toBe(true);
    // 0.16.4: ofise girdi, yatakta uyudu, sabah dışarı çıktı.
    expect(entered).toBe(1);
    expect(sim.interior).toBeNull();
  });

  it('ödül maması azken (böğürtlen yok, vahşi köpek keşfedilmiş) mutfağa girip eşiğe kadar pişirir, sonra çıkar', () => {
    const sim = pilotOn(1335);
    calmDogs(sim);
    const w = sim.world;
    for (let y = 0; y < w.height; y++) {
      for (let x = 0; x < w.width; x++) {
        const o = w.objectAt(x, y);
        if (o === Obj.BerryBush) w.setObject(x, y, Obj.Bush);
        if (o === Obj.NestEggs) w.setObject(x, y, Obj.Nest);
      }
    }
    const p = w.plotInterior();
    let kitchen: Building | null = null;
    for (let y = p.y + 2; y < p.y + p.h - 4 && !kitchen; y++) {
      for (let x = p.x + 2; x < p.x + p.w - 4 && !kitchen; x++) if (canPlaceBuilding(w, 'kitchen', x, y)) kitchen = sim.placeBuilding('kitchen', x, y);
    }
    expect(kitchen).not.toBeNull();
    kitchen!.buildLeft = 0;
    const wild = sim.dogs.find((d) => d.wild)!;
    w.explored[w.idx(wild.tileX, wild.tileY)] = 1;
    sim.clock.totalMinutes = 10 * 60;
    sim.treats = 0;
    sim.foodStock = 100;
    let entered = 0;
    sim.events.on('interiorChanged', (it) => {
      if (it?.kind === 'kitchen') entered++;
    });
    const keys = new Set<string>();
    for (let i = 0; i < 65 * 30; i++) {
      sim.update(1 / 30, IDLE_INPUT);
      if (sim.pilot.current) keys.add(sim.pilot.current.key);
    }
    expect([...keys]).toContain('bake');
    expect(entered).toBe(1);
    expect(sim.treats).toBe(BALANCE.autopilot.bakeBelowTreats);
    expect(sim.bakesToday).toBe(BALANCE.autopilot.bakeBelowTreats);
    expect(sim.foodStock).toBe(100 - BALANCE.autopilot.bakeBelowTreats * BALANCE.kitchen.foodPerTreat);
    expect(sim.interior).toBeNull();
  });

  it('uzak hedefe koşar, dayanıklılık düşünce yürür', () => {
    const sim = pilotOn(1334);
    calmDogs(sim);
    farMessTile(sim, 10);
    sim.tasks.refresh();
    runSeconds(sim, 0.5);
    expect(sim.pilot.current?.key.startsWith('clean:')).toBe(true);
    expect(sim.nav.path.length).toBeGreaterThan(BALANCE.autopilot.runMinTiles);
    expect(sim.player.running).toBe(true);
    sim.player.stamina = BALANCE.autopilot.runStopStamina - 5;
    runSeconds(sim, 0.2);
    expect(sim.player.running).toBe(false);
    expect(sim.pilot.run()).toBe(false);
  });
});

describe('Otopilot 4: köy, tabela ve görevler (0.20.5)', () => {
  it('varışta köy, tabela ve görev eylemlerini yapmaz; elle dokununca yapılır; hızlı seyahat otopilotu kapatır', () => {
    const sim = pilotOn(1341);
    calmDogs(sim);
    sim.villageFound = true;
    sim.stepSim(1);
    const w = sim.world;
    const seen: string[] = [];
    sim.events.on('interacted', (e) => seen.push(`${e.kind}:${e.result.ok}:${e.result.open ?? '-'}`));
    const arrive = (tile: { x: number; y: number }): string => {
      expect(sim.nav.goInteract({ kind: 'object', tile })).toBe(true);
      for (let i = 0; i < 300 && sim.nav.active; i++) sim.update(1 / 30, IDLE_INPUT);
      return seen[seen.length - 1] ?? '';
    };
    // Görev panosu: panel açılmaz.
    const board = questBoardTile(w)!;
    sim.player.x = board.x + 0.5;
    sim.player.y = board.y + 2.7;
    expect(arrive(board)).toBe('quests:false:-');
    // Köy tabelası: hızlı seyahat paneli açılmaz.
    const sign = signposts(w).find((s) => s.id === 'village')!;
    w.explored[w.idx(sign.x, sign.y)] = 1;
    const land = landingTile(w, sign);
    sim.player.x = land.x + 0.5;
    sim.player.y = land.y + 0.9;
    expect(arrive({ x: sign.x, y: sign.y })).toBe('travel:false:-');
    // Kayıp köpek: otopilot bulmaz, elle dokununca bulunur (otopilot kapanır).
    sim.player.x = board.x + 0.5;
    sim.player.y = board.y + 1.7;
    const q = sim.quests.list.find((x) => x.kind === 'lost')!;
    expect(sim.command({ type: 'questAccept', id: q.id }).ok).toBe(true);
    const d = q.dog!;
    const spot = { x: d.spotX, y: d.spotY };
    const nb = [
      [0, 1],
      [-1, 0],
      [1, 0],
      [0, -1],
    ]
      .map(([dx, dy]) => ({ x: spot.x + dx, y: spot.y + dy }))
      .find((c) => !w.isSolid(c.x, c.y))!;
    sim.player.x = nb.x + 0.5;
    sim.player.y = nb.y + 0.7;
    expect(arrive(spot)).toBe('lostDog:false:-');
    expect(d.found).toBe(false);
    expect(sim.autopilot).toBe(true);
    expect(sim.command({ type: 'goInteract', goal: { kind: 'object', tile: spot } }).ok).toBe(true);
    for (let i = 0; i < 300 && sim.nav.active; i++) sim.update(1 / 30, IDLE_INPUT);
    expect(sim.autopilot).toBe(false);
    expect(d.found).toBe(true);
    // Hızlı seyahat otopilotu kapatır (varınca eve yürümesin).
    sim.setAutopilot(true);
    sim.player.x = land.x + 0.5;
    sim.player.y = land.y + 0.9;
    expect(sim.command({ type: 'travel', to: 'shelter' }).ok).toBe(true);
    expect(sim.autopilot).toBe(false);
  });

  it('yuva ve çalı işleri barınağın çevresinde: köyün yakınındaki yuvaya ve çalıya gitmez', () => {
    const sim = pilotOn(1342);
    calmDogs(sim);
    sim.backpack = [];
    sim.treats = 0;
    const w = sim.world;
    for (const n of w.nests) w.explored[w.idx(n.x, n.y)] = 0;
    const v = w.village!;
    const free: Array<{ x: number; y: number }> = [];
    for (let y = v.y - 12; y < v.y - 7 && free.length < 2; y++) {
      for (let x = v.x; x < v.x + v.w && free.length < 2; x++) {
        if (!w.isSolid(x, y) && w.objectAt(x, y) === Obj.None && w.buildingIdAt(x, y) === -1) free.push({ x, y });
      }
    }
    expect(free).toHaveLength(2);
    const [nest, bush] = free;
    w.setObject(nest.x, nest.y, Obj.NestEggs);
    w.nests.push({ x: nest.x, y: nest.y });
    w.setObject(bush.x, bush.y, Obj.BerryBush);
    w.explored[w.idx(nest.x, nest.y)] = 1;
    w.explored[w.idx(bush.x, bush.y)] = 1;
    // Oyuncu köy girişinde: yuva ve çalı otopilotun yarıçapında ama barınaktan uzak.
    const land = landingTile(w, signposts(w).find((s) => s.id === 'village')!);
    sim.player.x = land.x + 0.5;
    sim.player.y = land.y + 0.9;
    expect(Math.hypot(nest.x - sim.player.x, nest.y - sim.player.y)).toBeLessThan(BALANCE.autopilot.nestRadius);
    runSeconds(sim, 15);
    expect(sim.stats.eggsFound).toBe(0);
    expect(w.objectAt(nest.x, nest.y)).toBe(Obj.NestEggs);
    expect(w.objectAt(bush.x, bush.y)).toBe(Obj.BerryBush);
  });
});
