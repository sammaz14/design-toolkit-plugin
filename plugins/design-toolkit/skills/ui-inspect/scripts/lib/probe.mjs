// Adapted from taste-skill scripts/lib/probe.mjs (MIT, see LICENSE and UPSTREAM): only the measurements
// that hold for an application screen are kept, and the text checks reach body-size type.
//
// Both functions run INSIDE the page (serialised and evaluated through cdp.mjs), so each must stay
// self-contained: no imports, no closures over module scope.

// ignore: a CSS selector (or null) for elements whose text and images are left out of every check.
export function probe(ignore) {
  const W = innerWidth, H = innerHeight, SY = scrollY;
  const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

  // Canvas normalises any CSS colour (oklch(), color(), named) to sRGB bytes.
  const cvs = document.createElement('canvas'); cvs.width = cvs.height = 1;
  const ctx = cvs.getContext('2d', { willReadFrequently: true });
  const colorCache = new Map();
  const rgba = (c) => {
    if (colorCache.has(c)) return colorCache.get(c);
    ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = 'rgba(0,0,0,0)'; ctx.fillStyle = c; ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    const v = { r: d[0], g: d[1], b: d[2], a: round(d[3] / 255) };
    colorCache.set(c, v); return v;
  };
  const hex = (v) => '#' + [v.r, v.g, v.b].map((n) => n.toString(16).padStart(2, '0')).join('');
  const lum = (v) => {
    const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(v.r) + 0.7152 * f(v.g) + 0.0722 * f(v.b);
  };
  const contrast = (a, b) => { const l1 = lum(a), l2 = lum(b); return round((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05), 1); };

  const firstFam = (ff) => ff.split(',')[0].replace(/["']/g, '').trim();
  // A short class path (up to three levels) that names an element and can be passed to --ignore. Ids are
  // left out: apps often suffix them per view, so they do not survive a reload.
  const pathOf = (el) => {
    const parts = [];
    for (let p = el; p && p !== document.body && parts.length < 3; p = p.parentElement) {
      const classes = [...p.classList].slice(0, 2).map((c) => '.' + CSS.escape(c)).join('');
      parts.unshift(p.tagName.toLowerCase() + classes);
    }
    return parts.join(' > ');
  };
  // Text kept for screen readers only (.sr-only, .visually-hidden) is not on the screen.
  const srHidden = (el) => {
    for (let p = el, i = 0; p && p !== document.body && i < 4; p = p.parentElement, i++) {
      const cs = getComputedStyle(p); const r = p.getBoundingClientRect();
      if (cs.clip === 'rect(0px, 0px, 0px, 0px)' || /inset\(50%\)/.test(cs.clipPath) || (r.width <= 2 && r.height <= 2 && cs.overflow !== 'visible')) return true;
    }
    return false;
  };
  // Generic keywords measure the same as a generic fallback by definition, and system faces are never a fault.
  const GENERIC = /^(serif|sans-serif|monospace|system-ui|ui-sans-serif|ui-serif|ui-monospace|ui-rounded|cursive|fantasy|inherit|-apple-system|BlinkMacSystemFont|Segoe UI|Arial|Helvetica|Helvetica Neue|Times New Roman|Times|Georgia|Verdana|Tahoma|Courier New|Courier|Roboto|Apple Color Emoji|SF Pro Text|SF Pro Display|SFMono-Regular|Menlo|Monaco|Consolas)$/i;

  const all = [...document.body.querySelectorAll('*')].slice(0, 9000);
  const texts = [];
  for (const el of all) {
    if (ignore && el.closest(ignore)) continue;
    const tag = el.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'TEMPLATE' || tag === 'OPTION') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    let direct = '';
    for (const n of el.childNodes) if (n.nodeType === 3) direct += n.nodeValue;
    direct = direct.replace(/\s+/g, ' ').trim();
    if (!direct || el.closest('svg') || srHidden(el)) continue;
    const size = parseFloat(cs.fontSize);
    if (!size || size < 6) continue;
    texts.push({
      el, text: direct, chars: direct.length, fam: firstFam(cs.fontFamily), size: round(size, 1),
      weight: +cs.fontWeight || 400, color: cs.color, top: r.top + SY, w: r.width,
      inCode: !!el.closest('pre, code, kbd, samp, textarea'),
    });
  }

  // --- type system
  const famChars = new Map(); const sizeSet = new Set(); let totalChars = 0;
  for (const t of texts) {
    totalChars += t.chars;
    famChars.set(t.fam, (famChars.get(t.fam) || 0) + t.chars);
    sizeSet.add(Math.round(t.size));
  }
  const families = [...famChars.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([family, chars]) => ({ family, share: round(chars / Math.max(1, totalChars)) }));
  const sizes = [...sizeSet].sort((a, b) => a - b);
  const bodyTexts = texts.filter((t) => t.size >= 10 && t.size <= 24 && t.chars >= 60 && !t.inCode);
  const longest = bodyTexts.slice().sort((a, b) => b.chars - a.chars)[0];
  const small = texts.filter((t) => t.size < 12 && !t.inCode);
  // A face that renders, whether from @font-face or installed on the host, changes the width of a sample
  // against both generic fallbacks; one that fell back matches them.
  const mctx = document.createElement('canvas').getContext('2d');
  const width = (font) => { mctx.font = `40px ${font}`; return mctx.measureText('mmmmwwwwiiiilll 0123 AaBbQq').width; };
  const fellBack = (f) => ['monospace', 'serif'].every((g) => width(`"${f}", ${g}`) === width(g));
  const notLoaded = families.map((f) => f.family).filter((f) => !GENERIC.test(f) && fellBack(f));

  // --- contrast
  const bodyBg = (() => {
    for (const el of [document.body, document.documentElement]) { const v = rgba(getComputedStyle(el).backgroundColor); if (v.a > 0.5) return v; }
    return { r: 255, g: 255, b: 255, a: 1 };
  })();
  // The solid ground behind an element, or null when an image, gradient, or overlapping layer may sit there.
  // Source-over: a translucent colour laid on an opaque one.
  const over = (top, under) => ({ r: Math.round(top.r * top.a + under.r * (1 - top.a)), g: Math.round(top.g * top.a + under.g * (1 - top.a)), b: Math.round(top.b * top.a + under.b * (1 - top.a)), a: 1 });
  // Translucent tints on the way up are kept and laid over the first opaque ground, top layer last, so a
  // tinted badge is measured against the colour a person sees, not the page under the tint.
  const bgBehind = (el) => {
    const tints = [];
    let ground = bodyBg;
    for (let p = el; p && p !== document.documentElement; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.backgroundImage !== 'none' || p.tagName === 'VIDEO' || p.tagName === 'CANVAS') return null;
      const v = rgba(cs.backgroundColor);
      if (v.a >= 0.99) { ground = v; break; }
      if (v.a > 0) tints.push(v);
      if (cs.position === 'absolute' || cs.position === 'fixed') return null;
    }
    return tints.reduceRight((under, tint) => over(tint, under), ground);
  };
  const lowContrast = [];
  for (const t of texts) {
    if (t.chars < 2 || t.top - SY > H * 6) continue;
    // WCAG exempts disabled controls from the contrast minimum.
    if (t.el.closest(':disabled, [aria-disabled="true"]')) continue;
    const fgRaw = rgba(t.color); if (fgRaw.a < 0.05) continue;
    let blended = false;
    for (let p = t.el, i = 0; p && p !== document.body && i < 6; p = p.parentElement, i++) if (/difference|exclusion/.test(getComputedStyle(p).mixBlendMode)) { blended = true; break; }
    if (blended) continue;
    const bg = bgBehind(t.el); if (!bg) continue;
    const fg = fgRaw.a < 0.99 ? over(fgRaw, bg) : fgRaw;
    const c = contrast(fg, bg); const need = t.size >= 24 || (t.size >= 18.5 && t.weight >= 700) ? 3 : 4.5;
    if (c < need) lowContrast.push({ text: t.text.slice(0, 40), at: pathOf(t.el), ratio: c, need, fg: hex(fg), bg: hex(bg) });
  }
  lowContrast.sort((a, b) => a.ratio - b.ratio);

  // --- breakage
  const brokenImages = [...document.images].filter((i) => !(ignore && i.closest(ignore)) && i.complete && i.naturalWidth === 0 && i.getBoundingClientRect().width > 0 && (i.currentSrc || i.src)).map((i) => (i.currentSrc || i.src).slice(0, 120));
  let overflowCulprits = [];
  const doc = document.documentElement;
  if (doc.scrollWidth > W + 2) {
    const clippedByAncestor = (el) => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { if (getComputedStyle(p).overflowX !== 'visible' && p.getBoundingClientRect().right <= W + 2) return true; } return false; };
    const wide = all.filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > W + 2 && !clippedByAncestor(el); });
    overflowCulprits = wide.filter((el) => !wide.some((o) => o !== el && el.contains(o))).slice(0, 3).map((el) => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.classList.length ? '.' + [...el.classList].slice(0, 2).join('.') : ''} (+${Math.round(el.getBoundingClientRect().right - W)}px)`);
  }
  // Tables, code, and grids scroll sideways by design; any other row cut at its edge reads as clipped.
  const sideScrollers = all.filter((el) => {
    if (el.closest('table, pre, code, [role="grid"], [role="tablist"], [data-scroll-x]')) return false;
    const cs = getComputedStyle(el);
    return /auto|scroll/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 24 && el.clientHeight > 40;
  }).length;

  return {
    viewport: { w: W, h: H },
    page: { height: Math.max(doc.scrollHeight, document.body.scrollHeight), horizontalOverflow: doc.scrollWidth > W + 2 ? doc.scrollWidth - W : 0, overflowCulprits, sideScrollers, brokenImages },
    type: {
      families, sizes, sizeCount: sizes.length, notLoaded,
      measureChars: longest ? Math.round(longest.w / (longest.size * 0.5)) : null,
      small: small.map((t) => ({ text: t.text.slice(0, 32), at: pathOf(t.el), size: t.size })),
    },
    lowContrast,
  };
}

// frame() runs at each scroll position. It reports text that another element paints over, and text cut
// off by a box that clips it without an ellipsis or a line clamp.
export function frame(ignore) {
  const W = innerWidth, H = innerHeight;
  // Content scrolls under a pinned bar (a header, a composer) by design, but only where scrolling back
  // reveals it: a top bar over content at scroll 0, or a bottom bar at the page end, hides it for good.
  // A pinned layer half the viewport tall or more (a side nav, a full-screen layer) never scrolls off it.
  // A sticky bar pins inside its nearest scrolling box, so that box's scroll and height decide; a fixed
  // bar, or a sticky one with no scrolling ancestor, pins to the window.
  const scrollerOf = (p) => { for (let a = p.parentElement; a && a !== document.body; a = a.parentElement) if (/auto|scroll/.test(getComputedStyle(a).overflowY)) return a; return null; };
  const revealable = (el) => {
    for (let p = el; p && p !== document.body; p = p.parentElement) {
      const pos = getComputedStyle(p).position;
      if (pos !== 'fixed' && pos !== 'sticky') continue;
      const box = pos === 'sticky' ? scrollerOf(p) : null;
      const top = box ? box.getBoundingClientRect().top : 0;
      const height = box ? box.clientHeight : H;
      const at = box ? box.scrollTop : scrollY;
      const max = box ? box.scrollHeight - box.clientHeight : document.documentElement.scrollHeight - H;
      const r = p.getBoundingClientRect();
      if (r.height >= height / 2) return false;
      return (r.top + r.bottom) / 2 - top < height / 2 ? at > 0 : at < max - 1;
    }
    return false;
  };
  // An open menu, dialog, or tooltip covers the screen on purpose; the state shows it doing so.
  const OVERLAY = 'dialog, [role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [role="tooltip"], [popover]';
  // Hit-testing skips pointer-events: none, which would make whatever lies beneath look as if it were on top.
  const hitStyle = document.createElement('style');
  hitStyle.textContent = '*, *::before, *::after { pointer-events: auto !important; }';
  document.head.appendChild(hitStyle);
  const covered = [], clipped = [];
  const label = (el, direct) => (el.innerText || direct).replace(/\s+/g, ' ').trim().slice(0, 48);
  // Same as probe()'s pathOf: each function is serialised into the page alone, so neither can share it.
  // A short class path (up to three levels) that names an element and can be passed to --ignore. Ids are
  // left out: apps often suffix them per view, so they do not survive a reload.
  const pathOf = (el) => {
    const parts = [];
    for (let p = el; p && p !== document.body && parts.length < 3; p = p.parentElement) {
      const classes = [...p.classList].slice(0, 2).map((c) => '.' + CSS.escape(c)).join('');
      parts.unshift(p.tagName.toLowerCase() + classes);
    }
    return parts.join(' > ');
  };
  // Canvas normalises any computed colour syntax (oklch(), color()) before its alpha is read.
  const cvs = document.createElement('canvas'); cvs.width = cvs.height = 1;
  const ctx = cvs.getContext('2d', { willReadFrequently: true });
  const alpha = (c) => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = 'rgba(0,0,0,0)'; ctx.fillStyle = c; ctx.fillRect(0, 0, 1, 1); return ctx.getImageData(0, 0, 1, 1).data[3] / 255; };
  // A transparent layout box on top hides nothing; only something that paints does.
  // Hit-testing reaches layers a person never sees (pointer-events are forced on), so a layer at near-zero
  // opacity, at any depth, hides nothing.
  const seen = (hit) => { let o = 1; for (let p = hit; p && p !== document.documentElement; p = p.parentElement) o *= +getComputedStyle(p).opacity; return o > 0.05; };
  // A gradient with a see-through stop is a fade or a scrim over content, not a cover.
  const COLOR = /(?:rgba?|hsla?|oklch|oklab|lab|lch|color)\([^)]*\)|transparent/g;
  const coversWith = (bg) => /url\(/.test(bg) || (bg.match(COLOR) || []).every((c) => alpha(c) >= 0.5);
  const paints = (hit, el) => {
    if (!seen(hit)) return false;
    for (let p = hit; p && p !== document.body && !p.contains(el); p = p.parentElement) {
      if (/^(IMG|VIDEO|CANVAS|PICTURE|IFRAME|svg)$/.test(p.tagName) || p.closest('svg')) return true;
      const pcs = getComputedStyle(p);
      if (pcs.backgroundImage !== 'none' && coversWith(pcs.backgroundImage)) return true;
      if (alpha(pcs.backgroundColor) > 0.05) return true;
      if (p === hit) for (const n of p.childNodes) if (n.nodeType === 3 && n.nodeValue.trim()) return true;
    }
    return false;
  };
  for (const el of document.body.querySelectorAll('*')) {
    if (ignore && el.closest(ignore)) continue;
    let direct = ''; for (const n of el.childNodes) if (n.nodeType === 3) direct += n.nodeValue;
    if (direct.trim().length < 2 || el.closest('svg, script, style, option')) continue;
    const cs = getComputedStyle(el); const size = parseFloat(cs.fontSize);
    if (size < 9 || cs.visibility === 'hidden' || +cs.opacity < 0.3) continue;
    let srOnly = false;
    for (let p = el, i = 0; p && p !== document.body && i < 4; p = p.parentElement, i++) { const pcs = getComputedStyle(p); const pr = p.getBoundingClientRect(); if (pcs.clip === 'rect(0px, 0px, 0px, 0px)' || /inset\(50%\)/.test(pcs.clipPath) || (pr.width <= 2 && pr.height <= 2 && pcs.overflow !== 'visible')) { srOnly = true; break; } }
    if (srOnly) continue;
    // Boxes that hide what overflows them, per axis. A box that scrolls on an axis reveals what it cuts
    // there, so that axis stops: an outer shell around a scrolling pane cuts nothing new on it. CSS computes
    // overflow-y: auto for overflow-x: hidden alone. An ellipsis marks its own box's side cut on purpose,
    // and a line clamp its own box's bottom cut; neither excuses any other cut.
    const clips = [];
    let openX = true, openY = true;
    for (let p = el; p && p !== document.body && (openX || openY); p = p.parentElement) {
      const pcs = getComputedStyle(p);
      const hides = (v) => v === 'hidden' || v === 'clip';
      const cp = pcs.clipPath !== 'none';
      const ellipsis = pcs.textOverflow === 'ellipsis';
      const clamp = pcs.webkitLineClamp && pcs.webkitLineClamp !== 'none';
      const x = openX && !ellipsis && (hides(pcs.overflowX) || cp), y = openY && !clamp && (hides(pcs.overflowY) || cp);
      if (x || y) clips.push({ r: p.getBoundingClientRect(), x, y, hidesX: hides(pcs.overflowX) || cp, hidesY: hides(pcs.overflowY) || cp });
      if (/auto|scroll/.test(pcs.overflowX)) openX = false;
      if (/auto|scroll/.test(pcs.overflowY)) openY = false;
    }
    // Text a scrolling or clipping box has hidden is not on screen, so nothing can cover it there.
    const view = { left: 0, top: 0, right: W, bottom: H };
    for (let p = el; p && p !== document.body; p = p.parentElement) {
      const pcs = getComputedStyle(p);
      if (pcs.overflowX === 'visible' && pcs.overflowY === 'visible') continue;
      const pr = p.getBoundingClientRect();
      view.left = Math.max(view.left, pr.left); view.top = Math.max(view.top, pr.top);
      view.right = Math.min(view.right, pr.right); view.bottom = Math.min(view.bottom, pr.bottom);
    }
    const inOverlay = !!el.closest(OVERLAY);
    const unit = el.closest('h1, h2, h3, h4, h5, h6, p, blockquote, li, button, a, label');
    const range = document.createRange(); let total = 0, hidden = 0;
    // Text is cut when part of it shows inside a clip box and part reaches past it, a line partly or a
    // whole line wholly. Text the box hides completely (a closed panel) shows nothing to cut.
    const shows = clips.map(() => false), past = clips.map(() => false);
    // A range keeps its untruncated width inside an ellipsis box, but the text a person sees ends at that
    // box's edge, so no box outside it can cut the hidden part.
    let ellipsisBox = null;
    for (let p = el; p && p !== document.body; p = p.parentElement) {
      const pcs = getComputedStyle(p);
      if (pcs.textOverflow === 'ellipsis' && /hidden|clip/.test(pcs.overflowX)) { ellipsisBox = p.getBoundingClientRect(); break; }
    }
    for (const node of el.childNodes) {
      if (node.nodeType !== 3 || !node.nodeValue.trim()) continue;
      range.selectNodeContents(node);
      for (const raw of range.getClientRects()) {
        if (raw.width < 4) continue;
        const r = ellipsisBox ? { left: Math.max(raw.left, ellipsisBox.left), right: Math.min(raw.right, ellipsisBox.right), top: raw.top, bottom: raw.bottom, height: raw.height } : raw;
        // A glyph box carries ascender and descender room, so a cut of a few pixels shows nothing.
        const slack = r.height * 0.25;
        clips.forEach((c, i) => {
          if (Math.min(r.right, c.r.right) > Math.max(r.left, c.r.left) && Math.min(r.bottom, c.r.bottom) > Math.max(r.top, c.r.top)) shows[i] = true;
          // A line a box hides on one axis is judged on the other only where it shows: a line a clamp or a
          // short box hides below cuts nothing at the side, however far its long word runs. A box that only
          // scrolls or shows on that axis (overflow-x: hidden alone computes overflow-y: auto) lets the line
          // be seen, so its side cut counts wherever the line is.
          const showsY = !c.hidesY || Math.min(r.bottom, c.r.bottom) - Math.max(r.top, c.r.top) > slack;
          const showsX = !c.hidesX || Math.min(r.right, c.r.right) - Math.max(r.left, c.r.left) > 2;
          if ((c.x && showsY && (r.right > c.r.right + 2 || r.left < c.r.left - 2)) || (c.y && showsX && (r.bottom > c.r.bottom + slack || r.top < c.r.top - slack))) past[i] = true;
        });
      }
    }
    const cut = clips.some((_, i) => shows[i] && past[i]);
    for (const node of el.childNodes) {
      if (node.nodeType !== 3 || !node.nodeValue.trim()) continue;
      range.selectNodeContents(node);
      for (const r of range.getClientRects()) {
        if (r.width < 4 || r.bottom < 0 || r.top > H) continue;
        for (const fx of [0.15, 0.5, 0.85]) {
          const x = r.left + r.width * fx, y = r.top + r.height * 0.55; if (x < view.left || x >= view.right || y < view.top || y >= view.bottom) continue;
          total++; const hit = document.elementFromPoint(x, y);
          if (!hit || hit === el || el.contains(hit) || hit.contains(el) || revealable(hit)) continue;
          if (unit && unit.contains(hit) && !/^(IMG|VIDEO|CANVAS|PICTURE|svg)$/.test(hit.tagName) && !hit.closest('svg')) continue;
          if (!inOverlay && hit.closest(OVERLAY)) continue;
          if (paints(hit, el)) hidden++;
        }
      }
    }
    if (total >= 3 && hidden / total >= 0.34) covered.push({ text: label(el, direct), at: pathOf(el), share: Math.round((hidden / total) * 100) / 100 });
    if (cut) clipped.push({ text: label(el, direct), at: pathOf(el) });
  }
  hitStyle.remove();
  return { covered, clipped, y: Math.round(scrollY) };
}
