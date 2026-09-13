import { useState } from 'preact/hooks';
import { app } from '../app';
import { t } from '../i18n';
import { adoptable } from '../sim/entities/Adopter';
import { buildingDef } from '../sim/entities/Building';
import { ILLNESS_NAMES_TR, SKILL_KEYS, SKILL_NAMES_TR, STAGE_NAMES_TR } from '../sim/entities/Dog';
import {
  BODY_NAMES_TR,
  COAT_COLORS,
  EAR_NAMES_TR,
  PATTERN_NAMES_TR,
  RARITY_NAMES_TR,
  SIZE_NAMES_TR,
  TAIL_NAMES_TR,
  TEMPERAMENT_NAMES_TR,
} from '../sim/entities/DogGenome';
import { DogPortrait } from './DogPortrait';
import { showToast, store } from './store';

export function Bar({ label, value, danger = 30 }: { label: string; value: number; danger?: number }) {
  const v = Math.round(value);
  const bad = v < danger;
  return (
    <div class="need">
      <span class="need-label">{label}</span>
      <div class="bar">
        <div class={'fill' + (bad ? ' bad' : '')} style={{ width: `${Math.max(0, Math.min(100, v))}%` }} />
      </div>
      <span class="need-value">{v}</span>
    </div>
  );
}

const STATE_TR: Record<string, string> = {
  idle: 'Boşta',
  wander: 'Dolaşıyor',
  sit: 'Oturuyor',
  lie: 'Yatıyor',
  sleep: 'Uyuyor',
  toBowl: 'Yem kabına gidiyor',
  eat: 'Yiyor',
  toTrough: 'Yalağa gidiyor',
  drink: 'Su içiyor',
  toToilet: 'Tuvalete gidiyor',
  toilet: 'Tuvaletini yapıyor',
  toKennel: 'Kulübeye gidiyor',
  toQuarantine: 'Karantinaya gidiyor',
  toToy: 'Oyuncağa gidiyor',
  play: 'Oynuyor',
  interact: 'Seninle',
  toFriend: 'Dostuna gidiyor',
  waitFriend: 'Dostunu bekliyor',
  playTogether: 'Dostuyla oynuyor',
  growl: 'Hırlıyor',
  bark: 'Havlıyor',
};

