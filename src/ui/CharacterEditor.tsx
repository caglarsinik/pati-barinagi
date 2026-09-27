import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { t } from '../i18n';
import { styleFromLook } from '../render/HumanPainter';
import { LOOK_FIELD_NAMES_TR, LOOK_KEYS, PLAYER_NAME_MAX, type PlayerLook, hexCss, lookKey, lookOptionColor, lookOptionName, stepLook } from '../sim/entities/PlayerLook';
import { HumanPortrait } from './HumanPortrait';
import { store } from './store';

/** Önizleme dönüş sırası: ön, sol, arka, sağ. Yürüyüş kareleri 250 ms'de bir, yön ~1,25 sn'de bir. */
const TURN_DIRS = [0, 1, 3, 2] as const;
const WALK_FRAMES = [0, 1, 0, 2] as const;
const TICK_MS = 250;
const TICKS_PER_DIR = 5;
const MANUAL_MS = 5000;

/**
 * Karakter düzenleyici (0.24.1): solda dönen canlı önizleme, ◀ ▶ ve ad; sağda başlık ve 11 seçici. Tam olarak iki çocuk
 * (`.char-left`, `.char-right`) verir ki kısa ekranda kartın iki sütun kuralı uygulansın. Karakter ekranı ve (0.24.2) Ayarlar
 * penceresi ortak kullanır; düğmeler `actions` ile dışarıdan gelir.
 */
export function CharacterEditor({
  look,
  name,
  onLook,
  onName,
  onSubmit,
  title,
  actions,
}: {
  look: PlayerLook;
  name: string;
  /** Yeni görünüm ya da öncekinden türeten güncelleyici (art arda tıklamalar kaybolmasın; `useState` setter'ı doğrudan verilebilir). */
  onLook: (next: PlayerLook | ((prev: PlayerLook) => PlayerLook)) => void;
  onName: (name: string) => void;
  onSubmit?: () => void;
  title?: string;
  actions?: ComponentChildren;
}) {
  const [tick, setTick] = useState(0);
  const [manual, setManual] = useState<{ dir: number; until: number } | null>(null);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), TICK_MS);
    return () => clearInterval(id);
  }, []);
  const frame = WALK_FRAMES[tick % WALK_FRAMES.length];
  const autoDir = TURN_DIRS[Math.floor(tick / TICKS_PER_DIR) % TURN_DIRS.length];
  const dir = manual && Date.now() < manual.until ? manual.dir : autoDir;
  const turn = (d: 1 | -1): void => {
    const i = TURN_DIRS.indexOf(dir as (typeof TURN_DIRS)[number]);
    setManual({ dir: TURN_DIRS[(i + d + TURN_DIRS.length) % TURN_DIRS.length], until: Date.now() + MANUAL_MS });
  };
  const sig = lookKey(look);
  return (
    <>
      <div class="char-left">
        {title && <h2>{title}</h2>}
        <div class="char-preview" data-look={sig}>
          <HumanPortrait style={styleFromLook(look)} sig={sig} dir={dir} frame={frame} scale={5} class="char-canvas" />
        </div>
        <div class="row char-turn">
          <button class="btn small" data-char="turn-l" onClick={() => turn(-1)} aria-label={t('Sola döndür')}>
            ◀
          </button>
          <button class="btn small" data-char="turn-r" onClick={() => turn(1)} aria-label={t('Sağa döndür')}>
            ▶
          </button>
        </div>
        <label class="field">
          <span>{t('Adın')}</span>
          <input
            value={name}
            maxLength={PLAYER_NAME_MAX}
            placeholder={t('Bakıcı')}
            data-char="name"
            onInput={(e) => onName((e.target as HTMLInputElement).value)}
            onFocus={() => (store.inputFocused.value = true)}
            onBlur={() => (store.inputFocused.value = false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                (e.target as HTMLInputElement).blur();
                onSubmit?.();
              } else if (e.key === 'Escape') (e.target as HTMLInputElement).blur();
            }}
          />
        </label>
        {actions}
      </div>
      <div class="char-right">
        <div class="char-opts">
          {LOOK_KEYS.map((k) => {
            const color = lookOptionColor(k, look[k]);
            return (
              <div class="char-opt" data-char={k} key={k}>
                <span class="char-label">{t(LOOK_FIELD_NAMES_TR[k])}</span>
                <div class="stepper">
                  <button class="btn small prev" onClick={() => onLook((prev) => stepLook(prev, k, -1))} aria-label="◀">
                    ◀
                  </button>
                  <span class="char-value">
                    {color !== null && <i class="swatch" style={{ background: hexCss(color) }} />}
                    {t(lookOptionName(k, look[k]))}
                  </span>
                  <button class="btn small next" onClick={() => onLook((prev) => stepLook(prev, k, 1))} aria-label="▶">
                    ▶
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
