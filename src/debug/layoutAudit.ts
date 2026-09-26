/**
 * Arayüz yerleşim denetimi (0.21.6; yalnız `?debug=1`, `__pati.debug`): açık arayüzde kutusundan taşan ya da kesilen
 * yazıları, ekran dışında kalan öğeleri ve üst üste binen yazı/kutuları bulur. `layoutAudit()` o anki ekranı,
 * `auditScreens()` zengin bir test oyununda bütün panelleri ve HUD hâllerini sırayla açıp denetler (telefon/tablet boyutu
 * pencereden gelir). Bilerek üst üste binen süsler (rozet, mini harita düğmesi, fotoğraf içi) sayılmaz.
 */
import { BUILD_ORDER, type BuildingType } from '../content/buildings';
import { Rng, hash3 } from '../core/Rng';
import type { Building } from '../sim/entities/Building';
import { createEgg } from '../sim/entities/Egg';
import { randomGenome } from '../sim/entities/DogGenome';
import type { Sim, StarterKind } from '../sim/Sim';
import { buildMorningReport } from '../sim/systems/DayReport';
import { closeWeek } from '../sim/systems/EconomySystem';
import { placeEgg } from '../sim/systems/IncubatorSystem';
import { MENU_GROUPS } from '../ui/menu';
import { type Panel, showToast, store, syncStore } from '../ui/store';

export type IssueKind = 'spill' | 'clip' | 'ellipsis' | 'offscreen' | 'hscroll' | 'text-text' | 'text-box' | 'box-box';

export interface LayoutIssue {
  kind: IssueKind;
  /** Öğenin kısa yolu (son üç düğüm). */
  where: string;
  /** Yazının başı. */
  text: string;
  /** Çakışmada öbür öğe. */
  other?: string;
  /** Taşma ya da çakışma miktarı (px). */
  px: number;
}

export interface ScreenReport {
  screen: string;
  issues: LayoutIssue[];
}

interface Box {
  l: number;
  t: number;
  r: number;
  b: number;
}

/** Katman kökleri: farklı katmandaki öğelerin üst üste binmesi bilerek (panel HUD'un, açılır liste çubuğun üstünde). */
const LAYERS = '.overlay, .menu-screen, .toasts, .nav-menu, .tool-popover, .rotate-hint';
/** Bilerek bindirilen süsler. */
const INTENTIONAL = '.nav-badge, .minimap-toggle, .photo-scene';
/** Bilerek yatay kayan şeritler (sahiplenici kartları, inşa öğeleri, üst şerit, tablolar). */
const HSCROLL_OK = '.adopter-list, .build-items, .build-tab-list, .tb-left, .table-scroll';
const TOL = 1;

const inter = (a: Box, b: Box): Box => ({ l: Math.max(a.l, b.l), t: Math.max(a.t, b.t), r: Math.min(a.r, b.r), b: Math.min(a.b, b.b) });
const boxOf = (r: DOMRect): Box => ({ l: r.left, t: r.top, r: r.right, b: r.bottom });
const w = (a: Box): number => a.r - a.l;
const h = (a: Box): number => a.b - a.t;

function label(el: Element): string {
  const cls = [...el.classList].slice(0, 3).join('.');
  return el.tagName.toLowerCase() + (cls ? '.' + cls : '');
}

function pathOf(el: Element): string {
  const parts: string[] = [];
  let e: Element | null = el;
  for (let i = 0; i < 3 && e && e.id !== 'ui'; i++, e = e.parentElement) parts.unshift(label(e));
  return parts.join(' > ');
}

function snippet(el: Element): string {
  const s = el instanceof HTMLSelectElement ? (el.selectedOptions[0]?.text ?? '') : el instanceof HTMLInputElement ? el.value : (el.textContent ?? '');
  return s.replace(/\s+/g, ' ').trim().slice(0, 48);
}

function isVisible(el: Element): boolean {
  const s = getComputedStyle(el);
  if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

const transparent = (c: string): boolean => c === 'transparent' || /rgba\([^)]*,\s*0\)$/.test(c);

