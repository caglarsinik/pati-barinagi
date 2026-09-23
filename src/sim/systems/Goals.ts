import { BALANCE } from '../../config/balance';
import type { BuildingType } from '../../content/buildings';
import { t } from '../../i18n';
import { clamp100 } from '../entities/Dog';
import type { Sim } from '../Sim';

/** Belediye hedefi: sıralı, bir kez ödüllenir. */
export interface GoalDef {
  id: string;
  title: string;
  desc: string;
  /** Ödül (₺), `BALANCE.goals.rewardMul` ile çarpılır. */
  reward: number;
  /** İlgili inşa aracı (0.19.1 "Göster" düğmesi için). */
  tool?: BuildingType;
  check: (sim: Sim) => boolean;
}

const has = (sim: Sim, ...types: BuildingType[]): boolean => sim.buildings.some((b) => types.includes(b.type));

/** Hedef zinciri. 0.19.0: kuruluşun üç adımı; 0.19.1'de zincir uzar. */
export const GOALS: GoalDef[] = [
  {
    id: 'kennel',
    title: 'Köpeğine kulübe kur',
    desc: 'Yönetim modunda inşa çubuğundan küçük kulübe seç ve arsaya yerleştir.',
    reward: 200,
    tool: 'kennelSmall',
    check: (s) => has(s, 'kennelSmall', 'kennelLarge'),
  },
  {
    id: 'bowlTrough',
    title: 'Yem kabı ve su yalağı koy',
    desc: 'Köpeğin yiyip içebilsin: inşa çubuğundan yem kabı ve su yalağı yerleştir.',
    reward: 100,
    tool: 'bowl',
    check: (s) => has(s, 'bowl') && has(s, 'trough'),
  },
  {
    id: 'incubator',
    title: 'Kuluçka makinesi kur',
    desc: 'Kapının dışındaki yuvadan yumurta getireceksin; kuluçka onu yavruya çevirir.',
    reward: 150,
    tool: 'incubator',
    check: (s) => has(s, 'incubator'),
  },
];

/** Kuruluş adımlarının sayısı: "Hazır barınak" ve eski kayıtlar bunları tamamlanmış sayar. */
export const FOUNDING_GOALS = 3;

export function goalReward(g: GoalDef): number {
  return Math.round(g.reward * BALANCE.goals.rewardMul);
}

export class GoalSystem {
  /** Sıradaki hedefin sırası; `GOALS.length` ise zincir bitti. */
  index = 0;

  constructor(private readonly sim: Sim) {}

  get current(): GoalDef | null {
    return GOALS[this.index] ?? null;
  }

  /** Her sim dakikasında: sıradaki hedef sağlandıysa ödül verilir ve zincir ilerler (dakikada en çok bir hedef). */
  check(): void {
    const g = this.current;
    if (!g) return;
    let ok = false;
    try {
      ok = g.check(this.sim);
    } catch {
      ok = false;
    }
    if (!ok) return;
    this.index++;
    const money = goalReward(g);
    if (money > 0) this.sim.addIncome('aid', money, t('Belediye ödülü: {goal}', { goal: t(g.title) }));
    this.sim.reputation = clamp100(this.sim.reputation + BALANCE.goals.reputation);
    this.sim.events.emit('goal', g);
    const next = this.current;
    this.sim.events.emit(
      'message',
      next
        ? t('🎯 Hedef tamam: {goal} (+{money} ₺) · Sıradaki: {next}', { goal: t(g.title), money, next: t(next.title) })
        : t('🎯 Hedef tamam: {goal} (+{money} ₺)', { goal: t(g.title), money }),
    );
  }

  toJSON(): { index: number } {
    return { index: this.index };
  }

  /** Kayıttan yükler; alan yoksa (eski kayıt) `fallback`. */
  load(raw: unknown, fallback: number): void {
    const i = raw && typeof raw === 'object' ? (raw as { index?: unknown }).index : undefined;
    this.index = typeof i === 'number' && Number.isInteger(i) && i >= 0 ? Math.min(i, GOALS.length) : Math.min(fallback, GOALS.length);
  }
}
