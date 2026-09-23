import { BALANCE } from '../../config/balance';
import { buildingDef, buildingDoorTile } from '../entities/Building';
import { IDLE_INPUT, type PlayerInput } from '../entities/Player';
import { findPath } from '../world/Pathfinder';
import type { TilePos } from '../world/TileWorld';
import type { Sim } from '../Sim';
import { performAction, resolveAction } from './Interaction';
import { t } from '../../i18n';

/** Dokun-git hedefi: boş kare ya da etkileşilecek şey (köpek, bina, yuva/çalı/pislik). */
export type NavGoal =
  | { kind: 'tile'; tile: TilePos }
  | { kind: 'dog'; id: number }
  | { kind: 'building'; id: number }
  /** Binanın kapı karesine dokunuş (0.17.0): kapı önüne yürü, E yerine içeri gir. */
  | { kind: 'enter'; id: number }
  | { kind: 'object'; tile: TilePos };

interface Target {
  /** Yürünecek kare. */
  tile: TilePos;
  /** Varınca dönülecek nokta (kare biriminde); boş kare hedefinde yok. */
  face: { x: number; y: number } | null;
}

/**
 * Oyuncu için yol takibi (dokunmatik "dokun-git"). Her karede PlayerInput üretir; yürüme, çarpışma ve
 * bakış mantığı Player.update'te kalır. Etkileşim hedefine varınca hedefe döner ve E yapar;
 * sonuç 'interacted' olayıyla render katmanına (ses, panel) iletilir. Phaser'sız, test edilebilir.
 */
export class PlayerNav {
  path: TilePos[] = [];
  goal: NavGoal | null = null;
  private stuckSec = 0;
  private lastX = 0;
  private lastY = 0;
  private replans = 0;
  /** Sıradaki düğüme son karedeki uzaklık; -1 = yeni düğüm. Salınım tespiti için. */
  private nodeDist = -1;

  constructor(private readonly sim: Sim) {}

  get active(): boolean {
    return this.goal !== null;
  }

  cancel(): void {
    this.goal = null;
    this.path = [];
    this.stuckSec = 0;
    this.replans = 0;
    this.nodeDist = -1;
  }

  /** Kareye yürü; kare geçilmezse yanına. Yol yoksa false ve mesaj. */
  goTo(tile: TilePos): boolean {
    return this.start({ kind: 'tile', tile });
  }

  /** Köpek/bina/nesnenin yanına git, ona dönüp E yap. */
  goInteract(goal: NavGoal): boolean {
    return this.start(goal);
  }

  /** Hedefin varış karesi: etkileşim hedeflerinde oyuncuya en yakın yürünebilir 4-komşu (E'nin baktığı kare hedef olsun). */
  private resolveTarget(goal: NavGoal): Target | null {
    const sim = this.sim;
    const w = sim.playerWorld;
    const p = sim.player;
    if (goal.kind === 'tile') return { tile: goal.tile, face: null };
    let anchor: TilePos;
    let face: { x: number; y: number };
    if (goal.kind === 'dog') {
      const d = sim.dogById(goal.id);
      if (!d) return null;
      anchor = { x: d.tileX, y: d.tileY };
      face = { x: d.x, y: d.y - 0.3 };
    } else if (goal.kind === 'building' || goal.kind === 'enter') {
      const b = sim.buildingById(goal.id);
      if (!b) return null;
      const def = buildingDef(b);
      if (def.solidRows === 'all' || def.solidRows > 0) {
        // Katı bina: kapı önü (alt orta karenin altı); yukarı bakınca binaya bakar.
        const door = buildingDoorTile(b);
        return { tile: door, face: { x: door.x + 0.5, y: door.y - 0.5 } };
      }
      anchor = { x: b.x, y: b.y };
      face = { x: b.x + 0.5, y: b.y + 0.5 };
    } else {
      anchor = goal.tile;
      face = { x: goal.tile.x + 0.5, y: goal.tile.y + 0.5 };
    }
    const cands: TilePos[] = [
      { x: anchor.x, y: anchor.y + 1 },
      { x: anchor.x - 1, y: anchor.y },
      { x: anchor.x + 1, y: anchor.y },
      { x: anchor.x, y: anchor.y - 1 },
    ].filter((c) => w.inBounds(c.x, c.y) && !w.isSolid(c.x, c.y));
    cands.sort((a, b) => Math.hypot(a.x + 0.5 - p.x, a.y + 0.5 - p.y) - Math.hypot(b.x + 0.5 - p.x, b.y + 0.5 - p.y));
    return { tile: cands[0] ?? anchor, face };
  }

  private start(goal: NavGoal): boolean {
    const sim = this.sim;
    const target = this.resolveTarget(goal);
    if (!target) return false;
    const from = { x: sim.player.tileX, y: sim.player.tileY };
    const path = this.plan(from, target.tile, goal.kind === 'tile');
    if (!path) {
      this.cancel();
      sim.events.emit('message', t('Oraya yol yok'));
      return false;
    }
    this.goal = goal;
    this.path = path;
    this.stuckSec = 0;
    this.replans = 0;
    this.nodeDist = -1;
    this.lastX = sim.player.x;
    this.lastY = sim.player.y;
    if (path.length === 0) this.arrive();
    return true;
  }

