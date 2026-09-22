# Pati Barınağı: Oyun Tasarımı ve Uygulama Planı

## 0. Bağlam

Kullanıcı 2D bir köpek barınağı yönetim + açık dünya keşif oyunu istiyor: dünyada rastgele yerleştirilmiş
yumurtaları/köpekleri bul, barınakta büyüt ve bak, barınağa gelen insanların isteklerine göre sahiplendir.
Hafta bazlı büyüme, ihtiyaç sistemi, personel + otomasyon ekranı, inşa arayüzü ve devlet yardımına dayalı
bir ekonomi istiyor. Bu dosya birlikte verdiğimiz kararları, oyun tasarımını (GDD) ve uygulama sırasını tek
yerde toplar. Onaydan sonra sıfırdan yeni bir proje kurulacak. Mevcut `farm_game` (Turnip Farm) projesine
dokunulmaz; ondan yalnızca işe yarayan desenler taşınır (bkz. 3.10).

Kullanıcının 11 kuralının plandaki karşılığı:

| Kural | Bölüm |
|---|---|
| 1. Farklı renk/şekilde köpekler | 2.4 Yumurta genetiği, 3.4 Modüler köpek çizici |
| 2. Hafta bazlı büyüme | 2.2 Zaman, 2.5 Büyüme aşamaları |
| 3. Açlık, sadakat, oyun, tuvalet, eğitim | 2.5 İhtiyaçlar ve eğitim |
| 4. Saatli yem, bakım, tuvalet temizliği | 2.6 Bakım işleri |
| 5. Köpek arttıkça işçi alma | 2.8 Personel |
| 6. Köpek başına devlet yardımı, ekonomi | 2.11 Ekonomi |
| 7. Renkli/şekilli yumurtalardan çıkan köpekler | 2.3 Dünya, 2.4 Yumurtalar |
| 8. Prison Architect tarzı görevlendirme ekranı | 2.9 Görevlendirme ekranı |
| 9. İnşa arayüzü | 2.7 Binalar ve inşa |
| 10. Başlangıç parası | 2.11 Ekonomi |
| 11. Köpek ve personel attribute'ları | 2.5, 2.8 |
| 2D grafik, ses | 3.4 Grafik hattı, 2.13 Ses |

## 1. Verilen kararlar

- **Motor:** Phaser 3 (son kararlı 3.x) + TypeScript + Vite. Tarayıcıda çalışır. Çıktı tek dosyalık
  `dist/index.html` (vite-plugin-singlefile), çift tıkla açılır. Geliştirme sırasında `npm run dev`.
- **Grafik:** Tamamen kodla üretilen pixel-art. 16 px native, 3x ölçek, ekranda 48 px kare. Dış resim dosyası yok.
- **Kontrol:** Hibrit. Avatar ile keşif ve elle bakım; `Tab` ile kuş bakışı **Yönetim modu** (inşa, bölge, görevlendirme).
- **Dünya içeriği:** Yumurtalar ana keşif ödülü; nadiren yetişkin sokak köpeği.
- **Klasör:** `C:\Users\sinik\dev\pati-barinagi` (OneDrive dışı). Git deposu açılır, her kilometre taşında commit atılır.
- **Ad:** Pati Barınağı (değiştirmesi kolay: `src/config/game.ts` içinde tek sabit).
- **Dil:** Oyun içi metinler Türkçe, `src/i18n/tr.ts` içinde anahtarlı. İngilizce sonradan eklenebilir.
- **Para birimi:** ₺ (ayardan değişir).

## 2. Oyun tasarımı

### 2.1 Çekirdek döngü

Günlük: sabah yemi (08:00) → kulübeleri temizle → oyun/eğitim → öğleden sonra dünyada yumurta ara →
akşam yemi (18:00) → gün içinde gelen sahiplenicilere köpek eşleştir → gece uyu.
Haftalık (Pazartesi 06:00): köpekler yaşlanır ve aşama atlar, devlet yardımı yatar, maaşlar ödenir, denetim raporu çıkar.
Büyüme: daha çok kulübe → daha çok köpek → işler yetişmez → personel al → görevlendirme ekranıyla otomatikleştir →
uzak biyomlardan nadir yumurtalar getir → seçici sahiplenicileri memnun et → itibar ve lisans seviyesi artsın.

Kaybetme durumu yok; para eksiye düşerse maaşı ödenmeyen personel istifa eder, denetim çarpanı düşer. Oyun sonu
hedefi (isteğe bağlı): 50 başarılı sahiplendirme ve itibar 90.

### 2.2 Zaman

