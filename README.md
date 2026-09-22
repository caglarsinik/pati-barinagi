# Pati Barınağı

2D köpek barınağı yönetim + açık dünya keşif oyunu. Yumurtaları bul, kuluçkada çıkar, köpekleri büyüt,
bakımlarını yap, barınağa gelen insanlara sahiplendir. Tüm grafikler ve sesler kod içinde üretilir;
dışarıdan hiçbir resim ya da ses dosyası kullanılmaz.

Tasarım dokümanı ve kilometre taşları: `docs/PLAN.md`

## Çalıştırma

- `run.bat` dosyasına çift tıkla. İlk seferde bağımlılıklar kurulur (Node.js gerekir), sonra tarayıcı açılır.
- Elle: `npm install` ve `npm run dev`
- Tek dosya sürüm: `build.bat` → `dist/index.html` (çift tıkla açılır, internet gerekmez)
- Yayın için `dist` klasörünün tamamı kullanılır (`index.html` + `manifest.webmanifest` + `icons/` + `sw.js`); bkz. aşağıdaki bölüm.

## Telefona kurulum ve yayın

Oyun bir **PWA**dır: HTTPS'li bir adreste yayınlanınca telefon ve tablette tarayıcıdan açılır, "Ana ekrana ekle" ile simge
olur, tam ekran yatay çalışır ve bir kez açıldıktan sonra internetsiz de açılır (service worker önbelleği). iOS ve Android
için ayrı paket gerekmez; mağaza yoktur.

**Yayınlama (GitHub Pages, ücretsiz):**

1. GitHub'da boş bir depo aç (ör. `pati-barinagi`, public ya da private fark etmez; Pages için public gerekir).
2. Bu klasörde:
   ```bat
   git remote add origin https://github.com/KULLANICI/pati-barinagi.git
   git push -u origin main
   ```
3. Depo sayfasında **Settings → Pages → Build and deployment → Source: GitHub Actions** seç.
4. `.github/workflows/pages.yml` her push'ta testleri koşturup `dist` klasörünü yayınlar (Actions sekmesinden izlenir, 1–2 dk).
5. Adres: `https://KULLANICI.github.io/pati-barinagi/`

Alternatif: Netlify Drop ya da Vercel'e `dist` klasörünü sürükle-bırak; hepsi HTTPS verir.
Yerel ağdan denemek için `npm run build` sonra `npm run preview -- --host` ve telefondan `http://BILGISAYAR-IP:4173/`
(HTTP olduğu için ana ekrana ekleme ve çevrimdışı çalışmaz; oynanış test edilir).

**Telefona ekleme:**

- **Android (Chrome):** adres açılınca ana menüde "Ana ekrana ekle" düğmesi çıkar (ya da tarayıcı menüsü ⋮ → Ana ekrana ekle /
  Uygulamayı yükle). Simgeden açılınca tam ekran ve yatay kilitli çalışır.
- **iPhone / iPad (Safari):** Paylaş → **Ana Ekrana Ekle**. Ana menüde ipucu görünür. Tam ekran için Ayarlar'da "Tam ekran"
  düğmesi de vardır.
- **Güncelleme:** yeni sürüm yayınlanınca oyun "Yeni sürüm indirildi" der; Ayarlar → **Şimdi yenile**. Kayıt tarayıcıda
  kalır (localStorage), sürüm geçişinde silinmez; yedek için Ayarlar → Kaydı panoya kopyala / Dosya olarak indir.

## Kontroller

