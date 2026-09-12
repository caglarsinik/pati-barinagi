import Phaser from 'phaser';
import { BALANCE } from '../config/balance';
import { GAME } from '../config/game';
import { BUILDING_OVERHANG } from '../render/BuildingArt';
import { DOG_FRAMES, DOG_FRAME_EAT, DOG_FRAME_IDLE, DOG_FRAME_LIE, DOG_FRAME_SIT } from '../render/DogPainter';
import { TEX, buildingTextureKey, ensureDogTexture } from '../render/TextureRegistry';
import { type Building, buildingDef } from '../sim/entities/Building';
import type { Dog } from '../sim/entities/Dog';
import type { PlayerInput } from '../sim/entities/Player';
import type { Mode, Sim } from '../sim/Sim';
import type { Tool } from '../sim/systems/Interaction';
import { OBJ_INFO, Obj, ZONE_TILE_BASE, Zone, objTileIndex } from '../sim/world/tiles';
import { showToast, store, syncStore } from '../ui/store';

type KeyName =
  | 'W' | 'A' | 'S' | 'D' | 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'SHIFT' | 'E' | 'I' | 'TAB' | 'SPACE' | 'ESC'
  | 'PLUS' | 'MINUS' | 'NUMPAD_ADD' | 'NUMPAD_SUBTRACT' | 'ONE' | 'TWO' | 'THREE' | 'FOUR' | 'FIVE';
type Keys = Record<KeyName, Phaser.Input.Keyboard.Key>;

const KEY_LIST: KeyName[] = [
  'W', 'A', 'S', 'D', 'UP', 'DOWN', 'LEFT', 'RIGHT', 'SHIFT', 'E', 'I', 'TAB', 'SPACE', 'ESC',
  'PLUS', 'MINUS', 'NUMPAD_ADD', 'NUMPAD_SUBTRACT', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE',
];

const TOOL_KEYS: Array<[KeyName, Tool]> = [
  ['ONE', 'pet'],
  ['TWO', 'play'],
  ['THREE', 'train'],
  ['FOUR', 'feed'],
  ['FIVE', 'clean'],
];

