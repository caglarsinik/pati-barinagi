import { BALANCE } from '../../config/balance';
import type { TilePos } from '../world/TileWorld';
import type { Sim } from '../Sim';

export type AlertSeverity = 'info' | 'warn' | 'danger';

export interface Alert {
  id: string;
  text: string;
  severity: AlertSeverity;
  dogId?: number;
  tile?: TilePos;
}

/** Oyuncuya "şimdi ne yapmalı" diyen uyarı listesi. Her sim dakikasında yenilenir. */
export class AlertSystem {
  alerts: Alert[] = [];

  constructor(private readonly sim: Sim) {}

  refresh(): void {
    const out: Alert[] = [];
    const sim = this.sim;
    for (const dog of sim.dogs) {
      const n = dog.needs;
      if (dog.sick) out.push({ id: `sick-${dog.id}`, text: `${dog.name} hasta`, severity: 'danger', dogId: dog.id });
      if (n.hunger >= 80) out.push({ id: `hunger-${dog.id}`, text: `${dog.name} çok aç`, severity: n.hunger >= 95 ? 'danger' : 'warn', dogId: dog.id });
      else if (n.hunger >= 60 && sim.clock.isMealTime()) out.push({ id: `meal-${dog.id}`, text: `${dog.name} yemek bekliyor`, severity: 'info', dogId: dog.id });
      if (n.hygiene < 30) out.push({ id: `dirty-${dog.id}`, text: `${dog.name} kirli`, severity: 'warn', dogId: dog.id });
      if (n.play < 25) out.push({ id: `bored-${dog.id}`, text: `${dog.name} sıkıldı`, severity: 'info', dogId: dog.id });
      if (dog.kennelId === null) out.push({ id: `nokennel-${dog.id}`, text: `${dog.name} kulübesiz`, severity: 'warn', dogId: dog.id });
    }
    const mess = sim.messTiles.size;
    if (mess >= 1) {
      const first = sim.messTiles.values().next().value as number;
      const tile = { x: first % sim.world.width, y: Math.floor(first / sim.world.width) };
      out.push({ id: 'mess', text: mess === 1 ? '1 pislik temizlenmeli' : `${mess} pislik temizlenmeli`, severity: mess >= 4 ? 'warn' : 'info', tile });
    }
    if (sim.foodStock <= 0) out.push({ id: 'nofood', text: 'Kiler boş: yem sipariş et', severity: 'danger' });
    else if (sim.foodStock < BALANCE.economy.foodBagPortions / 2) out.push({ id: 'lowfood', text: 'Yem azalıyor', severity: 'info' });
    const emptyBowls = sim.buildings.filter((b) => b.type === 'bowl' && b.food <= 0).length;
    if (emptyBowls > 0 && sim.dogs.length > 0) out.push({ id: 'bowls', text: emptyBowls === 1 ? 'Bir yem kabı boş' : `${emptyBowls} yem kabı boş`, severity: 'info' });
    if (sim.money < 0) out.push({ id: 'debt', text: 'Kasa eksiye düştü', severity: 'danger' });

    const order: Record<AlertSeverity, number> = { danger: 0, warn: 1, info: 2 };
    out.sort((a, b) => order[a.severity] - order[b.severity]);
    this.alerts = out;
  }
}
