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

## Claude incelemesi — 2026-09-16 (açık sorunlar)
- Klavye ayrımı fazla geniş: `isUiKeyboardTarget` seçicisi `#ui button` ve `#ui a`'yı da kapsıyor. Herhangi bir HUD
  düğmesine tıklandığında odak düğmede kalıyor; tuvale tıklanana kadar WASD, Esc ve kısayollar çalışmıyor. Düzeltme bekliyor
  (öneri: tıklama sonrası metin girişi olmayan öğeleri `blur()` etmek, seçiciyi input/textarea/select/contenteditable ile sınırlamak).
- `Sim.update` içinde `gates.update` bir karede üç kez çağrılıyor (stepSim başı, stepSim sonu, update sonu); biri yeterli.
- `portraitBlocked` `h > w` derken CSS `orientation: portrait` `h >= w` kabul eder; kare pencerede ekran "çevir" der, sim durmaz (önemsiz).
