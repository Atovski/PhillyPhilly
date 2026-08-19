/**
 * Philly Philly - Image optimisation pipeline
 *
 * Reads the original (huge) source images and writes web-ready derivatives into
 * assets/img/. Originals are never modified. Run with: npm run images
 *
 *   img/gallery/*.jpg  ->  assets/img/gallery/thumb/<slug>.webp   (600px  q70)
 *                          assets/img/gallery/full/<slug>.webp    (1600px q78)
 *   img/menu-*.svg     ->  assets/img/menu/<slug>.webp            (800px  q72)
 *   img/hero-banner.jpg->  assets/img/hero/hero-{1920,1280}.webp
 *   mobile-hero-banner ->  assets/img/hero/hero-mobile-900.webp
 *   img/*-logo.png     ->  assets/img/logo.webp + logo.png (optimised)
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'assets', 'img');

const ensure = (dir) => fs.mkdirSync(dir, { recursive: true });
const kb = (p) => (fs.statSync(p).size / 1024).toFixed(0);

let savedFrom = 0;
let savedTo = 0;

async function emit(src, dest, width, quality, opts = {}) {
  ensure(path.dirname(dest));
  const pipeline = sharp(src, { density: 200 })
    .rotate()
    .resize({ width, withoutEnlargement: true, fit: 'inside' });

  if (dest.endsWith('.webp')) await pipeline.webp({ quality, effort: 5 }).toFile(dest);
  else if (dest.endsWith('.png')) await pipeline.png({ compressionLevel: 9, palette: true }).toFile(dest);
  else await pipeline.jpeg({ quality, mozjpeg: true }).toFile(dest);

  if (!opts.quiet) {
    console.log(`  ${path.basename(src)} ${kb(src)}KB -> ${path.relative(ROOT, dest)} ${kb(dest)}KB`);
  }
  savedFrom += fs.statSync(src).size;
  savedTo += fs.statSync(dest).size;
}

async function main() {
  // ---- Gallery -----------------------------------------------------------
  const galleryDir = path.join(ROOT, 'img', 'gallery');
  const photos = fs.existsSync(galleryDir)
    ? fs.readdirSync(galleryDir).filter((f) => /\.(jpe?g|png)$/i.test(f))
    : [];

  console.log(`\nGallery (${photos.length} photos)`);
  for (const file of photos) {
    const slug = path.parse(file).name.toLowerCase();
    const src = path.join(galleryDir, file);
    await emit(src, path.join(OUT, 'gallery', 'thumb', `${slug}.webp`), 600, 70, { quiet: true });
    await emit(src, path.join(OUT, 'gallery', 'full', `${slug}.webp`), 1600, 78, { quiet: true });
  }
  console.log(`  done -> assets/img/gallery/{thumb,full}`);

  // ---- Menu (SVG wrappers around raster photos) --------------------------
  console.log('\nMenu');
  const menuFiles = fs.readdirSync(path.join(ROOT, 'img')).filter((f) => /^menu-\d+\.svg$/i.test(f));
  for (const file of menuFiles) {
    const slug = path.parse(file).name.toLowerCase();
    await emit(path.join(ROOT, 'img', file), path.join(OUT, 'menu', `${slug}.webp`), 800, 72);
  }

  // ---- Hero --------------------------------------------------------------
  console.log('\nHero');
  const hero = path.join(ROOT, 'img', 'hero-banner.jpg');
  if (fs.existsSync(hero)) {
    await emit(hero, path.join(OUT, 'hero', 'hero-1920.webp'), 1920, 74);
    await emit(hero, path.join(OUT, 'hero', 'hero-1280.webp'), 1280, 74);
  }
  const mobileHero = path.join(ROOT, 'mobile-hero-banner.jpg');
  if (fs.existsSync(mobileHero)) {
    await emit(mobileHero, path.join(OUT, 'hero', 'hero-mobile-900.webp'), 900, 72);
  }

  // ---- Social share image (Open Graph / WhatsApp preview) ----------------
  if (fs.existsSync(hero)) {
    ensure(OUT);
    const og = path.join(OUT, 'og-default.jpg');
    await sharp(hero)
      .resize({ width: 1200, height: 630, fit: 'cover', position: 'attention' })
      .jpeg({ quality: 80, mozjpeg: true })
      .toFile(og);
    console.log(`\nSocial\n  og-default.jpg ${kb(og)}KB`);
  }

  // ---- Logo --------------------------------------------------------------
  console.log('\nLogo');
  const logo = path.join(ROOT, 'img', 'philly-philly-logo.png');
  if (fs.existsSync(logo)) {
    await emit(logo, path.join(OUT, 'logo.webp'), 400, 88);
    ensure(OUT);
    await sharp(logo).resize({ width: 400, withoutEnlargement: true })
      .png({ compressionLevel: 9 }).toFile(path.join(OUT, 'logo.png'));
    console.log(`  fallback -> assets/img/logo.png ${kb(path.join(OUT, 'logo.png'))}KB`);
  }

  console.log(
    `\nTotal: ${(savedFrom / 1048576).toFixed(1)} MB source -> ${(savedTo / 1048576).toFixed(1)} MB output`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
