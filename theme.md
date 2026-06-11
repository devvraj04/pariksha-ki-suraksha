# THEME.md — Parikhsha Ki Surakhsha
## Design System & Style Guide for Coding Agents

> **Brand Identity:** Academic Integrity Secured  
> **Design Language:** Institutional Trust × Bento Glass  
> **Aesthetic:** Frosted glassmorphism layered over a structured bento grid, with skeuomorphic depth cues — feels like a premium government portal from 2026, not 2016.

---

## 1. COLOR PALETTE

### Core Colors (CSS Variables — add to `:root`)

```css
:root {
  /* ── Backgrounds ── */
  --color-bg-base:        #F2F1EE;   /* Ash White / Cream — primary page background */
  --color-bg-soft:        #ECEAE5;   /* Warm cream — secondary sections, alternating rows */
  --color-bg-glass:       rgba(255, 255, 255, 0.45);  /* Glass card fill */
  --color-bg-glass-dark:  rgba(220, 218, 215, 0.30);  /* Darker glass for nested layers */
  --color-bg-overlay:     rgba(242, 241, 238, 0.70);  /* Modal/drawer backdrop */

  /* ── Heritage Indigo ── */
  --color-indigo-900:     #0D1B3E;   /* Deepest — hero headers, top nav bar fill */
  --color-indigo-800:     #132252;   /* Dark nav text, section dividers */
  --color-indigo-700:     #1A2D6B;   /* Primary headings */
  --color-indigo-600:     #1E3A8A;   /* Active state, selected nav item */
  --color-indigo-500:     #2B4EBF;   /* Interactive links, focus rings */
  --color-indigo-400:     #4B6FD4;   /* Hover state */
  --color-indigo-100:     #D4DCF5;   /* Tinted chip backgrounds, tag fills */
  --color-indigo-050:     #EEF1FB;   /* Subtle highlight, hovered row bg */

  /* ── Metallic Gold ── */
  --color-gold-500:       #C9A84C;   /* Verified seal, premium badge border */
  --color-gold-400:       #D9BC6A;   /* Icon fill for "verified" states */
  --color-gold-300:       #E8D08E;   /* Subtle gold tint on hover */
  --color-gold-shine:     linear-gradient(135deg, #F0D080 0%, #C9A84C 40%, #A07830 70%, #D9BC6A 100%);
  /* Use --color-gold-shine for official seal borders, badge rings, and verified checkmarks */

  /* ── Status / Semantic ── */
  --color-success:        #1A7A4A;   /* Cleared / Verified green */
  --color-success-bg:     rgba(26, 122, 74, 0.10);
  --color-warning:        #B87B0A;   /* Pending / Caution amber */
  --color-warning-bg:     rgba(184, 123, 10, 0.10);
  --color-danger:         #B91C1C;   /* Flagged / Violation red */
  --color-danger-bg:      rgba(185, 28, 28, 0.10);
  --color-neutral:        #64748B;   /* Inactive, secondary text */

  /* ── Text ── */
  --color-text-primary:   #0D1B3E;   /* Same as indigo-900 — headings */
  --color-text-secondary: #374151;   /* Body copy */
  --color-text-muted:     #6B7280;   /* Captions, timestamps, helper text */
  --color-text-inverse:   #F9F9F7;   /* Text on dark indigo backgrounds */
  --color-text-gold:      #A07830;   /* Gold label text (not on white) */

  /* ── Borders & Dividers ── */
  --color-border-glass:   rgba(255, 255, 255, 0.60);  /* Glass card border (top/left) */
  --color-border-glass-b: rgba(180, 178, 174, 0.35);  /* Glass card border (bottom/right) */
  --color-border-indigo:  rgba(30, 58, 138, 0.20);    /* Structural indigo dividers */
  --color-border-gold:    rgba(201, 168, 76, 0.55);   /* Gold badge / seal border */
}
```

---

## 2. TYPOGRAPHY

### Font Stack

