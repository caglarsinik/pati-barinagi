import { describe, expect, it, vi } from 'vitest';
import { BALANCE } from '../../src/config/balance';
import { matchScore, requestText } from '../../src/sim/entities/Adopter';
import { STAGE_NAMES_TR, stageForAge } from '../../src/sim/entities/Dog';
import { Sim } from '../../src/sim/Sim';
import { runInspection } from '../../src/sim/systems/EconomySystem';
import { type Weather, seasonForWeek } from '../../src/sim/systems/WeatherSystem';

const DAY = 24 * 60;
const WEEK = 7 * DAY;

function runMinutes(sim: Sim, minutes: number): void {
  sim.setSpeed(4);
  const perStep = 0.5 * BALANCE.time.minutesPerRealSecond * 4;
  for (let i = 0; i < Math.ceil(minutes / perStep); i++) sim.update(0.5);
}

/** Saati verilen haftanın verilen gününe/saatine kurar (gün 0 = Pazartesi). */
function setClock(sim: Sim, week: number, weekday: number, hour: number): void {
  sim.clock.totalMinutes = (week - 1) * WEEK + weekday * DAY + hour * 60;
}

function alwaysLucky(sim: Sim): void {
  vi.spyOn(sim.rng, 'chance').mockReturnValue(true);
}

function pristine(sim: Sim): void {
  for (const d of sim.shelterDogs()) {
    d.needs = { ...d.needs, hunger: 0, play: 100, bladder: 0, hygiene: 100, health: 100, energy: 100, loyalty: 60 };
  }
  sim.foodStock = Math.max(sim.foodStock, 40);
}

