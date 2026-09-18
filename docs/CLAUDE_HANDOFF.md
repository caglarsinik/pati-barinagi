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
