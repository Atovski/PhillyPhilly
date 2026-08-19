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

  // Events come from the admin-backed API when it is available, and from the
  // static file bundled with the build when it is not. Either way the calendar
  // renders.
  var eventsPromise = null;
  function getEvents() {
    if (!eventsPromise) {
      eventsPromise = fetch('/api/events')
        .then(function (r) { if (!r.ok) throw new Error('no api'); return r.json(); })
        .catch(function () {
          return fetch('/data/events.json')
            .then(function (r) { return r.ok ? r.json() : []; })
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
          '<p class="loading">Our next dates are being confirmed. ' +
          '<a href="/contact/">Get in touch</a> to book us for your own event.</p>';
        return;
      }

      upcoming.innerHTML = list.map(function (ev) {
        var d = new Date(ev.date + 'T00:00:00');
        var inner =
          '<div class="event-date"><span class="d">' + d.getDate() + '</span>' +
          '<span class="m">' + MONTHS[d.getMonth()] + '</span></div>' +
          '<div class="event-info"><strong>' + escapeHtml(ev.location) + '</strong>' +
          '<span>' + DAYS[d.getDay()] + ' · ' + escapeHtml(TYPE_LABEL[ev.type] || 'Event') +
          (ev.link ? ' · Details →' : '') + '</span></div>';

        return ev.link
          ? '<a class="event-row" href="' + escapeHtml(ev.link) + '" rel="noopener">' + inner + '</a>'
          : '<div class="event-row">' + inner + '</div>';
      }).join('');
    });
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
        var byDate = {};
        events.forEach(function (e) { byDate[e.date] = e; });

        var firstDay = new Date(year, month, 1).getDay();
        var daysInMonth = new Date(year, month + 1, 0).getDate();
        var now = new Date();
        var html = '';

        for (var i = 0; i < firstDay; i++) html += '<div class="calendar-cell empty"></div>';

        for (var day = 1; day <= daysInMonth; day++) {
          var iso = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
          var ev = byDate[iso];
          var isToday = day === now.getDate() && month === now.getMonth() && year === now.getFullYear();

          html += '<div class="calendar-cell' + (isToday ? ' is-today' : '') + '">' +
            '<div class="date-number">' + day + '</div>' +
            (ev ? '<div class="cell-event">' + escapeHtml(ev.location) + '</div>' : '') +
            '</div>';
        }

        grid.innerHTML = html;
      });
    };

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