/** Kendi arka planı, kenarlığı ya da görüntüsü olan kutu. */
function isPainted(el: Element, s: CSSStyleDeclaration): boolean {
  if (el instanceof HTMLCanvasElement || el instanceof HTMLImageElement) return true;
  if (!transparent(s.backgroundColor) || s.backgroundImage !== 'none') return true;
  const border = parseFloat(s.borderTopWidth) + parseFloat(s.borderBottomWidth) + parseFloat(s.borderLeftWidth) + parseFloat(s.borderRightWidth);
  return border > 0 && s.borderTopStyle !== 'none' && !transparent(s.borderTopColor);
}

interface Clipper {
  el: Element;
  box: Box;
  /** Eksende kaydırılabilir mi (içerik kaydırarak görülür) ya da gizli mi (kesilir). */
  scrollX: boolean;
  scrollY: boolean;
  hiddenX: boolean;
  hiddenY: boolean;
  ellipsis: boolean;
}

/** Öğenin kendi taşma kırpması (yoksa null; önbellekli). */
function clipperOf(a: Element, cache: Map<Element, Clipper | null>): Clipper | null {
  let c = cache.get(a);
  if (c !== undefined) return c;
  c = null;
  const s = getComputedStyle(a);
  if (s.overflowX !== 'visible' || s.overflowY !== 'visible') {
    const r = a.getBoundingClientRect();
    const l = r.left + a.clientLeft;
    const t = r.top + a.clientTop;
    c = {
      el: a,
      box: {
        l: s.overflowX === 'visible' ? -1e9 : l,
        r: s.overflowX === 'visible' ? 1e9 : l + a.clientWidth,
        t: s.overflowY === 'visible' ? -1e9 : t,
        b: s.overflowY === 'visible' ? 1e9 : t + a.clientHeight,
      },
      scrollX: s.overflowX === 'auto' || s.overflowX === 'scroll',
      scrollY: s.overflowY === 'auto' || s.overflowY === 'scroll',
      hiddenX: s.overflowX === 'hidden' || s.overflowX === 'clip',
      hiddenY: s.overflowY === 'hidden' || s.overflowY === 'clip',
      ellipsis: s.textOverflow === 'ellipsis',
    };
  }
  cache.set(a, c);
  return c;
}

/** Öğeyi kırpan atalar (içten dışa); absolute öğeyi yalnız konumlanmış ata ve üstü, fixed öğeyi hiçbiri kırpmaz. */
function clippers(el: Element, cache: Map<Element, Clipper | null>): Clipper[] {
  const out: Clipper[] = [];
  let pos = getComputedStyle(el).position;
  if (pos === 'fixed') return out;
  let skip = pos === 'absolute';
  for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
    const s = getComputedStyle(a);
    if (skip && s.position === 'static') continue;
    skip = false;
    const c = clipperOf(a, cache);
    if (c) out.push(c);
    pos = s.position;
    if (pos === 'fixed') break;
    if (pos === 'absolute') skip = true;
  }
  return out;
}

/** Kutu: satır içi olmayan en yakın ata (yazının arka planı). */
function blockOf(el: Element): Element {
  let e: Element | null = el;
  while (e && e.parentElement) {
    const d = getComputedStyle(e).display;
    if (d !== 'inline' && d !== 'contents') return e;
    e = e.parentElement;
  }
  return el;
}

function textRects(el: Element): DOMRect[] {
  const out: DOMRect[] = [];
  for (const n of el.childNodes) {
    if (n.nodeType !== Node.TEXT_NODE || !n.textContent?.trim()) continue;
    const range = document.createRange();
    range.selectNodeContents(n);
    for (const r of range.getClientRects()) if (r.width > 0.5 && r.height > 0.5) out.push(r);
  }
  return out;
}

