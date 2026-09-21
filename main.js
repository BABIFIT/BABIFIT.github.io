/* ═══════════════════════════════════════════════════════════════
   Portfolio runtime.

   All content comes from two plain-text files in this directory:
     info.txt          — everything personal (edit this)
     AIDisclaimer.txt  — the AI statement, verbatim, never rewritten

   Because these are fetched, the site must be served over http
   (python3 -m http.server), not opened as a file:// path.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Tiny helpers ─────────────────────────────────────────────── */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function slug(s) { return String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-'); }

  /* ── info.txt parser ──────────────────────────────────────────
     Sections are [name]. Inside a section, "key = value" pairs, and
     "---" starts a new record. Sections with no keys (like [about])
     keep their raw text so paragraphs survive. */
  function parseInfo(text) {
    var sections = {}, current = null;

    text.split(/\r?\n/).forEach(function (rawLine) {
      var line = rawLine.trim();
      if (line.charAt(0) === '#') return;                 // comment

      var header = line.match(/^\[([^\]]+)\]$/);
      if (header) {
        current = { records: [{}], raw: [] };
        sections[header[1].trim().toLowerCase()] = current;
        return;
      }
      if (!current) return;                               // preamble

      if (line === '---') { current.records.push({}); return; }

      var eq = line.indexOf('=');
      if (eq > 0) {
        var key = line.slice(0, eq).trim().toLowerCase();
        var value = line.slice(eq + 1).trim();
        current.records[current.records.length - 1][key] = value;
        // Keep insertion order for sections read as ordered pairs (skills).
        var order = current.records[current.records.length - 1].__order || [];
        order.push(key);
        current.records[current.records.length - 1].__order = order;
      }
      current.raw.push(rawLine);
    });

    return {
      // First record of a section, for singleton sections like [basics].
      one: function (name) {
        var s = sections[name];
        return (s && s.records[0]) || {};
      },
      // Every non-empty record, for repeated sections like [projects].
      all: function (name) {
        var s = sections[name];
        if (!s) return [];
        return s.records.filter(function (r) {
          return Object.keys(r).some(function (k) { return k !== '__order' && r[k]; });
        });
      },
      // Plain list sections: one item per line, leading "- " optional.
      lines: function (name) {
        var s = sections[name];
        if (!s) return [];
        return s.raw.map(function (l) { return l.trim().replace(/^[-*]\s+/, ''); })
          .filter(Boolean);
      },
      // Raw text of a section, paragraphs split on blank lines.
      paragraphs: function (name) {
        var s = sections[name];
        if (!s) return [];
        return s.raw.join('\n').split(/\n\s*\n/)
          .map(function (p) { return p.trim().replace(/\s*\n\s*/g, ' '); })
          .filter(Boolean);
      },
      has: function (name) { return !!sections[name]; }
    };
  }

  function list(value) {
    return String(value || '').split(',')
      .map(function (s) { return s.trim(); })
      .filter(Boolean);
  }

  /* ── Rendering: shared chrome (nav, banner, footer) ───────────── */
  function renderChrome(info) {
    var basics = info.one('basics');
    var contact = info.one('contact');
    var ai = info.one('ai');
    var cta = info.one('projects_cta');
    var projectsPage = info.one('projects_page');

    document.title = document.body.dataset.page === 'projects'
      ? 'Projects — ' + (basics.name || '')
      : (basics.name || '') + (basics.status ? ' — ' + basics.status : '');

    var desc = $('meta[name="description"]');
    if (desc && basics.meta_description) desc.content = basics.meta_description;

    $$('[data-field]').forEach(function (node) {
      var value = { name: basics.name, initials: basics.initials,
                    status: basics.status, tagline: basics.tagline,
                    location: basics.location,
                    ai_summary: ai.summary, ai_button: ai.button,
                    contact_blurb: contact.blurb,
                    cta_title: cta.title, cta_text: cta.text,
                    cta_button: cta.button,
                    projects_notice: projectsPage.notice }[node.dataset.field];
      if (value) node.textContent = value;
      else if (node.dataset.optional === 'true') node.hidden = true;
    });

    var noticeBar = $('.notice-bar');
    if (noticeBar) noticeBar.hidden = !projectsPage.notice;

    // Contact links: one button per non-empty entry, in a fixed order.
    var linkSpec = [
      ['email',    'Email',    function (v) { return 'mailto:' + v; }, false],
      ['github',   'GitHub',   null, true],
      ['linkedin', 'LinkedIn', null, true],
      ['website',  'Website',  null, true],
      ['resume',   'Résumé',   null, true]
    ];
    $$('[data-links]').forEach(function (holder) {
      holder.textContent = '';
      var style = holder.dataset.links;                   // "hero" | "contact" | "footer"
      linkSpec.forEach(function (spec) {
        var key = spec[0], value = contact[key];
        if (!value) return;
        var href = spec[2] ? spec[2](value) : value;
        // The email button spells out the address: "Email: you@example.com".
        var label = key === 'email' ? spec[1] + ': ' + value : spec[1];
        var a = el('a', style === 'footer' ? '' : 'btn', label);
        a.href = href;
        if (spec[3]) { a.target = '_blank'; a.rel = 'noopener'; }
        if (style === 'contact' && key === 'email') a.className = 'btn btn-primary';
        if (style === 'footer' && key !== 'github') return;
        holder.appendChild(a);
      });
    });
  }

  /* ── Rendering: homepage ──────────────────────────────────────── */
  function renderHome(info) {
    var about = $('#about-prose');
    if (about) {
      about.textContent = '';
      info.paragraphs('about').forEach(function (p) { about.appendChild(el('p', null, p)); });
    }

    var skills = $('#skills-list');
    if (skills) {
      skills.textContent = '';
      var record = info.one('skills');
      (record.__order || []).forEach(function (key) {
        var items = list(record[key]);
        if (!items.length) return;
        var group = el('div', 'skill-group');
        // Restore the label's original casing from the raw section text.
        group.appendChild(el('h3', null, labelFor(info, key)));
        var tags = el('div', 'tag-list');
        items.forEach(function (item) { tags.appendChild(el('span', 'tag', item)); });
        group.appendChild(tags);
        skills.appendChild(group);
      });
      toggleSection(skills, skills.children.length);
    }

    timeline(info, '#education-list', 'education');
    timeline(info, '#experience-list', 'experience');
    plainList(info, '#awards-list', 'awards');
    plainList(info, '#affiliations-list', 'affiliations');

    // The recognition section holds two lists; hide it only if both are empty.
    var recognition = $('#recognition');
    if (recognition) recognition.hidden = !recognition.querySelectorAll('li').length;
  }

  function timeline(info, selector, section) {
    var holder = $(selector);
    if (!holder) return;
    holder.textContent = '';
    info.all(section).forEach(function (e) {
      var item = el('div', 'timeline-item');
      if (e.when) item.appendChild(el('p', 'when', e.when));
      if (e.role) item.appendChild(el('h3', null, e.role));
      if (e.org) item.appendChild(el('p', 'where', e.org));
      if (e.detail) item.appendChild(el('p', null, e.detail));
      holder.appendChild(item);
    });
    toggleSection(holder, holder.children.length);
  }

  function plainList(info, selector, section) {
    var holder = $(selector);
    if (!holder) return;
    holder.textContent = '';
    info.lines(section).forEach(function (text) {
      holder.appendChild(el('li', null, text));
    });
    // Hide the whole block (heading included) when there's nothing in it.
    var block = holder.closest('.list-block');
    if (block) block.hidden = !holder.children.length;
  }

  // Skill keys are lowercased for lookup; recover the display casing.
  function labelFor(info, key) {
    var match = null;
    info.paragraphs('skills').join('\n').split('\n').forEach(function (line) {
      var eq = line.indexOf('=');
      if (eq > 0 && line.slice(0, eq).trim().toLowerCase() === key) match = line.slice(0, eq).trim();
    });
    return match || key;
  }

  function toggleSection(node, count) {
    var section = node.closest('section');
    if (section && !count) section.hidden = true;
  }

  /* ── Rendering: projects page ─────────────────────────────────── */
  var STATUSES = ['finished', 'in-progress', 'future', 'proprietary'];
  var TYPES = ['hardware', 'software', 'hybrid'];

  function renderProjects(info, extra) {
    var projects = info.all('projects').concat(extra || []);
    renderCounts(projects);
    if (!$('.tabs')) return;
    $$('.card-grid').forEach(function (g) { g.textContent = ''; });

    projects.forEach(function (p) {
      var status = slug(p.status || 'finished');
      var type = slug(p.type || 'software');
      if (STATUSES.indexOf(status) === -1) status = 'finished';
      if (TYPES.indexOf(type) === -1) type = 'software';

      var grid = $('#grid-' + status + '-' + type);
      if (!grid) {
        console.warn('No tab for status "' + status + '" — skipping project: ' +
                     (p.name || p.__source || 'unnamed'));
        return;
      }

      var card = el('article', 'project-card');
      var meta = el('div', 'meta');
      meta.appendChild(el('span', 'chip chip-' + type, type.charAt(0).toUpperCase() + type.slice(1)));
      meta.appendChild(el('span', 'chip', statusLabel(status)));
      card.appendChild(meta);

      card.appendChild(el('h4', 'project-title', p.name || 'Untitled'));
      if (p.desc) card.appendChild(el('p', 'project-desc', p.desc));

      var tech = list(p.tech);
      if (tech.length) {
        var tags = el('div', 'tag-list');
        tech.forEach(function (t) { tags.appendChild(el('span', 'tag', t)); });
        card.appendChild(tags);
      }
      if (p.note) card.appendChild(el('p', 'project-note', p.note));
      if (p.url) {
        var a = el('a', 'project-link', 'View project →');
        a.href = p.url; a.target = '_blank'; a.rel = 'noopener';
        card.appendChild(a);
      }
      attachImage(card, p);
      grid.appendChild(card);
    });

    // The fifth tab is a plain bullet list from [small_stuff] in info.txt.
    var small = $('#small-list');
    if (small) {
      small.textContent = '';
      info.lines('small_stuff').forEach(function (text) {
        small.appendChild(el('li', 'small-item', text));
      });
    }

    // Counts, and hide anything empty.
    $$('.subcat').forEach(function (sub) {
      var n = sub.querySelectorAll('.project-card').length;
      sub.dataset.empty = n === 0 ? 'true' : 'false';
      var badge = $('.n', sub);
      if (badge) badge.textContent = n === 1 ? '1 project' : n + ' projects';
    });
    $$('.tab-panel').forEach(function (panel) {
      var n = panel.querySelectorAll('.project-card, .small-item').length;
      var count = $('.tab[data-tab="' + panel.dataset.panel + '"] .count');
      if (count) count.textContent = '(' + n + ')';
      var empty = $('.empty-state', panel);
      if (empty) empty.hidden = n > 0;
    });

    initTabs();
  }

  /* Count tiles in the homepage projects call-out. */
  function renderCounts(projects) {
    var holder = $('#cta-counts');
    if (!holder) return;
    holder.textContent = '';
    var tally = {};
    projects.forEach(function (p) {
      var status = slug(p.status || 'finished');
      if (STATUSES.indexOf(status) === -1) status = 'finished';
      tally[status] = (tally[status] || 0) + 1;
    });
    STATUSES.forEach(function (status) {
      if (!tally[status]) return;
      var cell = el('div');
      cell.appendChild(el('span', 'num', String(tally[status])));
      cell.appendChild(el('span', 'lbl', statusLabel(status)));
      holder.appendChild(cell);
    });
  }

  /* ── Project images ───────────────────────────────────────────
     Name an image the same as its project file — projects/homelab.txt
     picks up projects/homelab.png (or .jpg/.webp/...). An explicit
     "image = some/path.png" in the project file wins over the guess.
     Nothing is inserted unless an image actually loads, so a project
     with no picture just renders as a plain card. */
  var IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'webp', 'avif', 'gif', 'svg'];

  function attachImage(card, project) {
    var candidates = [];
    if (project.image) {
      candidates.push(project.image);
    } else if (project.__source) {
      var base = project.__source.replace(/\.txt$/i, '');
      IMAGE_EXTS.forEach(function (ext) { candidates.push(base + '.' + ext); });
    }
    if (!candidates.length) return;

    var i = 0;
    // No loading="lazy" here: the probe image isn't in the document yet,
    // and a lazy detached image never fires load, so nothing would attach.
    var img = new Image();
    img.alt = project.name ? project.name + ' — project image' : '';

    img.onload = function () {
      var media = el('div', 'project-media');
      media.appendChild(img);
      card.insertBefore(media, card.firstChild);
    };
    img.onerror = function () { next(); };

    function next() {
      if (i >= candidates.length) return;      // no image for this one
      img.src = candidates[i++];
    }
    next();
  }

  function statusLabel(status) {
    return { 'finished': 'Finished', 'in-progress': 'In Progress',
             'future': 'Planned', 'proprietary': 'Proprietary' }[status] || status;
  }

  /* ── Standalone project files ─────────────────────────────────
     One project per file, same fields as an inline [projects] block
     but with no [section] header and no --- separator. A line that
     isn't "key = value" continues the previous field, so a long
     description can wrap across several lines. */
  function parseProjectFile(text, path) {
    var record = {}, lastKey = null;

    text.split(/\r?\n/).forEach(function (rawLine) {
      var line = rawLine.trim();
      if (!line || line.charAt(0) === '#') { lastKey = null; return; }

      var eq = line.indexOf('=');
      if (eq > 0 && /^[A-Za-z_][A-Za-z0-9_ -]*$/.test(line.slice(0, eq).trim())) {
        lastKey = line.slice(0, eq).trim().toLowerCase();
        record[lastKey] = line.slice(eq + 1).trim();
      } else if (lastKey) {
        record[lastKey] = (record[lastKey] ? record[lastKey] + ' ' : '') + line;
      }
    });

    // An untouched copy of _template.txt has nothing in it yet. Mark it so
    // it doesn't render as a blank card named after its filename.
    record.__blank = !record.name && !record.desc && !record.tech;

    if (!record.name) record.name = path.split('/').pop().replace(/\.txt$/i, '');
    record.__source = path;
    return record;
  }

  /* Work out which project files exist, without you maintaining a list.
     Three strategies, first one that yields anything wins:
       1. projects/index.txt — a generated manifest. This is what works on
          GitHub Pages, which serves no directory listings. Regenerate it
          with ./make-index.sh (or let the GitHub Action do it on push).
       2. A directory listing of projects/ — what `python3 -m http.server`
          and most dev servers hand back. Means local edits show up with
          no regeneration at all.
       3. [project_files] in info.txt — the old explicit list, still
          honoured if you'd rather pick by hand.
     Files whose names start with _ are skipped, so _template.txt and any
     draft you prefix with an underscore stay invisible. */
  function discoverProjectFiles(info) {
    return loadText('projects/index.txt')
      .then(function (text) { return manifestPaths(text); })
      .catch(function () {
        return loadText('projects/')
          .then(function (html) { return listingPaths(html); })
          .catch(function () { return []; });
      })
      .then(function (paths) {
        return paths.length ? paths : info.lines('project_files');
      });
  }

  function usable(file) {
    return /\.txt$/i.test(file) &&
           file.charAt(0) !== '_' &&
           file.toLowerCase() !== 'index.txt';
  }

  function manifestPaths(text) {
    var out = [];
    text.split(/\r?\n/).forEach(function (raw) {
      var line = raw.trim().replace(/^[-*]\s+/, '');
      if (!line || line.charAt(0) === '#') return;
      var file = line.split('/').pop();
      if (!usable(file)) return;
      out.push(line.indexOf('/') === -1 ? 'projects/' + line : line);
    });
    return out;
  }

  function listingPaths(html) {
    var out = [], seen = {}, match;
    var re = /href="([^"?#]+\.txt)"/gi;
    while ((match = re.exec(html)) !== null) {
      var file = decodeURIComponent(match[1]).split('/').pop();
      if (!usable(file) || seen[file]) continue;
      seen[file] = true;
      out.push('projects/' + file);
    }
    return out.sort();
  }

  function loadProjectFiles(paths) {
    if (!paths.length) return Promise.resolve([]);

    return Promise.all(paths.map(function (path) {
      return loadText(path)
        .then(function (text) { return parseProjectFile(text, path); })
        .catch(function (err) {
          // One missing file shouldn't blank out the whole page.
          console.error('Could not load project file: ' + path, err);
          return null;
        });
    })).then(function (records) {
      var blank = records.filter(function (r) { return r && r.__blank; });
      if (blank.length) {
        console.info('Skipped ' + blank.length + ' empty project file(s) — ' +
          'fill in a name or description to show them: ' +
          blank.map(function (r) { return r.__source; }).join(', '));
      }
      return records.filter(function (r) { return r && !r.__blank; });
    });
  }

  /* ── Tabs ─────────────────────────────────────────────────────
     Tab state lives in the URL hash so a view is linkable
     (projects.html#in-progress) and survives a refresh. */
  function initTabs() {
    var tabs = $$('.tab');
    if (!tabs.length) return;

    function select(id, updateHash) {
      var found = false;
      tabs.forEach(function (tab) {
        var match = tab.dataset.tab === id;
        if (match) found = true;
        tab.setAttribute('aria-selected', match ? 'true' : 'false');
        tab.tabIndex = match ? 0 : -1;
        var panel = document.getElementById('panel-' + tab.dataset.tab);
        if (panel) panel.hidden = !match;
      });
      if (found && updateHash) history.replaceState(null, '', '#' + id);
      return found;
    }

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () { select(tab.dataset.tab, true); });
      tab.addEventListener('keydown', function (e) {
        var i = tabs.indexOf(tab), next = null;
        if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
        else if (e.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
        else if (e.key === 'Home') next = tabs[0];
        else if (e.key === 'End') next = tabs[tabs.length - 1];
        if (next) { e.preventDefault(); next.focus(); select(next.dataset.tab, true); }
      });
    });

    var hash = window.location.hash.replace('#', '');
    if (!hash || !select(hash, false)) select('finished', false);
  }

  /* ── AI statement ─────────────────────────────────────────────
     AIDisclaimer.txt is rendered as written. The text before the
     "In-depth explanation:" line is shown outright; everything after
     goes behind a toggle so the modal stays readable. Lines shaped
     like "Label: sentence" in the first part render as tenets. */
  function renderStatement(text, headline) {
    var split = text.split(/^\s*In-depth explanation:\s*$/m);
    var intro = split[0] || text;
    var depth = split.slice(1).join('\n').trim();

    $$('[data-statement]').forEach(function (holder) {
      holder.textContent = '';

      var heading = $('#philosophy-title', holder.closest('.modal-inner') || document);
      if (heading && headline) heading.textContent = headline;

      var tenets = null, para = [];

      function flushParagraph() {
        if (!para.length) return;
        holder.appendChild(el('p', null, para.join(' ')));
        para = [];
      }

      intro.split(/\r?\n/).forEach(function (raw) {
        var line = raw.trim();
        if (!line) { flushParagraph(); tenets = null; return; }

        var rule = tenetOf(line);
        if (rule) {
          flushParagraph();
          if (!tenets) { tenets = el('ol', 'tenets'); holder.appendChild(tenets); }
          var li = el('li');
          li.appendChild(el('b', null, rule[0]));
          li.appendChild(document.createTextNode(' — ' + rule[1]));
          tenets.appendChild(li);
        } else {
          tenets = null;
          para.push(line);
        }
      });
      flushParagraph();

      if (depth) {
        var details = el('details', 'statement-more');
        var summary = el('summary', null, 'Read the in-depth explanation');
        details.appendChild(summary);
        var body = el('div', 'statement-body');
        paragraphsOf(depth).forEach(function (p) { body.appendChild(el('p', null, p)); });
        details.appendChild(body);
        holder.appendChild(details);
      }
    });
  }

  /* A tenet is a single line shaped "Short Title Case Label: sentence".
     Guards keep prose out: an ALL-CAPS lead-in (NOTE:, PLEASE:) and a
     label longer than four words are treated as ordinary text. */
  function tenetOf(line) {
    var m = line.match(/^([A-Za-z][A-Za-z /&'-]{2,44}):\s+(\S.*)$/);
    if (!m) return null;
    var label = m[1].trim();
    if (label === label.toUpperCase()) return null;
    if (label.split(/\s+/).length > 4) return null;
    return [label, m[2].trim()];
  }

  function paragraphsOf(text) {
    return text.split(/\n\s*\n/)
      .map(function (p) { return p.trim().replace(/\s*\n\s*/g, ' '); })
      .filter(Boolean);
  }

  /* ── The modal itself ─────────────────────────────────────────
     Auto-opens once per visitor on the homepage; the banner button
     and footer link reopen it anywhere, any time. */
  var SEEN_KEY = 'ai-philosophy-seen';

  function initModal() {
    var modal = document.getElementById('philosophy-modal');
    if (!modal) return;

    var inner = $('.modal-inner', modal);

    function open() {
      if (typeof modal.showModal === 'function') { if (!modal.open) modal.showModal(); }
      else modal.setAttribute('open', '');
      // showModal() focuses the first control, which can scroll the heading
      // out of view on a long statement. Start at the top instead.
      if (inner) { inner.scrollTop = 0; inner.focus(); }
      try { localStorage.setItem(SEEN_KEY, '1'); } catch (e) { /* private mode */ }
    }

    $$('[data-open-philosophy]').forEach(function (btn) {
      btn.addEventListener('click', function (e) { e.preventDefault(); open(); });
    });
    $$('[data-close-philosophy]').forEach(function (btn) {
      btn.addEventListener('click', function () { modal.close(); });
    });
    modal.addEventListener('click', function (e) {
      if (e.target === modal) modal.close();              // backdrop click
    });

    var seen = '1';
    try { seen = localStorage.getItem(SEEN_KEY); } catch (e) { seen = null; }
    if (!seen && document.body.dataset.autoPopup === 'true') {
      // Let the page paint first so it reads as intentional, not a jump-scare.
      window.setTimeout(open, 450);
    }

    // Ctrl+Alt+D forgets that this browser has seen the statement, so the
    // first-visit popup can be tested again.
    document.addEventListener('keydown', function (e) {
      if (!e.ctrlKey || !e.altKey || (e.key || '').toLowerCase() !== 'd') return;
      e.preventDefault();
      var ok = true;
      try { localStorage.removeItem(SEEN_KEY); } catch (err) { ok = false; }
      if (!ok) { toast('Could not reset — storage is blocked in this browser.'); return; }
      if (document.body.dataset.autoPopup === 'true') {
        toast('AI statement reset — reloading…');
        window.setTimeout(function () { window.location.reload(); }, 700);
      } else {
        toast('AI statement reset — it will show on the homepage.');
      }
    });
  }

  /* Small transient confirmation, bottom-right. */
  function toast(message) {
    var existing = $('.toast');
    if (existing) existing.parentNode.removeChild(existing);
    var node = el('div', 'toast', message);
    document.body.appendChild(node);
    window.setTimeout(function () { node.classList.add('visible'); }, 10);
    window.setTimeout(function () {
      node.classList.remove('visible');
      window.setTimeout(function () {
        if (node.parentNode) node.parentNode.removeChild(node);
      }, 300);
    }, 2600);
  }

  /* Content arrives after the page load, so a "#contact" link followed
     from another page has already tried (and failed) to scroll by the
     time the section exists. Redo the jump once everything is in. */
  function honorHash() {
    var id = window.location.hash.replace('#', '');
    if (!id) return;
    var target = document.getElementById(id);
    if (!target || target.closest('.tab-panel')) return;   // tabs handle their own
    target.scrollIntoView();
  }

  /* ── Scroll reveal ────────────────────────────────────────────── */
  function initReveal() {
    var reveals = $$('.reveal');
    if (!('IntersectionObserver' in window) ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      reveals.forEach(function (n) { n.classList.add('visible'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add('visible'); io.unobserve(entry.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach(function (n) { io.observe(n); });
  }

  /* ── Boot ─────────────────────────────────────────────────────── */
  function loadText(path) {
    return fetch(path, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(path + ': HTTP ' + r.status);
      return r.text();
    });
  }

  function fail(err) {
    console.error(err);
    var banner = el('div', 'load-error');
    banner.innerHTML = '<b>Content failed to load.</b> This site reads ' +
      '<code>info.txt</code> and <code>AIDisclaimer.txt</code> at runtime, which ' +
      'browsers block on <code>file://</code> pages. Serve the folder instead: ' +
      '<code>python3 -m http.server</code>, then open ' +
      '<code>http://localhost:8000</code>.';
    document.body.insertBefore(banner, document.body.firstChild);
  }

  // Exposed for debugging in the browser console (and for local smoke tests).
  window.Portfolio = {
    parseInfo: parseInfo,
    renderChrome: renderChrome,
    renderHome: renderHome,
    renderProjects: renderProjects,
    parseProjectFile: parseProjectFile,
    loadProjectFiles: loadProjectFiles,
    discoverProjectFiles: discoverProjectFiles,
    manifestPaths: manifestPaths,
    listingPaths: listingPaths,
    renderStatement: renderStatement
  };

  document.addEventListener('DOMContentLoaded', function () {
    initModal();
    initReveal();
    var yr = document.getElementById('year');
    if (yr) yr.textContent = new Date().getFullYear();

    Promise.all([loadText('info.txt'), loadText('AIDisclaimer.txt')])
      .then(function (results) {
        var info = parseInfo(results[0]);
        renderChrome(info);
        renderHome(info);
        renderStatement(results[1], info.one('ai').headline);
        return discoverProjectFiles(info).then(loadProjectFiles).then(function (extra) {
          renderProjects(info, extra);
          initReveal();
          honorHash();
        });
      })
      .catch(fail);
  });
})();
