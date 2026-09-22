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
