import { useState } from 'preact/hooks';
import { app } from '../app';
import { buildingDef } from '../sim/entities/Building';
import { SKILL_KEYS, SKILL_NAMES_TR, STAGE_NAMES_TR } from '../sim/entities/Dog';
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
import { store } from './store';

export function Bar({ label, value, invert = false, danger = 30 }: { label: string; value: number; invert?: boolean; danger?: number }) {
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
  void invert;
}

const STATE_TR: Record<string, string> = {
  idle: 'Boşta',
  wander: 'Dolaşıyor',
  sit: 'Oturuyor',
  lie: 'Yatıyor',
  sleep: 'Uyuyor',
  toBowl: 'Yem kabına gidiyor',
  eat: 'Yiyor',
  toToilet: 'Tuvalete gidiyor',
  toilet: 'Tuvaletini yapıyor',
  toKennel: 'Kulübeye gidiyor',
  toToy: 'Oyuncağa gidiyor',
  play: 'Oynuyor',
  interact: 'Seninle',
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
  const close = (): void => {
    store.panel.value = 'none';
    store.selectedDogId.value = null;
  };
  return (
    <div class="hud side-panel panel">
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
              title="Adı değiştirmek için tıkla"
              onClick={() => {
                setDraft(dog.name);
                setEditing(true);
              }}
            >
              {dog.name} ✎
            </h3>
          )}
          <div class="muted">
            {STAGE_NAMES_TR[dog.stage]} · {dog.ageWeeks} haftalık · {RARITY_NAMES_TR[g.rarity]}
          </div>
          <div class="muted">{STATE_TR[dog.state] ?? dog.state}{dog.sick ? ' · HASTA' : ''}</div>
        </div>
        <button class="btn small close" onClick={close} title="Kapat (Esc)">
          ✕
        </button>
      </div>

      <div class="traits">
        <span>{SIZE_NAMES_TR[g.size]}</span>
        <span>{BODY_NAMES_TR[g.body]}</span>
        <span>{COAT_COLORS[g.coat].name}</span>
        <span>{PATTERN_NAMES_TR[g.pattern]}</span>
        <span>{EAR_NAMES_TR[g.ears]}</span>
        <span>{TAIL_NAMES_TR[g.tail]}</span>
        <span>{TEMPERAMENT_NAMES_TR[g.temperament]}</span>
        <span>Zekâ {g.intelligence}/5</span>
        <span>Enerji {g.energy}/5</span>
      </div>

      <h4>İhtiyaçlar · keyif {dog.mood()}</h4>
      <Bar label="Tokluk" value={100 - n.hunger} />
      <Bar label="Keyif" value={n.play} />
      <Bar label="Rahatlık" value={100 - n.bladder} danger={20} />
      <Bar label="Temizlik" value={n.hygiene} />
      <Bar label="Sağlık" value={n.health} danger={40} />
      <Bar label="Sadakat" value={n.loyalty} danger={0} />
      <Bar label="Enerji" value={n.energy} danger={20} />

      <h4>Eğitim · seviye {dog.trainingLevel()}/6</h4>
      <div class="skills">
        {SKILL_KEYS.map((k) => (
          <label key={k} class={'skill' + (dog.trainingFocus === k ? ' focus' : '') + (dog.skills[k] >= 100 ? ' done' : '')}>
            <input
              type="radio"
              name="focus"
              checked={dog.trainingFocus === k}
              onChange={() => sim.command({ type: 'setTrainingFocus', id: dog.id, skill: dog.trainingFocus === k ? null : k })}
            />
            <span class="skill-name">{SKILL_NAMES_TR[k]}</span>
            <div class="bar mini">
              <div class="fill" style={{ width: `${dog.skills[k]}%` }} />
            </div>
            <span class="need-value">{Math.floor(dog.skills[k])}</span>
          </label>
        ))}
        <div class="muted small-text">Odak seçmezsen önce tuvalet eğitimi çalışılır.</div>
      </div>

      <h4>Kulübe</h4>
      <div class="row">
        <select
          value={dog.kennelId ?? ''}
          onChange={(e) => {
            const v = (e.target as HTMLSelectElement).value;
            sim.command({ type: 'assignKennel', dogId: dog.id, buildingId: v === '' ? null : Number(v) });
          }}
        >
          <option value="">Kulübesiz</option>
          {kennels.map((b) => (
            <option key={b.id} value={b.id}>
              {buildingDef(b).name} #{b.id} ({b.occupants.length}/{buildingDef(b).capacity})
            </option>
          ))}
        </select>
        {kennel && (
          <button class="btn small" onClick={() => app.focusTile(kennel.x, kennel.y)}>
            Göster
          </button>
        )}
      </div>
      <div class="row">
        <button class="btn small" onClick={() => app.focusTile(dog.tileX, dog.tileY)}>
          Köpeğe git (kamera)
        </button>
      </div>
    </div>
  );
}
