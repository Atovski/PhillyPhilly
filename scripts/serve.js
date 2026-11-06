/**
 * Local preview server for dist/ with clean URLs (/weddings/ -> weddings/index.html).
 * Deployment does this for us; this is only so we can see the built site locally.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '..', 'dist');
const PORT = process.env.PORT || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// The live server proxies Google Calendar at /api/calendar.ics (deploy/nginx.conf).
// Do the same here, reading the calendar ID from that file so there is one place to change it.
function calendarId() {
  const conf = fs.readFileSync(path.join(__dirname, '..', 'deploy', 'nginx.conf'), 'utf8');
  const m = /set \$phillyphilly_calendar_id "([^"]+)"/.exec(conf);
  return m ? m[1] : '';
}

async function proxyCalendar(res) {
  const id = calendarId();
  const feed = `https://calendar.google.com/calendar/ical/${encodeURIComponent(id)}/public/basic.ics`;
  try {
    const r = await fetch(feed);
    res.writeHead(r.status, { 'Content-Type': 'text/calendar; charset=utf-8' });
    res.end(await r.text());
  } catch (e) {
    res.writeHead(502).end('Calendar feed unavailable: ' + e.message);
  }
}

http
  .createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);

    if (url === '/api/calendar.ics') {
      proxyCalendar(res);
      return;
    }

    // Resolve inside DIST only — never let a request escape the output folder.
    let target = path.normalize(path.join(DIST, url));
    if (!target.startsWith(DIST)) {
      res.writeHead(403).end('Forbidden');
      return;
    }

    if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
      target = path.join(target, 'index.html');
    }

    fs.readFile(target, (err, buf) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>404</h1><p>Not found: ' + url + '</p>');
        return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(target)] || 'application/octet-stream' });
      res.end(buf);
    });
  })
  .listen(PORT, () => console.log(`dist/ served at http://localhost:${PORT}/`));
