# Pati Barınağı

2D köpek barınağı yönetim + açık dünya keşif oyunu. Yumurtaları bul, kuluçkada çıkar, köpekleri büyüt,
bakımlarını yap, barınağa gelen insanlara sahiplendir. Tüm grafikler ve sesler kod içinde üretilir;
dışarıdan hiçbir resim ya da ses dosyası kullanılmaz.

Tasarım dokümanı ve kilometre taşları: `docs/PLAN.md`

## Çalıştırma

- `run.bat` dosyasına çift tıkla. İlk seferde bağımlılıklar kurulur (Node.js gerekir), sonra tarayıcı açılır.
- Elle: `npm install` ve `npm run dev`
- Tek dosya sürüm: `build.bat` → `dist/index.html` (çift tıkla açılır, internet gerekmez)

## Kontroller

| Tuş | Avatar modu | Yönetim modu |
|---|---|---|
| WASD / ok tuşları | Yürü | Kamerayı kaydır |
| Shift | Koş (dayanıklılık harcar) | – |
| E | Baktığın şeye göre iş yap: köpeği sev/oyna/eğit/fırçala, yem kabını doldur, pisliği temizle, kileri aç | – |
| 1-5 | Araç seç: Sev, Oyna, Eğit, Yem, Temizle | – |
| Sol tık | Köpeği seç (panel açılır) | Köpeği seç |
| I | Köpek listesi | Köpek listesi |
| Tab | Yönetim moduna geç | Avatara dön |
| Space | Duraklat / devam | Duraklat / devam |
| + / - | Hız artır / azalt | Hız artır / azalt |
| Fare tekeri | Yakınlaştır | Yakınlaştır |
| Sol tık sürükle | – | Kamerayı kaydır |
| Esc | Paneli kapat / menü | Paneli kapat / menü |

Alt çubuk her an E ile ne yapacağını yazar. Sağ üstteki uyarılara tıklayınca ilgili köpeğe gidersin.

## Köpek bakımı

- Köpeklerin ihtiyaçları: tokluk, keyif, rahatlık (tuvalet), temizlik, sağlık, sadakat, enerji.
- Yem kabını kilerden doldur (kabın önünde E). Köpekler acıkınca dolu kaba kendileri gider. Kiler bitince kilerin önünde E ile çuval sipariş et.
- Tuvalet eğitimi olmayan köpek olduğu yere yapar; pisliği fırça ile temizle. Eğitimli köpek tuvalet alanına gider.
- Sevmek sadakati, oynamak keyfi, fırçalamak temizliği artırır. Eğitim aracıyla köpek panelinden seçtiğin beceriyi çalıştırırsın.
- Gece köpekler kulübelerinde uyur; kulübesi olmayan köpek dışarıda kötü uyur.

## Durum

- [x] M0 İskelet: dünya üretimi, avatar, kamera, gün/gece, HUD, hız, mini harita, kayıt
- [x] M1 Köpekler ve ihtiyaçlar: genom ve modüler sprite, ihtiyaçlar, davranış, başlangıç barınağı, bakım araçları, köpek paneli/listesi, uyarılar
- [ ] M2 İnşa
- [ ] M3 Yumurta ve büyüme
- [ ] M4 Ekonomi ve sahiplendirme
- [ ] M5 Personel ve görevlendirme
- [ ] M6 Ses ve cila

## Geliştirme

```bat
npm test          # birim testleri (vitest)
npm run typecheck # tsc --noEmit
npm run build     # dist/index.html
```

Kod yapısı:

```
src/config/     denge sayıları ve sabitler
src/core/       Rng, EventBus, Clock, SaveManager
src/sim/        Phaser'dan bağımsız oyun mantığı (dünya, varlıklar, sistemler)
src/render/     kodla üretilen pixel-art ve doku kaydı
src/scenes/     Phaser sahneleri (çizim ve girdi)
src/ui/         Preact arayüzü (HUD, menüler, paneller)
tests/          vitest testleri
```

Kayıt tarayıcının `localStorage` alanında tutulur; her sabah 06:00'da ve menüden çıkarken otomatik kaydedilir.
