# Claude aktar?m notlar?

## 0.10.1 ? Kap? ge?i?leri
- Her NPC/k?pek yol ad?m?nda kap? a??k kontrol? eklendi.
- Kap?lar uyku sim?lasyonunda da g?ncelleniyor; iflas sonras? uyku d?ng?s? duruyor.
- Yeni gate-crossing regresyon testleri eklendi. Do?rulama sonu?lar? son b?l?mde kaydedilecek.
- Bu dosya ortak proje ?zerinden aktar?m i?indir; Claude servisine do?rudan mesaj g?nderilmedi.

## Telefon y?n?
- Dikey uyar? boyunca sim?lasyon durur; yataya d?n?? ?nceki h?z? korur.
- Elle duraklatma, a??k rapor/men? ve iflas yeniden ba?lat?lmaz.
- orientation.test.ts zaman?n ger?ekten durdu?unu ve h?z geri y?klemesini kontrol eder.

## Klavye
- UI keydown/keyup olaylar? varsay?lan taray?c? davran??? korunarak Phaser pencere dinleyicisinden ayr?ld?.
- Odak de?i?iminde bas?l? tu?lar ve dokun-git temizleniyor. Oyun tuvaline dokunmak oda?? oyuna geri verir.
- keyboard.test.ts olaylar?n engellenmedi?ini ve dinleyici temizli?ini kontrol eder.
