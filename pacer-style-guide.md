# Pacer — Design System & Style Guide

A running companion app. The aesthetic is **industrial utility** — bold display type, high contrast, purposeful structure. No decorative fluff. Every element earns its place.

---

## Themes

Pacer supports two themes: **Dark** (default) and **Light**. Both use the same layout, spacing, and typography. Only color values change. Always implement using CSS custom properties so toggling themes is a single class swap on the root element.

```css
/* Toggle by switching class on <html> or root container */
/* Dark: class="theme-dark"  |  Light: class="theme-light" */
```

---

## Color Tokens

### Dark Theme (Default)

```css
.theme-dark {
  --bg:             #111111;  /* Page / screen background */
  --surface:        #1A1A1A;  /* Cards, inputs, stat cells */
  --border:         #252525;  /* Dividers, cell gaps, outlines */
  --text-primary:   #FFFFFF;  /* Headlines, key numbers */
  --text-secondary: #888888;  /* Body copy, descriptions */
  --muted:          #444444;  /* Labels, placeholders, nav inactive */
  --accent:         #E8F400;  /* Electric yellow — CTA, hero card, active state, AI dot */
  --accent-text:    #111111;  /* Text on accent backgrounds */
}
```

### Light Theme

```css
.theme-light {
  --bg:             #F2F0EC;  /* Warm parchment — NOT pure white */
  --surface:        #E8E4DC;  /* Cards, inputs, stat cells */
  --border:         #D6D0C6;  /* Dividers, outlines */
  --text-primary:   #1A1A18;  /* Near-black, warm undertone */
  --text-secondary: #6B6760;  /* Body copy */
  --muted:          #A8A49C;  /* Labels, placeholders, nav inactive */
  --accent:         #1A1A18;  /* Charcoal — CTA, hero card, active state */
  --accent-text:    #F2F0EC;  /* Text on accent backgrounds */
}
```

> **Important:** The light theme accent is charcoal, not a color. This keeps the industrial character. Don't introduce a saturated accent color in light mode.

### Usage Rules

- `--bg` → screen/page background only
- `--surface` → any elevated element (cards, bottom sheet, input fields, stat blocks)
- `--border` → 1px dividers; also used as the "gap" color between grid cells
- `--accent` → used sparingly: hero metric card background, CTA button, active nav icon, AI indicator dot, route line on map
- `--muted` → everything deprioritized: timestamps, nav labels, section headers, helper text
- Never use raw hex values in component code — always reference a token

---

## Typography

### Typefaces

| Role | Font | Weight | Notes |
|---|---|---|---|
| **Display / Headlines** | Bebas Neue | 400 (only weight) | All caps by nature, loose tracking |
| **Mono / Labels / UI** | IBM Plex Mono | 400 / 700 | Timestamps, section labels, nav, toggle |
| **Body / Coach copy** | DM Sans | 300 / 400 | Lightweight, readable at small sizes |

### Import

```css
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=IBM+Plex+Mono:wght@400;700&family=DM+Sans:wght@300;400;500&display=swap');
```

### Type Scale

```css
/* Display — app name, screen titles, user greeting */
.text-display {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 40–48px;
  line-height: 1;
  letter-spacing: 0.04em;
  /* Bebas is always uppercase — no text-transform needed */
}

/* Hero metric — the big number (distance, pace, time) */
.text-hero-metric {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 64–72px;
  line-height: 1;
  letter-spacing: 0.02em;
}

/* Stat value — secondary numbers in grid cells */
.text-stat {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 22–26px;
  line-height: 1;
  letter-spacing: 0.04em;
}

/* CTA button text */
.text-cta {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 18–20px;
  letter-spacing: 0.1em;
}

/* Section label / eyebrow — prefix with // */
.text-label {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 9–10px;
  letter-spacing: 0.18–0.22em;
  text-transform: uppercase;
  color: var(--muted);
}

/* Unit tag (km, min/km, kcal) */
.text-unit {
  font-family: 'IBM Plex Mono', monospace;
  font-weight: 700;
  font-size: 10–12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  opacity: 0.7; /* Slightly de-emphasized vs the number */
}

/* Toggle buttons, nav labels */
.text-ui-mono {
  font-family: 'IBM Plex Mono', monospace;
  font-weight: 700;
  font-size: 7–10px;
  letter-spacing: 0.14–0.18em;
  text-transform: uppercase;
}

/* Status bar, timestamps */
.text-timestamp {
  font-family: 'IBM Plex Mono', monospace;
  font-weight: 400;
  font-size: 10px;
  color: var(--muted);
}

/* Body / AI coach copy */
.text-body {
  font-family: 'DM Sans', sans-serif;
  font-weight: 300;
  font-size: 10–12px;
  line-height: 1.5–1.6;
  color: var(--text-secondary);
}
```

---

## Spacing & Layout

```css
/* Base unit: 4px. All spacing is multiples of 4. */
--space-1:  4px;
--space-2:  8px;
--space-3:  12px;
--space-4:  16px;
--space-5:  20px;
--space-6:  24px;
--space-8:  32px;

/* Horizontal gutter from screen edge */
--page-x: 18px;
```

---

## Components

### Hero Metric Card

The dominant element on the home screen. Always `--accent` background.

