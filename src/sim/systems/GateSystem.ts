import { BALANCE } from '../../config/balance';
import type { Sim } from '../Sim';
import type { TilePos } from '../world/TileWorld';
import { Obj } from '../world/tiles';
import { gateGroups } from '../world/gates';

interface GateActor {
  x: number;
  y: number;
  /** Kapıyı açabilir mi. Serbest köpek açamaz ama kapıdayken kapanmasını engeller. */
  allowed: boolean;
  /** Kapladığı kareler (kare indeksi). */
  tiles: number[];
}

/**
 * Otomatik çit kapısı: izinli bir aktör (oyuncu, personel, sahiplenici, tasmalı ya da peşten gelen köpek)
 * yaklaşınca açılır; kimse kalmayınca kısa gecikmeyle kapanır. Kapıda duran biri varken asla kapanmaz.
 * Gerçek saniyeyle çalışır (oyuncu gerçek zamanda hareket eder); açık durum kayda yazılmaz.
 */
export class GateSystem {
  private groups: TilePos[][] = [];
  private groupIdx: Set<number>[] = [];
  private timers: number[] = [];
  private version = -1;

  constructor(private readonly sim: Sim) {}

  get groupCount(): number {
    if (this.sim.world.gateVersion !== this.version) this.rebuild();
    return this.groups.length;
  }

  update(dtSec: number): void {
    const w = this.sim.world;
    if (w.gateVersion !== this.version) this.rebuild();
    if (this.groups.length === 0) return;
    const actors = this.collectActors();
    const G = BALANCE.gates;
    for (let k = 0; k < this.groups.length; k++) {
      const group = this.groups[k];
      const idx = this.groupIdx[k];
      let near = false;
      let occupied = false;
      for (const a of actors) {
        if (!occupied && a.tiles.some((i) => idx.has(i))) occupied = true;
        if (!near && a.allowed) {
          for (const t of group) {
            if (Math.hypot(a.x - (t.x + 0.5), a.y - (t.y + 0.5)) <= G.openRadius) {
              near = true;
              break;
            }
          }
        }
        if (near && occupied) break;
      }
      const wasOpen = w.isGateOpen(group[0].x, group[0].y);
      if (near || occupied) {
        this.timers[k] = G.closeDelaySec;
        if (!wasOpen) this.setOpen(group, true);
      } else if (wasOpen) {
        this.timers[k] -= dtSec;
        if (this.timers[k] <= 0) this.setOpen(group, false);
      }
    }
  }

  /** Check each path tile before crossing, including large simulation steps. */
  canEnter(tile: TilePos): boolean {
    const w = this.sim.world;
    if (w.objectAt(tile.x, tile.y) !== Obj.Gate) return true;
    this.update(0);
    return w.isGateOpen(tile.x, tile.y);
  }

  private setOpen(group: TilePos[], open: boolean): void {
    const w = this.sim.world;
    let changed = false;
    for (const t of group) if (w.setGateOpen(t.x, t.y, open)) changed = true;
    if (changed) this.sim.events.emit('gate', { x: group[0].x, y: group[0].y, open });
  }

  private rebuild(): void {
    const w = this.sim.world;
    this.groups = gateGroups(w);
    this.groupIdx = this.groups.map((g) => new Set(g.map((t) => w.idx(t.x, t.y))));
    this.timers = this.groups.map(() => 0);
    this.version = w.gateVersion;
  }

  private collectActors(): GateActor[] {
    const sim = this.sim;
    const w = sim.world;
    const out: GateActor[] = [];
    const tileIdx = (x: number, y: number): number => {
      const tx = Math.floor(x);
      const ty = Math.floor(y);
      return w.inBounds(tx, ty) ? w.idx(tx, ty) : -1;
    };
    // Oyuncu: ayak kutusunun dört köşesi (Player.collides ile aynı).
    const p = sim.player;
    const { w: hw, h: hh } = BALANCE.player.hitbox;
    const x0 = p.x - hw / 2;
    const x1 = p.x + hw / 2 - 0.001;
    const y0 = p.y - hh;
    const y1 = p.y - 0.001;
    out.push({
      x: p.x,
      y: p.y - hh / 2,
      allowed: true,
      tiles: [tileIdx(x0, y0), tileIdx(x1, y0), tileIdx(x0, y1), tileIdx(x1, y1)],
    });
    for (const s of sim.staff) {
      if (s.state === 'offDuty') continue;
      out.push({ x: s.x, y: s.y, allowed: true, tiles: [tileIdx(s.x, s.y)] });
    }
    for (const a of sim.adopters) out.push({ x: a.x, y: a.y, allowed: true, tiles: [tileIdx(a.x, a.y)] });
    for (const d of sim.dogs) {
      out.push({ x: d.x, y: d.y, allowed: d.walking || d.following, tiles: [tileIdx(d.x, d.y)] });
    }
    return out;
  }
}
