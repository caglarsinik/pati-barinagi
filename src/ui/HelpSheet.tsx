import { t } from '../i18n';
import { store } from './store';

/** [tuş, avatar modu, yönetim modu]; Türkçe metinler t() ile çevrilir. */
const ROWS: Array<[string, string, string]> = [
  ['WASD / ok tuşları', 'Yürü', 'Kamerayı kaydır'],
  ['Shift', 'Koş (dayanıklılık harcar)', '–'],
  ['E', 'Baktığın şeye göre iş yap: köpeği sev/oyna/eğit/fırçala, kabı ve yalağı doldur, pisliği temizle, kileri aç, ofise gir (içeride eşyalar)', '–'],
  ['↑ (kapıda basılı tut)', 'Binaya gir (ofis, dinlenme odası, kiler, mutfak, veteriner, kuluçka); E kapıdaki hızlı işi yapar', '–'],
  ['1-6', 'Araç seç: Sev, Oyna, Eğit, Yem, Temizle, Çağır', '–'],
  ['Sol tık', 'Köpeği seç (panel açılır)', 'Köpeği seç · seçili aracı yerleştir · çit/yol/bölge sürükle'],
  ['Sağ tık sürükle', '–', 'Kamerayı kaydır (aracı bırakır)'],
  ['Fare tekeri', 'Yakınlaştır', 'Yakınlaştır'],
  ['Tab', 'Yönetim moduna geç', 'Avatara dön'],
  ['B', 'İnşa çubuğu (yönetim moduna geçer)', 'İnşa çubuğu'],
  ['X / Z', '–', 'Yık aracı / Bölge boyama'],
  ['R', '–', 'Seçili binayı döndür (kare olmayan binalar)'],
  ['I / O / N / P / F / H', 'Köpekler / Sahiplendirme / Finans / Personel / Görevlendirme / Başarımlar', 'Aynı'],
  ['L', 'İsim etiketlerini aç/kapa', 'Aynı'],
  ['M', 'Tam ekran harita: dokunarak işaret koy, işarete git', 'Aynı'],
  ['T', 'Otopilot aç/kapa: barınağın işlerini kendisi yapar (elle müdahale kapatır)', 'Aynı'],
  ['Space', 'Duraklat / devam', 'Aynı'],
  ['+ / -', 'Hız artır / azalt', 'Aynı'],
  ['Esc', 'Paneli kapat / menü', 'Aracı bırak / paneli kapat / menü'],
];

/** [konu, açıklama] İlk adımlar (0.19.3). */
const START_ROWS: Array<[string, string]> = [
  ['Kuruluş', 'Yeni oyunda "Kuruluş" seçilirse küçük arsa, ofis ve ilk köpeğinle başlarsın; kulübe, kap, yalak ve kuluçkayı sen kurarsın.'],
  ['🎯 Hedefler', 'Sol üstteki karta ya da Menü → Hedefler\'e dokun: sıradaki belediye hedefi, ödülü ve "Göster" (aracı ya da paneli açar).'],
  ['Sabah raporu', 'Uyuyunca dünün özeti ve bugünün işleri gelir; kayıttan dönünce "Hoş geldin" kartı. Ayarlar\'dan kapatılır.'],
];

/** [konu, açıklama] Köy ve dünya (0.20.5). */
const WORLD_ROWS: Array<[string, string]> = [
  ['🏘️ Köy', 'Güney yolunun ucunda: yem toptancısı (ucuz çuval), oyuncak ve ilaç dükkânı, Pazar tezgâhı; itibar arttıkça postane ve park açılır.'],
  ['👥 Köylüler', 'Sabah işe, akşam eve giderler; E ile konuş. Köylünün sahiplendiği köpek köyde sahibiyle yaşar.'],
  ['🚏 Tabelalar', 'Barınak kapısının dışında, doğu yolunda ve köy girişinde; görünce keşfedilir, tabelada E ile hızlı seyahat (yol kadar zaman geçer, köpekler de gelir).'],
  ['📋 Görev panosu', 'Köy meydanında; her Pazartesi en çok üç ilan: kayıp köpek, köpek isteği, ödül maması. Panoda kabul et, süresi dolmadan köylüye ya da panoya teslim et.'],
  ['🤖 Otopilot', 'Yalnız barınak işlerini yapar: köy, tabela, köylü ve görev işlerine dokunmaz, barınaktan uzaktaki yuva ve çalılara gitmez.'],
];