```css
:root {
  /* Display — Heritage serif for authority and trust */
  --font-display: 'Playfair Display', 'Noto Serif', Georgia, serif;

  /* UI / Body — Clean, modern, legible at small sizes */
  --font-body:    'Inter', 'DM Sans', system-ui, sans-serif;

  /* Data / Mono — Student IDs, exam codes, timestamps */
  --font-mono:    'JetBrains Mono', 'IBM Plex Mono', 'Fira Code', monospace;

  /* Devanagari / Hindi text support */
  --font-indic:   'Noto Sans Devanagari', 'Hind', sans-serif;
}
```

### Type Scale

```css
:root {
  --text-xs:    0.75rem;    /* 12px — micro labels, legal footnotes */
  --text-sm:    0.875rem;   /* 14px — table data, helper text */
  --text-base:  1rem;       /* 16px — default body */
  --text-lg:    1.125rem;   /* 18px — card titles, list headings */
  --text-xl:    1.25rem;    /* 20px — section headings */
  --text-2xl:   1.5rem;     /* 24px — page sub-headings */
  --text-3xl:   1.875rem;   /* 30px — page headings */
  --text-4xl:   2.25rem;    /* 36px — hero headings */
  --text-5xl:   3rem;       /* 48px — display / splash text */

  /* Letter spacing */
  --tracking-tight:   -0.025em;
  --tracking-normal:   0em;
  --tracking-wide:     0.05em;
  --tracking-widest:   0.15em;  /* Use for ALL-CAPS institutional labels */
}
```

### Type Roles

| Role | Font | Size | Weight | Notes |
|---|---|---|---|---|
| Hero title | `--font-display` | `--text-5xl` | 700 | Deep indigo, tight tracking |
| Page heading | `--font-display` | `--text-3xl` | 600 | |
| Section heading | `--font-body` | `--text-xl` | 600 | Indigo-700 |
| Card title | `--font-body` | `--text-lg` | 600 | |
| Body text | `--font-body` | `--text-base` | 400 | text-secondary |
| Table data | `--font-body` | `--text-sm` | 400 | |
| Exam code / ID | `--font-mono` | `--text-sm` | 500 | Gold or indigo tint |
| Institutional label | `--font-body` | `--text-xs` | 600 | ALL-CAPS, `--tracking-widest` |
| Hindi text | `--font-indic` | `--text-base` | 400 | Pair with English body size |

---

## 3. GLASS MORPHISM SYSTEM

### The Core Glass Layer

This is the signature visual — every card, panel, and modal must use one of these three glass levels.

```css
/* ── Level 1: Standard Glass Card ── */
.glass-card {
  background:           var(--color-bg-glass);
  backdrop-filter:      blur(16px) saturate(1.4);
  -webkit-backdrop-filter: blur(16px) saturate(1.4);
  border:               1px solid var(--color-border-glass);
  border-bottom-color:  var(--color-border-glass-b);
  border-right-color:   var(--color-border-glass-b);
  border-radius:        var(--radius-card);
  box-shadow:           var(--shadow-glass);
}

/* ── Level 2: Deep Glass (nested panels, sidebars) ── */
.glass-card-deep {
  background:           var(--color-bg-glass-dark);
  backdrop-filter:      blur(24px) saturate(1.6);
  -webkit-backdrop-filter: blur(24px) saturate(1.6);
  border:               1px solid rgba(255, 255, 255, 0.35);
  border-bottom-color:  rgba(160, 158, 154, 0.30);
  border-right-color:   rgba(160, 158, 154, 0.30);
  border-radius:        var(--radius-card);
  box-shadow:           var(--shadow-glass-deep);
}

/* ── Level 3: Frosted Modal / Overlay ── */
.glass-modal {
  background:           rgba(248, 247, 244, 0.75);
  backdrop-filter:      blur(32px) saturate(1.8) brightness(1.05);
  -webkit-backdrop-filter: blur(32px) saturate(1.8) brightness(1.05);
  border:               1px solid rgba(255, 255, 255, 0.70);
  border-radius:        var(--radius-modal);
  box-shadow:           var(--shadow-modal);
}
```

### Skeuomorphic Depth Cues

These are layered ON TOP of glassmorphism to add physical, tactile depth — the "skim" of light across a frosted surface.

