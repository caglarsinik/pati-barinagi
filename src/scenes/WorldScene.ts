import Phaser from 'phaser';
import { BALANCE } from '../config/balance';
import { GAME } from '../config/game';
import { TEX } from '../render/TextureRegistry';
import type { PlayerInput } from '../sim/entities/Player';
import type { Mode, Sim } from '../sim/Sim';
import { OBJ_INFO, OBJ_TILE_OFFSET, Obj } from '../sim/world/tiles';
import { store, syncStore } from '../ui/store';

type KeyName =
  | 'W'
  | 'A'
  | 'S'
  | 'D'
  | 'UP'
  | 'DOWN'
  | 'LEFT'
  | 'RIGHT'
  | 'SHIFT'
  | 'E'
  | 'TAB'
  | 'SPACE'
  | 'ESC'
  | 'PLUS'
  | 'MINUS'
  | 'NUMPAD_ADD'
  | 'NUMPAD_SUBTRACT';
type Keys = Record<KeyName, Phaser.Input.Keyboard.Key>;

const KEY_LIST: KeyName[] = [
  'W', 'A', 'S', 'D', 'UP', 'DOWN', 'LEFT', 'RIGHT', 'SHIFT', 'E', 'TAB', 'SPACE', 'ESC',
  'PLUS', 'MINUS', 'NUMPAD_ADD', 'NUMPAD_SUBTRACT',
];

export interface WorldSceneData {
  sim: Sim;
}

/** Dünyayı çizer ve girdiyi sim'e taşır. Oyun mantığı burada değil, Sim içindedir. */
export class WorldScene extends Phaser.Scene {
  private sim!: Sim;
  private tileset!: Phaser.Tilemaps.Tileset;
  private groundLayer!: Phaser.Tilemaps.TilemapLayer;
  private objectLayer!: Phaser.Tilemaps.TilemapLayer;
  private aboveLayer!: Phaser.Tilemaps.TilemapLayer;
  private playerSprite!: Phaser.GameObjects.Sprite;
  private nightRect!: Phaser.GameObjects.Rectangle;
  private keys!: Keys;
  private zoomTarget: number = BALANCE.camera.avatarZoom;
  private waterTimer = 0;
  private waterFrame: 0 | 1 = 0;
  private syncTimer = 0;
  private dragLast: { x: number; y: number } | null = null;
  private unsub: Array<() => void> = [];

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
    this.objectLayer = must(map.createBlankLayer('objects', tileset)).setDepth(1);
    this.aboveLayer = must(map.createBlankLayer('above', tileset)).setDepth(5000);

    const ground: number[][] = [];
    const objects: number[][] = [];
    const above: number[][] = [];
    for (let y = 0; y < world.height; y++) {
      const gRow: number[] = [];
      const oRow: number[] = [];
      const aRow: number[] = [];
      for (let x = 0; x < world.width; x++) {
        const i = world.idx(x, y);
        gRow.push(world.ground[i]);
        const o = world.object[i] as Obj;
        const info = OBJ_INFO[o];
        oRow.push(o !== Obj.None && !info.above ? OBJ_TILE_OFFSET + o : -1);
        aRow.push(o !== Obj.None && info.above ? OBJ_TILE_OFFSET + o : -1);
      }
      ground.push(gRow);
      objects.push(oRow);
      above.push(aRow);
    }
    this.groundLayer.putTilesAt(ground, 0, 0, false);
    this.objectLayer.putTilesAt(objects, 0, 0, false);
    this.aboveLayer.putTilesAt(above, 0, 0, false);

    // --- Oyuncu ---
    const p = this.sim.player;
    this.playerSprite = this.add.sprite(Math.round(p.x * T), Math.round(p.y * T), TEX.player, 0).setOrigin(0.5, 1);

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
      if (this.sim.mode === 'manage') this.dragLast = { x: ptr.x, y: ptr.y };
    });
    this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      if (!this.dragLast || !ptr.isDown) return;
      const cam2 = this.cameras.main;
      cam2.scrollX -= (ptr.x - this.dragLast.x) / cam2.zoom;
      cam2.scrollY -= (ptr.y - this.dragLast.y) / cam2.zoom;
      this.dragLast = { x: ptr.x, y: ptr.y };
    });
    this.input.on('pointerup', () => {
      this.dragLast = null;
    });

    this.unsub.push(this.sim.events.on('modeChanged', (m) => this.applyMode(m)));
    this.applyMode(this.sim.mode);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const u of this.unsub) u();
      this.unsub = [];
      this.dragLast = null;
    });

    syncStore(this.sim);
  }

  override update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.05);
    this.handleHotkeys();
    const input = this.readInput();
    this.sim.update(dt, input);
    this.syncPlayerSprite();
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

  private handleHotkeys(): void {
    const k = this.keys;
    const JustDown = Phaser.Input.Keyboard.JustDown;
    if (JustDown(k.ESC)) {
      this.game.events.emit('ui:escape');
      return;
    }
    if (store.pauseMenu.value) return;
    if (JustDown(k.TAB)) this.sim.toggleMode();
    if (JustDown(k.SPACE)) this.sim.togglePause();
    if (JustDown(k.PLUS) || JustDown(k.NUMPAD_ADD)) this.sim.changeSpeed(1);
    if (JustDown(k.MINUS) || JustDown(k.NUMPAD_SUBTRACT)) this.sim.changeSpeed(-1);
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
  }

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

  private applyDirtyTiles(): void {
    const world = this.sim.world;
    if (world.dirty.length === 0) return;
    for (const i of world.takeDirty()) {
      const x = i % world.width;
      const y = Math.floor(i / world.width);
      this.groundLayer.putTileAt(world.ground[i], x, y);
      const o = world.object[i] as Obj;
      const info = OBJ_INFO[o];
      if (o !== Obj.None && !info.above) this.objectLayer.putTileAt(OBJ_TILE_OFFSET + o, x, y);
      else this.objectLayer.removeTileAt(x, y);
      if (o !== Obj.None && info.above) this.aboveLayer.putTileAt(OBJ_TILE_OFFSET + o, x, y);
      else this.aboveLayer.removeTileAt(x, y);
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