| Tuş | Avatar modu | Yönetim modu |
|---|---|---|
| WASD / ok tuşları | Yürü | Kamerayı kaydır |
| Shift | Koş (dayanıklılık harcar) | – |
| E | Baktığın şeye göre iş yap: köpeği sev/oyna/eğit/fırçala, yem kabını doldur, pisliği temizle, kileri aç | – |
| 1-6 | Araç seç: Sev, Oyna, Eğit, Yem, Temizle, Çağır ("Gel" bilen köpekler 12 kare içinden gelir) | – |
| Sol tık | Köpeği seç (panel açılır) | Köpeği seç |
| I / O / N / P / F / H | Köpek listesi / Sahiplendirme / Finans / Personel / Görevlendirme / Başarımlar | Aynı |
| L | Dünya üstü isim etiketlerini aç/kapa (seçili köpekte her zaman görünür) | Aynı |
| T | Otopilot aç/kapa (üst şeritteki 🤖 ya da Menü → Otopilot); bkz. "Otopilot" | Aynı |
| Alt menü çubuğu | Barınak {Köpekler, Sahiplendirme} · Yönetim {Finans, Personel, Görevlendirme} · İnşa · Başarımlar · Menü {Kontroller, Ayarlar, Kaydet, Duraklat, Ana menü}; açılır listelerde tuşlar yazar | Aynı |
| B | İnşa çubuğu (yönetim moduna geçer) | İnşa çubuğu |
| X / Z | – | Yık aracı / Bölge boyama |
| R | – | Seçili binayı döndür (kare olmayan binalar; dokunmatikte Döndür çipi) |
| Tab | Yönetim moduna geç | Avatara dön |
| Space | Duraklat / devam | Duraklat / devam |
| + / - | Hız artır / azalt | Hız artır / azalt |
| Fare tekeri | Yakınlaştır | Yakınlaştır |
| Sol tık sürükle | – | Kamerayı kaydır (araç seçiliyse çit/yol çizgisi ya da bölge dikdörtgeni) |
| Sağ tık sürükle | – | Kamerayı kaydır (her zaman) |
| Esc | Paneli kapat / menü | Aracı bırak / paneli kapat / menü |

Alt satır her an E ile ne yapacağını yazar. Sağ sütundaki uyarılara tıklayınca ilgili köpeğe gidersin. Üst şerit durumu
(para, köpek, yem, itibar, personel, bekleyen sahiplenici, saat, hava, hız, mod) gösterir; mini harita sağ alttan gizlenebilir.

### Dokunmatik (tablet ve telefon)

Oyun yatay tutulan tablet ve telefonlarda oynanır (dikeyde "çevir" ekranı çıkar). Dokunmatik kontroller cihaza göre
kendiliğinden açılır; Ayarlar → Dokunmatik kontroller ile Otomatik / Açık / Kapalı seçilir, masaüstünde denemek için adrese
`?touch=1` eklenir.

- **Dokun:** avatar oraya yürür (yol bulur). **Köpeğe / binaya / yuvaya dokun:** yanına gidip işini yapar (sev, kabı doldur,
  yumurta al, temizle). **Uzun bas:** köpeği seçer. Klavye girişi ya da yönetim modu yolu iptal eder.
- **E düğmesi** (sağ alt) baktığın işi yazar ve yapar; **Koş** anahtarı koşarak yürütür.
- **🤖 (üst şerit):** otopilotu açar; karakter barınağın işlerini kendisi yapar, haritaya dokununca kapanır (bkz. "Otopilot").
- **İki parmak:** yakınlaştırır, yönetim modunda kaydırır. **Sürükle (yönetim):** kamerayı kaydırır; araç seçiliyken çit/yol/bölge çizer;
  aracı bırakmak için ipucu satırındaki İptal, kare olmayan binayı döndürmek için Döndür.
- Paneller telefonda tam ekran sayfa olur; görevlendirme ızgarası parmakla boyanır, öncelikler +/− adımlayıcıdır;
  telefonda üst şeritteki 🥚 çanta, 🔔 uyarı ve 🗺️ harita çipleri ilgili sayfayı açar.