/** [hareket, ne yapar] */
const TOUCH_ROWS: Array<[string, string]> = [
  ['Dokun', 'Avatar oraya yürür (yol bulur)'],
  ['Köpeğe / binaya / yuvaya dokun', 'Yanına gidip işini yapar: sev, kabı doldur, yumurta al, temizle'],
  ['Binanın kapı karesine dokun', 'İçeri girer (ofis, dinlenme odası, kiler, mutfak, veteriner, kuluçka); binanın başka yerine dokunmak hızlı işi yapar'],
  ['İçeride eşyaya / kapıya dokun', 'Eşyayı kullanır · paspaslı kapıdan dışarı çıkar'],
  ['Mini haritaya ya da 🗺️ çipine dokun', 'Tam ekran harita: haritaya dokun → işaret; "Git" ile oraya yürü'],
  ['Uzun bas', 'Köpeği seç (panel açılır)'],
  ['E düğmesi', 'Baktığın işi yap (düğme işi yazar)'],
  ['Koş düğmesi', 'Koşarak yürü (dayanıklılık harcar)'],
  ['🤖 düğmesi (üst şerit)', 'Otopilot: yem, su, temizlik, köpek işleri, yumurta, gece uykusu, ödül maması pişirme; köy işlerine gitmez; haritaya dokununca kapanır'],
  ['İki parmak', 'Yakınlaştır · yönetim modunda kaydır'],
  ['Sürükle (yönetim)', 'Kamerayı kaydır · araç seçiliyse çit/yol/bölge çiz'],
  ['Köylüye dokun', 'Yanına gidip konuşur: ipucu ve köy dedikodusu'],
  ['Tabelaya dokun', 'Hızlı seyahat: keşfettiğin tabelalar arasında git (yol kadar zaman geçer)'],
  ['Panoya dokun', 'Köy görev panosu: köylülerin ricaları, ödüllü görevler'],
];

/** Kontroller sayfası: klavye ve fare tablosu. Alt menü → Menü → Kontroller ya da duraklatma menüsünden açılır. */
export function HelpSheet() {
  store.lang.value;
  return (
    <div class="overlay">
      <div class="menu-card panel wide help">
        <div class="panel-head">
          <h2>{t('Kontroller')}</h2>
          <button class="btn small close" onClick={() => (store.panel.value = 'none')}>
            ✕
          </button>
        </div>
        <p class="muted small-text">{t('Alt çubuk her an E ile ne yapacağını yazar. Sağ üstteki uyarılara tıklayınca ilgili köpeğe gidersin.')}</p>
        <h4>{t('İlk adımlar')}</h4>
        <div class="table-scroll">
          <table class="help-table">
            <tbody>
              {START_ROWS.map(([k, v]) => (
                <tr key={k}>
                  <td>{t(k)}</td>
                  <td>{t(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div class="table-scroll">
          <table class="help-table">
            <thead>
              <tr>
                <th>{t('Tuş')}</th>
                <th>{t('Avatar modu')}</th>
                <th>{t('Yönetim modu')}</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map(([k, a, m]) => (
                <tr key={k}>
                  <td>{k}</td>
                  <td>{t(a)}</td>
                  <td>{t(m)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h4>{t('Dokunmatik')}</h4>
        <div class="table-scroll">
          <table class="help-table">
            <tbody>
              {TOUCH_ROWS.map(([k, v]) => (
                <tr key={k}>
                  <td>{t(k)}</td>
                  <td>{t(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h4>{t('Köy ve dünya')}</h4>
        <div class="table-scroll">
          <table class="help-table">
            <tbody>
              {WORLD_ROWS.map(([k, v]) => (
                <tr key={k}>
                  <td>{t(k)}</td>
                  <td>{t(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
