/**
 * Philly Philly - site scripts
 * Plain ES2019, no dependencies, no build step.
 */
(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };

  /* ---------------------------------------------------------------- Nav -- */

  var toggle = $('#navToggle');
  var nav = $('#primaryNav');

  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });

    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) {
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  var header = $('#header');
  if (header) {
    var onScroll = function () {
      header.classList.toggle('scrolled', window.scrollY > 20);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ------------------------------------------------------------ Consent -- */
  // Google Consent Mode v2 defaults are set in the <head> tag manager snippet.
  // Here we only record the user's choice and forward it.

  var CONSENT_KEY = 'pp_consent';
  var banner = $('#cookieBanner');

  function applyConsent(state) {
    if (typeof window.gtag === 'function') {
      window.gtag('consent', 'update', {
        ad_storage: state,
        ad_user_data: state,
        ad_personalization: state,
        analytics_storage: state,
      });
    }
  }

  if (banner) {
    var stored = null;
    try { stored = localStorage.getItem(CONSENT_KEY); } catch (e) { /* private mode */ }

    if (stored) {
      applyConsent(stored);
    } else {
      banner.hidden = false;
    }

    banner.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-consent]');
      if (!btn) return;
      var state = btn.getAttribute('data-consent');
      try { localStorage.setItem(CONSENT_KEY, state); } catch (err) { /* ignore */ }
      applyConsent(state);
      banner.hidden = true;
    });
  }

  /* --------------------------------------------------- Conversion events -- */
  // Every lead action fires a dataLayer event so Google Ads / GA4 can pick it
  // up as a conversion without touching the markup again.

  window.dataLayer = window.dataLayer || [];

  function track(name, params) {
    window.dataLayer.push(Object.assign({ event: name }, params || {}));
  }

  document.addEventListener('click', function (e) {
    var link = e.target.closest('a');
    if (!link) return;
    var href = link.getAttribute('href') || '';
    if (href.indexOf('tel:') === 0) track('phone_click', { value: href });
    else if (href.indexOf('mailto:') === 0) track('email_click', { value: href });
    else if (href.indexOf('wa.me') > -1) track('whatsapp_click');
  });

  /* -------------------------------------------------------------- Dates -- */

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  var MAP_ICON =
    '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="currentColor">' +
    '<path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>';

  var TYPE_LABEL = {
    market: 'Street food market',
    festival: 'Festival',
    concert: 'Concert',
    private: 'Private booking',
    closed: 'Not trading',
  };

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  /* ------------------------------------------------ Google Calendar feed -- */

  // nginx proxies the public Google Calendar iCal feed to /api/calendar.ics
  // (see deploy/nginx.conf). Each calendar entry becomes one trading day:
  //   title       -> where we are ("Canada Water Market")
  //   location    -> map button; a Google Maps link is used as is, an address is searched
  //   description -> shown under the title; a URL in it becomes a "More info" link
  //   type        -> guessed from the title: "festival", "concert", "private", "closed"
  // Weekly/daily repeats, edited single repeats and multi-day events are handled.

  var CALENDAR_DAYS_AHEAD = 400;

  function icsUnescape(v) {
    return v.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1');
  }

  function icsDate(prop) {
    // "20261107" or "20261107T110000" (local / TZID) or "20261107T110000Z" (UTC)
    var m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})\d{2}(Z)?)?/.exec(prop.value);
    if (!m) return null;
    if (m[6]) return londonWallClock(new Date(Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5])));
    return new Date(+m[1], m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0));
  }

  // UTC times are shown as London time wherever the visitor is, so dates and
  // opening hours match the truck, not the visitor's phone.
  var LONDON = typeof Intl !== 'undefined' && Intl.DateTimeFormat
    ? new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    })
    : null;

  function londonWallClock(utc) {
    if (!LONDON) return utc;
    var p = {};
    LONDON.formatToParts(utc).forEach(function (x) { p[x.type] = x.value; });
    return new Date(+p.year, p.month - 1, +p.day, +p.hour, +p.minute);
  }

  function isoDay(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function addDays(d, n) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  }

  function parseIcs(text) {
    var lines = text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
    var events = [];
    var cur = null;
    lines.forEach(function (line) {
      if (line === 'BEGIN:VEVENT') { cur = { exdates: [] }; return; }
      if (line === 'END:VEVENT') { if (cur) events.push(cur); cur = null; return; }
      if (!cur) return;
      var idx = line.indexOf(':');
      if (idx < 0) return;
      var name = line.slice(0, idx).split(';')[0].toUpperCase();
      var prop = { value: line.slice(idx + 1), date: line.slice(0, idx).indexOf('VALUE=DATE') > 0 };
      if (name === 'EXDATE') {
        prop.value.split(',').forEach(function (v) {
          var d = icsDate({ value: v });
          if (d) cur.exdates.push(isoDay(d));
        });
      } else {
        cur[name] = prop;
      }
    });
    return events;
  }

  function guessType(title) {
    var t = title.toLowerCase();
    if (/closed|not trading|day off|holiday/.test(t)) return 'closed';
    if (/private|wedding|party|corporate/.test(t)) return 'private';
    if (/festival|fest\b/.test(t)) return 'festival';
    if (/concert|gig/.test(t)) return 'concert';
    return 'market';
  }

  function occurrences(ev, until) {
    var start = icsDate(ev.DTSTART);
    if (!start) return [];
    start = new Date(start.getFullYear(), start.getMonth(), start.getDate());

    // Multi-day: an all-day DTEND is exclusive, a timed one is inclusive.
    var span = 1;
    if (ev.DTEND) {
      var end = icsDate(ev.DTEND);
      var endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      span = Math.max(1, Math.round((endDay - start) / 864e5) + (ev.DTEND.date ? 0 : 1));
    }

    var starts = [start];
    if (ev.RRULE) {
      var rule = {};
      ev.RRULE.value.split(';').forEach(function (p) { var kv = p.split('='); rule[kv[0]] = kv[1]; });
      var step = parseInt(rule.INTERVAL || '1', 10);
      var count = rule.COUNT ? parseInt(rule.COUNT, 10) : Infinity;
      var last = rule.UNTIL ? icsDate({ value: rule.UNTIL }) : until;
      if (last > until) last = until;
      var byDay = (rule.BYDAY || '').split(',').filter(Boolean).map(function (d) {
        return ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'].indexOf(d.slice(-2));
      });

      starts = [];
      if (rule.FREQ === 'DAILY' || rule.FREQ === 'WEEKLY') {
        var unit = rule.FREQ === 'DAILY' ? 1 : 7;
        var weekStart = addDays(start, -start.getDay());
        for (var n = 0; starts.length < count; n += step) {
          var base = rule.FREQ === 'DAILY' ? addDays(start, n) : addDays(weekStart, n * unit);
          if (base > last) break;
          var days = rule.FREQ === 'WEEKLY'
            ? (byDay.length ? byDay : [start.getDay()]).slice().sort().map(function (wd) { return addDays(base, wd); })
            : [base];
          for (var i = 0; i < days.length && starts.length < count; i++) {
            if (days[i] >= start && days[i] <= last) starts.push(days[i]);
          }
        }
      } else {
        starts = [start]; // monthly/yearly repeats are rare for us; show the first date only
      }
    }

    var out = [];
    starts.forEach(function (s) {
      if (ev.exdates.indexOf(isoDay(s)) >= 0) return;
      for (var k = 0; k < span; k++) out.push(isoDay(addDays(s, k)));
    });
    return out;
  }

  function calendarToEvents(text) {
    var raw = parseIcs(text);
    var until = addDays(new Date(), CALENDAR_DAYS_AHEAD);

    // An edited single repeat arrives as its own VEVENT with RECURRENCE-ID;
    // drop that date from the series so it is not shown twice.
    raw.forEach(function (ev) {
      if (!ev['RECURRENCE-ID'] || !ev.UID) return;
      var d = icsDate(ev['RECURRENCE-ID']);
      raw.forEach(function (master) {
        if (master !== ev && master.UID && master.UID.value === ev.UID.value && master.RRULE) {
          master.exdates.push(isoDay(d));
        }
      });
    });

    var list = [];
    raw.forEach(function (ev) {
      if (ev.STATUS && ev.STATUS.value === 'CANCELLED') return;
      var title = icsUnescape((ev.SUMMARY && ev.SUMMARY.value) || 'Philly Philly');
      var place = ev.LOCATION ? icsUnescape(ev.LOCATION.value).trim() : '';
      var map = /^https?:\/\//.test(place) ? place
        : place ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(place) : '';

      // Google Calendar stores rich-text descriptions as HTML; keep the words and the first link.
      var desc = ev.DESCRIPTION ? icsUnescape(ev.DESCRIPTION.value) : '';
      var info = /https?:\/\/[^\s"<>\\]+/.exec(desc);
      desc = desc.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/https?:\/\/\S+/g, '')
        .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

      // Times only for timed entries (all-day entries have no clock time).
      var time = '';
      if (ev.DTSTART && !ev.DTSTART.date && /T\d{4}/.test(ev.DTSTART.value)) {
        var hhmm = function (d) {
          return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
        };
        var s = icsDate(ev.DTSTART);
        var e = ev.DTEND ? icsDate(ev.DTEND) : null;
        time = hhmm(s) + (e && isoDay(e) === isoDay(s) ? '–' + hhmm(e) : '');
      }

      var type = guessType(title);
      occurrences(ev, until).forEach(function (date) {
        list.push({
          date: date, location: title, type: type, time: time,
          description: desc, map: map, info: info ? info[0] : ''
        });
      });
    });
    return list;
  }

  // Events come from the Google Calendar feed when the server proxies it, and
  // from the static file bundled with the build when it does not. Either way
  // the calendar renders.
  var eventsPromise = null;
  function getEvents() {
    if (!eventsPromise) {
      eventsPromise = fetch('/api/calendar.ics')
        .then(function (r) {
          if (!r.ok) throw new Error('no calendar');
          return r.text();
        })
        .then(function (text) {
          if (text.indexOf('BEGIN:VCALENDAR') < 0) throw new Error('not a calendar');
          return calendarToEvents(text);
        })
        .catch(function () {
          return fetch('/data/events.json')
            .then(function (r) { return r.ok ? r.json() : []; })
            .then(function (list) {
              // events.json keeps a single "link", which is always a map link.
              return list.map(function (e) { e.map = e.map || e.link || ''; return e; });
            })
            .catch(function () { return []; });
        });
    }
    return eventsPromise;
  }

  /* ---------------------------------------------------- Upcoming events -- */

  var upcoming = $('#upcoming-events');
  if (upcoming) {
    var limit = parseInt(upcoming.dataset.limit || '5', 10);

    getEvents().then(function (events) {
      var today = todayISO();
      var list = events
        .filter(function (e) { return e.date >= today && e.type !== 'closed'; })
        .sort(function (a, b) { return a.date < b.date ? -1 : 1; })
        .slice(0, limit);

      if (!list.length) {
        upcoming.innerHTML =
          '<p class="loading">Follow <a href="https://www.instagram.com/phillyphilly.uk/" rel="noopener">' +
          '@phillyphilly.uk</a> on Instagram for where we are trading this week, or ' +
          '<a href="/contact/">get in touch</a> to book us for your own event.</p>';
        return;
      }

      upcoming.innerHTML = list.map(function (ev) {
        var d = new Date(ev.date + 'T00:00:00');
        var meta = [DAYS[d.getDay()], ev.time, TYPE_LABEL[ev.type] || 'Event'].filter(Boolean).join(' · ');

        return '<div class="event-row">' +
          '<div class="event-date"><span class="d">' + d.getDate() + '</span>' +
          '<span class="m">' + MONTHS[d.getMonth()] + '</span></div>' +
          '<div class="event-info"><strong>' + escapeHtml(ev.location) + '</strong>' +
          '<span>' + escapeHtml(meta) + '</span>' +
          (ev.description ? '<p class="event-desc">' + escapeHtml(ev.description) + '</p>' : '') +
          (ev.info ? '<a class="event-more" href="' + escapeHtml(ev.info) + '" rel="noopener">More info →</a>' : '') +
          '</div>' +
          (ev.map
            ? '<a class="event-map" href="' + escapeHtml(ev.map) + '" rel="noopener" target="_blank"' +
              ' aria-label="Open ' + escapeHtml(ev.location) + ' in maps" title="Open in maps">' + MAP_ICON + '</a>'
            : '') +
          '</div>';
      }).join('');
    });
  }

  /* ------------------------------------------------- Day details popup -- */

  // Tapping a calendar day opens a small window with that day's details; the
  // map is one tap further, from the button in its bottom-left corner.
  var dayDialog = null;
  var dayDialogOpener = null;

  function closeDayDialog() {
    if (!dayDialog || !dayDialog.hasAttribute('open')) return;
    if (dayDialog.close) dayDialog.close(); else dayDialog.removeAttribute('open');
  }

  function openDayDialog(iso, evs, opener) {
    if (!dayDialog) {
      dayDialog = document.createElement('dialog');
      dayDialog.className = 'event-dialog';
      dayDialog.setAttribute('aria-labelledby', 'event-dialog-title');
      document.body.appendChild(dayDialog);
      // A click on the backdrop lands on the dialog element itself.
      dayDialog.addEventListener('click', function (e) {
        if (e.target === dayDialog || e.target.closest('.event-dialog-close')) closeDayDialog();
      });
      dayDialog.addEventListener('close', function () {
        if (dayDialogOpener) dayDialogOpener.focus();
      });
    }
    dayDialogOpener = opener;

    var d = new Date(iso + 'T00:00:00');
    dayDialog.innerHTML =
      '<div class="event-dialog-card">' +
      '<div class="event-dialog-head">' +
      '<h3 id="event-dialog-title">' + DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS_FULL[d.getMonth()] + '</h3>' +
      '<button type="button" class="event-dialog-close" aria-label="Close">&times;</button>' +
      '</div>' +
      evs.map(function (ev) {
        var meta = [ev.time, TYPE_LABEL[ev.type] || 'Event'].filter(Boolean).join(' · ');
        return '<div class="event-dialog-item">' +
          '<strong>' + escapeHtml(ev.location) + '</strong>' +
          '<span class="event-dialog-meta">' + escapeHtml(meta) + '</span>' +
          (ev.description ? '<p>' + escapeHtml(ev.description) + '</p>' : '') +
          '<div class="event-dialog-actions">' +
          (ev.map
            ? '<a class="btn btn-primary btn-sm event-dialog-map" href="' + escapeHtml(ev.map) + '" rel="noopener" target="_blank">' +
              MAP_ICON + '<span>Show on map</span></a>'
            : '') +
          (ev.info ? '<a class="event-more" href="' + escapeHtml(ev.info) + '" rel="noopener">More info →</a>' : '') +
          '</div></div>';
      }).join('') +
      '</div>';

    if (dayDialog.showModal) dayDialog.showModal(); else dayDialog.setAttribute('open', '');
    dayDialog.querySelector('.event-dialog-close').focus();
  }

  /* ------------------------------------------------------ Month calendar -- */

  var grid = $('#calendar-grid');
  if (grid) {
    var cursor = new Date();
    cursor.setDate(1);

    var renderMonth = function () {
      var year = cursor.getFullYear();
      var month = cursor.getMonth();
      $('#calendar-title').textContent = MONTHS_FULL[month] + ' ' + year;

      getEvents().then(function (events) {
        byDate = {};
        events.forEach(function (e) { (byDate[e.date] = byDate[e.date] || []).push(e); });

        var firstDay = new Date(year, month, 1).getDay();
        var daysInMonth = new Date(year, month + 1, 0).getDate();
        var now = new Date();
        var html = '';

        for (var i = 0; i < firstDay; i++) html += '<div class="calendar-cell empty"></div>';

        for (var day = 1; day <= daysInMonth; day++) {
          var iso = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
          var evs = byDate[iso];
          var isToday = day === now.getDate() && month === now.getMonth() && year === now.getFullYear();
          var cls = 'calendar-cell' + (isToday ? ' is-today' : '');

          if (!evs) {
            html += '<div class="' + cls + '"><div class="date-number">' + day + '</div></div>';
            continue;
          }

          // A day with events is a button that opens the details popup.
          var names = evs.map(function (e) { return e.location; }).join(', ');
          html += '<button type="button" class="' + cls + ' has-event" data-date="' + iso + '"' +
            ' aria-haspopup="dialog" aria-label="' + escapeHtml(day + ' ' + MONTHS_FULL[month] + ': ' + names) + '">' +
            '<span class="date-number">' + day + '</span>' +
            evs.map(function (e) { return '<span class="cell-event">' + escapeHtml(e.location) + '</span>'; }).join('') +
            '<span class="cell-dot" aria-hidden="true"></span>' +
            '</button>';
        }

        grid.innerHTML = html;
      });
    };

    var byDate = {};
    grid.addEventListener('click', function (e) {
      var cell = e.target.closest('.has-event');
      if (cell && byDate[cell.dataset.date]) openDayDialog(cell.dataset.date, byDate[cell.dataset.date], cell);
    });

    var prev = $('#prevMonth');
    var next = $('#nextMonth');
    if (prev) prev.addEventListener('click', function () { cursor.setMonth(cursor.getMonth() - 1); renderMonth(); });
    if (next) next.addEventListener('click', function () { cursor.setMonth(cursor.getMonth() + 1); renderMonth(); });
    renderMonth();
  }

  /* ------------------------------------------------------------ Gallery -- */

  var galleryEl = $('#gallery-grid');
  if (galleryEl) {
    var max = parseInt(galleryEl.dataset.limit || '0', 10);

    fetch('/data/gallery.json')
      .then(function (r) { return r.ok ? r.json() : []; })
      .catch(function () { return []; })
      .then(function (photos) {
        if (!photos.length) {
          galleryEl.innerHTML = '<p class="loading">Photos coming soon.</p>';
          return;
        }
        var list = max > 0 ? photos.slice(0, max) : photos;

        galleryEl.innerHTML = list.map(function (p, i) {
          var alt = escapeHtml(p.caption || 'Philly Philly food truck at a UK event');
          return '<button type="button" class="gallery-item" data-full="' + escapeHtml(p.full) +
            '" data-caption="' + alt + '">' +
            '<img src="' + escapeHtml(p.thumb) + '" alt="' + alt + '" width="600" height="600" ' +
            'loading="' + (i < 4 ? 'eager' : 'lazy') + '" decoding="async">' +
            '</button>';
        }).join('');
      });

    galleryEl.addEventListener('click', function (e) {
      var item = e.target.closest('.gallery-item');
      if (item) openLightbox(item.dataset.full, item.dataset.caption);
    });
  }

  var lightbox = null;
  function openLightbox(src, caption) {
    if (!lightbox) {
      lightbox = document.createElement('div');
      lightbox.className = 'lightbox';
      lightbox.setAttribute('role', 'dialog');
      lightbox.setAttribute('aria-modal', 'true');
      lightbox.innerHTML =
        '<button class="lightbox-close" aria-label="Close">&times;</button><img alt="">';
      document.body.appendChild(lightbox);

      lightbox.addEventListener('click', function (e) {
        if (e.target === lightbox || e.target.closest('.lightbox-close')) closeLightbox();
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeLightbox();
      });
    }
    var img = lightbox.querySelector('img');
    img.src = src;
    img.alt = caption || '';
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
  }

  /* --------------------------------------------------------- Quote form -- */

  var form = $('#quote-form');
  if (form) {
    var status = $('#form-status');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (form.querySelector('.honeypot input').value) return; // bot

      var submit = form.querySelector('button[type="submit"]');
      submit.disabled = true;
      submit.textContent = 'Sending…';

      fetch(form.action, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: new FormData(form),
      })
        .then(function (r) {
          if (!r.ok) throw new Error('Bad response');
          form.reset();
          status.className = 'form-status ok';
          status.textContent =
            'Thanks — your enquiry is in. We reply to every enquiry within 24 hours, ' +
            'usually much sooner. For anything urgent, call ' +
            form.dataset.phone + '.';
          track('enquiry_submitted');
        })
        .catch(function () {
          status.className = 'form-status error';
          status.innerHTML =
            'Something went wrong sending the form. Please email ' +
            '<a href="mailto:' + form.dataset.email + '">' + form.dataset.email + '</a> ' +
            'or call <a href="tel:' + form.dataset.phone + '">' + form.dataset.phone + '</a>.';
        })
        .finally(function () {
          submit.disabled = false;
          submit.textContent = 'Send enquiry';
        });
    });
  }
})();