```css
/* ── Top-light sheen (applied via ::before pseudo-element) ── */
.glass-card::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(
    160deg,
    rgba(255, 255, 255, 0.55) 0%,
    rgba(255, 255, 255, 0.10) 35%,
    transparent 60%
  );
  pointer-events: none;
  z-index: 0;
}

/* ── Embossed badge / seal (for verified status, official stamps) ── */
.skeu-badge {
  background:   linear-gradient(145deg, #E8D490, #C9A84C, #A07830);
  box-shadow:
    inset 0 1px 2px rgba(255, 245, 180, 0.60),  /* inner highlight */
    inset 0 -1px 2px rgba(80, 50, 0, 0.30),      /* inner shadow */
    0 2px 8px rgba(160, 120, 48, 0.45);           /* outer glow */
  border-radius: 50%;
}

/* ── Pressed / active skeuomorphic button ── */
.skeu-btn:active {
  box-shadow:
    inset 0 2px 4px rgba(0, 0, 0, 0.18),
    inset 0 1px 2px rgba(0, 0, 0, 0.12);
  transform: translateY(1px);
}

/* ── Inset data panel (like a physical recess in a desk) ── */
.skeu-inset {
  background:   rgba(210, 208, 204, 0.40);
  box-shadow:
    inset 0 2px 6px rgba(0, 0, 0, 0.10),
    inset 0 1px 3px rgba(0, 0, 0, 0.08);
  border-radius: var(--radius-sm);
  border: 1px solid rgba(160, 158, 154, 0.35);
}
```

---

## 4. BENTO GRID SYSTEM

The layout is a strict bento grid. Every screen is a collection of named glass cards arranged in a responsive grid. Each card has a clear single responsibility.

### Grid Variables

```css
:root {
  --grid-gap:       16px;   /* Standard gap between bento cells */
  --grid-gap-lg:    24px;   /* Dashboard / admin screens */
  --grid-cols:      12;     /* Base column count */
}
```

### Bento Cell Archetypes

Every card on every screen maps to one of these archetypes. Use these class names consistently.

```css
/* ── Stat Cell (small — key numbers: enrolled students, flags today) ── */
.bento-stat {
  grid-column: span 3;   /* 3/12 cols = 1/4 width on desktop */
  min-height: 120px;
  padding: var(--space-4) var(--space-5);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

/* ── Feature Cell (medium — exam schedule, student profile) ── */
.bento-feature {
  grid-column: span 6;
  min-height: 240px;
  padding: var(--space-5) var(--space-6);
}

/* ── Wide Cell (full-width bar — activity log, analytics chart) ── */
.bento-wide {
  grid-column: span 12;
  padding: var(--space-5) var(--space-6);
}

/* ── Tall Cell (sidebar-style — student details, security clearance) ── */
.bento-tall {
  grid-column: span 4;
  grid-row: span 2;
  padding: var(--space-5) var(--space-6);
}

/* ── Accent Cell (highlighted — today's active exam, alert) ── */
.bento-accent {
  grid-column: span 4;
  background: linear-gradient(
    135deg,
    rgba(19, 34, 82, 0.88) 0%,
    rgba(13, 27, 62, 0.92) 100%
  );
  border-color: rgba(201, 168, 76, 0.40);
  color: var(--color-text-inverse);
}

/* Responsive collapse */
@media (max-width: 1024px) {
  .bento-stat    { grid-column: span 6; }
  .bento-feature { grid-column: span 12; }
  .bento-tall    { grid-column: span 12; grid-row: span 1; }
}

@media (max-width: 640px) {
  .bento-stat    { grid-column: span 12; }
  .bento-accent  { grid-column: span 12; }
}
```

### Dashboard Layout Template

```
┌─────────────────────────────────────────────────────────────┐
│  NAV BAR  (indigo-900 bg, full width, glass underline)      │
├────────────┬────────────┬────────────┬────────────┬─────────┤
│  STAT CELL │  STAT CELL │  STAT CELL │  STAT CELL │ ACCENT  │
│  Total     │  Verified  │  Flagged   │  Live Now  │ CELL    │
│  Students  │  Today     │  Cases     │  Exams     │(Span 2) │
├────────────┴────────────┼────────────┴────────────┤         │
│   FEATURE CELL (span 6) │  FEATURE CELL (span 6)  ├─────────┤
│   Exam Schedule         │  Recent Flags / Alerts  │  TALL   │
│                         │                         │  CELL   │
├─────────────────────────┴─────────────────────────┤ Student │
│   WIDE CELL (span 12)                             │ Profile │
│   Activity Log / Analytics Chart                  │  Card   │
└───────────────────────────────────────────────────┴─────────┘
```

