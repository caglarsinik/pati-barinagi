import { useEffect, useState } from 'preact/hooks';
import { app } from '../app';
import { audio } from '../audio/audio';
import { t } from '../i18n';
import { ADOPTER_TYPES } from '../sim/entities/AdopterType';
import type { GrowthStage } from '../sim/entities/Dog';
import type { DogGenome } from '../sim/entities/DogGenome';
import type { Letter, PhotoScene } from '../sim/systems/MailSystem';
import { DogPortrait } from './DogPortrait';
import { formatMoney } from './format';
import { store } from './store';

/** Fotoğraf sahnesinin süsü (arka plan degradesi CSS'te). */
const SCENE_PROPS: Record<PhotoScene, string> = {
  garden: '🌻🏡',
  park: '🌳🐦',
  beach: '⛱️🌊',
  sofa: '🛋️📚',
  farm: '🌾🐑',
  studio: '🎨🖼️',
  village: '⛲🏘️',
};

/** Polaroid fotoğraf: köpek yeni evinde (mektupta büyük, albümde küçük; görünümü yoksa pati silüeti). */
export function ScenePhoto({
  scene,
  genome,
  stage,
  genome2,
  stage2,
  caption,
  small = false,
}: {
  scene: PhotoScene;
  genome?: DogGenome;
  stage?: GrowthStage;
  /** İkili sahiplendirmede öbür köpek (0.21.4): iki köpek yan yana. */
  genome2?: DogGenome;
  stage2?: GrowthStage;
  caption: string;
  small?: boolean;
}) {
  const scale = small ? (genome2 ? 1.6 : 2) : genome2 ? 2.4 : 3;
  return (
    <div class={'photo scene-' + scene + (small ? ' small' : '') + (genome2 ? ' two' : '')}>
      <div class="photo-scene">
        <span class="photo-props">{SCENE_PROPS[scene]}</span>
        {genome ? <DogPortrait genome={genome} stage={stage ?? 'adult'} scale={scale} /> : <span class="photo-paw">🐾</span>}
        {genome2 && <DogPortrait genome={genome2} stage={stage2 ?? 'adult'} scale={scale} />}
      </div>
      <span class="photo-caption">{caption}</span>
    </div>
  );
}

export function LetterPhoto({ letter }: { letter: Letter }) {
  return (
    <ScenePhoto
      scene={letter.scene}
      genome={letter.genome}
      stage={letter.stage}
      genome2={letter.genome2}
      stage2={letter.stage2}
      caption={letter.dog2 ? letter.dogName + ' & ' + letter.dog2 : letter.dogName}
    />
  );
}

/** Posta (0.21.1): sahiplendirilen köpeklerin ailelerinden gelen fotoğraflı mektuplar; açılan mektup okundu sayılır. */
export function MailPanel() {
  store.tick.value;
  store.lang.value;
  const [openId, setOpen] = useState<number | null>(null);
  const [, bump] = useState(0);
  const sim = app.sim;
  const letters = sim ? [...sim.mail.list].reverse() : [];
  const open = letters.find((l) => l.id === openId) ?? letters.find((l) => !l.read) ?? letters[0] ?? null;
  useEffect(() => {
    if (!open) return;
    // Kendiliğinden seçilen mektup sabitlenir; yoksa okundu sayılınca sıradaki okunmamışa atlanıp hepsi okunurdu.
    if (openId !== open.id) setOpen(open.id);
    if (open.read) return;
    app.sim?.command({ type: 'readMail', id: open.id });
    bump((n) => n + 1);
  }, [open?.id]);
  if (!sim) return null;
  const unread = sim.mail.unread();
  return (
    <div class="overlay">
      <div class="menu-card panel wide mail">
        <div class="panel-head">
          <h2>{unread > 0 ? t('📬 Posta ({n} yeni)', { n: unread }) : t('📬 Posta')}</h2>
          {unread > 0 && (
            <button
              class="btn small"
              onClick={() => {
                sim.command({ type: 'readMail' });
                audio.play('click');
                bump((n) => n + 1);
              }}
            >
              {t('Tümü okundu')}
            </button>
          )}
          <button class="btn small close" onClick={() => (store.panel.value = 'none')}>
            ✕
          </button>
        </div>
        {!open && <p class="muted">{t('Henüz mektup yok. Sahiplendirdiğin köpeklerin aileleri birkaç gün sonra yazar.')}</p>}
        {open && (
          <div class="adopt-layout">
            <div class="adopter-list">
              {letters.map((l) => (
                <button key={l.id} class={'adopter-card' + (l.id === open.id ? ' active' : '') + (l.read ? '' : ' unread')} onClick={() => setOpen(l.id)}>
                  <div class="adopter-name">
                    {l.read ? '✉️' : '📩'} <b>{l.dogName}</b>
                    {l.dog2 ? ' 💞 ' + l.dog2 : ''}
                    {l.donation > 0 && <span class="small-text"> · +{formatMoney(l.donation)}</span>}
                  </div>
                  <div class="muted small-text">
                    {l.type ? ADOPTER_TYPES[l.type].icon + ' ' : ''}
                    {l.from} · {t('{n}. gün', { n: l.day })}
                  </div>
                </button>
              ))}
            </div>
            <div class="letter-view">
              <LetterPhoto letter={open} />
              <div class="letter-body">
                <p class="letter-text">“{sim.mail.text(open)}”</p>
                <p class="muted small-text">
                  — {open.from}
                  {open.type ? ' · ' + t(ADOPTER_TYPES[open.type].name) : ''}
                </p>
                {open.donation > 0 && <p class="small-text">{t('💝 Mektupla birlikte {money} bağış geldi.', { money: formatMoney(open.donation) })}</p>}
                <button class="btn small" onClick={() => (store.panel.value = 'album')}>
                  {t('📖 Albümde gör')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