describe('Mevsim ve hava', () => {
  it('haftadan mevsim: her mevsim 2 hafta, ilkbaharla başlar ve döner', () => {
    const w = BALANCE.seasons.weeksPerSeason;
    expect(seasonForWeek(1)).toBe('spring');
    expect(seasonForWeek(w)).toBe('spring');
    expect(seasonForWeek(w + 1)).toBe('summer');
    expect(seasonForWeek(2 * w + 1)).toBe('autumn');
    expect(seasonForWeek(3 * w + 1)).toBe('winter');
    expect(seasonForWeek(4 * w + 1)).toBe('spring');
  });

  it('hava tohumla deterministik ve mevsim tablosuna uyar', () => {
    const a = Sim.create(701);
    const b = Sim.create(701);
    expect(a.weatherSys.weather).toBe(b.weatherSys.weather);
    for (let i = 0; i < 20; i++) {
      a.weatherSys.roll();
      b.weatherSys.roll();
      expect(a.weatherSys.weather).toBe(b.weatherSys.weather);
    }
    // Kışın yağmur/fırtına olmaz, yazın kar yağmaz.
    setClock(a, 3 * BALANCE.seasons.weeksPerSeason + 1, 0, 6);
    expect(a.weatherSys.season).toBe('winter');
    const winter = new Set<Weather>();
    for (let i = 0; i < 60; i++) {
      a.weatherSys.roll();
      winter.add(a.weatherSys.weather);
    }
    expect(winter.has('rain')).toBe(false);
    expect(winter.has('storm')).toBe(false);
    expect(winter.has('snow')).toBe(true);
    setClock(a, BALANCE.seasons.weeksPerSeason + 1, 0, 6);
    expect(a.weatherSys.season).toBe('summer');
    for (let i = 0; i < 60; i++) {
      a.weatherSys.roll();
      expect(a.weatherSys.weather).not.toBe('snow');
      expect(a.weatherSys.nextChange).toBeGreaterThan(a.clock.totalMinutes);
    }
  });

  it('mevsim ve hava çarpanları', () => {
    const sim = Sim.create(702);
    const W = BALANCE.weather;
    setClock(sim, BALANCE.seasons.weeksPerSeason + 1, 0, 12); // yaz
    sim.weatherSys.weather = 'clear';
    let m = sim.weatherSys.modifiers();
    expect(m.hygiene).toBeCloseTo(W.summerHygieneMul);
    expect(m.cold).toBe(0);
    expect(m.adopters).toBe(1);
    sim.weatherSys.weather = 'rain';
    m = sim.weatherSys.modifiers();
    expect(m.hygiene).toBeCloseTo(W.summerHygieneMul * W.rainHygieneMul);
    expect(m.adopters).toBeCloseTo(W.rainAdopterMul);
    setClock(sim, 3 * BALANCE.seasons.weeksPerSeason + 1, 0, 12); // kış
    sim.weatherSys.weather = 'clear';
    m = sim.weatherSys.modifiers();
    expect(m.hunger).toBeCloseTo(W.winterHungerMul);
    expect(m.cold).toBe(W.coldDamagePerHour);
    sim.weatherSys.weather = 'snow';
    m = sim.weatherSys.modifiers();
    expect(m.cold).toBeCloseTo(W.coldDamagePerHour * 1.5);
    expect(m.energy).toBeCloseTo(W.winterEnergyMul * W.snowEnergyMul);
    expect(m.adopters).toBeCloseTo(W.snowAdopterMul);
    setClock(sim, 2 * BALANCE.seasons.weeksPerSeason + 1, 0, 12); // sonbahar
    expect(sim.weatherSys.modifiers().berryBonus).toBe(W.autumnBerryBonus);
    setClock(sim, 1, 0, 12); // ilkbahar
    expect(sim.weatherSys.modifiers().nestRespawn).toBeCloseTo(W.springNestMul);
  });

  it('kışın kulübesiz köpek gece üşür, sağlığı düşer', () => {
    const run = (week: number, weather: Weather): number => {
      const sim = Sim.create(703);
      const dog = sim.shelterDogs()[0];
      sim.assignKennel(dog, null);
      dog.needs = { ...dog.needs, hunger: 20, hygiene: 80, play: 60, health: 90, loyalty: 60, energy: 80 };
      setClock(sim, week, 1, 23);
      sim.weatherSys.weather = weather;
      sim.weatherSys.nextChange = Number.MAX_SAFE_INTEGER;
      runMinutes(sim, 60);
      expect(dog.kennelId).toBeNull();
      return dog.needs.health;
    };
    const spring = run(1, 'clear');
    const winter = run(3 * BALANCE.seasons.weeksPerSeason + 1, 'snow');
    expect(winter).toBeLessThan(spring);
    expect(spring - winter).toBeGreaterThan(1.5);
  });
});

describe('Yaşlı köpek', () => {
  it('52. haftada yaşlı aşamasına geçer, hafta tikinde duyurulur ve başarım açılır', () => {
    expect(stageForAge(51)).toBe('adult');
    expect(stageForAge(BALANCE.dogs.growth.seniorAtWeek)).toBe('senior');
    expect(STAGE_NAMES_TR.senior).toBe('Yaşlı');
    const sim = Sim.create(704);
    const dog = sim.shelterDogs()[0];
    dog.ageWeeks = BALANCE.dogs.growth.seniorAtWeek - 1;
    expect(dog.stage).toBe('adult');
    const messages: string[] = [];
    sim.events.on('message', (m) => messages.push(m));
    sim.clock.totalMinutes = WEEK + 5 * 60 + 50; // 2. hafta Pazartesi 05:50
    runMinutes(sim, 20);
    expect(dog.ageWeeks).toBe(BALANCE.dogs.growth.seniorAtWeek);
    expect(dog.stage).toBe('senior');
    expect(messages.some((m) => m.includes(dog.name) && m.includes('yaşlı'))).toBe(true);
    expect(sim.achievements.unlocked.has('senior')).toBe(true);
  });

  it('yaşlı köpek genel isteklerde puan kaybeder, yaşlı isteyen sahiplenici için kaybetmez', () => {
    const sim = Sim.create(705);
    const dog = sim.shelterDogs()[0];
    dog.needs = { ...dog.needs, health: 95, hygiene: 90, loyalty: 60 };
    dog.ageWeeks = BALANCE.dogs.growth.adultAtWeek;
    expect(dog.stage).toBe('adult');
    const adult = matchScore(dog, {});
    dog.ageWeeks = BALANCE.dogs.growth.seniorAtWeek;
    expect(dog.stage).toBe('senior');
    const senior = matchScore(dog, {});
    expect(adult - senior).toBe(10);
    expect(matchScore(dog, { stage: 'senior' })).toBeGreaterThanOrEqual(adult);
    expect(requestText({ stage: 'senior' })).toContain('yaşlı dost');
  });
});