---

## 5. ELEVATION & SHADOW SYSTEM

```css
:root {
  /* Flat surface — no elevation (inside a glass card) */
  --shadow-none:        none;

  /* Glass card — floats over the page background */
  --shadow-glass:
    0 4px 16px rgba(13, 27, 62, 0.08),
    0 1px 4px  rgba(13, 27, 62, 0.06),
    0 0  0 1px rgba(255, 255, 255, 0.60) inset;

  /* Deep glass — nested, heavier layer */
  --shadow-glass-deep:
    0 8px 32px rgba(13, 27, 62, 0.12),
    0 2px 8px  rgba(13, 27, 62, 0.08),
    0 0  0 1px rgba(255, 255, 255, 0.40) inset;

  /* Modal / Drawer — highest elevation */
  --shadow-modal:
    0 24px 64px rgba(13, 27, 62, 0.20),
    0  8px 24px rgba(13, 27, 62, 0.12),
    0  0   0 1px rgba(255, 255, 255, 0.65) inset;

  /* Gold seal / badge glow */
  --shadow-gold:
    0 0 12px rgba(201, 168, 76, 0.40),
    0 0  4px rgba(201, 168, 76, 0.25);

  /* Danger flag glow */
  --shadow-danger:
    0 0 12px rgba(185, 28, 28, 0.25),
    0 0  4px rgba(185, 28, 28, 0.15);
}
```

---

## 6. BORDER RADIUS

```css
:root {
  --radius-xs:    4px;    /* Badges, micro chips */
  --radius-sm:    8px;    /* Input fields, small buttons */
  --radius-md:    12px;   /* Standard buttons */
  --radius-card:  16px;   /* All glass bento cards */
  --radius-modal: 20px;   /* Modals, drawers */
  --radius-full:  9999px; /* Pills, avatar rings, status dots */
}
```

---

## 7. SPACING SCALE

All spacing is based on a 4px base unit.

```css
:root {
  --space-1:   4px;
  --space-2:   8px;
  --space-3:   12px;
  --space-4:   16px;
  --space-5:   20px;
  --space-6:   24px;
  --space-7:   28px;
  --space-8:   32px;
  --space-10:  40px;
  --space-12:  48px;
  --space-16:  64px;
  --space-20:  80px;
}
```

---

## 8. COMPONENT SPECIFICATIONS

### Navigation Bar

```
Background:     var(--color-indigo-900)
Height:         64px desktop / 56px mobile
Left:           Logo (shield icon) + "Parikhsha Ki Surakhsha" in --font-display, text-inverse
Center:         Nav links in --font-body, --text-sm, tracking-widest, ALL-CAPS, text-inverse opacity-70 / 100 on active
Right:          User avatar + role badge + notification bell
Bottom border:  1px solid rgba(201, 168, 76, 0.30)  ← subtle gold line
Box shadow:     0 2px 16px rgba(0,0,0,0.25)
```

### Status Badges

```css
/* Verified (Gold seal) */
.badge-verified {
  background:     var(--color-gold-shine);
  color:          #3D2800;
  font-family:    var(--font-body);
  font-size:      var(--text-xs);
  font-weight:    700;
  letter-spacing: var(--tracking-widest);
  text-transform: uppercase;
  padding:        3px 10px;
  border-radius:  var(--radius-full);
  box-shadow:     var(--shadow-gold);
}

/* Cleared (Green) */
.badge-cleared {
  background:   var(--color-success-bg);
  color:        var(--color-success);
  border:       1px solid rgba(26, 122, 74, 0.30);
  /* same font/size/tracking as above */
}

/* Flagged (Red) */
.badge-flagged {
  background:   var(--color-danger-bg);
  color:        var(--color-danger);
  border:       1px solid rgba(185, 28, 28, 0.30);
  box-shadow:   var(--shadow-danger);
}

/* Pending (Amber) */
.badge-pending {
  background:   var(--color-warning-bg);
  color:        var(--color-warning);
  border:       1px solid rgba(184, 123, 10, 0.30);
}
```

