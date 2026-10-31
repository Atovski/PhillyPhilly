/**
 * Philly Philly - static site build
 *
 * src/pages/**.html  +  src/layouts/base.html  ->  dist/
 *
 * Each page starts with a JSON front-matter block:
 *
 *   <!--meta
 *   { "url": "/weddings/", "title": "...", "description": "...", "nav": "weddings" }
 *   meta-->
 *
 * The layout is a plain HTML file with {{token}} placeholders. Nothing clever,
 * nothing to learn: edit the layout once, every page picks it up.
 *
 * Also emits sitemap.xml and robots.txt from the page list.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');

const site = JSON.parse(fs.readFileSync(path.join(SRC, 'data', 'site.json'), 'utf8'));
const layout = fs.readFileSync(path.join(SRC, 'layouts', 'base.html'), 'utf8');

const rm = (dir) => fs.rmSync(dir, { recursive: true, force: true });
const ensure = (dir) => fs.mkdirSync(dir, { recursive: true });

function copyDir(from, to) {
  if (!fs.existsSync(from)) return;
  ensure(to);
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const s = path.join(from, entry.name);
    const d = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

/** Collect every .html under src/pages, recursively. */
function pageFiles(dir = path.join(SRC, 'pages'), acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) pageFiles(p, acc);
    else if (entry.name.endsWith('.html')) acc.push(p);
  }
  return acc;
}

function parsePage(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const match = raw.match(/^<!--meta\s*([\s\S]*?)\s*meta-->\s*/);
  if (!match) throw new Error(`Missing <!--meta ... meta--> block in ${file}`);
  const meta = JSON.parse(match[1]);
  return { meta, body: raw.slice(match[0].length) };
}

/** Replace {{site.foo}} and {{page.foo}} tokens. Unknown tokens become ''. */
function render(template, page) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, key) => {
    const [scope, ...rest] = key.split('.');
    const source = scope === 'site' ? site : scope === 'page' ? page : null;
    if (!source) return '';
    const value = rest.reduce((acc, k) => (acc == null ? undefined : acc[k]), source);
    if (value == null) return '';
    if (Array.isArray(value)) return value.join(', ');
    return String(value);
  });
}

/**
 * Page JSON-LD. A page's own "jsonld" may be a single node or an @graph; if
 * the page sets "crumb" (its short name), a Home > Page BreadcrumbList is
 * added to the same graph so Google can show the trail in results.
 */
function jsonld(meta, url) {
  const nodes = [];
  if (meta.jsonld) {
    const { '@context': _, '@graph': graph, ...node } = meta.jsonld;
    nodes.push(...(graph || [node]));
  }
  if (meta.crumb && url !== '/') {
    nodes.push({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: site.url + '/' },
        { '@type': 'ListItem', position: 2, name: meta.crumb, item: site.url + url },
      ],
    });
  }
  if (!nodes.length) return '';
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes });
}

function build() {
  rm(DIST);
  ensure(DIST);

  const pages = pageFiles().map((file) => ({ file, ...parsePage(file) }));

  for (const { file, meta, body } of pages) {
    const url = meta.url;
    if (!url || !url.startsWith('/')) throw new Error(`Bad "url" in ${file}`);

    const page = {
      ...meta,
      canonical: site.url + url,
      robots: meta.noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large',
      ogImage: site.url + (meta.image || '/assets/img/og-default.jpg'),
      jsonld: jsonld(meta, url),
      body,
    };

    // Nav highlighting: the layout renders class="{{page.nav_menu}}" style hooks.
    for (const key of ['home', 'menu', 'parties', 'weddings', 'corporate', 'findus', 'gallery', 'about', 'contact']) {
      page[`nav_${key}`] = meta.nav === key ? 'active' : '';
    }

    // First pass drops the body into the layout; second pass resolves the
    // tokens that came in with the body.
    const html = render(render(layout, page), page);

    const outDir = url === '/' ? DIST : path.join(DIST, url.replace(/^\/|\/$/g, ''));
    ensure(outDir);
    fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');
    console.log(`  ${url}`);
  }

  // Static assets and JSON data ------------------------------------------
  copyDir(path.join(ROOT, 'assets'), path.join(DIST, 'assets'));
  copyDir(path.join(ROOT, 'data'), path.join(DIST, 'data'));
  // public/ (if present) lands at the site root.
  copyDir(path.join(ROOT, 'public'), DIST);
  for (const f of ['favicon.png']) {
    const s = path.join(ROOT, f);
    if (fs.existsSync(s)) fs.copyFileSync(s, path.join(DIST, f));
  }

  // Gallery manifest ------------------------------------------------------
  // Derived from the optimised files so adding a photo is: drop it in
  // img/gallery/, run `npm run images && npm run build`. Captions (used as alt
  // text and for image SEO) live in data/gallery-captions.json, keyed by slug.
  const thumbDir = path.join(ROOT, 'assets', 'img', 'gallery', 'thumb');
  if (fs.existsSync(thumbDir)) {
    const captionsFile = path.join(ROOT, 'data', 'gallery-captions.json');
    const captions = fs.existsSync(captionsFile)
      ? JSON.parse(fs.readFileSync(captionsFile, 'utf8'))
      : {};

    const naturalSort = (a, b) =>
      a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' });

    const manifest = fs
      .readdirSync(thumbDir)
      .filter((f) => f.endsWith('.webp'))
      .sort(naturalSort)
      .map((f) => {
        const slug = path.parse(f).name;
        return {
          slug,
          thumb: `/assets/img/gallery/thumb/${f}`,
          full: `/assets/img/gallery/full/${f}`,
          caption: captions[slug] || '',
        };
      });

    ensure(path.join(DIST, 'data'));
    fs.writeFileSync(path.join(DIST, 'data', 'gallery.json'), JSON.stringify(manifest, null, 2));
    console.log(`\n  gallery.json: ${manifest.length} photos`);
  }

  // sitemap.xml -----------------------------------------------------------
  const today = new Date().toISOString().split('T')[0];
  const urls = pages
    .filter((p) => !p.meta.noindex)
    .map(
      (p) =>
        `  <url>\n    <loc>${site.url}${p.meta.url}</loc>\n` +
        `    <lastmod>${today}</lastmod>\n` +
        `    <priority>${p.meta.priority || '0.7'}</priority>\n  </url>`
    )
    .join('\n');

  fs.writeFileSync(
    path.join(DIST, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
  );

  fs.writeFileSync(
    path.join(DIST, 'robots.txt'),
    `User-agent: *\nAllow: /\nDisallow: /admin/\n\nSitemap: ${site.url}/sitemap.xml\n`
  );

  console.log(`\n${pages.length} pages -> dist/`);
}

build();
