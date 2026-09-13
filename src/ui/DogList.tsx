import { useState } from 'preact/hooks';
import { app } from '../app';
import { BALANCE } from '../config/balance';
import { t } from '../i18n';
import { adoptable } from '../sim/entities/Adopter';
import { type Dog, STAGE_NAMES_TR } from '../sim/entities/Dog';
import { DogPortrait } from './DogPortrait';
import { store } from './store';

type SortKey = 'name' | 'stage' | 'mood' | 'hunger' | 'thirst' | 'hygiene' | 'health' | 'loyalty' | 'training' | 'kennel';
type Filter = 'sick' | 'nokennel' | 'adoptable' | 'thirsty' | 'lonely' | 'kept';

const COLUMNS: Array<[SortKey, string]> = [
  ['name', 'Ad'],
  ['stage', 'Aşama'],
  ['mood', 'Keyif'],
  ['hunger', 'Tokluk'],
  ['thirst', 'Su'],
  ['hygiene', 'Temizlik'],
  ['health', 'Sağlık'],
  ['loyalty', 'Sadakat'],
  ['training', 'Eğitim'],
  ['kennel', 'Kulübe'],
];

const FILTERS: Array<[Filter, string]> = [
  ['sick', 'Hasta'],
  ['nokennel', 'Kulübesiz'],
  ['adoptable', 'Sahiplendirilebilir'],
  ['thirsty', 'Susuz'],
  ['lonely', 'Dostsuz'],
  ['kept', 'Tutulan'],
];

function sortValue(d: Dog, k: SortKey): number | string {
  switch (k) {
    case 'name':
      return d.name.toLocaleLowerCase('tr');
    case 'stage':
      return d.ageWeeks;
    case 'mood':
      return d.mood();
    case 'hunger':
      return 100 - d.needs.hunger;
    case 'thirst':
      return 100 - d.needs.thirst;
    case 'hygiene':
      return d.needs.hygiene;
    case 'health':
      return d.needs.health;
    case 'loyalty':
      return d.needs.loyalty;
    case 'training':
      return d.trainingLevel();
    case 'kennel':
      return d.kennelId ?? -1;
    default:
      return 0;
  }
}

function passes(d: Dog, f: Filter): boolean {
  switch (f) {
    case 'sick':
      return d.sick;
    case 'nokennel':
      return d.kennelId === null;
    case 'adoptable':
      return adoptable(d) === null;
    case 'thirsty':
      return d.needs.thirst >= BALANCE.dogs.drinkAboveThirst;
    case 'lonely':
      return d.bestFriend() === null;
    case 'kept':
      return d.keep;
    default:
      return true;
  }
}

/** Köpek listesi: sütun başlığına tıkla sırala, filtre çipleriyle daralt. */
export function DogList() {
  store.tick.value;
  const sim = app.sim;
  const [sortKey, setSortKey] = useState<SortKey>('mood');
  const [asc, setAsc] = useState(true);
  const [filters, setFilters] = useState<Filter[]>([]);
  if (!sim) return null;
  const all = sim.shelterDogs();
  const dogs = all
    .filter((d) => filters.every((f) => passes(d, f)))
    .sort((a, b) => {
      const va = sortValue(a, sortKey);
      const vb = sortValue(b, sortKey);
      const c = typeof va === 'string' && typeof vb === 'string' ? va.localeCompare(vb, 'tr') : (va as number) - (vb as number);
      return asc ? c : -c;
    });
  const toggleSort = (k: SortKey): void => {
    if (k === sortKey) setAsc(!asc);
    else {
      setSortKey(k);
      setAsc(k === 'name' || k === 'kennel' || k === 'stage');
    }
  };
  const toggleFilter = (f: Filter): void => setFilters(filters.includes(f) ? filters.filter((x) => x !== f) : [...filters, f]);
  const arrow = (k: SortKey): string => (k === sortKey ? (asc ? ' ▲' : ' ▼') : '');
  return (
    <div class="overlay">
      <div class="menu-card panel wide">
        <div class="panel-head">
          <h2>{t('Köpekler ({n} / kulübe {cap})', { n: all.length, cap: sim.kennelCapacity() })}</h2>
          <button class="btn small close" onClick={() => (store.panel.value = 'none')}>
            ✕
          </button>
        </div>
        <div class="row">
          <span class="muted small-text">{t('Filtre')}:</span>
          {FILTERS.map(([f, label]) => (
            <button key={f} class={'btn small' + (filters.includes(f) ? ' active' : '')} onClick={() => toggleFilter(f)}>
              {t(label)}
            </button>
          ))}
          {filters.length > 0 && (
            <span class="muted small-text">
              {dogs.length}/{all.length}
            </span>
          )}
        </div>
        {all.length === 0 && <p class="muted">{t('Henüz köpek yok. Dünyada yumurta ara!')}</p>}
        {all.length > 0 && dogs.length === 0 && <p class="muted">{t('Filtreye uyan köpek yok.')}</p>}
        <table class="dog-table">
          <thead>
            <tr>
              <th />
              {COLUMNS.map(([k, label]) => (
                <th key={k} class="sortable" onClick={() => toggleSort(k)} title={t('Sıralamak için tıkla')}>
                  {t(label)}
                  {arrow(k)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dogs.map((d) => (
              <tr
                key={d.id}
                class={store.selectedDogId.value === d.id ? 'selected' : ''}
                onClick={() => {
                  store.selectedDogId.value = d.id;
                  store.panel.value = 'dog';
                }}
              >
                <td>
                  <DogPortrait genome={d.genome} stage={d.stage} scale={1} />
                </td>
                <td>
                  <b>{d.name}</b>
                  {d.sick ? ' 🤒' : ''}
                  {d.bestFriend() ? ' 🐾' : ''}
                  {d.walking ? ' 🦮' : ''}
                  {d.keep ? ' 🔒' : ''}
                </td>
                <td>{t(STAGE_NAMES_TR[d.stage])}</td>
                <td>{d.mood()}</td>
                <td class={100 - d.needs.hunger < 30 ? 'bad' : ''}>{Math.round(100 - d.needs.hunger)}</td>
                <td class={100 - d.needs.thirst < 30 ? 'bad' : ''}>{Math.round(100 - d.needs.thirst)}</td>
                <td class={d.needs.hygiene < 30 ? 'bad' : ''}>{Math.round(d.needs.hygiene)}</td>
                <td class={d.needs.health < 40 ? 'bad' : ''}>{Math.round(d.needs.health)}</td>
                <td>{Math.round(d.needs.loyalty)}</td>
                <td>{d.trainingLevel()}/6</td>
                <td>{d.kennelId !== null ? `#${d.kennelId}` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