```css
.metric-hero {
  background: var(--accent);
  margin: 14px var(--page-x);
  border-radius: 10px;
  padding: 18px 20px;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  position: relative;
  overflow: hidden;
}

/* Decorative rings — subtle depth, don't modify */
.metric-hero::before {
  content: '';
  position: absolute;
  top: -20px; right: -20px;
  width: 90px; height: 90px;
  border: 18px solid rgba(0, 0, 0, 0.06);
  border-radius: 50%;
}
.metric-hero::after {
  content: '';
  position: absolute;
  bottom: -30px; left: 30px;
  width: 70px; height: 70px;
  border: 12px solid rgba(0, 0, 0, 0.04);
  border-radius: 50%;
}

.metric-hero .value {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 68px;
  line-height: 1;
  letter-spacing: 0.02em;
  color: var(--accent-text);
}

.metric-hero .unit  { color: var(--accent-text); opacity: 0.7; }
.metric-hero .label { color: var(--accent-text); opacity: 0.5; }
```

### Stat Grid

Three-column grid below the hero card. Uses `--border` as gap color.

```css
.stats-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 1px;
  margin: 0 var(--page-x);
  background: var(--border);  /* Creates visual dividers */
  border-radius: 8px;
  overflow: hidden;
}

.stat {
  background: var(--surface);
  padding: 12px 10px;
  text-align: center;
}

.stat .val {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 24px;
  line-height: 1;
  letter-spacing: 0.04em;
  color: var(--text-primary);
}

.stat .lbl {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 8px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--muted);
  margin-top: 3px;
}
```

### AI Coach Chip

Inline callout for AI-generated coaching text. The pulsing dot signals live AI.

```css
.ai-chip {
  margin: 10px var(--page-x) 0;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  gap: 9px;
  align-items: center;
}

.ai-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--accent);
  flex-shrink: 0;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.3; }
}

/* Highlighted keyword in coach text */
.ai-chip strong {
  color: var(--accent);
  font-weight: 500;
  font-family: 'DM Sans', sans-serif;
}
```

### CTA Button

Primary action. Full-width, accent background.

```css
.cta-btn {
  margin: 12px var(--page-x) 0;
  background: var(--accent);
  border-radius: 8px;
  padding: 14px;
  text-align: center;
  color: var(--accent-text);
  font-family: 'Bebas Neue', sans-serif;
  font-size: 20px;
  letter-spacing: 0.1em;
  cursor: pointer;
}
```

### Section Label

Eyebrow text above content sections. Always prefixed with `//`.

```css
.section-label {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 9px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--muted);
  margin-bottom: 8px;
}

/* Examples: "// Today's Route"  "// Weekly Stats"  "// AI Insights" */
```

### Theme Toggle

Segmented control. IBM Plex Mono for button labels.

```css
.toggle-strip {
  margin: 10px var(--page-x) 0;
  display: flex;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--border);
}

.toggle-btn {
  flex: 1;
  padding: 7px 0;
  font-family: 'IBM Plex Mono', monospace;
  font-weight: 700;
  font-size: 9px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  background: transparent;
  color: var(--muted);
  border: none;
}

.toggle-btn.active {
  background: var(--accent);
  color: var(--accent-text);
}
```

### Bottom Navigation

```css
.bottom-nav {
  margin-top: auto;
  display: flex;
  justify-content: space-around;
  padding: 11px 0 16px;
  border-top: 1px solid var(--border);
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 7px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted);
}

.nav-item.active {
  color: var(--accent);
}
```

---

## Border Radius

```
Phone frame:            36px
Cards (metric hero):    10px
Stat grid / chips:      8px
Toggle strip:           6px
Standalone pill:        50px
```

---

## Do / Don't

| ✅ Do | ❌ Don't |
|---|---|
| Bebas Neue for all numbers and headlines | Any other display font |
| IBM Plex Mono for all labels, nav, toggles | Mixing mono fonts |
| `--accent` on one dominant element per screen | Multiple colored accents on the same screen |
| Warm parchment `#F2F0EC` in light mode | Pure white `#FFFFFF` backgrounds |
| Section labels prefixed with `//` | Decorative icons or emoji in UI chrome |
| 1px `--border` used as gap in grids | Drop shadows in dark mode |
| DM Sans 300 for coach/body copy | Heavy body text weights |

---

## Theme Toggle — Implementation Pattern (Vue 3)

```javascript
// composables/useTheme.js
import { ref, watchEffect } from 'vue'

const theme = ref(localStorage.getItem('pacer-theme') || 'theme-dark')

watchEffect(() => {
  document.documentElement.className = theme.value
  localStorage.setItem('pacer-theme', theme.value)
})

export function useTheme() {
  const toggle = () => {
    theme.value = theme.value === 'theme-dark' ? 'theme-light' : 'theme-dark'
  }
  return { theme, toggle }
}
```

```css
/* main.css — define tokens on html element so all components inherit */
html.theme-dark  { /* dark tokens */ }
html.theme-light { /* light tokens */ }
```

```vue
<!-- Usage in any component -->
<script setup>
import { useTheme } from '@/composables/useTheme'
const { theme, toggle } = useTheme()
</script>

<template>
  <button @click="toggle">
    {{ theme === 'theme-dark' ? 'Light' : 'Dark' }}
  </button>
</template>
```

---

*Style guide for Pacer · Bebas Neue + IBM Plex Mono · May 2026*
