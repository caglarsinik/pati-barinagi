import { t } from '../../i18n';
import type { Sim } from '../Sim';
import type { Alert, AlertSeverity } from './AlertSystem';

/**
 * İhtiyaç özeti (0.22.0): oyuncunun sağlayabileceği şeylerden (yem, su, tedavi, temizlik, kulübe, oyun) yoksun köpek
 * sayıları; sol alttaki şerit "3 köpek aç · 2 susuz" diye gösterir. Eşikler tek kaynaktan: AlertSystem'in köpek uyarıları
 * kimlik önekiyle sayılır ("yemek bekliyor" sayılmaz).
 */
export interface NeedSummary {
  hungry: number;
  thirsty: number;
  sick: number;
  dirty: number;
  homeless: number;
  bored: number;
  /** Uyarısı olan farklı köpek sayısı. */
  dogs: number;
  /** Sayılan uyarıların en ağırı (yoksa null). */
  severity: AlertSeverity | null;
}

type Count = 'hungry' | 'thirsty' | 'sick' | 'dirty' | 'homeless' | 'bored';

const PREFIXES: ReadonlyArray<[string, Count]> = [
  ['hunger-', 'hungry'],
  ['thirst-', 'thirsty'],
  ['ill-', 'sick'],
  ['sick-', 'sick'],
  ['dirty-', 'dirty'],
  ['nokennel-', 'homeless'],
  ['bored-', 'bored'],
];

const RANK: Record<AlertSeverity, number> = { info: 0, warn: 1, danger: 2 };

export function needSummaryFromAlerts(alerts: readonly Alert[]): NeedSummary {
  const s: NeedSummary = { hungry: 0, thirsty: 0, sick: 0, dirty: 0, homeless: 0, bored: 0, dogs: 0, severity: null };
  const dogs = new Set<number>();
  for (const a of alerts) {
    if (a.dogId === undefined) continue;
    const hit = PREFIXES.find(([p]) => a.id.startsWith(p));
    if (!hit) continue;
    s[hit[1]]++;
    dogs.add(a.dogId);
    if (s.severity === null || RANK[a.severity] > RANK[s.severity]) s.severity = a.severity;
  }
  s.dogs = dogs.size;
  return s;
}

export function needSummary(sim: Sim): NeedSummary {
  return needSummaryFromAlerts(sim.alerts.alerts);
}

/** Şerit metni, önem sırasıyla: "3 köpek aç · 2 susuz · 1 hasta"; ilk parça "köpek" sözcüğünü taşır. Hiçbiri yoksa ''. */
export function needSummaryText(s: NeedSummary): string {
  const parts: string[] = [];
  const seg = (n: number, first: (n: number) => string, rest: (n: number) => string): void => {
    if (n > 0) parts.push(parts.length === 0 ? first(n) : rest(n));
  };
  seg(s.hungry, (n) => t('{n} köpek aç', { n }), (n) => t('{n} aç', { n }));
  seg(s.thirsty, (n) => t('{n} köpek susuz', { n }), (n) => t('{n} susuz', { n }));
  seg(s.sick, (n) => t('{n} köpek hasta', { n }), (n) => t('{n} hasta', { n }));
  seg(s.dirty, (n) => t('{n} köpek kirli', { n }), (n) => t('{n} kirli', { n }));
  seg(s.homeless, (n) => t('{n} köpek kulübesiz', { n }), (n) => t('{n} kulübesiz', { n }));
  seg(s.bored, (n) => t('{n} köpek sıkılmış', { n }), (n) => t('{n} sıkılmış', { n }));
  return parts.join(' · ');
}
