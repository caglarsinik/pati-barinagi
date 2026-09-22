import { useRef, useState } from 'preact/hooks';
import { app } from '../app';
import { BALANCE } from '../config/balance';
import { t } from '../i18n';
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
import { maxStaff } from '../sim/systems/StaffSystem';
import { xpForLevel } from '../sim/entities/Staff';

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
          <span>{t(ATTR_NAMES_TR[k])}</span>
          <Dots value={attrs[k]} />
        </div>
      ))}
    </div>
  );
}

function Traits({ staff }: { staff: Staff }) {
  if (staff.traits.length === 0) return <span class="muted small-text">{t('Özel bir huyu yok')}</span>;
  return (
    <div class="traits">
      {staff.traits.map((x) => (
        <span key={x} title={t(TRAIT_INFO_TR[x].desc)}>
          {t(TRAIT_INFO_TR[x].name)}
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
    if (s.courseUntil !== null) return t('Kursta');
    if (s.volunteer && !s.onDuty && sim.clock.weekday < 5) return t('Hafta sonu gelir');
    const tk = s.taskId !== null ? sim.tasks.byId(s.taskId) : undefined;
    if (!tk) return t(STATE_TR[s.state]);
    const target = tk.targetId !== null ? sim.dogById(tk.targetId)?.name ?? (sim.buildingById(tk.targetId) ? t('yem kabı') : '') : `(${tk.tile.x},${tk.tile.y})`;
    return `${t(STATE_TR[s.state])}: ${t(TASK_NAMES_TR[tk.type])} ${target}`;
  };
  return (
    <div class="overlay">
      <div class="menu-card panel wide">
        <div class="panel-head">
          <h2>{t('Personel ({n}/{max}) · haftalık maaş {wages}', { n: sim.staff.length, max: maxStaff(sim), wages: formatMoney(sim.weeklyWages()) })}</h2>
          <button class="btn small" onClick={() => (store.panel.value = 'deployment')}>
            {t('Görevlendirme')}
          </button>
          <button class="btn small close" onClick={() => (store.panel.value = 'none')}>
            ✕
          </button>
        </div>
        {sim.staff.length === 0 && <p class="muted">{t('Henüz personel yok. Aşağıdaki adaylardan işe al; maaşlar her Pazartesi ödenir.')}</p>}
        <div class="staff-list">
          {sim.staff.map((s) => (
            <div key={s.id} class="staff-card">
              <div class="staff-head">
                <b>{s.name}</b> <span class={`role role-${s.role}`}>{t(ROLE_NAMES_TR[s.role])}</span>{' '}
                <span class="staff-level" title={t('Seviye: görev tamamladıkça deneyim kazanır; her seviyede ana niteliği artar')}>
                  {t('Sv{n}', { n: s.level })} {'★'.repeat(s.level)}
                </span>
                {s.volunteer && <span class="role role-volunteer">{t('Gönüllü')}</span>}
                <span class="spacer" />
                <span class="muted small-text">{s.volunteer ? t('maaşsız · {n} hafta kaldı', { n: s.volunteerWeeksLeft }) : t('{wage}/hafta', { wage: formatMoney(s.wage) })}</span>
                <button class="btn small danger" onClick={() => run(sim.command({ type: 'fire', staffId: s.id }))} title={t('1 haftalık tazminat ödenir')}>
                  {t('İşten çıkar')}
                </button>
              </div>
              <div class="small-text">{task(s)}</div>
              <div class="need">
                <span class="need-label">{t('Enerji')}</span>
                <div class="bar">
                  <div class={'fill' + (s.energy < 25 ? ' bad' : '')} style={{ width: `${s.energy}%` }} />
                </div>
                <span class="need-value">{Math.round(s.energy)}</span>
              </div>
              <div class="need" title={t('Moral: yorgun çalışmak, iş yükü ve ödenmemiş maaşla düşer; mola odası, izin ve seviye atlamak yükseltir. 30 altında verim düşer, 3 gün 10 altında kalan istifa eder.')}>
                <span class="need-label">{t('Moral')}</span>
                <div class="bar">
                  <div class={'fill' + (s.morale < BALANCE.staff.morale.lowBelow ? ' bad' : '')} style={{ width: `${s.morale}%` }} />
                </div>
                <span class="need-value">{Math.round(s.morale)}</span>
              </div>
              {s.level < BALANCE.staff.progress.maxLevel && (
                <div class="row">
                  <span class="muted small-text">{t('Deneyim {xp}/{need}', { xp: Math.floor(s.xp), need: xpForLevel(s.level) })}</span>
                  {!s.volunteer &&
                    (s.courseUntil !== null ? (
                      <span class="muted small-text">{t('Kursta: yarın döner')}</span>
                    ) : (
                      <button class="btn small" disabled={sim.money < BALANCE.staff.course.cost} title={t('Bir gün yok olur, dönünce bir seviye atlar')} onClick={() => run(sim.command({ type: 'sendToCourse', staffId: s.id }))}>
                        {t('Kursa gönder ({cost})', { cost: formatMoney(BALANCE.staff.course.cost) })}
                      </button>
                    ))}
                </div>
              )}
              <Attrs attrs={s.attrs} />
              <Traits staff={s} />
              {s.unpaidWeeks > 0 && <div class="bad small-text">{t('Maaşı ödenmedi: istifa edebilir')}</div>}
            </div>
          ))}
        </div>
        {sim.volunteerOffer && (
          <>
            <h4>{t('Gönüllü başvurusu (Pazartesiye kadar)')}</h4>
            <div class="staff-list">
              <div class="staff-card candidate">
                <div class="staff-head">
                  <b>{sim.volunteerOffer.name}</b> <span class={`role role-${sim.volunteerOffer.role}`}>{t(ROLE_NAMES_TR[sim.volunteerOffer.role])}</span>{' '}
                  <span class="role role-volunteer">{t('Gönüllü')}</span>
                  <span class="spacer" />
                  <button class="btn small primary" disabled={sim.staff.length >= maxStaff(sim)} onClick={() => run(sim.command({ type: 'acceptVolunteer' }))}>
                    {t('Kabul et · maaşsız, {n} hafta, hafta sonları', { n: BALANCE.staff.volunteer.weeks })}
                  </button>
                </div>
                <Attrs attrs={sim.volunteerOffer.attrs} />
                <Traits staff={sim.volunteerOffer} />
              </div>
            </div>
          </>
        )}
        <h4>{t('Bugünün adayları (her sabah yenilenir)')}</h4>
        <div class="staff-list">
          {sim.candidates.map((c) => (
            <div key={c.id} class="staff-card candidate">
              <div class="staff-head">
                <b>{c.name}</b> <span class={`role role-${c.role}`}>{t(ROLE_NAMES_TR[c.role])}</span>
                <span class="spacer" />
                <button class="btn small primary" disabled={sim.staff.length >= maxStaff(sim)} onClick={() => run(sim.command({ type: 'hire', candidateId: c.id }))}>
                  {t('İşe al · {wage}/hafta', { wage: formatMoney(c.wage) })}
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
  /** Sürükleyerek boyama: pointer yakalama ile (fare ve dokunmatik); stale closure olmasın diye ref. */
  const drag = useRef(false);
  /** Son boyanan hücre: hızlı kaydırmada atlanan saatler de doldurulur. */
  const last = useRef<{ staff: number; hour: number } | null>(null);
  if (!sim) return null;
  const hour = sim.clock.hour;
  const tasks = sim.tasks.tasks;
  const wait = sim.tasks.longestWait();
  const setShift = (s: Staff, h: number): void => {
    if (s.schedule[h] !== paint) sim.command({ type: 'setShift', staffId: s.id, hour: h, value: paint });
  };
  const kindName = (k: ShiftKind): string => (k === 1 ? t('çalış') : k === 2 ? t('mola') : t('izin'));
  const cellAt = (e: PointerEvent): HTMLElement | null => (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>('[data-hour]') ?? null;
  const paintCell = (cell: HTMLElement): void => {
    const s = sim.staffById(Number(cell.dataset.staff));
    const h = Number(cell.dataset.hour);
    if (!s || !Number.isInteger(h)) return;
    const prev = last.current;
    if (prev && prev.staff === s.id && Math.abs(prev.hour - h) > 1) {
      const step = h > prev.hour ? 1 : -1;
      for (let x = prev.hour + step; x !== h; x += step) setShift(s, x);
    }
    setShift(s, h);
    last.current = { staff: s.id, hour: h };
  };
  const compact = store.layout.value !== 'desktop';
  return (
    <div class="overlay">
      <div class="menu-card panel wide deployment">
        <div class="panel-head">
          <h2>{t('Görevlendirme')}</h2>
          <div class="build-tabs">
            <button class={'btn small' + (tab === 'shift' ? ' active' : '')} onClick={() => setTab('shift')}>
              {t('Vardiya')}
            </button>
            <button class={'btn small' + (tab === 'priority' ? ' active' : '')} onClick={() => setTab('priority')}>
              {t('Öncelikler')}
            </button>
            <button class={'btn small' + (tab === 'policy' ? ' active' : '')} onClick={() => setTab('policy')}>
              {t('Politikalar')}
            </button>
          </div>
          <button class="btn small" onClick={() => (store.panel.value = 'staff')}>
            {t('Personel')}
          </button>
          <button class="btn small close" onClick={() => (store.panel.value = 'none')}>
            ✕
          </button>
        </div>

        {sim.staff.length === 0 && <p class="muted">{t('Personel yok. Önce Personel panelinden birini işe al.')}</p>}

        {tab === 'shift' && sim.staff.length > 0 && (
          <div class="shift-editor">
            <div class="row">
              <span class="muted small-text">{t('Boya:')}</span>
              {([1, 2, 0] as ShiftKind[]).map((k) => (
                <button key={k} class={`btn small shift-${k}` + (paint === k ? ' active' : '')} onClick={() => setPaint(k)}>
                  {k === 1 ? t('Çalış') : k === 2 ? t('Mola') : t('İzin')}
                </button>
              ))}
              <span class="muted small-text">{t('Sürükleyerek boya · şablon:')}</span>
              {(['day', 'night', 'full'] as const).map((kind) => (
                <button
                  key={kind}
                  class="btn small"
                  onClick={() => {
                    for (const s of sim.staff) sim.command({ type: 'setSchedule', staffId: s.id, schedule: defaultSchedule(kind) });
                  }}
                >
                  {kind === 'day' ? t('Gündüz 08-18') : kind === 'night' ? t('Gece 20-06') : t('Tam gün 06-22')}
                </button>
              ))}
            </div>
            <div
              class="shift-grid"
              style={{ gridTemplateColumns: 'minmax(80px, 140px) repeat(24, minmax(12px, 1fr))', touchAction: 'none' }}
              onPointerDown={(e) => {
                const cell = cellAt(e);
                if (!cell) return;
                drag.current = true;
                last.current = null;
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                paintCell(cell);
              }}
              onPointerMove={(e) => {
                if (!drag.current) return;
                const cell = cellAt(e);
                if (cell) paintCell(cell);
              }}
              onPointerUp={() => {
                drag.current = false;
              }}
              onPointerCancel={() => {
                drag.current = false;
              }}
            >
              <div />
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} class={'shift-hour' + (h === hour ? ' now' : '')}>
                  {h}
                </div>
              ))}
              {sim.staff.map((s) => (
                <>
                  <div key={`n${s.id}`} class="shift-name">
                    {s.name} <span class="muted small-text">{t(ROLE_NAMES_TR[s.role])}</span>
                  </div>
                  {s.schedule.map((v, h) => (
                    <div
                      key={`${s.id}-${h}`}
                      data-staff={s.id}
                      data-hour={h}
                      class={`shift-cell shift-${v}` + (h === hour ? ' now' : '')}
                      title={t('{name} · {h}:00 · {kind}', { name: s.name, h, kind: kindName(v) })}
                    />
                  ))}
                </>
              ))}
            </div>
            <p class="muted small-text">{t('Mesai dışı personel görünmez; vardiya başlayınca kapıdan gelir. Enerjisi bitince personel odasında mola verir.')}</p>
          </div>
        )}

        {tab === 'priority' && sim.staff.length > 0 && compact && (
          <div class="prio-cards">
            {sim.staff.map((s) => (
              <div key={s.id} class="staff-card">
                <div class="staff-head">
                  <b>{s.name}</b> <span class="muted small-text">{t(ROLE_NAMES_TR[s.role])}</span>
                </div>
                {TASK_TYPES.map((x) => {
                  const can = ROLE_EFFICIENCY[s.role][x] > 0;
                  const v = s.priorities[x];
                  return (
                    <div key={x} class="prio-row">
                      <span class="prio-task">{t(TASK_NAMES_TR[x])}</span>
                      {can ? (
                        <div class="stepper">
                          <button class="btn small" disabled={v <= 0} onClick={() => sim.command({ type: 'setPriority', staffId: s.id, task: x, value: v - 1 })}>
                            −
                          </button>
                          <span class={'stepper-value' + (v === 0 ? ' off' : '')}>{v === 0 ? t('Kapalı') : v}</span>
                          <button class="btn small" disabled={v >= 5} onClick={() => sim.command({ type: 'setPriority', staffId: s.id, task: x, value: v + 1 })}>
                            +
                          </button>
                        </div>
                      ) : (
                        <span class="muted small-text">{t('yapamaz')}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {tab === 'priority' && sim.staff.length > 0 && !compact && (
          <div class="priority-grid" style={{ gridTemplateColumns: `160px repeat(${TASK_TYPES.length}, 1fr)` }}>
            <div />
            {TASK_TYPES.map((x) => (
              <div key={x} class="prio-head">
                {t(TASK_NAMES_TR[x])}
              </div>
            ))}
            {sim.staff.map((s) => (
              <>
                <div key={`p${s.id}`} class="shift-name">
                  {s.name} <span class="muted small-text">{t(ROLE_NAMES_TR[s.role])}</span>
                </div>
                {TASK_TYPES.map((x) => {
                  const can = ROLE_EFFICIENCY[s.role][x] > 0;
                  return (
                    <div key={`${s.id}-${x}`} class="prio-cell">
                      {can ? (
                        <div class="prio-buttons">
                          {[0, 1, 2, 3, 4, 5].map((v) => (
                            <button
                              key={v}
                              class={'prio' + (s.priorities[x] === v ? ' active' : '') + (v === 0 ? ' off' : '')}
                              onClick={() => sim.command({ type: 'setPriority', staffId: s.id, task: x, value: v })}
                              title={v === 0 ? t('Kapalı') : t('Öncelik {n}', { n: v })}
                            >
                              {v === 0 ? '×' : v}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span class="muted small-text">{t('yapamaz')}</span>
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
              <span>{t('Yem stoğu eşiğin altına inince otomatik çuval sipariş et (+{fee} ₺ teslimat)', { fee: BALANCE.economy.deliveryFee })}</span>
              <input
                type="number"
                min={0}
                max={200}
                value={sim.policies.foodThreshold}
                onFocus={() => (store.inputFocused.value = true)}
                onBlur={() => (store.inputFocused.value = false)}
                onInput={(e) => sim.command({ type: 'setPolicy', policy: { foodThreshold: Number((e.target as HTMLInputElement).value) } })}
              />
              <span class="muted small-text">{t('porsiyon')}</span>
            </label>
            <label class="policy">
              <span>{t('Eğitmenler köpekleri şu beceri seviyesine kadar çalıştırsın:')}</span>
              <select value={sim.policies.trainTarget} onChange={(e) => sim.command({ type: 'setPolicy', policy: { trainTarget: Number((e.target as HTMLSelectElement).value) } })}>
                {[0, 1, 2, 3, 4, 5, 6].map((v) => (
                  <option key={v} value={v}>
                    {v === 0 ? t('Eğitme') : t('{n} beceri', { n: v })}
                  </option>
                ))}
              </select>
            </label>
            <label class="policy">
              <input type="checkbox" checked={sim.policies.quarantineSick} onChange={(e) => sim.command({ type: 'setPolicy', policy: { quarantineSick: (e.target as HTMLInputElement).checked } })} />
              <span>{t('Bulaşıcı hastalığı olan köpek karantina alanında kalsın (bulaşmayı keser; alan yoksa Z ile boya)')}</span>
            </label>
            <label class="policy">
              <input type="checkbox" checked={sim.policies.adoptionsOpen} onChange={(e) => sim.command({ type: 'setPolicy', policy: { adoptionsOpen: (e.target as HTMLInputElement).checked } })} />
              <span>{t('Sahiplendirmeye açık (kapalıyken sahiplenici gelmez)')}</span>
            </label>
            <p class="muted small-text">
              {t(
                'Öğün saatleri {hours}:00; bu saatlerde yem görevleri öne çıkar. Temizlik her pislikte, tımar temizlik {g} altına inince, tedavi sağlık {t} altına inince görev olur.',
                { hours: BALANCE.time.mealHours.join(':00 / '), g: BALANCE.staff.groomBelow, t: BALANCE.staff.treatBelow },
              )}
            </p>
          </div>
        )}

        <h4>{t('Görev tahtası ({n})', { n: tasks.length })}</h4>
        {wait && wait.minutes > 180 && sim.staff.length > 0 && (
          <div class="bad small-text">{t('Darboğaz: bazı görevler {h} saattir bekliyor. Personel al ya da öncelikleri değiştir.', { h: Math.round(wait.minutes / 60) })}</div>
        )}
        <div class="task-board">
          {tasks.length === 0 && <span class="muted small-text">{t('Şu an bekleyen iş yok.')}</span>}
          {tasks.slice(0, 24).map((tk) => {
            const who = tk.claimedBy !== null ? sim.staffById(tk.claimedBy)?.name : null;
            const target = tk.targetId !== null ? sim.dogById(tk.targetId)?.name ?? (sim.buildingById(tk.targetId) ? t('yem kabı') : '') : t('pislik');
            return (
              <div key={tk.id} class={'task' + (who ? ' claimed' : '')} title={t('aciliyet {u}', { u: tk.urgency.toFixed(2) })}>
                <b>{t(TASK_NAMES_TR[tk.type])}</b> {target}
                <span class="muted small-text">{who ? ` · ${who}` : ` · ${t('{n} dk bekliyor', { n: Math.round(sim.clock.totalMinutes - tk.createdAt) })}`}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
