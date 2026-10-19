// Adapted from taste-skill scripts/lint.mjs (MIT, see LICENSE and UPSTREAM). Each rule names the modes it
// runs in: "site" holds the marketing house rules, "app" the tells that hold on an application screen too.
// An app is allowed borders, shadows on overlays, mono for data, and whatever palette its brand chose.
//
// area: the step in the fix order a finding belongs to, so the audit lists the biggest problems first.

export const AREAS = ['idea', 'hierarchy', 'composition', 'type', 'imagery', 'colour', 'detail', 'motion'];

const BOTH = ['app', 'site'];
const SITE = ['site'];

export const RULES = [
  { level: 'FAIL', id: 'mono', modes: SITE, area: 'type', re: /\bfont-mono\b|font-family\s*:[^;{}]*(mono\b|monospace|Courier|Consolas|Menlo|Monaco)|(JetBrains|Geist|IBM\+?Plex|Space|DM|Roboto|Fragment|Azeret|Red\+?Hat|Martian|Commit|Departure|Fira)[+_ ]?Mono|Geist_Mono|GeistMono|Fira[+ ]Code|ui-monospace/i, message: 'Monospace type outside code.' },
  { level: 'FAIL', id: 'gradient', modes: SITE, area: 'colour', re: /(linear|radial|conic)-gradient\(|\bbg-(gradient|linear|radial|conic)-|\b(from|via)-(?!\[?0)[a-z]+-\d{2,3}\b/, message: 'Gradient fill. Use a flat colour or a real image; a neutral scrim over a photo is the one exception.' },
  { level: 'FAIL', id: 'gradient-text', modes: BOTH, area: 'colour', re: /bg-clip-text|background-clip\s*:\s*text|text-transparent/, message: 'Gradient or clipped text. Use a solid colour.' },
  { level: 'FAIL', id: 'shadow', modes: SITE, area: 'detail', re: /box-shadow\s*:\s*(?!none|0 0 #0000|var\(--tw)|\bshadow(-(sm|md|lg|xl|2xl|inner|\[[^\]]+\]))?(?=["'\s`])(?<!-shadow)|drop-shadow\(|\bdrop-shadow(-|\b)|text-shadow\s*:\s*(?!none)/, message: 'Shadow on an element at rest. Only real overlays (menu, dialog, sticky bar) carry one.' },
  { level: 'FAIL', id: 'numbering', modes: SITE, area: 'hierarchy', re: />\s*[(\[]?0[1-9][)\]]?\.?\s*<|["'`]\s*0[1-9]\s*["'`]|decimal-leading-zero|>\s*(Step|Phase|No\.?|Chapter)\s*0?\d\s*</i, message: 'Decorative index numbering (01, 02, 03).' },
  { level: 'FAIL', id: 'eyebrow', modes: SITE, area: 'hierarchy', re: /class(Name)?\s*=\s*["'`{][^"'`}]*\b(eyebrow|kicker|overline|pretitle|pre-title|suptitle|sup-title|tagline-label|section-label|section-tag)\b|\.(eyebrow|kicker|overline|pretitle|section-label|section-tag)\b\s*[{,]/i, message: 'Eyebrow or kicker label above a heading.' },
  { level: 'FAIL', id: 'micro-label', modes: BOTH, area: 'type', re: /(?=[^"'`]*\buppercase\b)(?=[^"'`]*\btracking-(wide|wider|widest|\[[^\]]+\])\b)(?=[^"'`]*\btext-(xs|\[1[0-3]px\]|\[0?\.[67]\d*rem\])\b)[^"'`]+/, message: 'Tiny uppercase letter-spaced label.' },
  { level: 'FAIL', id: 'purple', modes: BOTH, area: 'colour', re: /\b(bg|text|from|to|via|border|ring|fill|stroke|shadow|decoration|outline)-(purple|violet|indigo|fuchsia)-\d{2,3}\b|#(6366f1|8b5cf6|7c3aed|a855f7|4f46e5|a78bfa|818cf8|9333ea|6d28d9|c084fc)\b/i, message: 'Indigo or violet: the generated-page accent.' },
  { level: 'FAIL', id: 'claude-palette', modes: SITE, area: 'colour', re: /#(d97757|da7756|c15f3c|cc785c|bd5d3a|f0eee6|faf9f5|f5f4ed|eeece2|e8e6dc)\b/i, message: 'Assistant-brand cream or terracotta colour.' },
  { level: 'FAIL', id: 'emoji', modes: BOTH, area: 'imagery', re: /[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}\u{2600}-\u{26FF}]/u, message: 'Emoji used as UI. Use words or a real icon.' },
  { level: 'FAIL', id: 'lorem', modes: BOTH, area: 'idea', re: /lorem ipsum|dolor sit amet/i, message: 'Placeholder copy shipped.' },
  { level: 'FAIL', id: 'hairline', modes: SITE, area: 'detail', re: /<hr\b|\bdivide-[xy](-\d|\b)|\b(h|w)-px\b|border-(top|bottom|left|right)\s*:\s*(0?\.5|1)px|\bborder-[tblrxy](?![-\w])|\bborder-[tblrxy]-(?!0\b|none)\[?1?(px)?\]?(?=["'\s`])|height\s*:\s*1px/, message: 'Thin rule or divider line. Separate with space, tone, or scale.' },
  { level: 'WARN', id: 'outlined-box', modes: SITE, area: 'detail', re: /border\s*:\s*1px\s+solid|\bborder\b(?=[^"'`]*\brounded)/, message: 'A 1px outlined box. Prefer a filled surface or no box.' },
  { level: 'WARN', id: 'glass', modes: BOTH, area: 'detail', re: /backdrop-blur|backdrop-filter\s*:/, message: 'Backdrop blur. One sticky bar at most; glass cards are a tell.' },
  { level: 'WARN', id: 'copy', modes: BOTH, area: 'idea', re: /\b(unlock|unleash|supercharge|seamless(ly)?|elevate|empower(s|ing)?|revolutioni[sz]e|game[- ]chang(er|ing)|cutting[- ]edge|next[- ]gen(eration)?|world[- ]class|best[- ]in[- ]class|all[- ]in[- ]one|effortless(ly)?|blazing(ly)?[- ]fast|lightning[- ]fast|reimagin(e|ed|ing)|delve|tapestry|leverage|synergy|streamline|robust|holistic|turbocharge|transform the way|take your .{1,30} to the next level|say goodbye to|in today'?s|the future of|built for the modern|more than (just )?a)\b/i, message: 'Stock marketing phrase. Say the specific thing it does.' },
  { level: 'WARN', id: 'cta-copy', modes: BOTH, area: 'idea', re: />\s*(Learn more|Get started|Click here|Read more|Discover more|Explore now|Submit)\s*</i, message: 'Generic button label. Name the action or the thing.' },
  { level: 'WARN', id: 'oops-copy', modes: ['app'], area: 'idea', re: /["'`>]\s*(Oops|Uh oh|Whoops)\b/i, message: 'Cute error copy. Say what failed and what to do.' },
  { level: 'WARN', id: 'default-font', modes: SITE, area: 'type', re: /family=(Inter|Poppins|Montserrat|Roboto|Open\+Sans|Space\+Grotesk|Instrument\+Serif|Playfair\+Display|Plus\+Jakarta\+Sans|Outfit|Sora|Lato|Nunito|Raleway)\b|font-family\s*:\s*["']?(Inter|Poppins|Montserrat|Roboto|Space Grotesk|Instrument Serif|Playfair Display|Plus Jakarta Sans|Outfit|Sora)\b/, message: 'A default typeface.' },
  { level: 'WARN', id: 'alert', modes: ['app'], area: 'detail', re: /\bwindow\.alert\(|(?<![\w.])alert\(\s*["'`]/, message: 'window.alert for feedback. Show the message inline, next to what it is about.' },
  { level: 'WARN', id: 'z-index', modes: ['app'], area: 'detail', re: /z-index\s*:\s*\d{4,}|\bz-\[\d{4,}\]/, message: 'Arbitrary z-index. Use a named layer scale.' },
  { level: 'WARN', id: 'dead-link', modes: ['app'], area: 'detail', re: /href\s*=\s*["']#["']/, message: 'A link to "#". Point it somewhere real, or make it a button.' },
  { level: 'WARN', id: 'transition-all', modes: BOTH, area: 'motion', re: /transition\s*:\s*all\b|\btransition-all\b/, message: 'transition: all. Name the properties (transform, opacity).' },
  { level: 'WARN', id: 'ease-in', modes: BOTH, area: 'motion', re: /(?<![-\w])ease-in(?!-out)\b/, message: 'ease-in on UI feels sluggish. Use an ease-out for enters and exits.' },
  { level: 'WARN', id: 'scale-zero', modes: BOTH, area: 'motion', re: /scale\(\s*0\s*\)|\bscale-0\b/, message: 'Entering from scale(0). Start near 0.95 with opacity 0.' },
  { level: 'WARN', id: 'h-screen', modes: BOTH, area: 'composition', re: /\bh-screen\b|height\s*:\s*100vh/, message: '100vh jumps on mobile. Use 100svh or 100dvh.' },
  { level: 'WARN', id: 'bounce', modes: BOTH, area: 'motion', re: /animate-(bounce|ping|pulse)\b/, message: 'Looping attention animation.' },
];
