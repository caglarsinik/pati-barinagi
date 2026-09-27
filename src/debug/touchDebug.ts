/**
 * Uçtan uca dokunma test kancası (yalnız `?debug=1`): `window.__pati.debug`. Dokunuşları WorldScene'in gerçek giriş
 * kapısından (`pointerInput` → TouchGestures → handleGesture) geçirir; yalnız Phaser'ın DOM → Pointer çevirisi atlanır.
 * `runTouchScenarios()` telefonda yaşanan takılma sıralarını tek komutla koşar. Normal oyunda hiç bağlanmaz.
 */
import { BALANCE } from '../config/balance';
import { GAME } from '../config/game';
import type { GesturePointer } from '../scenes/TouchGestures';
import type { WorldScene } from '../scenes/WorldScene';
import { BUILDING_DEFS, type BuildingType } from '../content/buildings';
import type { Sim, StarterKind } from '../sim/Sim';
import { goalShowTool } from '../sim/systems/Goals';
import type { Dog } from '../sim/entities/Dog';
import { type Rotation, buildingDoorTile, buildingSize, canPlaceBuilding, isReady, kennelRestTile } from '../sim/entities/Building';
import type { TilePos } from '../sim/world/TileWorld';
import { Obj } from '../sim/world/tiles';
import { rotateBuildTool, store, syncStore } from '../ui/store';
import { DOG_FRAMES, DOG_FRAME_LIE } from '../render/DogPainter';
import { resolveAction } from '../sim/systems/Interaction';
import { interiorItemAt } from '../sim/interior/Interiors';
import { signposts } from '../sim/world/Signposts';
import { questBoardTile } from '../sim/world/Village';
import { ruinDoorTile } from '../sim/world/Ruin';
import { albumEntries } from '../sim/systems/Stories';
import { type AuditApp, auditScreens, layoutAudit, summarizeAudit } from './layoutAudit';

export interface ScenarioResult {
  name: string;
  ok: boolean;
  detail: string;
}

export interface DebugApp {
  readonly sim: Sim | null;
  readonly game: {
    scene: { getScene(key: string): unknown };
    events: { emit(event: string): unknown };
    canvas: HTMLCanvasElement;
    step(time: number, delta: number): void;
  } | null;
  /** Kayda dokunmayan test oyunu başlatır (0.19.3). */
  startDebugGame(seed: number, starter: StarterKind): Sim;
  /** Hedef "Göster" ile aynı yol: yönetim modu, inşa çubuğu, araç. */
  showBuild(target: BuildingType | 'plot'): void;
  /** Açılış tanıtımı (0.22.5; senaryo 19 test oyununda zorla başlatır). */
  readonly tutorial: { start(sim: Sim, starter: StarterKind): void; readonly active: boolean; readonly step: { id: string } | null };
}

/**
 * Senaryoların sabit tohumları (0.19.3): 1–12 hazır barınakta, 13 kuruluşta; 14–15 taze hazır oyunda köy (0.20.5), 16 sahiplendirme
 * hikâyesi (0.21.5); 17–18 taze hazır oyunda Taşı ve kulübe içi, 19 taze kuruluşta açılış tanıtımı (0.22.6); 20 taze hazır oyunda
 * orman: odun, taş, terk edilmiş ev, malzemeyle kulübe, otopilot (0.23.4).
 */
const SCENARIO_SEED_READY = 1942;
const SCENARIO_SEED_GUIDED = 1913;

export function debugEnabled(search: string): boolean {
  return new URLSearchParams(search).get('debug') === '1';
}

export function summarize(results: readonly ScenarioResult[]): string {
  const ok = results.filter((r) => r.ok).length;
  const bad = results.filter((r) => !r.ok).map((r) => r.name);
  return `${ok}/${results.length} ok` + (bad.length > 0 ? ` · başarısız: ${bad.join(', ')}` : '');
}

/** Oyuncudan en az `dist` kare uzakta, yürünebilir, boş ve köpeklerden uzak bir kare (sağ, sol, alt, üst). */
export function freeTileNear(sim: Sim, dist: number): TilePos | null {
  const w = sim.world;
  const p = sim.player;
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (let d = dist; d <= dist + 6; d++) {
    for (const [dx, dy] of dirs) {
      const x = p.tileX + dx * d;
      const y = p.tileY + dy * d;
      if (!w.inBounds(x, y) || w.isSolid(x, y) || w.buildingIdAt(x, y) !== -1 || w.objectAt(x, y) !== Obj.None) continue;
      if (sim.dogs.some((g) => Math.hypot(g.x - (x + 0.5), g.y - (y + 0.5)) < 2)) continue;
      return { x, y };
    }
  }
  return null;
}

