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
| I / O / N | Köpek listesi / Sahiplendirme masası / Finans | Aynı |
| B | İnşa çubuğu (yönetim moduna geçer) | İnşa çubuğu |
| X / Z | – | Yık aracı / Bölge boyama |
| Tab | Yönetim moduna geç | Avatara dön |
| Space | Duraklat / devam | Duraklat / devam |
| + / - | Hız artır / azalt | Hız artır / azalt |
| Fare tekeri | Yakınlaştır | Yakınlaştır |
| Sol tık sürükle | – | Kamerayı kaydır (araç seçiliyse çit/yol çizgisi ya da bölge dikdörtgeni) |
| Sağ tık sürükle | – | Kamerayı kaydır (her zaman) |
| Esc | Paneli kapat / menü | Aracı bırak / paneli kapat / menü |

Alt çubuk her an E ile ne yapacağını yazar. Sağ üstteki uyarılara tıklayınca ilgili köpeğe gidersin.

## Köpek bakımı

- Köpeklerin ihtiyaçları: tokluk, keyif, rahatlık (tuvalet), temizlik, sağlık, sadakat, enerji.
- Yem kabını kilerden doldur (kabın önünde E). Köpekler acıkınca dolu kaba kendileri gider. Kiler bitince kilerin önünde E ile çuval sipariş et.
- Tuvalet eğitimi olmayan köpek olduğu yere yapar; pisliği fırça ile temizle. Eğitimli köpek tuvalet alanına gider.
- Sevmek sadakati, oynamak keyfi, fırçalamak temizliği artırır. Eğitim aracıyla köpek panelinden seçtiğin beceriyi çalıştırırsın.
- Gece köpekler kulübelerinde uyur; kulübesi olmayan köpek dışarıda kötü uyur.

## İnşa

- Yönetim modunda B ile inşa çubuğu açılır: kategori → bina. Hayalet yeşilse yerleşir, kırmızıysa sığmıyor ya da para yetmiyor.
- Çit ve yol sürükleyerek düz çizgi halinde çekilir; kapı çitin üstüne konur. Bölgeler (tuvalet, oyun bahçesi, eğitim, karantina, personel) dikdörtgen sürükleyerek boyanır.
- Büyük binalar inşaat süresi boyunca yarı saydamdır ve kullanılamaz. Yıkım bedelin yarısını iade eder.
- Arsa sekmesinden doğuya/güneye 16 kare genişletilir (2.500 ₺); alan temizlenir, çit ve yol kapıları yeniden kurulur.
- Tımar istasyonu yakındaki köpeği yıkar, veteriner odası tedavi eder, mutfak kapların kapasitesini ikiye katlar, oyuncaklar köpeklerin kendi kendine oynamasını sağlar.

## Yumurtalar ve keşif

- Dünyadaki yuvalarda (mini haritada sarı nokta) yumurta bulunur; önünde E ile çantaya alınır (3 yuva). Yuva birkaç günde yeniden dolar.
- Yumurtanın boyu köpeğin boyutunu, şekli gövde tipini, rengi ve deseni tüyünü belirler; huy ve zekâ sadece ipucu olarak sezilir.
- Kuluçkanın önünde E: yumurtayı yerleştir, 3 günde yavru doğar. Yavru 4 haftada genç, 12 haftada yetişkin olur.
- Uzaktaki inlerde (turuncu nokta) sokak köpekleri yaşar. Böğürtlen çalısından ödül maması topla, köpeğe 3 kez ver; peşine takılır, barınağa girince katılır.
- Gece 20:00'den sonra ofisin önünde E ile sabaha kadar uyursun. Dışarıda 02:00'ye kadar kalırsan bayılıp ofiste uyanırsın.

## Ekonomi ve sahiplendirme

- Sahiplenici 10:00-16:00 arasında kapıdan gelir, ofisin önünde yaklaşık 2,5 saat bekler. O tuşu ya da ofiste E ile masayı aç; istek kartına göre en uygun köpeği puanla gör ve sahiplendir. Zayıf eşleşme (puan < 50) itibar düşürür, köpek geri gelebilir.
- Köpek sahiplendirilebilmek için sağlıklı, temiz ve sana güvenir olmalı (sadakat 30+).
- Her Pazartesi 06:00 hafta raporu: denetim (temizlik, sağlık, keyif, pislik, kulübe, yem) yardım çarpanını (0,4-1,5) belirler; köpek başına 150 ₺ × çarpan devlet yardımı yatar, bina bakım gideri düşer.
- Lisans seviyesi yardım alınan köpek sayısını sınırlar (8/20/45); ofisten yükseltilir. Finans (N) kasa hareketlerini ve geçmiş haftaları gösterir.

## Durum

- [x] M0 İskelet: dünya üretimi, avatar, kamera, gün/gece, HUD, hız, mini harita, kayıt
- [x] M1 Köpekler ve ihtiyaçlar: genom ve modüler sprite, ihtiyaçlar, davranış, başlangıç barınağı, bakım araçları, köpek paneli/listesi, uyarılar
- [x] M2 İnşa: inşa çubuğu, hayalet önizleme, çit/kapı/yol, bölgeler, yıkım, inşaat süresi, arsa genişletme, yeni binalar
- [x] M3 Yumurta ve büyüme: yuvalar, yumurta genetiği ve ipuçları, kuluçka, haftalık büyüme, sokak köpekleri ve evcilleştirme, keşif sisi, uyku/bayılma
- [x] M4 Ekonomi ve sahiplendirme: sahiplenici akışı ve eşleşme, itibar, geri dönüş, defter, haftalık denetim ve yardım, bakım gideri, lisans, finans ve rapor ekranları
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
