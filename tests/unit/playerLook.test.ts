import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Rng } from '../../src/core/Rng';
import { SaveManager } from '../../src/core/SaveManager';
import { getLang, setLang } from '../../src/i18n';
import {
  DEFAULT_LOOK,
  HAT_COLORS,
  LOOK_COUNTS,
  LOOK_KEYS,
  displayPlayerName,
  hexCss,
  isDefaultLook,
  lookFromJSON,
  lookKey,
  lookOptionColor,
  lookOptionName,
  randomLook,
  sameLook,
  sanitizePlayerName,
  stepLook,
} from '../../src/sim/entities/PlayerLook';
import { Sim } from '../../src/sim/Sim';

/** Düğümde localStorage yok: Map tabanlı sahte depo (save-slots testi gibi). */
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

describe('Oyuncu görünümü modeli (0.24.0)', () => {
  it('varsayılan hepsi 0; anahtar 11 karakter; 500 rastgele görünümün anahtarı görünüm kadar benzersiz', () => {
    expect(isDefaultLook(DEFAULT_LOOK)).toBe(true);
    expect(lookKey(DEFAULT_LOOK)).toBe('00000000000');
    const rng = new Rng(99);
    const keys = new Set<string>();
    const looks = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const l = randomLook(rng);
      keys.add(lookKey(l));
      looks.add(JSON.stringify(l));
      for (const k of LOOK_KEYS) {
        expect(l[k]).toBeGreaterThanOrEqual(0);
        expect(l[k]).toBeLessThan(LOOK_COUNTS[k]);
      }
    }
    expect(keys.size).toBe(looks.size);
    expect(looks.size).toBeGreaterThan(400);
  });

  it('lookFromJSON aralık dışı, ondalık, metin ve eksik alanları varsayılana çeker', () => {
    expect(lookFromJSON(null)).toEqual({ ...DEFAULT_LOOK });
    expect(lookFromJSON([])).toEqual({ ...DEFAULT_LOOK });
    expect(lookFromJSON('x')).toEqual({ ...DEFAULT_LOOK });
    const l = lookFromJSON({ body: -1, hat: 5, shirt: 2.5, skin: '2', hairStyle: 4, accessory: 2 });
    expect(l.body).toBe(0);
    expect(l.hat).toBe(0);
    expect(l.shirt).toBe(0);
    expect(l.skin).toBe(0);
    expect(l.hairStyle).toBe(4);
    expect(l.accessory).toBe(2);
    const full = randomLook(new Rng(3));
    expect(lookFromJSON(JSON.parse(JSON.stringify(full)))).toEqual(full);
    expect(sameLook(full, { ...full })).toBe(true);
    expect(sameLook(full, { ...full, shoes: (full.shoes + 1) % LOOK_COUNTS.shoes })).toBe(false);
  });

  it('randomLook deterministik; şapka ve aksesuar çoğunlukla yok', () => {
    expect(randomLook(new Rng(5))).toEqual(randomLook(new Rng(5)));
    let noHat = 0;
    let noAcc = 0;
    for (let s = 0; s < 300; s++) {
      const l = randomLook(new Rng(s));
      if (l.hat === 0) noHat++;
      if (l.accessory === 0) noAcc++;
    }
    expect(noHat / 300).toBeGreaterThan(0.45);
    expect(noHat / 300).toBeLessThan(0.75);
    expect(noAcc / 300).toBeGreaterThan(0.5);
  });

  it('ad temizlenir ve en çok 14 karakter; boş ad varsayılanı gösterir (TR/EN)', () => {
    expect(sanitizePlayerName('  Ayşe   Nur ')).toBe('Ayşe Nur');
    expect(sanitizePlayerName('De\u0000fne\u001f\n Su')).toBe('Defne Su');
    expect(sanitizePlayerName('Abcdefghijklmn opqr')).toBe('Abcdefghijklmn');
    expect(sanitizePlayerName('Abcdefghijklm  opqr').length).toBeLessThanOrEqual(14);
    expect(sanitizePlayerName(42)).toBe('');
    expect(sanitizePlayerName(null)).toBe('');
    const lang = getLang();
    setLang('tr');
    expect(displayPlayerName('')).toBe('Bakıcı');
    expect(displayPlayerName('Defne')).toBe('Defne');
    setLang('en');
    expect(displayPlayerName('')).toBe('Caretaker');
    setLang(lang);
  });

  it('stepLook uçlarda döner, öbür alanlara dokunmaz; hexCss altı basamak (0.24.1)', () => {
    const l = stepLook(DEFAULT_LOOK, 'hat', -1);
    expect(l.hat).toBe(LOOK_COUNTS.hat - 1);
    expect(stepLook(l, 'hat', 1).hat).toBe(0);
    expect(stepLook(DEFAULT_LOOK, 'body', 1)).toEqual({ ...DEFAULT_LOOK, body: 1 });
    expect(stepLook(DEFAULT_LOOK, 'body', 1).skin).toBe(0);
    expect(hexCss(0x3f82dc)).toBe('#3f82dc');
    expect(hexCss(0x000102)).toBe('#000102');
  });

  it('seçenek adı ve rengi', () => {
    expect(lookOptionName('hairStyle', 2)).toBe('At kuyruğu');
    expect(lookOptionName('hairStyle', 99)).toBe('Kısa');
    expect(lookOptionName('body', 1)).toBe('Kadın');
    expect(lookOptionColor('hat', 0)).toBeNull();
    expect(lookOptionColor('hat', 1)).toBe(HAT_COLORS[0]);
    expect(lookOptionColor('body', 1)).toBeNull();
    expect(lookOptionColor('shirt', 1)).toBe(0xe4514f);
  });
});

