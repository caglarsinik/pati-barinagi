import { app } from '../app';
import { t } from '../i18n';
import { STAGE_NAMES_TR } from '../sim/entities/Dog';
import { DogPortrait } from './DogPortrait';
import { store } from './store';

export function DogList() {
  store.tick.value;
  const sim = app.sim;
  if (!sim) return null;
  const dogs = sim.shelterDogs().sort((a, b) => a.mood() - b.mood());
  return (
    <div class="overlay">
      <div class="menu-card panel wide">
        <div class="panel-head">
          <h2>{t('Köpekler ({n} / kulübe {cap})', { n: dogs.length, cap: sim.kennelCapacity() })}</h2>
          <button class="btn small close" onClick={() => (store.panel.value = 'none')}>
            ✕
          </button>
        </div>
        {dogs.length === 0 && <p class="muted">{t('Henüz köpek yok. Dünyada yumurta ara!')}</p>}
        <table class="dog-table">
          <thead>
            <tr>
              <th />
              <th>{t('Ad')}</th>
              <th>{t('Aşama')}</th>
              <th>{t('Keyif')}</th>
              <th>{t('Tokluk')}</th>
              <th>{t('Su')}</th>
              <th>{t('Temizlik')}</th>
              <th>{t('Sağlık')}</th>
              <th>{t('Sadakat')}</th>
              <th>{t('Eğitim')}</th>
              <th>{t('Kulübe')}</th>
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
