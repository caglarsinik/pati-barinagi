import { useState } from 'preact/hooks';
import { app } from '../app';
import {
  BUILDING_DEFS,
  BUILD_ORDER,
  type BuildingCategory,
  CATEGORY_NAMES_TR,
  PLOT_EXPANSION_COST,
  TILE_TOOL_DEFS,
} from '../content/buildings';
import { t } from '../i18n';
import { ZONE_NAMES_TR, Zone } from '../sim/world/tiles';
import { formatMoney } from './HUD';
import { type BuildTool, showToast, store } from './store';

type Tab = BuildingCategory | 'arsa' | 'bolge';

const ZONES: Zone[] = [Zone.Toilet, Zone.Play, Zone.Training, Zone.Quarantine, Zone.Staff];

function sameTool(a: BuildTool, b: BuildTool): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'building' && b.kind === 'building') return a.type === b.type;
  if (a.kind === 'tile' && b.kind === 'tile') return a.tool === b.tool;
  if (a.kind === 'zone' && b.kind === 'zone') return a.zone === b.zone;
  return true;
}

export function BuildBar() {
  store.tick.value;
  const [tab, setTab] = useState<Tab>('altyapi');
  if (!store.buildBar.value || store.mode.value !== 'manage') return null;
  const sim = app.sim;
  if (!sim) return null;
  const tool = store.build.value;
  const money = store.money.value;
  const pick = (x: BuildTool): void => app.setBuildTool(sameTool(tool, x) ? { kind: 'none' } : x);

  const tabs: Array<[Tab, string]> = [
    ...BUILD_ORDER.map((c) => [c, t(CATEGORY_NAMES_TR[c])] as [Tab, string]),
    ['bolge', t('Bölgeler')],
    ['arsa', t('Arsa')],
  ];

  return (
    <div class="hud build-bar panel">
      <div class="build-tabs">
        {tabs.map(([id, name]) => (
          <button key={id} class={'btn small' + (tab === id ? ' active' : '')} onClick={() => setTab(id)}>
            {name}
          </button>
        ))}
        <span class="spacer" />
        <button class={'btn small danger' + (tool.kind === 'demolish' ? ' active' : '')} onClick={() => pick({ kind: 'demolish' })}>
          {t('Yık (X)')}
        </button>
        <button class="btn small" onClick={() => app.toggleBuildBar()}>
          {t('Kapat (B)')}
        </button>
      </div>
      <div class="build-items">
        {tab === 'altyapi' &&
          Object.values(TILE_TOOL_DEFS).map((d) => (
            <button
              key={d.id}
              class={'build-item' + (tool.kind === 'tile' && tool.tool === d.id ? ' active' : '')}
              title={t(d.desc)}
              onClick={() => pick({ kind: 'tile', tool: d.id })}
            >
              <span class="bi-name">{t(d.name)}</span>
              <span class="bi-cost">{t('{cost} ₺/kare', { cost: d.cost })}</span>
            </button>
          ))}
        {tab !== 'arsa' &&
          tab !== 'bolge' &&
          Object.values(BUILDING_DEFS)
            .filter((d) => d.buildable && d.category === tab)
            .map((d) => (
              <button
                key={d.type}
                class={'build-item' + (tool.kind === 'building' && tool.type === d.type ? ' active' : '') + (money < d.cost ? ' poor' : '')}
                title={`${t(d.desc)}${d.buildMinutes ? ` · ${d.buildMinutes} dk` : ''}`}
                onClick={() => pick({ kind: 'building', type: d.type })}
              >
                <span class="bi-name">{t(d.name)}</span>
                <span class="bi-cost">
                  {d.w}×{d.h} · {formatMoney(d.cost)}
                </span>
              </button>
            ))}
        {tab === 'bolge' && (
          <>
            {ZONES.map((z) => (
              <button key={z} class={'build-item' + (tool.kind === 'zone' && tool.zone === z ? ' active' : '')} onClick={() => pick({ kind: 'zone', zone: z })}>
                <span class="bi-name">{t(ZONE_NAMES_TR[z])}</span>
                <span class="bi-cost">{t('ücretsiz')}</span>
              </button>
            ))}
            <button class={'build-item' + (tool.kind === 'zone' && tool.zone === Zone.None ? ' active' : '')} onClick={() => pick({ kind: 'zone', zone: Zone.None })}>
              <span class="bi-name">{t('Bölge sil')}</span>
              <span class="bi-cost">{t('silgi')}</span>
            </button>
          </>
        )}
        {tab === 'arsa' && (
          <>
            <div class="muted small-text">
              {t('Arsa {w}×{h} kare. Genişletme {cost}; alan temizlenir, çit taşınır.', { w: sim.world.plot.w, h: sim.world.plot.h, cost: formatMoney(PLOT_EXPANSION_COST) })}
            </div>
            {(['east', 'south'] as const).map((dir) => (
              <button
                key={dir}
                class={'build-item' + (money < PLOT_EXPANSION_COST ? ' poor' : '')}
                onClick={() => {
                  const r = sim.command({ type: 'expandPlot', dir });
                  if (r.message) showToast(r.message);
                }}
              >
                <span class="bi-name">{dir === 'east' ? t('Doğuya genişlet') : t('Güneye genişlet')}</span>
                <span class="bi-cost">{t('+16 kare · {cost}', { cost: formatMoney(PLOT_EXPANSION_COST) })}</span>
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