describe('Oyuncu görünümü sim ve kayıt (0.24.0)', () => {
  it('profil ana RNG sırasını ve dünyayı değiştirmez', () => {
    const a = Sim.create(77, 'normal', 'ready');
    const b = Sim.create(77, 'normal', 'ready', 10, { look: randomLook(new Rng(1)), name: '  Ada  ' });
    expect(b.player.name).toBe('Ada');
    expect(isDefaultLook(a.player.look)).toBe(true);
    expect(isDefaultLook(b.player.look)).toBe(false);
    const ra = (a as unknown as { rng: { next(): number } }).rng.next();
    const rb = (b as unknown as { rng: { next(): number } }).rng.next();
    expect(rb).toBe(ra);
    expect(b.dogs.map((d) => `${d.name}@${d.x},${d.y}`)).toEqual(a.dogs.map((d) => `${d.name}@${d.x},${d.y}`));
    expect(b.candidates.map((c) => c.name)).toEqual(a.candidates.map((c) => c.name));
  });

  it('setPlayer komutu temizler, bir kez olay verir; kayıtta gider gelir; eski kayıt varsayılan', () => {
    const sim = Sim.create(77);
    const events: Array<{ look: unknown; name: string }> = [];
    sim.events.on('playerChanged', (e) => events.push(e));
    const look = { ...DEFAULT_LOOK, body: 1, hairStyle: 1, pantsStyle: 2, accessory: 1, hat: 9 };
    expect(sim.command({ type: 'setPlayer', look, name: ' Defne\u0000 ' }).ok).toBe(true);
    expect(events.length).toBe(1);
    expect(events[0].name).toBe('Defne');
    expect(sim.player.look.hat).toBe(0);
    expect(sim.player.look.body).toBe(1);
    expect(sim.command({ type: 'setPlayer', name: 'Su' }).ok).toBe(true);
    expect(sim.player.look.body).toBe(1);
    expect(sim.player.name).toBe('Su');
    const data = JSON.parse(JSON.stringify(sim.toJSON()));
    const back = Sim.fromJSON(data);
    expect(back.player.look).toEqual(sim.player.look);
    expect(back.player.name).toBe('Su');
    delete data.player.look;
    delete data.player.name;
    const old = Sim.fromJSON(data);
    expect(isDefaultLook(old.player.look)).toBe(true);
    expect(old.player.name).toBe('');
  });

  describe('kayıt özeti', () => {
    const g = globalThis as unknown as { localStorage?: MemoryStorage };
    beforeEach(() => {
      g.localStorage = new MemoryStorage();
    });
    afterEach(() => {
      delete g.localStorage;
    });

    it('yuva kartı için ad ve görünüm; eski kayıtta boş ad ve varsayılan görünüm', () => {
      const sim = Sim.create(5);
      sim.command({ type: 'setPlayer', look: { ...DEFAULT_LOOK, body: 1, hat: 2 }, name: 'Defne' });
      expect(SaveManager.write(1, sim.toJSON())).toBe(true);
      const s = SaveManager.summary(1)!;
      expect(s.name).toBe('Defne');
      expect(s.look.body).toBe(1);
      expect(s.look.hat).toBe(2);
      const old = JSON.parse(JSON.stringify(sim.toJSON()));
      delete old.player.look;
      delete old.player.name;
      SaveManager.write(2, old);
      const s2 = SaveManager.summary(2)!;
      expect(s2.name).toBe('');
      expect(isDefaultLook(s2.look)).toBe(true);
    });
  });
});
