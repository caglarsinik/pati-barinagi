import { BALANCE } from '../config/balance';

export function formatMoney(v: number): string {
  const sign = v < 0 ? '-' : '';
  const abs = Math.abs(Math.round(v));
  return `${sign}${abs.toLocaleString('tr-TR')} ${BALANCE.economy.currency}`;
}
