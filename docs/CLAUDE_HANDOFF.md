# Claude aktarım notları

## 0.10.1 — Kapı geçişleri
- Her NPC/köpek yol adımında kapı açık kontrolü eklendi.
- Kapılar uyku simülasyonunda da güncelleniyor; iflas sonrası uyku döngüsü duruyor.
- Yeni gate-crossing regresyon testleri eklendi. Doğrulama sonuçları son bölümde kaydedilecek.
- Bu dosya ortak proje üzerinden aktarım içindir; Claude servisine doğrudan mesaj gönderilmedi.

## Telefon yönü
- Dikey uyarı boyunca simülasyon durur; yataya dönüş önceki hızı korur.
- Elle duraklatma, açık rapor/menü ve iflas yeniden başlatılmaz.
- orientation.test.ts zamanın gerçekten durduğunu ve hız geri yüklemesini kontrol eder.

## Klavye
- UI keydown/keyup olayları varsayılan tarayıcı davranışı korunarak Phaser pencere dinleyicisinden ayrıldı.
- Odak değişiminde basılı tuşlar ve dokun-git temizleniyor. Oyun tuvaline dokunmak odağı oyuna geri verir.
- keyboard.test.ts olayların engellenmediğini ve dinleyici temizliğini kontrol eder.

## Sürüm
- GAME, package.json ve package-lock.json sürümleri 0.10.1 olarak eşitlendi; kayıt formatı değişmedi.

## Tarayıcı doğrulaması
- Ayarlar kayıt alanına gerçek tuşlarla "pati barinagi" yazıldı; Space korundu, Tab yükleme düğmesine geçti.
- 375×812 dikey görünümde saat durdu; 812×375 yataya dönüşte ilerledi. Elle duraklatma yön dönüşünden sonra korundu.
- UI klavye ayrımı uygulama ömrüne taşındı; sahne kapanınca ana menü metin alanları korunur.

## Son doğrulama — 2026-09-16
- 33 dosyada 206 test geçti; TypeScript noEmit ve git diff --check temiz.
- Üretim derlemesi başarılı: dist/index.html (yaklaşık 1.593 MB).
- Son kodla oyundan ana menüye dönüldü: "pati test" Space ile yazıldı, Tab zorluk seçimine geçti. Tarayıcı hata kaydı boş.
- Kapı için oyuncu, ziyaretçi, personel, serbest/tasmalı köpek, 1×/4×, büyük hareket adımı ve uyku senaryoları sınandı.
- Tuvalet, kredi/iflas ve mevcut uzun simülasyon testleri tam pakette geçti.
- Mobil doğrulama tarayıcıda 375×812 ve 812×375 görünüm boyutlarıyla yapıldı; fiziksel telefon/tablet testi yapılmadı.
- Commitler: ad6efd9 kapılar; 9879a6d yön duraklatma; 731f7fc UI klavye ayrımı. Son takip commitleri git log üzerinden görülebilir.

## 0.11.0 — Telefona kurulum (Claude, 2026-09-16)
- PWA: `public/manifest.webmanifest` (display fullscreen, orientation landscape), kodla üretilen ikonlar
  (`npm run icons` → `public/icons`), `public/sw.js` (önbellek adı kayıt URL'sindeki `?v=GAME.version` ile; sayfa
  için ağ öncelikli, diğer dosyalar önbellek öncelikli), `src/pwa.ts` (yalnız PROD + güvenli bağlamda kayıt; güncelleme
  → toast + Ayarlar "Şimdi yenile"; `beforeinstallprompt` → "Ana ekrana ekle"; `enterFullscreen` yatay kilitle).
- `vite.config.ts` `base: './'`; tek dosya build korunur, `dist/` yanına manifest/ikon/sw kopyalanır.
- Yayın: `.github/workflows/pages.yml` (npm ci → test → build → Pages). Uzak depo yok; push kullanıcıda.
- Doğrulama (uygulama içi tarayıcı, `vite preview` localhost:4173): SW kaydoldu ve etkin (`sw.js?v=…`), önbellek
  `pati-<sürüm>`, manifest `application/manifest+json` 200; **sunucu kapatılıp sayfa yenilenince oyun önbellekten açıldı**;
  konsol temiz; 216 test, tsc temiz. Gerçek telefon/tablet testi yapılmadı (yayından sonra).

## 0.12.0 — Telefon HUD yeniden düzeni (Claude, 2026-09-16)
- Sorun: telefonda alt şerit üç bağımsız mutlak konumlu parçaydı (araç çubuğu 352 px + alt menü 310 px + E/Koş 82 px →
  ≥1026 px gerekiyordu); kutu modeli content-box olduğundan `--nav-h`/`+130px` sabitleri gerçek boyutlardan küçüktü; üst
  şerit grid sütunları içerikten küçülemiyordu; ana menü kaydırmıyordu.
- Çözüm: `.hud-dock` (layout.css) — sol/orta/sağ yuvalar flex; telefonda `ToolPopover` (tek düğme + açılır şerit);
  `useMeasuredBands` (HUD.tsx) `--top-h`/`--dock-h` yazar; box-sizing border-box (ui.css); TopBar telefonda kısa saat,
  ⏸ + döngülü hız, 🛠/🧍 mod; `.tb-left` kaydırılabilir; nav öğeleri `flex: 0 1 46px; min-width: 36px`; ≤719 px'te
  🥣/⭐ gizli; ≤340 px yükseklikte küçük kademe; ana menü ≤500 px yükseklikte iki sütun.
- Doğrulama (uygulama içi tarayıcı, `?touch=1`, getBoundingClientRect çakışma denetimi): 568×320, 812×375, 915×412,
  1024×768 (dokunmatik), 768×1024 (tablet), 1280×720 ve 1920×1080 (masaüstü) — avatar, yönetim + inşa çubuğu + Döndür/İptal,
  köpek paneli, araç şeridi, alt menü listesi, ana menü, Ayarlar: çakışma yok, taşma yok. Alt menü açılır listesi köpek
  panelinin üstüne gelebilir (geçici popover, üstte kalır) — kabul edildi. Gerçek cihaz testi kullanıcıda.

## 0.21.2 — Mezunlar albümü ve tekrar gelen aileler (M13; Claude, 2026-09-23)
- Yeni `src/sim/systems/Stories.ts` (saf): `familyKey(r)` (`family ?? key`), `familyLast(sim, family)`,
  `returningCandidates(sim)` (köylü değil, hiç `returned` yok, son sahiplendirme ≥70 ve en az `returnMinDays` 7 gün önce, en çok
  `returnMaxAdoptions` 3, şu an sırada değil), `pickReturningFamily(sim, adopterId)` (ayrı RNG `hash3(seed, id, 0xfa11)`,
  olasılık 0,12 + aile başına 0,01, tavan 0,3), `albumEntries(sim, filter)` (yeniden eskiye; yıldız `ceil(puan/20)`, sahne,
  köy/tekrar gelen/geri döndü rozetleri, anahtara göre son mektup), `albumStats`.
- `AdoptionRecord.family` (ilk sahiplendirmenin anahtarı; yeni kayıtta `a.family ?? a.id`), `Adopter.family` (kayıtta).
  `spawnAdopter`: köylü değilse `pickReturningFamily`; gelirse ailenin adı, görünümü ve tipi, ücret ×`returnFeeMul` 1,25 (10'a,
  tavanlı), sabır ×`returnPatienceMul` 1,5. `adopt`: eski köpek `familyLast` ile (kayıttan önce), puan ≥50'de itibar +`returnRep`,
  mesaja "🔁 yeni, eski ile tanışacak". Ana RNG sırası değişmez (testte).
- Arayüz: yeni `AlbumPanel.tsx` (panel 'album'; `.album-grid` kartları, küçük polaroid), `MailPanel`'deki fotoğraf `ScenePhoto`
  olarak ortaklaştı (`small`: albüm; görünümsüz eski kayıtta 🐾). Giriş: ☰ Menü → Mezunlar, bilgisayar "📖 Mezunlar", masadaki
  "Son sahiplendirme" satırı, Posta'da "📖 Albümde gör". Masa kartında "🔁 Yine geldi · önceki köpeği X"; geliş bildirimi "🔁 X yine
  geldi: Y çok mutluymuş…". `WorldScene.adopterDogSprites`: tekrar gelen ailenin yanında eski köpeği (köy köpeği gibi; yürürken
  bir adım geride, beklerken yanında oturur; SHUTDOWN'da temizlenir).
- Başarımlar "Sadık aile" (bir aile ikinci kez), "Mezunlar" (25 sahiplendirme); toplam 32.
- Testler `tests/unit/album.test.ts` (4): albüm sırası/yıldız/sahne/rozet/mektup, süzgeçler, başlık; aday kuralları ve
  deterministik seçim; tekrar gelen sahipleniciyle sahiplendirme (ad, görünüm, tip, sabır, ek itibar, aile bağı, başarım); kayıt
  turu ve ana RNG. 402 test. Tarayıcı 812×375: albüm "3 mezun · %33 mutlu · 1 geri döndü" (sahil, köy, atölye fotoğrafları), geri
  gelen Melis Ünal'ın yanında Kömür, masada "🔁 Yine geldi · önceki köpeği Kömür" (sabır 157 dk); dokunma senaryoları 15/15.
- Sıradaki: 0.21.3 sahiplendirme günü + bağış kampanyası.

## 0.21.1 — Mektup ve fotoğraf (M13; Claude, 2026-09-23)
- Yeni `src/sim/systems/MailSystem.ts` (`sim.mail`, kayıtta `mail: { next, list }`): `schedule(record)` geri gelmeyecek her
  sahiplendirmede (`AdoptionSystem.adopt`'un else dalı, köpek isteği görevi) kayda `letterDay = gün + 3…7` yazar (ayrı RNG
  `hash3(seed, key, 0x1e77)`; anahtarsız eski kayıtta yok). `onHour` saat `BALANCE.stories.letterHour` (11) `deliverDue`:
  vakti gelen (`letterDay ≤ bugün`, `lettered` değil, `returned` değil) kayıt için bir kez `Letter { id, day, key, dogName,
  from, type, line, scene, genome, stage, donation, rep, read }`; satır Türkçe anahtar olarak saklanır, gösterirken `t()`.
- Satırlar: `GREAT_LETTERS` (tip başına 3, puan ≥70), `OK_LETTERS` (50–69), `HARD_LETTERS` (<50 ama dönmedi),
  `VILLAGE_LETTERS` (köylü, ≥50); sahne `TYPE_SCENE` (Aile bahçe, Emekli park, Sporcu sahil, Öğrenci kanepe, Çiftçi çiftlik,
  Sanatçı atölye), köylüde `village`. ≥70'te bağış (60 + 0…80) × `generosity`, 10'a yuvarlı, 40–200 (defter 'donation',
  "Mektupla bağış: aile") ve itibar +1, günde en çok 2 (`repPerDay`). Olay `letter` (ses: bağışlıysa coin) + bildirim.
  Posta en çok 40 (önce okunmuş eski düşer). Komut `readMail { id? }` (id yoksa hepsi).
