# Philly Philly — phillyphilly.co.uk

Statik, çok sayfalı pazarlama sitesi. Bağımlılığı yok (görsel işleme dışında),
build adımı 15 satırlık bir Node script'i. UKNode VPS'te nginx ile yayınlanır;
`main`'e her push birkaç dakika içinde otomatik yayına girer.

---

## Klasör yapısı

```
src/
  data/site.json        Telefon, e-posta, bölgeler, form anahtarı — tek doğruluk kaynağı
  layouts/base.html     Header, footer, meta etiketleri, çerez banner'ı (tüm sayfalar bunu kullanır)
  pages/*.html          Her dosya = bir sayfa. Başındaki <!--meta ... meta--> bloğu SEO bilgisi.
assets/
  css/style.css         Tek stylesheet
  js/main.js            Menü, takvim, galeri, form, çerez onayı
  img/                  npm run images ile ÜRETİLEN görseller (elle düzenleme)
img/                    ORİJİNAL görseller (kaynak — bunlara dokunulmaz)
data/
  events.json           Statik yedek takvim (API yoksa bu okunur)
  gallery-captions.json Foto açıklamaları (alt text + görsel SEO)
functions/              Eski Cloudflare admin API'si — UKNode'da çalışmaz
deploy/                 Sunucu kurulum script'i + nginx ayarı (yönlendirmeler, başlıklar)
.github/workflows/      main'e her push'ta build alıp deploy dalına yazar
scripts/                build / görsel optimizasyon / lokal sunucu
dist/                   BUILD ÇIKTISI — git'e girmez, elle düzenlenmez
_legacy/                Eski tek sayfalık site (referans için duruyor, silinebilir)
```

---

## Günlük işler

### Lokalde çalıştır

```bash
npm run dev
```

`http://localhost:3000` açılır. Sayfa değiştirdikten sonra `npm run build` çalıştırıp
tarayıcıyı yenile.

### Yeni fotoğraf ekle

1. Fotoğrafı `img/gallery/` içine at (boyut önemli değil, orijinal olsun).
2. `npm run images` — WebP thumbnail + full sürüm üretir.
3. İstersen `data/gallery-captions.json` içine açıklama ekle (dosya adı uzantısız, küçük harf).
4. `npm run build` → deploy.

### Menü / metin değiştir

`src/pages/` içindeki ilgili dosyayı düzenle, `npm run build` çalıştır.
Telefon, e-posta gibi her yerde geçen bilgiler için `src/data/site.json` yeterli —
tek yerde değiştirirsin, 15 sayfaya birden yansır.

### Etkinlik takvimi

`data/events.json` dosyasını düzenle, push et — birkaç dakika içinde yayında.

---

## Deploy — UKNode VPS (nginx)

`main`'e push → GitHub Actions build alır ve `dist/`'i `deploy` dalına yazar →
sunucu bu dalı 2 dakikada bir çeker. GitHub'da sunucu şifresi/anahtarı tutulmaz;
sunucuya kaynak kod değil, sadece build çıktısı gider.

**Tek seferlik kurulum** (sunucuda, root olarak):

```bash
curl -fsSL https://raw.githubusercontent.com/Atovski/PhillyPhilly/main/deploy/server-setup.sh | sudo bash
```

Script nginx sitesini (`deploy/nginx.conf`) kurar, Let's Encrypt sertifikası alır
ve tekrar çalıştırılabilir. DNS (Wix): `@` için A kaydı → `212.100.173.74`,
`www` için CNAME → `phillyphilly.co.uk`.

**Takvim:** Google Takvim'den okunur. nginx, takvimin herkese açık iCal adresini
`/api/calendar.ics` olarak sunar (`deploy/nginx.conf`, 5 dk önbellek). Etkinlik adı =
yer, Konum = adres (Maps linki olur), açıklamadaki link varsa o kullanılır. Adda
"festival", "private", "closed" geçerse türü ona göre gösterilir. Haftalık tekrarlar,
tek seferlik iptal/taşımalar ve çok günlü etkinlikler desteklenir. Takvim ID'si
değişirse nginx.conf'ta güncellenip sunucuda `server-setup.sh` yeniden çalıştırılır.
Feed alınamazsa site `data/events.json` dosyasına düşer.

---

## Yayına almadan önce doldurulacaklar

Kodda `TODO-CLIENT` diye aratınca hepsi çıkar. Kritik olanlar:

| Konu | Nerede | Neden |
|---|---|---|
| **Alerjen tablosu** | `src/pages/menu.html` | **Yasal.** Vegan Philly ve New Orleans Loaded Fries satırları "ekibe sorun" diyor; Seasoned Chips satırı eski "Chips" verisi — tarifle doğrulanmalı |
| Şirket no / adres / VAT | `src/layouts/base.html` footer | Ltd ise Companies Act 2006 gereği zorunlu |
| Sigorta tutarı | `weddings.html`, `about.html`, ana sayfa trust bar | Venue ve organizatörlerin ilk sorduğu şey (FHRS 5 eklendi) |
| Fiyat / paket | `weddings.html`, `faq.html` | "£X'ten başlayan" yazan sayfa belirgin şekilde daha çok dönüşür |
| Gerçek müşteri yorumları | ana sayfa (hazır blok yorum satırında) | Uydurma yorum ASA/CAP kurallarına aykırı — sadece gerçekleri koy |
| GTM container ID (GA4 + Meta Pixel + Google Ads bunun içinde kurulur) | `src/layouts/base.html` (head + body, yorum satırında hazır) | Reklamdan önce şart |

---

## Yapılmış olanlar

- Ana sayfa **41,6 MB → 0,48 MB** (86×). Galeri sayfası 192 MB → ilk yüklemede 0,3 MB.
- 14 indekslenebilir sayfa, her birinde benzersiz title/description/canonical,
  Open Graph görseli, schema.org yapılandırılmış verisi.
- `sitemap.xml` + `robots.txt` otomatik üretiliyor.
- Google Consent Mode v2 + çerez banner'ı (reklam açılmadan önce yasal zorunluluk).
- Telefon, e-posta, WhatsApp ve form gönderimi `dataLayer` olayı olarak izleniyor —
  Google Ads dönüşümü olarak tanımlanmaya hazır.
- Eski API'lerdeki yetkisiz yazma/silme açığı ve dizin dışına çıkma (path traversal)
  zafiyeti kapatıldı; admin şifresi artık kodda değil, ortam değişkeninde.
