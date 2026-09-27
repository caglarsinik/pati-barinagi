import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { app } from '../../app';
import { GAME } from '../../config/game';
import { t } from '../../i18n';
import { DPR } from '../../render/dpr';
import { type HumanStyle, drawHuman } from '../../render/HumanPainter';
import { hex, shade } from '../../render/Pixels';
import { P } from '../../render/palette';
import { store } from '../store';
import { displayPlayerName } from '../../sim/entities/PlayerLook';
import { type TutorialStep, type TutorialView, stepText } from './steps';

/** Belediyeden Nermin Hanım: kızıl saç, lacivert ceket. */
const NERMIN_BLUE = hex(0x2e63ad);
const NERMIN: HumanStyle = { skin: hex(0xf1c9a1), hair: hex(0x8a3a2a), shirt: NERMIN_BLUE, shirtDark: shade(NERMIN_BLUE, 0.75), pants: hex(0x3b4664), shoes: P.shoes, hat: null };

interface Rect {
  l: number;
  t: number;
  r: number;
  b: number;
}

interface CameraLike {
  zoom: number;
  worldView: { x: number; y: number };
}

/** İnsan çiziminin üst yarısı (baş ve omuzlar), büyütülmüş. */
function CoachPortrait() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    const px = drawHuman(0, 0, NERMIN);
    const img = ctx.createImageData(px.w, px.h);
    img.data.set(px.data);
    ctx.putImageData(img, 0, 0);
  }, []);
  return <canvas ref={ref} width={16} height={16} class="coach-portrait" aria-hidden="true" />;
}

/** Adımın arayüz çapası ekranda (CSS pikseli). */
function uiRect(step: TutorialStep, view: TutorialView): Rect | null {
  const sel = step.anchor?.(view);
  const r = sel ? document.querySelector(sel)?.getBoundingClientRect() : undefined;
  return r && r.width > 0 && r.height > 0 ? { l: r.left, t: r.top, r: r.right, b: r.bottom } : null;
}

/** Dünyadaki dikdörtgen (kare biriminde) ekranda: kameranın o anki görüşüyle (ekran dışında da olabilir). */
function project(box: { x: number; y: number; w: number; h: number } | null): Rect | null {
  const cam = (app.game?.scene.getScene('World') as { cameras?: { main?: CameraLike } } | undefined)?.cameras?.main;
  if (!box || !cam) return null;
  const k = cam.zoom / DPR;
  const T = GAME.tile;
  const l = (box.x * T - cam.worldView.x) * k;
  const top = (box.y * T - cam.worldView.y) * k;
  return { l, t: top, r: l + box.w * T * k, b: top + box.h * T * k };
}

