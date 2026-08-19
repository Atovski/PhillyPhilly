# Philly Philly — phillyphilly.co.uk

Statik, çok sayfalı pazarlama sitesi. Bağımlılığı yok (görsel işleme dışında),
build adımı 15 satırlık bir Node script'i. Cloudflare Pages'e deploy edilir.

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
functions/              Cloudflare Pages Functions — admin API
public/                 _headers ve _redirects (site köküne kopyalanır)
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

Site sahibi `/admin/` adresinden şifreyle girip tarih ekler/siler. Kod veya deploy
gerekmez, değişiklik anında yayına girer.

---

## Deploy — Cloudflare Pages (ücretsiz)

**Tek seferlik kurulum:**

1. Projeyi bir GitHub reposuna push et.
2. Cloudflare Dashboard → Workers & Pages → **Create** → **Pages** → **Connect to Git** → repoyu seç.
3. Build ayarları:
   - Build command: `npm run build`
   - Build output directory: `dist`
4. **Settings → Environment variables** (ikisini de *Secret* olarak ekle):
   - `ADMIN_PASSWORD` — `/admin/` girişi için şifre
   - `AUTH_SECRET` — uzun rastgele bir metin (parola üretici ile üret)
5. **Settings → Bindings → KV namespace**: yeni bir namespace oluştur,
   değişken adı **`EVENTS`** olacak şekilde bağla.
   (Bu adım atlanırsa site yine çalışır; sadece `/admin/` devre dışı kalır ve
   takvim `data/events.json` dosyasından okunur.)
6. **Custom domains** → `phillyphilly.co.uk` ve `www.phillyphilly.co.uk` ekle.

Sonrası otomatik: her `git push` yeni sürümü yayına alır.

---

## Yayına almadan önce doldurulacaklar

Kodda `TODO-CLIENT` diye aratınca hepsi çıkar. Kritik olanlar:

| Konu | Nerede | Neden |
|---|---|---|
| **Alerjen tablosu** | `src/pages/menu.html` | **Yasal.** UK gıda mevzuatı 14 alerjen için doğru bilgi vermeyi zorunlu kılar. Tahminle doldurulamaz. |
| Şirket no / adres / VAT | `src/layouts/base.html` footer | Ltd ise Companies Act 2006 gereği zorunlu |
| Sigorta + FHRS puanı | `weddings.html`, `about.html`, ana sayfa trust bar | Venue ve organizatörlerin ilk sorduğu şey; dönüşümü doğrudan artırır |
| Fiyat / paket | `weddings.html`, `faq.html` | "£X'ten başlayan" yazan sayfa belirgin şekilde daha çok dönüşür |
| Chicken wrap fotoğrafı | `img/menu-6.svg` | Şu an cheesesteak wrap ile aynı fotoğraf |
| Gerçek müşteri yorumları | ana sayfa (hazır blok yorum satırında) | Uydurma yorum ASA/CAP kurallarına aykırı — sadece gerçekleri koy |
| Formspree/Web3Forms anahtarı | `src/data/site.json` → `formAccessKey` | Bu olmadan teklif formu çalışmaz |
| GA4 / Google Ads etiketi | `src/layouts/base.html` (yorum satırında hazır) | Reklamdan önce şart |
| Organiser Pack PDF | `festivals-organisers.html` | Tek tıkla indirilen belge paketi ciddi fark yaratıyor |

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
