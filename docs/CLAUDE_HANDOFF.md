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
