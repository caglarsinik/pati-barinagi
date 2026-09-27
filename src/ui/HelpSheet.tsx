import { t } from '../i18n';
import { store } from './store';

/** [tuş, avatar modu, yönetim modu]; Türkçe metinler t() ile çevrilir. */
const ROWS: Array<[string, string, string]> = [
  ['WASD / ok tuşları', 'Yürü', 'Kamerayı kaydır'],
  ['Shift', 'Koş (dayanıklılık harcar)', '–'],
  ['E', 'Baktığın şeye göre iş yap: köpeği sev/oyna/eğit/fırçala, kabı ve yalağı doldur, pisliği temizle, kileri aç, ofise gir (içeride eşyalar)', '–'],
  ['↑ (kapıda basılı tut)', 'Binaya gir (ofis, dinlenme odası, kiler, mutfak, veteriner, kuluçka, kulübe); E kapıdaki hızlı işi yapar', '–'],
  ['1-6', 'Araç seç: Sev, Oyna, Eğit, Yem, Temizle, Çağır', '–'],
  ['Sol tık', 'Köpeği seç (panel açılır)', 'Köpeği seç · seçili aracı yerleştir · çit/yol/bölge sürükle'],
  ['Sağ tık sürükle', '–', 'Kamerayı kaydır (aracı bırakır)'],
  ['Fare tekeri', 'Yakınlaştır', 'Yakınlaştır'],
  ['Tab', 'Yönetim moduna geç', 'Avatara dön'],
  ['B', 'İnşa çubuğu (yönetim moduna geçer)', 'İnşa çubuğu'],
  ['X / Z', '–', 'Yık aracı / Bölge boyama'],
  ['R', '–', 'Seçili binayı döndür (kare olmayan binalar)'],
  ['V', '–', 'Taşı: binayı tıkla ya da sürükle, yeni yerine bırak (içindekiler korunur)'],
  ['I / O / N / P / F / H', 'Köpekler / Sahiplendirme / Finans / Personel / Görevlendirme / Başarımlar', 'Aynı'],
  ['L', 'İsim etiketlerini aç/kapa', 'Aynı'],
  ['M', 'Tam ekran harita: dokunarak işaret koy, işarete git; tekerlek ya da +/−: yakınlaştır, sürükle: kaydır', 'Aynı'],
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
  // M19 (0.22.6): açılış tanıtımı ve sol alttaki ihtiyaç şeridi.
  ['Tanıtım', 'Yeni oyunda belediyeden Nermin Hanım ilk adımları gösterir: sarı halkalı düğmeye bas, iş yapılınca adım geçer. Ayarlar → Rehber\'den kapatılır ya da yeniden başlatılır.'],
  ['İhtiyaç şeridi', 'Sol altta: aç, susuz, hasta, kirli ya da kulübesiz köpekleri sayar; dokununca uyarı listesi açılır.'],
];

/** [konu, açıklama] Köy ve dünya (0.20.5). */
const WORLD_ROWS: Array<[string, string]> = [
  ['🏘️ Köy', 'Güney yolunun ucunda: yem toptancısı (ucuz çuval), oyuncak ve ilaç dükkânı, Pazar tezgâhı; itibar arttıkça postane ve park açılır.'],
  ['👥 Köylüler', 'Sabah işe, akşam eve giderler; E ile konuş. Köylünün sahiplendiği köpek köyde sahibiyle yaşar.'],
  ['🚏 Tabelalar', 'Barınak kapısının dışında, doğu yolunda ve köy girişinde; görünce keşfedilir, tabelada E ile hızlı seyahat (yol kadar zaman geçer, köpekler de gelir).'],
  ['📋 Görev panosu', 'Köy meydanında; her Pazartesi en çok üç ilan: kayıp köpek, köpek isteği, ödül maması. Panoda kabul et, süresi dolmadan köylüye ya da panoya teslim et.'],
  ['🤖 Otopilot', 'Yalnız barınak işlerini yapar: köy, tabela, köylü ve görev işlerine dokunmaz, barınaktan uzaktaki yuva ve çalılara gitmez; ağaç kesmez, kaya kırmaz, terk edilmiş eve girmez.'],
];

/** [konu, açıklama] Orman ve malzeme (M18, 0.23.4). */
const FOREST_ROWS: Array<[string, string]> = [
  ['🪵 Odun ve 🪨 taş', 'Arsa ve köy dışında ağaca (tepesine de), çama, kayaya ya da kütüğe dokun ya da önünde E: keser, kırar, söker. Kesilen ağaç 5–8 günde yeniden büyür; çantada her birinden en çok 99.'],
  ['🪵🪨 Malzemeyle öde', 'İnşa çubuğundaki anahtar açıkken binanın tarifindeki odun ve taş fiyatı düşürür (odun 20 ₺, taş 30 ₺, en çok yarısı); çit odunla, yol taşla konur. Yıkımda ödenenin yarısı döner.'],
  ['🏚️ Terk edilmiş ev', 'Uzak ormanda; köylüler yönünü söyler. İçeride sandık (para ve yumurta), dolap (keskin aletler: ağaç ve kayadan +1), günlük (gizli yuva, ilk yumurtası efsanevi).'],
  ['🏡 Orman evi', 'Evin ocağında onar (🪵40 🪨25 + 800 ₺): yatakta uyu, ocakta günde bir ısın, kapıdaki tabeladan hızlı seyahat; gece bayılırsan yakınsa burada uyanırsın.'],
];

