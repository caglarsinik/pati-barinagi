import { describe, expect, it } from 'vitest';
import { WEEKDAYS_TR } from '../../src/core/Clock';
import { BUILDING_DEFS, CATEGORY_NAMES_TR, TILE_TOOL_DEFS } from '../../src/content/buildings';
import { EN } from '../../src/i18n/en';
import { getLang, setLang, t } from '../../src/i18n';
import { ILLNESS_NAMES_TR, SKILL_NAMES_TR, STAGE_NAMES_TR } from '../../src/sim/entities/Dog';
import {
  BODY_NAMES_TR,
  COAT_COLORS,
  EAR_NAMES_TR,
  PATTERN_NAMES_TR,
  RARITY_NAMES_TR,
  SIZE_NAMES_TR,
  TAIL_NAMES_TR,
  TEMPERAMENT_NAMES_TR,
} from '../../src/sim/entities/DogGenome';
import { ATTR_NAMES_TR, ROLE_NAMES_TR, TASK_NAMES_TR, TRAIT_INFO_TR } from '../../src/sim/entities/Staff';
import { ACHIEVEMENTS } from '../../src/sim/systems/Achievements';
import { GOALS } from '../../src/sim/systems/Goals';
import { VILLAGER_ROLE_NAMES_TR } from '../../src/sim/entities/Villager';
import { DOG_TALK_LINES, LETTERS, TALK_LINES } from '../../src/sim/systems/VillagerSystem';
import { LEDGER_NAMES_TR } from '../../src/sim/systems/EconomySystem';
import { TOOL_DEFS } from '../../src/sim/systems/Interaction';
import { SEASON_NAMES_TR, WEATHER_NAMES_TR } from '../../src/sim/systems/WeatherSystem';
import { ZONE_NAMES_TR } from '../../src/sim/world/tiles';

/** Tüm kaynak dosyalar ham metin olarak (Vite glob). */
const SOURCES = import.meta.glob('../../src/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

/** Kaynak kodda t('...') ile geçen tüm sabit metinler. */
function literalKeys(): Set<string> {
  const keys = new Set<string>();
  const re = /\bt\(\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")/g;
  for (const src of Object.values(SOURCES)) {
    for (const m of src.matchAll(re)) {
      const raw = m[1] ?? m[2];
      keys.add(raw.replace(/\\'/g, "'").replace(/\\"/g, '"'));
    }
  }
  return keys;
}

function tableValues(): string[] {
  const out: string[] = [];
  const push = (o: Record<string, string>): void => {
    for (const v of Object.values(o)) out.push(v);
  };
  push(WEEKDAYS_TR as unknown as Record<string, string>);
  push(CATEGORY_NAMES_TR);
  push(STAGE_NAMES_TR);
  push(SKILL_NAMES_TR);
  push(ILLNESS_NAMES_TR);
  push(BODY_NAMES_TR);
  push(EAR_NAMES_TR);
  push(PATTERN_NAMES_TR);
  push(RARITY_NAMES_TR);
  push(SIZE_NAMES_TR);
  push(TAIL_NAMES_TR);
  push(TEMPERAMENT_NAMES_TR);
  push(ATTR_NAMES_TR);
  push(ROLE_NAMES_TR);
  push(TASK_NAMES_TR);
  push(LEDGER_NAMES_TR);
  push(SEASON_NAMES_TR);
  push(WEATHER_NAMES_TR);
  push(ZONE_NAMES_TR as unknown as Record<string, string>);
  for (const c of COAT_COLORS) out.push(c.name);
  for (const d of Object.values(BUILDING_DEFS)) out.push(d.name, d.desc);
  for (const d of Object.values(TILE_TOOL_DEFS)) out.push(d.name, d.desc);
  for (const d of TOOL_DEFS) out.push(d.name, d.desc);
  for (const x of Object.values(TRAIT_INFO_TR)) out.push(x.name, x.desc);
  for (const a of ACHIEVEMENTS) out.push(a.name, a.desc);
  for (const g of GOALS) out.push(g.title, g.desc);
  for (const l of [...TALK_LINES, ...DOG_TALK_LINES, ...LETTERS]) out.push(l);
  push(VILLAGER_ROLE_NAMES_TR);
  return out.filter((v) => typeof v === 'string' && v.length > 0);
}

describe('i18n', () => {
  it('t() Türkçede metni olduğu gibi döndürür, İngilizcede sözlükten çevirir', () => {
    setLang('tr');
    expect(t('Devam et')).toBe('Devam et');
    expect(t('Tohum: {seed}', { seed: 42 })).toBe('Tohum: 42');
    setLang('en');
    expect(getLang()).toBe('en');
    expect(t('Devam et')).toBe('Continue');
    expect(t('Tohum: {seed}', { seed: 'boncuk' })).toBe('Seed: boncuk');
    expect(t('bilinmeyen anahtar')).toBe('bilinmeyen anahtar');
    setLang('tr');
  });

  it('kaynak koddaki her t() sabiti İngilizce sözlükte var', () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThan(40);
    const keys = literalKeys();
    expect(keys.size).toBeGreaterThan(300);
    const missing = [...keys].filter((k) => !(k in EN));
    expect(missing).toEqual([]);
  });

  it('görünen ad tablolarının her değeri İngilizce sözlükte var', () => {
    const values = new Set(tableValues());
    expect(values.size).toBeGreaterThan(120);
    const missing = [...values].filter((k) => !(k in EN));
    expect(missing).toEqual([]);
  });
});