### Primary Button (Indigo)

```css
.btn-primary {
  background:     linear-gradient(160deg, var(--color-indigo-600), var(--color-indigo-800));
  color:          var(--color-text-inverse);
  border:         1px solid rgba(255,255,255,0.15);
  border-radius:  var(--radius-md);
  padding:        10px 24px;
  font-family:    var(--font-body);
  font-size:      var(--text-sm);
  font-weight:    600;
  letter-spacing: var(--tracking-wide);
  text-transform: uppercase;
  box-shadow:     0 2px 8px rgba(13,27,62,0.30), inset 0 1px 0 rgba(255,255,255,0.20);
  transition:     all 0.15s ease;
}
.btn-primary:hover {
  background:   linear-gradient(160deg, var(--color-indigo-500), var(--color-indigo-700));
  box-shadow:   0 4px 16px rgba(13,27,62,0.35), inset 0 1px 0 rgba(255,255,255,0.20);
  transform:    translateY(-1px);
}
.btn-primary:active {
  transform:    translateY(1px);
  box-shadow:   inset 0 2px 4px rgba(0,0,0,0.20);
}
```

### Gold / Official Button

```css
.btn-official {
  background:     var(--color-gold-shine);
  color:          #3D2800;
  border:         1px solid rgba(160,120,48,0.50);
  box-shadow:
    0 2px 8px rgba(160,120,48,0.35),
    inset 0 1px 0 rgba(255,248,200,0.60),
    inset 0 -1px 0 rgba(100,70,0,0.20);
  /* same font/size/tracking/radius as btn-primary */
}
```

### Input Fields

```css
.input-field {
  background:       rgba(255, 255, 255, 0.55);
  backdrop-filter:  blur(8px);
  border:           1px solid var(--color-border-glass-b);
  border-top-color: rgba(255,255,255,0.70);
  border-radius:    var(--radius-sm);
  padding:          10px 14px;
  font-family:      var(--font-body);
  font-size:        var(--text-base);
  color:            var(--color-text-primary);
  box-shadow:       inset 0 2px 4px rgba(0,0,0,0.06);
  transition:       border-color 0.15s, box-shadow 0.15s;
}
.input-field:focus {
  outline:      none;
  border-color: var(--color-indigo-500);
  box-shadow:
    inset 0 2px 4px rgba(0,0,0,0.06),
    0 0 0 3px rgba(43, 78, 191, 0.18);
}
```

### Official Seal / Verified Mark

The gold stamp used on verified documents, cleared profiles, and official notices.

```css
.official-seal {
  width:  48px;
  height: 48px;
  border-radius:  var(--radius-full);
  background:     var(--color-gold-shine);
  box-shadow:
    inset 0 2px 4px rgba(255, 245, 180, 0.60),
    inset 0 -2px 4px rgba(80, 50, 0, 0.30),
    0 4px 12px rgba(160, 120, 48, 0.45),
    0 0 0 2px rgba(201, 168, 76, 0.60);
  display:        flex;
  align-items:    center;
  justify-content:center;
  color:          #3D2800;
}
/* For small inline verified icons — 20px ring */
.verified-ring {
  width:  20px;
  height: 20px;
  border-radius: var(--radius-full);
  background:    var(--color-gold-shine);
  box-shadow:    var(--shadow-gold);
}
```

---

## 9. BACKGROUND SYSTEM

The page background is not flat — it has a soft radial luminance that makes glass cards read clearly.

```css
body {
  background-color: var(--color-bg-base);
  background-image:
    radial-gradient(
      ellipse 80% 60% at 20% 10%,
      rgba(30, 58, 138, 0.07) 0%,
      transparent 60%
    ),
    radial-gradient(
      ellipse 60% 40% at 80% 90%,
      rgba(201, 168, 76, 0.05) 0%,
      transparent 50%
    );
  min-height: 100vh;
}

/* Indigo section (e.g. hero, full-width banners) */
.section-indigo {
  background:
    linear-gradient(160deg, var(--color-indigo-900) 0%, var(--color-indigo-800) 100%);
  /* Glass cards inside this section should use .glass-card-deep */
}
```

