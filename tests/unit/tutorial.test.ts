import { describe, expect, it } from 'vitest';
import { canPlaceBuilding } from '../../src/sim/entities/Building';
import { Sim } from '../../src/sim/Sim';
import { Tutorial, type TutorialEnd, type TutorialState } from '../../src/ui/tutorial/Tutorial';
import { TUTORIAL_GUIDED, TUTORIAL_READY, type TutorialView, stepText, stepsFor, tutorialCtx } from '../../src/ui/tutorial/steps';

const VIEW: TutorialView = { mode: 'avatar', buildBar: false, panel: 'none', buildType: null, touch: false };

function harness() {
  const log: Array<{ state: TutorialState | null; end?: TutorialEnd }> = [];
  const tabs: string[] = [];
  const tut = new Tutorial({ setBuildTab: (tab) => tabs.push(tab) }, (state, end) => log.push({ state, end }));
  return { tut, log, tabs };
}

function placeKennel(sim: Sim): void {
  const p = sim.world.plotInterior();
  for (let y = p.y + 1; y < p.y + p.h - 2; y++) {
    for (let x = p.x + 1; x < p.x + p.w - 2; x++) {
      if (canPlaceBuilding(sim.world, 'kennelSmall', x, y)) {
        sim.placeBuilding('kennelSmall', x, y, 90);
        return;
      }
    }
  }
  throw new Error('kulübe yeri yok');
}