  /** Önce arsa içi (ucuz), olmazsa tüm harita. */
  private plan(from: TilePos, to: TilePos, adjacentOk: boolean): TilePos[] | null {
    const w = this.sim.playerWorld;
    const N = BALANCE.nav;
    if (from.x === to.x && from.y === to.y) return [];
    if (w.inPlotInterior(from.x, from.y) && w.inPlotInterior(to.x, to.y)) {
      const p = findPath(w, from, to, { region: w.plotInterior(), maxNodes: N.plotMaxNodes, adjacentOk });
      if (p) return p;
    }
    return findPath(w, from, to, { maxNodes: N.maxNodes, adjacentOk, throughGates: true });
  }

  /** Bu karedeki girdi: sıradaki kareye doğru -1/0/1; yol bitince varış işlenir. */
  inputFor(dtSec: number, run: boolean): PlayerInput {
    const p = this.sim.player;
    if (!this.goal) return IDLE_INPUT;
    if (p.busy > 0) return IDLE_INPUT;
    const N = BALANCE.nav;
    let moved = 0;
    if (this.path.length > 0) {
      moved = Math.hypot(p.x - this.lastX, p.y - this.lastY);
      this.lastX = p.x;
      this.lastY = p.y;
      if (moved < 0.005) {
        this.stuckSec += dtSec;
        if (this.stuckSec > N.stuckSeconds) {
          this.stuckSec = 0;
          if (!this.replan()) return IDLE_INPUT;
        }
      } else this.stuckSec = 0;
    }
    while (this.path.length > 0) {
      const n = this.path[0];
      const tx = n.x + 0.5;
      const ty = n.y + 0.7; // ayak noktası: tileY = floor(y - 0.2) → n.y
      const ex = tx - p.x;
      const ey = ty - p.y;
      const dist = Math.hypot(ex, ey);
      if (dist < N.arriveDist) {
        this.path.shift();
        this.nodeDist = -1;
        continue;
      }
      // Kare başına adım varış yarıçapını aşınca (düşük kare hızı, koşu) düğüm çevresinde salınım olur: hareket ettiği
      // hâlde düğüme yaklaşamıyorsa geçilmiş say. Hiç hareket yoksa yukarıdaki takılma mantığı (yeniden planla) devreye girer.
      if (moved >= 0.005 && this.nodeDist >= 0 && dist >= this.nodeDist - 1e-6) {
        this.path.shift();
        this.nodeDist = -1;
        continue;
      }
      this.nodeDist = dist;
      const dx = Math.abs(ex) > N.axisDead ? Math.sign(ex) : 0;
      const dy = Math.abs(ey) > N.axisDead ? Math.sign(ey) : 0;
      if (dx === 0 && dy === 0) {
        this.path.shift();
        continue;
      }
      return { dx, dy, run };
    }
    this.arrive();
    return IDLE_INPUT;
  }

  private replan(): boolean {
    const sim = this.sim;
    if (!this.goal || this.replans >= BALANCE.nav.maxReplans) {
      this.cancel();
      sim.events.emit('message', t('Yol tıkalı'));
      return false;
    }
    this.replans++;
    const target = this.resolveTarget(this.goal);
    const p = sim.player;
    const path = target ? this.plan({ x: p.tileX, y: p.tileY }, target.tile, this.goal.kind === 'tile') : null;
    if (!path) {
      this.cancel();
      sim.events.emit('message', t('Oraya yol yok'));
      return false;
    }
    this.path = path;
    this.nodeDist = -1;
    return true;
  }

  /** Vardı: etkileşim hedefiyse ona dönüp E yapar. Köpek uzaklaştıysa sınırlı sayıda yeniden yaklaşır. */
  private arrive(): void {
    const sim = this.sim;
    const goal = this.goal;
    this.path = [];
    if (!goal || goal.kind === 'tile') {
      this.goal = null;
      return;
    }
    const target = this.resolveTarget(goal);
    if (!target || !target.face) {
      this.goal = null;
      return;
    }
    const p = sim.player;
    if (goal.kind === 'dog') {
      const d = sim.dogById(goal.id);
      if (d && Math.hypot(d.x - p.x, d.y - 0.3 - (p.y - 0.2)) > BALANCE.nav.reachDist && this.replans < BALANCE.nav.maxReplans) {
        this.replans++;
        const path = this.plan({ x: p.tileX, y: p.tileY }, target.tile, false);
        if (path && path.length > 0) {
          this.path = path;
          this.nodeDist = -1;
          return;
        }
      }
    }
    this.goal = null;
    if (p.busy > 0) {
      // Zaten hedefin dibinde ve bir iş sürüyor: E yutulurdu, sessiz kalmasın.
      sim.events.emit('message', t('Şu an meşgul'));
      return;
    }
    p.faceToward(target.face.x, target.face.y);
    if (goal.kind === 'enter') {
      const result = sim.enterBuilding(goal.id);
      sim.events.emit('interacted', { kind: 'enter', result });
      return;
    }
    const kind = resolveAction(sim).kind;
    const result = performAction(sim);
    sim.events.emit('interacted', { kind, result });
  }
}