export interface WorldSceneData {
  sim: Sim;
}

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
  private keys!: Keys;
  private zoomTarget: number = BALANCE.camera.avatarZoom;
  private waterTimer = 0;
  private waterFrame: 0 | 1 = 0;
  private syncTimer = 0;
  private dragLast: { x: number; y: number } | null = null;
  private dragMoved = false;
  private unsub: Array<() => void> = [];
  private buildingImages = new Map<number, Phaser.GameObjects.Image>();
  private dogSprites = new Map<number, Phaser.GameObjects.Sprite>();

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
      this.sim.events.on('dogRemoved', (id) => {
        this.dogSprites.get(id)?.destroy();
        this.dogSprites.delete(id);
        if (store.selectedDogId.value === id) store.selectedDogId.value = null;
      }),
      this.sim.events.on('modeChanged', (m) => this.applyMode(m)),
    );

    // --- Oyuncu ---
    const p = this.sim.player;
    this.playerSprite = this.add.sprite(Math.round(p.x * T), Math.round(p.y * T), TEX.player, 0).setOrigin(0.5, 1);
    this.busyBar = this.add.graphics().setDepth(7000);

    // --- Seçim halkası ---
    this.selectRing = this.add.ellipse(0, 0, 22, 11).setStrokeStyle(1.5, 0xf6d55c, 0.95).setDepth(60).setVisible(false);

    // --- Kamera ---
    const cam = this.cameras.main;
    cam.setBounds(0, 0, world.width * T, world.height * T);
    cam.roundPixels = true;
    cam.setZoom(this.sim.mode === 'avatar' ? BALANCE.camera.avatarZoom : BALANCE.camera.manageZoom);

    // --- Gece örtüsü ---
    this.nightRect = this.add
      .rectangle(0, 0, 64, 64, 0xffffff)
      .setOrigin(0, 0)
      .setDepth(8000)
      .setBlendMode(Phaser.BlendModes.MULTIPLY);

    // --- Girdi ---
    const kb = this.input.keyboard;
    if (!kb) throw new Error('Klavye eklentisi yok');
    this.keys = kb.addKeys(KEY_LIST.join(',')) as Keys;
    kb.addCapture(['TAB', 'SPACE']);

    this.input.on('wheel', (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      const f = dy > 0 ? 1 / 1.15 : 1.15;
      this.zoomTarget = clamp(this.zoomTarget * f, BALANCE.camera.minZoom, BALANCE.camera.maxZoom);
    });
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      this.dragLast = { x: ptr.x, y: ptr.y };
      this.dragMoved = false;
    });
    this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      if (!this.dragLast || !ptr.isDown) return;
      const dx = ptr.x - this.dragLast.x;
      const dy = ptr.y - this.dragLast.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) this.dragMoved = true;
      if (this.sim.mode === 'manage') {
        const cam2 = this.cameras.main;
        cam2.scrollX -= dx / cam2.zoom;
        cam2.scrollY -= dy / cam2.zoom;
      }
      this.dragLast = { x: ptr.x, y: ptr.y };
    });
    this.input.on('pointerup', (ptr: Phaser.Input.Pointer) => {
      if (this.dragLast && !this.dragMoved) this.onClick(ptr);
      this.dragLast = null;
    });

    this.game.events.on('ui:focus-tile', this.focusTile, this);
    this.applyMode(this.sim.mode);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const u of this.unsub) u();
      this.unsub = [];
      this.dragLast = null;
      this.game.events.off('ui:focus-tile', this.focusTile, this);
      this.buildingImages.clear();
      this.dogSprites.clear();
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
    this.syncBuildings();
    this.syncSelection();
    if (this.sim.mode === 'manage') this.panCamera(dt, input);
    this.updateZoom(dt);
    this.updateWater(dt);
    this.updateNight();
    this.applyDirtyTiles();
    this.syncTimer += dt;
    if (this.syncTimer >= 0.1) {
      this.syncTimer = 0;
      syncStore(this.sim);
    }
  }

  // ---------------------------------------------------------------------------
  // Girdi
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
    if (JustDown(k.TAB)) this.sim.toggleMode();
    if (JustDown(k.SPACE)) this.sim.togglePause();
    if (JustDown(k.PLUS) || JustDown(k.NUMPAD_ADD)) this.sim.changeSpeed(1);
    if (JustDown(k.MINUS) || JustDown(k.NUMPAD_SUBTRACT)) this.sim.changeSpeed(-1);
    if (JustDown(k.I)) store.panel.value = store.panel.value === 'dogs' ? 'none' : 'dogs';
    for (const [key, tool] of TOOL_KEYS) if (JustDown(k[key])) this.sim.command({ type: 'setTool', tool });
    if (JustDown(k.E) && this.sim.mode === 'avatar' && !this.sim.paused) this.interact();
  }

  private interact(): void {
    const r = this.sim.command({ type: 'interact' });
    if (r.message) showToast(r.message);
    if (r.open === 'shed' && r.building) {
      store.panelBuildingId.value = r.building.id;
      store.panel.value = 'shed';
    } else if (r.open === 'kennel' && r.building) {
      store.panelBuildingId.value = r.building.id;
      store.panel.value = 'kennel';
    } else if (r.open === 'incubator') {
      showToast('Kuluçka: yumurtalar bir sonraki sürümde');
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
      const walking = dog.moving || dog.state === 'play';
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

  private addBuildingImage(b: Building): void {
    const T = GAME.tile;
    const def = buildingDef(b);
    const img = this.add.image(b.x * T, (b.y + def.h) * T, buildingTextureKey(b.type, this.buildingVariant(b))).setOrigin(0, 1);
    const solidRows = def.solidRows === 'all' ? def.h : Math.max(def.solidRows, 0.5);
    img.setDepth(100 + (b.y + solidRows) * T);
    this.buildingImages.set(b.id, img);
    void BUILDING_OVERHANG;
  }

  private buildingVariant(b: Building): number {
    if (b.type !== 'bowl') return 0;
    const cap = buildingDef(b).foodCapacity ?? 4;
    if (b.food <= 0.01) return 0;
    return b.food >= cap * 0.6 ? 2 : 1;
  }

  private syncBuildings(): void {
    for (const b of this.sim.buildings) {
      if (b.type !== 'bowl') continue;
      const img = this.buildingImages.get(b.id);
      if (!img) continue;
      const key = buildingTextureKey(b.type, this.buildingVariant(b));
      if (img.texture.key !== key) img.setTexture(key);
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
    const [r, g, b] = this.sim.clock.tint();
    const color = Phaser.Display.Color.GetColor(Math.round(r * 255), Math.round(g * 255), Math.round(b * 255));
    const v = this.cameras.main.worldView;
    this.nightRect.setFillStyle(color);
    this.nightRect.setPosition(v.x - 8, v.y - 8);
    this.nightRect.setSize(v.width + 16, v.height + 16);
    this.nightRect.setVisible(color !== 0xffffff);
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
    }
    this.zoneLayer.setVisible(mode === 'manage');
    store.mode.value = mode;
  }
}

function must<T>(v: T | null | undefined): T {
  if (v === null || v === undefined) throw new Error('Beklenen nesne oluşturulamadı');
  return v;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