- **Telefon yerleşimi:** alt şerit tek satırdır — solda etkin araç düğmesi (dokununca 6 araçlık şerit açılır), ortada
  5 ikonlu menü, sağda E ve Koş; üst şeritteki çipler parmakla kaydırılır, hız düğmesi ⏸ + döngülü 1x/2x/4x, mod düğmesi
  🛠 Yönet / 🧍 Avatar. Parçalar tek bir "rıhtım" satırında durduğu için hiçbir ekran boyutunda üst üste binmez
  (568×320'den itibaren); üst şerit ve rıhtım yükseklikleri ölçülür, köpek paneli aralarına sığar. Ana menü kısa
  ekranda iki sütun olur.
- Yüksek çözünürlüklü ekranlarda piksel sanatı tam ölçekte (cihaz piksel oranı 2'ye kadar) çizilir.

## Otopilot

Üst şeritteki **🤖** düğmesi, **T** tuşu ya da Menü → Otopilot ile açılır; açılınca avatar moduna geçer. Karakter boşta
kaldıkça personelle aynı görev tahtasından iş seçer (aciliyet / mesafe): boş yem kabı ve yalak, pislik; sonra köpek işleri
(keyfi düşük köpekle oyna, eğitim hedefindeki köpeği eğit, kirli köpeği tımar istasyonu yakınsa yıka yoksa fırçala, hasta
köpeği klinik yakınındaysa ve para varsa tedavi et). Kiler boşsa ve para varsa bir çuval yem sipariş eder. Tahta boşken
sırayla: gece (20:00–06:00) ofise gidip sabaha kadar uyur; çantadaki yumurtayı kuluçkaya koyar; keşfedilmiş yakın yuvadan
yumurta, çalıdan böğürtlen toplar; bugün sevilmemiş köpeği sever. Uzak hedefe dayanıklılık yettiği sürece koşar. Alt
satır o an ne yaptığını yazar ("🤖 Yem kabını dolduruyor"). **Elle müdahale kapatır:** WASD, haritaya/köpeğe dokunma, E.
Yönetim moduna geçince bekler, avatara dönünce sürer. Uyuyan ya da bitkin köpekle oynamaz; ulaşamadığı hedefi 30 saniye
yeniden denemez. Otopilot inşaat, işe alım ve sahiplendirme kararı vermez.

## Köpek bakımı

- Köpeklerin ihtiyaçları: tokluk, su, keyif, rahatlık (tuvalet), temizlik, sağlık, sadakat, enerji. Köpeğin üstünde en acil ihtiyacın balonu görünür (🍖 aç, 💧 susuz, 💩 tuvalet, 🎵 sıkıldı, 🤒 hasta, ❗ kaçma riski, zzz uyuyor); sevince kalp çıkar.
- Su yalağı: köpek susayınca gidip içer, yalak azalır. Yalağın önünde E ile ücretsiz doldur; mutfak varsa yalaklar kendiliğinden dolar. Personel için ayrı "Su" görevi vardır.
- Yem kabını kilerden doldur (kabın önünde E). Köpekler acıkınca dolu kaba kendileri gider. Kiler bitince kilerin önünde E ile çuval sipariş et.
- **Tuvalet alanı:** arsanın sağ altındaki kum alan (Z ile başka yere de boyanır) her modda görünür. Köpek, tuvalet eğitimi
  yüzdesi kadar olasılıkla oraya gider (eğitimsiz olduğu yere yapar, eğitim tamamsa hep alana). Alandaki pislik "kapsanır":
  köpekleri kirletmez, mide bozukluğu ve denetimde çeyrek sayılır; alan dolunca (6 pislik, yakında çöp kutusu varsa 10)
  "Tuvalet alanı doldu" uyarısı çıkar ve hepsi tam sayılır. Personel alanı düşük öncelikle, serbest pisliği hemen temizler;
  sen fırça ile temizlersin. Çöp kutusu 6 kare içindeki pisliklerin temizliğini %30 hızlandırır. Dolu mesaneyle köpek gece
  de kalkıp alana gider; gezintide tuvaletini dışarıda yapar, pislik bırakmaz.
- Sevmek sadakati, oynamak keyfi, fırçalamak temizliği artırır. Eğitim aracıyla köpek panelinden seçtiğin beceriyi çalıştırırsın.
- Gece köpekler kulübelerinde uyur; kulübesi olmayan köpek dışarıda kötü uyur.
- **Dostluk:** sıkılan iki köpek 8 kare içinde buluşup birlikte oynar (oyun bahçesi varsa orada); ikisinin de keyfi, dostluk puanı ve "sosyallik" becerisi artar, üstlerinde 🐾 çıkar. İki cesur köpek arada hırlaşır (dostluk düşer, bir saatlik uyarı); sosyalliği tam köpekler hırlaşmaz. Köpek paneli en yakın dostu gösterir; kulübe ataması dostun kulübesini tercih eder. Sıkılan ya da aç kalan köpek havlar.
- **Huy:** Çekingen köpek güvenmeden (sadakat 40 altı) sevmeden az etkilenir, güvenince çok bağlanır; sadakati 50 altındayken yaklaşan insandan kaçar. Cesur köpek daha kolay kaçar (x1,5), 2 ödülle evcilleşir, daha geniş dolaşır. Oyuncu huylu köpek daha erken oyuncak arar. Sakin köpek daha çok yatar, hırlaşmaz.
- **Beceriler işe yarar:** Gel → 6 numaralı Çağır aracı; Otur → oyuncu 2 sn bitişik durunca oturur, eşleşmede +3; Bekle → gece kaçmaz; Tasma → köpek panelinden "Gezdir": köpek peşine takılır, arsadan çıkıp dönünce keyif +40, sadakat +5 (biraz kirlenir, yorulur); HUD'daki Bırak ile dışarıda bırakılan köpek kendi başına eve döner. İstekten fazla her öğrenilmiş beceri eşleşme puanına +2 (en çok +6) verir.
- **Hastalık ve karantina:** Kirli köpek pire kapar, kulübesiz köpek soğuk/yağışlı havada üşütür, arsada 3'ten çok pislik varsa mide bozulur. Hasta köpek sahiplendirilemez; hastalık 2 kare içindeki köpeklere bulaşır, tedavi edilmezse 7 günde kendiliğinden geçer. Tedavi (veteriner odası, veteriner personeli, gezici veteriner) hastalığı siler. Görevlendirme → Politikalar'daki "karantinada kalsın" seçeneği (varsayılan açık) hasta köpeği Z ile boyadığın Karantina alanına yollar; karantina bulaşmayı iki yönde keser.
- Köpek listesi (I) sütun başlığına tıklayınca sıralanır; Hasta / Kulübesiz / Sahiplendirilebilir / Susuz / Dostsuz filtreleri vardır.

## İnşa

- Yönetim modunda B ile inşa çubuğu açılır: kategori → bina. Hayalet yeşilse yerleşir, kırmızıysa sığmıyor ya da para yetmiyor. R ile kare olmayan binalar (büyük kulübe, mutfak, personel odası, tünel, bank) 90° döner; ön yüz ve kapı hep güneyde kalır.
- Çit ve yol sürükleyerek düz çizgi halinde çekilir; kapı çitin üstüne konur. **Kapı kapalıyken geçilmez:** sen, personel, sahiplenici ve tasmalı köpek yaklaşınca kendiliğinden açılır, geçince kapanır; serbest köpekler kapıdan çıkamaz (gece kaçış yine çitten atlamadır). Bölgeler (tuvalet, oyun bahçesi, eğitim, karantina, personel) dikdörtgen sürükleyerek boyanır.
- Büyük binalar inşaat süresi boyunca yarı saydamdır ve kullanılamaz. Yıkım bedelin yarısını iade eder.
- Arsa sekmesinden doğuya/güneye 16 kare genişletilir (2.500 ₺); alan temizlenir, çit ve yol kapıları yeniden kurulur.
- Tımar istasyonu yakındaki köpeği yıkar, veteriner odası tedavi eder, mutfak kapların kapasitesini ikiye katlar, yalakları kendiliğinden doldurur ve personelin yem/su işini %40 hızlandırır; oyuncaklar köpeklerin kendi kendine oynamasını sağlar. Otomatik yem makinesi (2.500 ₺) her saat 8 kare içindeki kaplara kilerden 2 porsiyon koyar; o kapların yem görevi daha az acil olur.
- Ofis lisansla büyür: lisans 2'de bayrak ve yan pencere, lisans 3'te çatı penceresi ve yıldızlı tabela; Sv3 ofiste en fazla 16 personel çalışır (öncesinde 12).
- Dekor puanı: çiçek 1, bank 3, tabela 5 (bir tabela sayılır), lamba 0,5; en çok 20. Puan sahiplenicilerin sabrını uzatır, günlük sahiplenici sayısını biraz artırır ve haftalık denetimde "Çevre" kalemi olarak sayılır.

## Yumurtalar ve keşif

- Dünyadaki yuvalarda (mini haritada sarı nokta) yumurta bulunur; önünde E ile çantaya alınır (3 yuva). Yuva birkaç günde yeniden dolar.
- Yumurtanın boyu köpeğin boyutunu, şekli gövde tipini, rengi ve deseni tüyünü belirler; huy ve zekâ sadece ipucu olarak sezilir.
- Kuluçkanın önünde E: yumurtayı yerleştir, 3 günde yavru doğar. Yavru 4 haftada genç, 12 haftada yetişkin olur.
- Yükseltmeler: kuluçka panelinden **Sv2** (2.000 ₺: 6 yuva, 2 günde çatlar; içerideki yumurtalar da hızlanır), ofisten
  **büyük çanta** (1.500 ₺: 6 yumurta).
- Uzaktaki inlerde (turuncu nokta) sokak köpekleri yaşar. Böğürtlen çalısından ödül maması topla, köpeğe 3 kez ver (cesur huyluya 2); peşine takılır, barınağa girince katılır.
- Gece 20:00'den sonra ofisin önünde E ile sabaha kadar uyursun. Dışarıda 02:00'ye kadar kalırsan bayılıp ofiste uyanırsın.

## Ekonomi ve sahiplendirme

- Sahiplenici 10:00-16:00 arasında kapıdan gelir, ofisin önünde yaklaşık 2,5 saat bekler. O tuşu ya da ofiste E ile masayı aç; istek kartına göre en uygun köpeği puanla gör ve sahiplendir. Zayıf eşleşme (puan < 50) itibar düşürür, köpek geri gelebilir.
- Köpek sahiplendirilebilmek için sağlıklı, temiz ve sana güvenir olmalı (sadakat 30+).
- Her Pazartesi 06:00 hafta raporu: denetim (temizlik, sağlık, keyif, pislik, kulübe, yem) yardım çarpanını (0,4-1,5) belirler; köpek başına 150 ₺ × çarpan devlet yardımı yatar, bina bakım gideri düşer.
- Lisans seviyesi yardım alınan köpek sayısını sınırlar (8/20/45); ofisten yükseltilir. Finans (N) kasa hareketlerini ve geçmiş haftaları gösterir.
- **Zorluk:** yeni oyunda Kolay / Normal / Zor seçilir (başlangıç 9.000 / 6.000 / 4.000 ₺, yardım ×1,3 / 1 / 0,8, ihtiyaç hızı
  ×0,8 / 1 / 1,2); kayıtta korunur, Finans başlığında görünür.
- **Kredi:** ofisten tek seferde 5.000 ₺ kredi alınır; her hafta %5 faiz (250 ₺) kasadan düşer, anapara ofisten "Krediyi öde"
  ile kapatılır (kasa yetmezse kısmen). **İflas:** kasa üst üste 3 hafta −(haftalık maaş + 1.000 ₺) altındaysa oyun biter; uyarı
  sütunu "İflas riski: n/3 hafta" diye sayar, iflas ekranından ana menüye dönülür (kayıt korunur, "Devam et" yine iflas ekranını açar).
- **Sahiplendirmeyi kapatmak:** ofisteki ya da masadaki "Sahiplendirmeye açık" anahtarı kapalıyken sahiplenici gelmez,
  bekleyenler itibar kaybı olmadan uğurlanır (üst şeritte 🚫 çipi, alt menüde rozet). **Bu köpeği tut:** köpek panelindeki
  kutu o köpeği sahiplendirme listesinden çıkarır (listede 🔒, "Tutulan" filtresi).

## Personel ve görevlendirme

- Ofisten ya da P tuşuyla personel paneli: her sabah 3 aday (bakıcı, eğitmen, veteriner) gelir; nitelikleri (hız, çalışkanlık, şefkat, dayanıklılık, beceri) ve huyları farklıdır. Maaşlar her Pazartesi ödenir; kasa iki hafta eksideyse personel istifa eder.
- F tuşu görevlendirme ekranı: **Vardiya** sekmesinde 24 saatlik çizelgeyi boyarsın (çalış/mola/izin), **Öncelikler** sekmesinde her personel için görev türlerine 0-5 öncelik verirsin (bakıcı tedavi yapamaz, veteriner en iyi tedaviyi yapar), **Politikalar** sekmesinde otomatik yem siparişi, eğitim hedefi ve hasta köpeği karantinada tutma seçeneği vardır.
- Görev tahtası barınağın ihtiyaçlarından otomatik dolar: boş yem kabı, boş su yalağı, pislik, sıkılan/kirli/hasta köpek, eğitim. Personel aciliyet, verim, öncelik ve mesafeye göre iş seçer; oyuncu işi yaparsa görev düşer. Görevler saatlerce beklerse darboğaz uyarısı çıkar.
- Personel enerjisi bitince personel odasında (yoksa personel bölgesinde ya da ofis önünde) mola verir.
- **Seviye ve moral:** her tamamlanan görev deneyim verir; eşikte personel seviye atlar (Sv5'e kadar) ve rolünün ana
  niteliği (bakıcıda çalışkanlık, eğitmen/veterinerde beceri) artar. Moral yorgun çalışmak, iş yükü ve ödenmemiş maaşla
  düşer; mola odası, izin ve seviye atlamak yükseltir. Moral 30'un altındayken verim %20 düşer, 3 gün 10'un altında kalan
  personel istifa eder. Kartta "Sv2 ★★", deneyim ve moral çubuğu görünür.

## Ses

Tüm efektler ve müzik Web Audio API ile çalışma anında sentezlenir (`src/audio/`): havlama köpeğin boyuna göre
inceliyor/kalınlaşıyor, yem dökme, fırça, yumurta çatlama, sahiplendirme cıngılı, hafta raporu akoru gibi
20'den fazla efekt ve gündüz/gece değişen üretken bir ortam müziği var. Tarayıcı kuralı gereği ilk tıklamadan
sonra ses açılır. Ayarlar (Esc → Ayarlar) ses seviyelerini ve sessiz modu tutar.

Gerçek ses dosyası kullanmak istersen: `src/audio/Sfx.ts` içindeki `playSfx` her efekt için tek giriş noktasıdır;
oraya bir `Audio` nesnesi ya da `AudioBufferSourceNode` oynatan bir dal ekleyip dosyayı `public/` altına koyabilirsin.
Ücretsiz kaynaklar: Kenney (kenney.nl, CC0 efekt paketleri), OpenGameArt (CC0/CC-BY), Kevin MacLeod (incompetech.com, CC-BY müzik).
Lisans gerektirenleri README'de anmayı unutma.

## Hava, mevsim ve olaylar

- Her mevsim 2 hafta sürer (ilkbahar → yaz → sonbahar → kış). HUD'ın ortasında mevsim ve hava yazar; hava 6-14 saatte bir değişir.
- Yaz: köpekler daha çabuk kirlenir, oyun bahçesi daha keyifli. Kış: daha çok acıkırlar, enerji hızlı düşer, **kulübesiz köpek gece üşür ve sağlık kaybeder**. İlkbahar: yuvalar daha hızlı dolar. Sonbahar: böğürtlen çalıları fazladan ödül maması verir.
- Yağmur/fırtına köpekleri kirletir ve sahiplenici sayısını düşürür; kar enerjiyi tüketir. Yağmur ve kar ekranda görünür, mevsim renk tonunu değiştirir.
- Rastgele olaylar (ofis panelindeki "Son olaylar" listesinde tutulur): gazete haberi (itibar +5, ertesi gün fazladan ziyaretçi), sürpriz denetim (temiz barınağa ödül, bakımsıza 200 ₺ ceza), hayırsever bağışı, yem toptancısı indirimi (o gün çuvallar yarı fiyat), gezici veteriner (ücretsiz muayene).
- Hastalıklar (pire, soğuk algınlığı, mide bozukluğu) bakımsızlıkla başlar ve bulaşır; ayrıntı "Köpek bakımı" bölümünde.
- Sadakati 25'in altındaki köpek gece kaçabilir ("Bekle" bilen köpek kaçmaz, cesur köpek daha kolay kaçar): arsa dışında bir yere saklanır (mini haritada turuncu). Böğürtlen ödülüyle geri getir; 3 gün içinde bulunmazsa gider ve itibar düşer.
- 52 haftalık köpek **yaşlı** olur: gri burunlu çizilir, daha yavaş yürür, sağlığı daha kırılgandır, oyun ihtiyacı azdır. Sıradan sahiplenicilerde 10 puan kaybeder, "yaşlı dost" isteyen sahiplenici ise fazladan 100 ₺ öder.

## Başarımlar

H tuşu ya da ofis panelinden 25 başarımın listesi açılır (ilk yumurta, 10 sahiplendirme, 95+ eşleşme, 1,4 denetim çarpanı, 20.000 ₺, efsanevi köpek, bir yıl dayanmak...). Her başarım açıldığında itibar +1 verir; kayıtla korunur.

## Dil

Ana menüden ya da Ayarlar'dan Türkçe / English seçilir; seçim tarayıcıda kalır. Metinler `src/i18n/en.ts` içindeki sözlükten
çevrilir (Türkçe kaynak metin → İngilizce). Yeni bir dil eklemek için aynı biçimde bir sözlük yazıp `src/i18n/index.ts` içine bağlaman yeterli;
`tests/unit/i18n.test.ts` koddaki her metnin sözlükte olduğunu denetler.

## Kayıt aktarımı

Ayarlar panelinden kaydı JSON olarak panoya kopyalayabilir, dosya olarak indirebilir ya da yapıştırıp/dosyadan yükleyebilirsin.
Bilgisayar değiştirirken ya da yedek almak için kullan.

## Durum

- [x] M0 İskelet: dünya üretimi, avatar, kamera, gün/gece, HUD, hız, mini harita, kayıt
- [x] M1 Köpekler ve ihtiyaçlar: genom ve modüler sprite, ihtiyaçlar, davranış, başlangıç barınağı, bakım araçları, köpek paneli/listesi, uyarılar
- [x] M2 İnşa: inşa çubuğu, hayalet önizleme, çit/kapı/yol, bölgeler, yıkım, inşaat süresi, arsa genişletme, yeni binalar
- [x] M3 Yumurta ve büyüme: yuvalar, yumurta genetiği ve ipuçları, kuluçka, haftalık büyüme, sokak köpekleri ve evcilleştirme, keşif sisi, uyku/bayılma
- [x] M4 Ekonomi ve sahiplendirme: sahiplenici akışı ve eşleşme, itibar, geri dönüş, defter, haftalık denetim ve yardım, bakım gideri, lisans, finans ve rapor ekranları
- [x] M5 Personel ve görevlendirme: adaylar ve işe alma, görev tahtası, personel yapay zekâsı, vardiya çizelgesi, öncelikler, politikalar, maaş ve istifa
- [x] M6 Ses ve cila: sentezlenen efektler ve üretken müzik, ayarlar, kayıt dışa/içe aktarma, başlangıç rehberi, lamba ışıkları, uzun koşu denge testi, tek dosya build
- [x] M7 Ekstralar: mevsimler ve hava (yağmur/kar efektleri, mevsim tonu, ihtiyaç çarpanları), rastgele olaylar (sürpriz denetim, bağış, indirim, gezici veteriner, gazete, kaçan köpek), yaşlı köpek aşaması, 21 başarım, İngilizce dil
- [x] M8 Canlı barınak: susuzluk ve su yalağı, dekor/mutfak etkisi, dünya üstü emote balonları ve isim etiketleri (OverlayScene), köpek-köpek dostluk/oyun/hırlaşma/havlama, huy ve becerilerin davranışa bağlanması (Çağır aracı, otur, bekle, gezdirme), hastalık ve karantina, köpek listesi sıralama/filtre, teknik borç (ışık haritası, doku sızıntısı, toast kuyruğu), kayıt sürümü 2
- [x] M9 Arayüz ve dokunmatik: üst durum şeridi + kategorili alt menü çubuğu, sütunlu HUD (çakışma yok), Kontroller sayfası, sahiplendirme anahtarı ve "bu köpeği tut", duyarlı CSS (tablet/telefon, 44 px dokunma hedefleri, tam ekran sayfalar), görevlendirme ızgarası parmakla boyanır, DPR'lı canvas + pinch, dokun-git + E düğmesi, telefon sayfaları ve çevir ekranı
- [x] M10 Kapı, tuvalet ve zorluk: otomatik çit kapısı (kapalıyken geçilmez, yaklaşınca açılır, NPC'ler kapı dışında belirir), her modda görünür tuvalet alanı + kademeli tuvalet eğitimi + kapsanan pislik/kapasite/uyarı, işe yarayan çöp kutusu, gece tuvaleti ve gezintide rahatlama, zorluk seviyesi, kredi ve iflas ekranı, bina döndürme (R)
- [x] 0.10.1 bakım (2026-09-16): kapalı kapıdan geçiş kontrolü ve uykuda kapılar, telefon dikey yönde duraklatma, metin alanlarında klavye ayrımı (ayrıntı ve doğrulama notları: `docs/CLAUDE_HANDOFF.md`)
- [x] 0.11.0 Telefona kurulum: PWA (manifest, kodla üretilen ikonlar, service worker ile çevrimdışı, "Ana ekrana ekle", Şimdi yenile), GitHub Pages iş akışı
- [x] 0.12.0 Telefon HUD yeniden düzeni: alt rıhtım (araç / menü / E-Koş tek flex satırı), telefonda tek araç düğmesi, kaydırılabilir üst şerit ve kısa hız/mod düğmeleri, ölçülen yüksekliklerle konumlanan köpek paneli, kutu modeli border-box, iki sütunlu ana menü, yerleşim bütçe testi
- [x] 0.12.1–0.12.3 Dokunma düzeltmeleri: HUD dokunuşları dünyaya sızmaz, takılı pinch/kaçan touchend sıfırlanır, düğme odağı klavyeyi kilitlemez; kuluçkadan alınan yumurtanın süresi korunur; köpeğin dibindeyken çevre dokunuşu yürüyüştür, meşgulken "Şu an meşgul"
- [x] 0.13.x Otopilot: 🤖 / T ile karakter barınağın işlerini kendisi yapar (bakım, köpek işleri, yumurta, böğürtlen, gece uykusu, koşu), durum satırı, elle müdahalede kapanır, 3 günlük başsız koşu testi
- [x] 0.14.0 Yılın Barınağı: 50 sahiplendirme ve 90 itibar → zafer ekranı (bir kez, oyun sürer), ofiste hedef çubukları, başarım
- [x] 0.14.1 Yükseltmeler 1: kuluçka Sv2 (6 yuva, 2 gün) ve büyük çanta (6 yumurta)
- [x] 0.14.2 Otomatik yem makinesi (saatte 8 kare içindeki kaplara 2 porsiyon) ve lisansla büyüyen ofis (Sv3: 16 personel)
- [x] 0.14.3 Personel deneyim/seviye (görev başına deneyim, Sv5'e kadar, seviyede ana nitelik +1) ve moral (yorgunluk, iş yükü, maaş; düşük moral verimi düşürür, uzun süre dipte kalan istifa eder)
- [ ] M12 İlerleme ve Son Oyun (0.14.4–0.14.6: kurs/gönüllü, finans grafiği, 3 kayıt yuvası)
- [ ] Sonraki paketler (`docs/PLAN.md` §7): M14 Soy, M11 Yaşayan Dünya, M13 Sahiplendirme Hikâyeleri

## Geliştirme

```bat
npm test          # birim testleri (vitest)
npm run typecheck # tsc --noEmit
npm run build     # dist/index.html
```

Dokunma testleri: oyunu `?touch=1&debug=1` ile açıp yeni oyun başlatınca konsolda
`__pati.debug.runTouchScenarios()` 8 senaryoyu (eğit → yürü, E düğmesi, pinch + iptal, takılı parmak, yönetim modu,
uzun basış, köpeğin dibinde dokunuş, otopilot) koşar ve `{ summary, results }` döndürür; `__pati.debug.snapshot()` o anki
dokunma/yürüyüş durumunu verir. `?debug=1` olmadan kanca bağlanmaz. Gerçek cihaz kontrol listesi: `docs/CLAUDE_HANDOFF.md`.

Kod yapısı:

```
src/config/     denge sayıları ve sabitler
src/core/       Rng, EventBus, Clock, SaveManager
src/i18n/       t() yardımcısı ve İngilizce sözlük
src/sim/        Phaser'dan bağımsız oyun mantığı (dünya, varlıklar, sistemler)
src/render/     kodla üretilen pixel-art ve doku kaydı
src/scenes/     Phaser sahneleri: World (çizim ve girdi), Overlay (emote balonları, isim etiketleri)
src/ui/         Preact arayüzü (HUD, menüler, paneller); layout.css yerleşim değişkenleri, responsive.css tablet/telefon/dokunmatik
tests/          vitest testleri
```

Kayıt tarayıcının `localStorage` alanında tutulur; her sabah 06:00'da ve menüden çıkarken otomatik kaydedilir.
