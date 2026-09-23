/**
 * Uçtan uca dokunma test kancası (yalnız `?debug=1`): `window.__pati.debug`. Dokunuşları WorldScene'in gerçek giriş
 * kapısından (`pointerInput` → TouchGestures → handleGesture) geçirir; yalnız Phaser'ın DOM → Pointer çevirisi atlanır.
 * `runTouchScenarios()` telefonda yaşanan takılma sıralarını tek komutla koşar. Normal oyunda hiç bağlanmaz.
 */
import { BALANCE } from '../config/balance';
import { GAME } from '../config/game';
import type { GesturePointer } from '../scenes/TouchGestures';
import type { WorldScene } from '../scenes/WorldScene';
import type { BuildingType } from '../content/buildings';
import type { Sim, StarterKind } from '../sim/Sim';
import { goalShowTool } from '../sim/systems/Goals';
import type { Dog } from '../sim/entities/Dog';
import { buildingDoorTile, isReady } from '../sim/entities/Building';
import type { TilePos } from '../sim/world/TileWorld';
import { Obj } from '../sim/world/tiles';
import { store } from '../ui/store';
import { resolveAction } from '../sim/systems/Interaction';
import { interiorItemAt } from '../sim/interior/Interiors';

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
}

/** Senaryoların sabit tohumları (0.19.3): 1–12 hazır barınakta, 13 kuruluşta. */
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

export function createTouchDebug(app: DebugApp) {
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
    runTouchScenarios(): { summary: string; results: ScenarioResult[] } {
      // 0.19.3: senaryolar kendi dünyalarını kurar (sabit tohum, kayda dokunmaz): 1–12 hazır barınakta, 13 kuruluşta.
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

      return { summary: summarize(results), results };
    },
  };
  return api;
}

export type TouchDebug = ReturnType<typeof createTouchDebug>;