export function createTouchDebug(app: DebugApp & AuditApp) {
  const need = (): { sim: Sim; scene: WorldScene } => {
    const sim = app.sim;
    const scene = app.game?.scene.getScene('World') as WorldScene | undefined;
    if (!sim || !scene) throw new Error('oyun başlamadı');
    return { sim, scene };
  };

  /** Kayda dokunmayan yeni test oyunu; sahne yeni sim'le kurulana kadar kareler elle ilerletilir (gizli bölmede RAF yavaş). */
  const freshGame = (starter: StarterKind, seed: number): Sim => {
    const sim = app.startDebugGame(seed, starter);
    const ready = (): boolean => (app.game?.scene.getScene('World') as { sim?: Sim } | undefined)?.sim === sim;
    let now = performance.now();
    for (let i = 0; i < 10 && !ready(); i++) {
      now += 16;
      app.game?.step(now, 16);
    }
    if (!ready()) throw new Error('sahne yeni oyunla kurulmadı');
    return sim;
  };

  /** Dünya karesi → tuval koordinatı (kameranın ters dönüşümü). */
  const screenOf = (scene: WorldScene, wx: number, wy: number): { x: number; y: number } => {
    const cam = scene.cameras.main;
    const T = GAME.tile;
    const o = cam.getWorldPoint(0, 0);
    const u = cam.getWorldPoint(100, 0);
    const v = cam.getWorldPoint(0, 100);
    return { x: (wx * T - o.x) / ((u.x - o.x) / 100), y: (wy * T - o.y) / ((v.y - o.y) / 100) };
  };

  const ptr = (id: number, wx: number, wy: number, isDown: boolean, extra: Partial<GesturePointer> = {}): GesturePointer => {
    const { sim, scene } = need();
    const s = screenOf(scene, wx, wy);
    return { id, x: s.x, y: s.y, wx, wy, button: 0, touch: true, ui: false, isDown, now: scene.time.now, longPress: sim.mode === 'avatar', ...extra };
  };

  const api = {
    /** Arayüz yerleşim denetimi (0.21.6): o anki ekran ya da bütün paneller; özet aynı sorunu tek satırda toplar. */
    layoutAudit,
    auditScreens: (only?: string, keep?: boolean) => auditScreens(app, only, keep),
    summarizeAudit,
    /** Kısa dokunuş (dünya karesi, ondalıklı). */
    tapTile(wx: number, wy: number, id = 1): void {
      const { scene } = need();
      scene.pointerInput('down', ptr(id, wx, wy, true));
      scene.pointerInput('up', ptr(id, wx, wy, false));
    },
    /** Uzun basış: basış uzun basış süresi kadar geriye tarihlenir, jest saati bir kez işlenir, sonra bırakılır. */
    longPressTile(wx: number, wy: number, id = 1): void {
      const { scene } = need();
      scene.pointerInput('down', ptr(id, wx, wy, true, { now: scene.time.now - BALANCE.touch.longPressMs - 50 }));
      scene.gestureTick();
      scene.pointerInput('up', ptr(id, wx, wy, false));
    },
    /** Tek parmakla sürükle-bırak (0.22.2; yönetim modunda inşa araçları, Taşı): basar, dört adımda taşır, bırakır. */
    dragTile(fx: number, fy: number, tx: number, ty: number, id = 1): void {
      const { scene } = need();
      scene.pointerInput('down', ptr(id, fx, fy, true));
      for (let i = 1; i <= 4; i++) scene.pointerInput('move', ptr(id, fx + ((tx - fx) * i) / 4, fy + ((ty - fy) * i) / 4, true));
      scene.pointerInput('up', ptr(id, tx, ty, false));
    },
    /** İki parmak basar (bırakmaz). */
    startPinch(): void {
      const { sim, scene } = need();
      const p = sim.player;
      scene.pointerInput('down', ptr(1, p.x - 1.5, p.y, true));
      scene.pointerInput('down', ptr(2, p.x + 1.5, p.y, true));
    },
    /** Tam pinch: bas, açıp kapat, bırak. */
    pinch(scale: number): void {
      const { sim, scene } = need();
      const p = sim.player;
      api.startPinch();
      scene.pointerInput('move', ptr(2, p.x - 1.5 + 3 * scale, p.y, true));
      scene.pointerInput('up', ptr(2, p.x - 1.5 + 3 * scale, p.y, false));
      scene.pointerInput('up', ptr(1, p.x - 1.5, p.y, false));
    },
    /** Dokunma iptali (touchcancel / odak kaybı ile aynı yol). */
    cancelTouches(): void {
      need().scene.resetTouches();
    },
    /** Bırakma olayı kaçmış, sessiz (bayat) bir parmak bırakır. */
    stuckPointer(id = 1): void {
      const { sim, scene } = need();
      scene.pointerInput('down', ptr(id, sim.player.x - 2, sim.player.y, true, { now: scene.time.now - BALANCE.touch.stalePointerMs - 2000 }));
    },
    snapshot(): Record<string, unknown> {
      const { sim, scene } = need();
      return {
        version: GAME.version,
        mode: sim.mode,
        autopilot: sim.autopilot,
        busy: +sim.player.busy.toFixed(2),
        nav: { active: sim.nav.active, goal: sim.nav.goal, pathLen: sim.nav.path.length },
        pinching: scene.touchPinching,
        panel: store.panel.value,
        activeElement: document.activeElement?.tagName ?? null,
      };
    },
    /** Bütün senaryolar; 19 arayüzün çizilmesini beklediği için sonuç bir söz (await). */
    async runTouchScenarios(): Promise<{ summary: string; results: ScenarioResult[] }> {
      // 0.19.3: senaryolar kendi dünyalarını kurar (sabit tohum, kayda dokunmaz): 1–12 hazır barınakta, 13 kuruluşta, 14–15 köyde.
      const sim = freshGame('ready', SCENARIO_SEED_READY);
      const results: ScenarioResult[] = [];
      const run = (frames: number, until?: () => boolean): void => {
        for (let i = 0; i < frames && !(until && until()); i++) sim.update(1 / 30);
      };
      const bodyOf = (d: Dog): { x: number; y: number } => ({ x: d.x, y: d.y - 0.2 });
      /** Her senaryo öncesi: dokunuşlar bırakılır, avatar modu, otopilot kapalı, köpek oyuncunun 3 kare yanında oturur. */
      const prepare = (): { dog: Dog; walk: TilePos } => {
        api.cancelTouches();
        sim.exitInterior();
        sim.setAutopilot(false);
        sim.setMode('avatar');
        sim.nav.cancel();
        sim.player.busy = 0;
        store.panel.value = 'none';
        store.selectedDogId.value = null;
        sim.command({ type: 'setTool', tool: 'pet' });
        const dog = sim.shelterDogs()[0];
        const spot = freeTileNear(sim, 3);
        if (!dog || !spot) throw new Error('köpek ya da boş kare yok');
        dog.x = spot.x + 0.5;
        dog.y = spot.y + 0.7;
        dog.state = 'sit';
        dog.stateTimer = 9999;
        dog.needs.energy = 100;
        const walk = freeTileNear(sim, 5);
        if (!walk) throw new Error('yürünecek kare yok');
        return { dog, walk };
      };
      const scenario = (name: string, body: () => [boolean, string]): void => {
        try {
          const [ok, detail] = body();
          results.push({ name, ok, detail });
        } catch (e) {
          results.push({ name, ok: false, detail: String(e) });
        }
      };
      const goalKind = (): string => sim.nav.goal?.kind ?? 'yok';

      scenario('1 eğit → uzağa dokun → yürür', () => {
        const { dog, walk } = prepare();
        sim.command({ type: 'setTool', tool: 'train' });
        dog.skills.potty = 0;
        const t0 = sim.stats.trained;
        api.tapTile(bodyOf(dog).x, bodyOf(dog).y);
        run(400, () => sim.stats.trained > t0 && !sim.nav.active);
        const trained = sim.stats.trained > t0;
        api.tapTile(walk.x + 0.5, walk.y + 0.5);
        const kind = goalKind();
        const x0 = sim.player.x;
        const y0 = sim.player.y;
        run(120);
        const moved = Math.hypot(sim.player.x - x0, sim.player.y - y0);
        return [trained && kind === 'tile' && moved > 0.5, `eğitildi=${trained} hedef=${kind} yürüdü=${moved.toFixed(1)} kare`];
      });

      scenario('2 E düğmesine iki kez → hayalet yol yok', () => {
        const { scene } = need();
        prepare();
        const btn = document.querySelector<HTMLButtonElement>('#ui .action-btn');
        const canvas = app.game!.canvas;
        let wx = sim.player.x + 4;
        let wy = sim.player.y + 3;
        if (btn) {
          const b = btn.getBoundingClientRect();
          const c = canvas.getBoundingClientRect();
          const gx = ((b.left + b.width / 2 - c.left) * canvas.width) / c.width;
          const gy = ((b.top + b.height / 2 - c.top) * canvas.height) / c.height;
          const w = scene.cameras.main.getWorldPoint(gx, gy);
          wx = w.x / GAME.tile;
          wy = w.y / GAME.tile;
        }
        for (let i = 0; i < 2; i++) {
          scene.pointerInput('down', ptr(1, wx, wy, true, { ui: true }));
          scene.pointerInput('up', ptr(1, wx, wy, false, { ui: true }));
          if (btn) btn.click();
          else app.game!.events.emit('ui:interact');
        }
        return [!sim.nav.active, `düğme=${btn ? 'var' : 'yok'} yol=${sim.nav.active ? goalKind() : 'yok'}`];
      });

      scenario('3 pinch + dokunma iptali → dokunuş yürütür', () => {
        const { scene } = need();
        const { walk } = prepare();
        api.startPinch();
        const pinched = scene.touchPinching;
        api.cancelTouches();
        api.tapTile(walk.x + 0.5, walk.y + 0.5);
        return [pinched && !scene.touchPinching && goalKind() === 'tile', `pinch=${pinched} sonra=${scene.touchPinching} hedef=${goalKind()}`];
      });

      scenario('4 takılı parmak → yeni dokunuş pinch değil, yürür', () => {
        const { scene } = need();
        const { walk } = prepare();
        api.stuckPointer(1);
        api.tapTile(walk.x + 0.5, walk.y + 0.5, 2);
        return [!scene.touchPinching && goalKind() === 'tile', `pinch=${scene.touchPinching} hedef=${goalKind()}`];
      });

      scenario('5 yönetim modu: boş kare yürümez, köpek seçilir', () => {
        const { dog, walk } = prepare();
        sim.setMode('manage');
        api.tapTile(walk.x + 0.5, walk.y + 0.5);
        const walked = sim.nav.active;
        api.tapTile(bodyOf(dog).x, bodyOf(dog).y);
        const selected = store.panel.value === 'dog' && store.selectedDogId.value === dog.id;
        sim.setMode('avatar');
        return [!walked && selected, `yürüdü=${walked} seçildi=${selected}`];
      });

      scenario('6 uzun basış köpeği seçer, yürümez', () => {
        const { dog } = prepare();
        api.longPressTile(bodyOf(dog).x, bodyOf(dog).y);
        const selected = store.panel.value === 'dog' && store.selectedDogId.value === dog.id;
        return [selected && !sim.nav.active, `seçildi=${selected} yol=${sim.nav.active ? goalKind() : 'yok'}`];
      });

      scenario('7 köpeğin dibinde: çevre yürür, üstü sever, meşgulken mesaj', () => {
        const { dog } = prepare();
        const msgs: string[] = [];
        const off = sim.events.on('message', (m) => msgs.push(m));
        try {
          const p0 = sim.stats.petted;
          api.tapTile(bodyOf(dog).x, bodyOf(dog).y);
          run(400, () => sim.stats.petted > p0 && !sim.nav.active);
          const reached = sim.stats.petted > p0;
          sim.player.busy = 0;
          // Köpeğin öbür yanına (0,9 kare) dokun: yürüyüş, iş yinelenmez.
          const dx = dog.x - sim.player.x;
          const dy = dog.y - sim.player.y;
          const len = Math.max(0.01, Math.hypot(dx, dy));
          const p1 = sim.stats.petted;
          api.tapTile(bodyOf(dog).x + (dx / len) * 0.9, bodyOf(dog).y + (dy / len) * 0.9);
          const sideOk = sim.nav.goal?.kind !== 'dog' && sim.stats.petted === p1;
          sim.nav.cancel();
          // Meşgulken üstüne dokun: mesaj, iş yok.
          sim.player.setBusy(2, 'pet');
          api.tapTile(bodyOf(dog).x, bodyOf(dog).y);
          const busyOk = msgs.some((m) => m.includes('meşgul')) && sim.stats.petted === p1;
          sim.nav.cancel();
          // Boştayken üstüne dokun: sever.
          sim.player.busy = 0;
          api.tapTile(bodyOf(dog).x, bodyOf(dog).y);
          run(90, () => sim.stats.petted > p1);
          const directOk = sim.stats.petted > p1;
          return [reached && sideOk && busyOk && directOk, `vardı=${reached} çevre=${sideOk} meşgul=${busyOk} üstü=${directOk}`];
        } finally {
          off();
        }
      });

      scenario('8 otopilot açıkken dokunuş → kapanır ve yürür', () => {
        const { walk } = prepare();
        sim.setAutopilot(true);
        api.tapTile(walk.x + 0.5, walk.y + 0.5);
        return [!sim.autopilot && goalKind() === 'tile', `otopilot=${sim.autopilot} hedef=${goalKind()}`];
      });

      scenario('9 ofise dokun → içeri gir, içeride dokun-yürü, kapıya dokun → dışarı', () => {
        prepare();
        const office = sim.buildings.find((b) => b.type === 'office' && isReady(b));
        if (!office) throw new Error('ofis yok');
        const door = buildingDoorTile(office);
        sim.player.x = door.x + 0.5;
        sim.player.y = door.y + 0.9;
        api.tapTile(office.x + 1.5, office.y + 1.5);
        run(300, () => sim.interior !== null);
        const it = sim.interior;
        if (!it) return [false, 'girilmedi'];
        const target = { x: it.door.x + 1, y: it.door.y - 2 };
        api.tapTile(target.x + 0.5, target.y + 0.5);
        run(300, () => !sim.nav.active);
        const walked = sim.player.tileX === target.x && sim.player.tileY === target.y;
        api.tapTile(it.door.x + 0.5, it.door.y + 0.5);
        run(300, () => sim.interior === null);
        const out = sim.interior === null && sim.player.tileX === door.x && sim.player.tileY === door.y;
        return [walked && out, `girdi=true yürüdü=${walked} çıktı=${out}`];
      });

      scenario('10 içerideyken yönetim moduna geç → dışarıda, kamera haritada', () => {
        prepare();
        const office = sim.buildings.find((b) => b.type === 'office' && isReady(b));
        if (!office || !sim.enterBuilding(office.id).ok) return [false, 'girilmedi'];
        sim.toggleMode();
        const out = sim.interior === null && sim.mode === 'manage';
        const bounds = need().scene.cameras.main.getBounds();
        const camOk = bounds.x === 0 && bounds.width === sim.world.width * GAME.tile;
        sim.setMode('avatar');
        return [out && camOk, `dışarı=${out} kamera=${camOk}`];
      });

      /** Kilerin kapı önüne koyar (dokun-git kısa kalsın). */
      const atShed = () => {
        const shed = sim.buildings.find((b) => b.type === 'shed' && isReady(b));
        if (!shed) throw new Error('kiler yok');
        const door = buildingDoorTile(shed);
        sim.player.x = door.x + 0.5;
        sim.player.y = door.y + 0.9;
        return { shed, door };
      };

      scenario('11 kilerin kapı karesine dokun → içeri, rafa dokun, kapıdan çık', () => {
        prepare();
        const { door } = atShed();
        api.tapTile(door.x + 0.5, door.y - 0.5);
        run(300, () => sim.interior !== null);
        const it = sim.interior;
        if (!it || it.kind !== 'pantry') return [false, `içeri=${it?.kind ?? 'yok'}`];
        const shelf = it.items.find((i) => i.type === 'sacks')!;
        api.tapTile(shelf.x + 0.5, shelf.y + 0.5);
        run(300, () => !sim.nav.active);
        const r = resolveAction(sim);
        const faced = !!r.tile && interiorItemAt(it, r.tile.x, r.tile.y)?.type === 'sacks';
        api.tapTile(it.door.x + 0.5, it.door.y + 0.5);
        run(300, () => sim.interior === null);
        const out = sim.interior === null && sim.player.tileX === door.x && sim.player.tileY === door.y;
        return [faced && out, `içeri=pantry raf=${faced} çıktı=${out}`];
      });

      scenario('12 kilere (binaya) dokun → sipariş paneli, içeri girilmez', () => {
        prepare();
        const { shed } = atShed();
        api.tapTile(shed.x + 0.5, shed.y + 0.5);
        run(300, () => store.panel.value === 'shed');
        const panelOk = store.panel.value === 'shed';
        const outside = sim.interior === null;
        store.panel.value = 'none';
        return [panelOk && outside, `panel=${panelOk} dışarıda=${outside}`];
      });

      prepare();

      scenario('13 kuruluş: Göster → dokunarak kur → üç belediye hedefi', () => {
        const g = freshGame('guided', SCENARIO_SEED_GUIDED);
        api.cancelTouches();
        store.panel.value = 'none';
        const spots: Partial<Record<BuildingType, TilePos>> = {
          kennelSmall: { x: 90, y: 92 },
          bowl: { x: 93, y: 92 },
          trough: { x: 94, y: 92 },
          incubator: { x: 104, y: 92 },
        };
        const m0 = g.money;
        const log: string[] = [];
        for (let step = 0; step < 4; step++) {
          const goal = g.goals.current;
          const tool = goal ? goalShowTool(g, goal) : null;
          const spot = tool ? spots[tool] : undefined;
          if (!goal || !tool || !spot) return [false, `adım ${step + 1}: hedef=${goal?.id ?? 'yok'} araç=${tool ?? 'yok'}`];
          app.showBuild(tool);
          const sel = store.build.value;
          const selected = g.mode === 'manage' && store.buildBar.value && sel.kind === 'building' && sel.type === tool;
          // Köpekler yerleştirmeyi engellemesin.
          for (const d of g.shelterDogs()) {
            d.x = g.world.plot.x + g.world.plot.w - 3.5;
            d.y = g.world.plot.y + g.world.plot.h - 3.5;
            d.path = [];
          }
          const before = g.buildings.length;
          api.tapTile(spot.x + 0.5, spot.y + 0.5);
          const placed = g.buildings.length === before + 1;
          for (let i = 0; i < 90; i++) g.update(1 / 30);
          log.push(`${tool}:${selected ? 'seçili' : 'seçilmedi'}/${placed ? 'kuruldu' : 'kurulmadı'}`);
          if (!selected || !placed) return [false, log.join(' ')];
        }
        const done = ['kennel', 'bowlTrough', 'incubator'].every((id) => g.goals.done.has(id));
        store.build.value = { kind: 'none' };
        g.setMode('avatar');
        return [done, `${log.join(' ')} hedefler=${[...g.goals.done].join(',')} kasa=${Math.round(g.money - m0)}`];
      });

      // 14–15 (0.20.5): köy: tabeladan hızlı seyahat, görev panosu, otopilotun köy işine dokunmaması (taze hazır oyun).
      const vg = freshGame('ready', SCENARIO_SEED_READY);
      const vrun = (frames: number, until?: () => boolean): void => {
        for (let i = 0; i < frames && !(until && until()); i++) vg.update(1 / 30);
      };
      const inVillage = (): boolean => {
        const r = vg.world.village;
        const p = vg.player;
        return !!r && p.tileX >= r.x && p.tileY >= r.y && p.tileX < r.x + r.w && p.tileY < r.y + r.h;
      };
      const villageReset = (): void => {
        api.cancelTouches();
        vg.setAutopilot(false);
        vg.nav.cancel();
        vg.player.busy = 0;
        store.panel.value = 'none';
      };

      scenario('14 tabelaya dokun → hızlı seyahat paneli → köye git', () => {
        villageReset();
        const signs = signposts(vg.world);
        const home = signs.find((s) => s.id === 'shelter');
        const village = signs.find((s) => s.id === 'village');
        if (!home || !village) return [false, 'tabela yok'];
        // Köy tabelası görülmüş sayılır (oraya yürümek uzun sürer).
        vg.world.explored[vg.world.idx(village.x, village.y)] = 1;
        api.tapTile(home.x + 0.5, home.y + 0.5);
        const walking = vg.nav.goal?.kind === 'object';
        vrun(400, () => store.panel.value === 'travel');
        const panel = store.panel.value === 'travel';
        // Paneldeki "Git" düğmesinin komutu.
        const t0 = vg.clock.totalMinutes;
        const r = vg.command({ type: 'travel', to: 'village' });
        if (r.ok) store.panel.value = 'none';
        const minutes = Math.round(vg.clock.totalMinutes - t0);
        return [walking && panel && r.ok && inVillage() && vg.villageFound, `yürüdü=${walking} panel=${panel} köyde=${inVillage()} yol=${minutes} dk`];
      });

      scenario('15 görev panosu → kayıp köpeği bul → panoda teslim; otopilot panoyu açmaz, eve yürür', () => {
        villageReset();
        const board = questBoardTile(vg.world);
        if (!inVillage() || !board) return [false, 'köyde değil'];
        vg.stepSim(1);
        const q = vg.quests.list.find((x) => x.kind === 'lost');
        const d = q?.dog;
        if (!q || !d) return [false, `ilanlar=${vg.quests.list.map((x) => x.kind).join(',')}`];
        api.tapTile(board.x + 0.5, board.y + 0.5);
        vrun(400, () => store.panel.value === 'quests');
        const panel = store.panel.value === 'quests';
        // Paneldeki "Kabul et" düğmesinin komutu.
        const accepted = vg.command({ type: 'questAccept', id: q.id }).ok;
        store.panel.value = 'none';
        // Köpeğin birkaç kare ötesine geç (oraya yürümek uzun sürer), sonra köpeğe dokun.
        const w = vg.world;
        let near: TilePos | null = null;
        for (let r = 2; r <= 5 && !near; r++) {
          for (const [dx, dy] of [
            [r, 0],
            [-r, 0],
            [0, r],
            [0, -r],
          ]) {
            const x = d.spotX + dx;
            const y = d.spotY + dy;
            if (!near && w.inBounds(x, y) && !w.isSolid(x, y)) near = { x, y };
          }
        }
        if (!near) return [false, 'köpeğin yanında boş kare yok'];
        vg.player.x = near.x + 0.5;
        vg.player.y = near.y + 0.7;
        vrun(2);
        api.tapTile(d.x, d.y - 0.3);
        vrun(400, () => d.found);
        const found = d.found;
        // Panoya dön (köpek yanına gelir), panoya dokun, teslim et.
        vg.player.x = board.x + 0.5;
        vg.player.y = board.y + 2.7;
        vrun(3);
        const m0 = vg.money;
        api.tapTile(board.x + 0.5, board.y + 0.5);
        vrun(400, () => store.panel.value === 'quests');
        // Paneldeki "Teslim et" düğmesinin komutu.
        const paid = vg.command({ type: 'questDeliver', id: q.id }).ok && vg.money > m0;
        store.panel.value = 'none';
        // Otopilot açıkken panoya varsa da açmaz; sonra barınak işine (eve) yürür.
        vg.player.x = board.x + 0.5;
        vg.player.y = board.y + 2.7;
        const plot = vg.world.plot;
        const home = (): number => Math.hypot(vg.player.x - (plot.x + plot.w / 2), vg.player.y - (plot.y + plot.h / 2));
        vg.setAutopilot(true);
        vg.nav.goInteract({ kind: 'object', tile: board });
        vrun(120, () => !vg.nav.active);
        const noPanel = store.panel.value === 'none';
        const h0 = home();
        vrun(240);
        const homeward = home() < h0 - 5;
        villageReset();
        return [
          panel && accepted && found && paid && noPanel && homeward,
          `panel=${panel} kabul=${accepted} bulundu=${found} teslim=${paid} otopilot: pano=${noPanel ? 'kapalı' : 'açıldı'} eve=${homeward}`,
        ];
      });

      // 16 (0.21.5): sahiplendirme hikâyesi, taze hazır oyunda.
      scenario('16 ofiste masaya dokun → bilgisayar → sahiplendir → mektup gelir (panel açılmaz, otopilot karışmaz) → Posta → albüm', () => {
        const sg = freshGame('ready', SCENARIO_SEED_READY);
        api.cancelTouches();
        store.panel.value = 'none';
        const srun = (frames: number, until?: () => boolean): void => {
          for (let i = 0; i < frames && !(until && until()); i++) sg.update(1 / 30);
        };
        const office = sg.buildings.find((b) => b.type === 'office' && isReady(b));
        if (!office) return [false, 'ofis yok'];
        const door = buildingDoorTile(office);
        sg.player.x = door.x + 0.5;
        sg.player.y = door.y + 0.9;
        api.tapTile(office.x + 1.5, office.y + 1.5);
        srun(300, () => sg.interior !== null);
        const it = sg.interior;
        const desk = it?.items.find((i) => i.type === 'desk');
        if (!it || !desk) return [false, `içeri=${!!it} masa=${!!desk}`];
        api.tapTile(desk.x + 0.5, desk.y + 0.5);
        srun(300, () => store.panel.value === 'computer');
        // store.panel yukarıda 'none' atandı; TS daraltmasın diye genişletilir.
        const computer = (store.panel.value as string) === 'computer';
        // Bilgisayardaki "Sahiplendirme" ve masadaki "Sahiplendir" düğmelerinin yolu.
        store.panel.value = 'adoption';
        sg.clock.totalMinutes = 10 * 60;
        const dog = sg.shelterDogs()[0];
        dog.needs.health = 100;
        dog.needs.hygiene = 100;
        dog.needs.loyalty = 100;
        const a = sg.adoption.spawnAdopter();
        if (!a) return [false, 'sahiplenici gelmedi'];
        a.state = 'waiting';
        a.request = {};
        const adopted = sg.command({ type: 'adopt', adopterId: a.id, dogId: dog.id }).ok;
        store.panel.value = 'none';
        sg.exitInterior();
        const rec = sg.adoptions[sg.adoptions.length - 1];
        if (!adopted || rec?.letterDay === undefined) return [false, `sahiplendi=${adopted}`];
        // Günler geçer, otopilot açık: mektup 11:00'de gelir; panel açılmaz, otopilot sahiplendirmez ya da ilan etmez.
        sg.setAutopilot(true);
        const adopted0 = sg.stats.adopted;
        let lettered = false;
        const off = sg.events.on('letter', () => (lettered = true));
        sg.clock.totalMinutes = (rec.letterDay - 1) * 24 * 60 + 10 * 60 + 58;
        sg.stepSim(3);
        srun(90);
        off();
        const noPanel = store.panel.value === 'none';
        const pilotOk = sg.stats.adopted === adopted0 && sg.flags.adoptionDay === 0 && sg.flags.campaignLeft === 0;
        sg.setAutopilot(false);
        sg.nav.cancel();
        // ☰ Menü → Posta: mektup okunur; albümde kart aynı mektupla.
        store.panel.value = 'mail';
        const L = sg.mail.list[sg.mail.list.length - 1];
        const read = !!L && sg.command({ type: 'readMail', id: L.id }).ok && sg.mail.unread() === 0;
        store.panel.value = 'album';
        const card = albumEntries(sg)[0];
        const inAlbum = !!L && card?.record === rec && card.letter?.id === L.id;
        store.panel.value = 'none';
        return [
          computer && adopted && lettered && noPanel && pilotOk && read && inAlbum,
          `bilgisayar=${computer} sahiplendi=${adopted} mektup=${lettered} panel=${noPanel ? 'kapalı' : 'açıldı'} otopilot=${pilotOk ? 'karışmadı' : 'karıştı'} okundu=${read} albüm=${inAlbum}`,
        ];
      });

      // 17–19 (0.22.6): M19 — binayı taşı, kulübe içi, açılış tanıtımı; her biri taze oyunda.
      /** Arsada binanın sığdığı, oyuncudan ve köpeklerden en az 3 kare uzak ilk yer. */
      const spotFor = (g: Sim, type: BuildingType, rot: Rotation = 0): TilePos | null => {
        const p = g.world.plotInterior();
        const s = buildingSize(BUILDING_DEFS[type], rot);
        for (let y = p.y + 2; y < p.y + p.h - s.h - 1; y++) {
          for (let x = p.x + 2; x < p.x + p.w - s.w - 1; x++) {
            if (!canPlaceBuilding(g.world, type, x, y, rot)) continue;
            const cx = x + s.w / 2;
            const cy = y + s.h / 2;
            if (Math.hypot(g.player.x - cx, g.player.y - cy) < 3 || g.dogs.some((d) => Math.hypot(d.x - cx, d.y - cy) < 3)) continue;
            return { x, y };
          }
        }
        return null;
      };
      const reset = (g: Sim): void => {
        api.cancelTouches();
        store.panel.value = 'none';
        store.build.value = { kind: 'none' };
        store.buildBar.value = false;
        g.setMode('avatar');
      };

      scenario('17 Taşı: kulübeye dokun → boş yere dokun → köpeğiyle taşındı; sürükle-bırak; büyük kulübe Döndür ile', () => {
        const g = freshGame('ready', SCENARIO_SEED_READY);
        api.cancelTouches();
        store.panel.value = 'none';
        const k = g.buildings.find((b) => b.type === 'kennelSmall' && b.occupants.length > 0) ?? g.buildings.find((b) => b.type === 'kennelSmall');
        if (!k) return [false, 'kulübe yok'];
        const dogs0 = k.occupants.join();
        // Yönet → İnşa → Taşı (düğmelerin yolu); binaya dokun: tutulur.
        g.setMode('manage');
        store.buildBar.value = true;
        store.build.value = { kind: 'move', id: null };
        api.tapTile(k.x + 0.5, k.y + 0.5);
        const t0 = store.build.value;
        const held = t0.kind === 'move' && t0.id === k.id;
        const to = spotFor(g, 'kennelSmall');
        if (!to) return [false, 'boş yer yok'];
        api.tapTile(to.x + 0.5, to.y + 0.5);
        const tapped = k.x === to.x && k.y === to.y && k.occupants.join() === dogs0;
        const t1 = store.build.value;
        const again = t1.kind === 'move' && t1.id === null;
        // Sürükle-bırak tek harekette taşır.
        const to2 = spotFor(g, 'kennelSmall');
        if (!to2) return [false, 'ikinci boş yer yok'];
        api.dragTile(k.x + 0.5, k.y + 0.5, to2.x + 0.5, to2.y + 0.5);
        const dragged = k.x === to2.x && k.y === to2.y;
        // Büyük kulübe: tut, Döndür çipinin yolu, yeni yerine dokun.
        const bs = spotFor(g, 'kennelLarge');
        const big = bs ? g.placeBuilding('kennelLarge', bs.x, bs.y) : null;
        if (!big) return [false, 'büyük kulübe kurulamadı'];
        api.tapTile(big.x + 0.5, big.y + 0.5);
        const turned = rotateBuildTool();
        const to3 = spotFor(g, 'kennelLarge', 1);
        if (!to3) return [false, 'döndürülmüş büyük kulübeye yer yok'];
        api.tapTile(to3.x + 0.5, to3.y + 0.5);
        const rotated = big.rot === 1 && big.x === to3.x && big.y === to3.y;
        const moved = g.stats.moved;
        reset(g);
        return [held && tapped && again && dragged && turned && rotated && moved === 3, `tutuldu=${held} dokunuşla=${tapped} yeniden seç=${again} sürükle=${dragged} döndür=${rotated} taşıma=${moved}`];
      });

      scenario('18 kulübeye dokun → panel → İçeri gir → panoya dokun → yatak al → gece köpek yatağında çizili → kapıdan çık', () => {
        const g = freshGame('ready', SCENARIO_SEED_READY);
        const grun = (frames: number, until?: () => boolean): void => {
          for (let i = 0; i < frames && !(until && until()); i++) g.update(1 / 30);
        };
        api.cancelTouches();
        store.panel.value = 'none';
        const { scene } = need();
        const k = g.buildings.find((b) => b.type === 'kennelSmall');
        const dog = g.shelterDogs()[0];
        if (!k || !dog) return [false, 'kulübe ya da köpek yok'];
        if (dog.kennelId !== k.id && !g.command({ type: 'assignKennel', dogId: dog.id, buildingId: k.id }).ok) return [false, 'köpek kulübeye yerleşmedi'];
        // Köpek uzakta otursun (dokunuş köpeğe gitmesin); oyuncu kulübenin kapı önünde.
        const far = freeTileNear(g, 8);
        if (far) {
          dog.x = far.x + 0.5;
          dog.y = far.y + 0.7;
        }
        dog.path = [];
        dog.state = 'sit';
        dog.stateTimer = 9999;
        const door = buildingDoorTile(k);
        g.player.x = door.x + 0.5;
        g.player.y = door.y + 0.9;
        api.tapTile(k.x + 0.5, k.y + 0.5);
        grun(300, () => store.panel.value === 'kennel');
        // store.panel yukarıda 'none' atandı; TS daraltmasın diye genişletilir.
        const panel = (store.panel.value as string) === 'kennel';
        // Kulübe panelindeki "🚪 İçeri gir" düğmesinin yolu.
        const entered = g.command({ type: 'goInteract', goal: { kind: 'enter', id: k.id } }).ok;
        store.panel.value = 'none';
        grun(300, () => g.interior !== null);
        const it = g.interior;
        if (!it || it.kind !== 'kennel') return [false, `panel=${panel} içeri=${it?.kind ?? 'yok'}`];
        const board = it.items.find((i) => i.type === 'kennelBoard');
        if (!board) return [false, 'pano yok'];
        api.tapTile(board.x + 0.5, board.y + 0.5);
        grun(300, () => store.panel.value === 'furniture');
        const shop = (store.panel.value as string) === 'furniture';
        // Eşya panelindeki "Al" düğmesinin yolu.
        g.money = Math.max(g.money, 1000);
        const bought = g.command({ type: 'buyFurniture', buildingId: k.id, item: 'dogBed' }).ok && !!g.interior?.items.some((i) => i.type === 'dogBed');
        store.panel.value = 'none';
        // Gece: köpek kulübesinin eşiğinde uyur; sahne onu içeride, yatağında yatarken çizer.
        g.clock.totalMinutes = (g.clock.day - 1) * 24 * 60 + 22 * 60;
        const rest = kennelRestTile(k, k.occupants.indexOf(dog.id));
        dog.x = rest.x + 0.5;
        dog.y = rest.y + 0.5;
        dog.path = [];
        dog.state = 'sleep';
        dog.needs.energy = 20;
        let now = performance.now();
        for (let i = 0; i < 4; i++) {
          now += 16;
          app.game?.step(now, 16);
        }
        const info = scene.dogSpriteInfo(dog.id);
        const drawn = !!info && info.inside && info.frame % DOG_FRAMES === DOG_FRAME_LIE;
        const exitDoor = g.interior?.door ?? it.door;
        api.tapTile(exitDoor.x + 0.5, exitDoor.y + 0.5);
        grun(300, () => g.interior === null);
        const out = g.interior === null && g.player.tileX === door.x && g.player.tileY === door.y;
        reset(g);
        return [panel && entered && shop && bought && drawn && out, `panel=${panel} içeri=kennel pano=${shop} yatak=${bought} çizim=${drawn ? 'içeride yatıyor' : JSON.stringify(info)} çıktı=${out}`];
      });

      // 19: açılış tanıtımı arayüzün gerçek düğmeleriyle (DOM tıklaması; Preact çizimi beklenir). Test oyununda tercih değişmez.
      try {
        const g = freshGame('guided', SCENARIO_SEED_GUIDED);
        const grun = (frames: number, until?: () => boolean): void => {
          for (let i = 0; i < frames && !(until && until()); i++) g.update(1 / 30);
        };
        const settle = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
        /** Sahneyi birkaç kare ilerlet, store'u tazele (tanıtım koşulları denetlenir), arayüz çizilsin. */
        const tick = async (): Promise<void> => {
          let now = performance.now();
          for (let i = 0; i < 6; i++) {
            now += 16;
            app.game?.step(now, 16);
          }
          syncStore(g);
          await settle(80);
        };
        const click = (sel: string): boolean => {
          const el = document.querySelector<HTMLElement>(sel);
          const target = el && el.tagName !== 'BUTTON' ? el.querySelector<HTMLElement>('.btn:not(.close)') : el;
          target?.click();
          return !!target;
        };
        api.cancelTouches();
        store.panel.value = 'none';
        const pref0 = store.tutorialDone.value;
        const at = (): string => app.tutorial.step?.id ?? 'bitti';
        const log: string[] = [];
        app.tutorial.start(g, 'guided');
        await tick();
        const bubble = !!document.querySelector('.coach-bubble');
        // 1 Başla (balondaki birincil düğme).
        click('.coach-bubble .btn.primary');
        await tick();
        log.push(at());
        // 2 köpeğin yanına dokun.
        const dog = g.shelterDogs()[0];
        dog.path = [];
        dog.state = 'sit';
        dog.stateTimer = 9999;
        api.tapTile(dog.x + 1.6, dog.y - 0.2);
        grun(600, () => !g.nav.active);
        await tick();
        log.push(at());
        // 3 köpeğe dokun: sever.
        api.tapTile(dog.x, dog.y - 0.2);
        grun(600, () => g.stats.petted > 0 && !g.nav.active);
        await tick();
        log.push(at());
        // 4 🛠 Yönet, 5 🏗️ İnşa, 6 Küçük kulübe → arsaya dokun, 7 hedef kartı.
        click('[data-tut="mode"]');
        await tick();
        log.push(at());
        click('[data-nav="build"]');
        await tick();
        log.push(at());
        click('.build-item[data-type="kennelSmall"]');
        await tick();
        const spot = spotFor(g, 'kennelSmall');
        if (spot) api.tapTile(spot.x + 0.5, spot.y + 0.5);
        await tick();
        log.push(at());
        click('[data-tut="guide"]');
        await tick();
        log.push(at());
        const finished = !app.tutorial.active && store.tutorial.value === null;
        const prefKept = store.tutorialDone.value === pref0;
        const expected = 'walk,pet,manage,build-open,kennel,goals,bitti';
        reset(g);
        results.push({
          name: '19 tanıtım: gerçek düğmelerle kuruluş adımları (Başla, yürü, sev, Yönet, İnşa, kulübe, hedefler) → bitti, tercih değişmez',
          ok: bubble && log.join(',') === expected && finished && prefKept,
          detail: `balon=${bubble} adımlar=${log.join(' → ')} bitti=${finished} tercih=${prefKept ? 'aynı' : 'değişti'}`,
        });
      } catch (e) {
        results.push({ name: '19 tanıtım', ok: false, detail: String(e) });
      }

      // 20 (0.23.4): M18 — odun ve taş, terk edilmiş ev, malzemeyle öde; otopilot ağaç kesmez, eve girmez (taze hazır oyun).
      scenario('20 ağaca dokun → keser, kayaya → kırar; eve dokun → içeri → sandık → çık; malzemeyle kulübe; otopilot kesmez, girmez', () => {
        const g = freshGame('ready', SCENARIO_SEED_READY);
        const grun = (frames: number, until?: () => boolean): void => {
          for (let i = 0; i < frames && !(until && until()); i++) g.update(1 / 30);
        };
        api.cancelTouches();
        store.panel.value = 'none';
        const w = g.world;
        const site = w.ruin;
        if (!site) return [false, 'ev yok'];
        const door = ruinDoorTile(site);
        const c = site.clearing;
        /** Kapının 3–16 karesinde, açıklığın dışında, altında ya da yanında yürünür kare olan en yakın nesne. */
        const near = (match: (o: Obj) => boolean): TilePos | null => {
          let best: TilePos | null = null;
          let bestD = Infinity;
          for (let y = door.y - 16; y <= door.y + 16; y++) {
            for (let x = door.x - 16; x <= door.x + 16; x++) {
              if (!w.inBounds(x, y) || !match(w.objectAt(x, y))) continue;
              if (x >= c.x - 1 && y >= c.y - 1 && x <= c.x + c.w && y <= c.y + c.h) continue;
              if (![[0, 1], [1, 0], [-1, 0]].some(([dx, dy]) => !w.isSolid(x + dx, y + dy))) continue;
              const d = Math.hypot(x - door.x, y - door.y);
              if (d >= 3 && d < bestD) {
                best = { x, y };
                bestD = d;
              }
            }
          }
          return best;
        };
        const trunk = (o: Obj): boolean => o === Obj.TreeTrunk || o === Obj.PineTrunk;
        const tree = near(trunk);
        const rock = near((o) => o === Obj.Rock);
        if (!tree || !rock) return [false, `ağaç=${!!tree} kaya=${!!rock}`];
        const toDoor = (): void => {
          g.player.x = door.x + 0.5;
          g.player.y = door.y + 0.7;
          g.player.busy = 0;
          g.player.stamina = BALANCE.player.staminaMax;
          grun(2);
        };
        // Ağacın tepesine dokun → gövdenin yanına yürür, keser; gövde kütüğe döner.
        toDoor();
        const wood0 = g.materials.wood;
        api.tapTile(tree.x + 0.5, tree.y - 0.5);
        grun(900, () => g.materials.wood > wood0 && !g.nav.active);
        const chopped = g.materials.wood > wood0 && w.objectAt(tree.x, tree.y) === Obj.Stump;
        // Kayaya dokun → kırar, kaya kalkar.
        toDoor();
        const stone0 = g.materials.stone;
        api.tapTile(rock.x + 0.5, rock.y + 0.5);
        grun(900, () => g.materials.stone > stone0 && !g.nav.active);
        const mined = g.materials.stone > stone0 && w.objectAt(rock.x, rock.y) === Obj.None;
        // Eve dokun → kapı önüne yürür, girer; sandığa dokun → 400 ₺; kapıya dokun → dışarı.
        toDoor();
        // Kapıdan iki kare solda, bir kare aşağıda (açıklığın içi hep yürünür; dışı ağaç olabilir).
        g.player.x -= 2;
        g.player.y += 1;
        api.tapTile(site.x + 1.5, site.y + 1.5);
        grun(900, () => g.interior !== null);
        const inside = g.interior?.kind === 'ruin';
        const chest = g.interior?.items.find((i) => i.type === 'chest');
        const money0 = g.money;
        if (chest) api.tapTile(chest.x + 0.5, chest.y + 0.5);
        grun(600, () => g.ruin.chest > 0 && !g.nav.active);
        const looted = g.ruin.chest > 0 && g.money === money0 + BALANCE.ruin.chestMoney;
        const exit = g.interior?.door;
        if (exit) api.tapTile(exit.x + 0.5, exit.y + 0.5);
        grun(600, () => g.interior === null);
        const out = g.interior === null && g.player.tileX === door.x && g.player.tileY === door.y;
        // Malzemeyle öde: Yönet → İnşa → Küçük kulübe → arsaya dokun; tarif çantadan düşer, fiyat iner.
        g.materials = { wood: 10, stone: 5 };
        g.money = Math.max(g.money, 2000);
        g.setMode('manage');
        store.buildBar.value = true;
        store.build.value = { kind: 'building', type: 'kennelSmall' };
        const spot = spotFor(g, 'kennelSmall');
        if (!spot) return [false, 'kulübeye yer yok'];
        const cash = g.money;
        api.tapTile(spot.x + 0.5, spot.y + 0.5);
        const k = g.buildings.find((b) => b.type === 'kennelSmall' && b.x === spot.x && b.y === spot.y);
        const paid = k ? k.paid : null;
        const withMats =
          !!paid && paid.wood === 6 && paid.stone === 2 && paid.money < BUILDING_DEFS.kennelSmall.cost && g.money === cash - paid.money && g.materials.wood === 4 && g.materials.stone === 3;
        reset(g);
        // Otopilot: ağacın dibine varsa da kesmez, evin kapısına varsa da girmez (varışta işi reddeder).
        const seen: string[] = [];
        const off = g.events.on('interacted', (e) => seen.push(`${e.kind}:${e.result.ok}`));
        const tree2 = near(trunk);
        const stand = tree2
          ? [
              [0, 1],
              [-1, 0],
              [1, 0],
              [0, -1],
            ]
              .map(([dx, dy]) => ({ x: tree2.x + dx, y: tree2.y + dy }))
              .find((s) => !w.isSolid(s.x, s.y))
          : undefined;
        let noChop = false;
        let noEnter = false;
        if (tree2 && stand) {
          g.setAutopilot(true);
          g.player.x = stand.x + 0.5;
          g.player.y = stand.y + 0.7;
          g.player.busy = 0;
          g.player.stamina = BALANCE.player.staminaMax;
          const wood1 = g.materials.wood;
          g.nav.goInteract({ kind: 'object', tile: tree2 });
          noChop = g.materials.wood === wood1 && trunk(w.objectAt(tree2.x, tree2.y)) && seen.includes('chop:false');
          g.player.x = door.x + 0.5;
          g.player.y = door.y + 0.7;
          g.player.busy = 0;
          g.nav.goInteract({ kind: 'ruin' });
          noEnter = g.interior === null && seen.includes('enterRuin:false');
          g.setAutopilot(false);
        }
        off();
        return [
          chopped && mined && inside && looted && out && withMats && noChop && noEnter,
          `kesti=${chopped} kırdı=${mined} içeri=${inside} sandık=${looted} çıktı=${out} malzemeyle=${withMats ? `${paid?.money} ₺ + 🪵6 🪨2` : JSON.stringify(paid)} otopilot: kesmedi=${noChop} girmedi=${noEnter}`,
        ];
      });

      return { summary: summarize(results), results };
    },
  };
  return api;
}

export type TouchDebug = ReturnType<typeof createTouchDebug>;