- Arayüz: yeni `MailPanel.tsx` (panel 'mail'; sahiplendirme masasının `.adopt-layout`/`.adopter-card` yerleşimi, telefonda kartlar
  yatay kayar), `LetterPhoto` polaroid (sahne degradesi CSS'te `.photo.scene-*`, süs emojisi, `DogPortrait` saydam arka planla);
  açılan mektup okundu sayılır (kendiliğinden seçilen mektup sabitlenir: yoksa okundukça sıradakine atlayıp hepsini okurdu).
  Giriş: ☰ Menü → Posta, ofis bilgisayarı "📬 Posta (n yeni)"; sabah raporu "📬 n okunmamış mektup".
- Testler `tests/unit/mail.test.ts` (4): mektup günü aralığı ve 11:00 teslimi, tipe göre satır/sahne/bağış/itibar/defter;
  geri gelecek köpeğe yok, idare eden/zayıf/köylü satırları; günlük itibar tavanı ve 40 sınırı; kayıt turu, eski kayıt, ana RNG
  değişmez. 398 test. Tarayıcı 812×375: köylü mektubu köy meydanı fotoğrafıyla, Sanatçı mektubu atölye fotoğrafıyla, "📬 Posta
  (1 yeni)", bilgisayarda Posta düğmesi; dokunma senaryoları 15/15.
- Sıradaki: 0.21.2 mezunlar albümü + tekrar gelen aileler.

## 0.21.0 — Sahiplenici kimliği (M13 ilk dilimi; Claude, 2026-09-23)
- M13 dilimlendi (0.21.0–0.21.5, `docs/PLAN.md` §7): kimlik → mektup ve fotoğraf → mezunlar albümü + tekrar gelen aileler →
  sahiplendirme günü + bağış kampanyası → can dostları → cila.
- Yeni `src/sim/entities/AdopterType.ts`: `AdopterType` (family, retiree, athlete, student, farmer, artist), `ADOPTER_TYPES`
  (simge, ad, kısa huy, `likes`, `seniorOk`, `feeMul`, `patienceMul`, `generosity` 0.21.1 için, `pairs` 0.21.4 için),
  `VILLAGER_ADOPTER_TYPE` (rol → tip), `adopterIdentity(seed, id)` (ayrı RNG `hash3(seed, id, 0xad0b)`: tip ve ad soyad,
  `FIRST_NAMES` 60 × `SURNAMES` 40, `src/content/names.ts`), `withTypeLikes`, `typedFee`.
- Plandan sapma: tip "yumuşak tercih" olarak eklenmedi. `AdoptionRequest.likes` yalnız **artı** verir (`likeHits` ×
  `BALANCE.adoption.likeBonus` 6, `matchScore`'un iki dalında, tavan 100), eksikliği puan düşürmez. Neden: yumuşak tercih
  tercihsiz isteklerin 85+ puanını 40'a indirip sahiplendirmeyi ve itibarı düşürürdü. Boy/yaş sert şartları aynı; `seniorOk`
  (emekli) yaşlı köpek cezasını kaldırır. İstek metninde "Sever: …", masada uyan köpekte "💛 sevdiği gibi".
- `spawnAdopter`: ana RNG çekilişleri aynı (istek, `PERSON_NAMES` adı yalnız sıra için, ücret, görünüm; testte denetlenir),
  sonra kimlik ayrı RNG'den, köylüde tip rolden; ücret ×`feeMul` (10'a yuvarlı, tavanlı), sabır = 150 × `patienceMul` + dekor.
- `AdoptionRecord` yeni alanlar: `key` (sahiplenici kimliği; köpek isteği görevinde `-görev kimliği`), `type`, `look`,
  `returned`; `genome`/`stage` artık her sahiplendirmede (köyde çizim yine `villager` koşuluyla). `PendingReturn.key`: köpek
  geri gelince kayıt `returned`. `Adopter.type` kayıtta; eski kayıtta kimlikten (köylüde rolden) türetilir; `likes` yüklemede
  süzülür.
- Masa kartı: tip simgesi + ad soyad, "Tip · huy" satırı (huy kısa; sevdikleri "Sever:" satırında). Testler
  `tests/unit/adopters.test.ts` (4): kimlik ve ana RNG sırası, artı/ceza yok/emekli, ücret-sabır-köylü tipi, kayıt ve geri
  getirme; `decor.test.ts` ve `economy.test.ts` sabır beklentisi tipe göre güncellendi. 394 test. Tarayıcı 812×375: masada
  "👵 Hakan Akın · Emekli · sabırlı, yaşlı köpeğe de kucak açar · Sever: sakin, sakin tempolu · Sabrı: 225 dk", eşleşmede
  "💛 sevdiği gibi"; dokunma senaryoları 15/15.
- Sıradaki: 0.21.1 mektup ve fotoğraf.

## 0.20.5 — Cila: otopilot köy işlerine dokunmaz, dokunma senaryoları 14–15 (M11 son dilimi; Claude, 2026-09-23)
- `Interaction.MANUAL_ACTIONS` (köy binasına girme, toptancı, dükkân, pazar, köylüyle konuşma, postane, tabela, görev panosu,
  kayıp köpek): `PlayerNav.arrive` otopilot açıkken bu eylemleri yapmaz (`goal.kind === 'village'` dahil); `interacted`
  `{ ok: false }` yayar, otopilot işi başarısız sayıp kara listeye alır, panel açılmaz. `resolveAction` artık köy dalından
  önce hesaplanıyor (yan etkisiz).
- `Autopilot.nearHome`: yuva ve çalı işleri yalnız arsaya en çok `BALANCE.autopilot.homeRange` (40) kare ve köyün
  `villageMargin` (6) karelik çevresinin dışında; oyuncu köydeyken otopilot oralarda iş aramaz, barınak işine (eve) yürür.
  `travel` komutu otopilotu kapatır (varınca eve yürümesin).
- Dokunuş cilası (`WorldScene.touchTap`): kayıp köpek dokunulan noktaya sokak ya da barınak köpeğinden yakınsa köpek seçimi ona
  bırakılır (in yanındaki sokak köpekleri dokunuşu kapmasın); panonun önünden geçen köylü dokunuşu kapmaz (pano daha yakınsa
  pano).
- Dokunma senaryoları (`src/debug/touchDebug.ts`) 14–15 taze hazır oyunda (tohum 1942): 14 barınak tabelasına dokun → yürür
  → hızlı seyahat paneli → köye git (26 dk); 15 panoya dokun → panel → kabul → kayıp köpeğin yanına geç, ona dokun → bulunur →
  panoya dön (köpek yanına gelir) → teslim; otopilot açıkken panoya varınca panel açılmaz, sonra eve doğru yürür. 15/15.
- Kontroller: yeni "Köy ve dünya" bölümü (köy, köylüler, tabelalar, görev panosu, otopilot), 🤖 satırına "köy işlerine
  gitmez". README otopilot bölümü, dokunma testleri paragrafı ve durum listesi (M11 tamam), PLAN M11 tablosu.
- Testler `tests/unit/autopilot.test.ts` "Otopilot 4" (2): varışta pano/tabela/kayıp köpek eylemi yapılmaz, elle dokununca
  yapılır ve otopilot kapanır, hızlı seyahat otopilotu kapatır; köyün yakınındaki yuva ve çalıya gitmez. 390 test.
- M11 Yaşayan Dünya tamam (0.18.0–0.18.2, 0.20.0–0.20.5). Sıradaki: kullanıcı seçer (M13 Sahiplendirme Hikâyeleri, isteğe
  bağlı terk edilmiş ev + taş/odun, yuva evi içi, kuzey/batı arsa genişletme, açık küçük işler).

## 0.20.4 — Köylü görevleri (M11; Claude, 2026-09-23)
- Yeni `src/sim/systems/QuestSystem.ts` (`sim.quests`, kayıtta `quests: { v, week, next, list }`): köy bulununca
  `clock.week` değişince pano yenilenir (`roll`, ayrı RNG `hash3(seed, week, 0x9e57)`; ana `sim.rng` sırası değişmez, testte
  denetlenir): kabul edilmemiş ilanlar iner, boşluklar her türden en çok bir ilanla dolar (`BALANCE.quests.maxBoard` 3).
  Türler: `lost` (kayıp köpek; barınaktan köpek sahiplenmiş köylü varsa onun köpeği, `own`: kayıpken köyde sahibinin yanında
  çizilmez), `pup` (köpeği olmayan köylü belli renk `coat` ya da huy `temperament` ister; %60 barınaktaki bir köpekten
  alınır), `treats` (3–6 ödül maması). Kabul panoda (`nearBoard`, 2,5 kare); süre `BALANCE.quests.days` (3/6/4 gün), dolunca
  cezasız düşer. Teslim panoda (`questDeliver`) ya da ilanı asan köylüyle konuşunca (`quests.talk`, köylü sisteminden önce):
  ödül para (kayıp/ödül maması `quest` defter türü, köpek isteği `adoption`) ve itibar; `stats.quests`.
- Kayıp köpeğin yeri: köyden 20–70 kare uzakta, arsanın en büyük hâlinin dışında bir in ya da yuva yanı, köyün yol bandından
  `findPath` ile varılabilir. Kabul edilince dünyada oturur (`WorldScene.syncQuests`, köylü köpeği dokusu), üstünde pati
  balonu; E (`lostDog` eylemi) ile bulunur, sonra gerçek zamanlı `follow(dtSec)` ile oyuncunun izinden gelir (iz, oyuncunun
  yürüdüğü noktalar; duvara girmez), 10 kareden uzağa atlarsa (seyahat, bayılma) yanına ışınlanır, içerideyken bekler.
  Harita: mini haritada ve harita panelinde turuncu arama çerçevesi (gerçek yerden ±3 kayık), panelde "🐾 ad: n kare · Git".
- Köpek isteği teslimi: tasmadaki (`walking`) uygun köpek `adoptable(dog, true)` (yeni parametre: gezinti engel değil) →
  köpek kaldırılır, köylülü `AdoptionRecord` (0.20.2 görünümüyle) → köpek köyde sahibinin yanında; `stats.adopted` artar.
  `VillagerSystem.adopterFor` panoda köpek isteği olan köylüyü sahiplenici seçmez.
- Pano: `questBoardTile`/`questBoardAt` (`Village.ts`, köy +10,4; tabelalar gibi katı değil, `drawQuestBoard`); eylem
  `quests` → yeni `QuestPanel` (panel 'quests'; kabul, teslim, vazgeç, kalan süre, engel satırı). Dokunuş: `questTapTile`.
  Görevi olan köylünün üstünde soru balonu (`OverlayScene`), teslime hazırsa ipucu "E: ad · görevi teslim et". Sabah raporu:
  kabul edilen görevler ve kalan süre, Pazartesi yeni ilan satırı. Başarım "Köyün dostu" (3 görev; toplam 30). Kontroller'de
  "Panoya dokun". `VillagerSystem.facingFor` dışa açıldı.
- Testler `tests/unit/quests.test.ts` (6): pano (köy bulunmadan yok, üç tür, farklı köylüler, tohumla aynı, kayıp köpek yeri,
  ana RNG); kabul/süre/Pazartesi yenilemesi/vazgeçme; kayıp köpek (köylünün köpeği, bul, izle, ışınlan, panoda teslim, defter);
  köpek isteği (uymayan köpek, tasmadaki uygun köpek, köylü sahiplenir); ödül maması (konuşarak teslim, hatırlatma, ipucu);
  kayıt turu ve eski kayıt. 388 test. Tarayıcı 812×375: panoda E düğmesiyle panel, kayıp köpeği kabul et → yerinde pati
  balonu → E ile bul → izliyor (1,2 kare) → panoda teslim (+400 ₺, itibar +3); köpek isteği teslimi; harita çerçevesi ve
  "Git" satırı; `runTouchScenarios` 13/13.
- Sıradaki: 0.20.5 cila (otopilot köy/tabela/görev işlerine gitmez, dokunma senaryoları 14–15, yardım/belgeler).

## 0.20.3 — Yol tabelaları ve hızlı seyahat (M11; Claude, 2026-09-23)
- Yeni `src/sim/world/Signposts.ts` (RNG yok, kaydedilmez): `signposts(world)` üç tabela hesaplar: `shelter` güney çitindeki
  kapının hemen dışında (kapı yoksa ortada; arsa büyüyünce taşınır), `east` doğu yolunda arsanın en büyük hâlinin hemen
  doğusundaki ilk boş kare (yol dağ arasından geçiyorsa yolun üst şeridi; tanı: tohum 2301'de doğu ucu dağ), `village` köy
  girişi (köy +13,0). `signKnown` (keşif haritası), `signAt`, `landingTile`, `travelMinutes` (kuş uçuşu × `BALANCE.travel`
  0,4 dk/kare, bisiklet ×0,67, en az 5). Tabelalar katı değildir.
- `Sim.travel(to)` (komut `travel`): bilinen bir tabelanın `travel.reach` 1,6 karesindeyken bilinen başka tabelaya; zaman
  uyku gibi 5 dakikalık adımlarla geçer (saat 2'de dışarıdaysa bayılır ve varış olmaz), oyuncu varış karesine, gezdirilen ve
  peşindeki köpekler yanına; olay `traveled` (kamera ortalar, kısa flaş). `signHere()`; `checkSigns()` `revealPlayer`'da yeni
  keşfedilen tabelayı bir kez duyurur (barınak hariç; duyurulanlar bellekte, yüklemede sessizce dolar).
- Etkileşim `travel` (tabelaya bakınca "E: tabela (ad) · hızlı seyahat") → yeni `TravelPanel` (panel 'travel'): keşfedilmiş
  tabelalar ve süre, keşfedilmemişler kapalı. Dokunuş: `WorldScene.touchTap` bilinen tabelaya `NavGoal object`.
- Çizim: `drawSignpost()` (BuildingArt), `WorldScene.syncSigns` 30 karede bir konum yeniler; mini haritada keşfedilmiş tabela
  sarı nokta. Kontroller'de "Tabelaya dokun". Ayrıca `Sim`'de 0.19.2'den beri yanlış yerde duran "Sabah 06:00'ya kadar…"
  yorumu `sleepUntilMorning`'in üstüne taşındı.
- Testler `tests/unit/travel.test.ts` (4): üç tohum × iki başlangıçta tabelalar (sıra, yürünebilirlik, arsa dışı, doğu
  tabelası arsa sınırının ötesinde), güneye genişleyince barınak tabelası taşınır; keşif ve tek duyuru; seyahat (tabela şartı,
  keşif şartı, süre, varış, gezdirilen köpek, bisiklet, dönüş); gece 2'de bayılma. 382 test. Tarayıcı 812×375: barınak
  tabelası kapının dışında, panel, "Köy · 26 dakika" ile köye ışınlanma (06:04 → 06:31), dokunarak tabelaya gidip paneli açma;
  `runTouchScenarios` 13/13.
- Sıradaki: 0.20.4 köylü görevleri.

## 0.20.2 — Köy kademesi ve köylü sahipleniciler (M11; Claude, 2026-09-23)
- `Sim.villageStage` 1–3 (kayıtta, düşmez). `Sim.updateVillageStage()` sim dakikasında (hedeflerden sonra): köy bulunduysa
  `BALANCE.village.stageReputation` [0, 40, 70] eşiklerine göre kademe; atlayınca `stampVillageStage(world, kademe)`, olay
  `villageGrew` (sahne yeni yapıların görselini ekler), mesaj "🏘️ Köy büyüyor: … açıldı", yapı oyuncunun üstüne çıktıysa
  oyuncu kapısına çekilir. Başarım `village-grow` "Köy büyüyor" (toplam 29).
- `Village.ts`: `STAGE_LAYOUT` LAYOUT'tan SONRA eklenir (eski indeksler aynı): 2. kademe `postOffice` 4×3 @19,11; 3. kademe
  `bench` 2×1 @15,13 (adı "Köy parkı") ve `PARK` 6×4 @13,12 çiçekli zemin (doğrudan dizi yazımı + `recomputeSolid` + `dirty`;
  nesne değişikliği kaydına girmez). `fromJSON` `restampVillage`'dan sonra kayıttaki kademeyi yeniden damgalar. `parkSpot(i)`.
  Çizimler `drawVillageBuilding('postOffice' | 'bench')`.
- Köylü sahiplenici: `AdoptionSystem.spawnAdopter` sonunda `sim.villagers.adopterFor(a.id)` (karar sahiplenici kimliğinden
  türeyen ayrı RNG ile, ana sıra değişmez; olasılık `villagerAdopterChance` 0,4; köpeği olmayan ve sırada olmayan köylü):
  `a.villager`, ad ve görünüm köylününki olur (kayıtta). `adopt`: iade olmayacaksa kayda `villager`, `genome`, `stage` yazılır;
  mesaj "· onu köyde görebilirsin". Sahiplendirme panelinde "(köyden)".
- `VillagerSystem`: `dogOf(v)` (en son köylü kaydı), `ensure()` artık açık, çizelgede köpeği olan köylü 3. kademede işte
  değilken 16–19 `park` yerinde; konuşmanın yarısı köpeği üstüne (`DOG_TALK_LINES`); `postNews()` postanede günün mektubu
  (`LETTERS`). Etkileşim `post` (postanede E, dokunuşla da).
- Çizim: `WorldScene.syncVillagers` köylünün köpeğini de çizer (`ensureDogTexture`; yürürken bir adım gerisinde, dururken
  yanında oturur); `villageDogSprites` sahne kapanışında temizlenir.
- Testler `tests/unit/village-stage.test.ts` (3): eşikler, yapı sırası ve katılık, park zemini, kademe düşmez, başarım,
  çizimler; kayıt ve eski kayıt, oyuncunun kapıya çekilmesi; köylü sahiplenici (kimlik seçimi, kayıt turu), sahiplendirme
  kaydı, `dogOf`, köpekli köylü bir daha seçilmez, konuşma, postane mektubu, park saati. 378 test. Tarayıcı 812×375: itibar
  95 ile postane, park ve bank; köylü sahiplenici "Ayşe Teyze" Nohut'u sahiplendi, 16:30'da parka yürüdü, köpek yanında
  oturuyor; postane mektubu ve köpekli konuşma; `runTouchScenarios` 13/13.
- Sıradaki: 0.20.3 yol tabelaları ve hızlı seyahat.

## 0.20.1 — Köylüler (M11; Claude, 2026-09-23)
- Yeni `src/sim/entities/Villager.ts` (`VillagerRole`, `VillagerPlace` = home/work/spot/spot2/plaza, `VILLAGER_ROLE_NAMES_TR`)
  ve `src/sim/systems/VillagerSystem.ts` (`Sim.villagers`, `stepSim` içinde `update(dtMin)`). Köy bulununca (`villageFound`)
  tohumdan altı köylü kurulur: toptancı çırağı (iş: toptancı), dükkâncı (iş: oyuncak dükkânı), yaşlı, çocuk, bahçıvan, gezgin;
  üç eve ikişer. Adlar `hash3(seed, …)` ayrı RNG'sinden, görünüm tohumu `hash3`; ana RNG'ye dokunmaz, KAYDEDİLMEZ (yeri
  saatten çıkar).
- Çizelge `ROLES`: hafta içi dilimler (ör. çırak 7 iş, 17 çeşme yanı, 19 ev), Pazar (`BALANCE.shop.marketWeekday`) herkes
  meydanda; ilk dilimden önce evde. Ev ve iş yerinde kapı önüne gidip "içeride" (gizli) olur; noktalar köy dikdörtgenine göre
  (çeşme çevresi, meydan, bahçe, yol başı; testte hepsi yürünebilir ve evden yol var).
- Oyuncu köyün `BALANCE.villagers.nearTiles` 40 karesindeyse (içeride değil) köylü `findPath` (köy bölgesi, 4.000 düğüm) ile
  `speed` 1,4 kare/oyun dakikası yürür; uzaktayken yerine anında yerleşir.
- Konuşma: `resolveAction` baktığın noktada görünen köylü (`villagers.at`, erim 0,8) → `talk` "E: {ad} ile konuş (rol)";
  `villagers.talk` köylüyü oyuncuya döndürür, `TALK_LINES` (10 ipucu/dedikodu) günün tohumuyla başlayıp sırayla söyler. Dokunuş:
  `WorldScene.touchTap` köylüye dokununca `NavGoal { kind: 'villager' }` (yanına git, dön, konuş).
- Çizim: `WorldScene.syncVillagers` (sahiplenici gibi insan dokusu, yürüme animasyonu, içerideyken gizli). Sahne kapanırken
  `villagerSprites` temizlenir (yoksa yeni oyunda silinmiş görseller kalıyordu; tarayıcıda yakalandı).
- Kontroller'de dokunma satırı "Köylüye dokun". i18n testine rol adları ve konuşma satırları eklendi.
- Testler `tests/unit/villagers.test.ts` (5): köy bulunmadan yok, tohumdan aynı altı köylü, ana RNG sırası; çizelge (hafta içi,
  gece, Pazar); yakındayken adım adım yürüyüş (evden çıkış, iş yerine giriş, adım ≤ hız × süre); E ile konuşma; yerlerin
  yürünebilirliği ve yollar (üç tohum). 375 test. Tarayıcı 812×375: Pazartesi 10:00 köyde yaşlı, çocuk, bahçıvan dışarıda,
  çalışanlar içeride; E ile ve dokunarak konuşma; 11:00'da çocuk ikinci noktasına yürüdü; `runTouchScenarios` 13/13.
- Sıradaki: 0.20.2 köy kademesi ve sahiplenilen köpekler köyde.

## 0.20.0 — Oyuncak ve ilaç dükkânı, Pazar tezgâhı (M11; Claude, 2026-09-23)
- Yeni `src/sim/systems/ShopSystem.ts`: `Supplies { toy, vitamin }`, `shopPrice(item, market)`, `buyShop` (yalnız `toyShop`
  iç mekânında; her türden en çok `BALANCE.shop.maxSupply` 20; bisiklet bir kez), `buyMarket` (yalnız Pazar = `clock.weekday`
  6 ve tezgâhın önünde `marketReach` 3 kare; ×0,75; haftanın yumurtası `marketEggOffer`: nadirlik ve yumurta
  `hash3(seed, hafta, …)` ayrı RNG'lerinden, haftada bir, `Sim.marketEggWeek`), `giveSupply` (oyuncak: `needs.play` 100 +
  sadakat 5; vitamin: sağlık +20 ve `Dog.vitaminUntil` bir gün), `bicycleExertion`. Defterde yeni kategori `shop` "Dükkân".
- Köy: `VillageKind` += `market` (LAYOUT'un SONUNA 3×2 @6,7, eski indeksler aynı), `villageInteriorKind('toyShop')` =
  `toyShop`, yeni `villageInteractive` (girilebilen ya da tezgâh). `PlayerNav` köy hedefinde girilemeyen yapının önünde E işi
  yapar; `WorldScene.touchTap` `villageInteractive` kullanır.
- İç mekân `toyShop` (10×7): iki `toyShelf` (yeni çizim), `vitaminShelf` (ilaç dolabı çizimi), `shopCounter` (bu odada
  `toyShop` eylemi → yeni `ToyShopPanel`), saksı; tezgâh arkasında satıcı (`interiorExtras`).
- Pazar tezgâhı dış çizimi `drawVillageBuilding('market')` (çizgili tente, tezgâh, mallar yanlarda); `WorldScene.marketVendor`
  tezgâhın arkasında, yalnız Pazar görünür. Tezgâhta E (Pazar) → yeni `MarketPanel`; başka gün ipucu "Pazar günleri kurulur".
  Mini haritada tezgâh pembe.
- Plandan sapma: bisikletin etkisi 0.20.3 yerine burada (etkisiz eşya satılmasın): `PlayerExertion.runSpeedMul`, bisikletle
  koşu ×1,5 ve koşu yorgunluğu ×0,8 (`BALANCE.shop.bicycleRunMul/DrainMul`), otopilotun koşusunda da geçerli.
- Arayüz: köpek panelinde "🧸 Oyuncak ver (n)" / "💊 Vitamin ver (n)", çantada 🧸/💊 sayaçları. Kayıt: `supplies`,
  `bicycle`, `marketEggWeek`, köpekte `vitaminUntil` (hepsi varsayılanlı).
- Testler: yeni `tests/unit/shop.test.ts` (4: dükkâna giriş, tezgâh, alım, sınır, bisiklet; oyuncak ve vitamin etkisi,
  hastalık çarpanı, kayıt; Pazar tezgâhı gün ve yakınlık kuralı, indirim, haftalık yumurta, ana RNG sırası; bisiklet hız ve
  yorgunluk oranı); `village.test.ts` 7 yapıya ve açılan dükkâna uyarlandı. 370 test. Tarayıcı 812×375: dükkân içi, panelden
  alım (5 oyuncak, vitamin, bisiklet), Pazar tezgâhı ve satıcı, indirimli fiyatlar, nadir yumurta 300 ₺ çantaya, köpek
  panelinden oyuncak (oyun keyfi 20 → 100); `runTouchScenarios` 13/13.
- Sıradaki: 0.20.1 köylü rutini.

## 0.19.3 — Cila, M17 tamam (Claude, 2026-09-23)
- `runTouchScenarios` artık açık oyunu kullanmaz: `app.startDebugGame(seed, starter)` ile kayda dokunmayan test oyunu kurar
  (`App.debugGame` bayrağı: `save()` yazmaz; `newGame` ve `continueGame` bayrağı sıfırlar). 1–12 sabit tohumlu hazır
  barınakta (1942), 13 kuruluşta (1913): sıradaki hedef → `goalShowTool` → `app.showBuild` (yönetim modu, inşa çubuğu, araç
  seçili) → `tapTile` ile kulübe (90,92), kap (93,92), yalak (94,92), kuluçka (104,92) → üç belediye hedefi. `DebugApp`
  arayüzüne `startDebugGame`, `showBuild` ve `game.step` eklendi; sahne yeni sim'le kurulmazsa `game.step` ile ilerletilir.
  Tarayıcıda 13/13; senaryolardan sonra `save(true)` çağrılsa da yuva 0 değişmedi. Senaryolardan sonra test oyunu açık kalır.
- Kontroller sayfasının başında "İlk adımlar" (Kuruluş, 🎯 Hedefler, Sabah raporu). Telefonda yardım tabloları dikey flex
  içinde küçülüp kendi içinde kayıyordu, üçüncü tablo tek satır bile göstermiyordu: `.help .table-scroll { flex: none }`,
  sayfa bütün olarak kayar.
- 0.19.2'de denenmemiş kalan Pazartesi durumu tarayıcıda doğrulandı: yedinci uykuda haftalık rapor ve Günaydın birlikte
  açılır; haftalık rapor üstte durur ve oyunu duraklatır; kapatınca Günaydın kalır ve oyun sürer.
- README "İlk 10 dakika" başlığı altında kuruluş, belediye hedefleri ve sabah raporu; geliştirici notu 13 senaryo. 366 test.
- M17 tamam. Sıradaki (plan dosyası): M11 kalanı, 0.20.0 oyuncak/ilaç dükkânı ve pazar günü.

## 0.19.2 — Sabah raporu ve dönüş kartı (M17; Claude, 2026-09-23)
- Yeni `src/sim/systems/DayReport.ts`: `DaySnapshot` (day, money, adopted, hatched, strays, cured, fed, eggsFound),
  `takeDaySnapshot`, `diffDay`, `daySnapshotFrom` (kayıt doğrulaması), `MorningReport` ve `buildMorningReport(sim, kind,
  passedOut)`. Rapor: dün = biten takvim gününün farkı; bugün = gün, hafta içi gün, mevsim, hava, 24 saat içinde çatlayacak
  kuluçka yumurtası (kalan oyun süresi `hatchLeft × incubatorTimeMul`), yuva evinde bekleyen yumurta, hasta köpek, yem günü
  = (kiler + kaplar) / (Σ porsiyon × `mealHours` sayısı), bugün vardiyası olan personel (kurstaki ve hafta içi gönüllü hariç),
  sahiplendirme açık mı ve `adoptable` köpek sayısı, sıradaki hedef.
- `Sim.dayStart` (kurucuda alınır) ve `Sim.lastDay`, ikisi de kayıtta. Eski kayıtta `dayStart` yüklemedeki değerlerle başlar,
  `lastDay` null. `day` olayında `rollDay` (öbür gün dinleyicilerinden sonra): biten günün özeti `lastDay` olur, yeni
  `dayStart` alınır. `sleepUntilMorning` `slept`'ten sonra iflas yoksa `morning` olayını yayar (uyku ve bayılma; yeni oyunda yok).
- Arayüz: yeni `src/ui/MorningPanel.tsx` (`store.panel 'morning'`, `store.morningReport`). Başlık "☀️ Günaydın!", bayılmada
  "😵 Dışarıda bayıldın, ofiste uyandın", dönüşte "👋 Hoş geldin!"; Dün (kasa ±, olaylar ya da "Sakin bir gündü.") ve Bugün
  satırları (uyarılar kırmızı); "Güne başla" / "Devam et". `app.showMorning(report)` Ayarlar'da kapalıysa açmaz;
  `app.continueGame` sonunda hoş geldin kartı; `app.setMorningHidden` + localStorage `…morningHidden`; Ayarlar → Rehber →
  "Sabah raporunu göster". Pazartesi haftalık rapor da açılırsa DOM sırası gereği üstte o durur (tarayıcıda denenmedi).
- Testler `tests/unit/morning.test.ts` (3): gün dönümü özeti (aynı andaki sayaçlarla karşılaştırma), uyku ve bayılmada rapor;
  bugün satırları (yumurta, hasta, yem günü, personel, sahiplendirme kapalı, hedef, köpeksiz yem null); kayıt turu, eski ve
  bozuk kayıt. 366 test. Tarayıcı 812×375: uyku → Günaydın (Dün +350 ₺, 1 sahiplendirme, 2 yavru; Bugün yem 10 gün, hedef);
  kayıttan devam → Hoş geldin aynı özetle; ayar kapalıyken rapor açılmıyor; `runTouchScenarios` 12/12.
- Sıradaki: 0.19.3 cila (dokunma senaryosu 13 "kuruluş", yardım satırları, README ve PLAN).

## 0.19.1 — Belediye hedef zinciri (M17; Claude, 2026-09-23)
- `src/sim/systems/Goals.ts` yeniden yazıldı: `GOALS` 22 halka (kennel, bowlTrough, incubator, eggFound, eggPlaced, fillBowl,
  petClean, shed, sleep, stray, hire, hatch, adopt1, expand, kitchen, village, dogs5, vet, adopt10, license2, nurseryPup,
  victory; ödül toplamı 6.950 ₺, zafer ödülsüz). "Göster" alanları: `tools` (kurulmamış ilk bina, `goalShowTool`), `plot`
  (Arsa sekmesi), `panel` (`GoalPanel` = map/staff/adoption/office). Kimlikler kayda yazılır, değiştirilmemeli.
- `GoalSystem` artık `done: Set<string>` tutar: `current` ilk tamamlanmamış hedef, `upcoming(n)`. `check()` yalnız sıradaki
  hedefi ödüllendirir (dakikada en çok bir; önceden yapılmış hedef sırası gelince hemen tamamlanır). `catchUp()` sağlanan bütün
  hedefleri ödülsüz ve sessiz tamam sayar: hazır başlangıçta `Sim.create` içinde (kulübe, kap/yalak, kuluçka, kiler), eski
  kayıtta `Sim.fromJSON` sonunda. Kayıt `goals: { v: 2, done: [...] }`; `load()` 0.19.0 biçimini (`{ index }` → ilk en çok 3
  hedef) okur, `v` güncel değilse `false` döner. Güncel kayıtta yetişme yapılmaz, böylece sırası gelmemiş ödül kaybolmaz.
  `FOUNDING_GOALS` kalktı.
- Arayüz: `Guide.tsx` tümden zincire döndü (eski 9 rehber adımı kalktı): masaüstünde sıradaki hedef + "Sonra: …" + "Tüm
  hedefler"; telefonda pil. İkisi de yeni `GoalsPanel.tsx`'i açar (`store.panel 'goals'`): sıradaki (açıklama, ödül, Göster),
  sonraki 2, tamamlananlar (yeniden eskiye). Göster → `app.showBuild(type | 'plot')`: yönetim modu, inşa çubuğu binanın
  sekmesinde (`BUILDING_DEFS[type].category`) ve araç seçili; BuildBar sekmesi artık `store.buildTab` sinyali (yerel
  `useState` kalktı). Ofis bilgisayarında "🎯 Hedefler", ☰ Menü'de "Hedefler"; Ayarlar etiketi "Hedef kartını göster".
- Testler: yeni `tests/unit/goals.test.ts` (5: zincir bütünlüğü ve çeviriler; yalnız sıradaki ödül ve önceden yapılanın sırası
  gelince tamamlanması; Göster verisi ve arsa hedefi; zafer ödülsüz; kayıt güncel/eski/0.19.0/bozuk kimlik). `founding.test.ts`
  `done` kümesine uyarlandı, `i18n.test.ts` hedef metinlerini de denetler. `autopilot.test.ts` yardımcısı zinciri tamam sayar:
  hedef ödülleri para ölçen iki testi bozuyordu (otopilot yuvadan yumurta alınca +100 ₺). 363 test. Tarayıcı 812×375: pil →
  panel → Göster → yönetim modu, Barınma sekmesi, küçük kulübe seçili; kulübe → "+200 ₺ · Sıradaki" ve pil ilerler; hazır
  barınak `eggFound`'dan başlar; `runTouchScenarios` 12/12.
- Sıradaki: 0.19.2 sabah raporu + dönüş kancası.

## 0.19.0 — Kuruluş açılışı (M17; Claude, 2026-09-23)
- Tasarım kararı (kullanıcıyla): oyuncuyu tutmak için önce "İlk 10 dakika" paketi (M17: 0.19.0–0.19.3), M11 kalanı 0.20.x.
  Sınırsız harita yapılmayacak.
- `Sim.create(seed, difficulty, starter = 'ready')`, `StarterKind = 'guided' | 'ready'`, `sim.starter` (kayıtta; alan
  yoksa 'ready'). Varsayılan 'ready' olduğu için bütün eski testler ve dokunma senaryoları aynı dünyayı kurar.
- Yeni `src/sim/world/PlotReserve.ts`: `WorldGen` DEĞİŞMEDİ, arsayı hep 40×32 "rezerv" olarak üretir (RNG sırası aynı).
  `applyFoundingPlot(world)` arsayı `plotCoreRect()` = `BALANCE.world.plotCore` {dx 8, dy 6, 24×20} → mutlak {88,90,24,20}
  yapar; `trimReserve` rezervin arsa dışında kalan karelerini RNG'siz çayıra çevirir ve güney kapıdan (x 100–101, y 110–115)
  ve doğu kapıdan (x 112–119, y 100–101) üretimdeki yolların başına kısa yol çeker. Çekirdeğin kapı sütunu/satırı (100)
  rezervin ortasıyla aynı, bu yüzden yollar hizalı. `Sim.fromJSON` 'guided' kayıtta `generateWorld`'ün hemen ardından
  `applyFoundingPlot` çağırır; sonra her zamanki arsa geri yükleme (genişlemiş arsa) ve nesne değişiklikleri gelir.
- `setupStarterShelter(starter)`: kuruluşta yalnız ofis (dx 11, dy 2; kapısı yol sütununda), ilk köpek (plandan sapma:
  köpek kuruluşta da var, ilk dakikalarda bakacak biri olsun), tuvalet bölgesi yok, kapı dışındaki öğretici yuva (104,113).
  Hazır yolun kodu ve sırası aynen.
- Yeni `src/sim/systems/Goals.ts`: `GOALS` (0.19.0'da 3: kennel 200, bowlTrough 100, incubator 150), `GoalSystem`
  (`index`, `current`, `check()` sim dakikasında başarımlardan sonra, dakikada en çok bir hedef; ödül `addIncome('aid')`
  "Belediye ödülü", +`BALANCE.goals.reputation`, olay `goal` + mesaj), `FOUNDING_GOALS` 3 (hazır başlangıç ve eski kayıt
  bu sırayla başlar), kayıt `goals: { index }`. `BALANCE.goals { rewardMul, reputation }`.
- Genişletme: `plotExpansionCost(sim)` (`BuildSystem`): arsa çekirdek boyutundaysa `BALANCE.world.firstExpansionCost` 1.500,
  yoksa `PLOT_EXPANSION_COST` 2.500; `tryExpandPlot` ve `BuildBar` bunu kullanır.
- Arayüz: `MainMenu` "Başlangıç türü" seçimi (Kuruluş varsayılan; `app.lastStarter()` localStorage `…starter`),
  `app.newGame(seed, difficulty, slot, starter)` kuruluşta "Belediye bu arsayı sana emanet etti…" bildirimi; `Guide`
  en üstte 🎯 hedef + ödül + açıklama; telefonda rehber gizliydi → `.guide.has-goal` hedef varken telefonda da görünür
  (pil: "🎯 Yem kabı ve su yalağı koy · 100 ₺"). `goal` olayında `coin` sesi.
- `runTouchScenarios` kuruluş oyununda koşmaz ("Hazır barınak ile yeni oyun başlat" özeti); kuruluş senaryosu 0.19.3'te.
- Testler `tests/unit/founding.test.ts` (3): 3 tohumda çekirdek, çit/kapılar, yol bağları, şerit çayır, öğretici yuva,
  ofis kapısından iki yola yol bulma, hazır başlangıç değişmedi; hedeflerin sırası (kuluçka önce kurulsa da kulübe
  beklenir), ödül/para/itibar/mesaj; kayıt turu (genişlemiş ve genişlememiş kuruluş dünyası birebir), ilk genişletme 1.500
  sonra 2.500, eski kayıt 'ready' + hedefler tamam. 358 test. Tarayıcı 812×375: menü seçimi, kuruluş dünyası, kulübe →
  "+200 ₺" bildirimi ve kart "Yem kabı ve su yalağı koy · 100 ₺"; hazır barınakla `runTouchScenarios` 12/12.
- Sıradaki: 0.19.1 hedef zinciri (Guide'ın 9 adımı zincire döner, GoalsPanel, catchUp).

## 0.18.2 — Köy ve yem toptancısı (M11; Claude, 2026-09-23)
- Yeni `src/sim/world/Village.ts`: `stampVillage(world)` üretimin sonunda (WorldGen adım 8, `recomputeAllSolid`'den önce), **RNG
  kullanmadan**: köyün üst satırı `height - 3 - 16`; o satırdaki ilk yol karesi `roadX`, köy `left = roadX - 11` (sınır dışıysa köy
  yok). 24×16 alan temizlenir (üst sıradaki ağaç tepeleri dahil), biyom `Biome.Village` (yeni, 11, "Köy"), yol bandı (sütun
  11–12) düz `Path`/`Road`, meydan 4–10. satırlar `Path`; alandaki yuva/in listeden çıkar. Binalar sabit `LAYOUT`: toptancı
  4×3, ev, oyuncak dükkânı 4×3 (0.18.3'te açılacak; şimdilik "yakında açılacak"), ev, çeşme 2×2, ev. `buildingSolid` ile katı,
  `world.village` / `world.villageBuildings` (kaydedilmez, her yüklemede üretilir), `TileWorld.villageAt`, `villageDoorTile`,
  `villageInteriorKind` (yalnız toptancı), `wholesaleBagPrice` (80 × `BALANCE.village.wholesaleMul` 0,7 = 56 ₺),
  `restampVillage` (`Sim.fromJSON` nesne değişiklikleri yeniden uygulandıktan sonra köyü tekrar temizler).
- Eski kayıtlar: dünya tohumdan yeniden üretildiği için köy eski kayıtlarda da aynı yerde; yuva sayaçları kare indeksli.
- `Sim.enterVillage(index)` (iç mekân `buildingId = VILLAGE_ID_BASE - index`, -1000'den geriye), `Sim.villageFound` (kayıtta;
  `revealPlayer` köy alanına girilince bulur, mesaj), başarım `village` "Köyü buldun" (toplam 28). Komut `buyWholesale { bags }`
  (yalnız toptancı içindeyken, en az 3, "Yem" gideri, kilere anında).
- Etkileşim: köy binasına bakınca `enterVillage` ("E: Yem toptancısı · içeri gir") ya da ipucu; `ResolvedAction.village`.
  Dokun-git: `NavGoal { kind: 'village', index }` (kapı önüne yürü, `enterVillage`); `WorldScene.touchTap` köy binasına dokunuşu
  ayırır (girilemeyenlerde kapı önüne yürür).
- İç mekân `wholesaler` (10×7): dolu çuval rafları (`bulkSacks`), tezgâh (`shopCounter` → yeni `src/ui/WholesalePanel.tsx`,
  panel `'wholesale'`: 3/5/10 çuval), kasalar; tezgâh arkasında satıcı (`ensureHumanTexture(11, 'caretaker')`,
  `WorldScene.interiorExtras`).
- Görsel: `BuildingArt.drawVillageBuilding(kind, w, h)` (toptancı: ahşap, çuval tabelası; oyuncak dükkânı: beyaz, top ve haç
  tabelası; ev: yeşil çatı; çeşme), `WorldScene.addVillageImage`; mini harita keşfedilmiş köy binalarını çizer.
- Testler `tests/unit/village.test.ts` (3): 3 tohumda köy üretimi (yer, katılık, kapılar, yuva/in yok, yol bandı, deterministik),
  bulma + başarım + kayıt, toptancıya E ve dokun-git ile giriş, tezgâh paneli, fiyat/en az 3/yalnız içeride, oyuncak dükkânı
  kapalı, çizimler. 355 test. Tarayıcı: köy (x 92, y 181) dışarıdan, bulma bildirimi ve başarım, toptancı içi + satıcı,
  3 çuval 168 ₺, `runTouchScenarios` 12/12.
- Sıradaki: 0.18.3 oyuncak/ilaç dükkânı (oyuncak paketi, vitamin, bisiklet) + pazar günü.

## 0.18.1 — Tam ekran harita ve işaretler (M11; Claude, 2026-09-23)
- `Sim.markers: MapMarker { id, x, y, color }[]` (kayıtta; yüklemede tamsayı, harita içi, en çok `BALANCE.map.maxMarkers` 5,
  renk 0–4). Komutlar: `addMarker { x, y }` (kare tabana yuvarlanır; sınır mesajı "En çok 5 işaret konabilir"; ilk boş renk,
  yerel artan id — global `nextId` kullanılmaz), `removeMarker { id }`, `goToMarker { id }` (avatar modu, dışarıda olmak
  gerekir "Önce dışarı çık"; otopilotu kapatır; `nav.goTo` — tam harita araması `BALANCE.nav.maxNodes` 30.000 zaten
  200×200 haritanın çoğunu kapsıyor, plandaki ara hedefe bölme gerekmedi; güney yolunun ucuna (≈70 kare) yol < 500 ms, test).
- `PhoneSheets.MapSheet` → tam ekran harita: solda `Minimap inSheet onPick selected` (tuvale dokunuş → kare; 3 kare içindeki
  işarete dokunmak seçer, yoksa işaret koyar), sağda işaret listesi (renk, "n kare uzakta", Git, ✕). "Git" paneli kapatır.
  `Minimap` işaretleri (koyu çerçeveli renkli kare, seçili beyaz halka) her modda çizer; masaüstü mini haritasına tıklamak tam
  haritayı açar; `MARKER_COLORS` dışa aktarılır. CSS `responsive.css` sonunda (`.map-body`, `.map-side`, `.marker-row`).
- Açma yolları: M tuşu (`KeyName`/`KEY_LIST` + `handleHotkeys`), üst şerit 🗺️ çipi, mini haritaya tıklama. Yardım: klavye
  "M", dokunmatik "Mini haritaya ya da 🗺️ çipine dokun".
- Testler `tests/unit/markers.test.ts` (2). 352 test. Tarayıcı (812×375): çipten harita, gerçek tıklamayla 2 işaret, Git →
  panel kapandı, 51 → 28 kare yaklaştı; M açtı; mini harita tıklaması açtı; `runTouchScenarios` 12/12.
- Sıradaki: 0.18.2 köy (güney yolun ucu) ve yem toptancısı.

## 0.18.0 — İnler mevsimlik dolar + dışarıda hava (M11 ilk dilimi; Claude, 2026-09-23)
- `Sim.refillDens(week)`: `onWeek` mevsim dönümünde (`(week-1) % weeksPerSeason === 0`, week > 1) çağrılır. Her boş in
  (üstünde `d.wild && d.den` eşleşen köpek yok) `new Rng(hash3(seed, denIndex + 1, seasonIndex))` ile `BALANCE.strays.
  refillChance` (0,6; kışın `refillChanceWinter` 0,3) olasılıkla yeni vahşi köpek alır; nadirlik `spawnStrays` ile aynı
  dağılım, **ad da ayrı RNG'den** (`pickName` ana RNG'yi kullanıyordu); haritada en çok `maxWild` (8) vahşi köpek. Mesaj
  "🐾 Sokak köpekleri inlerine döndü (n)". Ana `sim.rng` sırası değişmez (test).
- `Player.update(dt, input, world, exertion = NO_EXERTION)`; `PlayerExertion { runDrainMul, walkDrain }`.
  `WeatherSystem.playerExertion(outside)`: arsa dışında fırtınada yürürken saniyede `stormWalkDrain` (3) kayıp ve koşu ×1,5,
  karda koşu ×1,25; yağmur/açık hava ve arsa içi etkisiz. `Sim.update` iç mekânda ya da arsa içindeyken `outside = false`.
- `WorldScene.updateNight`: kış gecesi (`clock.isNight()`) oyuncunun dış konumu arsa dışındaysa gece rengi ×
  `winterNightOutsideMul` (0,6).
- Testler `tests/unit/strays-weather.test.ts` (4): dolum/dönüm dışı/dolu in/sınır ve mesaj, ayrı RNG ve aynı tohumda aynı
  köpek, dayanıklılık çarpanları, Sim.update güney yolunda fırtına. 350 test.
- Tarayıcı: kış 23:00 gece rengi arsa içinde 0x46539f, güney yolunda 0x2a325f; in dolum bildirimi göründü;
  `runTouchScenarios` 12/12.
- Sıradaki: 0.18.1 tam ekran harita ve işaretler.

## 0.17.4 — M16 cilası: otopilot mutfakta pişirir, dokunma senaryoları 11–12 (M16 son dilimi; Claude, 2026-09-23)
- Otopilot `bakeJob` (zincirde `berryJob`'dan sonra, `idlePet`'ten önce): ödül maması `BALANCE.autopilot.bakeBelowTreats`
  (3) altında, `bakeIssue` yok (fırın hakkı, kiler ≥ 2, çanta dolu değil), kara listede değil ve **keşfedilmiş bir vahşi köpek**
  varsa hazır mutfağın kapısına gidip `enterBuilding`. İçeride `interiorJob` fırına `object` hedefiyle gider (E = `bake`),
  eşik dolana kadar tekrarlar, sonra kapıdan çıkar. Durum "🤖 Mutfakta ödül maması pişiriyor". Böğürtlen varken önce
  böğürtlen (bedava) toplanır.
- `touchDebug.runTouchScenarios` 12 senaryo: 11 "kilerin kapı karesine dokun → içeri, rafa dokun, kapıdan çık", 12 "kilere
  (binaya) dokun → sipariş paneli, içeri girilmez".
- Yardım 🤖 satırına "ödül maması pişirme"; README Otopilot bölümü; `docs/PLAN.md` M16 tamam.
- Testler: `autopilot.test.ts` yeni pişirme testi (çalı/yuva temizlenir, mutfak kurulur, vahşi köpek karesi keşfedilir;
  65 sn içinde tek giriş, 3 pişirme, yem −6, dışarıda). Not: ara anda `pilot.current` iş arasında boş olabilir → iş
  anahtarlarını toplayarak doğrula. 346 test. Tarayıcı: `runTouchScenarios` 12/12.
- **M16 Diğer İç Mekânlar tamam (0.17.0–0.17.4).** Sonrası (kullanıcı seçer): yuva evi içi, kuzey/batı arsa genişletme,
  M11 Yaşayan Dünya, M13 Sahiplendirme Hikâyeleri.

## 0.17.3 — Kuluçka içi (M16; Claude, 2026-09-23)
- `interiorKindFor('incubator') = 'hatchery'` (8×6). Kapıda E / binaya dokunmak bugünkü gibi kuluçka paneli (ipucuna
  " · ↑ içeri"); kapı karesi / ↑ içeri.
- Şablon öğesine `minLevel` eklendi; `buildInterior(kind, owned, level)` (Sim `enterBuilding`/`refreshInterior` bina
  seviyesini verir). Eşyalar: tepsi (`tray` 2×1, `slot` = tepsi sırası, 3 yumurta; ikincisi `minLevel: 2`), kontrol paneli
  (`controlPanel` → kind `incubator` = mevcut kuluçka paneli), ısı lambası (`heatLamp`, satın alınır 500 ₺), malzeme rafı
  (`supplies` → eşya paneli). `upgradeBuilding` sonrası `refreshInterior` (içerideyken Sv2 tepsisi hemen belirir).
- `IncubatorSystem.incubatorTimeMul(b)` (lambayla `BALANCE.hatchery.lampTimeMul` 0,85): `tickIncubators` sayacı
  `dtMin / mul` hızında düşürür → içerideki ve yeni konan yumurtalar %15 çabuk çatlar; `hatchLeft` birimi değişmedi (çantaya
  alınan yumurta lambasız kuluçkada normal hızda devam eder). Kuluçka panelindeki "n gün kaldı" çarpanla gösterilir.
- Tepsi ipucu: "Tepsi: Nadir 1,4 g · Sıradan 2,0 g"; boşsa "Boş tepsi · yumurtayı kontrol panelinden koy".
- `WorldScene.syncInteriorEggs`: kuluçka odasında yumurtalar tepsi çukurlarında `drawEgg` dokusuyla (`int-egg-<genom>`,
  ölçek 0,6); yumurta kümesi/oda değişince 10 Hz senkronda yeniden kurulur, çıkışta temizlenir.
- Testler `tests/unit/hatchery.test.ts` (3): Sv1/Sv2 tepsi sayısı, tam oda erişim/çizim; lamba hızı (100 dk → 85 dk'lık
  tik aynı ilerleme), kapıda E paneli; tepsi ipucu, kontrol paneli, yükseltme odayı yeniler. 345 test.
- Tarayıcı (812×375): Sv2 kuluçkaya 4 yumurta, kapı karesi → içeri, 4 yumurta görseli, raftan ısı lambası; çıkışta
  görseller temizlendi; `runTouchScenarios` 10/10.
- Sıradaki: 0.17.4 cila (otopilot mutfakta ödül maması, dokunma senaryoları 11–12, yardım/README) — M16 son dilimi.

## 0.17.2 — Veteriner odası içi (M16; Claude, 2026-09-23)
- `interiorKindFor('vetClinic') = 'clinic'` (10×8). Kapıda E / binaya dokunmak **bugünkü gibi** yakındaki hasta köpeği
  tedavi eder (ipuçlarına " · ↑ içeri"); kapı karesi / ↑ içeri sokar.
- Eşyalar: röntgen panosu (duvarda, dekor), ilaç dolabı (`medCabinet`, satın alınır 600 ₺), muayene masası (`examTable` →
  yeni `src/ui/ClinicPanel.tsx`, panel `'clinic'`), resepsiyon (`reception` → eşya paneli, kind `restShop`), bekleme
  sandalyeleri. Katalog `FURNITURE_BY_KIND.clinic = ['medCabinet']`.
- Yeni `src/sim/systems/ClinicSystem.ts`: `treatmentCost` (ilaç dolabıyla −%30: 60 → 42 ₺; oyuncu `performAction`,
  personel `StaffSystem` tedavisi, otopilot `planFor` para kontrolü bunu kullanır), `vaccineDaysLeft`, `illnessChanceMul`
  (aşılıda `BALANCE.clinic.vaccineMul` 0,5), `vaccinateIssue` (hazır veteriner yok / barınakta değil / zaten aşılı / para yok),
  `vaccinate` (80 ₺ "Tedavi" gideri, 4 hafta, `stats.vaccinated`). Komut `vaccinate { dogId }`.
- `Dog.vaccinatedUntil` (toplam dk, kayıtta, varsayılan 0). `IllnessSystem.onDay` pire/soğuk/mide zarları ve `onHour` bulaşma
  zarı × `illnessChanceMul` — zar yine atılır; aşısız oyunlarda davranış birebir aynı.
- ClinicPanel: barınak köpekleri (hasta önce, sonra sağlığa göre), sağlık çubuğu, hastalık adı ya da "sağlıklı",
  "💉 aşılı · n gün" ya da "Aşıla (80 ₺)" (neden varsa düğme kapalı, başlıkta nedeni). Açıklamada güncel tedavi ücreti.
- Testler `tests/unit/clinic.test.ts` (4): aşı akışı/kayıt/süre, zar eşikleri (rng.chance kaydedici ile: pire 0,05 → 0,025,
  bulaşma 0,03 → 0,015), kapıda tedavi + ilaç dolabı ücreti, iç eşyalar ve paneller. 342 test.
- Tarayıcı (812×375): veteriner kur, kapı karesine dokun → içeri; muayene masası → "Muayene masası" paneli, Toros aşılandı
  (28 gün); resepsiyon → eşya paneli, ilaç dolabı alındı; `runTouchScenarios` 10/10.
- Sıradaki: 0.17.3 kuluçka içi (tepsilerde yumurtalar, ısı lambası).

## 0.17.1 — Mutfak içi (M16; Claude, 2026-09-23)
- `interiorKindFor('kitchen') = 'kitchen'` (10×7). Mutfakta kapıda hızlı iş yoktu → kapıda E / binaya dokunmak içeri sokar
  ("E: mutfağa gir"); ↑ ve kapı karesi de çalışır.
- Eşyalar: tezgâh (`counter` 3×1 → eşya paneli, kind `restShop` yeniden kullanıldı → `FurniturePanel`), fırın (`oven`),
  ikinci fırın (`oven` + `buy: 'oven2'`, 450 ₺), su deposu (`waterTank`, 350 ₺), baharat rafı (duvarda, dekor), mama rafı
  (kiler stoğunu söyler). Katalog: `FURNITURE_BY_KIND.kitchen = ['waterTank', 'oven2']`, fiyatlar `BALANCE.interior.furniture`.
- Yeni `src/sim/systems/KitchenSystem.ts` (saf): `bakesLeft` (günde `BALANCE.kitchen.bakesPerDay` 4, ikinci fırınla +3; gün
  değişince sıfır), `bakeIssue` (hak bitti / ödül çantası dolu (`treatsMax` 10) / kiler < 2), `bake` (yem −2, ödül +1,
  "🍪 Ödül maması pişti (n/10)"), `kitchenWaterPerHour` (su deposuyla ×2: 15 → 30). `Sim.onHour` mutfak dolumu bunu kullanır.
  Hangi mutfakta olursa olsun hazır bir mutfaktaki eşya sayılır. Fırın kullanımında oyuncu 2 sn meşgul (`busySec`).
- Kayıt: `Sim.bakeDay` / `bakesToday` (SaveData opsiyonel, varsayılan 0). Mutfak açıklamasına "İçeride fırında ödül maması
  pişer.", yardım satırlarına mutfak.
- Testler `tests/unit/kitchen.test.ts` (4): pişirme/günlük sınır/ikinci fırın/ertesi gün/kayıt, kiler yetmez + çanta dolu,
  su deposu (saatlik olayla yalak 30), tezgâh paneli, tam donanımlı odada katılık/erişim/çizim. 338 test.
- Tarayıcı (812×375): mutfak kur, dokun → içeri; fırına dokun → ödül 1, yem 40 → 38; tezgâh → "Mutfak" paneli, iki eşya
  alındı, odada 2 fırın + su deposu; `runTouchScenarios` 10/10.
- Sıradaki: 0.17.2 veteriner odası içi (aşı, ilaç dolabı).

## 0.17.0 — Ortak giriş kuralı, genel eşya kataloğu, Kiler içi (M16 ilk dilimi; Claude, 2026-09-23)
- **Giriş kuralı:** E ve binaya dokunmak bugünkü hızlı işi yapar; içeri girmek için binanın alt-orta karesine (kapının hemen
  üstü) dokun ya da kapı önünde ↑ basılı tut (`BALANCE.interior.pushEnterSec` 0,25 sn). `NavGoal` += `{ kind: 'enter', id }`
  (PlayerNav bina gibi kapı önüne yürür, varınca `enterBuilding`, `interacted { kind: 'enter' }`); `WorldScene.isDoorTile`
  dokunuşu ayırır; `Sim.tryPushEnter` (yalnız elle girdi, dışarıdayken, oyuncu karesi = kapı karesi, üstü iç mekânlı hazır
  bina; bırakınca sayaç sıfır). Kiler ipucuna " · ↑ içeri". Ofis/dinlenme odasında E yine içeri sokar.
- **Genel katalog:** eşya fiyat/sınırları `BALANCE.staff.rest.furniture` → `BALANCE.interior.furniture` (sayılar aynı);
  `FURNITURE_BY_KIND` (office [], restRoom 4 eşya, pantry []); `sanitizeFurniture(kind, list)`; `buyFurniture` binanın
  kataloğuna bakar, mesaj "{name} yerleştirildi". `RestRoomPanel` → genel `src/ui/FurniturePanel.tsx` (panel `'furniture'`,
  başlık bina adı, moladakiler satırı yalnız dinlenme odasında); `ActionOutcome.open` `'restRoom'` → `'furniture'`.
- **Kiler içi** (`interiorKindFor('shed') = 'pantry'`, 8×6): üç çuval rafı (`sacks` 2×1, `slot` = raf sırası;
  `sacksOnShelf(foodStock, shelf)`: stok çuvala yukarı yuvarlanır, raf başına 3, en çok 9), sipariş defteri (`ledger` → `order`
  = kiler paneli), otomatik sipariş panosu (`orderBoard` → yeni `src/ui/AutoOrderPanel.tsx`, panel `'autoOrder'`: mevcut
  `autoOrderFood` + `foodThreshold` politikası). `InteriorArt`: raf varyantları `int-sacks-0..3`, kürsülü defter, şövaleli kara
  tahta. `WorldScene.interiorTexture/refreshInteriorItems` rafları 10 Hz stoğa göre yeniler.
- Yardım: klavye satırı "↑ (kapıda basılı tut)", dokunmatik "Binanın kapı karesine dokun" ve "İçeride eşyaya / kapıya dokun".
- Testler `tests/unit/interior-entry.test.ts` (4), `tests/unit/pantry.test.ts` (3); `rest-room.test.ts` katalog taşımasına
  uyarlandı. 334 test. Tarayıcı (812×375): kilere dokun → Kiler paneli (içeri girmez), kapı karesine dokun → kiler içi, stok
  55 → 3 çuval, 170 → 9 çuval, defter → Kiler, pano → Otomatik sipariş; `runTouchScenarios` 10/10. Konsoldaki tek 404, Vite'ın
  silinen `RestRoomPanel.tsx` için HMR isteğiydi (yalnız geliştirmede).
- Sıradaki: 0.17.1 mutfak içi (fırında ödül maması, su deposu, ikinci fırın).

## 0.16.4 — İç mekân cilası: otopilot, dokunma senaryoları 9–10, belgeler (M15 son dilimi; Claude, 2026-09-23)
- `Autopilot.tick`: iç mekândayken yalnız `interiorJob` — gece ve ofiste yatak varsa (uyku kara listede değilse) yatağa
  `object` hedefiyle gidip E (performAction `sleep`), değilse kapı karesine `tile` hedefiyle yürür ("🤖 Dışarı çıkıyor";
  `onArrive` = dışarıda mı). `sleepJob` artık ofis kapısında `enterBuilding` yapar ("🤖 Ofise uyumaya gidiyor"), içeride
  yatak işi sürer ("🤖 Yatakta uyuyor"); sabah 06:00'da içeride uyanır, ilk kontrolde kapıdan çıkar.
- `Sim.setAutopilot(true)` artık ışınlamaz (içerideyse otopilot yürüyerek çıkar); `enterBuilding` otopilot açıkken de
  çalışır (yalnız otopilot kullanır: `interact` ve `enterBuilding` komutları önce otopilotu kapatır).
- `touchDebug.runTouchScenarios` 10 senaryo: 9 "ofise dokun → içeri, içeride dokun-yürü, kapıya dokun → dışarı",
  10 "içerideyken yönetim modu → dışarıda, kamera sınırı haritada". `prepare()` önce `exitInterior()`.
- Yardım: dokunmatik tablosuna "Ofise / dinlenme odasına dokun" satırı. README: yeni "İç mekânlar" bölümü (eşya tablosu),
  Otopilot bölümünde yatak uykusu; `docs/PLAN.md` §7 M15 tablosu tamam.
- Testler: `interior.test.ts` otopilot yürüyerek çıkar; `autopilot.test.ts` uyku testi ofise giriş (1 kez), yatakta uyku ve
  sabah dışarı. 327 test. Tarayıcı: `runTouchScenarios` 10/10; otopilot içeriden çıktı, gece ofise girip uyudu (06:00),
  sabah dışarı çıktı.
- **M15 İç Mekânlar ve Personel Konforu tamam (0.16.0–0.16.4).** Sonrası (kullanıcı seçer): diğer binaların iç mekânları
  (veteriner, mutfak, kiler, kuluçka), M11 Yaşayan Dünya, M13 Sahiplendirme Hikâyeleri.

## 0.16.3 — Dinlenme odası içi (M15; Claude, 2026-09-23)
- "Personel odası" → **Dinlenme odası** (`staffRoom` adı/açıklaması; tür anahtarı aynı, kayıt uyumlu). Kapıda E → içeri
  (`interiorKindFor('staffRoom') = 'restRoom'`, şablon 10×7, halılı oturma alanı).
- Satın alınan eşyalar: `Building.furniture: string[]` (kayıtta; yüklemede `sanitizeFurniture`: bilinen türler, üst sınır).
  `BALANCE.staff.rest`: kanepe 300 ₺ (en çok 2, 2 kişilik), kahve köşesi 250 ₺, TV 400 ₺, buzdolabı 200 ₺. Şablon öğeleri
  `buy`/`slot` alanıyla: `buildInterior(kind, owned)` yalnız alınanları koyar. Komut `buyFurniture { buildingId, item }`
  (hazır oda, sınır, para; gider "İnşaat"); oyuncu o odadaysa `refreshInterior` odayı yeniden kurar ve `interiorChanged`.
- İçeride duvardaki pano (`restBoard`) → `RestRoomPanel` (`src/ui/RestRoomPanel.tsx`, panel `'restRoom'`): eşya listesi,
  n/max, "Al (₺)", moladakiler ve kanepe yeri. Kahve köşesi oyuncuya da kahve verir (ofisteki ile ortak günde bir).
- Etkiler (`StaffSystem`): `restRoomOf(s)` (hazır odanın kapısına < 3 kare), `restingIn(room)` (moladakiler, personel
  sırası), `seatsIn(room)` = kanepe × 2; `restRate` ilk `seatsIn` kişiye ×1,25; `onHour` odada molada moral +4 (eski) +
  kahve 2 + TV 1; `restUntilFor` buzdolabıyla 100 (yoksa 80). `Staff.insideId` her karede belirlenir (kayda yazılmaz).
- Görsel: moladaki personel dışarıda gizli (üstündeki "zzz" balonu kapıda kalır); oyuncu o odadaysa `restSpotInside`
  ile kanepelerde TV'ye dönük oturur (kanepe sırtı bacakları örter), yer yoksa ayakta. Çizimler: pano, mor kanepe (arkadan),
  sehpalı TV, buzdolabı.
- Testler `tests/unit/rest-room.test.ts` (3): alım/sınır/para/hazırlık/kayıt/temizleme; giriş, pano paneli, içerideyken
  alınan eşyanın anında görünmesi, tam odada katılık ve çizimler; kanepe 2 kişiye +%25, kahve+TV moral, buzdolabı eşiği.
  327 test. Tarayıcı (812×375): odaya dokun-gir, panodan alım, 5 eşya yerinde, 3 moladaki kanepelerde (rate 31,25),
  dışarıda gizli, `runTouchScenarios` 8/8.
- Not: gizli tarayıcı bölmesinde Preact paneli `store.tick` ile yenilenir; RAF duruksa panel eski kalır (test artefaktı).
- Sıradaki: 0.16.4 cila (otopilot iç mekânda, uyku yatağa, dokunma senaryoları 9–10, yardım/README/PLAN).

## 0.16.2 — Personel tuvalet ihtiyacı + Personel WC (M15; Claude, 2026-09-23)
- `BALANCE.staff.toilet = { perHour 12, goAbove 70, minutes 8, penaltyAbove 90, moraleLossPerHour 4, moraleFloor 25,
  efficiencyMul 0.9 }`. Plandaki 9/saat değiştirildi: 10 saatlik gündüz vardiyasında 90'a hiç ulaşmıyordu.
- `Staff.bladder` (0–100, kayıtta; `StaffSave.bladder?`), yeni durumlar `toToilet` / `toilet`. `StaffSystem.updateStaff`:
  vardiyada artar (tuvaletteyken değil), vardiya başında 0 (evden gelir); boştayken karar anında ≥ goAbove ise
  `goToilet` (en yakın hazır `staffToilet` kapısı, yol yoksa false → görev seçimine devam), molada da aynı kontrol
  (decisionTimer ile kısılır); `toilet` 8 dk sonra ihtiyaç 0, `idle`. `Staff.efficiency` ≥ penaltyAbove'da ×0,9;
  `onHour` ≥ penaltyAbove'da moral −4, ama yalnız bu ceza morali `moraleFloor` (25) altına indirmez.
- **Taban neden:** 24 saat vardiyalı personel WC'siz hiç sıfırlanmıyor; tabansız moral çöküp istifa ediyor ve
  `tests/sim/longrun.test.ts` (4 hafta, 24 saat bakıcı, WC yok) köpek sağlığı 0 ile kırılıyordu. Güncellemeyi alan eski
  kayıtlarda personel yalnız WC yüzünden istifa etmesin diye taban kondu (verim cezası sürer: moral 30 altı ×0,8).
- Bina `staffToilet` "Personel WC" (1×2, 400 ₺, 60 dk, kategori personel, `solidRows: 'all'`); `BuildingArt` beyaz
  kulübe, mavi çatı, "WC" tabelası, kapı. Tuvaletteki personelin sprite'ı gizli (`WorldScene.syncStaff`).
- `AlertSystem` `staffToilet`: personel var ve hazır WC yoksa "Personel tuvaleti yok: yönetim modunda Personel WC kur"
  (sıkışan varsa `warn`, yoksa `info`). Personel kartında "Tuvalet" çubuğu (≥ 90 kırmızı), durum adları "Tuvalete gidiyor"
  / "Tuvalette". README personel bölümü.
- Testler `tests/unit/staff-toilet.test.ts` (3): saatlik artış, verim ×0,9, moral −4 ve taban, uyarı; WC'ye gidip
  boşaltma, uyarının kalkması; kayıt gidiş-dönüşü ve çizim. 324 test.
- Tarayıcı (812×375): WC'siz uyarı çıktı; WC kurulunca ihtiyaç 80 olan bakıcı WC'ye gitti, içerideyken sprite gizli,
  ihtiyaç 0, işe döndü, uyarı kalktı; personel kartında Tuvalet çubuğu; `runTouchScenarios` 8/8.
- Sıradaki: 0.16.3 dinlenme odası içi (satın alınan kanepe/kahve köşesi/TV/buzdolabı, molada personel içeride).

## 0.16.1 — Ofis eşyaları (M15; Claude, 2026-09-23)
- Ofis şablonuna 8 eşya (`Interiors.ts` `TEMPLATES.office.items`; masa listede ilk kalır): masa-bilgisayar (2,2 2×1),
  kahve köşesi (1,2), lisans panosu (5,1 2×1, duvarda), pencere (7,1, duvarda), kitaplık (9,2 2×1), yatak (10,4 1×2),
  saksı (10,6), telefon sehpası (1,5). Hepsi `buildingSolid` ile katı; önlerine girişten yürünür (test).
- `Interaction.resolveInterior` eşya → eylem: masa `computer` (yeni `src/ui/ComputerPanel.tsx`: Sahiplendirme / Finans /
  Personel / Başarımlar kısayolları; panel anahtarı `'computer'`), pano `office` (ofis paneli), yatak `sleep`
  (`canSleepAt(hour)` 20:00–06:00; erken ise "Henüz erken" mesajı; uyuyunca oyuncu içeride uyanır), kahve `coffee`
  (dayanıklılık dolar, günde bir: `Sim.coffeeDay` kayıtta), telefon `order` (kiler paneli = yem siparişi; bina gerekmez),
  kitaplık `books` (Kontroller sayfası), pencere/saksı yalnız ipucu. `ActionOutcome.open` += `computer | order | help`.
- Ofis panelindeki "Sabaha kadar uyu" düğmesi kaldırıldı (yerine "Uyku: ofisteki yatakta" notu). Otopilot uykusu hâlâ kapı
  önünden `sleep` komutuyla (0.16.4'te yatağa taşınacak).
- `src/render/InteriorArt.ts`: 8 eşya çizimi (duvar eşyaları 16 px yükseklikte, alt 3 satır süpürgelik için boş).
- Testler: `tests/unit/office-items.test.ts` (4); `interior.test.ts` masa artık `computer`; `eggs.test.ts` uyku testi panoya.
  321 test. Tarayıcı (812×375): masa → Bilgisayar menüsü, telefon → Kiler, kitaplık → Kontroller, pano → Ofis; gece 23:00
  yatak → 2. gün 06:00, içeride; kahve dayanıklılığı 100 yaptı; kapıdan çıkış; `runTouchScenarios` 8/8.
- Sıradaki: 0.16.2 personel tuvalet ihtiyacı + Personel WC binası.

## 0.16.0 — İç mekân altyapısı: ofise gir/çık (M15 ilk dilimi; Claude, 2026-09-23)
- `src/sim/interior/Interiors.ts`: metin ızgara şablonları (`#` duvar üstü, `=` duvar yüzü, `.` döşeme, `c` halı, `D` kapı),
  `buildInterior(kind)` → ayrı küçük `TileWorld` (ofis 12×8) + kapı + giriş noktası + eşyalar; `interiorItemAt`,
  `interiorKindFor(type)` (şimdilik yalnız ofis), `ActiveInterior` (+ `buildingId`, `back` = dış kapı önü).
- Yeni zemin karoları `Ground.Floor/Carpet/Wall/WallFace/Doorway` (16–20; duvarlar `GROUND_SOLID`). Nesne değil zemin:
  `Obj` 16'dan sonra `OBJ_TILE_OFFSET + o` çit karolarıyla (48–63) çakışırdı. Eşyalar `buildingSolid` ile katı.
- `Sim`: `interior`, `playerWorld` (oyuncu yürüyüşü + `PlayerNav`), `playerOutside` (içerideyken dış kapı önü: köpek takibi,
  vahşi köpek merakı, mini harita), `enterBuilding(id)` (komut `enterBuilding`), `exitInterior()`, olay `interiorChanged`.
  İçerideyken `revealPlayer`/`brain.updateNearPlayer` atlanır, `GateSystem` oyuncuyu aktör saymaz, 02:00 bayılma olmaz.
  Kapı karesine basınca çıkış. `setMode('manage')` ve otopilot açılınca önce çıkar; otopilot açıkken girilmez.
  `toJSON` içerideyken oyuncuyu kapı önüne yazar (iç mekân kaydedilmez, kayıt sürümü 2).
- `Interaction`: ofis kapısında `enter` ("E: ofise gir"); içeride `resolveInterior` — masa (`desk`, 2×1) = `office` eylemi
  (ofis paneli: lisans, kredi, hedef, uyku), boşta ipucu. Planda eşyalar 0.16.1'deydi; masa bu sürüme alındı ki ofis paneli
  kapıdan kalkınca erişilemez olmasın.
- `WorldScene`: iç oda ayrı tilemap, x = `(world.width + 200) × 16` px; `showInterior` (olayla kur/kaldır, kamera ortalar),
  `fitInteriorBounds` (her kare: oda görüşten küçükse ortalanır; üst çubuk 44 / alt menü 76 css px dikey pay, kamera
  oyuncuyu izleyerek kayar → kapı alt menünün altında kalmaz), `interiorTap` (eşya → goInteract object, boş → goTo),
  `gesturePointer` oda ofsetini çıkarır, `selectDogAt` içeride kapalı, gece/ışık/yağmur içeride gizli.
  `src/render/InteriorArt.ts` `drawInteriorItem('desk')` (bilgisayarlı masa, doku `int-desk`).
- Testler `tests/unit/interior.test.ts` (5); `eggs.test.ts` uyku testi yeni akışa (kapı → gir → masa) güncellendi. 317 test.
- Tarayıcı (812×375 `?touch=1&debug=1`): ofise dokun → kapıya yürüyüp girer; masaya dokun → ofis paneli; gece yağmurda
  içerisi aydınlık, yağmur yok; kapıya dokun → dışarı, kamera sınırı haritaya döner; `runTouchScenarios` 8/8.
- Sıradaki: 0.16.1 ofis eşyaları (lisans panosu, yatak, kahve makinesi, telefon, kitaplık; masa-bilgisayar seçim menüsü).

## 0.15.2 — Soy ağacı, başarımlar, otopilot (M14 son dilimi; Claude, 2026-09-23)
- `src/sim/systems/Lineage.ts` `lineageOf(sim, dog)` (saf): anne-baba (ad, barınakta mı), dede-nine (ebeveyn hâlâ kayıttaysa
  onun `parentNames`'i), barınaktaki yavrular. Köpek panelinde "Soy" bölümü (Kulübe'den önce): barınaktaki anne-baba ve yavrular
  düğme (dokununca o köpeğin paneli), barınakta olmayan ebeveyn gri ad.
- `stats.bredHatched` / `stats.bredLegendary` (kuluçkada soylu yumurta çatlayınca); başarımlar `lineage-1` "İlk soy" ve
  `lineage-legend` "Efsanevi soy" (toplam 27).
- Otopilot: tahta boşken uykudan sonra `nurseryEggJob` — yuva evinde yumurta varsa ve çantada yer varsa kapıya gidip alır
  (sonra mevcut `placeEggJob` kuluçkaya koyar); durum metni "🤖 Yuva evinden yumurta alıyor".
- M14 Soy tamam (0.15.0–0.15.2). Sıradaki paket M15 İç Mekânlar (0.16.x).
- Testler: `tests/unit/lineage.test.ts` (3).

## 0.15.1 — Yuva evi (M14 ikinci dilimi; Claude, 2026-09-23)
- Yeni bina `nursery` "Yuva evi" (3×3, 2.500 ₺, 240 dk, Büyüme; `eggSlots: 1` — yüklemede yumurtası kırpılmasın diye).
  `Building.pair` (0–2 köpek id) ve `breedLeft` (dk) kayıtta; `Dog.breedReadyAt` (toplam dk) kayıtta.
- `src/sim/systems/BreedingSystem.ts`: `breedingIssues` (barınakta, yetişkin — yavru/genç/yaşlı değil, sağlık ≥ 70,
  dinlenme bitmiş, başka yuva evinde değil, karşılıklı dostluk `mutualAffinity` ≥ 60), `setNurseryPair` (değişince sayaç
  baştan), `tickNurseries` (`stepSim`, kuluçkanın yanında; koşul bozulunca sayaç durur, sıfırlanmaz; bitince
  `new Rng(hash3(seed, bina, stats.bred))` ile `inheritGenome` → soylu yumurta binada, ikisine 4 hafta dinlenme,
  `stats.bred++`, mesaj), `takeNurseryEgg`. Komutlar `setNurseryPair`, `takeNurseryEgg`. Ana RNG sırası değişmez (testli).
- Arayüz: yuva evi önünde E → `NurseryPanel` (iki seçici — seçenekte karşılıklı dostluk puanı, koşul listesi ✗, ilerleme
  çubuğu ve kalan gün, "Yumurtayı al"). Doku: pembe çatılı, kalpli tabelalı ev. Yıkımda binadaki yumurta çantaya döner.
- Testler: `tests/unit/breeding.test.ts` (5).

## 0.15.0 — Kalıtım çekirdeği ve soy bilgisi (M14 ilk dilimi; Claude, 2026-09-23)
- `DogGenome.inheritGenome(a, b, rng)` (saf): görünüş ve huy alanları ebeveynlerden biri, `BALANCE.breeding.mutation` (0,1)
  olasılıkla o alanın rastgele değeri; ana renk seçilen ebeveynden (mutasyonda nadirliğe uygun renk), ikincil renk öbür
  ebeveynin ana rengi; zekâ/enerji ebeveynlerden biri, mutasyonda ±1; nadirlik ebeveynlerin yükseği, `rarityUp` (0,15)
  olasılıkla bir kademe üstü. Üreten kod (0.15.1 yuva evi) ayrı RNG kullanacak.
- Soy alanları: `Egg.parents/parentNames` (isteğe bağlı, kayıtta, `eggFromJSON` doğrular), `Dog.parents/parentNames`
  (varsayılan null, kayıtta); kuluçkadan çıkan yavru yumurtanın soyunu taşır; geri getirilen sahiplendirilmiş köpek de korur.
  Yumurta açıklamasında ve köpek panelinde köken satırı ("Soy: A × B" / "Yuvadan bulunan yumurta" / "Sokaktan geldi").
- Testler: `tests/unit/inherit.test.ts` (5).

## 0.14.6 — 3 kayıt yuvası ve haftalık otomatik kayıt (M12 son dilimi; Claude, 2026-09-23)
- `GAME.saveSlots = 3`; `SaveManager.listSlots()`, `summary` += `difficulty`, `victory`; `lastSlot()/setLastSlot()`
  (`pati-barinagi.lastSlot`, geçersizse 0). Anahtarlar değişmedi: eski tek kayıt (`…save.0`) "Yuva 1" olarak görünür, göç yok.
  Ayar anahtarları (`${SaveManager.key(0)}.guideHidden` vb.) genel kalır.
- `app.ts`: sabit `SLOT` yerine `store.saveSlot`; `newGame(seed, difficulty, slot)` seçili yuvaya hemen kaydeder,
  `continueGame(slot)`, `deleteSlot(slot)`, içe aktarma seçili yuvaya yazar; `refreshSlots()` → `store.slots` + `hasSave`.
  Kayıt her sabah 06:00 ve çıkışta sessiz (önceden de vardı) + her hafta başında "Otomatik kaydedildi · yuva n" bildirimi.
- `MainMenu.tsx`: 3 yuva kartı (gün, kasa, zorluk, 🏆, kayıt zamanı; dokununca seçilir), kartta Devam ve iki adımlı Sil;
  "Yeni oyun (yuva n)" dolu yuvada iki adımlı üzerine yazma onayı. Kartlar `flex: none` (menü dikey flex, büzülmesin).
- Plan sapması: Ayarlar'da otomatik kaydı kapatma anahtarı eklenmedi (kayıp riskine karşı her zaman açık).
- Testler: `tests/unit/save-slots.test.ts` (4; Map tabanlı sahte localStorage).

## 0.14.5 — Finans grafiği ve nakit tahmini (Claude, 2026-09-23)
- Saf `EconomySystem.projectCash(sim, weeks = 4)`: son 3 haftanın maaş ve faiz dışı net ortalaması (geçmiş yoksa 0) − bugünkü
  haftalık maaş − bugünkü kredi faizi = `weeklyNet`; `points` hafta hafta kasa; `weeksUntilNegative` ilk eksi hafta ya da null.
  Maaş/faiz bugünkü değerle girer: yeni işe alım ya da kredi tahmine hemen yansır.
- `src/ui/FinanceChart.tsx`: son 8 hafta SVG (gelir yeşil yukarı, gider kırmızı aşağı, net sarı kesikli çizgi; çubuk başına
  ipucu), viewBox ile genişliğe ölçeklenir (telefonda yatay kaydırma yok). `FinancePanel` özet altında grafik + tahmin satırı
  (eksiye düşecekse kırmızı "Bu gidişle n hafta sonra kasa eksiye düşer").
- Not: panel dikey flex olduğu için SVG kısa ekranda 0 yüksekliğe büzülüyordu → `.fin-chart { flex: none; aspect-ratio }` ve
  SVG'ye width/height öznitelikleri. Panel içine eklenen her grafik/görsel için aynı kural.
- Testler: `tests/unit/projection.test.ts` (3).

## 0.14.4 — Eğitim kursu ve gönüllüler (Claude, 2026-09-22)
- Kurs: komut `sendToCourse { staffId }` (`BALANCE.staff.course` 800 ₺, 1 gün; defter `wages` "Kurs: ad"); `Staff.courseUntil`
  (toplam dakika, kayıtta). Kurstayken `updateStaff` vardiyayı 0 sayar (eve gider); süre dolunca `finishCourse` → bir seviye
  (`gainXp` eşiğe tamamlanır) + mesaj. Sv5'te, gönüllüde, parasızken ve zaten kurstayken ret.
- Gönüllü: `Sim.volunteerOffer` (kayıtta); `StaffSystem.onDay` Cuma (`volunteer.offerWeekday` 4) ayrı RNG ile
  (`hash3(seed, week, …)`, ana RNG sırası değişmez) başvuru üretir, Pazartesi siler. Komut `acceptVolunteer` (sınır denetimi,
  ortak `admit`). `Staff.volunteer` + `volunteerWeeksLeft` (2): maaş 0, verim × 0,6, yalnız Cumartesi–Pazar çalışır; her maaş
  gününde −1, 0'da teşekkür mesajı + itibar +1 ile ayrılır; ödenmemiş maaş denetimine girmez.
- Arayüz: personel kartında "Kursa gönder (800 ₺)" / "Kursta", Gönüllü rozeti ve kalan hafta; aday listesinin üstünde
  gönüllü başvurusu kartı ("Kabul et").
- Testler: `tests/unit/course-volunteer.test.ts` (7).

## 0.14.3 — Personel deneyim/seviye ve moral (Claude, 2026-09-22)
- `Staff`: `xp`, `level` (1–5), `morale` (0–100, başlangıç 70), `lowMoraleDays` — hepsi kayıtta, eski kayıtta varsayılan.
  `xpForLevel(level)` = 100 × seviye; `ROLE_MAIN_ATTRS` (bakıcı: çalışkanlık → hız → dayanıklılık; eğitmen/veteriner:
  beceri → şefkat → çalışkanlık). `efficiency()` moral < 30 iken × 0,8.
- `StaffSystem.gainXp(s, n)`: tamamlanan her görev +10 (`completeTask`); eşikte seviye, ilk 5'in altındaki ana nitelik +1,
  moral +5, mesaj. `onHour()` (Sim `hour` olayı): yorgun (enerji < 20) çalışma −3, mola odasında dinlenme +4, başka yerde
  dinlenme ya da izin +1, normal çalışma +0,5, iş yükü (sahipsiz görev / görevdeki personel > 3) −2. `afterPayday`: maaş
  ödenmezse −15. `onDay()` (Sim `day` olayı): moral < 10 üç gün sürerse istifa (mesaj). Sayılar `BALANCE.staff.progress/morale`.
- Arayüz: personel kartında "Sv2 ★★", deneyim satırı ve moral çubuğu (düşükse kırmızı, ipucunda nedenler).
- Testler: `tests/unit/staff-progress.test.ts` (7).

## 0.14.2 — Otomatik yem makinesi + ofis seviyesi (Claude, 2026-09-22)
- Yeni bina `feeder` "Otomatik yem makinesi" (1×1, katı, 2.500 ₺, 120 dk, Besleme): `src/sim/systems/FeederSystem.ts`
  `tickFeeders` her saat başı (`Sim.onHour`, mutfak dolumunun yanında) `BALANCE.feeder.radius` (8 kare) içindeki hazır
  kaplara kilerden `feedPerHour` (2) porsiyon koyar, kiler boşsa durur. `feederCovers` → `TaskBoard` yem görevinin aciliyeti
  × `taskUrgencyMul` (0,5): makine yetişemezse görev yine gelir. Doku `BuildingArt` (hazne + boru + kap).
- Ofis seviyesi = lisans seviyesi: ofis dokusu 3 varyant (Sv2 bayrak + ikinci pencere, Sv3 altın yıldız tabela + çatı
  penceresi), `WorldScene.buildingVariant` office → `licenseLevel - 1`, `syncBuildings` lisans yükselince dokuyu değiştirir.
  `StaffSystem.maxStaff(sim)`: Sv3'te `BALANCE.staff.maxStaffTop` (16), Sv1–2'de 12 (işe alım, kayıt yükleme, personel paneli).
- Testler: `tests/unit/feeder.test.ts` (4).

## 0.14.1 — Yükseltmeler 1: kuluçka Sv2 + büyük çanta (Claude, 2026-09-22)
- `Building.level` (1–2, kayıtta, varsayılan 1); `BuildingDef.upgrade?: { cost, eggSlots?, hatchDays? }` — kuluçka
  `{ cost: 2000, eggSlots: 6, hatchDays: 2 }`. Genel komut `upgradeBuilding { buildingId }` (hazır bina, para, tek seviye;
  defter `building`). Yükseltmede içerideki yumurtaların kalan süresi `yeniGün / eskiGün` oranında kısalır (3 → 2 gün: ×2/3).
- `IncubatorSystem`: `incubatorSlots(b)` ve `incubatorHatchDays(b)` seviyeye göre; `placeEgg` süreyi ilk girişte kurar,
  ilerlemiş yumurtayı o kuluçkanın tam süresiyle sınırlar. `Egg.hatchMinutes(days)`. Kayıt yüklemede kuluçka yumurtaları
  seviyeye göre kırpılır; `backpackLevel` çanta yumurtalarından önce okunur (6 yumurta kaybolmaz).
- Büyük çanta: `Sim.backpackLevel`, komut `buyBackpack` (`BALANCE.upgrades.backpack` 1.500 ₺, 6 yuva). Arayüz: kuluçka panelinde
  "Yükselt" satırı ve Sv2 başlığı, ilerleme çubuğu kuluçkanın süresine göre; ofiste "Büyük çanta" düğmesi.
- Testler: `tests/unit/upgrades.test.ts` (5).

## 0.14.0 — Zafer hedefi "Yılın Barınağı" (M12 ilk dilimi; Claude, 2026-09-22)
- `BALANCE.victory = { adoptions: 50, reputation: 90 }`; `Sim.victory: VictoryInfo | null` (`{ day, week }`, kayıtta,
  bozuk kayıtta null); `stepSim` dakika bloğunda `checkVictory()` (achievements.check'ten önce) → bir kez `victory` olayı +
  mesaj; oyun sürer (gameOver gibi durdurmaz). Başarım `year-shelter`.
- Arayüz: `src/ui/VictoryPanel.tsx` (olay gelince app oyunu duraklatır; "Devam et" → `store.victorySeen`, duraklatma kalkar);
  yüklenen kazanılmış oyunda panel yeniden açılmaz. `OfficePanel`'de "Hedef: Yılın Barınağı" iki çubuk (sahiplendirme, itibar)
  ve kazanıldıysa 🏆 satırı.
- Belge: `docs/PLAN.md` §7 kurtarılan M11–M14 ayrıntıları + M12 dilim tablosu; §6 zafer satırı; README Durum/Başarımlar.
- Testler: `tests/unit/victory.test.ts` (3).

## 0.13.5 — Uçtan uca dokunma senaryoları (ertelenen 0.12.5 dilimi; Claude, 2026-09-22)
- Test kancası `src/debug/touchDebug.ts`, yalnız `?debug=1` ile `window.__pati.debug`: `tapTile, longPressTile, startPinch,
  pinch, cancelTouches, stuckPointer, snapshot, runTouchScenarios`. Dokunuşlar `WorldScene.pointerInput` → TouchGestures →
  `handleGesture` yolundan geçer (yalnız Phaser DOM→Pointer çevirisi atlanır); uzun basış ve bayat parmak `now` geriye
  tarihlenerek, sim `sim.update(1/30)` ile ilerletilir. WorldScene'e public `gestureTick/resetTouches/touchPinching`.
- Sonuç (uygulama içi tarayıcı, 812×375 `?touch=1&debug=1`, 2026-09-22): **8/8 ok**

  | # | Senaryo | Sonuç |
  |---|---|---|
  | 1 | Eğit → 4 kare uzağa dokun → yürür | ✅ eğitildi, hedef kare, 3,0 kare yürüdü |
  | 2 | E düğmesine iki kez → hayalet yol yok | ✅ yol yok |
  | 3 | Pinch + dokunma iptali → sonraki dokunuş yürütür | ✅ |
  | 4 | Takılı (bayat) parmak → yeni dokunuş pinch değil, yürür | ✅ |
  | 5 | Yönetim modu: boş kare yürümez, köpeğe dokunuş seçer | ✅ |
  | 6 | Uzun basış köpeği seçer, yürümez | ✅ |
  | 7 | Köpeğin dibinde: çevre yürür, üstü sever, meşgulken "Şu an meşgul" | ✅ |
  | 8 | Otopilot açıkken dokunuş → kapanır ve yürür | ✅ |

- **Gerçek cihaz kontrol listesi** (telefonda elle, her büyük dokunma değişikliğinden sonra):
  1. Köpeğe dokun (Eğit aracı) → eğitim biter → uzak boş kareye dokun: karakter yürüyor.
  2. E düğmesine art arda iki kez bas: karakter düğmenin altına yürümüyor.
  3. İki parmakla yakınlaştır, bırak, hemen tek parmakla dokun: yürüyor; iki parmakla dokunup kaldırmak yürütmüyor.
  4. Uygulamayı arka plana al / bildirim çek, geri dön, dokun: yürüyor.
  5. Yönetim modunda sürükle: harita kayıyor; çit aracıyla sürükle: çizgi çiziliyor.
  6. Köpeğe uzun bas: köpek paneli açılıyor, karakter yürümüyor.
  7. Köpeğin dibindeyken yanındaki boş kareye dokun: yürüyor; üstüne dokun: seviyor; iş sürerken tek "Şu an meşgul".
  8. 🤖 açıkken haritaya dokun: "Otopilot kapalı" ve dokunulan yere yürüyor.
- Testler: `tests/unit/touchDebug.test.ts` (3: `?debug` ayrıştırma, özet, boş kare seçici) → 268 test.

## 0.13.4 — Dokunma jestleri saf modülde (ertelenen 0.12.4 dilimi; Claude, 2026-09-22)
- Yeni `src/scenes/TouchGestures.ts` (Phaser'sız): `down/move/up/update/reset` → `press, drag, longPress, release, pinchStart,
  pinch, pinchEnd, cancel`. 0.12.1'in yamaları (`uiPointers`, `pointerSeen`, `activeTouches`, pinch emniyeti, uzun basış
  sayacı) buraya taşındı; `WorldScene` yalnız `pointerInput(kind, p)` → `handleGesture` ile uygular (kamera, dokun-git,
  seçim, inşa). `pointerInput` public: 0.13.5 test kancası aynı yoldan besleyecek.
- Bilinçli küçük farklar: ikinci parmak inince pinch hemen başlar (eskiden ilk harekette) → iki parmakla dokunuş artık
  yürüme üretmez; tap eşiği basış noktasından toplam kaymayla ölçülür (eskiden hareket başına; yavaş sürükleme tap sayılıyordu);
  uzun basış `update()` ile (Phaser `delayedCall` yerine). Eşikler `BALANCE.touch.tapSlopPx/mouseSlopPx/longPressMs`.
- Testler: `tests/unit/touchGestures.test.ts` (12).

## 0.13.3 — Otopilot cilası (Claude, 2026-09-22)
- Durum satırı: `Job.text` + `Autopilot.statusText()` → `Sim.autopilotText`; `store.ts hintFor` otopilot açıkken bunu gösterir
  ("🤖 Yem kabını dolduruyor", "🤖 Susam'ı eğitiyor", "🤖 Ofise uyumaya gidiyor", iş yoksa "🤖 Otopilot: iş bekliyor").
- Menü → Otopilot (T) (`menu.ts` `{kind:'autopilot'}`, `BottomNav`), HelpSheet ROWS (T) ve TOUCH_ROWS (🤖 düğmesi), README:
  Kontroller satırı, Dokunmatik maddesi, yeni "Otopilot" bölümü, Durum listesi; `docs/PLAN.md` §4 0.12.x ve 0.13.x kayıtları.
- `tests/unit/dogs.test.ts` "Headless koşu": hile eden bot yerine otopilotla 3 gün (speed 4, 0,1 sn adım; gece uykusu saati
  sarar) → sağlık > 50, para > 0, fed > 3, en az 2 uyku. i18n: 18 yeni anahtar.
- Bu koşunun ortaya çıkardığı hata: `PlayerNav.inputFor` kare başına adım `nav.arriveDist`in iki katını aşınca (0,1 sn adım ya da
  koşu) düğüm çevresinde sonsuz salınıyordu (hareket var, ilerleme yok → takılma mantığı tetiklenmiyor). Düzeltme: `nodeDist` —
  hareket ettiği hâlde düğüme yaklaşamıyorsa düğüm geçilmiş sayılır. Oyunda 30 fps altı cihazlarda da koruma sağlar.
- Otopilot dilimleri (0.13.0–0.13.3) tamam. Sırada: ertelenen 0.12.4/0.12.5 ya da M11+ (kullanıcı kararı).

## 0.13.2 — Otopilot 3: yumurta, böğürtlen, uyku, koşu (Claude, 2026-09-22)
- Tahta boşken sıra: **uyku** (saat ≥ `time.sleepFromHour` 20 ya da < `nightEndHour` 6, tahtada sahipsiz yem/su işi yoksa →
  ofis kapısı → `command sleep`) → **kuluçka** (çantada yumurta + boş yuvalı hazır kuluçka → kapıya git → sığan her yumurta
  `placeEgg`) → **yuva** (çanta dolu değilse keşfedilmiş `Obj.NestEggs`, `autopilot.nestRadius` 40 → `pickEgg`) → **çalı**
  (ödül maması < `eggs.treatsMax`, keşfedilmiş `Obj.BerryBush`, `bushRadius` 25 → `berries`) → sevme.
- Kapı hedefleri `goTo` (kare) + `Plan.onArrive` ile yürür (E yerine; kuluçka/ofis paneli açılmaz); `atDoor` (≤2 kare)
  yol kesilmişse eylemi engeller. Başarısız iş anahtarı (`sleep`, `egg:id`, `nest:idx`, `bush:idx`) 30 sn kara listede.
- Koşu: `Autopilot.run()` histerezisli (`runAboveStamina` 60 üstünde ve kalan yol > `runMinTiles` 6 → başlar; `runStopStamina`
  40 altında biter); `Sim.update` nav girdisine `input.run || pilot.run()` verir. i18n: yeni anahtar yok.
- Testler: autopilot.test.ts +5 → 253 test. Sonraki 0.13.3: durum metni, yardım/README, 3 günlük başsız koşu.

## 0.13.1 — Otopilot 2: köpek işleri (Claude, 2026-09-22)
- `Autopilot` görev türleri += **play / train / groom / treat**; iş yoksa **pet** (bugün sevilmemiş, uyanık, en düşük
  sadakatli barınak köpeği; `petsToday` sayesinde günde bir kez). İş = `{ goal, tool? }`: varıştan önce `setTool`
  (play/train/clean/pet) — E'nin yapacağı iş araca bağlı (`resolveAction`), araç varışta korunur.
- Uygunluk (`planFor`): uyuyan ya da `playMinEnergy/trainMinEnergy` altındaki köpek, öğreneceği beceri kalmayan köpek,
  klinik olmayan/parasız tedavi → görev **atlanır, kara listeye girmez** (personel alabilir). `groom`: köpek hazır tımar
  istasyonunun `stationRadius` içindeyse istasyona gidip yıkar, yoksa fırçalar; `treat`: yalnız köpek hazır kliniğin
  yakınındayken (klinik yakınında olmayan köpek 0.13.2+ için aday: "köpeği çağır/kliniğe götür" yok).
  `nearestDogToBuilding` dışa açıldı (Interaction.ts).
- Testler: autopilot.test.ts +7 (oyna, eğit, bitkin köpek atlanır, fırçala, istasyonda yıka, klinikli/kliniksiz tedavi,
  boşta sev) → 248 test.

## 0.13.0 — Otopilot 1: altyapı + bakım (Claude, 2026-09-22)
- 0.12.4 (TouchGestures) ve 0.12.5 (uçtan uca senaryolar) kullanıcı kararıyla ertelendi; otopilot öne alındı.
- `src/sim/systems/Autopilot.ts`: `Sim.autopilot` açıkken, avatar boştayken (`busy===0`, nav yok) görev tahtasından
  **feed/water/clean** seçer (puan `urgency/(1+dist/20)`), `tasks.claim(task, PILOT_ID=-1)`, `nav.goInteract` (kap/yalak →
  building, pislik → object); `interacted` sonucu ok → `tasks.remove`, değilse `release` + anahtar
  `BALANCE.autopilot.failCooldownSec` (30 sn) kara liste. Kiler boş + kap yarıdan az + para varsa `orderFood 1` ve 10 sn bekler.
- `Sim`: `setAutopilot(on)` (açılınca avatar moduna geçer; kapanınca görev bırakılır, nav durur), komut `setAutopilot`;
  elle WASD, `goTo/goInteract/interact/cancelNav` komutları kapatır; yönetim moduna geçiş görevi cezasız bırakır (bayrak
  açık kalır). Kayıt: `autopilot` alanı (sürüm artmadı). Personel aynı tahtayı kullanır; `-1` sahipli görev personele gitmez.
- Arayüz asgari: TopBar 🤖 düğmesi (telefonda yalnız simge), klavye **T**, `store.autopilot`, açılış/kapanış toast'u.
  Durum metni/yardım/README 0.13.3'te. Testler: `tests/unit/autopilot.test.ts` (10).

## 0.12.3 — Yakın köpek yeniden hedefleme ve sessiz retler (Claude, 2026-09-19)
- `src/scenes/tapTarget.ts` `pickTapDog` (saf, testli): dokunuş köpeğin üstündeyse (`BALANCE.touch.dogDirectTiles` 0,5) her
  zaman köpeğe gider; çevresindeyse (`dogSnapTiles` 1,1) yalnız oyuncu köpekten `nav.reachDist`'ten uzaksa kilitlenir.
  Oyuncu köpeğin dibindeyken çevre dokunuşu artık yürüyüş: eğitilen/oturan köpeğin yanından ayrılamama ve her dokunuşta
  işin yinelenmesi kapandı. `WorldScene.touchTap` bunu kullanır; `selectDogAt` (uzun basış/fare) değişmedi.
- `PlayerNav.arrive`: oyuncu meşgulken hedefin dibinde yeniden dokunuş `performAction`'ı sessizce düşürüyordu → artık
  `message` "Şu an meşgul" (iş yinelenmez, `interacted` yayılmaz). `showToast` ekrandaki aynı metni yinelemez.
- `Sim.command goTo/goInteract` yönetim modunda `message` döndürür ("Yürümek için Avatar moduna geç"); dokunuşlar yönetim
  modunda zaten bu komutu çağırmadığı için toast yok, yalnız çağıranlara (ileride otopilot/test) neden bildirilir.

## 0.12.2 — Yumurta kuluçka süresi korunur (Claude, 2026-09-18)
- Hata (kullanıcı): kuluçkadan yanlışlıkla "Al" ile alınan yumurta geri konunca süre yeniden 3 güne çıkıyordu.
- Kural: `Egg.hatchLeft` = kalan kuluçka dakikası, `-1` = hiç girmemiş; çantadayken sayaç durur, silinmez.
  `placeEgg` süreyi yalnız `hatchLeft < 0` iken kurar; `takeEgg`, kuluçka yıkımı (`Sim.removeBuilding`) ve kayıt yükleme
  artık sıfırlamıyor; `eggFromJSON` süreyi `hatchMinutes()` ile sınırlar. Kuluçka panelinde çantadaki yumurtanın kalan günü görünür.
- Planlanan tanı katmanı (`?debug=1`, tanı kaydı) **iptal**: kullanıcı 0.12.1'in telefondaki takılmayı çözdüğünü doğruladı.
  0.12.5 senaryoları için gereken kanca o sürümde eklenecek.

## 0.12.1 — Acil dokunma düzeltmesi (Claude, 2026-09-18)
- Rapor: telefonda köpeği eğittikten sonra hiçbir dokunuş karakteri yürütmüyor, oyun kapatılana kadar kalıcı.
- `WorldScene`: #ui üstünde başlayan işaretçiler dünya girdisi sayılmıyor (`src/ui/uiTarget.ts`; Phaser pencere düzeyinde
  dokunma/fare dinlediği için E, araç ve menü düğmeleri `touchTap`/`selectDogAt` tetikliyordu); `pinch` artık
  `activeTouches() < 2` olunca her karede ve her pointerdown'da bırakılıyor (kaçan touchend/touchcancel tüm dokunuşları
  yutuyordu); bayat "basılı" işaretçi (3 sn olaysız, `BALANCE.touch.stalePointerMs`) pinch saymıyor; `pointerupoutside`,
  `touchcancel`, pencere `blur` ve sekme gizlenince dokunma durumu sıfırlanıyor (son ikisi Phaser işaretçilerini de bırakır).
- `src/ui/keyboard.ts`: yalnız metin girişi odağı oyun tuşlarını kapatır; düğme/bağlantı tıklamadan sonra, seçim kutusu
  değer değişince `blur()`; `focusin`'de yürüyüş iptali kaldırıldı → masaüstünde HUD düğmesine basınca klavyenin ölmesi de kapandı.
- Cihazda doğrulanacak: eğit → uzağa dokun; E'ye art arda bas; iki parmakla yakınlaştırıp bırak → tek dokunuş yürütüyor mu.

## Claude incelemesi — 2026-09-16 (açık sorunlar)
- ~~Klavye ayrımı fazla geniş (HUD düğmesi odağı WASD/Esc/kısayolları öldürüyordu)~~ → 0.12.1'de düzeltildi.
- `Sim.update` içinde `gates.update` bir karede üç kez çağrılıyor (stepSim başı, stepSim sonu, update sonu); biri yeterli.
- `portraitBlocked` `h > w` derken CSS `orientation: portrait` `h >= w` kabul eder; kare pencerede ekran "çevir" der, sim durmaz (önemsiz).