---

## 10. MOTION & TRANSITIONS

All animations are purposeful and restrained. Use only where they aid comprehension.

```css
:root {
  --ease-out-expo:  cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out:    cubic-bezier(0.4, 0, 0.2, 1);

  --duration-fast:  120ms;
  --duration-base:  200ms;
  --duration-slow:  350ms;
  --duration-enter: 450ms;
}

/* Card entrance (use on page load / route change) */
@keyframes cardEnter {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.99);
    backdrop-filter: blur(0px);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
    backdrop-filter: blur(16px);
  }
}
.glass-card { animation: cardEnter var(--duration-enter) var(--ease-out-expo) both; }

/* Stagger bento cells on dashboard load */
.bento-stat:nth-child(1) { animation-delay: 0ms; }
.bento-stat:nth-child(2) { animation-delay: 60ms; }
.bento-stat:nth-child(3) { animation-delay: 120ms; }
.bento-stat:nth-child(4) { animation-delay: 180ms; }

/* Hover lift for interactive cards */
.glass-card[role="button"],
.glass-card.clickable {
  transition:
    transform var(--duration-base) var(--ease-out-expo),
    box-shadow var(--duration-base) var(--ease-out-expo);
}
.glass-card.clickable:hover {
  transform:  translateY(-3px);
  box-shadow: var(--shadow-glass-deep);
}

/* Respect reduced motion */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 11. ICONOGRAPHY

- **Icon library:** Lucide Icons (stroke-based, clean, consistent 24px grid)
- **Stroke width:** `1.5px` for UI icons, `2px` for status/alert icons
- **Colors:**
  - Default UI icons: `var(--color-indigo-600)` or `var(--color-text-muted)`
  - Active / selected: `var(--color-indigo-600)`
  - Verified / gold: fill with `var(--color-gold-400)`
  - Danger / flag: `var(--color-danger)`
- **Shield icon** (brand mark): always render the logo in metallic — use a CSS gradient mask over the SVG path matching `--color-gold-shine`

---

## 12. DATA TABLE STYLE

Used for student lists, exam logs, flag reports.

```css
.data-table {
  width:            100%;
  border-collapse:  separate;
  border-spacing:   0 4px;   /* Row gap = skeuomorphic floating rows */
}

.data-table thead th {
  font-family:    var(--font-body);
  font-size:      var(--text-xs);
  font-weight:    600;
  letter-spacing: var(--tracking-widest);
  text-transform: uppercase;
  color:          var(--color-indigo-600);
  padding:        8px 16px;
  border-bottom:  2px solid var(--color-border-indigo);
}

.data-table tbody tr {
  background:     rgba(255, 255, 255, 0.40);
  backdrop-filter: blur(8px);
  border-radius:  var(--radius-sm);
  transition:     background var(--duration-fast);
}
.data-table tbody tr:hover {
  background:     rgba(255, 255, 255, 0.65);
}

.data-table tbody td {
  padding:    12px 16px;
  font-size:  var(--text-sm);
  color:      var(--color-text-secondary);
  border-top: 1px solid rgba(255,255,255,0.50);
}