describe('Olaylar', () => {
  it('gazete haberi: itibar +5 ve ertesi gün ekstra ziyaretçi', () => {
    const sim = Sim.create(706);
    alwaysLucky(sim);
    sim.stats.adopted = 1;
    const rep0 = sim.reputation;
    sim.eventSys.onHour(8);
    expect(sim.reputation).toBe(rep0 + 5);
    expect(sim.flags.extraAdoptersDay).toBe(sim.clock.day + 1);
    expect(sim.eventSys.log.at(-1)?.key).toBe('newspaper');
  });

  it('bağış kasaya ve deftere işlenir', () => {
    const sim = Sim.create(707);
    alwaysLucky(sim);
    const m0 = sim.money;
    sim.eventSys.onHour(11);
    expect(sim.money).toBeGreaterThan(m0);
    const entry = sim.ledger.find((e) => e.category === 'donation');
    expect(entry).toBeTruthy();
    expect(entry!.amount).toBe(sim.money - m0);
    expect(sim.eventSys.log.at(-1)?.key).toBe('donation');
  });

  it('indirim günü çuval yarı fiyat', () => {
    const sim = Sim.create(708);
    alwaysLucky(sim);
    const base = BALANCE.economy.foodBagPrice;
    expect(sim.foodBagPrice()).toBe(base);
    sim.eventSys.onHour(14);
    expect(sim.flags.foodDiscountDay).toBe(sim.clock.day);
    expect(sim.foodBagPrice()).toBe(Math.round(base / 2));
    const m0 = sim.money;
    expect(sim.command({ type: 'orderFood', bags: 1 }).ok).toBe(true);
    expect(m0 - sim.money).toBe(Math.round(base / 2));
    sim.clock.totalMinutes += DAY;
    expect(sim.foodBagPrice()).toBe(base);
  });

  it('gezici veteriner hasta köpekleri iyileştirir', () => {
    const sim = Sim.create(709);
    alwaysLucky(sim);
    const dog = sim.shelterDogs()[0];
    dog.needs.health = 50;
    sim.eventSys.onHour(16);
    expect(dog.needs.health).toBe(90);
    expect(sim.eventSys.log.at(-1)?.key).toBe('vet');
  });

  it('sürpriz denetim: temiz barınak ödül, bakımsız barınak ceza alır', () => {
    const good = Sim.create(710);
    alwaysLucky(good);
    setClock(good, 1, 2, 9); // Çarşamba
    pristine(good);
    const report = runInspection(good);
    expect(report.multiplier).toBeGreaterThanOrEqual(1.1);
    const m0 = good.money;
    const rep0 = good.reputation;
    good.eventSys.onHour(9);
    expect(good.money - m0).toBe(report.dogsCounted * BALANCE.events.inspectionBonusPerDog);
    expect(good.reputation).toBe(Math.min(100, rep0 + 3));
    expect(good.eventSys.log.at(-1)?.key).toBe('inspection');

    const bad = Sim.create(711);
    alwaysLucky(bad);
    setClock(bad, 1, 2, 9);
    for (const d of bad.shelterDogs()) d.needs = { ...d.needs, hunger: 100, play: 0, bladder: 100, hygiene: 0, health: 30, energy: 0 };
    bad.foodStock = 0;
    expect(runInspection(bad).multiplier).toBeLessThanOrEqual(0.8);
    const b0 = bad.money;
    const brep = bad.reputation;
    bad.eventSys.onHour(9);
    expect(b0 - bad.money).toBe(BALANCE.events.inspectionFine);
    expect(bad.reputation).toBe(Math.max(0, brep - 3));

    // Pazartesi (haftalık denetim günü) sürpriz denetim olmaz.
    const monday = Sim.create(712);
    alwaysLucky(monday);
    setClock(monday, 1, 0, 9);
    monday.eventSys.onHour(9);
    expect(monday.eventSys.log.some((e) => e.key === 'inspection')).toBe(false);
  });

  it('sadakati düşük köpek kaçar; süresi dolunca kaybolur, geri gelirse listeden düşer', () => {
    const sim = Sim.create(713);
    alwaysLucky(sim);
    const dog = sim.shelterDogs()[0];
    dog.needs.loyalty = 5;
    dog.state = 'idle';
    setClock(sim, 1, 0, 23);
    const rep0 = sim.reputation;
    sim.eventSys.onHour(23);
    expect(dog.wild).toBe(true);
    expect(dog.den).not.toBeNull();
    expect(sim.world.inPlot(dog.tileX, dog.tileY)).toBe(false);
    expect(dog.kennelId).toBeNull();
    expect(sim.shelterDogs().length).toBe(0);
    expect(sim.eventSys.escapes.map((e) => e.dogId)).toEqual([dog.id]);
    expect(sim.eventSys.log.at(-1)?.key).toBe('escape');

    // Geri getirilirse sokak köpeği sayılmaz, kaçak listesi temizlenir.
    const strays0 = sim.stats.strays;
    sim.joinShelter(dog);
    expect(dog.wild).toBe(false);
    expect(sim.eventSys.escapes).toEqual([]);
    expect(sim.stats.strays).toBe(strays0);

    // Tekrar kaçsın ve süre dolsun.
    dog.needs.loyalty = 5;
    dog.state = 'idle';
    sim.eventSys.onHour(23);
    expect(dog.wild).toBe(true);
    sim.clock.totalMinutes += BALANCE.events.escapeDays * DAY;
    sim.eventSys.onHour(6);
    expect(sim.dogById(dog.id)).toBeUndefined();
    expect(sim.eventSys.escapes).toEqual([]);
    expect(sim.reputation).toBe(Math.max(0, rep0 - 2));
    expect(sim.eventSys.log.at(-1)?.key).toBe('lost');
  });
});