- 1 oyun günü = 24 saat. 1x hızda 10 gerçek dakika (1 gerçek saniye = 2,4 oyun dakikası). Hızlar: duraklat, 1x, 2x, 4x.
- Gece 22:00–06:00. Oyuncu ofiste/evde uyursa gece 12x hızda geçer; personel gece vardiyası çalışmaya devam eder.
- Hafta = 7 gün. Hafta tiki Pazartesi 06:00. Haftalık büyüme, yardım, maaş, denetim hep burada.
- Yem pencereleri: 08:00 ve 18:00, ±1 saat tolerans. Ayarlanabilir (görevlendirme ekranındaki politikalar).
- Gün/gece tonu: 7 anahtar kareli renk interpolasyonu (Turnip Farm'daki `TINT_KEYS` modeli), gece lambaları ışık noktası olur.

### 2.3 Açık dünya

- Prosedürel harita, tohumlu (seed). 200×200 kare. Biyomlar gürültü fonksiyonuyla: çayır (merkez), orman, göl/dere,
  tepe/kaya, çiçek tarlası, bataklık. Yollar barınaktan harita kenarına (sahiplenicilerin geliş yolu).
- Barınak arsası merkezde, 40×32 karelik inşa edilebilir alan; parsel satın alarak 88×64'e kadar büyür.
- İlgi noktaları: **yuvalar** (yumurta doğar, birkaç günde yeniden dolar), **terk edilmiş evler/kulübeler**
  (sokak köpeği ihtimali), **meyve çalıları** (ödül maması hammaddesi), taş/odun düşen ağaçlar (inşa indirimi, isteğe bağlı).
- Yumurta nadirliği barınağa uzaklık ve biyomla artar: çayır sıradan, orman az bulunur, tepe/göl nadir,
  harita köşelerindeki özel yuvalar efsanevi.
- Sis (fog of war) ve mini harita; keşfedilen yuvalar haritada işaretlenir.
- Avatar: WASD yürü, Shift koş (dayanıklılık çubuğu), E etkileşim. Sırt çantası 3 yumurta (yükseltme ile 6).
  Sokak köpeği: ödül maması verince güven kazanır, peşinden gelir; barınağa girince kayda alınır.
- Gece dışarıda kalırsan görüş daralır; 02:00'de bayılıp ofiste uyanırsın, çantandaki yumurtalar korunur (ceza yok, zaman kaybı).

### 2.4 Yumurtalar ve genetik

Yumurta görünür özellikleri → köpek özellikleri (oyuncu incelediğinde bir kısmı ipucu olarak gösterilir):

| Yumurta | Belirlediği köpek özelliği |
|---|---|
| Şekil: yuvarlak / oval / sivri | Gövde tipi: tıknaz / standart / ince |
| Boy: küçük / orta / büyük | Yetişkin boyutu: S / M / L (yem, kulübe ihtiyacı) |
| Ana renk | Tüy rengi (8 temel palet + nadir altın/gökkuşağı) |
| Desen: düz / benek / yama / çizgi | Tüy deseni |
| Gizli: sıcaklık, sallanma, parlaklık | Huy (sakin/oyuncu/çekingen/cesur), zekâ 1–5, enerji 1–5 |
| Nadirlik: sıradan / az / nadir / efsanevi | Kulak ve kuyruk varyantları, özel paletler, sahiplendirme ücreti katsayısı |

- Yumurta **kuluçka** binasında 3 günde çıkar (yükseltilmiş kuluçkada 2). Kuluçka dışında bekleyen yumurta çıkmaz, bozulmaz.
- Çıkan köpek yavru (hafta 0) olarak doğar; isim otomatik gelir, panelden değişir.
- Genom deterministik bir kayıttır (`DogGenome`): sprite bu kayıttan üretilir, aynı genom her zaman aynı görünümü verir.

### 2.5 Köpekler

**Sabit özellikler:** ad, boyut sınıfı (S/M/L), gövde tipi, kulak (düşük/dik/yuvarlak), kuyruk (kıvrık/düz/tüylü),
tüy rengi, ikincil renk, desen, huy, zekâ 1–5, enerji 1–5, nadirlik, köken (yumurta/sokak), doğum haftası.

**Büyüme aşamaları (haftalık tik):** yavru 0–3, genç 4–11, yetişkin 12+. Aşama değişince sprite büyür, yem porsiyonu
ve ihtiyaç hızları değişir, sahiplendirilebilirlik kuralları değişir (yavrular en çok istenir ama tuvalet eğitimi zordur).

**İhtiyaçlar (0–100, oyun saati başına değişim; ilk denge değerleri `src/config/balance.ts` içinde):**

| İhtiyaç | Yönü | Ne doldurur / boşaltır | Kötü olursa |
|---|---|---|---|
| Açlık | +5/sa, yavru +7 | Yem kabı dolu ve öğün penceresi: -60 | >85 uzun sürerse sağlık düşer, mod düşer |
| Oyun | -4/sa | Oyun seansı +35 (oyuncu/personel/oyuncak), bahçe bölgesi +2/sa | <30: havlama, sadakat düşer |
| Tuvalet | +7/sa, öğünden sonra +15 | Tuvalet bölgesine gider (eğitimliyse) ya da olduğu yere yapar | Pislik karesi: hijyen ve denetim düşer |
| Hijyen | -1,5/sa, pisliğe basınca -8 | Yıkama/tımar istasyonu: 100 | <25: sağlık düşer, sahiplenici reddeder |
| Sağlık | türev | Diğer ihtiyaçlar iyiyse +2/sa; veteriner tedavisi +40 | <40: hasta, sahiplendirilemez, tedavi masrafı |
| Sadakat (güven) | Oyuncu etkileşimi +2, gün boyu ilgisiz -1 | Sadece oyuncunun elle yaptığı işler ve sevme | Eğitim başarı şansı ve sahiplendirme hazırlığı düşer |
| Enerji | Gece uyuyunca dolar | Gündüz yavaş düşer | Düşükse oyun/eğitim reddeder |

**Eğitim:** 6 beceri, her biri 0–100 ilerleme; 100 olunca öğrenilmiş sayılır: otur, bekle, gel, tasma, tuvalet eğitimi, sosyallik.
Eğitim seviyesi = öğrenilmiş beceri sayısı (0–6). Seans başarısı: eğitmen becerisi × zekâ × sadakat × mod.
Tuvalet eğitimi kademeli: beceri yüzdesi kadar olasılıkla tuvalet alanına gider; alandaki pislik kapsanır (M10).

**Davranış (durum makinesi):** uyu / boşta dolaş / yem kabına git / tuvalete git / oyna / eğitim al / kulübeye dön /
havla (ihtiyaç kritik). Köpekler kulübeye atanır (otomatik ya da elle), kulübe kapasitesi aşılırsa stres.

### 2.6 Bakım işleri

Hem oyuncu (avatar, E tuşu, seçili araç) hem personel aynı görevleri yapar; oyuncu yaparsa sadakat bonusu.

| İş | Nasıl | Süre | Araç/bina |
|---|---|---|---|
| Yem ver | Kabı doldur (kilerden yem taşınır) | 20 dk | Yem kabı + Kiler/Mutfak |
| Su ver | Yalağı doldur | 10 dk | Su yalağı (mutfak varsa otomatik) |
| Temizle | Pislik karesini fırçala, çöp kutusuna götür | 15 dk/kare | Fırça aracı, Çöp kutusu |
| Oyna | Köpekle oyun seansı | 30 dk | Oyuncak, Oyun bahçesi bölgesi |
| Eğit | Beceri seansı | 45 dk | Eğitim alanı bölgesi (bonus) |
| Tımar/yıka | Hijyeni doldur | 30 dk | Tımar istasyonu |
| Tedavi | Sağlık +40, ilaç masrafı | 40 dk | Veteriner odası |
| Sev | Sadakat +2 | 5 dk | Yok |
| Kuluçkaya koy / al | Yumurtayı yerleştir, yavruyu kulübeye ata | 5 dk | Kuluçka |

Uyarı akışı (HUD sağ üst): "Boncuk aç", "Kulübe 3 kirli", "Kiler boş", "Sahiplenici bekliyor" gibi tıklanabilir uyarılar.

### 2.7 Binalar ve inşa arayüzü

Yönetim modunda `B` ile inşa çubuğu açılır: kategori → öğe listesi (maliyet, boyut, açıklama) → ızgarada hayalet
önizleme (yeşil geçerli / kırmızı geçersiz) → tıkla yerleştir. Çit ve yol sürükleyerek çizilir. `R` döndür,
`X` yık (yüzde 50 iade), `Z` bölge boyama. İnşaat kısa süre alır (küçükler anında, büyükler 1–3 saat), parası peşin.

| Kategori | Bina / nesne | Boyut | Maliyet (ilk değer) | İşlev |
|---|---|---|---|---|
| Altyapı | Çit, kapı, yol, lamba, çöp kutusu | 1×1 | 15 / 60 / 8 / 70 / 120 | Sınır, geçiş, yürüme hızı, gece ışığı, atık |
| Barınma | Küçük kulübe (1 köpek S/M), Büyük kulübe (2 köpek, L uygun) | 2×2 / 3×2 | 600 / 1.100 | Köpek kapasitesi |
| Besleme | Yem kabı, Su yalağı, Kiler (yem stoğu), Mutfak | 1×1, 1×1, 2×2, 3×2 | 40 / 120 / 500 / 1.500 | Yem, su, stok, hızlı besleme + otomatik su |
| Bakım | Tımar istasyonu, Veteriner odası | 2×2 / 3×3 | 1.200 / 3.000 | Hijyen, sağlık |
| Büyüme | Kuluçka (3 yuva) → yükseltme (6 yuva, 2 gün) | 2×2 | 900 → 2.000 | Yumurta çıkarma |
| Eğitim/oyun | Oyuncaklar (top, halat, tünel), Eğitim engelleri | 1×1 | 90–250 | Oyun ve eğitim bonusu |
| Personel | Personel odası, Dolaplar | 3×2 | 900 | Mola, dayanıklılık |
| Yönetim | Ofis (başlangıçta var) → Seviye 2 → Seviye 3 | 3×3 | 4.000 / 12.000 | Lisans: azami 8 / 20 / 45 köpek, sahiplenici akışı |
| Dekor | Çiçek, bank, tabela | 1×1 | 30–200 | İtibar ve ziyaretçi memnuniyeti |
| Arsa | Parsel genişletme | 16 sütun | 2.500 | İnşa alanı |

**Bölgeler (zone boyama, ücretsiz):** Oyun bahçesi, Tuvalet alanı, Eğitim alanı, Karantina (hasta köpek), Personel-only.
Bölgeler hem köpek davranışını (tuvalet, oyun) hem personel görev filtresini belirler.

Başlangıç barınağı: ofis, 2 küçük kulübe, kiler, 1 yem kabı, 1 su yalağı, temel kuluçka, çevre çiti ve kapı,
1 yetişkin köpek (öğretici), yakında 1 yumurta.

### 2.8 Personel

**Roller:** Bakıcı (yem, su, temizlik, oyun), Eğitmen (eğitim, oyun), Veteriner (tedavi, tımar). Her rol diğer işleri
düşük verimle yapabilir (ayar).

**Özellikler:** hız 1–5, çalışkanlık 1–5 (görev süresi), şefkat 1–5 (köpek sadakati ve eğitim bonusu), dayanıklılık 1–5
(mola sıklığı), rol becerisi 1–5, haftalık maaş (rol tabanı × beceri katsayısı). Karakter etiketleri: "Köpek fısıldayan",
"Titiz", "Tembel", "Gece kuşu", "Sakar" (nadiren yem döker).

**İşe alma:** Ofiste her gün 3 aday yenilenir; kart üzerinde özellikler ve maaş. İşten çıkarma anında, 1 haftalık tazminat.
Maaş taban değerleri: Bakıcı 350, Eğitmen 500, Veteriner 650 ₺/hafta.

**Personel yapay zekâsı:** Görev tahtasından (3.6) vardiya saatinde, atandığı bölgelerde, öncelik ayarlarına göre iş seçer;
yürür, yapar, bırakır. Dayanıklılık bitince personel odasına mola. Maaş ödenmezse 1 hafta sonra istifa eder.

### 2.9 Görevlendirme (otomasyon) ekranı

`F` ile açılır, Prison Architect'in Deployment + Policy ekranlarının birleşimi. Üç sekme:

1. **Vardiya çizelgesi:** satırlar personel, sütunlar 24 saat. Boyayarak Çalış / Mola / İzin. Hazır şablonlar (gündüz 08–18, gece 20–06).
2. **Bölge ataması ve öncelikler:** harita üzerinde bölgeler renkli; personeli bölgeye sürükle. Her personel için görev
   öncelik kaydırıcıları: Yem, Su, Temizlik, Oyun, Eğitim, Tımar, Tedavi, Stok taşıma (Kapalı / 1–5).
3. **Politikalar:** öğün saatleri; "yem stoğu X altına düşünce otomatik sipariş"; temizlik eşiği; "eğitim seviyesi < N olan
   köpekleri eğit"; "hasta köpeği karantinaya al"; "sahiplendirme için hazır köpekleri otomatik listele".

Ekranın altında canlı görev tahtası: bekleyen / alınmış görevler, kim yapıyor, ne kadar bekledi. Darboğaz uyarısı
("Temizlik görevleri 3 saattir bekliyor: bakıcı al").

### 2.10 Sahiplendirme

- 10:00–17:00 arasında sahiplenici gelir; günlük sayı itibar ve ofis seviyesine bağlı (0–3). Yoldan yürüyüp ofise gelir,
  2 saat bekler, ilgilenilmezse gider (itibar -1).
- İstek kartı: **zorunlu** şartlar (boyut sınıfı, aşama) + **tercihler** (renk, desen, huy, en az eğitim seviyesi,
  tuvalet eğitimi, enerji). Bütçesi ücreti belirler (150–900 ₺; nadir köpekte katsayı).
- Eşleşme puanı 0–100. Köpek uygunluğu: sağlık ≥ 60, hijyen ≥ 40, sadakat ≥ 30, hasta değil.
  Sahiplendirme paneli en iyi 3 köpeği önerir; oyuncu kabul/ret verir.
- Sonuç: puan ≥ 70 itibar +4..+6; 50–69 itibar +1; < 50 kabul edilirse itibar -3 ve yüzde 20 ihtimalle köpek 3 gün sonra geri gelir.
- İtibar 0–100: sahiplenici sıklığı, yardım çarpanına küçük bonus, istek çeşitliliği.

### 2.11 Ekonomi

- **Başlangıç parası:** 6.000 ₺ (`balance.ts`).
- **Gelir:** Devlet yardımı (haftalık) = köpek sayısı × 150 ₺ × denetim çarpanı (0,4–1,5). Lisans üstündeki köpekler için
  yardım yok ve denetim cezası. Sahiplendirme ücretleri. Nadir bağış olayları (isteğe bağlı, M7).
- **Gider:** Yem (20 porsiyonluk çuval 80 ₺; porsiyon S 1 / M 1,5 / L 2, yavru 0,5), haftalık maaşlar, inşaat, arsa,
  ilaç (tedavi başına 60 ₺), bina bakımı (haftalık küçük bedel), otomatik sipariş teslimatı (+10 ₺).
- **Denetim (haftalık):** ortalama hijyen, ortalama sağlık, pislik sayısı, kapasite aşımı, stok durumu → çarpan.
  Raporda her kalemin etkisi yazılır ki oyuncu neyi düzelteceğini görsün.
- **Denge kilidi:** "köpek biriktirip yardım toplama" stratejisi masraf ve denetimle dengelenir; sahiplendirme her zaman
  haftalık yardımdan kârlı.
- Finans ekranı: haftalık gelir/gider kırılımı, 8 haftalık grafik, nakit projeksiyonu.

### 2.12 Arayüz ekranları ve kontroller

Ekranlar: HUD (para, gün/saat/hafta, hız, köpek/kapasite, itibar, uyarılar, alt bağlam ipucu), Köpek paneli,
Köpek listesi (sıralanabilir tablo), İnşa çubuğu, Personel paneli + işe alma, Görevlendirme, Sahiplendirme masası,
Kuluçka paneli, Finans, Harita, Ana menü (yeni oyun + tohum, devam, ayarlar, kayıt/dışa aktar), Haftalık rapor açılır penceresi.

| Tuş | Avatar modu | Yönetim modu |
|---|---|---|
| WASD / ok | Yürü | Kamerayı kaydır (fare sürükleme de) |
| Shift | Koş | – |
| E | Bağlama göre etkileşim (alt çubuk ne yapacağını yazar) | – |
| 1–5 | Araç: Yem kepçesi, Fırça, Oyuncak, Tasma/ödül, Sev | – |
| Tab | Yönetim moduna geç | Avatara dön |
| B / Z / X / R | – | İnşa / Bölge / Yık / Döndür |
| F, P, I, O, K, M, N | Görevlendirme, Personel, Köpek listesi, Sahiplendirme, Kuluçka, Harita, Finans (her iki modda) |
| Space, - / + | Duraklat, hız düşür / artır (her iki modda; HUD düğmeleri de var) |
| Fare tekeri | Yakınlaştır | Yakınlaştır |
| Esc | Menü / paneli kapat | Paneli kapat / araçtan çık |

### 2.13 Ses

Ses dosyası kullanılmaz; her şey Web Audio API ile çalışma anında sentezlenir (`src/audio/`):

- **Efektler:** havlama (boyuta göre perde: S ince, L kalın), sızlanma, yeme, yumurta çatlama + çıkış cıngılı, para,
  bina yerleştirme, fırça, ayak sesi (zemine göre), UI tık, uyarı, sahiplendirme başarı cıngılı, hata. Osilatör + gürültü +
  zarf (ADSR) tabanlı küçük bir sentez modülü; her efekt bir preset.
- **Müzik:** üretken ortam müziği. Gündüz teması (majör pentatonik, hafif arpej), gece teması (yavaş pad).
  Akor dizisi ve melodi tohumlu rastgele, ileriye zamanlanmış (lookahead scheduler).
- Ayarlar: ana ses, efekt, müzik, sessiz. Tarayıcı kuralı gereği ilk tıklamadan sonra ses başlar.
- Gerçek ses istenirse yönlendirme README'de: Kenney (CC0 efektler), OpenGameArt ve Kevin MacLeod (CC-BY müzik).
  Kod, dosya tabanlı sese geçişi tek bir `SoundSource` arayüzü ile kolaylaştıracak.

### 2.14 Kayıt

- Otomatik: her sabah 06:00 ve hafta tikinde `localStorage` (3 yuva). Elle kaydet. JSON dışa/içe aktarma düğmesi.
- İçerik: sürüm, tohum, zaman, dünya deltaları (toplanan yumurtalar, yuva zamanlayıcıları, keşif sisi), barınak ızgarası,
  tüm varlıklar (köpek genomları + ihtiyaçlar, personel, sahiplenici kuyruğu), ekonomi, ayarlar.
- `SAVE_VERSION` + sürüm başına migrasyon fonksiyonu. Yükleme doğrulamalı: bozuk değerler kırpılır, olmayan bina referansı düşürülür.

## 3. Teknik mimari

### 3.1 Yığın

Phaser 3 (son kararlı 3.x), TypeScript 5, Vite 7, Preact + @preact/signals (panel arayüzü), vitest (birim ve simülasyon
testleri), vite-plugin-singlefile (tek dosya çıktı). Sürümler kurulumda `package.json` içinde sabitlenir.
Hedef tarayıcı: güncel Chrome/Edge. `run.bat`: `npm install` yoksa yapar, `npm run dev` başlatıp tarayıcıyı açar;
`build.bat`: `dist/index.html` üretir.

### 3.2 Klasör yapısı

```
C:\Users\sinik\dev\pati-barinagi\
  package.json  vite.config.ts  tsconfig.json  index.html  run.bat  build.bat  README.md  .gitignore
  src/
    main.ts                 Phaser.Game kurulumu (pixelArt, Scale.FIT, 1280x720 taban)
    config/                 game.ts (ad, sürüm), balance.ts (tüm denge sayıları), keys.ts (tuşlar)
    content/                buildings.ts, eggs.ts, dogParts.ts, staffRoles.ts, adopterTemplates.ts, names.ts (veri, kod değil)
    i18n/                   tr.ts, t() yardımcı
    core/                   EventBus, Rng (tohumlu, xorshift), Clock (zaman sistemi), SaveManager, ids
    sim/                    Phaser'dan BAĞIMSIZ oyun mantığı
      world/                WorldGen (gürültü, biyom, yuva/yol yerleşimi), TileWorld (katmanlar: zemin/nesne/çarpışma/bölge), Pathfinder (A*, min-heap), SpatialHash
      entities/             Player, Dog (+DogGenome, DogBrain), Egg, Staff (+StaffBrain), Adopter
      systems/              NeedsSystem, GrowthSystem, MessSystem, TaskBoard, BuildSystem, IncubatorSystem, AdoptionSystem, EconomySystem, InspectionSystem, AlertSystem
      Sim.ts                Tüm sistemleri birleştiren tek giriş: sim.update(dtMinutes), sim.toJSON(), Sim.fromJSON()
    render/                 SpritePainter (piksel çizim yardımcıları), TileArt, BuildingArt, DogPainter, HumanPainter, EggArt, IconArt, TextureRegistry (canvas → Phaser texture), DayNight (ışık haritası)
    scenes/                 BootScene (dokuları üret), MenuScene, WorldScene (harita, kamera, varlık sprite'ları, girdi), OverlayScene (dünya içi çubuklar/etiketler)
    ui/                     Preact: App.tsx, HUD, DogPanel, DogList, BuildBar, StaffPanel, HirePanel, Deployment (görevlendirme), AdoptionDesk, IncubatorPanel, Finance, MapPanel, WeeklyReport, Settings; store.ts (sim → signals köprüsü, 10 Hz)
    audio/                  Synth (osilatör/gürültü/zarf), Sfx (presetler), Music (üretken), AudioBus (ses seviyeleri)
  tests/
    unit/                   genome, needs, economy, inspection, adoption match, pathfinder, taskboard, save roundtrip
    sim/                    headless 4 haftalık simülasyon koşusu (bot bakıcı) + değişmezler
```

### 3.3 Sim / render ayrımı ve tick modeli

- `sim/` altında `phaser` import edilmez. Böylece vitest Node'da tüm mantığı koşar (Turnip Farm'daki "settings pygame
  import etmez" kuralının genişletilmiş hâli).
- Zaman: Phaser `update(dt)` → `dtMinutes = dt/1000 × 2,4 × hız` → `sim.update(dtMinutes)`. Sistemler dakika bazlı;
  karar veren beyinler (DogBrain, StaffBrain) her 5 sim dakikasında yeniden değerlendirir, hareket her karede kare-başı piksel ilerler.
- Saat olayları: `Clock` her saat başı ve gün/hafta tiklerinde EventBus'a `hour`, `day`, `week` yayar; sistemler abone olur.
- Render, sim'i okur ama yazmaz. Girdi tek noktadan toplanır (`InputState`), sim'e komut nesnesi olarak gider
  (`sim.command({type:'placeBuilding', ...})`). Komutlar test edilebilir ve kayıt tekrarına (replay) hazır.

### 3.4 Prosedürel grafik hattı

- `SpritePainter`: 16×16 (ya da nesneye göre 32/48) piksel tuvalinde `px`, `rect`, `ellipse`, `line`, `outline`, `shade`
  yardımcıları; sonuç `ImageData` → canvas → `textures.addCanvas`. Nearest-neighbour ölçek, `pixelArt: true`.
- Küçük sabit şeyler (ikonlar, çiçek, oyuncak) için Turnip Farm'daki palet-harfli string sanatı.
- **DogPainter (modüler):** genom → 3 aşama × 4 yön × kareler (yürü 2, otur, yat, ye). Gövde tipi/boyut elipsi,
  kafa, kulak/kuyruk varyantı, bacaklar, desen maskesi (benek/yama/çizgi), palet, dış çizgi. Sonuç genom anahtarıyla önbelleğe
  alınır; sahnede yalnız görünen köpeklerin dokusu üretilir.
- HumanPainter: oyuncu, personel (rol rengi + şapka/önlük), sahiplenici (rastgele palet) aynı iskeletten.
- BuildingArt: boyut ve türe göre duvar/çatı/kapı/ikon parametrik; çit ve yol 16'lı otomatik kenar (Turnip Farm `build_fence` mantığı).
- TileArt: zemin varyantları, su 2 kare animasyon, biyom geçiş kenarları.
- DayNight: RenderTexture ışık haritası (gece rengiyle doldur, lambaların gradyanını ERASE ile sil, MULTIPLY ile çiz).

### 3.5 Dünya üretimi ve yol bulma

- WorldGen: tohumlu simplex/value gürültü ile yükseklik + nem → biyom; dere için akış çizgisi; barınak arsası düzleştirilir;
  yuvalar biyom başına yoğunlukla poisson-disk benzeri dağılır; yollar barınaktan 2 kenara A* ile çizilir.
- TileWorld katmanları: zemin, nesne (ağaç/kaya/bina parçası), çarpışma, bölge, pislik. Chunk'lı (16×16) Phaser Tilemap
  katmanları; sadece görünen chunk'lar güncellenir.
- Pathfinder: A* (min-heap), 8 yön, köşe kesme yok. Personel/köpek/sahiplenici yalnız barınak arsası + yol üzerinde
  yol bulur; avatar serbest çarpışma ile yürür. Yollar kısa süre önbelleklenir, bina yerleşince önbellek temizlenir.

### 3.6 Personel görev sistemi (TaskBoard)

- Görev: `{ id, type, targetId, tile, zoneId, urgency 0–1, claimedBy, durationMin, createdAt }`.
- Üreticiler: NeedsSystem (yem/su/oyun/tımar/tedavi/eğitim eşikleri), MessSystem (temizlik), BuildSystem (stok taşıma),
  IncubatorSystem (çıkan yavruyu kulübeye taşı), politikalar.
- Seçim: vardiyadaki personel, atandığı bölgelerdeki, rolüne uygun görevlerden
  `puan = urgency × rolVerimi × personelÖncelik / (1 + mesafe/20)` en yükseğini alır; kilitler; başarısızsa serbest bırakır.
- Aynı görev iki kişiye gitmez; oyuncu bir görevi yaparsa görev düşer. Tahtadaki bekleme süreleri darboğaz uyarısını besler.

### 3.7 UI teknolojisi

- Phaser tuvali altta, Preact DOM overlay üstte. Paneller tablolar, ızgaralar, kaydırıcılar içerdiği için DOM çok daha
  hızlı geliştirilir ve test edilir. Fare olayları: panel açıkken tuval girdisi kapanır (`pointer-events` yönetimi).
- `store.ts`: sim durumundan 10 Hz'de türetilen signal'lar (para, saat, seçili köpek, uyarılar). Paneller salt okunur
  gösterir, değişiklikleri `sim.command()` ile gönderir.
- Dünya içi küçük göstergeler (ihtiyaç ikonu, isim etiketi, seçim çerçevesi) Phaser OverlayScene'de.
- Pixel-art HUD stili: CSS ile köşeli paneller, sistem fontu yerine gömülü bitmap benzeri font (CSS `image-rendering`),
  Türkçe karakter desteği için normal bir sans font yedeği.

### 3.8 Ses motoru

- `Synth`: `AudioContext`, osilatör (sine/square/tri/saw), gürültü tamponu, ADSR zarf, düşük geçiren filtre, basit yankı.
- `Sfx`: preset tablosu (ad → parametre). Havlama: kısa saw + perde düşüşü + filtre; boyuta göre taban frekans.
- `Music`: 4 akorluk dizi, pentatonik melodi, tohumlu rastgele; 0,1 s lookahead ile zamanlama; gündüz/gece geçişi crossfade.
- `AudioBus`: master/sfx/music gain düğümleri; ayarlar kayda yazılır.

### 3.9 Kayıt formatı

`{ version, seed, clock, world:{collectedNests, nestTimers, fog, plotRect}, grid:{buildings[], zones[], mess[]},
entities:{dogs[], eggs[], staff[], adopters[], player}, economy, reputation, policies, settings }`.
`Sim.fromJSON` her alanı doğrular ve kırpar; sürüm eskiyse migrasyon zinciri çalışır.

### 3.10 Turnip Farm'dan taşınan desenler (fikir olarak, kod TS'ye yeniden yazılır)

- `timesystem.py`: monoton dakika modeli ve `TINT_KEYS` anahtar-kare interpolasyonu → `core/Clock.ts`, `render/DayNight.ts`.
- `save.py`: asla fırlatmayan okuma + doğrulayıcı yükleme → `core/SaveManager.ts`.
- `game.py` `Input` dataclass + tek `gather_input` sınırı → `scenes/WorldScene` girdi toplama + `sim.command()`.
- `resolve_action()` "aynı fonksiyon hem ipucu hem eylem" → avatar E tuşu bağlam çözümleyici.
- `sprites.py` palet-harfli string sanatı ve otomatik çit kenarları → `render/SpritePainter`, `BuildingArt`.
- `audio.py` saf sentez fikri → Web Audio `Synth`.
- Headless smoke test + ekran görüntüsü → vitest sim koşusu + tarayıcıda ekran görüntüsü.

## 4. Kilometre taşları

Her taşın sonunda oyun çalışır hâlde olur, testler yeşildir, commit atılır ve tarayıcıda ekran görüntüsü alınır.

- **M0 İskelet:** proje kurulumu, `run.bat`/`build.bat`, tohumlu dünya üretimi, chunk'lı tilemap, avatar yürüme/koşma,
  kamera, Clock + gün/gece, HUD (para, saat, hız), duraklat/hız, mini harita, Yönetim modu kamera geçişi, localStorage kayıt/yükle, ana menü.
- **M1 Köpekler ve ihtiyaçlar:** DogGenome + DogPainter, NeedsSystem, DogBrain, başlangıç barınağı (önceden yerleşik),
  yem kabı/su/kiler, pislik ve temizlik, sevme/oyun/eğitim seansları (elle), Köpek paneli ve listesi, uyarı akışı, araç seçimi.
- **M2 İnşa:** BuildSystem, inşa çubuğu, hayalet önizleme, çit/yol sürükleme, bölge boyama, yıkma, tüm çekirdek binalar,
  kulübe ataması, arsa genişletme, yol bulma önbelleği.
- **M3 Yumurta ve büyüme:** yuvalar ve yeniden dolma, yumurta toplama/sırt çantası, yumurta inceleme ipuçları, kuluçka,
  çıkış, GrowthSystem (haftalık aşama), sokak köpeği karşılaşması, sis ve harita işaretleri, meyve çalısı/ödül maması.
- **M4 Ekonomi ve sahiplendirme:** EconomySystem (yardım, maaş, yem, bakım), otomatik sipariş, InspectionSystem + haftalık
  rapor, AdoptionSystem (sahiplenici üretimi, yürüyüş, istek kartı, eşleşme, itibar, geri dönüş), Finans ekranı, lisans seviyeleri.
- **M5 Personel ve görevlendirme:** Staff + StaffBrain, TaskBoard, işe alma/çıkarma, personel odası ve mola, Görevlendirme
  ekranı (3 sekme), politikalar, darboğaz uyarıları, gece vardiyası.
- **M6 Ses ve cila:** Synth/Sfx/Music, ayarlar, öğretici ipuçları (ilk gün rehberi), denge geçişi (4 haftalık bot simülasyonuyla),
  JSON dışa/içe aktarma, tek dosya build, README (kontroller, ses değiştirme rehberi).
- **M7 İsteğe bağlı:** hava/mevsim, olaylar (sürpriz denetim, bağış, kaçan köpek), yaşlı köpek aşaması, başarımlar, İngilizce dil.
- **M8 Canlı Barınak (2026-09-13, tamamlandı):** kayıt sürümü 2 + migrasyon; susuzluk ve su yalağı (su görevi, denetim kalemi);
  dekor puanı ve mutfak etkisi; OverlayScene (emote balonları, isim etiketleri, L); köpek-köpek dostluk (birlikte oyun,
  hırlaşma, havlama, dost kulübe tercihi); huy ve becerilerin davranışa bağlanması (Çağır aracı, otur, bekle, tasma/gezdirme);
  hastalık (pire/soğuk/mide) + bulaşma + karantina politikası; teknik borç (ışık haritası boyutu, doku sızıntısı, toast kuyruğu,
  köpek listesi sıralama/filtre, ölü kod).
- **M9 Arayüz ve Dokunmatik (2026-09-13, tamamlandı):** üst durum şeridi + kategorili alt menü çubuğu (menu.ts tek tablo),
  layout.css değişkenleri ve z ölçeği, sol/sağ sütunlar, Kontroller sayfası; sahiplendirme anahtarı (policies.adoptionsOpen)
  ve köpek başına keep; cihaz sınıfı (desktop/tablet/phone) + dokunmatik algılama, responsive.css; görevlendirme ızgarası
  pointer ile, öncelik adımlayıcıları; DPR'lı canvas, iki işaretçi (pinch/pan); PlayerNav dokun-git + E düğmesi;
  telefon sayfaları (uyarı/çanta/harita) ve çevir ekranı.
- **M10 Kapı, Tuvalet ve Zorluk (2026-09-13, tamamlandı):** otomatik çit kapısı (TileWorld.gateOpen, GateSystem, Pathfinder
  throughGates, gates.ts giriş noktası, açık kapı karesi + gıcırtı); tuvalet alanı her modda görünür (toiletLayer), kademeli
  tuvalet eğitimi, kapsanan pislik (MessSystem kapasite/etkin sayı/aciliyet, "Tuvalet alanı doldu"), çöp kutusu bonusu,
  gece tuvaleti ve gezintide rahatlama; zorluk seviyesi (BALANCE.difficulty, Sim.difficulty); kredi ve iflas
  (loan/negativeWeeks/gameOver, GameOverPanel); bina döndürme (Building.rot, buildingSize/solidRowsFor, -r1 dokular, R / Döndür).
- **0.10.1 bakım (2026-09-16):** NPC/köpek yol adımında kapalı kapı kontrolü (GateSystem.canEnter) ve uyku döngüsünde kapı
  güncellemesi, iflasta uyku döngüsünün durması; telefon dikey yönünde simülasyon duraklatması (OrientationPause); UI klavye
  olaylarının Phaser'dan ayrılması (ui/keyboard.ts); sürüm eşitleme. Doğrulama notları ve açık sorunlar
  `docs/CLAUDE_HANDOFF.md` içinde.
- **0.11.0 Telefona kurulum (2026-09-16):** PWA — kodla üretilen ikonlar (`scripts/make-icons.mjs`, `public/icons`),
  `manifest.webmanifest` (tam ekran, yatay), `index.html` meta/ikon bağlantıları, göreli `base`, service worker
  (`public/sw.js`: sürümlü önbellek, sayfa için ağ öncelikli, çevrimdışı açılış; sürüm `?v=` ile), `src/pwa.ts`
  (kayıt, güncelleme bildirimi, kurulum istemi, tam ekran), `InstallControls` (ana menü + Ayarlar: Ana ekrana ekle,
  iOS/Android ipucu, Tam ekran, Şimdi yenile), GitHub Pages iş akışı (`.github/workflows/pages.yml`), README bölümü.
  iOS ve Android tek paketle; APK/IPA (Capacitor) kapsam dışı.
- **0.12.0 Telefon HUD yeniden düzeni (2026-09-16):** alt parçalar `.hud-dock` flex satırında (sol: araç çubuğu ya da
  telefonda `ToolPopover`; orta: inşa çubuğu + ipucu + alt menü; sağ: E/Koş + mini harita) → çakışma imkânsız; `--top-h`/
  `--dock-h` ResizeObserver ile ölçülür (HUD.tsx), `.col-right` buna göre biter; kutu modeli border-box; üst şerit
  `minmax(0,1fr)` sütunlar, kaydırılabilir çip şeridi, telefonda ⏸ + döngülü hız ve ikonlu mod düğmesi, kısa saat; alt menü
  öğeleri esnek; ≤340 px yükseklik ve ≤719 px genişlik kademeleri; ana menü kısa ekranda iki sütun (`.menu-intro`/`.menu-form`);
  `src/ui/layout.ts` (classifyLayout, hudSizes, dockFits) + `tests/unit/layout.test.ts`.
- **0.12.1–0.12.3 Dokunma düzeltmeleri (2026-09-18/19):** #ui üstünde başlayan işaretçiler dünya girdisi sayılmaz
  (`ui/uiTarget.ts`), pinch iki taze parmak yoksa bırakılır, `pointerupoutside`/`touchcancel`/`blur`/gizlenme sıfırlar;
  klavye ayrımı yalnız metin girişlerinde, düğmeler tıklamadan sonra odağı bırakır; kuluçkadan alınan yumurtanın süresi
  korunur (`Egg.hatchLeft`); `scenes/tapTarget.ts` (köpeğin dibindeyken çevre dokunuşu yürüyüş), meşgulken ve yönetim
  modunda sessiz ret yerine mesaj.
- **0.13.0–0.13.3 Otopilot (2026-09-22):** `sim/systems/Autopilot.ts` — `Sim.autopilot` açıkken avatar boştayken görev
  tahtasından iş seçer (`PILOT_ID = -1` ile üstlenir; personelle paylaşım), dokun-git ile gider, varınca E; araç işe göre
  seçilir; kiler boşsa yem siparişi; tahta boşken gece uyku, kuluçka, keşfedilmiş yuva/çalı, sevme; histerezisli koşu;
  başarısız hedef 30 sn kara liste; elle girdi ve UI yürüme komutları kapatır; TopBar 🤖, T, Menü → Otopilot, durum satırı
  (`Sim.autopilotText`), kayıt alanı `autopilot`; `tests/unit/autopilot.test.ts` + 3 günlük başsız otopilot koşusu.

## 5. Doğrulama

- **Birim testleri (vitest):** genom → deterministik özellikler; ihtiyaç değişim hızları ve eşikler; ekonomi haftalık hesap;
  denetim çarpanı; eşleşme puanı; A* doğruluğu ve performansı (64×64'te < 2 ms); TaskBoard tek sahiplik; kayıt gidiş-dönüş eşitliği.
- **Headless simülasyon:** Phaser olmadan `Sim` kurulur, bot bakıcı ile 4 hafta (hız 60x) koşturulur; değişmezler:
  NaN yok, para tanımlı, köpekler doğru haftada aşama atlar, hiçbir personel 1 saatten uzun takılı kalmaz, pislik sayısı sınırlı.
- **Tarayıcı:** Vite dev sunucusu uygulama içi tarayıcıda açılır; her kilometre taşında tıklama akışı (bina koy, köpek seç,
  personel al, görevlendir, sahiplendir) ve ekran görüntüleri; konsolda hata sıfır; 60 FPS kontrolü (100 köpek + 10 personel senaryosu).
- **Build:** `npm run build` → `dist/index.html` çift tıkla açılıyor mu, kayıt localStorage'da kalıyor mu.
- **Kod kalitesi:** `tsc --noEmit` temiz, eslint temel kurallar.

## 7. Yol haritası (M11–M14; 2026-09-13 kararı, 2026-09-22 ayrıntılar geri eklendi)

Her paket tek başına oynanabilir sürümler verir; paketler küçük sürümlere (oturum başına bir sürüm) bölünerek yapılır.
Aşağıdaki ayrıntılar M8 döneminde yazılan tasarım notlarından kurtarıldı (o zamanki numaralar M9–M12 idi). Zorluk seviyesi,
iflas/kredi ve bina döndürme M10'da yapıldı.

### M12 İlerleme ve Son Oyun (tamamlandı: 0.14.0–0.14.6)

| Sürüm | Konu |
|---|---|
| 0.14.0 ✅ | Zafer hedefi "Yılın Barınağı": 50 sahiplendirme + itibar 90 → zafer ekranı (bir kez, oyun sürer), ofiste hedef çubukları, başarım |
| 0.14.1 ✅ | Yükseltmeler 1: kuluçka Sv2 (6 yuva, 2 günde çatlar, 2.000 ₺; içerideki yumurtaların kalan süresi 2/3), büyük çanta (6, ofisten 1.500 ₺) |
| 0.14.2 ✅ | Yükseltmeler 2: otomatik yem makinesi (1×1, 2.500 ₺, saatte 8 kare içindeki kapları kilerden doldurur); ofis seviyesi = lisans seviyesi (görsel büyüme, Sv3'te personel sınırı 16) |
| 0.14.3 ✅ | Personel deneyim/seviye (görev başına XP, en çok Sv5, seviyede ana nitelik +1) ve moral (yorgunluk, mola, ödenmemiş maaş, iş yükü; <30 verim ×0,8; 3 gün <10 istifa) |
| 0.14.4 ✅ | Eğitim kursu (800 ₺, 1 gün izin, en az bir seviye) ve gönüllüler (maaşsız, hafta sonu, verim ×0,6, 2 hafta, itibar +1) |
| 0.14.5 ✅ | Finans: 8 haftalık çubuk grafik + nakit tahmini ("x hafta sonra kasa eksiye düşer") |
| 0.14.6 ✅ | 3 kayıt yuvası (ana menüde kartlar; mevcut kayıt yuva 1) + haftalık otomatik kayıt |

### M14 Soy (üreme/kalıtım; kullanıcı istedi; sürüyor: 0.15.x)

| Sürüm | Konu |
|---|---|
| 0.15.0 ✅ | Kalıtım çekirdeği (`inheritGenome`) ve soy bilgisi (yumurta/köpek "Anne × Baba", köken satırı) |
| 0.15.1 ✅ | "Yuva evi": çift seçimi, koşullar (yetişkin, sağlık ≥ 70, karşılıklı dostluk ≥ 60, bekleme), 5 gün, yumurta, 4 hafta bekleme |
| 0.15.2 | Soy ağacı, "İlk soy"/"Efsanevi soy" başarımları, otopilot yuva evi yumurtası |

- `DogGenome.inheritGenome(a, b, rng)`: her alan %50/50 ebeveynden, %10 mutasyon; nadirlik ebeveynlerin en yükseği, %15 bir
  kademe üstü; `secondary` ebeveynin `coat`'undan.
- Yeni bina "Yuva evi" 3×3, 2.500 ₺: iki yetişkin köpek atanır (dostluk ≥ 60, sağlık ≥ 70, ikisi de yaşlı değil) → 5 gün →
  binada yumurta belirir (E ile çantaya, kuluçkaya) → köpek başına 4 hafta bekleme; lisans sınırı sayar.
- Köpek panelinde "Soy ağacı" satırı (anne/baba adı); başarımlar "İlk soy", "Efsanevi soy".

### M11 Yaşayan Dünya
- Sokak köpeği inleri mevsimlik yeniden dolar; terk edilmiş ev POI'si.
- Köy: harita kenarında kasaba — yem toptancısı (ucuz çuval), oyuncak/ilaç dükkânı, pazar günü.
- Görevler: köylülerden istekler ("kayıp köpeğimi bul", "şu renkte yavru") → para/itibar.
- Hızlı seyahat: keşfedilmiş yol tabelaları arası; bisiklet yükseltmesi (koşu ×1,5).
- Taş/odun toplama → inşa indirimi; tam ekran harita (M), tıklanabilir, işaret koyma.
- Dışarıda hava etkisi: fırtınada dayanıklılık düşer, kışın gece görüş daralır.

### M15 İç Mekânlar ve Personel Konforu (M14'ten sonra; 2026-09-23 kullanıcı isteği)

Binalara girilir (ayrı iç oda, kapıdan girince ekran içeri geçer, zaman akar); iç oda küçük ayrı bir `TileWorld`, WorldScene
harita dışına ofsetle çizer. 0.16.0 altyapı + ofise gir/çık; 0.16.1 ofis eşyaları (masa-bilgisayar, lisans panosu, yatak,
kahve makinesi, telefon, kitaplık); 0.16.2 personel tuvalet ihtiyacı + Personel WC; 0.16.3 dinlenme odası içi (satın alınan
kanepe, kahve köşesi, TV; molada personel içeride); 0.16.4 cila (otopilot, dokunma senaryoları). Veteriner, mutfak, kiler,
kuluçka iç mekânları sonra.

### M13 Sahiplendirme Hikâyeleri
- Sahiplenici kimliği: 100+ isim, 6 kişilik tipi, tekrar gelen sahiplenici.
- Sahiplendirme sonrası mektup/fotoğraf (3–7 gün sonra: köpeğin durumu, küçük bağış, itibar).
- "Mezunlar" albümü paneli; sahiplendirme günü etkinliği (300 ₺, o gün 3× sahiplenici); bağış kampanyası (haftada 1).
- İkili (bonded pair) sahiplendirme — M8'deki dostluk puanına dayanır.

## 6. Varsayımlar ve açık noktalar

- Tek oyunculu, çevrimdışı; klavye + fare ve dokunmatik (M9).
- Sayılar (para, hızlar, eşikler) ilk tahmindir; hepsi `balance.ts` içinde ve M6'da simülasyonla ayarlanır.
- Kaybetme durumu: iflas ekranı (M10); zafer ekranı "Yılın Barınağı" (0.14.0, oyun sürer).
- Gerçek ses dosyaları istenirse M6'da `SoundSource` üzerinden dosya yükleme eklenir; lisans uyarıları README'de.
- Git deposu projede başlatılır ve her kilometre taşında commit atılır (uzak depo yok, istenirse GitHub'a bağlanır).
