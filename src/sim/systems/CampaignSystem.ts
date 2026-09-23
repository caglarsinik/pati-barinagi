import { BALANCE } from '../../config/balance';
import { Rng, hash3 } from '../../core/Rng';
import { t } from '../../i18n';
import { clamp100 } from '../entities/Dog';
import { ADOPTER_TYPES } from '../entities/AdopterType';
import type { Sim } from '../Sim';
import { familyKey } from './Stories';

export interface CampaignResult {
  ok: boolean;
  message?: string;
}

const fail = (message: string): CampaignResult => ({ ok: false, message });

/**
 * Oyuncunun seçtiği etkinlikler (0.21.3). **Sahiplendirme günü**: bedelle ilan edilir (sahiplendirme açıkken, haftada bir),
 * ertesi gün sahipleniciler katlanır (günlük tavan yükselir, sabırları uzar), kapı ve ofis balonlarla süslenir; gün sonunda
 * yeterince sahiplendirme olduysa itibar. **Bağış kampanyası**: bedelle başlar (haftada bir), birkaç gün saat 11:00'de mutlu
 * mezun aileleri (≥70, geri getirmemiş; aile başına bir kez) ve köy bulunduysa köylüler bağışlar, itibar tabanıyla; günlük
 * tavanlı. Kampanya tutarları ayrı RNG'den (ana sıra değişmez); sahiplendirme gününün fazladan sahiplenicileri gün planının ana
 * RNG'sinden çekilir (yalnız oyuncunun ilan ettiği gün, gazete bayrağı gibi).
 */
export class CampaignSystem {
  constructor(private readonly sim: Sim) {}

  isAdoptionDay(): boolean {
    return this.sim.flags.adoptionDay === this.sim.clock.day;
  }

  /** Yarına ilan edilmiş sahiplendirme günü var mı. */
  adoptionDayTomorrow(): boolean {
    return this.sim.flags.adoptionDay === this.sim.clock.day + 1;
  }

  /** Sahiplendirme günü ilan edilemiyorsa nedeni. */
  adoptionDayIssue(): string | null {
    const sim = this.sim;
    const S = BALANCE.stories;
    if (!sim.policies.adoptionsOpen) return t('Sahiplendirmeyi açınca ilan edilebilir');
    if (sim.flags.adoptionDayWeek === sim.clock.week || this.adoptionDayTomorrow() || this.isAdoptionDay()) return t('Bu hafta sahiplendirme günü zaten ilan edildi');
    if (sim.money < S.adoptionDayCost) return t('Yeterli para yok ({cost} ₺)', { cost: S.adoptionDayCost });
    return null;
  }

  announceAdoptionDay(): CampaignResult {
    const sim = this.sim;
    const why = this.adoptionDayIssue();
    if (why) return fail(why);
    sim.addExpense('event', BALANCE.stories.adoptionDayCost, t('Sahiplendirme günü'));
    sim.flags.adoptionDay = sim.clock.day + 1;
    sim.flags.adoptionDayWeek = sim.clock.week;
    return { ok: true, message: t('🎈 Sahiplendirme günü ilan edildi: yarın kapıyı süslüyoruz, sahipleniciler akın edecek!') };
  }

  /** Bağış kampanyası başlatılamıyorsa nedeni. */
  campaignIssue(): string | null {
    const sim = this.sim;
    const S = BALANCE.stories;
    if (sim.flags.campaignLeft > 0) return t('Kampanya sürüyor ({n} gün kaldı)', { n: sim.flags.campaignLeft });
    if (sim.flags.campaignWeek === sim.clock.week) return t('Bu hafta kampanya zaten yapıldı');
    if (sim.money < S.campaignCost) return t('Yeterli para yok ({cost} ₺)', { cost: S.campaignCost });
    return null;
  }

  startCampaign(): CampaignResult {
    const sim = this.sim;
    const why = this.campaignIssue();
    if (why) return fail(why);
    const S = BALANCE.stories;
    sim.addExpense('event', S.campaignCost, t('Bağış kampanyası'));
    sim.flags.campaignLeft = S.campaignDays;
    sim.flags.campaignWeek = sim.clock.week;
    return { ok: true, message: t('📣 Bağış kampanyası başladı: {n} gün boyunca her gün 11:00\'de bağış toplanır', { n: S.campaignDays }) };
  }

  onHour(h: number): void {
    if (h === BALANCE.adoption.arriveFromHour && this.isAdoptionDay()) {
      this.sim.events.emit('message', t('🎈 Sahiplendirme günü başladı: bugün sahipleniciler akın ediyor!'));
    }
    if (h === BALANCE.stories.letterHour && this.sim.flags.campaignLeft > 0) this.campaignRound();
  }

  /** Gün dönümü: biten gün sahiplendirme günüyse ve yeterince sahiplendirme olduysa itibar. */
  onDay(day: number): void {
    const sim = this.sim;
    const S = BALANCE.stories;
    const ended = day - 1;
    if (sim.flags.adoptionDay !== ended) return;
    const n = sim.adoptions.filter((r) => r.day === ended).length;
    if (n < S.adoptionDaySuccess) return;
    sim.reputation = clamp100(sim.reputation + S.adoptionDayRep);
    sim.events.emit('message', t('🎈 Başarılı sahiplendirme günü: {n} köpek yuvasına kavuştu (itibar +{rep})', { n, rep: S.adoptionDayRep }));
  }

  /** Kampanyanın bir günü: aileler (her aile bir kez), köylüler ve itibar tabanı; tavanlı. */
  campaignRound(): { families: number; villagers: number; amount: number } {
    const sim = this.sim;
    const S = BALANCE.stories;
    const rng = new Rng(hash3(sim.seed, sim.clock.day, 0xd0a7));
    const round10 = (v: number): number => Math.round(v / 10) * 10;
    let amount = round10(sim.reputation * S.campaignRepMul);
    const seen = new Set<number>();
    let families = 0;
    for (const r of sim.adoptions) {
      const f = familyKey(r);
      if (r.score < 70 || r.returned || f === undefined || seen.has(f)) continue;
      seen.add(f);
      families++;
      amount += round10(rng.int(S.campaignFamilyMin, S.campaignFamilyMax) * ADOPTER_TYPES[r.type ?? 'family'].generosity);
    }
    let villagers = 0;
    if (sim.villageFound && sim.villagers.ensure()) {
      for (let i = 0; i < sim.villagers.list.length; i++) {
        villagers++;
        amount += round10(rng.int(S.campaignVillagerMin, S.campaignVillagerMax));
      }
    }
    amount = Math.min(S.campaignDailyMax, amount);
    sim.flags.campaignLeft = Math.max(0, sim.flags.campaignLeft - 1);
    if (amount > 0) sim.addIncome('donation', amount, t('Kampanya: {n} aile', { n: families }));
    let msg = families > 0 ? t('📣 Kampanya: {n} aile {amount} ₺ bağışladı', { n: families, amount }) : t('📣 Kampanya: {amount} ₺ bağış toplandı', { amount });
    if (villagers > 0) msg += t(' (köylüler de katıldı)');
    sim.events.emit('message', msg);
    return { families, villagers, amount };
  }
}