describe('Başarımlar ve kayıt', () => {
  it('koşul sağlanınca açılır, itibar +1 verir, kayıtla korunur', () => {
    const sim = Sim.create(714);
    sim.achievements.check();
    expect(sim.achievements.unlocked.size).toBe(0);
    const got: string[] = [];
    sim.events.on('achievement', (a) => got.push(a.id));
    const rep0 = sim.reputation;
    sim.stats.eggsFound = 1;
    sim.achievements.check();
    expect(got).toEqual(['first-egg']);
    expect(sim.reputation).toBe(rep0 + 1);
    sim.achievements.check();
    expect(got.length).toBe(1);

    sim.eventSys.log.push({ day: sim.clock.day, key: 'donation', text: 'test' });
    sim.flags.foodDiscountDay = sim.clock.day;
    sim.weatherSys.weather = 'storm';
    const copy = Sim.fromJSON(JSON.parse(JSON.stringify(sim.toJSON())));
    expect([...copy.achievements.unlocked]).toEqual(['first-egg']);
    expect(copy.weatherSys.weather).toBe('storm');
    expect(copy.weatherSys.nextChange).toBe(sim.weatherSys.nextChange);
    expect(copy.eventSys.log).toEqual(sim.eventSys.log);
    expect(copy.flags).toEqual(sim.flags);
    expect(copy.achievements.check()).toBeUndefined();
    expect(copy.achievements.unlocked.size).toBe(1);
  });

  it('bilinmeyen başarım kimlikleri kayıttan yüklenmez', () => {
    const sim = Sim.create(715);
    sim.achievements.load(['first-egg', 'yok-boyle-bir-sey', 42]);
    expect([...sim.achievements.unlocked]).toEqual(['first-egg']);
  });
});