/** [konu, açıklama] Sahiplendirme hikâyeleri (0.21.5). */
const ADOPT_ROWS: Array<[string, string]> = [
  ['👵 Kişilik', 'Sahiplenicinin tipi (Aile, Emekli, Sporcu, Öğrenci, Çiftçi, Sanatçı) ücreti ve sabrı değiştirir; "Sever:" özelliklerine uyan köpek +6 puan alır.'],
  ['📬 Mektup', "Sahiplendirmeden 3–7 gün sonra 11:00'de aile yazar: fotoğraf, harika eşleşmede bağış ve itibar. ☰ Menü → Posta."],
  ['📖 Mezunlar', 'Sahiplendirdiğin bütün köpekler fotoğrafları, yıldızları ve rozetleriyle. ☰ Menü → Mezunlar.'],
  ['🔁 Tekrar gelen aile', 'Mutlu aile en az 7 gün sonra eski köpeğiyle yeniden gelebilir; ücret ve sabır artar.'],
  ['🎈 Sahiplendirme günü', 'Ofis bilgisayarından ya da masadan (300 ₺, haftada bir): ertesi gün sahipleniciler üç kat, kapıda balonlar.'],
  ['📣 Bağış kampanyası', "Ofis bilgisayarından (150 ₺, haftada bir): 3 gün boyunca 11:00'de mutlu mezun aileleri ve köylüler bağışlar."],
  ['💞 Can dostları', 'Karşılıklı dostluğu 70+ iki köpek masada "İkisini ver" ile birlikte gider; ayrılırsa kalan üzülür.'],
];

/** [hareket, ne yapar] */
const TOUCH_ROWS: Array<[string, string]> = [
  ['Dokun', 'Avatar oraya yürür (yol bulur)'],
  ['Köpeğe / binaya / yuvaya dokun', 'Yanına gidip işini yapar: sev, kabı doldur, yumurta al, temizle'],
  ['Binanın kapı karesine dokun', 'İçeri girer (ofis, dinlenme odası, kiler, mutfak, veteriner, kuluçka, kulübe); binanın başka yerine dokunmak hızlı işi yapar'],
  ['İçeride eşyaya / kapıya dokun', 'Eşyayı kullanır · paspaslı kapıdan dışarı çıkar'],
  ['Mini haritaya ya da 🗺️ çipine dokun', 'Tam ekran harita: haritaya dokun → işaret; "Git" ile oraya yürü'],
  ['Haritada iki parmak / + −', 'Yakınlaştır (1×/2×/4×) · sürükle: kaydır · ⌖: bana dön'],
  ['Uzun bas', 'Köpeği seç (panel açılır)'],
  ['E düğmesi', 'Baktığın işi yap (düğme işi yazar)'],
  ['Koş düğmesi', 'Koşarak yürü (dayanıklılık harcar)'],
  ['🤖 düğmesi (üst şerit)', 'Otopilot: yem, su, temizlik, köpek işleri, yumurta, gece uykusu, ödül maması pişirme; köy işlerine gitmez; haritaya dokununca kapanır'],
  ['İki parmak', 'Yakınlaştır · yönetim modunda kaydır'],
  ['Sürükle (yönetim)', 'Kamerayı kaydır · araç seçiliyse çit/yol/bölge çiz'],
  ['Yönet → İnşa → Taşı', 'Binaya dokun, sonra yeni yerine dokun ya da binayı sürükle; Döndür çipi çevirir, içindekiler korunur'],
  ['Kulübeye dokun', 'Kulübe paneli: 🚪 İçeri gir · 🛋️ Eşyalar (yatak, battaniye, su kabı, oyuncak, pencere)'],
  ['Köylüye dokun', 'Yanına gidip konuşur: ipucu ve köy dedikodusu'],
  ['Tabelaya dokun', 'Hızlı seyahat: keşfettiğin tabelalar arasında git (yol kadar zaman geçer)'],
  ['Panoya dokun', 'Köy görev panosu: köylülerin ricaları, ödüllü görevler'],
  ['Ağaca / kayaya / kütüğe dokun', 'Yanına gidip keser, kırar ya da söker (🪵/🪨 çantaya)'],
  ['Terk edilmiş eve dokun', 'Kapısına yürüyüp içeri girer; içeride ocağa dokun: onarım'],
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
                  <td>{t(k)}</td>
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
        <h4>{t('Orman ve malzeme')}</h4>
        <div class="table-scroll">
          <table class="help-table">
            <tbody>
              {FOREST_ROWS.map(([k, v]) => (
                <tr key={k}>
                  <td>{t(k)}</td>
                  <td>{t(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h4>{t('Sahiplendirme')}</h4>
        <div class="table-scroll">
          <table class="help-table">
            <tbody>
              {ADOPT_ROWS.map(([k, v]) => (
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