let measureCtx: CanvasRenderingContext2D | null = null;
function textWidth(text: string, s: CSSStyleDeclaration): number {
  measureCtx ??= document.createElement('canvas').getContext('2d');
  if (!measureCtx) return 0;
  measureCtx.font = `${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
  return measureCtx.measureText(text).width;
}

/** O anki arayüzü denetler (varsayılan kök `#ui`). */
export function layoutAudit(root: Element | null = document.getElementById('ui')): LayoutIssue[] {
  if (!root) return [];
  const issues: LayoutIssue[] = [];
  const seen = new Set<string>();
  const add = (i: LayoutIssue): void => {
    const key = `${i.kind}|${i.where}|${i.text}|${i.other ?? ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    issues.push({ ...i, px: Math.round(i.px) });
  };
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cache = new Map<Element, Clipper | null>();
  const visibleBox = (el: Element, b: Box): Box => clippers(el, cache).reduce((acc, c) => inter(acc, c.box), b);
  const layerOf = (el: Element): Element | string => el.closest(LAYERS) ?? 'hud';

  const texts: Array<{ el: Element; box: Box; layer: Element | string }> = [];
  const boxes: Array<{ el: Element; box: Box; layer: Element | string }> = [];
  const offscreen = new Set<Element>();
  const all = [root, ...root.querySelectorAll('*')].filter(isVisible);

  for (const el of all) {
    const s = getComputedStyle(el);
    const rect = boxOf(el.getBoundingClientRect());
    const vis = visibleBox(el, rect);
    const shown = w(vis) > 0.5 && h(vis) > 0.5;
    const intentional = !!el.closest(INTENTIONAL);

    // Ekran dışı: kırpılmış görünür bölge görünüm alanını aşıyor (yalnız en dıştaki öğe raporlanır).
    if (shown && (vis.r > vw + TOL || vis.b > vh + TOL || vis.l < -TOL || vis.t < -TOL)) {
      offscreen.add(el);
      if (!el.parentElement || !offscreen.has(el.parentElement)) {
        const px = Math.max(vis.r - vw, vis.b - vh, -vis.l, -vis.t);
        add({ kind: 'offscreen', where: pathOf(el), text: snippet(el), px });
      }
    }

    // Kutu atasının dışına taşıyor (atası kırpmıyorsa görünür biçimde taşar).
    const parent = el.parentElement;
    if (parent && parent !== root.parentElement && !intentional && s.display !== 'inline' && s.position !== 'absolute' && s.position !== 'fixed') {
      const ps = getComputedStyle(parent);
      const pr = parent.getBoundingClientRect();
      const over = Math.max(rect.r - pr.right, pr.left - rect.l);
      if (ps.overflowX === 'visible' && over > TOL && ps.display !== 'inline' && ps.display !== 'contents') {
        add({ kind: 'spill', where: pathOf(el), text: snippet(el), other: label(parent), px: over });
      }
    }

    // Dikey kayan kutuda yatay kayma: içindeki bir öğe kutudan geniş (en sağa uzanan öğe gösterilir).
    if ((s.overflowX === 'auto' || s.overflowX === 'scroll') && el.scrollWidth > el.clientWidth + TOL && !el.matches(HSCROLL_OK)) {
      const inner = el.getBoundingClientRect().left + el.clientLeft + el.clientWidth;
      let wide: Element | null = null;
      let right = inner + TOL;
      for (const c of el.querySelectorAll('*')) {
        const cr = c.getBoundingClientRect().right;
        if (cr > right + 0.5 && isVisible(c)) {
          right = cr;
          wide = c;
        }
      }
      add({ kind: 'hscroll', where: pathOf(el), text: snippet(el).slice(0, 24), other: wide ? pathOf(wide) + ' «' + snippet(wide).slice(0, 24) + '»' : undefined, px: el.scrollWidth - el.clientWidth });
    }

    // Seçim kutusu ve sayı/metin girişinde seçili metin sığıyor mu.
    if (el instanceof HTMLSelectElement || (el instanceof HTMLInputElement && (el.type === 'text' || el.type === 'number'))) {
      const text = snippet(el);
      const room = el.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight) - (el instanceof HTMLSelectElement ? 18 : el.type === 'number' ? 14 : 0);
      const need = textWidth(text, s);
      if (text && need > room + TOL) add({ kind: 'clip', where: pathOf(el), text, px: need - room });
    }

    // Yazılar: kutusundan taşma, kırpılma, üç nokta.
    const rects = textRects(el);
    if (rects.length > 0) {
      const block = blockOf(el);
      const bb = block.getBoundingClientRect();
      const bs = getComputedStyle(block);
      // Yazı düğümü öğenin çocuğudur: öğenin kendi kırpması da sayılır.
      const own = clipperOf(el, cache);
      const chain = own ? [own, ...clippers(el, cache)] : clippers(el, cache);
      for (const r of rects) {
        const tb = boxOf(r);
        // Dikeyde yazı tipinin iç payı (emoji, line-height 1) satır kutusundan biraz büyüktür; görünür taşma sayılmaz.
        const vtol = Math.max(TOL, 0.3 * h(tb));
        if (bs.overflowX === 'visible' && bs.overflowY === 'visible' && !intentional) {
          const over = Math.max(tb.r - bb.right - TOL, bb.left - tb.l - TOL, tb.b - bb.bottom - vtol, bb.top - tb.t - vtol) + TOL;
          if (over > TOL) add({ kind: 'spill', where: pathOf(el), text: snippet(el), other: block === el ? undefined : label(block), px: over });
        }
        for (const c of chain) {
          const ox = Math.max(tb.r - c.box.r, c.box.l - tb.l);
          const oy = Math.max(tb.b - c.box.b, c.box.t - tb.t);
          if ((ox > TOL && c.hiddenX) || (oy > vtol && c.hiddenY)) {
            const kind: IssueKind = c.ellipsis && ox > TOL ? 'ellipsis' : 'clip';
            if (!intentional) add({ kind, where: pathOf(el), text: snippet(el), other: label(c.el), px: Math.max(ox, oy) });
            break;
          }
          if ((ox > TOL && c.scrollX) || (oy > vtol && c.scrollY)) break; // kaydırarak görülür
        }
        const tv = chain.reduce((acc, c) => inter(acc, c.box), tb);
        if (w(tv) > 0.5 && h(tv) > 0.5) texts.push({ el, box: tv, layer: layerOf(el) });
      }
    } else if (s.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + TOL && el.textContent?.trim()) {
      add({ kind: 'ellipsis', where: pathOf(el), text: snippet(el), px: el.scrollWidth - el.clientWidth });
    }

    if (shown && isPainted(el, s) && w(vis) * h(vis) < vw * vh * 0.6) boxes.push({ el, box: vis, layer: layerOf(el) });
  }

  // Çakışmalar (aynı katmanda; ata-torun ilişkisi olmayanlar).
  const skipPair = (a: Element, b: Element): boolean => !!a.closest(INTENTIONAL) || !!b.closest(INTENTIONAL);
  for (let i = 0; i < texts.length; i++) {
    const A = texts[i];
    for (let j = i + 1; j < texts.length; j++) {
      const B = texts[j];
      if (A.el === B.el || A.layer !== B.layer || skipPair(A.el, B.el)) continue;
      const x = inter(A.box, B.box);
      if (w(x) >= 2 && h(x) >= Math.max(3, 0.3 * Math.min(h(A.box), h(B.box)))) {
        add({ kind: 'text-text', where: pathOf(A.el), text: snippet(A.el), other: pathOf(B.el) + ' «' + snippet(B.el).slice(0, 24) + '»', px: Math.min(w(x), h(x)) });
      }
    }
    for (const B of boxes) {
      if (B.el === A.el || B.el.contains(A.el) || A.layer !== B.layer || skipPair(A.el, B.el)) continue;
      const x = inter(A.box, B.box);
      if (w(x) >= 2 && h(x) >= Math.max(3, 0.3 * h(A.box))) {
        add({ kind: 'text-box', where: pathOf(A.el), text: snippet(A.el), other: pathOf(B.el), px: Math.min(w(x), h(x)) });
      }
    }
  }
  for (let i = 0; i < boxes.length; i++) {
    const A = boxes[i];
    for (let j = i + 1; j < boxes.length; j++) {
      const B = boxes[j];
      if (A.layer !== B.layer || A.el.contains(B.el) || B.el.contains(A.el) || skipPair(A.el, B.el)) continue;
      const x = inter(A.box, B.box);
      if (w(x) >= 3 && h(x) >= 3) add({ kind: 'box-box', where: pathOf(A.el), text: snippet(A.el), other: pathOf(B.el), px: Math.min(w(x), h(x)) });
    }
  }
  return issues;
}

// ---------------------------------------------------------------------------
// Bütün ekranlar
// ---------------------------------------------------------------------------

export interface AuditApp {
  readonly sim: Sim | null;
  readonly game: { scene: { getScene(key: string): unknown }; step(time: number, delta: number): void } | null;
  startDebugGame(seed: number, starter: StarterKind): Sim;
  openPauseMenu(): void;
  closePauseMenu(): void;
}

const settle = (ms = 120): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Denetim için dolu bir test oyunu: çok köpek (uzun adlar), binalar, personel, yumurtalar, sahipleniciler, mektuplar, görevler. */
export function richGame(app: AuditApp): Sim {
  const sim = app.startDebugGame(1942, 'ready');
  let now = performance.now();
  for (let i = 0; i < 10 && (app.game?.scene.getScene('World') as { sim?: Sim } | undefined)?.sim !== sim; i++) {
    now += 16;
    app.game?.step(now, 16);
  }
  const rng = new Rng(hash3(1942, 0x1a70, 7));
  sim.money = 48250;
  const p = sim.world.plot;
  const place = (type: BuildingType): Building | null => {
    for (let dy = 2; dy < p.h - 3; dy++) {
      for (let dx = 2; dx < p.w - 3; dx++) {
        const b = sim.placeBuilding(type, p.x + dx, p.y + dy);
        if (b) return b;
      }
    }
    return null;
  };
  for (const type of ['nursery', 'vetClinic', 'kitchen', 'staffRoom', 'kennelLarge', 'groomStation', 'toyRope', 'staffToilet'] as BuildingType[]) place(type);
  const names = ['Minnoş Karabaşım', 'Pamuk Şekerleme', 'Mandalina', 'Kestane', 'Karabaş', 'Karamel', 'Boncuk', 'Fındık', 'Zeytin', 'Tarçın'];
  const c = sim.world.plot;
  for (let i = 0; i < names.length; i++) {
    const g = randomGenome(rng, i % 4 === 0 ? 'rare' : 'common');
    sim.addDog(g, i % 3 === 0 ? 'stray' : 'egg', i % 2 === 0 ? 30 : 6 + i, c.x + 6 + (i % 5) * 2, c.y + 12 + Math.floor(i / 5) * 2, names[i]);
  }
  const dogs = sim.shelterDogs();
  // Can dostları: ilk iki köpek.
  if (dogs.length >= 2) {
    dogs[0].friends[dogs[1].id] = 90;
    dogs[1].friends[dogs[0].id] = 90;
  }
  for (const d of dogs.slice(3, 6)) d.needs.health = 35;
  // Personel.
  sim.staffSystem.refreshCandidates();
  for (const cand of [...sim.candidates]) sim.staffSystem.hire(cand.id);
  sim.staffSystem.refreshCandidates();
  // Yumurtalar: çantada ve kuluçkada.
  for (const rarity of ['common', 'rare', 'legendary', 'uncommon'] as const) sim.backpack.push(createEgg(sim.nextId++, rng, rarity, sim.clock.day));
  const inc = sim.buildings.find((b) => b.type === 'incubator');
  if (inc && sim.backpack.length > 0) placeEgg(sim, inc, sim.backpack[0].id);
  const nursery = sim.buildings.find((b) => b.type === 'nursery');
  if (nursery && dogs.length >= 4) sim.command({ type: 'setNurseryPair', buildingId: nursery.id, dogIds: [dogs[2].id, dogs[3].id] });
  // Sahiplenmeler, mektuplar ve bekleyen sahipleniciler (10:00).
  sim.clock.totalMinutes = (sim.clock.day - 1) * 24 * 60 + 10 * 60;
  for (const d of dogs.slice(6, 8)) {
    d.needs.health = 100;
    d.needs.hygiene = 100;
    d.needs.loyalty = 100;
    const a = sim.adoption.spawnAdopter();
    if (!a) break;
    a.state = 'waiting';
    a.request = {};
    sim.command({ type: 'adopt', adopterId: a.id, dogId: d.id });
  }
  for (const r of sim.adoptions) r.letterDay = sim.clock.day;
  sim.mail.deliverDue();
  for (let i = 0; i < 3; i++) {
    const a = sim.adoption.spawnAdopter();
    if (a) a.state = 'waiting';
  }
  // Köy ve görev panosu.
  sim.villageFound = true;
  sim.quests.update();
  const q = sim.quests.list[0];
  if (q) sim.command({ type: 'questAccept', id: q.id });
  sim.alerts.refresh();
  return sim;
}

interface Step {
  name: string;
  enter: () => void;
  exit?: () => void;
}

/**
 * Zengin test oyununda bütün paneller ve HUD hâlleri; her birinde `layoutAudit`. Sonuç yalnız sorunlu ekranlar. `only` tek
 * adımla (tam ad) ya da `*` ile biten önekle sınırlar; `keep` son ekranı açık bırakır (ekran görüntüsü için).
 */
export async function auditScreens(app: AuditApp, only?: string, keep = false): Promise<{ viewport: string; screens: ScreenReport[]; checked: number }> {
  const sim = richGame(app);
  const bid = (type: BuildingType): number | null => sim.buildings.find((b) => b.type === type)?.id ?? null;
  const reset = (): void => {
    store.panel.value = 'none';
    store.navMenu.value = null;
    store.buildBar.value = false;
    store.build.value = { kind: 'none' };
    store.toolMenu.value = false;
    store.report.value = null;
    store.settingsOpen.value = false;
    if (store.pauseMenu.value) app.closePauseMenu();
  };
  const panel = (p: Panel, ctx?: () => void): Step => ({
    name: 'panel:' + p,
    enter: () => {
      ctx?.();
      store.panel.value = p;
    },
  });
  const longDog = sim.shelterDogs().find((d) => d.name.length >= 15) ?? sim.shelterDogs()[0];
  const steps: Step[] = [
    { name: 'hud:avatar', enter: () => sim.setMode('avatar') },
    {
      name: 'hud:avatar-dog',
      enter: () => {
        sim.setMode('avatar');
        sim.player.x = longDog.x + 0.8;
        sim.player.y = longDog.y;
      },
    },
    {
      name: 'hud:toasts',
      enter: () => {
        showToast('📬 Yasemin Gündoğdu ailesinden mektup: Minnoş Karabaşım ve Pamuk Şekerleme için yazmış', 5000);
        showToast('⌛ Görev süresi doldu: Minnoş Karabaşım kendi yolunu bulup eve döndü.', 5000);
      },
    },
    { name: 'hud:tool-popover', enter: () => (store.toolMenu.value = true) },
    ...MENU_GROUPS.filter((g) => g.items.length > 1).map((g) => ({ name: 'nav:' + g.id, enter: () => (store.navMenu.value = g.id) })),
    { name: 'hud:manage', enter: () => sim.setMode('manage') },
    ...[...BUILD_ORDER, 'bolge', 'arsa'].map((tab) => ({
      name: 'build:' + tab,
      enter: () => {
        sim.setMode('manage');
        store.buildBar.value = true;
        store.buildTab.value = tab;
      },
    })),
    {
      name: 'build:tool-hint',
      enter: () => {
        sim.setMode('manage');
        store.buildBar.value = true;
        store.buildTab.value = 'barinma';
        store.build.value = { kind: 'building', type: 'kennelLarge' };
      },
    },
    {
      name: 'panel:dog',
      enter: () => {
        sim.setMode('avatar');
        store.selectedDogId.value = longDog.id;
        store.panel.value = 'dog';
      },
    },
    panel('dogs'),
    panel('shed', () => (store.panelBuildingId.value = bid('shed'))),
    panel('kennel', () => (store.panelBuildingId.value = bid('kennelSmall'))),
    panel('incubator', () => (store.panelBuildingId.value = bid('incubator'))),
    panel('nursery', () => (store.panelBuildingId.value = bid('nursery'))),
    panel('egg', () => (store.panelEggId.value = sim.backpack[0]?.id ?? null)),
    panel('office'),
    panel('adoption'),
    panel('finance'),
    panel('staff'),
    panel('deployment'),
    panel('achievements'),
    panel('help'),
    panel('alerts'),
    panel('backpack'),
    panel('map'),
    panel('computer'),
    panel('furniture', () => (store.panelBuildingId.value = bid('staffRoom'))),
    panel('autoOrder'),
    panel('clinic'),
    panel('wholesale'),
    panel('goals'),
    panel('morning', () => (store.morningReport.value = buildMorningReport(sim, 'morning'))),
    panel('toyShop'),
    panel('market'),
    panel('travel'),
    panel('quests'),
    panel('mail'),
    panel('album'),
    { name: 'modal:week-report', enter: () => (store.report.value = closeWeek(sim, sim.clock.week + 1)) },
    { name: 'modal:pause', enter: () => app.openPauseMenu() },
    { name: 'modal:settings', enter: () => (store.settingsOpen.value = true) },
    { name: 'modal:game-over', enter: () => (store.gameOver.value = { reason: 'bankrupt', week: 3 }), exit: () => (store.gameOver.value = null) },
    {
      name: 'modal:victory',
      enter: () => {
        store.victorySeen.value = false;
        store.victory.value = { day: 42, week: 6 };
      },
      exit: () => (store.victory.value = null),
    },
    { name: 'screen:menu', enter: () => (store.screen.value = 'menu'), exit: () => (store.screen.value = 'game') },
  ];
  const screens: ScreenReport[] = [];
  let checked = 0;
  const run = async (name: string): Promise<void> => {
    checked++;
    const issues = layoutAudit();
    if (issues.length > 0) screens.push({ screen: name, issues });
  };
  for (const step of steps) {
    if (only && (only.endsWith('*') ? !step.name.startsWith(only.slice(0, -1)) : step.name !== only)) continue;
    reset();
    await settle(40);
    step.enter();
    syncStore(sim);
    await settle();
    await run(step.name);
    // Paneldeki sekmeler ve süzgeçler: her birine basılıp yeniden denetlenir.
    const tabs = [...document.querySelectorAll<HTMLButtonElement>('.overlay .panel-head .build-tabs > .btn, .overlay .album-filters > .btn')];
    for (const tab of tabs) {
      if (tab.classList.contains('active')) continue;
      tab.click();
      syncStore(sim);
      await settle();
      await run(step.name + '#' + (tab.textContent ?? '').trim());
    }
    if (!keep) step.exit?.();
  }
  if (!keep) reset();
  return { viewport: `${window.innerWidth}×${window.innerHeight} ${store.layout.value}${store.touch.value ? ' touch' : ''}`, screens, checked };
}

/** Bütün sorunları tür ve yere göre özetler (aynı sorun birçok ekranda görünür). */
export function summarizeAudit(screens: readonly ScreenReport[]): Array<{ kind: IssueKind; where: string; text: string; other?: string; px: number; screens: string[] }> {
  const map = new Map<string, { kind: IssueKind; where: string; text: string; other?: string; px: number; screens: string[] }>();
  for (const s of screens) {
    for (const i of s.issues) {
      const key = `${i.kind}|${i.where}|${i.other ?? ''}`;
      const e = map.get(key);
      if (e) {
        e.px = Math.max(e.px, i.px);
        if (!e.screens.includes(s.screen)) e.screens.push(s.screen);
      } else map.set(key, { ...i, screens: [s.screen] });
    }
  }
  return [...map.values()].sort((a, b) => a.kind.localeCompare(b.kind) || b.px - a.px);
}

