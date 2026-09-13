import Phaser from 'phaser';
import { BALANCE } from '../config/balance';
import { GAME } from '../config/game';
import { BUILDING_DEFS } from '../content/buildings';
import { DOG_FRAMES, DOG_FRAME_EAT, DOG_FRAME_IDLE, DOG_FRAME_LIE, DOG_FRAME_SIT } from '../render/DogPainter';
import { TEX, buildingTextureKey, ensureDogTexture, ensureHumanTexture } from '../render/TextureRegistry';
import { type Building, buildingDef, canPlaceBuilding, isReady } from '../sim/entities/Building';
import type { Dog } from '../sim/entities/Dog';
import type { PlayerInput } from '../sim/entities/Player';
import type { Mode, Sim } from '../sim/Sim';
import type { Tool } from '../sim/systems/Interaction';
import type { TilePos } from '../sim/world/TileWorld';
import { OBJ_INFO, Obj, ZONE_COLORS, ZONE_TILE_BASE, Zone, objTileIndex } from '../sim/world/tiles';
import { showToast, store, syncStore } from '../ui/store';
import { audio } from '../audio/audio';
import { resolveAction } from '../sim/systems/Interaction';
import { drawLightDisc } from '../render/LightArt';
import { Pixels, hex } from '../render/Pixels';
import { SEASON_TINT } from '../sim/systems/WeatherSystem';
import { t } from '../i18n';

type KeyName =
  | 'W' | 'A' | 'S' | 'D' | 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'SHIFT' | 'E' | 'I' | 'B' | 'X' | 'Z' | 'O' | 'N' | 'P' | 'F' | 'TAB' | 'SPACE' | 'ESC'
  | 'PLUS' | 'MINUS' | 'NUMPAD_ADD' | 'NUMPAD_SUBTRACT' | 'ONE' | 'TWO' | 'THREE' | 'FOUR' | 'FIVE' | 'SIX' | 'H' | 'L';
type Keys = Record<KeyName, Phaser.Input.Keyboard.Key>;

const KEY_LIST: KeyName[] = [
  'W', 'A', 'S', 'D', 'UP', 'DOWN', 'LEFT', 'RIGHT', 'SHIFT', 'E', 'I', 'B', 'X', 'Z', 'O', 'N', 'P', 'F', 'TAB', 'SPACE', 'ESC',
  'PLUS', 'MINUS', 'NUMPAD_ADD', 'NUMPAD_SUBTRACT', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'H', 'L',
];

const TOOL_KEYS: Array<[KeyName, Tool]> = [
  ['ONE', 'pet'],
  ['TWO', 'play'],
  ['THREE', 'train'],
  ['FOUR', 'feed'],
  ['FIVE', 'clean'],
  ['SIX', 'call'],
];

export interface WorldSceneData {
  sim: Sim;
}

const GHOST_OK = 0x8cff8c;
const GHOST_BAD = 0xff7b7b;

/** Dünyayı çizer ve girdiyi sim'e taşır. Oyun mantığı burada değil, Sim içindedir. */
export class WorldScene extends Phaser.Scene {
  private sim!: Sim;
  private tileset!: Phaser.Tilemaps.Tileset;
  private groundLayer!: Phaser.Tilemaps.TilemapLayer;
  private zoneLayer!: Phaser.Tilemaps.TilemapLayer;
  private objectLayer!: Phaser.Tilemaps.TilemapLayer;
  private aboveLayer!: Phaser.Tilemaps.TilemapLayer;
  private playerSprite!: Phaser.GameObjects.Sprite;
  private nightRect!: Phaser.GameObjects.Rectangle;
  private selectRing!: Phaser.GameObjects.Ellipse;
  private busyBar!: Phaser.GameObjects.Graphics;
  private ghostImage!: Phaser.GameObjects.Image;
  private ghostGfx!: Phaser.GameObjects.Graphics;
  private keys!: Keys;
  private zoomTarget: number = BALANCE.camera.avatarZoom;
  private waterTimer = 0;
  private waterFrame: 0 | 1 = 0;
  private syncTimer = 0;
  private dragLast: { x: number; y: number } | null = null;
  private dragMoved = false;
  private dragButton = 0;
  private dragStartTile: TilePos | null = null;
  private hoverTile: TilePos = { x: 0, y: 0 };
  private unsub: Array<() => void> = [];
  private stepTimer = 0;
  private barkTimer = 4;
  /** Havlama durumuna girdiği görülen köpekler (bir kez ses için). */
  private barkSeen = new Set<number>();
  private lightMap!: Phaser.GameObjects.RenderTexture;
  private rain!: Phaser.GameObjects.Particles.ParticleEmitter;
  private snow!: Phaser.GameObjects.Particles.ParticleEmitter;
  private weatherZone = new Phaser.Geom.Rectangle(0, 0, 800, 4);
  private buildingImages = new Map<number, Phaser.GameObjects.Image>();
  private dogSprites = new Map<number, Phaser.GameObjects.Sprite>();
  private adopterSprites = new Map<number, Phaser.GameObjects.Sprite>();
  private staffSprites = new Map<number, Phaser.GameObjects.Sprite>();