describe('Açılış tanıtımı (0.22.5)', () => {
  it('iki liste: en çok 8 adım, benzersiz kimlik, hoş geldin ile başlar ve hedeflerle biter; metinler dolu', () => {
    for (const list of [TUTORIAL_GUIDED, TUTORIAL_READY]) {
      expect(list.length).toBeGreaterThanOrEqual(5);
      expect(list.length).toBeLessThanOrEqual(8);
      expect(new Set(list.map((s) => s.id)).size).toBe(list.length);
      expect(list[0].id).toBe('welcome');
      expect(list[0].info).toBeTruthy();
      expect(list[list.length - 1].id).toBe('goals');
      for (const s of list) {
        expect(s.text.length, s.id).toBeGreaterThan(20);
        // Her adım ya bilgi düğmesiyle ya da koşuluyla geçer.
        expect(!!s.info || !!s.done, s.id).toBe(true);
        expect(stepText(s, true).length).toBeGreaterThan(20);
      }
    }
    expect(stepsFor('guided')).toBe(TUTORIAL_GUIDED);
    expect(stepsFor('ready')).toBe(TUTORIAL_READY);
    expect(TUTORIAL_GUIDED.map((s) => s.id)).toContain('kennel');
    expect(TUTORIAL_READY.map((s) => s.id)).toContain('feed');
  });

  it('koşullar gerçek oyunda: yürü, sev, yönetim, inşa çubuğu, kulübe (kuruluş), kap doldur (hazır), hedef paneli', () => {
    const sim = Sim.create(2251, 'normal', 'guided');
    const ctx = tutorialCtx(sim);
    const by = (id: string) => TUTORIAL_GUIDED.find((s) => s.id === id)!;
    const dog = sim.shelterDogs()[0];
    // Yürü: köpeğe yakın ya da 3 kare yürüdü.
    sim.player.x = dog.x + 6;
    sim.player.y = dog.y;
    const walkCtx = tutorialCtx(sim);
    expect(by('walk').done!(sim, VIEW, walkCtx)).toBe(false);
    sim.player.x = dog.x + 1;
    expect(by('walk').done!(sim, VIEW, walkCtx)).toBe(true);
    sim.player.x = dog.x + 9;
    expect(by('walk').done!(sim, VIEW, walkCtx)).toBe(true);
    // Sev: tanıtım başından sonra en az bir kez.
    expect(by('pet').done!(sim, VIEW, ctx)).toBe(false);
    sim.stats.petted++;
    expect(by('pet').done!(sim, VIEW, ctx)).toBe(true);
    expect(by('manage').done!(sim, VIEW, ctx)).toBe(false);
    expect(by('manage').done!(sim, { ...VIEW, mode: 'manage' }, ctx)).toBe(true);
    expect(by('build-open').done!(sim, { ...VIEW, buildBar: true }, ctx)).toBe(true);
    expect(by('kennel').done!(sim, VIEW, ctx)).toBe(false);
    placeKennel(sim);
    expect(by('kennel').done!(sim, VIEW, ctx)).toBe(true);
    // Kulübe seçiliyken halka kalkar (yerleştirirken harita açık).
    expect(by('kennel').anchor!({ ...VIEW, buildBar: true })).toContain('kennelSmall');
    expect(by('kennel').anchor!({ ...VIEW, buildBar: true, buildType: 'kennelSmall' })).toBeNull();
    expect(by('goals').done!(sim, { ...VIEW, panel: 'goals' }, ctx)).toBe(true);
    // Kuruluşta köpeğin dünyadaki çapası var.
    expect(by('walk').world!(sim)).not.toBeNull();

    const ready = Sim.create(2252);
    const rctx = tutorialCtx(ready);
    const feed = TUTORIAL_READY.find((s) => s.id === 'feed')!;
    expect(feed.world!(ready)).not.toBeNull();
    expect(feed.done!(ready, VIEW, rctx)).toBe(false);
    ready.stats.bowlsFilled++;
    expect(feed.done!(ready, VIEW, rctx)).toBe(true);
    // Dokunmatikte ve masaüstünde sevme çapası ayrı; yönetim modunda yok.
    const pet = TUTORIAL_READY.find((s) => s.id === 'pet')!;
    expect(pet.anchor!({ ...VIEW, touch: true })).toContain('action-btn');
    expect(pet.anchor!(VIEW)).toContain('hint');
    expect(pet.anchor!({ ...VIEW, mode: 'manage' })).toBeNull();
  });

  it('durum makinesi: bilgi adımı düğmeyle geçer, yapılmış adımlar bir kerede geçilir, son adım bitirir', () => {
    const sim = Sim.create(2253, 'normal', 'guided');
    const { tut, log, tabs } = harness();
    tut.start(sim, 'guided');
    expect(tut.active).toBe(true);
    expect(tut.state).toEqual({ id: 'welcome', index: 0, total: TUTORIAL_GUIDED.length });
    tut.update(sim, VIEW);
    expect(tut.step?.id).toBe('welcome');
    tut.next();
    expect(tut.step?.id).toBe('walk');
    // Oyuncu öne geçti: köpeğin yanında, sevdi, yönetimde, inşa çubuğu açık → kulübe adımına kadar hepsi geçer.
    const dog = sim.shelterDogs()[0];
    sim.player.x = dog.x + 0.5;
    sim.player.y = dog.y;
    sim.stats.petted++;
    tut.update(sim, { ...VIEW, mode: 'manage', buildBar: true });
    expect(tut.step?.id).toBe('kennel');
    expect(tabs).toEqual(['barinma']);
    placeKennel(sim);
    tut.update(sim, { ...VIEW, mode: 'manage', buildBar: true });
    expect(tut.step?.id).toBe('goals');
    tut.update(sim, { ...VIEW, panel: 'goals' });
    expect(tut.active).toBe(false);
    expect(log[log.length - 1]).toEqual({ state: null, end: 'done' });
  });

  it('Atla, kapat, sessiz durdurma ve denetim için sabit atlama', () => {
    const sim = Sim.create(2254);
    const { tut, log } = harness();
    tut.start(sim, 'ready');
    tut.next();
    expect(tut.step?.id).toBe('feed');
    tut.next(); // Atla
    expect(tut.step?.id).toBe('pet');
    tut.close();
    expect(tut.active).toBe(false);
    expect(log[log.length - 1].end).toBe('closed');
    tut.start(sim, 'ready');
    tut.stop();
    expect(tut.active).toBe(false);
    expect(log[log.length - 1]).toEqual({ state: null, end: undefined });
    // Sabit atlama: koşulu sağlanmış adım da yerinde kalır.
    tut.jump(sim, 'ready', 4);
    expect(tut.step?.id).toBe('manage');
    tut.update(sim, { ...VIEW, mode: 'manage' });
    expect(tut.step?.id).toBe('manage');
    tut.jump(sim, 'guided', 99);
    expect(tut.step?.id).toBe('goals');
    // Son adımda Atla da bitirir.
    tut.next();
    expect(log[log.length - 1].end).toBe('done');
  });
});