export function DogPanel() {
  store.tick.value;
  const sim = app.sim;
  const id = store.selectedDogId.value;
  const dog = sim && id !== null ? sim.dogById(id) : undefined;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  if (!sim || !dog) return null;
  const g = dog.genome;
  const n = dog.needs;
  const kennel = dog.kennelId !== null ? sim.buildingById(dog.kennelId) : undefined;
  const kennels = sim.buildings.filter((b) => (b.type === 'kennelSmall' || b.type === 'kennelLarge') && sim.kennelHasRoom(b, dog));
  const bf = dog.bestFriend();
  const friend = bf ? sim.dogById(bf.id) : undefined;
  const why = adoptable(dog);
  const close = (): void => {
    store.panel.value = 'none';
    store.selectedDogId.value = null;
  };
  return (
    <div class="side-panel panel">
      <div class="panel-head">
        <DogPortrait genome={g} stage={dog.stage} />
        <div class="panel-title">
          {editing ? (
            <input
              class="name-input"
              value={draft}
              maxLength={16}
              autoFocus
              onInput={(e) => setDraft((e.target as HTMLInputElement).value)}
              onFocus={() => (store.inputFocused.value = true)}
              onBlur={() => {
                store.inputFocused.value = false;
                sim.command({ type: 'renameDog', id: dog.id, name: draft });
                setEditing(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Escape') (e.target as HTMLInputElement).blur();
              }}
            />
          ) : (
            <h3
              title={t('Adı değiştirmek için tıkla')}
              onClick={() => {
                setDraft(dog.name);
                setEditing(true);
              }}
            >
              {dog.name} ✎
            </h3>
          )}
          <div class="muted">
            {t(STAGE_NAMES_TR[dog.stage])} · {t('{age} haftalık', { age: dog.ageWeeks })} · {t(RARITY_NAMES_TR[g.rarity])}
          </div>
          <div class="muted">
            {t(STATE_TR[dog.state] ?? dog.state)}
            {dog.illness ? ` · ${t('HASTA')}: ${t(ILLNESS_NAMES_TR[dog.illness.kind])}` : dog.sick ? ` · ${t('HASTA')}` : ''}
          </div>
          <div class="muted">{friend && bf ? t('En yakın dostu: {name} (+{score})', { name: friend.name, score: Math.round(bf.score) }) : t('Henüz dostu yok')}</div>
        </div>
        <button class="btn small close" onClick={close} title={t('Kapat (Esc)')}>
          ✕
        </button>
      </div>

      <div class="traits">
        <span>{t(SIZE_NAMES_TR[g.size])}</span>
        <span>{t(BODY_NAMES_TR[g.body])}</span>
        <span>{t(COAT_COLORS[g.coat].name)}</span>
        <span>{t(PATTERN_NAMES_TR[g.pattern])}</span>
        <span>{t(EAR_NAMES_TR[g.ears])}</span>
        <span>{t(TAIL_NAMES_TR[g.tail])}</span>
        <span>{t(TEMPERAMENT_NAMES_TR[g.temperament])}</span>
        <span>{t('Zekâ {n}/5', { n: g.intelligence })}</span>
        <span>{t('Enerji {n}/5', { n: g.energy })}</span>
      </div>

      <h4>{t('İhtiyaçlar · keyif {mood}', { mood: dog.mood() })}</h4>
      <Bar label={t('Tokluk')} value={100 - n.hunger} />
      <Bar label={t('Su')} value={100 - n.thirst} />
      <Bar label={t('Keyif')} value={n.play} />
      <Bar label={t('Rahatlık')} value={100 - n.bladder} danger={20} />
      <Bar label={t('Temizlik')} value={n.hygiene} />
      <Bar label={t('Sağlık')} value={n.health} danger={40} />
      <Bar label={t('Sadakat')} value={n.loyalty} danger={0} />
      <Bar label={t('Enerji')} value={n.energy} danger={20} />

      <h4>{t('Eğitim · seviye {lvl}/6', { lvl: dog.trainingLevel() })}</h4>
      <div class="skills">
        {SKILL_KEYS.map((k) => (
          <label key={k} class={'skill' + (dog.trainingFocus === k ? ' focus' : '') + (dog.skills[k] >= 100 ? ' done' : '')}>
            <input
              type="radio"
              name="focus"
              checked={dog.trainingFocus === k}
              onChange={() => sim.command({ type: 'setTrainingFocus', id: dog.id, skill: dog.trainingFocus === k ? null : k })}
            />
            <span class="skill-name">{t(SKILL_NAMES_TR[k])}</span>
            <div class="bar mini">
              <div class="fill" style={{ width: `${dog.skills[k]}%` }} />
            </div>
            <span class="need-value">{Math.floor(dog.skills[k])}</span>
          </label>
        ))}
        <div class="muted small-text">{t('Odak seçmezsen önce tuvalet eğitimi çalışılır.')}</div>
      </div>

      <h4>{t('Kulübe')}</h4>
      <div class="row">
        <select
          value={dog.kennelId ?? ''}
          onChange={(e) => {
            const v = (e.target as HTMLSelectElement).value;
            sim.command({ type: 'assignKennel', dogId: dog.id, buildingId: v === '' ? null : Number(v) });
          }}
        >
          <option value="">{t('Kulübesiz')}</option>
          {kennels.map((b) => (
            <option key={b.id} value={b.id}>
              {t(buildingDef(b).name)} #{b.id} ({b.occupants.length}/{buildingDef(b).capacity})
            </option>
          ))}
        </select>
        {kennel && (
          <button class="btn small" onClick={() => app.focusTile(kennel.x, kennel.y)}>
            {t('Göster')}
          </button>
        )}
      </div>
      <h4>{t('Sahiplendirme')}</h4>
      <label class="policy">
        <input
          type="checkbox"
          checked={dog.keep}
          onChange={(e) => {
            const r = sim.command({ type: 'setKeep', dogId: dog.id, keep: (e.target as HTMLInputElement).checked });
            if (r.message) showToast(r.message);
          }}
        />
        <span>{t('Bu köpeği tut (sahiplendirmeye kapalı)')}</span>
      </label>
      <div class="muted small-text">{why ? t('Şu an sahiplendirilemez: {why}', { why }) : t('Sahiplendirilmeye hazır.')}</div>

      <h4>{t('Gezinti')}</h4>
      <div class="row">
        {dog.walking ? (
          <button class="btn small" onClick={() => sim.command({ type: 'endWalk' })}>
            {t('Gezintiyi bitir')}
          </button>
        ) : dog.skills.leash >= 100 ? (
          <button
            class="btn small"
            onClick={() => {
              const r = sim.command({ type: 'walkDog', dogId: dog.id });
              if (r.message) showToast(r.message);
            }}
          >
            {t('Gezdir (tasma)')}
          </button>
        ) : (
          <span class="muted small-text">{t('"Tasma" becerisini öğrenince gezdirebilirsin.')}</span>
        )}
      </div>
      <div class="row">
        <button class="btn small" onClick={() => app.focusTile(dog.tileX, dog.tileY)}>
          {t('Köpeğe git (kamera)')}
        </button>
      </div>
    </div>
  );
}