  constructor() {
    super('World');
  }

  init(data: WorldSceneData): void {
    this.sim = data.sim;
  }

  create(): void {
    const world = this.sim.world;
    const T = GAME.tile;

    // --- Harita katmanları ---
    const map = this.make.tilemap({ tileWidth: T, tileHeight: T, width: world.width, height: world.height });
    const tileset = map.addTilesetImage('tiles', TEX.tiles0, T, T, 0, 0);
    if (!tileset) throw new Error('Tileset oluşturulamadı');
    this.tileset = tileset;
    this.groundLayer = must(map.createBlankLayer('ground', tileset)).setDepth(0);
    this.zoneLayer = must(map.createBlankLayer('zones', tileset)).setDepth(0.5).setAlpha(0.6);
    this.objectLayer = must(map.createBlankLayer('objects', tileset)).setDepth(1);
    this.aboveLayer = must(map.createBlankLayer('above', tileset)).setDepth(5000);

    const ground: number[][] = [];
    const zones: number[][] = [];
    const objects: number[][] = [];
    const above: number[][] = [];
    for (let y = 0; y < world.height; y++) {
      const gRow: number[] = [];
      const zRow: number[] = [];
      const oRow: number[] = [];
      const aRow: number[] = [];
      for (let x = 0; x < world.width; x++) {
        const i = world.idx(x, y);
        gRow.push(world.ground[i]);
        const z = world.zone[i];
        zRow.push(z !== Zone.None ? ZONE_TILE_BASE + z : -1);
        const [o, a] = this.objectTiles(x, y);
        oRow.push(o);
        aRow.push(a);
      }
      ground.push(gRow);
      zones.push(zRow);
      objects.push(oRow);
      above.push(aRow);
    }
    this.groundLayer.putTilesAt(ground, 0, 0, false);
    this.zoneLayer.putTilesAt(zones, 0, 0, false);
    this.objectLayer.putTilesAt(objects, 0, 0, false);
    this.aboveLayer.putTilesAt(above, 0, 0, false);

    // --- Binalar ---
    for (const b of this.sim.buildings) this.addBuildingImage(b);
    this.unsub.push(
      this.sim.events.on('buildingAdded', (b) => this.addBuildingImage(b)),
      this.sim.events.on('buildingRemoved', (id) => {
        this.buildingImages.get(id)?.destroy();
        this.buildingImages.delete(id);
      }),
      this.sim.events.on('buildingReady', (b) => this.buildingImages.get(b.id)?.setAlpha(1)),
      this.sim.events.on('dogRemoved', (id) => {
        this.dogSprites.get(id)?.destroy();
        this.dogSprites.delete(id);
        if (store.selectedDogId.value === id) store.selectedDogId.value = null;
      }),
      this.sim.events.on('modeChanged', (m) => this.applyMode(m)),
      this.sim.events.on('message', (m) => showToast(m)),
      this.sim.events.on('slept', () => this.cameras.main.flash(600, 10, 8, 20)),
      this.sim.events.on('dogHatched', (d) => {
        store.selectedDogId.value = d.id;
        store.panel.value = 'dog';
      }),
      this.sim.events.on('weekReport', (w) => {
        store.report.value = w;
        this.sim.setSpeed(0);
      }),
      this.sim.events.on('adopterArrived', (a) => showToast(t('{name} kapıdan geldi: sahiplenmek istiyor', { name: a.name }))),
      this.sim.events.on('gameEvent', () => audio.play('alert')),
      this.sim.events.on('achievement', () => audio.play('adopt')),
    );

    // --- Oyuncu ---
    const p = this.sim.player;
    this.playerSprite = this.add.sprite(Math.round(p.x * T), Math.round(p.y * T), TEX.player, 0).setOrigin(0.5, 1);
    this.busyBar = this.add.graphics().setDepth(7000);

    // --- Seçim halkası ve inşa hayaleti ---
    this.selectRing = this.add.ellipse(0, 0, 22, 11).setStrokeStyle(1.5, 0xf6d55c, 0.95).setDepth(60).setVisible(false);
    this.ghostImage = this.add.image(0, 0, buildingTextureKey('bowl')).setOrigin(0, 1).setAlpha(0.6).setDepth(6000).setVisible(false);
    this.ghostGfx = this.add.graphics().setDepth(6001);

    // --- Kamera ---
    const cam = this.cameras.main;
    cam.setBounds(0, 0, world.width * T, world.height * T);
    cam.roundPixels = true;
    cam.setZoom(this.sim.mode === 'avatar' ? BALANCE.camera.avatarZoom : BALANCE.camera.manageZoom);

    // --- Gece örtüsü ve lamba ışıkları ---
    this.nightRect = this.add
      .rectangle(0, 0, 64, 64, 0xffffff)
      .setOrigin(0, 0)
      .setDepth(8000)
      .setBlendMode(Phaser.BlendModes.MULTIPLY);
    if (!this.textures.exists('light')) this.textures.addCanvas('light', drawLightDisc(96).toCanvas());
    this.lightMap = this.add.renderTexture(0, 0, 1400, 800).setOrigin(0, 0).setDepth(8001).setBlendMode(Phaser.BlendModes.MULTIPLY).setVisible(false);
    // Hava: yağmur damlası ve kar tanesi parçacıkları (kamera görüş alanının üst kenarından).
    if (!this.textures.exists('drop')) {
      const drop = new Pixels(2, 7);
      drop.fillRect(0, 0, 2, 7, hex(0xbfe0f7, 200));
      this.textures.addCanvas('drop', drop.toCanvas());
      const flake = new Pixels(3, 3);
      flake.fillRect(0, 0, 3, 3, hex(0xffffff, 230));
      this.textures.addCanvas('flake', flake.toCanvas());
    }
    this.rain = this.add.particles(0, 0, 'drop', {
      speedY: { min: 260, max: 340 },
      speedX: { min: -35, max: -15 },
      lifespan: 2600,
      quantity: 3,
      frequency: 28,
      alpha: { start: 0.9, end: 0.4 },
      emitZone: { type: 'random', source: this.weatherZone, quantity: 1 },
      emitting: false,
    });
    this.rain.setDepth(7500);
    this.snow = this.add.particles(0, 0, 'flake', {
      speedY: { min: 22, max: 42 },
      speedX: { min: -18, max: 18 },
      lifespan: 16000,
      quantity: 1,
      frequency: 45,
      alpha: { start: 0.95, end: 0.6 },
      emitZone: { type: 'random', source: this.weatherZone, quantity: 1 },
      emitting: false,
    });
    this.snow.setDepth(7500);

    // --- Girdi ---
    const kb = this.input.keyboard;
    if (!kb) throw new Error('Klavye eklentisi yok');
    this.keys = kb.addKeys(KEY_LIST.join(',')) as Keys;
    kb.addCapture(['TAB', 'SPACE']);

    this.input.on('wheel', (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      const f = dy > 0 ? 1 / 1.15 : 1.15;
      this.zoomTarget = clamp(this.zoomTarget * f, BALANCE.camera.minZoom, BALANCE.camera.maxZoom);
    });
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => this.onPointerDown(ptr));
    this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => this.onPointerMove(ptr));
    this.input.on('pointerup', (ptr: Phaser.Input.Pointer) => this.onPointerUp(ptr));

    this.game.events.on('ui:focus-tile', this.focusTile, this);
    this.applyMode(this.sim.mode);
    // Dünya üstü göstergeler ayrı sahnede (kamerayı kopyalar).
    this.scene.launch('Overlay', { sim: this.sim });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scene.stop('Overlay');
      for (const u of this.unsub) u();
      this.unsub = [];
      this.dragLast = null;
      this.game.events.off('ui:focus-tile', this.focusTile, this);
      this.buildingImages.clear();
      this.dogSprites.clear();
      this.adopterSprites.clear();
      this.staffSprites.clear();
    });

    syncStore(this.sim);
  }

  override update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.05);
    this.handleHotkeys();
    const input = this.readInput();
    this.sim.update(dt, input);
    this.syncPlayerSprite();
    this.syncDogs();
    this.syncAdopters();
    this.syncStaff();
    this.syncBuildings();
    this.syncSelection();
    this.syncGhost();
    if (this.sim.mode === 'manage') this.panCamera(dt, input);
    this.updateZoom(dt);
    this.updateWater(dt);
    this.updateNight();
    this.updateSounds(dt);
    this.applyDirtyTiles();
    this.syncTimer += dt;
    if (this.syncTimer >= 0.1) {
      this.syncTimer = 0;
      syncStore(this.sim);
    }
  }

  // ---------------------------------------------------------------------------
  // Klavye
  // ---------------------------------------------------------------------------

  private handleHotkeys(): void {
    const k = this.keys;
    const JustDown = Phaser.Input.Keyboard.JustDown;
    if (store.inputFocused.value) return;
    if (JustDown(k.ESC)) {
      this.game.events.emit('ui:escape');
      return;
    }
    if (store.pauseMenu.value) return;
    if (JustDown(k.TAB)) {
      this.sim.toggleMode();
      audio.play('click');
    }
    if (JustDown(k.SPACE)) this.sim.togglePause();
    if (JustDown(k.PLUS) || JustDown(k.NUMPAD_ADD)) this.sim.changeSpeed(1);
    if (JustDown(k.MINUS) || JustDown(k.NUMPAD_SUBTRACT)) this.sim.changeSpeed(-1);
    if (JustDown(k.I)) store.panel.value = store.panel.value === 'dogs' ? 'none' : 'dogs';
    if (JustDown(k.O)) store.panel.value = store.panel.value === 'adoption' ? 'none' : 'adoption';
    if (JustDown(k.N)) store.panel.value = store.panel.value === 'finance' ? 'none' : 'finance';
    if (JustDown(k.P)) store.panel.value = store.panel.value === 'staff' ? 'none' : 'staff';
    if (JustDown(k.F)) store.panel.value = store.panel.value === 'deployment' ? 'none' : 'deployment';
    if (JustDown(k.H)) store.panel.value = store.panel.value === 'achievements' ? 'none' : 'achievements';
    if (JustDown(k.B)) this.game.events.emit('ui:build-toggle');
    if (JustDown(k.L)) this.game.events.emit('ui:labels-toggle');
    if (this.sim.mode === 'manage') {
      if (JustDown(k.X)) store.build.value = store.build.value.kind === 'demolish' ? { kind: 'none' } : { kind: 'demolish' };
      if (JustDown(k.Z)) store.build.value = store.build.value.kind === 'zone' ? { kind: 'none' } : { kind: 'zone', zone: Zone.Toilet };
    }
    for (const [key, tool] of TOOL_KEYS) if (JustDown(k[key])) this.sim.command({ type: 'setTool', tool });
    if (JustDown(k.E) && this.sim.mode === 'avatar' && !this.sim.paused) this.interact();
  }

  private interact(): void {
    const kind = resolveAction(this.sim).kind;
    const r = this.sim.command({ type: 'interact' });
    if (r.message) showToast(r.message);
    if (r.ok) {
      const sfx: Partial<Record<typeof kind, Parameters<typeof audio.play>[0]>> = {
        pet: 'pet',
        play: 'play',
        train: 'play',
        groom: 'groom',
        wash: 'groom',
        fillBowl: 'feed',
        fillTrough: 'feed',
        clean: 'clean',
        pickEgg: 'pick',
        berries: 'berries',
        treatWild: 'pet',
        call: 'play',
        treat: 'treat',
        shed: 'click',
        kennel: 'click',
        incubator: 'click',
        office: 'click',
      };
      const name = sfx[kind];
      if (name) audio.play(name);
    } else if (r.message) audio.play('error');
    if (r.open === 'shed' && r.building) {
      store.panelBuildingId.value = r.building.id;
      store.panel.value = 'shed';
    } else if (r.open === 'kennel' && r.building) {
      store.panelBuildingId.value = r.building.id;
      store.panel.value = 'kennel';
    } else if (r.open === 'incubator' && r.building) {
      store.panelBuildingId.value = r.building.id;
      store.panel.value = 'incubator';
    } else if (r.open === 'office' && r.building) {
      store.panelBuildingId.value = r.building.id;
      store.panel.value = 'office';
    }
  }

  private readInput(): PlayerInput {
    const k = this.keys;
    if (store.pauseMenu.value || store.inputFocused.value) return { dx: 0, dy: 0, run: false };
    const left = k.A.isDown || k.LEFT.isDown;
    const right = k.D.isDown || k.RIGHT.isDown;
    const up = k.W.isDown || k.UP.isDown;
    const down = k.S.isDown || k.DOWN.isDown;
    return { dx: (right ? 1 : 0) - (left ? 1 : 0), dy: (down ? 1 : 0) - (up ? 1 : 0), run: k.SHIFT.isDown };
  }

  // ---------------------------------------------------------------------------
  // Fare
  // ---------------------------------------------------------------------------

  private tileAt(ptr: Phaser.Input.Pointer): TilePos {
    const T = GAME.tile;
    return { x: Math.floor(ptr.worldX / T), y: Math.floor(ptr.worldY / T) };
  }

  private onPointerDown(ptr: Phaser.Input.Pointer): void {
    this.dragLast = { x: ptr.x, y: ptr.y };
    this.dragMoved = false;
    this.dragButton = ptr.button;
    this.hoverTile = this.tileAt(ptr);
    const tool = store.build.value;
    if (ptr.button === 2) {
      // Sağ tık: inşa aracını bırak (sürükleme kaydırma olarak devam eder).
      if (tool.kind !== 'none') store.build.value = { kind: 'none' };
      return;
    }
    if (ptr.button !== 0 || this.sim.mode !== 'manage') return;
    if (tool.kind === 'tile' || tool.kind === 'zone') this.dragStartTile = { ...this.hoverTile };
  }

  private onPointerMove(ptr: Phaser.Input.Pointer): void {
    this.hoverTile = this.tileAt(ptr);
    if (!this.dragLast || !ptr.isDown) return;
    const dx = ptr.x - this.dragLast.x;
    const dy = ptr.y - this.dragLast.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) this.dragMoved = true;
    const painting = this.dragStartTile !== null && this.dragButton === 0;
    const panAllowed = this.sim.mode === 'manage' && (this.dragButton === 2 || (this.dragButton === 0 && store.build.value.kind === 'none'));
    if (!painting && panAllowed) {
      const cam = this.cameras.main;
      cam.scrollX -= dx / cam.zoom;
      cam.scrollY -= dy / cam.zoom;
    }
    this.dragLast = { x: ptr.x, y: ptr.y };
  }

  private onPointerUp(ptr: Phaser.Input.Pointer): void {
    const tool = store.build.value;
    const start = this.dragStartTile;
    this.dragStartTile = null;
    const wasDrag = this.dragLast !== null;
    this.dragLast = null;
    if (!wasDrag) return;
    if (this.dragButton !== 0) return;
    const tile = this.tileAt(ptr);
    if (this.sim.mode === 'manage' && tool.kind !== 'none') {
      this.applyBuildTool(tool, start, tile);
      return;
    }
    if (!this.dragMoved) this.onClick(ptr);
  }

  private applyBuildTool(tool: Exclude<typeof store.build.value, { kind: 'none' }>, start: TilePos | null, end: TilePos): void {
    let r: { ok: boolean; message?: string } = { ok: false };
    const done = (res: { ok: boolean; message?: string }): void => {
      r = res;
      if (res.ok) audio.play(tool.kind === 'demolish' ? 'demolish' : tool.kind === 'zone' ? 'click' : 'build');
      else if (res.message) audio.play('error');
    };
    switch (tool.kind) {
      case 'building':
        done(this.sim.command({ type: 'placeBuilding', building: tool.type, x: end.x, y: end.y }));
        break;
      case 'demolish':
        done(this.sim.command({ type: 'demolish', x: end.x, y: end.y }));
        break;
      case 'tile':
        done(this.sim.command({ type: 'placeTiles', tool: tool.tool, tiles: lineTiles(start ?? end, end) }));
        break;
      case 'zone': {
        const s = start ?? end;
        done(this.sim.command({ type: 'paintZone', zone: tool.zone, x0: s.x, y0: s.y, x1: end.x, y1: end.y }));
        break;
      }
      default:
        break;
    }
    if (r.message) showToast(r.message);
  }

  /** Tıklama: köpek seç; boşluğa tıklayınca seçimi kaldır. */
  private onClick(ptr: Phaser.Input.Pointer): void {
    const T = GAME.tile;
    const wx = ptr.worldX / T;
    const wy = ptr.worldY / T;
    let best: Dog | null = null;
    let bestD = 1.1;
    for (const dog of this.sim.dogs) {
      const d = Math.hypot(dog.x - wx, dog.y - 0.2 - wy);
      if (d < bestD) {
        bestD = d;
        best = dog;
      }
    }
    if (best) {
      store.selectedDogId.value = best.id;
      store.panel.value = 'dog';
    } else if (store.panel.value === 'dog') {
      store.selectedDogId.value = null;
      store.panel.value = 'none';
    }
  }

  private focusTile(tile: { x: number; y: number }): void {
    if (this.sim.mode !== 'manage') this.sim.setMode('manage');
    const T = GAME.tile;
    this.cameras.main.pan((tile.x + 0.5) * T, (tile.y + 0.5) * T, 350, 'Sine.easeInOut');
  }

  // ---------------------------------------------------------------------------
  // İnşa hayaleti
  // ---------------------------------------------------------------------------

  private syncGhost(): void {
    const tool = store.build.value;
    const T = GAME.tile;
    this.ghostGfx.clear();
    if (this.sim.mode !== 'manage' || tool.kind === 'none') {
      this.ghostImage.setVisible(false);
      return;
    }
    const t = this.hoverTile;
    const start = this.dragStartTile ?? t;
    if (tool.kind === 'building') {
      const def = BUILDING_DEFS[tool.type];
      const ok = this.sim.money >= def.cost && canPlaceBuilding(this.sim.world, tool.type, t.x, t.y);
      this.ghostImage
        .setTexture(buildingTextureKey(tool.type, tool.type === 'bowl' ? 2 : 0))
        .setPosition(t.x * T, (t.y + def.h) * T)
        .setTint(ok ? GHOST_OK : GHOST_BAD)
        .setVisible(true);
      this.ghostGfx.lineStyle(1, ok ? GHOST_OK : GHOST_BAD, 0.9).strokeRect(t.x * T + 0.5, t.y * T + 0.5, def.w * T - 1, def.h * T - 1);
      return;
    }
    this.ghostImage.setVisible(false);
    if (tool.kind === 'demolish') {
      this.ghostGfx.fillStyle(0xff5050, 0.35).fillRect(t.x * T, t.y * T, T, T).lineStyle(1, 0xff5050, 1).strokeRect(t.x * T + 0.5, t.y * T + 0.5, T - 1, T - 1);
      return;
    }
    if (tool.kind === 'tile') {
      const color = tool.tool === 'path' ? 0xd1b283 : 0xf6d55c;
      for (const tile of lineTiles(start, t)) this.ghostGfx.fillStyle(color, 0.45).fillRect(tile.x * T, tile.y * T, T, T);
      return;
    }
    if (tool.kind === 'zone') {
      const color = tool.zone === Zone.None ? 0xffffff : (ZONE_COLORS[tool.zone] ?? 0xffffff);
      const x0 = Math.min(start.x, t.x);
      const y0 = Math.min(start.y, t.y);
      const w = Math.abs(t.x - start.x) + 1;
      const h = Math.abs(t.y - start.y) + 1;
      this.ghostGfx.fillStyle(color, 0.3).fillRect(x0 * T, y0 * T, w * T, h * T).lineStyle(1, color, 1).strokeRect(x0 * T + 0.5, y0 * T + 0.5, w * T - 1, h * T - 1);
    }
  }

  // ---------------------------------------------------------------------------
  // Varlık senkronu
  // ---------------------------------------------------------------------------

  private syncPlayerSprite(): void {
    const T = GAME.tile;
    const p = this.sim.player;
    const s = this.playerSprite;
    s.setPosition(Math.round(p.x * T), Math.round(p.y * T));
    s.setDepth(100 + p.y * T);
    if (p.moving && this.sim.mode === 'avatar' && !this.sim.paused) {
      s.anims.play(`player-walk-${p.facing}`, true);
      s.anims.timeScale = p.running ? 1.7 : 1;
    } else {
      s.anims.stop();
      s.setFrame(p.facing * 3);
    }
    this.busyBar.clear();
    if (p.busy > 0 && p.busyTotal > 0) {
      const w = 14;
      const x = Math.round(p.x * T) - w / 2;
      const y = Math.round(p.y * T) - 30;
      const t = 1 - p.busy / p.busyTotal;
      this.busyBar.fillStyle(0x24203a, 0.9).fillRect(x - 1, y - 1, w + 2, 4);
      this.busyBar.fillStyle(0xf6d55c, 1).fillRect(x, y, Math.round(w * t), 2);
    }
  }

  private syncDogs(): void {
    const T = GAME.tile;
    const seen = new Set<number>();
    for (const dog of this.sim.dogs) {
      seen.add(dog.id);
      const key = ensureDogTexture(this, dog.genome, dog.stage);
      let s = this.dogSprites.get(dog.id);
      if (!s) {
        s = this.add.sprite(0, 0, key, 0).setOrigin(0.5, 1);
        this.dogSprites.set(dog.id, s);
      } else if (s.texture.key !== key) {
        s.anims.stop();
        s.setTexture(key, 0);
      }
      const px = Math.round(dog.x * T);
      const py = Math.round(dog.y * T + 6);
      s.setPosition(px, py);
      s.setDepth(100 + py);
      const base = dog.facing * DOG_FRAMES;
      const walking = dog.moving || dog.state === 'play' || dog.state === 'playTogether';
      if (walking && !this.sim.paused) {
        s.anims.play(`${key}-walk-${dog.facing}`, true);
        s.anims.timeScale = Math.max(0.6, Math.min(3, this.sim.speed * 0.9));
      } else {
        s.anims.stop();
        let f = DOG_FRAME_IDLE;
        if (dog.state === 'sleep' || dog.state === 'lie') f = DOG_FRAME_LIE;
        else if (dog.state === 'sit' || dog.state === 'toilet' || dog.state === 'interact') f = DOG_FRAME_SIT;
        else if (dog.state === 'eat') f = DOG_FRAME_EAT;
        s.setFrame(base + f);
      }
    }
    for (const [id, s] of this.dogSprites) {
      if (!seen.has(id)) {
        s.destroy();
        this.dogSprites.delete(id);
      }
    }
  }

  private syncAdopters(): void {
    const T = GAME.tile;
    const seen = new Set<number>();
    for (const a of this.sim.adopters) {
      seen.add(a.id);
      const key = ensureHumanTexture(this, a.look);
      let s = this.adopterSprites.get(a.id);
      if (!s) {
        s = this.add.sprite(0, 0, key, 0).setOrigin(0.5, 1);
        this.adopterSprites.set(a.id, s);
      }
      const px = Math.round(a.x * T);
      const py = Math.round(a.y * T + 6);
      s.setPosition(px, py);
      s.setDepth(100 + py);
      if (a.moving && !this.sim.paused) {
        s.anims.play(`${key}-walk-${a.facing}`, true);
        s.anims.timeScale = Math.max(0.6, Math.min(3, this.sim.speed * 0.9));
      } else {
        s.anims.stop();
        s.setFrame(a.facing * 3);
      }
    }
    for (const [id, s] of this.adopterSprites) {
      if (!seen.has(id)) {
        s.destroy();
        this.adopterSprites.delete(id);
      }
    }
  }

  private syncStaff(): void {
    const T = GAME.tile;
    const seen = new Set<number>();
    for (const s of this.sim.staff) {
      if (s.state === 'offDuty') continue;
      seen.add(s.id);
      const key = ensureHumanTexture(this, s.look, s.role);
      let sp = this.staffSprites.get(s.id);
      if (!sp) {
        sp = this.add.sprite(0, 0, key, 0).setOrigin(0.5, 1);
        this.staffSprites.set(s.id, sp);
      }
      const px = Math.round(s.x * T);
      const py = Math.round(s.y * T + 6);
      sp.setPosition(px, py);
      sp.setDepth(100 + py);
      if (s.moving && !this.sim.paused) {
        sp.anims.play(`${key}-walk-${s.facing}`, true);
        sp.anims.timeScale = Math.max(0.6, Math.min(3, this.sim.speed * 0.9));
      } else {
        sp.anims.stop();
        sp.setFrame(s.facing * 3);
      }
      sp.setAlpha(s.state === 'working' ? 1 : s.state === 'resting' ? 0.85 : 1);
    }
    for (const [id, sp] of this.staffSprites) {
      if (!seen.has(id)) {
        sp.destroy();
        this.staffSprites.delete(id);
      }
    }
  }

  private addBuildingImage(b: Building): void {
    const T = GAME.tile;
    const def = buildingDef(b);
    const img = this.add.image(b.x * T, (b.y + def.h) * T, buildingTextureKey(b.type, this.buildingVariant(b))).setOrigin(0, 1);
    const solidRows = def.solidRows === 'all' ? def.h : Math.max(def.solidRows, 0.5);
    img.setDepth(100 + (b.y + solidRows) * T);
    if (!isReady(b)) img.setAlpha(0.45);
    this.buildingImages.set(b.id, img);
  }

  private buildingVariant(b: Building): number {
    if (b.type === 'trough') {
      if (b.water <= 0.01) return 0;
      return b.water >= this.sim.troughCapacity() * 0.5 ? 2 : 1;
    }
    if (b.type !== 'bowl') return 0;
    const cap = this.sim.bowlCapacity(b);
    if (b.food <= 0.01) return 0;
    return b.food >= cap * 0.6 ? 2 : 1;
  }

  private syncBuildings(): void {
    for (const b of this.sim.buildings) {
      const img = this.buildingImages.get(b.id);
      if (!img) continue;
      if (b.type === 'bowl' || b.type === 'trough') {
        const key = buildingTextureKey(b.type, this.buildingVariant(b));
        if (img.texture.key !== key) img.setTexture(key);
      }
      if (!isReady(b)) {
        const def = buildingDef(b);
        img.setAlpha(0.35 + 0.5 * (1 - b.buildLeft / Math.max(1, def.buildMinutes)));
      }
    }
  }

  private syncSelection(): void {
    const id = store.selectedDogId.value;
    const dog = id !== null ? this.sim.dogById(id) : undefined;
    if (!dog) {
      this.selectRing.setVisible(false);
      return;
    }
    const T = GAME.tile;
    const scale = dog.genome.size === 'L' ? 1.25 : dog.genome.size === 'S' ? 0.85 : 1;
    const stage = dog.stage === 'puppy' ? 0.6 : dog.stage === 'young' ? 0.8 : 1;
    this.selectRing.setVisible(true);
    this.selectRing.setPosition(Math.round(dog.x * T), Math.round(dog.y * T + 6));
    this.selectRing.setSize(22 * scale * stage, 11 * scale * stage);
  }

  // ---------------------------------------------------------------------------
  // Kamera, su, gece, kareler
  // ---------------------------------------------------------------------------

  private panCamera(dt: number, input: PlayerInput): void {
    const cam = this.cameras.main;
    const v = (BALANCE.camera.panSpeed / cam.zoom) * dt;
    cam.scrollX += input.dx * v;
    cam.scrollY += input.dy * v;
  }

  private updateZoom(dt: number): void {
    const cam = this.cameras.main;
    if (Math.abs(cam.zoom - this.zoomTarget) < 0.002) return;
    cam.setZoom(cam.zoom + (this.zoomTarget - cam.zoom) * Math.min(1, dt * 10));
  }

  private updateWater(dt: number): void {
    if (this.sim.paused) return;
    this.waterTimer += dt;
    if (this.waterTimer < 0.55) return;
    this.waterTimer = 0;
    this.waterFrame = this.waterFrame === 0 ? 1 : 0;
    this.tileset.setImage(this.textures.get(this.waterFrame === 0 ? TEX.tiles0 : TEX.tiles1));
  }

  private updateNight(): void {
    const [tr, tg, tb] = this.sim.clock.tint();
    const [sr, sg, sb] = SEASON_TINT[this.sim.weatherSys.season];
    const w = this.sim.weatherSys.weather;
    const cloud = w === 'storm' ? 0.72 : w === 'rain' ? 0.84 : w === 'cloudy' || w === 'snow' ? 0.92 : 1;
    const r = Math.min(1, tr * sr * cloud);
    const g = Math.min(1, tg * sg * cloud);
    const b = Math.min(1, tb * sb * (w === 'storm' || w === 'rain' ? 1 : cloud));
    const color = Phaser.Display.Color.GetColor(Math.round(r * 255), Math.round(g * 255), Math.round(b * 255));
    const v = this.cameras.main.worldView;
    const T = GAME.tile;
    this.updateWeatherFx(v);
    const dark = r < 0.85;
    const lamps = dark ? this.sim.buildings.filter((b) => b.type === 'lamp' && isReady(b)) : [];
    if (lamps.length === 0 || v.width > 1400 || v.height > 800) {
      this.lightMap.setVisible(false);
      this.nightRect.setFillStyle(color);
      this.nightRect.setPosition(v.x - 8, v.y - 8);
      this.nightRect.setSize(v.width + 16, v.height + 16);
      this.nightRect.setVisible(color !== 0xffffff);
      return;
    }
    // Lambalar: gece haritasına ışık delikleri.
    this.nightRect.setVisible(false);
    const ox = Math.floor(v.x - 8);
    const oy = Math.floor(v.y - 8);
    this.lightMap.setPosition(ox, oy).setVisible(true);
    this.lightMap.clear();
    this.lightMap.fill(color, 1, 0, 0, 1400, 800);
    for (const l of lamps) {
      const lx = (l.x + 0.5) * T - ox;
      const ly = (l.y + 0.3) * T - oy;
      this.lightMap.erase('light', lx - 48, ly - 48);
    }
  }

  /** Yağmur/kar parçacıkları görüş alanının üstünden düşer. */
  private updateWeatherFx(v: Phaser.Geom.Rectangle): void {
    const w = this.sim.weatherSys.weather;
    const raining = (w === 'rain' || w === 'storm') && !this.sim.paused;
    const snowing = w === 'snow' && !this.sim.paused;
    this.weatherZone.width = v.width + 80;
    this.rain.setPosition(v.x - 40, v.y - 12);
    this.snow.setPosition(v.x - 40, v.y - 12);
    this.rain.emitting = raining;
    this.rain.frequency = w === 'storm' ? 10 : 28;
    this.snow.emitting = snowing;
  }

  /** Adım sesleri; havlama durumuna giren köpek bir kez ses çıkarır; vahşi ve oynayan köpekler arada havlar. */
  private updateSounds(dt: number): void {
    const p = this.sim.player;
    if (p.moving && this.sim.mode === 'avatar' && !this.sim.paused) {
      this.stepTimer -= dt * (p.running ? 1.5 : 1);
      if (this.stepTimer <= 0) {
        this.stepTimer = 0.3;
        audio.play('step', { pitch: 0.9 + Math.random() * 0.2, volume: 0.7 }, 0);
      }
    } else this.stepTimer = 0;
    if (this.sim.paused) return;
    const v = this.cameras.main.worldView;
    const T = GAME.tile;
    const visible = (d: Dog): boolean => {
      const px = d.x * T;
      const py = d.y * T;
      return px >= v.x && py >= v.y && px <= v.right && py <= v.bottom;
    };
    const pitchOf = (d: Dog): number => (d.genome.size === 'S' ? 1.5 : d.genome.size === 'L' ? 0.75 : 1) * (d.stage === 'puppy' ? 1.4 : 1);
    for (const d of this.sim.dogs) {
      if (d.state !== 'bark') {
        this.barkSeen.delete(d.id);
        continue;
      }
      if (this.barkSeen.has(d.id)) continue;
      this.barkSeen.add(d.id);
      if (!visible(d)) continue;
      if (d.needs.hunger <= BALANCE.dogs.social.barkHungerAbove && Math.random() < 0.5) audio.play('whine', { pitch: pitchOf(d), volume: 0.6 });
      else audio.play('bark', { pitch: pitchOf(d), volume: 0.7 });
    }
    this.barkTimer -= dt;
    if (this.barkTimer > 0) return;
    this.barkTimer = 6 + Math.random() * 8;
    const candidates = this.sim.dogs.filter((d) => visible(d) && (d.state === 'play' || d.state === 'playTogether' || (d.wild && !d.following)));
    if (candidates.length === 0) return;
    const d = candidates[Math.floor(Math.random() * candidates.length)];
    audio.play('bark', { pitch: pitchOf(d), volume: 0.6 });
  }

  /** Nesne katmanı (alt) ve üst katman için tile indeksleri. */
  private objectTiles(x: number, y: number): [number, number] {
    const world = this.sim.world;
    const o = world.objectAt(x, y);
    if (o === Obj.None) return [-1, -1];
    const info = OBJ_INFO[o];
    const idx = objTileIndex(o, o === Obj.Fence ? world.fenceMask(x, y) : 0);
    return info.above ? [-1, idx] : [idx, -1];
  }

  private applyDirtyTiles(): void {
    const world = this.sim.world;
    if (world.dirty.length === 0) return;
    for (const i of world.takeDirty()) {
      const x = i % world.width;
      const y = Math.floor(i / world.width);
      this.groundLayer.putTileAt(world.ground[i], x, y);
      const [o, a] = this.objectTiles(x, y);
      if (o >= 0) this.objectLayer.putTileAt(o, x, y);
      else this.objectLayer.removeTileAt(x, y);
      if (a >= 0) this.aboveLayer.putTileAt(a, x, y);
      else this.aboveLayer.removeTileAt(x, y);
      const z = world.zone[i];
      if (z !== Zone.None) this.zoneLayer.putTileAt(ZONE_TILE_BASE + z, x, y);
      else this.zoneLayer.removeTileAt(x, y);
    }
  }

  private applyMode(mode: Mode): void {
    const cam = this.cameras.main;
    if (mode === 'manage') {
      cam.stopFollow();
      this.zoomTarget = BALANCE.camera.manageZoom;
    } else {
      cam.startFollow(this.playerSprite, true, 0.2, 0.2);
      this.zoomTarget = BALANCE.camera.avatarZoom;
      store.build.value = { kind: 'none' };
      store.buildBar.value = false;
    }
    this.zoneLayer.setVisible(mode === 'manage');
    store.mode.value = mode;
  }
}

/** Sürükleme çizgisi: baskın eksende düz çizgi (Prison Architect çit çekme gibi). */
function lineTiles(a: TilePos, b: TilePos): TilePos[] {
  const out: TilePos[] = [];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    const s = Math.sign(dx) || 1;
    for (let x = a.x; s > 0 ? x <= b.x : x >= b.x; x += s) out.push({ x, y: a.y });
  } else {
    const s = Math.sign(dy) || 1;
    for (let y = a.y; s > 0 ? y <= b.y : y >= b.y; y += s) out.push({ x: a.x, y });
  }
  return out;
}

function must<T>(v: T | null | undefined): T {
  if (v === null || v === undefined) throw new Error('Beklenen nesne oluşturulamadı');
  return v;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