/** Adımın dünyadaki çapası ekranda. */
function worldRect(step: TutorialStep): Rect | null {
  const sim = app.sim;
  if (!step.world || !sim || sim.interior) return null;
  return project(step.world(sim));
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
const overlaps = (a: Rect, b: Rect): boolean => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;

/** Oynanan alan: üst şeridin altı ile alt rıhtımın üstü arası. */
function playArea(vh: number): { top: number; bottom: number } {
  const top = (document.querySelector('.topbar')?.getBoundingClientRect().bottom ?? 44) + 8;
  const dock = document.querySelector('.hud-dock')?.getBoundingClientRect().top ?? vh;
  return { top, bottom: Math.max(top + 40, dock - 8) };
}

/**
 * Açılış tanıtımının koç katmanı (0.22.5): panelin üstünde, bildirimin altında (z 150). Katman tıklamayı geçirir; yalnız
 * konuşma balonu tıklanır. Çapanın çevresinde yanıp sönen halka gerçek düğmeyi gösterir (düğme tıklanabilir kalır), balon
 * çapanın altında ya da üstünde. Panel, duraklatma, ayarlar ya da rapor açıkken gizlenir (tanıtım sürer).
 */
export function Coach() {
  // Balonun ölçülen yüksekliği: yer hesabı bununla yapılır, değişince bir kez yeniden çizilir (üst şeride taşmasın).
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [bh, setBh] = useState(110);
  useLayoutEffect(() => {
    const h = bubbleRef.current?.getBoundingClientRect().height;
    if (h && Math.abs(h - bh) > 1) setBh(Math.round(h));
  });
  store.tick.value;
  store.lang.value;
  const st = store.tutorial.value;
  const step = app.tutorial.step;
  if (!st || !step || store.screen.value !== 'game') return null;
  if (store.panel.value !== 'none' || store.pauseMenu.value || store.settingsOpen.value || store.report.value || store.gameOver.value) return null;
  if (store.victory.value && !store.victorySeen.value) return null;
  const touch = store.touch.value;
  const b = store.build.value;
  const view: TutorialView = { mode: store.mode.value, buildBar: store.buildBar.value, panel: store.panel.value, buildType: b.kind === 'building' ? b.type : null, touch };
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const area = playArea(vh);
  // Telefon yatay ve kısa: balon geniş ve alçak; yine de ekranın yarısından dar (köşede ortadaki oyuncuyu örtmez).
  const phone = store.layout.value === 'phone';
  const bw = Math.max(200, Math.min(phone ? 360 : 300, vw / 2 - 30));
  const ui = uiRect(step, view);
  const world = ui ? null : worldRect(step);
  const onScreen = (r: Rect): boolean => r.r > 0 && r.l < vw && r.b > area.top && r.t < area.bottom;
  const rect = ui ?? (world && onScreen(world) ? world : null);
  // Balonun üst kenarı: oynanan alanda kalır (üst şeridi ve ekran altını aşmaz; sığmazsa rıhtımın üstüne biner).
  const fit = (y: number): number => clamp(y, area.top, Math.max(area.top, vh - bh - 4));
  // Köşe yeri: telefonda sağda (ortadaki oyuncuyu örtmesin), büyük ekranda ortada.
  const cornerLeft = phone ? vw - bw - 12 : (vw - bw) / 2;
  // Avatar modunda kamera oyuncuyu izler: balon oyuncuyu ve yanındaki köpeği örtmesin.
  const sim = app.sim;
  const player = view.mode === 'avatar' && sim && !sim.interior ? project({ x: sim.player.x - 0.6, y: sim.player.y - 1.6, w: 1.2, h: 1.8 }) : null;
  let left: number;
  let top: number;
  let ring: Record<string, string> | null = null;
  let pointer: { left: number; top: number; angle: number } | null = null;
  if (rect) {
    const pad = 4;
    const l = clamp(rect.l - pad, 2, vw - 2);
    const rt = clamp(rect.t - pad, 2, vh - 2);
    const r = clamp(rect.r + pad, 2, vw - 2);
    const rb = clamp(rect.b + pad, 2, vh - 2);
    ring = { left: `${l}px`, top: `${rt}px`, width: `${Math.max(0, r - l)}px`, height: `${Math.max(0, rb - rt)}px` };
    const ringBox: Rect = { l, t: rt, r, b: rb };
    const cx = (rect.l + rect.r) / 2;
    const cy = (rect.t + rect.b) / 2;
    const near = clamp(cx - bw / 2, 12, vw - bw - 12);
    // Aday yerler sırayla: alt rıhtımdaki çapada (E, alt menü, inşa çubuğu) rıhtımın üstü; öbürlerinde çapanın altı ya da
    // üstü, sonra karşı yanı, sonra köşeler. Halkayı ve oyuncuyu örtmeyen ilk aday; yoksa halkayı örtmeyen ilk aday.
    const inDock = rect.t >= area.bottom - 4;
    const cands: Array<[number, number]> = inDock
      ? [[near, area.bottom - bh - 2]]
      : cy < vh / 2
        ? [
            [near, rb + 10],
            [near, rt - 10 - bh],
          ]
        : [
            [near, rt - 10 - bh],
            [near, rb + 10],
          ];
    cands.push([cornerLeft, area.top + 4], [12, area.top + 4], [cornerLeft, area.bottom - bh - 4], [12, area.bottom - bh - 4]);
    // Puan: halkayı örtmek olmaz, oyuncuyu örtmek çok kötü, alt rıhtıma (düğmelere) binen alan kötü; eşitse sıra.
    const dockBox: Rect = { l: 0, t: area.bottom + 8, r: vw, b: vh };
    const shared = (a: Rect, c: Rect): number => Math.max(0, Math.min(a.r, c.r) - Math.max(a.l, c.l)) * Math.max(0, Math.min(a.b, c.b) - Math.max(a.t, c.t));
    let best = Infinity;
    left = near;
    top = fit(cands[0][1]);
    cands.forEach(([x, y], i) => {
      const t = fit(y);
      const c: Rect = { l: x, t, r: x + bw, b: t + bh };
      const score = (overlaps(c, ringBox) ? 1e7 : 0) + (player && overlaps(c, player) ? 1e5 : 0) + shared(c, dockBox) / 100 + i;
      if (score < best) {
        best = score;
        left = x;
        top = t;
      }
    });
  } else {
    // Çapasız: köşede. Dünyadaki çapa ekran dışındaysa kenarda yönünü gösteren ok; balon okun karşı yarısına geçer.
    left = cornerLeft;
    top = fit(area.top + 4);
    if (world) {
      const cx = vw / 2;
      const cy = (area.top + area.bottom) / 2;
      const dx = (world.l + world.r) / 2 - cx;
      const dy = (world.t + world.b) / 2 - cy;
      const m = 26;
      const kx = dx === 0 ? Infinity : ((dx > 0 ? vw - m : m) - cx) / dx;
      const ky = dy === 0 ? Infinity : ((dy > 0 ? area.bottom - m : area.top + m) - cy) / dy;
      const k = Math.min(kx, ky);
      pointer = { left: cx + dx * k, top: cy + dy * k, angle: (Math.atan2(dy, dx) * 180) / Math.PI };
      if (pointer.top < cy) top = fit(area.bottom - bh - 4);
    }
  }
  const first = st.index === 0;
  return (
    <div class="coach">
      {ring && <div class="coach-ring" style={ring} />}
      {pointer && (
        <div class="coach-pointer" style={{ left: `${pointer.left - 17}px`, top: `${pointer.top - 17}px` }}>
          <span style={{ transform: `rotate(${pointer.angle}deg)` }} />
        </div>
      )}
      <div class="coach-bubble panel" ref={bubbleRef} style={{ left: `${left}px`, top: `${top}px`, width: `${bw}px` }}>
        <CoachPortrait />
        <div class="coach-body">
          <div class="coach-name">{t('Nermin Hanım · belediye')}</div>
          <div class="coach-text">{t(stepText(step, touch), { name: displayPlayerName(app.sim?.player.name ?? '') })}</div>
          <div class="coach-actions">
            {step.info ? (
              <button class="btn small primary" onClick={() => app.tutorial.next()}>
                {t(step.info)}
              </button>
            ) : (
              <button class="btn small" onClick={() => app.tutorial.next()}>
                {t('Atla')}
              </button>
            )}
            {step.cta && (
              <button class="btn small primary" onClick={() => (store.panel.value = step.cta!.panel)}>
                {t(step.cta.label)}
              </button>
            )}
            <button class="btn small" onClick={() => app.tutorial.close()}>
              {first ? t('Tanıtımı atla') : t('Tanıtımı kapat')}
            </button>
            <span class="coach-step muted">
              {st.index + 1}/{st.total}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
