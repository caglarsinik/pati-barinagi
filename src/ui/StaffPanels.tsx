import { useState } from 'preact/hooks';
import { app } from '../app';
import { BALANCE } from '../config/balance';
import {
  ATTR_NAMES_TR,
  ROLE_EFFICIENCY,
  ROLE_NAMES_TR,
  type ShiftKind,
  type Staff,
  type StaffAttrs,
  TASK_NAMES_TR,
  TASK_TYPES,
  TRAIT_INFO_TR,
  defaultSchedule,
} from '../sim/entities/Staff';
import { formatMoney } from './HUD';
import { showToast, store } from './store';

const STATE_TR: Record<Staff['state'], string> = {
  offDuty: 'Mesai dışı',
  idle: 'İş bekliyor',
  toTask: 'İşe gidiyor',
  working: 'Çalışıyor',
  toRest: 'Molaya gidiyor',
  resting: 'Molada',
  leaving: 'Eve gidiyor',
};

function Dots({ value }: { value: number }) {
  return (
    <span class="dots" title={`${value}/5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} class={'dot' + (i < value ? ' on' : '')} />
      ))}
    </span>
  );
}

function Attrs({ attrs }: { attrs: StaffAttrs }) {
  return (
    <div class="attrs">
      {(Object.keys(ATTR_NAMES_TR) as Array<keyof StaffAttrs>).map((k) => (
        <div key={k} class="attr">
          <span>{ATTR_NAMES_TR[k]}</span>
          <Dots value={attrs[k]} />
        </div>
      ))}
    </div>
  );
}

function Traits({ staff }: { staff: Staff }) {
  if (staff.traits.length === 0) return <span class="muted small-text">Özel bir huyu yok</span>;
  return (
    <div class="traits">
      {staff.traits.map((t) => (
        <span key={t} title={TRAIT_INFO_TR[t].desc}>
          {TRAIT_INFO_TR[t].name}
        </span>
      ))}
    </div>
  );
}

function run(r: { ok: boolean; message?: string }): void {
  if (r.message) showToast(r.message);
}

/** Personel listesi ve işe alma. */
export function StaffPanel() {
  store.tick.value;
  const sim = app.sim;
  if (!sim) return null;
  const task = (s: Staff): string => {
    const t = s.taskId !== null ? sim.tasks.byId(s.taskId) : undefined;
    if (!t) return STATE_TR[s.state];
    const target = t.targetId !== null ? sim.dogById(t.targetId)?.name ?? sim.buildingById(t.targetId)?.type ?? '' : `(${t.tile.x},${t.tile.y})`;
    return `${STATE_TR[s.state]}: ${TASK_NAMES_TR[t.type]} ${target}`;
  };
  return (
    <div class="overlay">
      <div class="menu-card panel wide">
        <div class="panel-head">
          <h2>
            Personel ({sim.staff.length}/{BALANCE.staff.maxStaff}) · haftalık maaş {formatMoney(sim.weeklyWages())}
          </h2>
          <button class="btn small" onClick={() => (store.panel.value = 'deployment')}>
            Görevlendirme (F)
          </button>
          <button class="btn small close" onClick={() => (store.panel.value = 'none')}>
            ✕
          </button>
        </div>
        {sim.staff.length === 0 && <p class="muted">Henüz personel yok. Aşağıdaki adaylardan işe al; maaşlar her Pazartesi ödenir.</p>}
        <div class="staff-list">
          {sim.staff.map((s) => (
            <div key={s.id} class="staff-card">
              <div class="staff-head">
                <b>{s.name}</b> <span class={`role role-${s.role}`}>{ROLE_NAMES_TR[s.role]}</span>
                <span class="spacer" />
                <span class="muted small-text">{formatMoney(s.wage)}/hafta</span>
                <button class="btn small danger" onClick={() => run(sim.command({ type: 'fire', staffId: s.id }))} title="1 haftalık tazminat ödenir">
                  İşten çıkar
                </button>
              </div>
              <div class="small-text">{task(s)}</div>
              <div class="need">
                <span class="need-label">Enerji</span>
                <div class="bar">
                  <div class={'fill' + (s.energy < 25 ? ' bad' : '')} style={{ width: `${s.energy}%` }} />
                </div>
                <span class="need-value">{Math.round(s.energy)}</span>
              </div>
              <Attrs attrs={s.attrs} />
              <Traits staff={s} />
              {s.unpaidWeeks > 0 && <div class="bad small-text">Maaşı ödenmedi: istifa edebilir</div>}
            </div>
          ))}
        </div>
        <h4>Bugünün adayları (her sabah yenilenir)</h4>
        <div class="staff-list">
          {sim.candidates.map((c) => (
            <div key={c.id} class="staff-card candidate">
              <div class="staff-head">
                <b>{c.name}</b> <span class={`role role-${c.role}`}>{ROLE_NAMES_TR[c.role]}</span>
                <span class="spacer" />
                <button class="btn small primary" disabled={sim.staff.length >= BALANCE.staff.maxStaff} onClick={() => run(sim.command({ type: 'hire', candidateId: c.id }))}>
                  İşe al · {formatMoney(c.wage)}/hafta
                </button>
              </div>
              <Attrs attrs={c.attrs} />
              <Traits staff={c} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

type Tab = 'shift' | 'priority' | 'policy';

/** Görevlendirme: vardiya çizelgesi, öncelikler, politikalar ve canlı görev tahtası. */
export function DeploymentPanel() {
  store.tick.value;
  const sim = app.sim;
  const [tab, setTab] = useState<Tab>('shift');
  const [paint, setPaint] = useState<ShiftKind>(1);
  const [dragging, setDragging] = useState(false);
  if (!sim) return null;
  const hour = sim.clock.hour;
  const tasks = sim.tasks.tasks;
  const wait = sim.tasks.longestWait();
  const setShift = (s: Staff, h: number): void => {
    if (s.schedule[h] !== paint) sim.command({ type: 'setShift', staffId: s.id, hour: h, value: paint });
  };
  return (
    <div class="overlay">
      <div class="menu-card panel wide deployment">
        <div class="panel-head">
          <h2>Görevlendirme</h2>
          <div class="build-tabs">
            <button class={'btn small' + (tab === 'shift' ? ' active' : '')} onClick={() => setTab('shift')}>
              Vardiya
            </button>
            <button class={'btn small' + (tab === 'priority' ? ' active' : '')} onClick={() => setTab('priority')}>
              Öncelikler
            </button>
            <button class={'btn small' + (tab === 'policy' ? ' active' : '')} onClick={() => setTab('policy')}>
              Politikalar
            </button>
          </div>
          <button class="btn small" onClick={() => (store.panel.value = 'staff')}>
            Personel (P)
          </button>
          <button class="btn small close" onClick={() => (store.panel.value = 'none')}>
            ✕
          </button>
        </div>

        {sim.staff.length === 0 && <p class="muted">Personel yok. Önce Personel panelinden birini işe al.</p>}

        {tab === 'shift' && sim.staff.length > 0 && (
          <div class="shift-editor" onMouseLeave={() => setDragging(false)}>
            <div class="row">
              <span class="muted small-text">Boya:</span>
              {([1, 2, 0] as ShiftKind[]).map((k) => (
                <button key={k} class={`btn small shift-${k}` + (paint === k ? ' active' : '')} onClick={() => setPaint(k)}>
                  {k === 1 ? 'Çalış' : k === 2 ? 'Mola' : 'İzin'}
                </button>
              ))}
              <span class="muted small-text">Sürükleyerek boya · şablon:</span>
              {(['day', 'night', 'full'] as const).map((kind) => (
                <button
                  key={kind}
                  class="btn small"
                  onClick={() => {
                    for (const s of sim.staff) sim.command({ type: 'setSchedule', staffId: s.id, schedule: defaultSchedule(kind) });
                  }}
                >
                  {kind === 'day' ? 'Gündüz 08-18' : kind === 'night' ? 'Gece 20-06' : 'Tam gün 06-22'}
                </button>
              ))}
            </div>
            <div class="shift-grid" style={{ gridTemplateColumns: `140px repeat(24, 1fr)` }}>
              <div />
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} class={'shift-hour' + (h === hour ? ' now' : '')}>
                  {h}
                </div>
              ))}
              {sim.staff.map((s) => (
                <>
                  <div key={`n${s.id}`} class="shift-name">
                    {s.name} <span class="muted small-text">{ROLE_NAMES_TR[s.role]}</span>
                  </div>
                  {s.schedule.map((v, h) => (
                    <div
                      key={`${s.id}-${h}`}
                      class={`shift-cell shift-${v}` + (h === hour ? ' now' : '')}
                      onMouseDown={() => {
                        setDragging(true);
                        setShift(s, h);
                      }}
                      onMouseEnter={() => {
                        if (dragging) setShift(s, h);
                      }}
                      onMouseUp={() => setDragging(false)}
                      title={`${s.name} · ${h}:00 · ${v === 1 ? 'çalış' : v === 2 ? 'mola' : 'izin'}`}
                    />
                  ))}
                </>
              ))}
            </div>
            <p class="muted small-text">Mesai dışı personel görünmez; vardiya başlayınca kapıdan gelir. Enerjisi bitince personel odasında mola verir.</p>
          </div>
        )}

        {tab === 'priority' && sim.staff.length > 0 && (
          <div class="priority-grid" style={{ gridTemplateColumns: `160px repeat(${TASK_TYPES.length}, 1fr)` }}>
            <div />
            {TASK_TYPES.map((t) => (
              <div key={t} class="prio-head">
                {TASK_NAMES_TR[t]}
              </div>
            ))}
            {sim.staff.map((s) => (
              <>
                <div key={`p${s.id}`} class="shift-name">
                  {s.name} <span class="muted small-text">{ROLE_NAMES_TR[s.role]}</span>
                </div>
                {TASK_TYPES.map((t) => {
                  const can = ROLE_EFFICIENCY[s.role][t] > 0;
                  return (
                    <div key={`${s.id}-${t}`} class="prio-cell">
                      {can ? (
                        <div class="prio-buttons">
                          {[0, 1, 2, 3, 4, 5].map((v) => (
                            <button
                              key={v}
                              class={'prio' + (s.priorities[t] === v ? ' active' : '') + (v === 0 ? ' off' : '')}
                              onClick={() => sim.command({ type: 'setPriority', staffId: s.id, task: t, value: v })}
                              title={v === 0 ? 'Kapalı' : `Öncelik ${v}`}
                            >
                              {v === 0 ? '×' : v}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span class="muted small-text">yapamaz</span>
                      )}
                    </div>
                  );
                })}
              </>
            ))}
          </div>
        )}

        {tab === 'policy' && (
          <div class="policies">
            <label class="policy">
              <input type="checkbox" checked={sim.policies.autoOrderFood} onChange={(e) => sim.command({ type: 'setPolicy', policy: { autoOrderFood: (e.target as HTMLInputElement).checked } })} />
              <span>
                Yem stoğu eşiğin altına inince otomatik çuval sipariş et (+{BALANCE.economy.deliveryFee} ₺ teslimat)
              </span>
              <input
                type="number"
                min={0}
                max={200}
                value={sim.policies.foodThreshold}
                onFocus={() => (store.inputFocused.value = true)}
                onBlur={() => (store.inputFocused.value = false)}
                onInput={(e) => sim.command({ type: 'setPolicy', policy: { foodThreshold: Number((e.target as HTMLInputElement).value) } })}
              />
              <span class="muted small-text">porsiyon</span>
            </label>
            <label class="policy">
              <span>Eğitmenler köpekleri şu beceri seviyesine kadar çalıştırsın:</span>
              <select value={sim.policies.trainTarget} onChange={(e) => sim.command({ type: 'setPolicy', policy: { trainTarget: Number((e.target as HTMLSelectElement).value) } })}>
                {[0, 1, 2, 3, 4, 5, 6].map((v) => (
                  <option key={v} value={v}>
                    {v === 0 ? 'Eğitme' : `${v} beceri`}
                  </option>
                ))}
              </select>
            </label>
            <p class="muted small-text">
              Öğün saatleri {BALANCE.time.mealHours.join(':00 ve ')}:00; bu saatlerde yem görevleri öne çıkar. Temizlik her pislikte, tımar temizlik {BALANCE.staff.groomBelow}
              altına inince, tedavi sağlık {BALANCE.staff.treatBelow} altına inince görev olur.
            </p>
          </div>
        )}

        <h4>Görev tahtası ({tasks.length})</h4>
        {wait && wait.minutes > 180 && sim.staff.length > 0 && <div class="bad small-text">Darboğaz: bazı görevler {Math.round(wait.minutes / 60)} saattir bekliyor. Personel al ya da öncelikleri değiştir.</div>}
        <div class="task-board">
          {tasks.length === 0 && <span class="muted small-text">Şu an bekleyen iş yok.</span>}
          {tasks.slice(0, 24).map((t) => {
            const who = t.claimedBy !== null ? sim.staffById(t.claimedBy)?.name : null;
            const target = t.targetId !== null ? sim.dogById(t.targetId)?.name ?? (sim.buildingById(t.targetId) ? 'yem kabı' : '') : 'pislik';
            return (
              <div key={t.id} class={'task' + (who ? ' claimed' : '')} title={`aciliyet ${t.urgency.toFixed(2)}`}>
                <b>{TASK_NAMES_TR[t.type]}</b> {target}
                <span class="muted small-text">{who ? ` · ${who}` : ` · ${Math.round(sim.clock.totalMinutes - t.createdAt)} dk bekliyor`}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
