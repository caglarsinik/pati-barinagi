import type { WeekSummary } from '../sim/systems/EconomySystem';
import { t } from '../i18n';
import { formatMoney } from './HUD';

/**
 * Son haftaların gelir/gider çubukları ve net çizgisi (SVG, genişliğe göre ölçeklenir).
 * Gelir sıfır çizgisinin üstünde yeşil, gider altında kırmızı; net sarı noktalı çizgi.
 */
export function FinanceChart({ weeks }: { weeks: readonly WeekSummary[] }) {
  if (weeks.length === 0) return null;
  const W = 320;
  const H = 120;
  const pad = 14;
  const rows = weeks.map((w) => ({
    week: w.week,
    income: Object.values(w.income).reduce((s, v) => s + (v ?? 0), 0),
    expense: Object.values(w.expense).reduce((s, v) => s + (v ?? 0), 0),
    net: w.net,
  }));
  const max = Math.max(1, ...rows.map((r) => Math.max(r.income, r.expense, Math.abs(r.net))));
  const mid = H / 2;
  const scale = (mid - pad) / max;
  const slot = (W - pad * 2) / rows.length;
  const bar = Math.max(4, Math.min(22, slot * 0.36));
  const cx = (i: number): number => pad + slot * (i + 0.5);
  const netPts = rows.map((r, i) => `${cx(i).toFixed(1)},${(mid - r.net * scale).toFixed(1)}`).join(' ');
  return (
    <svg class="fin-chart" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('Son {n} haftanın gelir ve gideri', { n: rows.length })}>
      <line class="axis" x1={pad} x2={W - pad} y1={mid} y2={mid} />
      {rows.map((r, i) => (
        <g key={r.week}>
          <title>{t('{week}. hafta: gelir {inc}, gider {exp}, net {net}', { week: r.week, inc: formatMoney(r.income), exp: formatMoney(r.expense), net: formatMoney(r.net) })}</title>
          <rect class="inc" x={cx(i) - bar - 1} y={mid - r.income * scale} width={bar} height={r.income * scale} />
          <rect class="exp" x={cx(i) + 1} y={mid} width={bar} height={r.expense * scale} />
          <text class="lbl" x={cx(i)} y={H - 2} text-anchor="middle">
            {r.week}
          </text>
        </g>
      ))}
      {rows.length > 1 && <polyline class="net" points={netPts} />}
      {rows.map((r, i) => (
        <circle key={`n${r.week}`} class="net-dot" cx={cx(i)} cy={mid - r.net * scale} r={2.2} />
      ))}
    </svg>
  );
}