/* Roll number / exam code cell */
.data-table .cell-code {
  font-family: var(--font-mono);
  font-size:   var(--text-xs);
  color:       var(--color-indigo-600);
  letter-spacing: 0.08em;
}
```

---

## 13. DARK MODE OVERRIDE

If/when you add dark mode, override only these variables. The glass system is designed to invert gracefully.

```css
@media (prefers-color-scheme: dark) {
  :root {
    --color-bg-base:        #0F1420;
    --color-bg-soft:        #141929;
    --color-bg-glass:       rgba(20, 28, 58, 0.55);
    --color-bg-glass-dark:  rgba(12, 18, 40, 0.60);
    --color-border-glass:   rgba(255, 255, 255, 0.12);
    --color-border-glass-b: rgba(80, 90, 140, 0.35);
    --color-text-primary:   #EEF1FB;
    --color-text-secondary: #C4CBE0;
    --color-text-muted:     #7A86A8;
  }
  body {
    background-image:
      radial-gradient(ellipse 80% 60% at 20% 10%, rgba(43, 78, 191, 0.12) 0%, transparent 60%),
      radial-gradient(ellipse 60% 40% at 80% 90%, rgba(201, 168, 76, 0.06) 0%, transparent 50%);
  }
}
```

---

## 14. TAILWIND CONFIG (if using Tailwind CSS)

If your stack uses Tailwind, extend the config with these values:

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        indigo: {
          50:  '#EEF1FB', 100: '#D4DCF5', 400: '#4B6FD4',
          500: '#2B4EBF', 600: '#1E3A8A', 700: '#1A2D6B',
          800: '#132252', 900: '#0D1B3E',
        },
        gold: {
          300: '#E8D08E', 400: '#D9BC6A', 500: '#C9A84C',
        },
        cream: { DEFAULT: '#F2F1EE', soft: '#ECEAE5' },
      },
      fontFamily: {
        display: ['"Playfair Display"', '"Noto Serif"', 'Georgia', 'serif'],
        body:    ['Inter', '"DM Sans"', 'system-ui', 'sans-serif'],
        mono:    ['"JetBrains Mono"', '"IBM Plex Mono"', 'monospace'],
        indic:   ['"Noto Sans Devanagari"', 'Hind', 'sans-serif'],
      },
      borderRadius: {
        card:  '16px',
        modal: '20px',
      },
      backdropBlur: {
        glass: '16px',
        deep:  '24px',
        modal: '32px',
      },
      boxShadow: {
        glass:      '0 4px 16px rgba(13,27,62,0.08), 0 1px 4px rgba(13,27,62,0.06)',
        'glass-deep':'0 8px 32px rgba(13,27,62,0.12), 0 2px 8px rgba(13,27,62,0.08)',
        gold:       '0 0 12px rgba(201,168,76,0.40), 0 0 4px rgba(201,168,76,0.25)',
        modal:      '0 24px 64px rgba(13,27,62,0.20), 0 8px 24px rgba(13,27,62,0.12)',
      },
    },
  },
}
```

---

## 15. ACCESSIBILITY REQUIREMENTS

These are non-negotiable regardless of aesthetic.

- **Focus rings:** All interactive elements must show `box-shadow: 0 0 0 3px rgba(43, 78, 191, 0.35)` on `:focus-visible`
- **Color contrast:** All body text must meet WCAG AA (4.5:1). Institutional labels (ALL-CAPS, tracking-widest) may use 3:1 as they are large text.
- **Gold text on white:** Never use `--color-gold-500` as text on `--color-bg-base` — it fails contrast. Use `--color-text-gold` (#A07830) instead.
- **Backdrop-filter fallback:** `background` must remain readable if `backdrop-filter` is unsupported — the glass card background values are opaque enough to fall back gracefully.
- **Screen reader labels:** Status badges must carry `aria-label` with full text (e.g., `aria-label="Status: Verified"`)

---

## 16. GOOGLE FONTS IMPORT

Add this to your root HTML `<head>`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&family=Noto+Sans+Devanagari:wght@400;600&display=swap" rel="stylesheet" />
```

---

## 17. QUICK REFERENCE — DO / DON'T

| ✅ DO | ❌ DON'T |
|---|---|
| Use bento grid with `gap: var(--grid-gap)` | Use arbitrary card sizes or free-floating layout |
| Apply `glass-card` to every panel/card | Use solid white or solid grey cards |
| Use `--font-display` for headings only | Use serif font for body copy |
| Use `--color-gold-shine` for verified/official only | Scatter gold everywhere decoratively |
| Show status always as a badge with correct semantic color | Use color alone to convey status (always pair with text) |
| Add `::before` sheen on glass cards | Add complex gradients inside card body |
| Stack bento cells in a 12-col grid | Mix random flex and grid containers |
| Use ALL-CAPS + `tracking-widest` for section labels | Use ALL-CAPS for body text or headings |
| Use `--font-mono` for IDs, codes, timestamps | Mix mono with body in the same sentence |
| Provide `aria-label` on icon-only buttons | Use icon-only buttons without accessible labels |

---

*THEME.md — v1.0 — Parikhsha Ki Surakhsha*  
*Maintain this file as the single source of truth. Any new component must derive all colors, spacing, radius, shadow, and type values from the variables defined here.*
