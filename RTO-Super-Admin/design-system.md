# Design system

A portable design system for React admin consoles: a blue gradient brand on a light slate canvas, Inter type, rounded cards, and light and dark themes. It was extracted from a working application and is written for someone starting a new project who has never seen that application. Everything needed is in this file: the global stylesheet, the rules, and the component source.

**Stack.** React 19 with Vite and plain JavaScript (JSX), Tailwind CSS v4 configured in CSS, hand-written primitives on Radix UI and class-variance-authority, lucide-react icons, framer-motion, react-hook-form with zod, TanStack Query, react-router v7 and Recharts.

## Contents

1. [Foundations](#1-foundations): setup, the global stylesheet, tokens, dark mode, scales, z-index, helpers
2. [Primitives: controls and display](#2-primitives-controls-and-display): shared rules, the field block, Button to Progress
3. [Primitives: overlays and composites](#3-primitives-overlays-and-composites): dialogs, menus, tabs, toasts, table parts, stepper, one-time code
4. [App shell and page anatomy](#4-app-shell-and-page-anatomy): sidebar, top bar, auth layouts, navigation, page recipes
5. [Patterns: data, forms and feedback](#5-patterns-data-forms-and-feedback): data table, status display, inputs, charts, forms, states
6. [Motion, icons, content and accessibility](#6-motion-icons-content-and-accessibility)
7. [Checklists](#7-checklists)
8. [Appendix: source to copy](#appendix-source-to-copy)

## How to use this file

1. Install the packages and wire the build (section 1, "Setup").
2. Create `src/index.css` from the stylesheet in section 1. It defines every token.
3. Create `src/lib/utils.js` with `cn()` and the formatters, and add the status colour map to `src/lib/constants.js` (section 1, "Helpers" and "Semantic colour maps").
4. Copy each file in the Appendix to the path shown above it.
5. Build the shell and the first pages from the skeletons in section 4.
6. Follow sections 2 to 6 for everything you add, and run the checklists in section 7 before calling a screen done.

## How the sections and the appendix relate

- **Sections 1 to 6 are the standard.** Class strings, values and prop names in them are exact. The class tables in section 3 are abbreviated to the classes that set each part's look.
- **The Appendix is the working source** the system was extracted from, unchanged except for the four small edits listed at its top.
- **Where that source falls short of the standard, the gap is listed** under "Deviations not to copy" at the end of each section, with the correct practice. Apply those fixes as you copy a file, or leave the file as it is to reproduce the original exactly. If a class string in a section differs from the Appendix, the section is the standard. In section 3 a class that a table row leaves out stays as the Appendix has it, unless that section's "Deviations not to copy" list removes it.
- Sections refer to each other by name, in quotes. A file path is where to create that file in the new project. Files in `src/components/ui/`, `src/hooks/` and `src/lib/` have lower-case, hyphenated names; every other component file is PascalCase, named after its export.

## What to change for your product

| Item | Where it lives |
|---|---|
| Product name and monogram | "Acme Admin", "Acme Ltd" and the `Shield` icon in the sidebar, auth-layout and centred-layout skeletons in section 4 |
| Brand colour | `--color-primary`, `--color-accent`, `--color-ring` and the three stops of `--gradient-accent` in the stylesheet; the second chart series `#60a5fa` in section 5; the data-colour fallback `#3b82f6` in section 1 |
| Locale and currency | The formatters in section 1 (`'en-IN'`, `'INR'`) |
| Navigation items, roles and landing routes | The navigation model in section 4 |
| Theme storage key | `'app_theme'` in `ThemeContext.jsx` and in the `index.html` script |

---

## 1. Foundations

### Setup

#### Packages

```bash
# build and runtime (JavaScript/JSX, "type": "module", no TypeScript)
npm i -D vite@^8.0.12 @vitejs/plugin-react@^6.0.1
npm i react@^19.2.6 react-dom@^19.2.6 react-router-dom@^7.17.0 @tanstack/react-query@^5.101.0
# styling
npm i tailwindcss@^4.3.0 @tailwindcss/vite@^4.3.0 class-variance-authority@^0.7.1 clsx@^2.1.1 tailwind-merge@^3.6.0
# primitives
npm i @radix-ui/react-slot@^1.2.5 @radix-ui/react-avatar@^1.1.12 @radix-ui/react-checkbox@^1.3.4 \
  @radix-ui/react-dialog@^1.1.16 @radix-ui/react-dropdown-menu@^2.1.17 @radix-ui/react-label@^2.1.9 \
  @radix-ui/react-progress@^1.1.9 @radix-ui/react-select@^2.3.0 @radix-ui/react-separator@^1.1.9 \
  @radix-ui/react-switch@^1.3.0 @radix-ui/react-tabs@^1.1.14 @radix-ui/react-toast@^1.2.16 input-otp@^1.5.0
# icons, motion, charts, forms
npm i lucide-react@^1.17.0 framer-motion@^12.40.0 recharts@^3.8.1 react-hook-form@^7.77.0 zod@^4.4.3 @hookform/resolvers@^5.4.0
```

Do not add:

- `tailwind.config.js`, `postcss.config.js`, `content` globs: Tailwind v4 is configured in CSS and finds source files itself.
- `components.json` or the shadcn CLI: primitives are hand-written files in `src/components/ui/`.
- `tailwindcss-animate` or `tw-animate-css`: `animate-in`, `animate-out`, `fade-*`, `zoom-*` and `slide-in-from-*` do not exist, so never write them.
- `tailwind-merge` v2 (only v3 understands Tailwind v4 classes), or a tooltip primitive (the system has none).

#### Build wiring

```js
// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
})
```

1. Add `jsconfig.json` with `{ "compilerOptions": { "paths": { "@/*": ["./src/*"] } }, "include": ["src"] }` so editors resolve `@/`.
2. Import the stylesheet once, in `src/main.jsx`: `import './index.css'`. Add no font `<link>` tags.
3. Nest providers as `QueryClientProvider` > `ThemeProvider` > `MotionConfig reducedMotion="user"` > app providers > `BrowserRouter`, with one `<Toaster />` inside `ThemeProvider` and outside the router.
4. Write every class name as a complete literal string. Tailwind scans source text, so `` `bg-${tone}/10` `` generates nothing; use a lookup map of full class strings. The same holds for token variables: Tailwind writes a `--color-*`, `--radius-*` or `--animate-*` variable to `:root` only when a utility or a literal variable name in the scanned source uses it, so write `'var(--color-warning)'` in full, never `` `var(--color-${tone})` ``.
5. Name files by folder: lower-case in `src/components/ui/` (`button.jsx`); one PascalCase file per component in `src/components/common/`, `layout/`, `forms/`, `tables/` and `modals/`, and per route in `src/pages/`; kebab-case `use-*.js` in `src/hooks/`; `src/services/<name>Service.js`; contexts in `src/context/`; helpers in `src/lib/`.

### Global stylesheet

Create `src/index.css` with exactly this content. All design tokens live in its `@theme` block. Keep the font `@import url(...)` on line 1: a CSS `@import` is valid only before other rules.

```css
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap");
@import "tailwindcss";

@theme {
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;

  --color-background: #f8fafc;
  --color-foreground: #0f172a;
  --color-card: #ffffff;
  --color-card-foreground: #0f172a;
  --color-border: #e2e8f0;
  --color-muted: #f1f5f9;
  --color-muted-foreground: #64748b;
  --color-primary: #2563eb;
  --color-primary-foreground: #ffffff;
  --color-secondary: #f1f5f9;
  --color-secondary-foreground: #0f172a;
  --color-accent: #3b82f6;
  --color-destructive: #ef4444;
  --color-success: #10b981;
  --color-warning: #f59e0b;
  --color-ring: #3b82f6;

  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;

  --animate-caret-blink: caret-blink 1.1s ease-out infinite;
  --animate-otp-pop: otp-pop 0.18s ease-out;
  --animate-otp-shake: otp-shake 0.4s ease-in-out;
  --animate-toast-in-top: toast-in-top 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  --animate-toast-in-bottom: toast-in-bottom 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  --animate-toast-out: toast-out 0.2s ease-in forwards;

  @keyframes caret-blink {
    0%, 70%, 100% { opacity: 1; }
    20%, 50% { opacity: 0; }
  }
  @keyframes otp-pop {
    from { opacity: 0; transform: scale(0.6); }
    to { opacity: 1; transform: scale(1); }
  }
  @keyframes otp-shake {
    0%, 100% { transform: translateX(0); }
    20%, 60% { transform: translateX(-6px); }
    40%, 80% { transform: translateX(6px); }
  }
  /* Toasts: in from the edge they sit on (top on phones, bottom from `sm`), out to the right. */
  @keyframes toast-in-top {
    from { opacity: 0; transform: translateY(-100%); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes toast-in-bottom {
    from { opacity: 0; transform: translateY(100%); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes toast-out {
    from { opacity: 1; transform: translateX(0); }
    to { opacity: 0; transform: translateX(calc(100% + 1rem)); }
  }
}

:root {
  --gradient-accent: linear-gradient(135deg, #2563eb 0%, #3b82f6 50%, #60a5fa 100%);
  --sidebar-width: 280px;
  --topbar-height: 72px;
  /* The surface the tinted toasts mix their 10% tint into (kept opaque; dark uses the page colour for contrast). */
  --toast-surface: var(--color-card);
}

.dark {
  color-scheme: dark;
  --color-background: #020617;
  --color-foreground: #f8fafc;
  --color-card: #0f172a;
  --color-card-foreground: #f8fafc;
  --color-border: #1e293b;
  --color-muted: #1e293b;
  --color-muted-foreground: #94a3b8;
  --color-secondary: #1e293b;
  --color-secondary-foreground: #f8fafc;
  --toast-surface: var(--color-background);
}

/* Default border colour. It must sit in the base layer: unlayered CSS outranks Tailwind's
   utilities layer, which would stop every `border-<colour>` class in the app from applying. */
@layer base {
  * {
    border-color: var(--color-border);
  }
}

html {
  scroll-behavior: smooth;
}

body {
  margin: 0;
  font-family: var(--font-sans);
  background-color: var(--color-background);
  color: var(--color-foreground);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  transition: background-color 0.3s ease, color 0.3s ease;
}

.gradient-text {
  background: var(--gradient-accent);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.gradient-bg {
  background: var(--gradient-accent);
}

.glass-card {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(12px);
}

.dark .glass-card {
  background: rgba(15, 23, 42, 0.8);
}

::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 3px;
}

.dark ::-webkit-scrollbar-thumb {
  background: #334155;
}

@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  body { transition: none; }
}
```

Cascade layers decide what overrides what. The `@theme` tokens land in Tailwind's `theme` layer on `:root` and the border default sits in `base`. Everything else (`.dark`, `html`, `body`, `.gradient-*`, `.glass-card`, scrollbars, the reduced-motion block) is unlayered and beats every Tailwind utility for the properties it sets. The scrollbar rules affect WebKit and Blink only.

### Tokens

#### Colour

Each `--color-<name>` token generates every colour utility for that name (`bg-`, `text-`, `border-`, `ring-`, `divide-`, `fill-`, `stroke-`), each with an optional `/NN` opacity modifier such as `bg-card/80`. Names repeat by design: `border-border`, `ring-ring`.

| Token | Light | Dark | Use |
|---|---|---|---|
| `background` | `#f8fafc` | `#020617` | Page canvas |
| `foreground` | `#0f172a` | `#f8fafc` | Default text |
| `card` | `#ffffff` | `#0f172a` | Every raised surface: cards, sidebar, top bar, dialogs, menus, popovers, inputs |
| `card-foreground` | `#0f172a` | `#f8fafc` | Text on card |
| `border` | `#e2e8f0` | `#1e293b` | Borders, dividers (`divide-border`), 1px separator fills (`bg-border`) |
| `muted` | `#f1f5f9` | `#1e293b` | Subtle fills: hover, tab list, skeleton, progress track, inset panel (`bg-muted/30`) |
| `muted-foreground` | `#64748b` | `#94a3b8` | Secondary text, placeholders, inactive icons, table headers |
| `primary` | `#2563eb` | same | Brand solid: links, selected and checked states, info tints |
| `primary-foreground` | `#ffffff` | same | Text on `bg-primary` |
| `secondary` | `#f1f5f9` | `#1e293b` | Secondary button and badge fill |
| `secondary-foreground` | `#0f172a` | `#f8fafc` | Text on secondary |
| `accent` | `#3b82f6` | same | Lighter brand blue: middle gradient stop, third strength level |
| `destructive` | `#ef4444` | same | Errors, destructive actions, negative values |
| `success` | `#10b981` | same | Positive, complete |
| `warning` | `#f59e0b` | same | Pending, caution |
| `ring` | `#3b82f6` | same | Focus ring: `focus-visible:ring-2 focus-visible:ring-ring` |

Unlike a stock shadcn theme:

- `accent` is a brand blue, not a hover surface: `hover:bg-accent` turns the element blue. Hover surfaces use `hover:bg-muted`.
- `popover`, `popover-foreground`, `input`, `accent-foreground`, `destructive-foreground`, `sidebar-*` and `chart-*` do not exist, so `bg-popover` or `border-input` generate no CSS and fail silently. Use `bg-card text-foreground` for popovers and menus, `border-border` for inputs, and `text-white` on a solid destructive fill or on the gradient.

Outside the tokens, allow only `text-white` (also `/80`, `/70`, `/60`) and `bg-white/5`, `/10`, `/20` on the gradient, on solid `bg-destructive` and on dark scrims, which are identical in both themes; `bg-black/50` and `bg-black/80` for scrims; and `bg-white` for surfaces that must stay white in both themes (document viewers). Never use raw palette classes (`bg-slate-100`), `text-black`, or hex values in `className`.

#### Radius

The four radius tokens override Tailwind's defaults, so each named radius is one step larger than stock (`rounded-lg` is 12px, not 8px). Omit them and every corner shrinks.

| Class | Value | Elements |
|---|---|---|
| `rounded` | 4px (fixed) | Checkbox, option rows inside listboxes |
| `rounded-sm` | `0.375rem` = 6px | Dialog close button |
| `rounded-md` | `0.5rem` = 8px | Small button (`size="sm"`), menu and select items, tab trigger, default skeleton |
| `rounded-lg` | `0.75rem` = 12px | Buttons, inputs, select and dropdown content, tabs list, toast, sidebar item, callouts, inset rows |
| `rounded-xl` | `1rem` = 16px | Cards, dialog content, table container, 48px icon tiles, option tiles, the floating widget panel |
| `rounded-full` | pill | Avatars, badges, chips, status dots, icon wells, progress, switch |

`rounded-2xl` is also 16px here; use `rounded-xl`.

#### Typography

`--font-sans` becomes the document default font and the `font-sans` class. Inter is loaded at 400, 500, 600 and 700 only: use `font-normal`, `font-medium`, `font-semibold` and `font-bold`, never `font-light`, `font-extrabold` or `font-black`.

Sizes are Tailwind defaults (no `--text-*` tokens): `text-3xl font-bold` (30px) page title; `text-2xl font-bold` (24px) stat value; `text-lg font-bold` (18px) dialog title; `text-base font-bold` (16px) card title; `text-sm` (14px) body, controls, labels and table cells; `text-xs` (12px) captions, badges and table headers; `text-[11px]` chips and count badges.

#### Animation

The `--animate-*` tokens create `animate-caret-blink`, `animate-otp-pop` and `animate-otp-shake` for the one-time-code input, and `animate-toast-in-top`, `animate-toast-in-bottom` and `animate-toast-out` for toasts; always prefix them with `motion-safe:`. The only other animation utilities are Tailwind's `animate-spin` (loading icons) and `animate-pulse` (skeletons). See "Motion, icons, content and accessibility".

#### Layout and gradient variables

These are plain `:root` variables, not `@theme` tokens, so they generate no utilities. Never repeat `280` or `72px` as literals.

- `--gradient-accent`: only through `.gradient-bg` and `.gradient-text`; identical in both themes.
- `--sidebar-width`: `w-[var(--sidebar-width)]` on the sidebar, `lg:ml-[var(--sidebar-width)]` on the content column.
- `--topbar-height`: `h-[var(--topbar-height)]` on the top bar and on the sidebar's logo row, so the two line up; `calc(100vh - var(--topbar-height) - 4rem)` for a viewport-filling page.

### Dark mode

The theme is a class on `<html>`, exactly one of `light` or `dark`; only `.dark` has CSS. Persist the choice in `localStorage` as `'light'` or `'dark'`, default to `'light'`, and do not read the operating-system preference. `.dark` redefines the nine tokens with a value in the Dark column above; brand and semantic colours, `ring` and the gradient stay the same.

```jsx
// src/context/ThemeContext.jsx, inside ThemeProvider
const [theme, setTheme] = useState(() => localStorage.getItem('app_theme') || 'light')

useEffect(() => {
  const root = document.documentElement
  root.classList.remove('light', 'dark')
  root.classList.add(theme)
  localStorage.setItem('app_theme', theme)
}, [theme])

const toggleTheme = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'))
// context value, read through a useTheme() hook:
// { theme, setTheme, toggleTheme, isDark: theme === 'dark' }
```

Set the class before first paint with an inline script, so a dark user never sees a light frame:

```html
<!-- index.html, in <head>, before the module script -->
<script>
  try {
    document.documentElement.classList.add(localStorage.getItem('app_theme') === 'dark' ? 'dark' : 'light')
  } catch (e) {
    document.documentElement.classList.add('light')
  }
</script>
```

1. Colour every surface, text and border with token utilities; they flip automatically. Build translucent surfaces from a token plus an opacity modifier: `bg-card/80`, `bg-muted/30`, `bg-primary/5`.
2. Never use the `dark:` variant. Without a `@custom-variant dark` rule it follows the operating-system `prefers-color-scheme`, not the toggle. If a colour needs a dark value, redefine its token in the `.dark` block.
3. Keep `border border-border` on cards and popovers: shadows almost vanish on the dark canvas, so the border does the separating.
4. Where a value cannot be a class (chart, SVG and canvas props), pass the variable, for example `stroke="var(--color-border)"`, or read `isDark` from `useTheme()`.
5. The `.dark` block also sets `color-scheme: dark`, so native controls such as date pickers render dark.

### Custom classes and the override limitation

Three classes are plain CSS, not Tailwind utilities. They are unlayered, and an unlayered declaration beats every normal (non-`!important`) declaration inside a cascade layer, whatever its specificity or source order. All Tailwind utilities sit in the `utilities` layer, so on the same element no utility, including `hover:`, `disabled:` and `data-[state=...]:` variants, can override a property these classes set. The one exception is a utility carrying Tailwind's important modifier (`bg-none! bg-destructive!`), because `!important` outranks every normal declaration; never use it, and follow the rules below.

| Class | Sets and locks | Use | Utilities with no effect on the same element |
|---|---|---|---|
| `.gradient-bg` | The whole `background` shorthand | The brand fill: default Button variant, active sidebar item, icon tiles, avatar fallback, progress fill | `bg-<colour>`, `hover:bg-*`, `disabled:bg-*`, `bg-none`, `bg-linear-*`, `bg-cover`, `bg-clip-*` |
| `.gradient-text` | `background`, `background-clip: text`, `-webkit-text-fill-color: transparent` | Gradient-filled display text: `text-8xl font-bold gradient-text` | The same, plus `text-<colour>` (the glyph fill stays transparent) |
| `.glass-card` | `background` (80% white; dark 80% `#0f172a`), `backdrop-filter: blur(12px)` | Frosted standalone panel: `glass-card rounded-xl border border-border p-8` | `bg-*`, `backdrop-blur-*` |

`cn()` does not help: `tailwind-merge` does not know `gradient-bg` is a background class, so `cn('gradient-bg', 'bg-destructive')` keeps both and the gradient wins.

1. Replace the class; never add to it.

```jsx
// inside a component: the caller's class replaces the gradient default
className={cn('h-full w-full rounded-full', indicatorClassName ?? 'gradient-bg')}
// at a call site: one or the other
className={cn('h-0.5 rounded-full', invalid ? 'bg-destructive' : 'gradient-bg')}
```

2. For a button in another colour, choose another variant (`destructive`, `outline`, `secondary`, `ghost`); the gradient exists only in the default variant. Never put a `bg-*` class on a default-variant button.
3. For a one-off colour on a gradient element, use an inline style: `style={{ background: 'var(--color-success)' }}`. It must be `background`, not `backgroundColor`, because the gradient is a background image and paints over any background colour.
4. Hover and disabled states cannot change the background of a gradient element. Use `hover:opacity-90 hover:shadow-md` and `disabled:opacity-50`.
5. Content on the gradient is `text-white`. A bordered element that takes the gradient adds `border-0`.
6. Declare any new custom class inside `@layer components` so that utilities can override it.

### Default border colour

In Tailwind v4 a bare `border` class sets width and style only, and the colour falls back to `currentColor`. The `@layer base` rule makes every border default to the `border` token, so `border`, `border-b` and `divide-y` draw in the neutral colour in both themes.

1. Keep the rule inside `@layer base`. Written unlayered, it outranks the whole `utilities` layer and every `border-primary` or `border-transparent` class stops applying. Inside `base` it still wins over Tailwind's reset and loses to every colour utility.
2. `*` does not match pseudo-elements. Give a border on `before:` or `after:` content an explicit colour class.
3. Still write the colour, `border border-border`, and treat the base rule as a safety net.

### Scales

#### Spacing

One step is `0.25rem` (Tailwind default). For padding, gaps and stacks use the steps 0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8 and 12, and default to 2, 4 and 6.

| Family | Step and use |
|---|---|
| `space-y-*` | `1` nav list; `1.5` title and description of a card or dialog header; `2` label, control and error text of one field; `3` compact lists; `4` fields in a form, blocks in a card body; `5` auth forms; `6` page sections |
| `gap-*` | `1` icon-button clusters; `1.5` chips; `2` icon and label, button groups; `3` avatar or icon tile with text, nav item; `4` default grid gap, header rows; `6` grids of whole cards; `gap-x-6 gap-y-3` label and value grids |
| `p-*` | `1` menu or listbox container; `2` thumbnail well; `3` inset sub-panel, settings row, board card; `4` list row, option tile, toast; `6` card and dialog; main area `p-4 md:p-6 lg:p-8` |

#### Shadows

All shadows are Tailwind v4 defaults (black with alpha). Do not use coloured shadows.

| Class | Elements |
|---|---|
| `shadow-sm` | Card and primary button at rest, active nav item, active tab |
| `shadow-md` | Select content, anchored listboxes. As `hover:shadow-md` with `transition-shadow`, the lift of interactive cards |
| `shadow-lg` | Dropdown menu content, toast, floating action button |
| `shadow-xl` | Dialog content; a standalone card on the bare page background (`border-0 shadow-xl`) |
| `shadow-2xl` | Floating widget panel |
| `shadow-none` | A card embedded in another surface: `h-full border-0 shadow-none` |

Every popover surface anchored to a trigger (select and dropdown content, listboxes, search result panels) is `rounded-lg border border-border bg-card text-foreground`, with `shadow-md` when anchored to a field and `shadow-lg` for menus. The one exception is the panel of the floating page widget, a fixed card-sized surface: `rounded-xl border border-border bg-card text-foreground shadow-2xl`.

#### Breakpoints

Mobile-first, with Tailwind's default breakpoints. Never use `2xl:` or container queries. For per-page rules see "App shell and page anatomy".

| Prefix | Min width | Main switch |
|---|---|---|
| `sm` | 640px | Stacked toolbars and dialog footers become rows; toasts move from the top edge to the bottom edge |
| `md` | 768px | Page header row goes horizontal; form grids reach 2 columns; toasts narrow to a 420px stack in the bottom-right corner |
| `lg` | 1024px | Sidebar becomes permanent; the auth layout splits in two |
| `xl` | 1280px | Stat row reaches 4 columns |

Below `md`, force hover-revealed actions visible for touch: `opacity-0 group-hover:opacity-100 focus-within:opacity-100 max-md:opacity-100`.

### Z-index layers

This is the only z-index scale, listed bottom to top.

| Class | Layer | Notes |
|---|---|---|
| none | Page content | |
| `z-10` | Local overlays inside one `relative` parent: actions and captions on thumbnails, the sliding pill of animated tabs | Never a page-level layer |
| `z-20` | Floating page widget (`fixed bottom-6 right-6`) and its panel; busy overlay covering part of a form (`absolute inset-0`) | Below the top bar and every modal |
| `z-30` | Sticky top bar | |
| `z-40` | Sidebar, as desktop rail and as mobile drawer; the drawer's backdrop | The backdrop is rendered before the drawer, so the drawer stays above it; both cover the top bar, which is dimmed and inert while the drawer is open |
| `z-50` | Dialog overlay and content; dropdown menu and select content; anchored listboxes and search result panels (`absolute z-50 mt-1`) | |
| `z-[60]` | Full-screen media viewer | Opens from inside a dialog and must cover it |
| `z-[70]` | Blocking alert dialog, overlay and content | Must cover anything the interrupted page has open |
| `z-[100]` | Toast viewport | Always on top |

1. Pick a level from this table. Never invent intermediate values.
2. Equal levels stack in DOM order. Radix layers are appended to `body` when they open, so a menu or select opened from inside a dialog paints above it with no extra class.
3. Raise a dialog by setting the level on both parts: `<DialogContent className="z-[70] max-w-md" overlayClassName="z-[70]">` (see "Primitives: overlays and composites").
4. A popover opened from a layer above `z-50` renders beneath it; raise it to the same level.
5. Render page-owned fixed layers (floating widget, full-screen viewer) with `createPortal(..., document.body)`. The page-enter wrapper animates `transform`, and a transformed ancestor becomes the containing block for `position: fixed`.

### Helpers

#### cn()

```js
// src/lib/utils.js
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
```

1. Use it for every conditional or overridable class list, with the caller's `className` last: `cn('base classes', condition && 'state classes', className)`.
2. `twMerge` resolves conflicting utilities and the last one wins: `cn('p-6 pt-0', 'p-6')` gives `p-6`. It understands the token names without configuration and passes unknown classes such as `gradient-bg` through untouched.

#### Formatters

Add these to `src/lib/utils.js`. Locale and currency are the literals `'en-IN'` and `'INR'`; change both for another market.

```js
export function formatDate(date) {
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(date))
}

export function formatDateTime(date) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(date))
}

export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)
}

const money = new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2,
})
export const formatMoney = (n) => money.format(Number(n ?? 0))

export function getInitials(name) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

export function downloadCSV(data, filename) {
  if (!data.length) return
  const headers = Object.keys(data[0])
  const csv = [
    headers.join(','),
    ...data.map((row) => headers.map((h) => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(',')),
  ].join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}
```

| Helper | Output | Edge cases |
|---|---|---|
| `formatDate` | `05 Jun 2025` | `null` prints the Unix epoch in the viewer's time zone (`01 Jan 1970`, or `31 Dec 1969` west of UTC); `undefined` or an unparsable string throws `RangeError`. Guard: `value ? formatDate(value) : '—'` |
| `formatDateTime` | `05 Jun 2025, 02:30 pm` | Same as `formatDate` |
| `formatCurrency` | `₹12,50,000` | Whole units, for summary figures. `undefined` prints `₹NaN` |
| `formatMoney` | `₹12,50,000.00` | Two decimals and null-safe, for transaction amounts |
| `getInitials` | `Alex Morgan` gives `AM` | Throws on `null` or `undefined`; pass a fallback string |

Show a missing value as an em dash, `'—'`. Call `getInitials(user?.name || '?')`. Never call `toLocaleDateString()` or declare a local formatter in a component.

### Semantic colour maps

A status tint is a 10% fill, full-strength text and a 20% border, all from one semantic token. Badge variants and the status map use the same triples; toast variants mix the same tint into `--toast-surface` so they stay opaque (see "Primitives: overlays and composites").

```js
// src/lib/constants.js
const TONE = {
  success: 'bg-success/10 text-success border-success/20',
  warning: 'bg-warning/10 text-warning border-warning/20',
  destructive: 'bg-destructive/10 text-destructive border-destructive/20',
  info: 'bg-primary/10 text-primary border-primary/20',
  neutral: 'bg-muted text-muted-foreground border-border',
  critical: 'bg-destructive text-white border-destructive', // the only solid tone
}

export const STATUS_COLORS = {
  active: TONE.success,
  approved: TONE.success,
  pending: TONE.warning,
  expiring: TONE.warning,
  medium: TONE.warning,
  suspended: TONE.destructive,
  rejected: TONE.destructive,
  expired: TONE.destructive,
  high: TONE.destructive,
  in_progress: TONE.info,
  low: TONE.neutral,
  urgent: TONE.critical,
}
```

1. Keys are lower-case snake_case status strings. Apply the value over an outline badge: `<Badge variant="outline" className={cn('capitalize', STATUS_COLORS[status] || '')}>`. An unknown key renders as a plain outline badge.
2. Add a status by adding one key that reuses a tone. Never write a triple inline in a page.
3. A strength meter uses `bg-destructive`, `bg-warning`, `bg-accent` and `bg-success` for levels 1 to 4, with the matching `text-*` class on its label.
4. Colours that come from data (user-defined labels, chart series) are hex strings and never go through Tailwind classes. Apply them inline on a dot beside neutral text, `style={{ backgroundColor: colour }}`; for a tinted well append `1a` (10% alpha) to match the `/10` recipe. Fall back to `#3b82f6`.

For the components that render statuses, tags and the strength meter, see "Patterns: data, forms and feedback".

### Deviations not to copy

- The original has no `@custom-variant dark`, yet its docs imply `dark:` works; it follows the operating system, not the toggle, so never write `dark:`.
- The original sets the theme class only in a React effect and never sets `color-scheme`, so dark users see a light first frame and light native date pickers; keep the pre-paint script in `index.html` and `color-scheme: dark` in the `.dark` block.
- The original hard-codes token hex values in chart props (`#E2E8F0`, `#64748B`) and uses raw palette classes in one graphic; pass `var(--color-border)` and the like, and use token utilities.
- The original repeats layout dimensions as literals (`280` in a width animation, `72px` in a `calc()`); read `--sidebar-width` and `--topbar-height`.
- The original copies a two-decimal money formatter into six files and formats some dates with ad-hoc `toLocaleDateString()`; keep one `formatMoney` and the shared date formatters.
- The original mixes bare `border` with `border border-border` and uses four radius and shadow combinations on popovers; use the explicit border and the single popover recipe.

---

## 2. Primitives: controls and display

### Rules every primitive follows

One file per primitive in `src/components/ui/` (lower-case file name, named exports). Class strings here are canonical: where the appendix source differs (see "Deviations not to copy"), apply the string given here. Four fragments recur and are cited by name.

| Fragment | Classes |
|---|---|
| field surface | `w-full rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors` |
| focus ring | `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring` |
| field disabled | `disabled:cursor-not-allowed disabled:opacity-50` |
| invalid pair | `aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive` |

1. **Shape.** `React.forwardRef(({ className, ...props }, ref) => ...)` with a `displayName`; spread rest props on the root.
2. **Merge `className` last**, as `cn(base, className)` (see "Foundations"), so a caller can override any default.
3. **Variants** use `cva` with `defaultVariants`; export the `xVariants` function beside the component.
4. **Tokens only.** No `dark:` classes, no hex values. The one literal is `text-white` on gradient and solid destructive fills.
5. **Focus.** A 2px ring in the `ring` token; the border does not change. Write `focus-visible:`, never `focus:`. Only Button adds an offset (`focus-visible:ring-offset-2 ring-offset-background`). Items inside a popover highlight with `outline-none focus:bg-muted` instead.
6. **Disabled.** Input, Textarea, Checkbox, Switch and Select trigger take the field disabled pair. Button takes `disabled:pointer-events-none disabled:opacity-50`; Radix list items take the same pair under `data-[disabled]:`.
7. **Invalid state** is the `aria-invalid` attribute, never a prop or an extra class. Input, Textarea and Select trigger carry the invalid pair: red border, red focus ring.
8. **`cursor-pointer` is explicit** on every clickable control, because Tailwind v4's reset gives buttons `cursor: default`.
9. **Heights.** 40px (`h-10`) for Button `default` and `icon`, Input and Select trigger; 44px (`h-11`) for Button `lg`; 32px (`h-8`) for Button `sm`; `h-7 w-7` or `h-6 w-6` for compact `icon` Button overrides.

### Standard field block

Wrap every labelled control in one shared component (suggested location `src/components/common/Field.jsx`): label, control, error, hint.

```jsx
export function Field({ label, id, error, hint, required, children }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="flex items-center gap-1">
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {error && <p id={`${id}-error`} className="text-sm text-destructive">{error}</p>}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
```

```jsx
<Field label="Email" id="email" error={errors.email?.message}>
  <Input id="email" type="email" placeholder="jane@example.com" {...register('email')}
    aria-invalid={errors.email ? true : undefined}
    aria-describedby={errors.email ? 'email-error' : undefined} />
</Field>
```

1. The control's `id` equals the Field's `id`; on a Select it goes on `SelectTrigger`.
2. Set `aria-invalid` whenever an error is shown; the message alone leaves the border grey.
3. Fields are required unless the label says `(optional)`; pass `required` only for a data-driven requirement.

### Button

Every clickable action. A `<button>`, or its single child through `@radix-ui/react-slot` when `asChild` is set.

**Props:** `variant` (`'default'`), `size` (`'default'`), `asChild` (`false`), native button props. There is no default `type` and no `loading` prop (see "Patterns: data, forms and feedback").

**Base:** `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer disabled:pointer-events-none disabled:opacity-50` + focus ring + `focus-visible:ring-offset-2 ring-offset-background`

| `variant` | Classes | Use |
|---|---|---|
| `default` | `gradient-bg text-white shadow-sm hover:opacity-90 hover:shadow-md` | primary action |
| `outline` | `border border-border bg-card hover:bg-muted text-foreground` | secondary action |
| `ghost` | `hover:bg-muted text-foreground` | icon-only, low emphasis |
| `destructive` | `bg-destructive text-white hover:bg-destructive/90` | confirm a destructive action |
| `secondary` | `bg-secondary text-secondary-foreground hover:bg-secondary/80` | rare |
| `link` | `text-primary underline-offset-4 hover:underline` | rare; keeps the `h-10 px-4 py-2` box |

| `size` | Classes | Use |
|---|---|---|
| `default` | `h-10 px-4 py-2` | standard |
| `sm` | `h-8 rounded-md px-3 text-xs` | toolbars, card headers, table cells |
| `lg` | `h-11 rounded-lg px-8` | the `w-full` submit on a full-screen page (sign-in, registration, password reset, one-time code); dialog and in-page forms keep `default` |
| `icon` | `h-10 w-10` | icon-only, with `ghost` |

**Caller supplies:** `aria-label` on every icon-only Button; an explicit `type` inside a `<form>` (without `type="button"` it submits); `asChild` around a `Link` for navigation.

```jsx
<Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Add Record</Button>

<Button variant="ghost" size="icon" aria-label="Delete record" onClick={onDelete}>
  <Trash2 className="h-4 w-4 text-destructive" />
</Button>
```

**Traps**
- A `bg-*` class does not recolour the `default` variant, because `gradient-bg` outranks every utility (see "Foundations"). Choose another variant.
- An icon without `h-4 w-4` renders at lucide's 24px. A leading icon takes `mr-2` (`mr-1.5` at `sm`), a trailing icon `ml-2`; the margin adds to the base `gap-2`.
- A disabled Button ignores the pointer, so a `title` tooltip never shows. On an `asChild` link, `disabled` does nothing.

### Input

Single-line text entry. A plain `<input>`; `type` passes through.

**Classes:** `flex h-10 placeholder:text-muted-foreground` + field surface + focus ring + field disabled + invalid pair

**Caller supplies:** an `id` matched by a Label, or `aria-label` when there is no visible label; `aria-invalid` when in error.

```jsx
<div className="relative">
  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
  <Input type="email" className="pl-9" placeholder="jane@example.com" aria-label="Email" />
</div>
```

A trailing icon sits at `absolute right-3 top-1/2 -translate-y-1/2`, with `pr-10` on the Input. A trailing button is a 32px target, `absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md cursor-pointer` + focus ring, with `type="button"` and an `aria-label`; its `h-4 w-4` icon lands in the same place.

**Trap:** `w-full` is the default. In a flex row add a width (`w-40`) or `flex-1`.

### Textarea

Multi-line text. A plain `<textarea>` with Input's classes, except that `min-h-[80px]` replaces `h-10`.

```jsx
<Field label="Notes (optional)" id="notes">
  <Textarea id="notes" maxLength={2000} {...register('notes')} />
</Field>
```

**Trap:** `rows={2}` has no visible effect, because two rows need 58px and the 80px minimum wins. Override `min-h-*` to go shorter.

### Label

Text label for a control. Wraps `@radix-ui/react-label`.

**Classes:** `text-sm font-medium text-foreground leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70`

**Caller supplies:** `htmlFor` matching the control's `id`, always.

**Traps**
- `peer-disabled:` fires only when the control has the `peer` class and precedes the Label in the DOM. Only Checkbox and Switch carry `peer`, so a Label above a disabled Input does not dim.
- `leading-none` clips a label that wraps. Passing a font-size class removes it, because `tailwind-merge` treats size and line height as one group.

### Checkbox

Boolean or multi-select tick box. Wraps `@radix-ui/react-checkbox`; the root is a `<button role="checkbox">`.

**Root:** `peer h-4 w-4 shrink-0 cursor-pointer rounded border border-border transition-colors data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground` + focus ring + field disabled

**Indicator:** `flex items-center justify-center text-current`, holding a lucide `Check` at `h-3 w-3`. The indeterminate state is not styled.

**Caller supplies** a name: a sibling Label, a wrapping `<label>`, or `aria-label`.

```jsx
<div className="flex items-center gap-2">
  <Checkbox id="remember" checked={remember} onCheckedChange={(v) => setValue('remember', Boolean(v))} />
  <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">Remember me</Label>
</div>
```

**Traps**
- `onCheckedChange` can pass `'indeterminate'`. Coerce with `Boolean(v)`.
- It is a `<button>`, not an `<input>`, so `register()` from react-hook-form does not bind it. Use `watch` with `setValue`, or a `Controller`. The same applies to Switch and Select.

### Switch

Immediate on/off setting. Wraps `@radix-ui/react-switch`; the root is a `<button role="switch">`. `onCheckedChange` receives a boolean.

| Part | Classes |
|---|---|
| Track | `peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors data-[state=checked]:bg-primary data-[state=unchecked]:bg-border` + focus ring + field disabled |
| Thumb | `pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0` |

Result: a 36 x 20px track and a 16px thumb. The thumb is `bg-background`, so it is dark in dark mode.

**Caller supplies** a name: wrap the Switch in a `<label>`, or pass `aria-label`. A settings row (text in `<p>` tags on the left, Switch on the right) always needs `aria-label`, because that text labels nothing.

```jsx
<label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
  <Switch checked={onlyMine} onCheckedChange={setOnlyMine} />
  Only mine
</label>
```

### Select

Single choice from a list. Wraps `@radix-ui/react-select`. Exports `Select`, `SelectGroup`, `SelectValue` (unstyled Radix `Root`, `Group`, `Value`), `SelectTrigger`, `SelectContent`, `SelectItem`.

| Part | Classes |
|---|---|
| `SelectTrigger` | `flex h-10 cursor-pointer items-center justify-between data-[placeholder]:text-muted-foreground` + field surface + focus ring + field disabled + invalid pair. A `ChevronDown` at `h-4 w-4 opacity-50` follows the children. |
| `SelectContent` | `relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-lg border border-border bg-card text-foreground shadow-md`; when `position === 'popper'` also `data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1` |
| `SelectItem` | `relative flex w-full cursor-pointer select-none items-center rounded-md py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50`; a `Check` at `h-4 w-4` marks the selected item in the 32px left gutter |

**Defaults:** `SelectContent` takes `position = 'popper'` (Radix's own default is `'item-aligned'`) and renders in a portal, at least as wide as the trigger, 4px away from it, not animated.

**Caller supplies:** `disabled` on `<Select>`; `id`, `aria-invalid` and (without a visible Label) `aria-label` on `<SelectTrigger>`.

```jsx
<Select value={status ?? ''} onValueChange={(v) => setValue('status', v)}>
  <SelectTrigger id="status" aria-invalid={errors.status ? true : undefined}>
    <SelectValue placeholder="Select status" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="active">Active</SelectItem>
    <SelectItem value="archived">Archived</SelectItem>
  </SelectContent>
</Select>
```

**Traps**
- An item's `value` cannot be `''`: Radix throws. For "all" or "none" use a sentinel (`<SelectItem value="__all__">All owners</SelectItem>`) and translate it at the boundary.
- Values are strings (`String(id)`). To show the placeholder pass `''`, the value Radix reserves for "nothing selected". Never pass `undefined` to a controlled Select (`value={x || undefined}`): Radix treats it as uncontrolled, logs a warning when a value arrives, and can keep showing a stale item after the state is cleared.
- `SelectValue` shows nothing for a value with no mounted `SelectItem` (options still loading). When the text is known, render `<span className="truncate">{name}</span>` in the trigger in its place.

### Badge

Small pill for a status, count or category. A plain `<div>` with one prop, `variant` (`'default'`).

**Base:** `inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors capitalize`

| `variant` | Classes |
|---|---|
| `default` | `border-transparent bg-primary text-primary-foreground` |
| `secondary` | `border-transparent bg-secondary text-secondary-foreground` |
| `outline` | `text-foreground border-border` |
| `success` | `border-success/20 bg-success/10 text-success` |
| `warning` | `border-warning/20 bg-warning/10 text-warning` |
| `destructive` | `border-destructive/20 bg-destructive/10 text-destructive` |

`secondary` is the neutral "off" state. The three soft variants share one recipe, `border-{colour}/20 bg-{colour}/10 text-{colour}`; for a colour without a variant apply it on top of `outline`. Map status values to colours in one wrapper (see "Patterns: data, forms and feedback").

```jsx
<Badge variant={active ? 'success' : 'secondary'}>{active ? 'Active' : 'Inactive'}</Badge>
<Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">In progress</Badge>
```

**Traps**
- `capitalize` is in the base, so every word is title-cased: `in progress` becomes `In Progress` and `pdf` becomes `Pdf`. Add `normal-case` for names, ids and addresses.
- `destructive` is a soft tint on Badge and a solid fill on Button.

### Avatar

User or entity picture with an initials fallback. Wraps `@radix-ui/react-avatar`.

| Part | Classes |
|---|---|
| `Avatar` | `relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full` |
| `AvatarImage` | `aspect-square h-full w-full` |
| `AvatarFallback` | `flex h-full w-full items-center justify-center rounded-full bg-muted text-sm font-medium` |

Set the size and the fallback text size at the call site, and give the fallback the gradient: `h-9 w-9` with `gradient-bg text-white text-xs` in navigation and list rows, `h-20 w-20` with `gradient-bg text-white text-2xl` in a profile header. `getInitials` is a shared helper (see "Foundations").

```jsx
<Avatar className="h-9 w-9">
  <AvatarFallback className="gradient-bg text-white text-xs">{getInitials(user?.name || '?')}</AvatarFallback>
</Avatar>
```

**Trap:** `AvatarImage` has no `object-cover`, so a non-square photo is stretched. Add it, and give the image an `alt`.

### Card

The standard surface for grouped content. Plain elements.

| Part | Element | Classes |
|---|---|---|
| `Card` | `div` | `rounded-xl border border-border bg-card text-card-foreground shadow-sm` |
| `CardHeader` | `div` | `flex flex-col space-y-1.5 p-6` |
| `CardTitle` | `h3` | `text-base font-bold tracking-tight` |
| `CardDescription` | `p` | `text-sm text-muted-foreground` |
| `CardContent` | `div` | `p-6 pt-0` |
| `CardFooter` | `div` | `flex items-center p-6 pt-0` |

```jsx
<Card>
  <CardHeader className="flex-row items-center justify-between space-y-0">
    <CardTitle>Members</CardTitle>
    <Button size="sm"><Plus className="mr-1.5 h-4 w-4" /> Add Member</Button>
  </CardHeader>
  <CardContent className="space-y-4">...</CardContent>
</Card>
```

Overrides: `border-0 shadow-xl` for a standalone card on the bare page background; `cursor-pointer transition-shadow hover:shadow-md` for a clickable card.

**Traps**
- `CardContent` has no top padding. Without a `CardHeader` above it pass `className="p-6"` (or `p-4`), which replaces `p-6 pt-0` entirely.
- A horizontal `CardHeader` needs `space-y-0`. Otherwise `space-y-1.5` leaves a 6px bottom margin on the first child and the row sits off-centre.

### Separator

A 1px rule. Wraps `@radix-ui/react-separator`.

**Props:** `orientation` (`'horizontal'`), `decorative` (`true`, which renders `role="none"`).

**Classes:** `shrink-0 bg-border` plus `h-[1px] w-full` (horizontal) or `h-full w-[1px]` (vertical).

```jsx
<Separator />
<Separator orientation="vertical" />
```

1. Use it for a standalone rule between two blocks. For rows in a list put `divide-y divide-border` on the parent; for the edge of a section use `border-t border-border` or `border-b border-border`.
2. A vertical Separator needs a parent with a height. It carries no margin: spacing comes from the parent.

### Skeleton

Loading placeholder. A plain `<div>`: `animate-pulse rounded-md bg-muted`. It has no size, so pass a height, usually a width, and the radius of the element it stands in for. It is silent to assistive technology: put `role="status"` and `aria-label` on the wrapper.

| Standing in for | Classes passed |
|---|---|
| Card or panel | `h-48 w-full rounded-xl` |
| Table row | `h-12 w-full rounded-xl`, stacked in `space-y-3` |
| List row inside a card | `h-12 w-full rounded-lg`, stacked in `space-y-3` |
| Input, heading | `h-10 w-full rounded-lg`, `h-8 w-48` |

```jsx
<div className="space-y-3" role="status" aria-label="Loading">
  <Skeleton className="h-12 w-full rounded-lg" />
</div>
```

### Progress

Determinate horizontal bar. Wraps `@radix-ui/react-progress`.

**Props:** `value` (0 to 100, not clamped; `max` is ignored; a falsy value renders empty), `indicatorClassName`, `className`. Forward `value` to the Radix root so that `aria-valuenow` is set, and pass `aria-label`.

| Part | Classes |
|---|---|
| Track (root) | `relative h-2 w-full overflow-hidden rounded-full bg-muted` |
| Fill (indicator) | `h-full w-full flex-1 rounded-full transition-all duration-500` plus `indicatorClassName ?? 'gradient-bg'` |

The fill is slid left: ``style={{ transform: `translateX(-${100 - (value || 0)}%)` }}``.

```jsx
<Progress value={75} aria-label="Storage used" />
<Progress value={50} className="h-1.5" indicatorClassName="bg-warning" aria-label="Password strength" />
```

**Trap:** `indicatorClassName` replaces the gradient instead of adding to it, because no `bg-*` class can override `gradient-bg`. An empty string leaves the fill invisible.

### Deviations not to copy

- The original's Select trigger uses `focus:`, so the ring shows on mouse click; use `focus-visible:` for every ring.
- The original's Button offset has no colour (a white halo in dark mode), and Checkbox and Select trigger carry a dead `ring-offset-background`; put the offset pair on Button only.
- The original styles `aria-invalid` on Input only, and most forms never set it; style all three field controls and set it with every error.
- The original's Select trigger has `placeholder:text-muted-foreground` (dead on a button) and no `text-foreground`, and it and Checkbox lack `transition-colors`; use the strings above.
- The original's `CardTitle` defaults to `text-lg font-bold leading-none tracking-tight`, which every use overrides (65 of 69 with `text-base`); make `text-base` the default.
- The original's Progress does not forward `value`, so it reports itself as indeterminate; forward it.
- The original's Badge and Skeleton are plain functions; use `forwardRef` and `displayName`.
- The original redeclares the field wrapper in six files, omits `htmlFor` on a third of its labels and leaves half its switches unnamed; share one `Field` and name every control.

---

## 3. Primitives: overlays and composites

### Dialog

Modal window for forms, decisions and previews; wraps `@radix-ui/react-dialog` (`src/components/ui/dialog.jsx`). Class tables in this section list the classes that set each part's look; the appendix holds the complete strings.

#### Anatomy and added props

`DialogContent` renders the portal, overlay, panel and corner X itself. Its children are `DialogHeader` (`DialogTitle`, `DialogDescription`), the body, and a `DialogFooter` in decision dialogs only.

| Part | Classes |
|---|---|
| `DialogOverlay` | `fixed inset-0 z-50 bg-black/50 backdrop-blur-sm` |
| `DialogContent` | `fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border border-border bg-card p-6 shadow-xl rounded-xl` |
| Close button | `absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-sm opacity-70 transition-opacity hover:opacity-100 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`; a `h-4 w-4` `X` icon and `sr-only` text "Close" |
| `DialogHeader` | `flex flex-col space-y-1.5 text-center sm:text-left` |
| `DialogTitle` | `text-lg font-bold leading-none tracking-tight` |
| `DialogDescription` | `text-sm text-muted-foreground` |
| `DialogFooter` | `flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:space-x-2` |

- `DialogContent` adds `showCloseButton` (default `true`) and `overlayClassName` (merged onto the overlay). `className` merges last onto the panel; other props reach Radix `Dialog.Content`.
- Overlay and panel use the `z-50` layer (see "Foundations"); raise both together through `className` and `overlayClassName`.
- Dialogs and menus open and close without animation. Toasts slide in and out (see "Toast system").

#### Size scale

Set the width with one unprefixed `max-w-*` class on `DialogContent`; omit it for the default. Only the split-pane detail adds a second step, `md:max-w-*`.

| Class | Width | Use for |
|---|---|---|
| `max-w-xs` | 320px | action picker (2 or 3 buttons) |
| `max-w-sm` | 384px | single-choice prompt |
| `max-w-md` | 448px | one or two fields; blocking alert |
| none (`max-w-lg`) | 512px | confirm dialogs, standard forms |
| `max-w-xl` | 576px | image cropper, checklist form |
| `max-w-2xl` | 672px | long two-column form |
| `max-w-3xl` | 768px | read-only detail view |
| `max-w-4xl` | 896px | document or media preview |
| `max-w-2xl md:max-w-4xl` | 672px, 896px from 768px | split-pane detail |

- For tall content add `max-h-[90vh] overflow-y-auto`.
- Custom layout: add `flex flex-col gap-0 overflow-hidden p-0` and pad the regions yourself (`p-6`).
- A control at the right of the header needs `pr-8` to clear the X.

#### Closing rules and actions

1. Control every dialog with `open` and `onOpenChange` from state; the opener is an ordinary button. Do not use `DialogTrigger` or `DialogClose`.
2. It closes on the X, Escape, an overlay click, or Cancel calling `onOpenChange(false)`. Disabling buttons does not stop the first three; to hold it open during a request use `onOpenChange={(next) => !submitting && onOpenChange(next)}`.
3. Close it in the mutation's `onSuccess`; leave it open on error so the user can retry.
4. The panel unmounts on close: keep a stateful body in its own component inside `DialogContent` so it resets on every open, and key an edit body by record id.
5. Always render `DialogTitle` and `DialogDescription` (Radix logs an error or a warning without them); hide a description with `className="sr-only"`.
6. Decision dialog: `<DialogFooter>` with `<Button variant="outline">Cancel</Button>` first (so initial focus never lands on the action), then the action. From 640px they sit right-aligned, 16px apart; below, stacked 8px apart with the action on top.
7. Create or edit form: no footer and no Cancel; the form ends with `<Button type="submit" className="w-full" disabled={loading}>`.

### Confirm dialog

`ConfirmModal({ open, onOpenChange, title, description, confirmLabel = 'Confirm', variant = 'default', onConfirm, loading })` is the standard yes/no confirmation (`src/components/modals/ConfirmModal.jsx`). `variant` is `'default'` or `'destructive'`; `description` takes a string or inline nodes. It renders a default `DialogContent` with a `DialogHeader` (title, description) and the decision footer: Cancel calls `onOpenChange(false)`; the action button takes `variant`, calls `onConfirm` and reads `Processing…` while `loading`; both are disabled while `loading`.

1. Confirm every delete, remove, cancel, reverse, suspend or pause action, and any action that affects another person (approve, settle). Never call `window.confirm`.
2. `onConfirm` does not close the dialog: clear the target in the mutation's `onSuccess`.
3. Hold the target record in state and derive `open` from it. Keep a fallback in the description, which is evaluated while the target is `null`.

```jsx
<ConfirmModal
  open={Boolean(target)}
  onOpenChange={(open) => !open && setTarget(null)}
  title="Delete Record"
  description={`Delete "${target?.name ?? 'this item'}"? This cannot be undone.`}
  confirmLabel="Delete"
  variant="destructive"
  onConfirm={() => deleteMutation.mutate(target.id)}
  loading={deleteMutation.isPending}
/>
```

### Type-to-confirm dialog

`TypeConfirmModal` (`src/components/modals/TypeConfirmModal.jsx`) keeps its confirm button disabled until the user types an exact word. Use it instead of the confirm dialog for permanent deletion, bulk deletion, and deleting a record that owns many child records.

It takes the `ConfirmModal` props plus `confirmWord = 'DELETE'` (compared exactly: case-sensitive, not trimmed) and changes two defaults: `confirmLabel = 'Delete'`, `variant = 'destructive'`. Between header and footer it renders:

```jsx
<div className="space-y-2">
  <Label htmlFor={inputId}>
    Type <span className="font-semibold text-foreground">{confirmWord}</span> to confirm
  </Label>
  <Input id={inputId} value={value} onChange={(e) => setValue(e.target.value)}
    placeholder={confirmWord} autoComplete="off" disabled={loading} />
</div>
```

- The confirm button is `disabled={loading || value !== confirmWord}`. Use no `<form>`: Enter must not confirm.
- Keep the field, its `useState('')` and the footer in a child component inside `DialogContent`, so the value resets on every open.

### Blocking alert dialog

A notice the user must acknowledge, with one way out (for example a session ended by the server). Build it from `Dialog`; props are `open`, `message`, `confirmLabel = 'OK'`, `onConfirm`. Every `DialogContent` prop below is required.

```jsx
<Dialog open={open}>
  <DialogContent role="alertdialog" className="z-[70] max-w-md" overlayClassName="z-[70]"
    style={{ pointerEvents: 'auto' }} showCloseButton={false}
    onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
    <DialogHeader className="items-center sm:text-center">
      <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-warning/10">
        <CirclePause className="h-7 w-7 text-warning" aria-hidden="true" />
      </div>
      <DialogTitle>Access Paused</DialogTitle>
      <DialogDescription>{message}</DialogDescription>
    </DialogHeader>
    <DialogFooter className="sm:justify-center">
      <Button onClick={onConfirm}>{confirmLabel}</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

- Pass no `onOpenChange`, so Radix cannot close it.
- Overlay and panel use the `z-[70]` layer (see "Foundations"). The inline `pointerEvents` keeps the button clickable if another dialog mounts later: Radix disables pointer events on modal layers below the newest.
- Mount one host at the app root, inside the router but outside the route tree, driven by global state. `onConfirm` clears that state and navigates.

### DropdownMenu

Action menus, the account menu and small multi-select pickers; wraps `@radix-ui/react-dropdown-menu` (`src/components/ui/dropdown-menu.jsx`).

| Part | Classes |
|---|---|
| `DropdownMenuContent` (portaled, `sideOffset = 4`) | `z-50 min-w-[8rem] overflow-hidden rounded-lg border border-border bg-card p-1 text-foreground shadow-lg` |
| `DropdownMenuItem` | `rounded-md px-2 py-1.5 text-sm focus:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50`; `inset` adds `pl-8` |
| `DropdownMenuCheckboxItem` | as the item, with `pl-8 pr-2`; `<Check className="h-4 w-4" />` in a slot at `absolute left-2` |
| `DropdownMenuLabel` | `px-2 py-1.5 text-sm font-semibold` |
| `DropdownMenuSeparator` | `-mx-1 my-1 h-px bg-border` |

1. Layer: `z-50` (see "Foundations").
2. Width: none for action menus (128px minimum); `w-56` for the account menu; `w-64 p-0` for a picker with its own scroll area and footer.
3. Trigger: `<DropdownMenuTrigger asChild>` around a real button, with an `aria-label` when icon-only. Use `align="end"` at a right edge, `align="start"` under a left-aligned button.
4. Item with icon: `<Icon className="mr-2 h-4 w-4" /> Label`. Handle actions with `onSelect`, not `onClick`.
5. Destructive item: `className="text-destructive focus:text-destructive"`, last, after a `DropdownMenuSeparator`. It opens a confirm dialog and never deletes directly.
6. Multi-select: `DropdownMenuCheckboxItem` with `checked`, `onCheckedChange` and `onSelect={(e) => e.preventDefault()}` to keep the menu open; commit from a button in a footer row `flex justify-end border-t border-border p-2`.

```jsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="icon" aria-label="File actions"><MoreVertical className="h-4 w-4" /></Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem onSelect={onShare}>Share</DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem onSelect={() => setTarget(file)} className="text-destructive focus:text-destructive">
      <Trash2 className="mr-2 h-4 w-4" /> Delete
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

### Tabs

Section switcher inside a page, or a filter above a list; wraps `@radix-ui/react-tabs` (`src/components/ui/tabs.jsx`) and adds no props.

| Part | Classes |
|---|---|
| `TabsList` | `inline-flex h-10 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground` |
| `TabsTrigger` | `rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200 ease-out hover:text-foreground` |
| `TabsTrigger`, active | `data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=active]:hover:text-primary-foreground` |
| `TabsContent` | `mt-4` |

1. Section tabs use the animated pair below; the plain `TabsList` is for filter tabs and trivial two-tab pages.
2. More than three tabs, or labels that may wrap: `<TabsList className="h-auto flex-wrap justify-start gap-1">`.
3. Filter tabs are a `Tabs` with only a `TabsList`; `onValueChange` sets the filter and resets the page to 1.
4. When the value comes from the URL, set `activationMode="manual"`, otherwise focus landing on a trigger switches tabs (see "App shell and page anatomy").

#### Animated tabs

The active pill slides between triggers and each panel fades in. Build `AnimatedTabsList({ tabs, value, layoutId, className })` and `AnimatedTabPanel({ value, className, children })` on the Tabs parts and `framer-motion`, in `src/components/common/AnimatedTabs.jsx`. `tabs` is `Array<{ value, label }>`.

- List: `<TabsList className={cn('h-auto flex-wrap justify-start gap-1', className)}>`. Each `TabsTrigger` cancels the solid active style with `className="relative data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground data-[state=active]:hover:text-foreground"`.
- Pill, first child of the active trigger only (`value === t.value`): `<motion.span layoutId={layoutId} aria-hidden="true" className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm" transition={{ type: 'spring', stiffness: 500, damping: 40 }}>{t.label}</motion.span>`.
- Every trigger then renders `<span>{t.label}</span>`; the pill's own copy keeps the active text light during the slide. Labels render twice, so keep them plain text.
- Panel: `<TabsContent value={value}>` wrapping `<motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: 'easeOut' }} className={className}>`.
- When `useReducedMotion()` is true: pill `transition={{ duration: 0 }}`; panel `initial={false}` and `duration: 0`.
- `layoutId` must be unique per mounted list (`"<page>-tab"`), or the pill flies between lists.
- The parent must be controlled (`<Tabs value={tab} onValueChange={setTab}>`) and the list must receive the same `value`, or the pill never moves.

### Toast system

Built on `@radix-ui/react-toast`: styled parts in `src/components/ui/toast.jsx`, the renderer `Toaster` in `src/components/ui/toaster.jsx`, and a store hook in `src/hooks/use-toast.js`.

#### Hook API

The hook is the stock shadcn `use-toast` module-level store with `TOAST_LIMIT = 3` and `TOAST_REMOVE_DELAY = 4000`. `toast()` works anywhere, including outside React.

```js
const { id, dismiss, update } = toast({
  title,        // node; always set
  description,  // node, optional
  variant,      // 'default' | 'success' | 'destructive'; defaults to 'default'
  action,       // optional <ToastAction altText="Undo">Undo</ToastAction>
})              // any other key is spread onto the Radix Toast root
update({ title: 'Export ready' })   // merge fields into this toast
dismiss()                           // close this toast
const { toasts, dismiss: dismissById } = useToast()   // dismissById(id) closes one, dismissById() all
```

#### Duration, stacking and placement

1. At most three toasts exist; a fourth drops the oldest at once.
2. Display time is the Radix default, 5000 ms; pass no `duration`.
3. `TOAST_REMOVE_DELAY` is not the display time: it is how long a closed toast stays in the store.
4. The viewport uses the `z-[100]` layer (see "Foundations").

| Viewport width | Position and width | Newest toast |
|---|---|---|
| below 640px | top edge, full width, 16px padding | on top |
| 640px to 767px | bottom edge, full width | at the bottom |
| 768px and up | bottom-right corner, 420px maximum | at the bottom |

#### Variants and classes

| Part | Classes |
|---|---|
| `Toast` base | `rounded-lg border border-border p-4 pr-8 shadow-lg` |
| `Toast` motion | `motion-safe:data-[state=open]:animate-toast-in-top motion-safe:data-[state=open]:sm:animate-toast-in-bottom motion-safe:data-[state=closed]:animate-toast-out` |
| `default` variant | `border bg-card text-foreground` |
| `success` variant | `border-success/20 bg-[color-mix(in_oklab,var(--color-success)_10%,var(--toast-surface))] text-success` |
| `destructive` variant | `border-destructive/20 bg-[color-mix(in_oklab,var(--color-destructive)_10%,var(--toast-surface))] text-destructive` |
| `ToastTitle` | `text-sm font-semibold` |
| `ToastDescription` | `text-sm opacity-90` |
| `ToastViewport` | `fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse gap-2 p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]` |
| `ToastClose` | `absolute right-2 top-2 rounded-md p-1 text-foreground/50 transition-colors hover:text-foreground cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`; `aria-label="Close notification"`; a `h-4 w-4` `X` icon, always visible |

The two tinted variants mix the 10% tint into `--toast-surface` (`card` in light, `background` in dark, where the darker base keeps the red title above 4.5:1), so a toast is opaque. Never use `bg-success/10` or `bg-destructive/10` on a toast: the page shows through. Stacked toasts sit 8px apart (`gap-2` on the viewport). A toast slides in from the edge it sits on (top on phones, bottom from `sm`) in 0.25 s and leaves to the right in 0.2 s; Radix keeps it mounted until that exit ends, and a swipe ends in the same exit. With reduced motion it appears and disappears at once.

#### Triggering

1. Mount `<Toaster />` once at the app root, after the router and inside the providers.
2. Report every mutation from its owner: `onSuccess` raises `variant: 'success'`, `onError` raises `variant: 'destructive'` with `description: getErrorMessage(err)`. Use the default variant for neutral notices.
3. Write keys in the order `{ title, description, variant }`; a success toast is normally title-only.
4. For when to use a toast see "Patterns: data, forms and feedback"; for wording see "Motion, icons, content and accessibility".

```js
toast({ title: 'Item updated', variant: 'success' })
toast({ title: 'Could not update item', description: getErrorMessage(err), variant: 'destructive' })
```

### Table parts

Styled native table elements with no behaviour (`src/components/ui/table.jsx`). Sorting, selection, pagination, loading and empty states belong to the data table (see "Patterns: data, forms and feedback").

| Part | Classes |
|---|---|
| `Table` | wrapper `div` `relative w-full overflow-auto`; `table` `w-full caption-bottom text-sm` (takes `className` and `ref`) |
| `TableHeader` | `[&_tr]:border-b border-border` |
| `TableBody` | `[&_tr:last-child]:border-0` |
| `TableRow` | `border-b border-border transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted` |
| `TableHead` | `h-11 px-4 text-left align-middle text-xs font-semibold text-muted-foreground uppercase tracking-wider` |
| `TableCell` | `p-4 align-middle font-medium` |

The table has no border or background: always place it in `<div className="rounded-xl border border-border bg-card overflow-hidden">`.

### Stepper

Horizontal progress indicator for a multi-step flow: a plain `<ol>` (`src/components/ui/stepper.jsx`).

Props: `steps` (`Array<{ label }>` with unique labels: they are the React keys), `current` (0-based active index), `completed = []` (extra indexes drawn as done), `onStepClick(index)` (turns completed circles into buttons). A step is completed when `completed.includes(index) || index < current`, so a linear flow passes only `steps` and `current`.

| Part | Classes |
|---|---|
| Connector | `h-0.5 flex-1`; `bg-primary` up to the active circle, `bg-border` after it |
| Circle | `flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold transition-colors` |
| Circle, active or completed | adds `gradient-bg border-0 text-white`; active also has `shadow-sm` and `aria-current="step"`; completed shows `<Check className="h-4 w-4" />` instead of the number |
| Circle, upcoming | adds `border-border bg-card text-muted-foreground` |
| Label | `mt-1.5 px-1 text-center text-[11px] font-medium leading-tight text-muted-foreground`; `text-foreground` when active |

`gradient-bg` is a global class (see "Foundations"). Steps share the width equally: keep labels to one or two short words.

```jsx
<Stepper steps={[{ label: 'Upload' }, { label: 'Details' }, { label: 'Review' }]} current={step} />
```

### One-time-code input

`OtpInput` (`src/components/ui/otp-input.jsx`) draws one box per digit, in two groups, over a single invisible text input from the `input-otp` package. It needs the `animate-caret-blink`, `animate-otp-pop` and `animate-otp-shake` utilities and the `gradient-bg` class from the global stylesheet (see "Foundations").

Props: `value` and `onChange(value)` (controlled only); `length = 6` (groups split at `Math.ceil(length / 2)`); `invalid = false` (also sets `aria-invalid`); `className` (merged onto the row, not the input); `ref` (the `<input>`). Other props (`id`, `autoFocus`, `disabled`) reach the input, which is fixed to `inputMode="numeric"`, `pattern={REGEXP_ONLY_DIGITS}` and `autoComplete="one-time-code"`.

| Part or state | Classes |
|---|---|
| Row | `justify-center gap-1.5 sm:gap-2 has-[:disabled]:opacity-60`; `motion-safe:animate-otp-shake` while `invalid` |
| Box (`aria-hidden="true"`) | `h-12 sm:h-14 max-w-12 flex-1 rounded-xl border-2 bg-card text-xl font-bold tabular-nums` |
| Box, empty | `border-border text-muted-foreground`; holds a dot `h-1.5 w-1.5 rounded-full bg-border` |
| Box, filled | `border-primary/40 bg-primary/5 text-foreground`; digit with `motion-safe:animate-otp-pop`; a `gradient-bg` underline (`h-0.5`) draws in from the left |
| Box, active | adds `border-primary shadow-md ring-4 ring-primary/15 motion-safe:-translate-y-0.5`; when empty holds a caret `h-6 w-0.5 rounded-full bg-primary motion-safe:animate-caret-blink` |
| Box, invalid | adds `border-destructive bg-destructive/5 text-destructive`; when active also `ring-destructive/15` |

- Label it with `<Label htmlFor={id}>` plus `id`, or with `aria-label`: to assistive technology it is one text field.
- The row is centred; pass `className="justify-start"` in a left-aligned form.
- Do not auto-submit: keep the submit button disabled until `value.length === length`. For the full verification step see "Patterns: data, forms and feedback".

```jsx
<OtpInput ref={inputRef} id="email-otp" value={otp} onChange={setOtp} invalid={wrongCode} autoFocus />
```

### Deviations not to copy

- The original leaves a stray `duration-200` class on the dialog panel; delete it.
- The original mixes `sm:max-w-*` with `max-w-*` on dialogs and caps two at `max-h-[85vh]`; use unprefixed `max-w-*` and `max-h-[90vh]`.
- The original leaves `gap-2` to each `DialogFooter` caller and one omits it, so stacked buttons touch; put `gap-2` in the footer base.
- The original renders `DialogDescription` conditionally in seven dialogs and omits it in one; always render one, `sr-only` when hidden.
- The original writes `onOpenChange={() => setTarget(null)}` on most confirm dialogs and `Processing...` with three dots; use `(open) => !open && setTarget(null)` and `…`.
- The original gives the dialog X a 16px target and hides the toast X until hover (unreachable by touch); use the 32px close button from the Dialog table, and on the toast X remove `opacity-0`, `focus:opacity-100` and `group-hover:opacity-100` and replace `transition-opacity` with `transition-colors`.
- The original's dialog X, `ToastAction` and `ToastClose` draw their ring with `focus:`, and `ToastClose` names no ring colour; write `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring` on all three. The dialog X, `TabsTrigger` and `TabsContent` also carry a dead `ring-offset-background`; delete it.
- The original's toast X is an icon-only button with no accessible name; give `ToastClose` `aria-label="Close notification"`.
- The original ships unused parts with defects: `onStepClick` buttons have no focus ring or accessible name, `DropdownMenuSubContent` is not portaled, checkbox and radio menu items have no disabled style; fix each before use.
- The original's Stepper, `DialogHeader`, `DialogFooter` and `DropdownMenuShortcut` are plain functions, Stepper spreads no rest props on its `<ol>`, and `toastVariants` is not exported; use `forwardRef`, a `displayName` and a rest-prop spread, and export `toastVariants`.

---

## 4. App shell and page anatomy

### Shell layout

A fixed sidebar, a sticky top bar and a fluid content column with no max-width, mounted once per role area as a layout route. Sizes come from `--sidebar-width` (280px) and `--topbar-height` (72px), the brand fill from `.gradient-bg` (see "Foundations"). `PageTransition` is the page-enter wrapper (see "Motion, icons, content and accessibility"). `useAuth` and `useCapabilities` are specified under "Navigation model and route guarding".

```jsx
// src/components/layout/AppShell.jsx
const iconMap = { LayoutDashboard, Users, LayoutGrid, UserCog }

// DialogPrimitive is `import * as DialogPrimitive from '@radix-ui/react-dialog'`
export function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => {
    // An open drawer locks the page: close it when the permanent sidebar takes over.
    const desktop = window.matchMedia('(min-width: 1024px)')
    const close = () => desktop.matches && setDrawerOpen(false)
    desktop.addEventListener('change', close)
    return () => desktop.removeEventListener('change', close)
  }, [])
  return (
    <DialogPrimitive.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
      <div className="min-h-screen bg-background">
        <div className="hidden lg:block"><Sidebar /></div>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/50 lg:hidden" />
          <DialogPrimitive.Content
            className="fixed left-0 top-0 z-40 lg:hidden"
            onOpenAutoFocus={(e) => { e.preventDefault(); e.currentTarget.querySelector('a')?.focus() }}
          >
            <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">Links to every section.</DialogPrimitive.Description>
            <Sidebar onClose={() => setDrawerOpen(false)} />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
        <div className="flex flex-col lg:ml-[var(--sidebar-width)]">
          <Topbar />
          <main className="flex-1 p-4 md:p-6 lg:p-8">
            {/* Enter only: the old page unmounts at once, the new one mounts once. No AnimatePresence. */}
            <PageTransition key={pathname}>
              <Outlet />
            </PageTransition>
          </main>
        </div>
      </div>
    </DialogPrimitive.Root>
  )
}

function Sidebar({ onClose }) {
  const { user, logout } = useAuth()
  const { can } = useCapabilities()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const items = (NAV[user.role] ?? []).filter((item) => can(item.capability))
  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-[var(--sidebar-width)] flex-col border-r border-border bg-card overflow-hidden">
      <div className="flex h-[var(--topbar-height)] items-center gap-3 px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-bg">
          <Shield className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold leading-tight">Acme Admin</p>
          <p className="text-xs text-muted-foreground">{AREA_LABEL[user.role]}</p>
        </div>
      </div>
      <Separator />
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {items.map((item) => {
          const Icon = iconMap[item.icon]
          const extra = item.alsoActiveOn?.includes(pathname)
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={(e) => { if (pathname === item.path) e.preventDefault(); onClose?.() }}
              className={({ isActive }) => cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                isActive || extra ? 'gradient-bg text-white shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </NavLink>
          )
        })}
      </nav>
      <div className="border-t border-border p-4">
        <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="gradient-bg text-white text-xs">{getInitials(user?.name || '?')}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          className="mt-2 w-full justify-start text-muted-foreground hover:text-destructive"
          onClick={async () => { await logout(); navigate('/login') }}
        >
          <LogOut className="mr-2 h-4 w-4" /> Sign Out
        </Button>
      </div>
    </aside>
  )
}

function Topbar() {
  const { isDark, toggleTheme } = useTheme()
  return (
    <header className="sticky top-0 z-30 flex h-[var(--topbar-height)] items-center justify-between border-b border-border bg-card/80 backdrop-blur-md px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <DialogPrimitive.Trigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </Button>
        </DialogPrimitive.Trigger>
        <div className="hidden md:block w-72 lg:w-96">{/* optional search */}</div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'} onClick={toggleTheme}>
          {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>
        <AccountMenu />
      </div>
    </header>
  )
}
```

1. Leave `end` off the link so `/users` stays active on `/users/42`. List a sub-page that is not nested under its parent in the parent's `alsoActiveOn`.
2. Call `preventDefault()` on a click on the current path: re-navigating drops the query string (the open tab) and unsaved input.
3. Below `lg` the menu button opens a second `Sidebar` as a modal drawer on the Radix dialog, which supplies Escape, backdrop click, the focus trap, scroll lock and dialog semantics. The menu button is a `DialogPrimitive.Trigger`, the one exception to the no-trigger rule for dialogs (see "Primitives: overlays and composites"), so focus returns to it and it carries `aria-expanded`. Move initial focus to the first link (Radix skips links and would land on Sign Out), close the drawer on any navigation click, and close it when the viewport reaches `lg`.
4. `AccountMenu`: trigger `<Button variant="ghost" className="relative h-9 w-9 rounded-full" aria-label="Open account menu">` around the same avatar; `<DropdownMenuContent align="end" className="w-56">` holding a `DropdownMenuLabel` (name `font-semibold`, email `text-xs text-muted-foreground font-normal`), a `DropdownMenuSeparator`, then two text-only `DropdownMenuItem`s, Profile and Settings, each navigating with `onSelect`. Sign-out stays in the sidebar.
5. Fill the search slot only for roles with something to search. Below `md` an icon button toggles it in a panel `absolute left-0 right-0 top-full border-b border-border bg-card p-4 md:hidden`.

### Split-screen auth layout

For sign-in and the password-reset steps. Below `lg` only the form side shows.

```jsx
// src/components/layout/AuthLayout.jsx (FEATURES: three { icon, label } entries)
export function AuthLayout({ children }) {
  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:flex lg:w-1/2 gradient-bg">
        <div className="flex flex-col justify-between p-12 text-white">
          <Link to="/login" className="flex items-center gap-3 w-fit">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20 backdrop-blur">
              <Shield className="h-6 w-6" />
            </div>
            <span className="text-xl font-bold">Acme Admin</span>
          </Link>
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            className="space-y-8"
          >
            <div>
              <h1 className="text-4xl font-bold leading-tight">Headline line one<br />Headline line two</h1>
              <p className="mt-4 text-lg text-white/80 max-w-md">One sentence about the product.</p>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {FEATURES.map(({ icon: Icon, label }) => (
                <div key={label} className="rounded-xl bg-white/10 backdrop-blur p-4 text-center">
                  <Icon className="mx-auto h-6 w-6 mb-2" />
                  <p className="text-sm font-medium">{label}</p>
                </div>
              ))}
            </div>
          </motion.div>
          <p className="text-sm text-white/60">© 2025 Acme Ltd. All rights reserved.</p>
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center bg-background p-6 md:p-12">{children}</div>
    </div>
  )
}
```

| Child of the form side | Recipe |
|---|---|
| Form block, no card | `motion.div` `w-full max-w-md`, `initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.2 }}` |
| Heading block | `mb-8`: `<h2 className="text-3xl font-bold">`, then `<p className="mt-2 text-muted-foreground">`. Reset steps add a tile above: `mb-4 flex h-12 w-12 items-center justify-center rounded-xl gradient-bg`, icon `h-6 w-6 text-white` |

### Centred single-card layout

For full-screen pages with no shell: registration, onboarding and account status (pending, declined, no access).

```jsx
<div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
  <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8 text-center">
    <div className="inline-flex items-center gap-2">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg gradient-bg">
        <Shield className="h-5 w-5 text-white" />
      </div>
      <span className="text-xl font-bold">Acme Admin</span>
    </div>
  </motion.div>
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
    <Card className="border-0 shadow-xl">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-warning/10">
          <Clock className="h-6 w-6 text-warning" />
        </div>
        <CardTitle className="text-2xl">Approval Pending</CardTitle>
        <CardDescription>Your account is awaiting review.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button className="w-full"><RefreshCw className="mr-2 h-4 w-4" /> Check Status</Button>
        <Button variant="outline" className="w-full"><LogOut className="mr-2 h-4 w-4" /> Sign Out</Button>
      </CardContent>
    </Card>
  </motion.div>
</div>
```

- Use `max-w-2xl` in place of `max-w-md` for a two-column form.
- Circle tone (`bg-{tone}/10`, icon `text-{tone}`): `warning` waiting or no access, `destructive` declined, `success` done, `primary` verify a code.

### Navigation model and route guarding

Authentication is product code: supply one hook, `useAuth()`, from a provider in the "app providers" layer (see "Foundations"). It returns `{ user, isAuthenticated, logout }`. `user` is `null` when signed out, otherwise `{ name, email, role }` with `role` a key of `NAV`. `isAuthenticated` is `false` whenever `user` is `null`: the sidebar reads `user.role` unguarded and relies on the guard unmounting the shell in the same render. `logout()` returns a promise that resolves once the session is cleared. `fetchMyCapabilities()` is a service call that resolves `{ isOwner: boolean, capabilities: string[] }`.

```js
// src/lib/navigation.js
// NavItem { label, path, icon, capability?, alsoActiveOn? }
//   path: unique per array (it is the React key); icon: key of the sidebar's iconMap
//   capability: 'resource.action', absent = always shown; alsoActiveOn: extra exact pathnames
export const NAV = {
  admin: [
    { label: 'Dashboard', path: '/dashboard', icon: 'LayoutDashboard' },
    { label: 'Users', path: '/users', icon: 'Users' },
  ],
  manager: [
    { label: 'Board', path: '/manager/board', icon: 'LayoutGrid', alsoActiveOn: ['/manager/tasks/history'] },
    { label: 'Team', path: '/manager/team', icon: 'UserCog', capability: 'team.manage' },
  ],
}
export const AREA_LABEL = { admin: 'Admin Panel', manager: 'Manager Panel' }

export function homeForRole(role) {
  if (role === 'manager') return '/manager/board'
  if (role === 'admin') return '/dashboard'
  return '/no-access' // never role-guarded, so an unknown role cannot loop
}

// src/hooks/use-capabilities.js
export function useCapabilities() {
  const { user } = useAuth()
  const gated = user?.role === 'manager'
  const { data } = useQuery({ queryKey: ['capabilities', 'me'], queryFn: fetchMyCapabilities, enabled: gated })
  const can = (key) => !gated || !key || data === undefined || data.isOwner || data.capabilities.includes(key)
  return { can }
}
```

```jsx
// src/components/common/ProtectedRoute.jsx
export function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, user } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (allowedRoles && !allowedRoles.includes(user?.role)) return <Navigate to={homeForRole(user?.role)} replace />
  return children
}
```

1. `can()` stays `true` while capabilities load, so the menu never flickers or locks the user out. Capabilities only hide menu items; guard routes by role.
2. Give each role area one pathless layout route, `<Route element={<ProtectedRoute allowedRoles={['admin']}><AppShell /></ProtectedRoute>}>`: one area at the root, the others under `/<role>/`. Nest detail and create pages under their list path so the parent item stays active.
3. Wrap `/no-access` in `<ProtectedRoute>` with no roles and leave the `*` 404 route outside every group.
4. Every redirect "home" calls `homeForRole(role)`: `/`, the 404 button, a successful sign-in, and auth pages opened by a signed-in visitor.
5. Apply an extra account gate (such as approval pending) only when `allowedRoles` is set, so its own page cannot loop.

### Standard page

```jsx
export default function ProjectsPage() {
  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold">Projects</h1>
          <p className="text-muted-foreground mt-1">Create and manage your projects</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button><Plus className="mr-2 h-4 w-4" /> Add Project</Button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl gradient-bg">
              <Folder className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold">128</p>
              <p className="text-sm text-muted-foreground">Total Projects</p>
            </div>
          </CardContent>
        </Card>
        {/* two more tiles */}
      </div>

      {/* main content: filter bar + data table, card grid, tabs or board */}
      {/* dialogs last: they portal and take no space */}
    </div>
  )
}
```

List page order: header with the primary action, optional stat row, filter tabs and filter bar, data table (see "Patterns: data, forms and feedback"), dialogs.

#### Vertical rhythm and width

1. Page root `space-y-6`; inside a section (tab body, card body, table block) `space-y-4`.
2. Stat tiles `gap-4`; grids of full cards `gap-6`.
3. Pages are full width. Constrain only a narrow form page (`max-w-3xl`) or a centred tool page (`mx-auto max-w-5xl`).

#### Page header

The title is the only `h1` on the page; the subtitle is base size, not `text-sm`.

| Case | Rule |
|---|---|
| Three or more controls on the right | `lg:` in place of `md:` in the wrapper |
| Action group | `gap-3` when it mixes selects or switches with buttons; order: filters, `variant="outline"` buttons, primary last |
| Back link on a create or child page | above the title: `<Button variant="ghost" size="sm" className="mb-2 -ml-2">` with `ArrowLeft` `mr-1.5 h-4 w-4` and "Back to Projects"; `-ml-2` aligns its text with the title |

#### Stat-card rows

Use the count tile shown above for plain counts and the trend card when a delta is shown. Trend card props: `{ title, value, growth, icon, index = 0 }`; `index` staggers the entrance.

| Trend card part | Classes |
|---|---|
| Card | `overflow-hidden transition-shadow hover:shadow-md`, in a `motion.div` with `whileHover={{ scale: 1.02 }}` |
| Content | `p-6`, inner row `flex items-start justify-between gap-3`: text block `min-w-0 space-y-2`, then the same icon tile |
| Title, value | `text-sm font-medium text-muted-foreground`, `truncate text-3xl font-bold tracking-tight` |
| Trend line | `flex flex-wrap items-center gap-1 text-sm font-medium`; `text-success` and `TrendingUp` when `growth >= 0`, else `text-destructive` and `TrendingDown` (`h-4 w-4 shrink-0`); then `<span>{growth >= 0 ? '+' : ''}{growth}%</span>`; then `<span className="text-muted-foreground font-normal">vs last month</span>` |

| Row | Grid |
|---|---|
| 1 count tile | `grid grid-cols-1 sm:grid-cols-3 gap-4` |
| 4 trend cards | `grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6` |

In the four-up row at 1280px a trend card has about 106px for text. Print large amounts compactly (six characters or fewer); a longer value truncates.

#### Filter bars

Build the bar from four layout components, each taking `children` and `className`.

| Component | Classes |
|---|---|
| `TableToolbar` | `flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between` |
| `TableToolbarSearch` | `w-full sm:flex-1 sm:max-w-sm` |
| `TableToolbarFilters` | `flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-3` |
| `TableToolbarActions` | `flex shrink-0 items-center gap-2` |

Select triggers are `w-full sm:w-48`. An "all" option uses a sentinel such as `'__all__'` and is sent to the server as `undefined`.

#### Tabbed pages

Section tabs use the animated tabs (see "Primitives: overlays and composites"). Filter tabs are a plain tab list with no panels, above one table. Keep a linkable tab in `?tab=`:

```jsx
const [searchParams, setSearchParams] = useSearchParams()
const requested = searchParams.get('tab')
const tab = TABS.some((t) => t.value === requested) ? requested : 'general'
const setTab = (value) => setSearchParams(value === 'general' ? {} : { tab: value }, { replace: true })
// <Tabs value={tab} onValueChange={setTab} activationMode="manual">
```

Omit the parameter for the default tab. `replace: true` keeps switches out of history; `activationMode="manual"` stops focus on a trigger from switching tabs.

#### Detail pages

Render the header at once; only the body switches between skeleton, the shared empty state ("Record not found"), the region error and content (see "Patterns: data, forms and feedback").

| Part | Classes |
|---|---|
| Back button | `<Button variant="ghost" size="sm" className="mb-1 -ml-2 h-7 px-2 text-muted-foreground">` with `ArrowLeft` `mr-1.5 h-4 w-4` and "Back to {Place}" |
| Header row | `flex flex-wrap items-center justify-between gap-x-4 gap-y-2` |
| Title block | `min-w-0`; `<h1 className="truncate text-xl font-bold">`; meta line `mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground` |
| Actions | `flex shrink-0 items-center gap-2`: status select (trigger `w-48`), then `<Button variant="outline" size="icon" aria-label="Delete record">` with `Trash2` `h-4 w-4 text-destructive` |
| Body | `<Tabs className="space-y-4">`, tab list `className="w-full"`, panels `className="space-y-6"` holding cards |
| Facts in a card | `<dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">`; `dt` `text-xs text-muted-foreground`; `dd` `text-sm font-medium`; leave out rows with no value |

#### Board pages

Columns share the width; the row scrolls sideways only when they no longer fit.

| Part | Classes |
|---|---|
| Scroller | `flex gap-4 overflow-x-auto pb-4` |
| Column | `flex min-w-[15rem] flex-1 flex-col rounded-xl border border-border bg-muted/30 p-3`; as a drop target add `border-primary bg-primary/5` |
| Column header | `mb-3 flex items-center justify-between`; name `text-sm font-semibold`; count `rounded-full bg-card px-2 py-0.5 text-xs text-muted-foreground` |
| Card | `cursor-grab rounded-lg border border-border bg-card p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing`, stacked `space-y-2` |

#### Empty and error pages

An unknown URL renders a full-screen 404 with no shell: root `min-h-screen flex items-center justify-center bg-background p-6`; block `text-center max-w-md`; `<h1 className="text-8xl font-bold gradient-text">404</h1>`; `<h2 className="text-2xl font-bold mt-4">`; text `text-muted-foreground mt-2`; button row `flex items-center justify-center gap-4 mt-8`: "Go to Dashboard", then `variant="outline"` "Go Back". An empty page shows the shared empty state in the page flow, not in a card.

### Responsive rules

1. Build mobile-first: one column, then more at `sm` (filter bars, tile grids), `md` (page header, form grids, top-bar search) or `lg` (sidebar, two-up card grids, auth brand panel).
2. Action groups and tab lists wrap. Tables and boards scroll sideways inside their own container; the page body never does.
3. Beside a fixed-size element, wrap text in `min-w-0` with `truncate` and give the fixed element `shrink-0`.

### Deviations not to copy

- The original renders the sidebar brand name as a second `<h1>` on every page; use a `<p>`.
- The original sets the sidebar width twice (the CSS variable plus a hard-coded 280 driving a collapse that never runs); use the variable and a plain `<aside>`.
- The original drawer is a pair of plain `div`s with no Escape handler, focus trap, scroll lock or dialog semantics, and swaps the menu icon to an X that the drawer covers; use the Radix dialog drawer above and drop the swap.
- The original hard-codes `/dashboard` in several redirects and lets the guard bounce other roles; call `homeForRole(role)`.
- The original stacks headers at `sm`, `md` or `lg` and has four recipes each for stat tiles, filter bars and back buttons; use the recipes above.
- The original keeps the open tab in the URL on two of seven tabbed pages and repeats the table in a panel per filter tab on one page; use `?tab=` and list-only filter tabs.
- The original builds the no-access page from a one-off `.glass-card` panel and lays a texture over the auth brand panel whose SVG path is malformed and paints nothing; use the card recipe and no texture.
- The original has no error boundary; wrap `<Routes>` in a React error boundary (a class component with `static getDerivedStateFromError`) whose fallback reuses the 404 layout. Do not use a route `errorElement`: under `BrowserRouter` it is ignored.

---

## 5. Patterns: data, forms and feedback

### Data table

Render every list through one `DataTable` component, never a hand-written `<table>`. It composes the `Table` parts (see "Primitives: overlays and composites") and owns sorting, selection, CSV export (`downloadCSV`, see "Foundations"), pagination, loading and empty states.

#### Props and columns

| Prop | Default | Notes |
|---|---|---|
| `columns` | required | shape below |
| `data` | `[]` | client mode: whole list; server mode: current page. Pass an array on every render, never `undefined`: `data={data?.items ?? []}` |
| `mode`, `pageSize` | `'client'`, `8` | `mode` is `'client'` or `'server'` |
| `page`, `totalPages`, `total`, `onPageChange` | `1`, `1`, `0`, none | server mode; pages are 1-based |
| `isLoading`, `isFetching` | `false` | first load; background refetch |
| `emptyTitle`, `emptyDescription` | `'No data found'`, `'Try adjusting your search or filters.'` | always override both |
| `itemLabel` | `'items'` | lower-case plural for the summary |
| `selectable`, `bulkActions` | `false`, none | checkbox column; `(selectedIds) => ReactNode` |
| `showExport`, `exportFilename` | `false`, `'export.csv'` | |
| `onRowClick` | none | rows get `cursor-pointer` |
| `getRowId` | `(row) => row.id` | React key and selection id |

```js
{
  key: 'name',     // optional: field for the default cell, sorting and CSV export (raw value)
  label: 'Name',   // required: header text; the React key when `key` is absent, so keep labels unique
  sortable: true,  // optional: client mode only
  render: (row, index) => node, // optional: `index` is 0-based within the visible page
}
```

Memoise `columns`, listing any state the renderers read as a dependency.

#### Modes

Client mode (short lists returned whole) pages and sorts `data` internally, returning to page 1 when `data.length` or the sort changes. Server mode (anything the API paginates) does not sort; the caller owns `page` and resets it to 1 on every filter change.

1. Page sizes: `export const PAGE_SIZE = { client: 8, crud: 10, location: 50 }`: `client` is the client-mode default, `crud` is for server-paginated lists and `location` for long reference lists such as countries and cities.
2. Services normalise every list response to `{ items, page, limit, total, totalPages }`.
3. Query key: `['resource', page, pageSize, ...filters]`; mutations invalidate `['resource']`.
4. After deleting the last row of a page beyond the first: `if (rows.length === 1 && page > 1) setPage((p) => p - 1)`.

#### Anatomy and behaviour

| Part | Render |
|---|---|
| Loading | only `div.space-y-3` (`role="status"`, `aria-label="Loading table data"`) with `Math.min(pageSize, 5)` skeletons `h-12 w-full rounded-xl` |
| Empty | only `EmptyState` with `emptyTitle` and `emptyDescription` |
| Action row | only with export or a selection: `flex items-center justify-between gap-4`; left `flex items-center gap-2` with `{n} selected` in `text-sm text-muted-foreground` and `ghost` `sm` bulk buttons; right `<Button variant="outline" size="sm"><Download className="mr-1.5 h-4 w-4" /> Export CSV</Button>` |
| Sort header | `<button type="button" className="flex items-center gap-1 rounded-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">`: label and a `h-3 w-3` icon, `ArrowUp` (ascending) or `ArrowDown` (descending) in `text-foreground` on the sorted column, `ArrowUpDown` on the others; the sorted column's `TableHead` sets `aria-sort="ascending"` or `"descending"` |
| Selection | `<TableHead className="w-12">`; checkboxes labelled `Select all rows` and `Select row {id}`; the checkbox cell stops propagation; selected rows get `data-state="selected"` |
| Pagination | `null` when `totalPages <= 1`; `flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`; summary `text-sm text-muted-foreground`; `flex items-center gap-2 self-end sm:self-auto` with `outline` `sm` buttons (`ChevronLeft`, `ChevronRight` at `h-4 w-4`; `aria-label="Previous page"`, `"Next page"`) around `<span className="min-w-[3.5rem] text-center text-sm font-medium" aria-live="polite">{page} / {totalPages}</span>` |

- Root with rows: `div.space-y-4`.
- Summary: `Showing {start}–{end} of {total} {itemLabel}` (en dash), plus ` · Updating…` while `isFetching`.
- Sorting: first click ascending, second descending; it compares raw `row[key]`, so keep dates as ISO strings.
- Selection covers the visible page only and clears when `page` or `data` changes. After a bulk mutation remount the table (`key={tableKey}`), because refetched data can keep the same reference.

#### Cells and row actions

1. Primary column: `<span className="font-semibold">`. Missing value: `<span className="text-muted-foreground">—</span>`. Dates and money: `whitespace-nowrap`.
2. Row toggle: a `Switch` with `aria-label`; return the invalidation promise from `onSuccess` so `isPending` disables it until the rows refresh.
3. Actions: last column, `label: 'Actions'`, no `key`, wrapper `<div className="flex items-center gap-1">`, delete last. Each is ``<Button variant="ghost" size="icon" aria-label={`Edit ${row.name}`}>`` with a `h-4 w-4` icon; colour goes on the icon (`text-destructive` for delete). In a clickable row the wrapper stops click propagation.
4. A destructive action never fires from the row: store it (`setDeleteTarget(row)`) and let a confirm dialog run the mutation.

#### Usage

```jsx
export default function Customers() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const term = useDebounce(search.trim(), 300)

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ['customers', page, PAGE_SIZE.crud, term],
    queryFn: () => customerService.getAll({ page, limit: PAGE_SIZE.crud, search: term }),
  })

  const columns = useMemo(() => [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
  ], [])

  return (
    <>
      <SearchInput aria-label="Search customers" value={search} onChange={(v) => { setSearch(v); setPage(1) }} />
      {isError ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-destructive">{getErrorMessage(error)}</p>
          </CardContent>
        </Card>
      ) : (
        <DataTable
          mode="server" columns={columns} data={data?.items ?? []}
          page={page} totalPages={data?.totalPages ?? 1} total={data?.total ?? 0}
          pageSize={PAGE_SIZE.crud} onPageChange={setPage}
          isLoading={isLoading} isFetching={isFetching} itemLabel="customers"
          emptyTitle={term ? 'No customers found' : 'No customers yet'}
          emptyDescription={term ? 'Try adjusting your search or filters.' : 'Add your first customer to get started.'}
        />
      )}
    </>
  )
}
```

### Status and tag display

1. Status with a tone: a `Badge` tone variant through an enum-to-variant map, `const STATUS_VARIANT = { PENDING: 'warning', APPROVED: 'success', REJECTED: 'destructive' }` then `<Badge variant={STATUS_VARIANT[row.status] ?? 'secondary'}>`. Map the enum to a label too: the badge's `capitalize` does not lower-case `PENDING`.
2. A status vocabulary shared across screens: one `StatusBadge` component applying the `STATUS_COLORS` map (see "Foundations").
3. Neutral category or code: `<Badge variant="outline">`. Count: `<Badge variant="secondary">`.
4. Status whose colour is data: dot plus label, `<span className="inline-flex items-center gap-1.5 text-sm"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: colour }} />{label}</span>`.
5. User-created labels: a chip `inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-foreground` led by a colour dot `h-2 w-2 rounded-full border border-border`; with no colour, no dot and `bg-muted text-muted-foreground`.

### Search and selection inputs

#### Search input

`SearchInput({ value, onChange, placeholder = 'Search…', className, ...inputProps })`: `onChange` receives the string; `className` goes on the wrapper; every other prop (`aria-label`, `id`) goes on the `Input`. The field has no visible label: always pass an `aria-label` that names the list (`Search customers`); it falls back to `Search`.

```jsx
<div className={cn('relative', className)}>
  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
  <Input aria-label="Search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pl-9" {...inputProps} />
</div>
```

The component does not debounce. The caller does with a `useDebounce(value, delay = 300)` hook, puts the debounced value in the query key and resets the page to 1.

```js
// src/hooks/use-debounce.js
import { useEffect, useState } from 'react'

export function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}
```

#### Searchable select

Props: `value` (`''` is none), `onChange(value)`, `options = []` as `[{ value, label }]`, `onSearch(query)` (switches to remote mode), `loading = false`, `placeholder`, `id`, `emptyText = 'No matches'`.

- Field: `Input` with `className="pr-8"`, `autoComplete="off"`, `role="combobox"`, `aria-expanded`, `aria-controls` (the menu's `id`) and, while an option is highlighted, `aria-activedescendant` (that option's `id`). Derive both ids from the `id` prop, falling back to `useId()`. Trailing icon `pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground`: `ChevronDown`, or `Loader2` with `animate-spin` while loading.
- Menu: `ul` with its `id`, `role="listbox"` and `absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-border bg-card p-1 text-foreground shadow-md`; each `li` takes `role="none"`.
- Option button: `role="option"`, its `id`, `aria-selected` and `tabIndex={-1}` (focus stays in the field, so it takes no focus ring); classes `w-full rounded px-2 py-1.5 text-left text-sm`, plus `font-medium` when selected and `bg-muted` when highlighted (otherwise `hover:bg-muted`). Message row: `px-2 py-1.5 text-sm text-muted-foreground`, reading `Searching…` or `emptyText`.
- Closed, the field shows the selected label; open, the typed query. Local mode filters by case-insensitive `includes`; remote mode shows `options` as given and stays closed until something is typed. Keep the last picked label in state and show it when the selected value is not in `options`, which is the normal case in remote mode.
- Focus or typing opens the menu; after a pick or Escape, typing, ArrowDown or Enter reopens it. Arrows move the highlight; Enter picks the highlighted option; Escape or an outside `mousedown` closes. Pick on `mousedown` with `preventDefault`, so the pick lands before the input blurs.

#### Cascading selects

Render parent and child as two standard field blocks in a fragment, so they fill two cells of the surrounding grid.

1. Enable the child query only once the parent id resolves; changing the parent clears the child.
2. Parent: disabled while loading, placeholder `Loading…` then `Select a country`. Child: disabled until a parent is chosen, placeholder `Select a country first` then `Select a city`.
3. Render the selected text directly in the trigger (`<span className="truncate">{value}</span>`); a controlled value whose item never mounted leaves it blank.

#### Date-range picker

A row `flex flex-wrap items-center gap-2`: `<CalendarRange className="h-4 w-4 shrink-0 text-muted-foreground" />`, a preset `Select` (`<SelectTrigger className="w-40" aria-label="Date range">`) and, for Custom only, two `<Input type="date" className="w-40">` (`aria-label="From date"`, `"To date"`). `onChange(range)` receives `null` (all time) or `{ from: Date, to: Date, label: string }`, inclusive.

- Presets, in order: All time (default), Today, Yesterday, Tomorrow, This week, Last week, This month, Last month, Custom.
- A range runs in local time from 00:00:00.000 to 23:59:59.999; weeks start on Monday.
- Custom emits `null` until both dates are set. Parse `YYYY-MM-DD` as `new Date(y, m - 1, d)`; `new Date(string)` reads it as UTC.

### Charts

Use Recharts, each chart in its own component inside a `Card` with `CardTitle className="text-base"`. Take colours from tokens so charts follow dark mode.

| Element | Props |
|---|---|
| Container | `<ResponsiveContainer width="100%" height={280}>`; `240` on a dense dashboard |
| Grid | `<CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />`: value-axis lines only |
| Axes | `tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }} axisLine={false} tickLine={false}`; count axes add `allowDecimals={false}` |
| Tooltip | `contentStyle={{ borderRadius: '8px', border: '1px solid var(--color-border)', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', backgroundColor: 'var(--color-card)', color: 'var(--color-foreground)', fontSize: '12px' }}`, `cursor={{ fill: 'rgba(148,163,184,0.12)' }}` |
| Bar | `fill="var(--color-primary)" radius={[4, 4, 0, 0]}`; second series `#60a5fa` (last stop of the brand gradient) |
| Area | `type="monotone" stroke="var(--color-primary)" strokeWidth={2} fill="url(#id)"`; vertical gradient of `--color-accent`, opacity 0.3 at 5% to 0 at 95% |

Add `<Legend />` only with two or more series, each given a `name`. Give every gradient its own id (ids are document-global). Mount a chart only once its data exists.

### Dashboard widgets

- Quick-action tile: grid `grid grid-cols-2 gap-4 md:grid-cols-4`; button `flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-6 transition-shadow hover:shadow-md cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`; chip `flex h-12 w-12 items-center justify-center rounded-xl gradient-bg text-white`; icon `h-6 w-6`; label `text-sm font-medium`.
- List card: rows in `divide-y divide-border`, each `flex items-center justify-between gap-3 py-3` with `text-sm font-medium` text and a `<Badge variant="secondary">` count; a row that navigates is a `button` adding `w-full rounded-sm text-left transition-colors hover:bg-muted/40 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`. Header action: `<Button variant="ghost" size="sm">View All</Button>`.

### Forms

Forms use `react-hook-form`, `zod` and `zodResolver` from `@hookform/resolvers/zod`. `Field` is the standard field block (see "Primitives: controls and display").

#### Canonical form

```jsx
export const customerSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Enter a valid email'),
})
export const defaultCustomerValues = { name: '', email: '' }

const invalid = (error) => (error ? true : undefined)

export function CustomerForm({ defaultValues, onSubmit, loading, submitLabel = 'Save Customer' }) {
  const values = useMemo(() => ({ ...defaultCustomerValues, ...defaultValues }), [defaultValues])
  const { register, handleSubmit, setError, formState: { errors } } = useForm({ resolver: zodResolver(customerSchema), values })

  const submit = async (data) => {
    try {
      await onSubmit(data)
    } catch (err) { // field errors go under their fields; the parent's onError toasts
      Object.entries(parseValidationErrors(err)).forEach(([field, message]) => setError(field, { message }))
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Name" id="name" error={errors.name?.message}>
          <Input id="name" placeholder="Jane Doe" aria-invalid={invalid(errors.name)}
            aria-describedby={errors.name ? 'name-error' : undefined} {...register('name')} />
        </Field>
        <Field label="Email" id="email" error={errors.email?.message}>
          <Input id="email" type="email" placeholder="jane@example.com" aria-invalid={invalid(errors.email)}
            aria-describedby={errors.email ? 'email-error' : undefined} {...register('email')} />
        </Field>
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</> : submitLabel}
      </Button>
    </form>
  )
}
```

1. The parent passes `onSubmit={(v) => mutation.mutateAsync(v)}` and `loading={mutation.isPending}`. Its mutation raises the toasts: `{ title: 'Customer added', variant: 'success' }` in `onSuccess`, after invalidating the list and before closing the dialog; `{ title: 'Could not add customer', description: getErrorMessage(err), variant: 'destructive' }` in `onError`.
2. Export the schema and empty defaults from the form's file; the page maps a record onto them (`record.name ?? ''`) and reuses the form for editing.
3. Seed with the memoised, reactive `values` option; `defaultValues` plus a `reset` effect fails to re-seed `Controller`-bound controls when a dialog reopens.
4. Add `noValidate` when the form has native constraints such as `type="email"`; otherwise the browser's bubble blocks the submit before the inline message can show.
5. Attach cross-field errors with `.refine(..., { path: ['confirmPassword'] })` and re-run `trigger('confirmPassword')` when `password` changes after a submit.
6. Bind `Select` with `value={watch('field') ?? ''}` and `onValueChange={(x) => setValue('field', x, { shouldValidate: true })}`; composite controls go through `<Controller>`.

#### Layout, submit and pending states

- Form `space-y-4` (`space-y-5` on sign-in pages); columns `grid grid-cols-1 gap-4 md:grid-cols-2` or `md:grid-cols-3`, `sm:grid-cols-2` in narrow dialogs.
- Switch row: `flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3`; text block `min-w-0`; title `text-sm font-medium`, description `text-xs text-muted-foreground`.
- One primary submit, `className="w-full"`, at the bottom: default size in dialogs and in pages inside the shell, `size="lg"` on the full-screen auth and centred-card layouts (sign-in, registration, password reset, code step); the Cancel plus Confirm footer pair is for confirmations.
- Pending: `disabled`, spinner and a progressive verb (`Saving…`), from `mutation.isPending` or, in a self-contained form, `formState.isSubmitting`; also disable Cancel.

#### Server errors

Keep three helpers in `src/lib/errors.js`. They read the axios error shape: `data` is `error.response.data`, shaped `{ code?, message?, error?: string | { message }, errors?: { [field]: string | string[] } }`. With any other HTTP client, make each service throw an `Error` carrying `response = { status, data }` for a non-2xx reply, or the helpers see no server message and no field errors.

| Helper | Returns |
|---|---|
| `getErrorCode(error)` | `data.code ?? null` |
| `parseValidationErrors(error)` | `{ field: message }` from `data.errors`, with a leading `body.` stripped from each key and the first message of an array; keys must then equal the form's field names |
| `getErrorMessage(error, fallback = 'Something went wrong. Please try again.')` | the first of: `data` if a string, `data.message`, `data.error` (string or its `.message`), the first field error, `fallback`; with no response, `error.message \|\| fallback` |

1. A form never toasts in its own `catch` when the parent's mutation does.
2. A known condition with a next step (an email already registered) branches on `getErrorCode(err)` and adds a banner with a link above the form: `rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm`.

#### Password field and strength meter

- Input in a `relative` wrapper: `type={show ? 'text' : 'password'}`, `className="pr-10 [&::-ms-reveal]:hidden"` (hides the browser's own reveal icon), `autoComplete="new-password"` or `"current-password"`.
- Toggle: `<button type="button" aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">` with `Eye` while hidden, `EyeOff` while shown, at `h-4 w-4 text-muted-foreground`.
- Strength: one point each for 8 or more characters, an upper-case letter, a digit and a non-alphanumeric character; `level = Math.max(1, score)`. Levels 1 to 4: Weak `bg-destructive`, Fair `bg-warning`, Good `bg-accent`, Strong `bg-success`, with the label in the matching `text-*` class.
- Meter, shown once something is typed, from `const strength = getPasswordStrength(password)`: `<Progress value={strength.percent} className="h-1.5" indicatorClassName={strength.color} aria-label="Password strength" />` over `<p className="text-xs text-muted-foreground">Strength: <span className={cn('font-medium', strength.textColor)}>{strength.label}</span></p>`.

```js
// src/lib/utils.js
const PASSWORD_STRENGTH_LEVELS = [
  { label: 'Weak', color: 'bg-destructive', textColor: 'text-destructive' },
  { label: 'Fair', color: 'bg-warning', textColor: 'text-warning' },
  { label: 'Good', color: 'bg-accent', textColor: 'text-accent' },
  { label: 'Strong', color: 'bg-success', textColor: 'text-success' },
]

export function getPasswordStrength(password) {
  let score = 0
  if (password.length >= 8) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  const level = Math.max(1, score) // a typed password never shows an empty bar
  return { score, percent: level * 25, ...PASSWORD_STRENGTH_LEVELS[level - 1] }
}
```

#### Option cards

For a choice among two to four options, style real radios as cards inside `<div role="radiogroup" aria-labelledby={labelId} className="grid grid-cols-2 gap-3">`.

- Card (`label`): `relative flex cursor-pointer flex-col items-start gap-3 rounded-xl border-2 p-4 transition-colors sm:flex-row sm:items-center has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring`; selected `border-primary bg-primary/5`, otherwise `border-border bg-card hover:border-primary/40`.
- Radio: `<input type="radio" value={value} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" {...register('plan')} />`, stretched over the card: a 1px hidden radio makes the page jump when a click focuses it.
- Icon chip: `flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors`; selected `gradient-bg text-white`, otherwise `bg-muted text-muted-foreground`.
- Label `block text-sm font-semibold` (`text-primary` when selected), hint `block text-xs text-muted-foreground`; when selected add `<CheckCircle2 className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-primary" />`.

#### One-time-code step

Build one step around `OtpInput` (see "Primitives: overlays and composites").

1. Submit: `className="w-full" size="lg"`, disabled until every digit is entered and while verifying; `Verify & Continue`, pending `Verifying…`. No auto-submit.
2. Set `invalid` only when the server rejects the code itself, and only if the boxes still hold the submitted code; clear it on the next edit.
3. Resend: a text button `rounded-sm text-sm font-medium text-primary hover:underline cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`, disabled while sending; on success clear the boxes and refocus the input.

#### File upload

One slot holds one file, click-to-select only. The parent validates, uploads and passes `label`, `status` (`idle`, `uploading`, `uploaded`, `error`), `previewUrl`, `error`, `onSelect(file)`, `onClear`, `onRetry`.

- Zone: `relative flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 p-4 text-center transition-colors`; error adds `border-destructive/50 bg-destructive/5`, uploaded `border-success/50 bg-success/5`.
- Prompt: a button `flex flex-col items-center gap-2 rounded-md text-muted-foreground hover:text-foreground cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring` (`Upload` `h-6 w-6`, `Click to upload` in `text-xs font-medium`, limits in `text-[11px]`) opening a hidden file input; reset its value after each change so a file can be re-picked.
- Preview: `h-24 w-auto max-w-full rounded-md object-cover`, with a remove button `absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-card text-muted-foreground shadow-sm hover:text-destructive cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring` (`X` `h-3.5 w-3.5`, `aria-label="Remove {label}"`).
- Status line: `flex min-h-[20px] items-center gap-1.5 text-xs`, icons `h-3.5 w-3.5`: `Loader2` `Uploading…`; `CheckCircle2` `Uploaded` in `text-success`; `AlertCircle` and the message in `text-destructive`, with an `outline` `sm` `Retry` button.

### Choosing a feedback channel

| Situation | Channel |
|---|---|
| Result of an action just taken | toast, `variant: 'success'` or `'destructive'`, from the mutation owner |
| A field value is wrong | inline text under the field plus `aria-invalid` |
| A condition to act on before continuing | inline banner above the form or list |
| Destructive action | confirm dialog; typed confirmation for permanent or bulk deletion |
| A forced state to acknowledge | blocking alert dialog |

1. Toasts never carry form validation, and a field error never appears only in a toast.
2. Of a reversible pair, confirm only the harmful direction (delete, suspend, pause); re-enabling and restoring apply immediately. A decision about another person (approve, reject) is confirmed either way.
3. Never use the browser's `confirm()` or `alert()`.

### Loading, empty and error states

| Loading situation | Treatment |
|---|---|
| First load of a table or card list | skeleton rows `h-12 w-full rounded-xl` in `space-y-3` |
| First load of a detail page | content-shaped blocks, such as `h-48 w-full rounded-xl` and `h-32 w-full rounded-xl` |
| First load of a list inside a card | three skeletons `h-12 w-full rounded-lg` in `space-y-3` |
| Small panel inside a card | `<p className="text-sm text-muted-foreground">Loading…</p>` |

Use no full-page spinner, route-level fallback or page-blocking overlay. The one overlay is a busy layer over the part of a form an action is working on: `absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 rounded-md bg-card/95 text-center backdrop-blur-[1px]` inside a `relative` parent, with the backdrop-fade recipe (see "Motion, icons, content and accessibility"), holding `Loader2` and one line of text.

`EmptyState({ title = 'No data found', description = 'Try adjusting your search or filters.' })`:

```jsx
<motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
  className="flex flex-col items-center justify-center py-16 text-center">
  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
    <Inbox className="h-8 w-8 text-muted-foreground" />
  </div>
  <h3 className="text-lg font-bold">{title}</h3>
  <p className="mt-1 text-sm text-muted-foreground">{description}</p>
</motion.div>
```

1. Use `EmptyState` at page, tab and table level, always with both strings. It has no action slot: the call to action stays in the page header.
2. Inside a card use one muted sentence: `<p className="text-sm text-muted-foreground">No notes yet.</p>`.
3. Choose the copy by the active filter: search first, then status filter, then "nothing created yet".
4. A failed read renders the region error, `<p className="text-sm text-destructive">{getErrorMessage(error)}</p>` in a `Card` with `CardContent className="p-6"`, also in place of a table whose query failed.
5. A missing or forbidden record (a detail read that returns no data, or fails with `error.response?.status` 403 or 404) renders `EmptyState` titled "{Thing} not found"; any other failure renders the region error from rule 4.

### Deviations not to copy

- The original defaults `showExport` and client-mode `selectable` to `true`, yet most call sites (13 and 12 of 15) switch them off, and puts `mr-2` on the icon of the `sm` Export CSV button; default both to `false` and use `mr-1.5`.
- The original never sets `data-state="selected"` on rows and gives sortable headers no active indicator or `aria-sort`; set both.
- The original shows a failed list query as the empty state; branch on `isError` and render the region error.
- The original sets `aria-invalid` in one form of 21 and leaves over 40 labels without `htmlFor`; mark every errored control and give every label an `htmlFor`.
- The original seeds some forms through a `reset` effect and lets one form toast in its own `catch`; use memoised `values` and toast only from the mutation owner.
- The original hard-codes hex colours in charts, which stay light in dark mode; use tokens.
- The original fills three of its four quick-action chips with `bg-success`, `bg-warning` and `bg-accent` under white icons; use the gradient chip on every tile.
- The original mixes `...` with `…` and "Failed to" with "Could not", and builds the password toggle, option cards and code step several ways; use `…`, "Could not" and one recipe each.
- The original hard-codes element ids in the cascading select and gives the searchable select no combobox or listbox ARIA, with its option buttons left in the tab order; derive ids from a prop and apply the roles in the recipe.
- The original `SearchInput` forwards no other props, so it cannot take an `aria-label`; spread the rest props onto its `Input` and label every search field.
- The original's hand-written buttons (sort header, quick-action tile, list row, password toggle, resend, upload prompt, remove file) carry no focus ring; add the focus-ring fragment to each.

---

## 6. Motion, icons, content and accessibility

### Motion

Use `framer-motion` for mount, exit and shared-layout animation and Tailwind `transition-*` utilities for hover, focus and state changes.

#### Recipes

"—" means omit the prop.

| Recipe | `initial` | `animate` | `exit` | `transition` |
|---|---|---|---|---|
| Page enter | `{ opacity: 0, y: 12 }` | `{ opacity: 1, y: 0 }` | — | `{ duration: 0.3, ease: 'easeOut' }` |
| Page header; drop bar under the top bar | `{ opacity: 0, y: -10 }` | `{ opacity: 1, y: 0 }` | —; drop bar `{ opacity: 0, y: -10 }` | — |
| Stat card, grid card | `{ opacity: 0, y: 20 }` | `{ opacity: 1, y: 0 }` | — | `{ delay: index * 0.1, duration: 0.4 }` |
| Chart card, section panel | `{ opacity: 0, y: 20 }` | `{ opacity: 1, y: 0 }` | — | `{ delay }`: `0.15` first, then 0.05 to 0.1 more each, at most `0.5` |
| Feed row | `{ opacity: 0, x: -10 }` | `{ opacity: 1, x: 0 }` | — | `{ delay: i * 0.05 }` |
| Empty state; shortcut tile | `{ opacity: 0, scale: 0.95 }` | `{ opacity: 1, scale: 1 }` | — | —; tiles `{ delay: i * 0.05 }` |
| Auth form | `{ opacity: 0, x: 20 }` | `{ opacity: 1, x: 0 }` | — | `{ duration: 0.5, delay: 0.2 }` |
| Centred card layout | brand block `{ opacity: 0, y: -20 }`, card `{ opacity: 0, y: 20 }` | `{ opacity: 1, y: 0 }` | — | — |
| Tab pill (`layoutId`, unique per tab bar) | — | — | — | `{ type: 'spring', stiffness: 500, damping: 40 }` |
| Tab panel | `{ opacity: 0, y: 8 }` | `{ opacity: 1, y: 0 }` | — | `{ duration: 0.25, ease: 'easeOut' }` |
| Backdrop fade | `{ opacity: 0 }` | `{ opacity: 1 }` | `{ opacity: 0 }` | `{ duration: 0.2 }` |
| Floating panel (`origin-bottom-right`) | `{ opacity: 0, scale: 0.92, y: 12 }` | `{ opacity: 1, scale: 1, y: 0 }` | `{ opacity: 0, scale: 0.95, y: 8 }` | `{ duration: 0.18, ease: 'easeOut' }` |
| Carousel slide (`dir` is `1` or `-1`) | `{ x: dir >= 0 ? 120 : -120, opacity: 0 }` | `{ x: 0, opacity: 1 }` | `{ x: dir >= 0 ? -120 : 120, opacity: 0 }` | `{ duration: 0.25, ease: 'easeOut' }` |
| Success disc | `{ scale: 0, rotate: -25 }` | `{ scale: 1, rotate: 0 }` | — | `{ type: 'spring', stiffness: 260, damping: 16 }` |
| Success check (`strokeWidth={3}`) | `{ scale: 0 }` | `{ scale: 1 }` | — | `{ delay: 0.14, type: 'spring', stiffness: 320, damping: 14 }` |
| Ambient float (auth hero) | — | `{ y: [0, -10, 0] }` | — | `{ duration: 4, repeat: Infinity, ease: 'easeInOut' }` |

1. Where `transition` is "—", omit it: the library defaults (a 0.3 s opacity tween, springs for `x`, `y` and `scale`) are the intended feel. A lone `delay` keeps them.
2. Mount page enter once, in the shell: `<PageTransition key={pathname}><Outlet /></PageTransition>`, keyed on the path (not the query string), so the old page unmounts at once and the new one mounts once. Pages have no exit animation; never wrap the outlet in `AnimatePresence`. An `<Outlet />` inside an exiting wrapper renders the new route, so every page mounts twice and, in a production build, a page whose `layoutId` elements mount during the exit never becomes visible. Keeping the old page alive for an exit instead (the element from `useOutlet()`) leaves it clickable, with its dialogs open and its requests landing, for the whole fade. Pages never wrap themselves.
3. A page adds the header recipe and, at most, card, section, row or tile staggers. Stagger bounded sets only, never data-table rows.
4. Use `exit` only inside `AnimatePresence`; the carousel uses `<AnimatePresence initial={false} custom={dir}>`.
5. Dialogs, menus, selects, the sidebar and the mobile drawer do not animate. Toasts do, with the `toast-*` theme tokens (see "Primitives: overlays and composites"). Never write `animate-in`, `animate-out`, `fade-*`, `zoom-*` or `slide-in-from-*`: no installed package generates them.

#### CSS transitions

| Change | Classes |
|---|---|
| Colour only (inputs, rows, menu items, badges) | `transition-colors` |
| Button, sidebar nav item, tab trigger | `transition-all duration-200` (tab adds `ease-out`) |
| Card hover | `transition-shadow hover:shadow-md`; stat cards and tiles add `whileHover={{ scale: 1.02 }}` |
| Reveal on hover | `transition-opacity` |
| Moving part | `transition-transform` |
| Theme switch on `body` | `transition: background-color 0.3s ease, color 0.3s ease` |

- Without a duration class Tailwind applies 150 ms, `cubic-bezier(0.4, 0, 0.2, 1)`. Never use bare `transition` for a colour-only change.
- Use `animate-spin` only on `Loader2` and `animate-pulse` only on skeletons. Any other keyframe is an `--animate-*` theme token (see "Foundations") with token colours, never an inline `<style>` tag.

#### Reduced motion

1. Wrap the app in `<MotionConfig reducedMotion="user">`: with the OS setting on, transform and layout animations are skipped and opacity fades remain.
2. Prefix keyframe utilities with `motion-safe:` and add `motion-reduce:transition-none` to decorative transform transitions. Spinners and skeletons keep animating as feedback.
3. Use `useReducedMotion()` for what that switch cannot express: skip timed multi-step sequences, leave out infinite decorative loops, give the tab pill `{ duration: 0 }` and the tab panel `initial={false}`.
4. The global stylesheet ends with a `prefers-reduced-motion: reduce` block that turns off smooth scrolling and the `body` theme transition (see "Foundations").

### Icons

Use `lucide-react` only, with named imports. Size icons with a paired `h-* w-*` class, never the `size` prop (an unsized icon renders at 24 px). Keep the default stroke width of 2 and `currentColor` (exception: the animated success check, `strokeWidth={3}`).

| Context | Icon classes |
|---|---|
| Button with label (`default`, `lg`), menu item | `mr-2 h-4 w-4`; trailing `ml-2 h-4 w-4` |
| Button with label (`sm`) | `mr-1.5 h-4 w-4` |
| Icon-only button (`variant="ghost" size="icon"`) | `h-4 w-4` |
| Top-bar icon button | `h-5 w-5` |
| Compact icon button (`size="icon" className="h-6 w-6"`) | `h-3.5 w-3.5` |
| Sidebar nav item | `h-4 w-4 shrink-0` |
| Card or section title, input adornment | `h-4 w-4 text-muted-foreground` |
| Beside `text-xs` meta text, inside chips | `h-3.5 w-3.5` |
| Inside a badge, sort indicator, checkbox tick | `h-3 w-3` |
| Stat-card or form-header chip `h-12 w-12 rounded-xl gradient-bg` | `h-6 w-6 text-white` |
| List-item disc `h-10 w-10 rounded-full bg-muted` | `h-5 w-5 text-muted-foreground` |
| Status disc `h-12 w-12 rounded-full bg-primary/10` | `h-6 w-6 text-primary` (or `success`, `warning` for both) |
| Notice disc `h-14 w-14 rounded-full bg-warning/10` | `h-7 w-7 text-warning` |
| Empty-state disc `h-16 w-16 rounded-full bg-muted` | `h-8 w-8 text-muted-foreground` |
| Busy spinner | `Loader2` with `animate-spin`, same size and margin as the icon it replaces |

- Chips and discs are `flex items-center justify-center`; the icon edge is half the container edge.
- Icons inherit colour. Use `text-muted-foreground` for decorative leading icons and status colours only for status. A destructive icon-only action colours the icon, not the button: `<Trash2 className="h-4 w-4 text-destructive" />`.
- Never fill icons (exception: the radio dot, `h-2 w-2 fill-current`).
- One icon per meaning: busy `Loader2`, add `Plus`, edit `Pencil`, delete or remove `Trash2`, back `ArrowLeft`, close `X`, selected `Check`, success `CheckCircle2`, show and hide `Eye` and `EyeOff`, refresh or resend `RefreshCw`, restore `RotateCcw`.
- lucide sets `aria-hidden="true"` itself: name the interactive parent, never the icon.

### Content style

Write names of places and actions in Title Case without end punctuation: navigation items, page titles, tabs, column headers, card and dialog titles, button labels, field labels. Write messages in sentence case: toast titles, empty-state titles, validation messages and `aria-label` values without end punctuation; descriptions and helper text as full sentences ending in a period.

| Element | Rule | Example |
|---|---|---|
| Page title | Plural noun or "{Noun} Management"; the record's name on detail pages; "New {Thing}" on create pages; context after a spaced em dash | "Customers", "Manage Tags — Acme Ltd" |
| Page subtitle | One line starting with an imperative verb; no period | "Add, view, update and remove customers" |
| Button | Verb first, one to three words. "Add {Thing}" (leading `Plus`) opens a create dialog; "New {Thing}" opens a create page; "Create {Thing}" and "Save Changes" submit; "Cancel" dismisses; "Back to {Place}" (leading `ArrowLeft`) returns | "Add Customer" |
| Delete or remove | "Delete" destroys a record, "Remove" detaches it from a list; keep one verb from `aria-label` to dialog to toast | "Remove Member", then "Member removed" |
| Busy and loading | Present participle plus `…`, beside the spinner; inline loading text is the single word | "Saving…", "Loading…" |
| Success toast | "{Thing} {past participle}"; never "Success" or "successfully"; describe only a consequence or next step | "Customer added" |
| Failure toast | "Could not {verb} {thing}"; the description is the server message from `getErrorMessage(err)` | "Could not save customer" |
| Confirm title and button | "{Verb} {Object}" with the verb of the control that opened it; the button is the verb alone. For an action that is itself a cancellation use "Keep" and "Cancel {Thing}" | "Delete Customer", "Delete" |
| Confirm description | Direct question naming the record in straight double quotes, then the consequence | `Delete "Acme Ltd"? This cannot be undone.` |
| Empty state | Nothing yet: "No {things} yet". No match: "No {things} found". Missing or forbidden: "{Thing} not found". The description names the next step. In a small panel, one muted sentence | "No customers yet" / "Add your first customer to get started." |
| Field label | Noun phrase, no colon; optional fields append " (optional)" | "Mobile Number (optional)" |
| Placeholder | Free text: a realistic sample, prefixed "e.g. " if it could pass for a default. Select: "Select a {thing}". Filter: "All {things}". Search: "Search by {fields}…" | `user@example.com`, `e.g. Front Desk` |
| Validation | "{Field} is required"; "{Field} must be {rule}"; "Enter a valid {thing}"; "{Fields} do not match"; never "Please" | "Password must be at least 8 characters" |

Use the single character `…`, never three dots; an en dash in ranges ("1–10"); a spaced middle dot as inline separator ("Jane Doe · Admin").

### Accessibility

1. Every icon-only control has `aria-label="{Verb} {object}"`; in repeated rows include the record: ``aria-label={`Delete ${row.name}`}``.
2. A toggle names the next action: `aria-label={show ? 'Hide password' : 'Show password'}`. A disclosure toggle sets `aria-expanded` and `aria-controls`; a `<button>` chip or selectable card sets `aria-pressed`.
3. `title` is the only tooltip; when used, it repeats the `aria-label` string exactly.
4. Every form control has a programmatic label: `<Label htmlFor>` with a matching `id`, a wrapping `<label>` (switch and checkbox rows), or `aria-label` where no label is visible (search, filter select). A placeholder is never the label.
5. An invalid control sets `aria-invalid` (it drives the red border and ring) and `aria-describedby` pointing at the `id` of its error paragraph.
6. Every dialog has a title and a description; hide an unwanted description with `className="sr-only"` instead of omitting it. Hand-built overlays set `role="dialog"`, `aria-modal="true"` and `aria-label`.
7. Every image has `alt` (`alt=""` when decorative); duplicated labels carry `aria-hidden="true"`.
8. Anything clickable is a `<button type="button">` or a link, never a `div` with `onClick`. A clickable table row also has a real link or button in its first cell.
9. Every focusable element, including hand-written buttons, links and clickable cards, shows the focus ring (see "Primitives: controls and display"). Use `focus-visible:`, never `focus:`, and never `outline-none` without a ring or a `focus:bg-muted` highlight.
10. Hover-revealed actions stay reachable by keyboard and touch: `opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 max-md:opacity-100`.
11. A hand-built modal layer closes on Escape and backdrop click, traps Tab, moves focus in on open, returns it to the trigger on close and locks body scroll.
12. A hand-built combobox handles Down, Up, Enter and Escape and carries `role="combobox"`, `aria-expanded` and `aria-activedescendant` over a `role="listbox"` of `role="option"` items.
13. Drag-and-drop always has a non-drag alternative, such as a status select.
14. Status is never colour alone: pair it with text, an icon or a signed number.
15. Skeleton containers set `role="status"` and an `aria-label`; a value that updates in place sets `aria-live="polite"`.
16. Targets are 40 px (`h-10`) for primary and icon-only actions and 32 px (`sm`) only in dense toolbars and table cells; an icon-only button is never under 24 × 24 px (`h-6 w-6`). Checkbox (16 px) and Switch (36 × 20 px) are smaller: give each a clickable `<label>`, or keep 24 px of clear space around it, as the table's selection cell does.
17. Body text needs 4.5:1. The tokens fall short for these pairs (light / dark): `text-muted-foreground` on `bg-muted` 4.34 / 5.71; `text-primary` on card 5.17 / 3.45; `text-accent` on card 3.68 / 4.85; `text-destructive` on card 3.76 / 4.74; `text-success` on card 2.54 / 7.04; `text-warning` on card 2.15 / 8.31; white on `bg-destructive` 3.76; white on `.gradient-bg` 5.17 at the first stop, 3.68 at the middle and 2.54 at the last (default Button label, active sidebar item, avatar initials); white icons (3:1 needed) on `bg-success` 2.54 and on `bg-warning` 2.15 (on `bg-accent` they pass at 3.68). Where WCAG AA is required, darken the light-theme text values (`#047857` success, `#92400e` warning, `#b91c1c` destructive; each also passes on its own 10% tint) and keep every stop of `--gradient-accent` at `#2563eb` or darker.

### Storybook conventions

- Stories are optional and need their own packages: `npm i -D storybook@^10.4.2 @storybook/react-vite@^10.4.2 @storybook/addon-docs@^10.4.2 @storybook/addon-a11y@^10.4.2 @storybook/addon-themes@^10.4.2`. `.storybook/main.js` sets `framework: '@storybook/react-vite'` and lists the three addons; the builder loads `vite.config.js`, so Tailwind and the `@/` alias need no extra wiring.
- One file per shared component at `src/stories/<group>/<Component>.stories.jsx`; Storybook loads only `../src/stories/**/*.mdx` and `../src/stories/**/*.stories.@(js|jsx)`.
- Meta: `title: '<Group>/<Component>'` (`UI/Button`), `component`, `tags: ['autodocs']` and `parameters: componentDocs({ description, usage, a11y })`, a helper that joins the three strings into `docs.description.component`.
- One `args` story per variant, size and state (`Default`, `Small`, `Disabled`, `Loading`); stateful demos call `useId()` for ids, because the docs page renders all stories in one document.
- Preview (`.storybook/preview.jsx`): the global stylesheet, `layout: 'centered'`, `docs: { toc: true }`, `a11y: { test: 'todo' }`, `withThemeByClassName({ themes: { light: 'light', dark: 'dark' }, defaultTheme: 'light' })` from `@storybook/addon-themes` and a `<div className="font-sans antialiased">` decorator.
- App-aware stories add a `withProviders` decorator: memory router, query client with `retry: false`, theme, auth, toaster.

The `componentDocs` helper:

```js
// src/stories/helpers/storyMeta.js
export function componentDocs({ description, usage, a11y }) {
  return {
    docs: {
      description: {
        component: [description, usage && `\n\n**Usage:** ${usage}`, a11y && `\n\n**Accessibility:** ${a11y}`]
          .filter(Boolean)
          .join(''),
      },
    },
  }
}
```

### Deviations not to copy

- The original honours reduced motion on 11 of 87 animated elements; set `MotionConfig` once at the root.
- The original has four stat-card staggers, three feed-row variants and three header offsets; use one recipe each.
- The original mixes bare `transition` with `transition-colors` and defines scan keyframes with hex colours in inline `<style>` tags; use `transition-colors` and theme tokens.
- The original uses `Edit` beside `Pencil` and `CheckCircle` beside `CheckCircle2`; keep one icon per meaning.
- The original splits button labels 55 Title Case to 45 sentence case, words failure toasts three ways, mixes `…` with `...` and swaps Delete and Remove within a flow; apply one rule per surface.
- The original leaves 14 of 99 icon-only buttons unnamed and 67 of 229 form controls unlabelled, and sets `aria-invalid` in one form only; name, label and flag every control.
- The original builds draggable cards and clickable rows from non-interactive elements and comboboxes without ARIA roles; use buttons and the combobox pattern.

---

## 7. Checklists

### New project

1. Packages are installed at the versions in section 1. There is no `tailwind.config.js`, no PostCSS config and no animation plugin.
2. `src/index.css` is the stylesheet from section 1, unchanged, imported once in `src/main.jsx`.
3. The `@/` alias resolves in the build and in the editor.
4. `src/lib/utils.js` exports `cn()` and the formatters; `src/lib/constants.js` exports `STATUS_COLORS`.
5. Every Appendix file is at its path, with the fixes from the "Deviations not to copy" lists applied where you want the standard and not the original.
6. Providers are nested in the order given in section 1, including `<MotionConfig reducedMotion="user">`, with exactly one `<Toaster />`.
7. `index.html` holds the pre-paint theme script and `ThemeProvider` keeps `light` or `dark` on `<html>`; switching it recolours every surface with no `dark:` class anywhere in the code.
8. The shell renders without horizontal scrolling at 375px, 768px and 1280px, and the drawer opens and closes below 1024px.

### Every new component

1. A primitive in `src/components/ui/` uses `forwardRef` with a `displayName` and spreads rest props on the root; a component that accepts `className` merges it last through `cn()`.
2. Colours come from token utilities only: no hex values, no raw palette classes, no `dark:`.
3. Interactive parts carry `cursor-pointer`, the focus-ring recipe written with `focus-visible:`, and the disabled recipe.
4. An element with `gradient-bg` gets no `bg-*` utility; swap the class to change its fill.
5. Any z-index comes from the table in section 1.
6. Icon-only buttons have an `aria-label`; every control has a label; decorative icons are hidden from assistive technology.
7. Motion uses a recipe from section 6 and respects reduced motion.

### Every new page

1. The root is `space-y-6`; the header follows the page-header recipe with the only `h1`.
2. Reads show a skeleton while loading, `EmptyState` when there is nothing, and the region error when the request fails.
3. Each mutation raises a success toast and a failure toast from its owner; harmful actions go through a confirm dialog first.
4. Forms use the field block, keep the zod schema and default values beside the form, set `aria-invalid` with every error, and disable the submit button with a spinner while pending.
5. Tables sit in the bordered container and scroll sideways on narrow screens; row actions are icon buttons with labels.
6. The page has been looked at in both themes and at phone width.

---

## Appendix: source to copy

Each block is one file; create it at the path in its heading. This is the source the system was extracted from. It differs from that source in four places only: the API-response normaliser was removed from `src/lib/pagination.js` because it belongs to one backend, the theme storage key in `ThemeContext.jsx` was renamed to `'app_theme'`, one product-specific sentence was removed from a comment in `AnimatedTabs.jsx`, and a product feature name was removed from a comment in `stepper.jsx`.

The files import three things this appendix does not contain: `cn` and `downloadCSV` from `@/lib/utils` and `STATUS_COLORS` from `@/lib/constants`. Create those from section 1.

Read the "Deviations not to copy" lists at the end of sections 1 to 6 before copying: they name the places where these files fall short of the standard.

### Helpers and providers

#### `src/lib/pagination.js`

```js
/**
 * Shared pagination constants and summary text.
 */

export const PAGE_SIZE = {
  client: 8,
  crud: 10,
  location: 50,
}

/**
 * Returns the visible row range for pagination summary text.
 *
 * @param {number} page - 1-based page index
 * @param {number} pageSize
 * @param {number} total
 * @returns {{ start: number, end: number }}
 */
export function getShowingRange(page, pageSize, total) {
  if (total === 0) return { start: 0, end: 0 }
  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)
  return { start, end }
}

/**
 * Builds standardized pagination summary text.
 *
 * @param {{ page: number, pageSize: number, total: number, itemLabel?: string, isFetching?: boolean }} options
 * @returns {string}
 */
export function getPaginationSummary({ page, pageSize, total, itemLabel = 'items', isFetching = false }) {
  const { start, end } = getShowingRange(page, pageSize, total)
  const base = `Showing ${start}–${end} of ${total} ${itemLabel}`
  return isFetching ? `${base} · Updating...` : base
}
```

#### `src/hooks/use-toast.js`

```js
import * as React from 'react'

const TOAST_LIMIT = 3
const TOAST_REMOVE_DELAY = 4000

let count = 0
function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

const actionTypes = {
  ADD_TOAST: 'ADD_TOAST',
  UPDATE_TOAST: 'UPDATE_TOAST',
  DISMISS_TOAST: 'DISMISS_TOAST',
  REMOVE_TOAST: 'REMOVE_TOAST',
}

const toastTimeouts = new Map()

function addToRemoveQueue(toastId) {
  if (toastTimeouts.has(toastId)) return
  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({ type: actionTypes.REMOVE_TOAST, toastId })
  }, TOAST_REMOVE_DELAY)
  toastTimeouts.set(toastId, timeout)
}

function reducer(state, action) {
  switch (action.type) {
    case actionTypes.ADD_TOAST:
      return { ...state, toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT) }
    case actionTypes.UPDATE_TOAST:
      return { ...state, toasts: state.toasts.map((t) => (t.id === action.toast.id ? { ...t, ...action.toast } : t)) }
    case actionTypes.DISMISS_TOAST: {
      const { toastId } = action
      if (toastId) addToRemoveQueue(toastId)
      else state.toasts.forEach((t) => addToRemoveQueue(t.id))
      return { ...state, toasts: state.toasts.map((t) => (t.id === toastId || toastId === undefined ? { ...t, open: false } : t)) }
    }
    case actionTypes.REMOVE_TOAST:
      if (action.toastId === undefined) return { ...state, toasts: [] }
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.toastId) }
    default:
      return state
  }
}

const listeners = []
let memoryState = { toasts: [] }

function dispatch(action) {
  memoryState = reducer(memoryState, action)
  listeners.forEach((listener) => listener(memoryState))
}

function toast({ ...props }) {
  const id = genId()
  const dismiss = () => dispatch({ type: actionTypes.DISMISS_TOAST, toastId: id })
  dispatch({
    type: actionTypes.ADD_TOAST,
    toast: { ...props, id, open: true, onOpenChange: (open) => { if (!open) dismiss() } },
  })
  return { id, dismiss, update: (props) => dispatch({ type: actionTypes.UPDATE_TOAST, toast: { ...props, id } }) }
}

function useToast() {
  const [state, setState] = React.useState(memoryState)
  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) listeners.splice(index, 1)
    }
  }, [state])
  return { ...state, toast, dismiss: (toastId) => dispatch({ type: actionTypes.DISMISS_TOAST, toastId }) }
}

export { useToast, toast }
```

#### `src/context/ThemeContext.jsx`

```jsx
import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('app_theme') || 'light')

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(theme)
    localStorage.setItem('app_theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'))

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, isDark: theme === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}
```

### Primitives (`src/components/ui/`)

#### `src/components/ui/avatar.jsx`

```jsx
import * as React from 'react'
import * as AvatarPrimitive from '@radix-ui/react-avatar'
import { cn } from '@/lib/utils'

const Avatar = React.forwardRef(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn('relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full', className)}
    {...props}
  />
))
Avatar.displayName = AvatarPrimitive.Root.displayName

const AvatarImage = React.forwardRef(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image ref={ref} className={cn('aspect-square h-full w-full', className)} {...props} />
))
AvatarImage.displayName = AvatarPrimitive.Image.displayName

const AvatarFallback = React.forwardRef(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn('flex h-full w-full items-center justify-center rounded-full bg-muted text-sm font-medium', className)}
    {...props}
  />
))
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName

export { Avatar, AvatarImage, AvatarFallback }
```

#### `src/components/ui/badge.jsx`

```jsx
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors capitalize',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'text-foreground border-border',
        success: 'border-success/20 bg-success/10 text-success',
        warning: 'border-warning/20 bg-warning/10 text-warning',
        destructive: 'border-destructive/20 bg-destructive/10 text-destructive',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

function Badge({ className, variant, ...props }) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
```

#### `src/components/ui/button.jsx`

```jsx
import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
  {
    variants: {
      variant: {
        default: 'gradient-bg text-white shadow-sm hover:opacity-90 hover:shadow-md',
        destructive: 'bg-destructive text-white hover:bg-destructive/90',
        outline: 'border border-border bg-card hover:bg-muted text-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-muted text-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-11 rounded-lg px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button'
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
})
Button.displayName = 'Button'

export { Button, buttonVariants }
```

#### `src/components/ui/card.jsx`

```jsx
import * as React from 'react'
import { cn } from '@/lib/utils'

const Card = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('rounded-xl border border-border bg-card text-card-foreground shadow-sm', className)} {...props} />
))
Card.displayName = 'Card'

const CardHeader = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
))
CardHeader.displayName = 'CardHeader'

const CardTitle = React.forwardRef(({ className, ...props }, ref) => (
  <h3 ref={ref} className={cn('text-lg font-bold leading-none tracking-tight', className)} {...props} />
))
CardTitle.displayName = 'CardTitle'

const CardDescription = React.forwardRef(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
))
CardDescription.displayName = 'CardDescription'

const CardContent = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
))
CardContent.displayName = 'CardContent'

const CardFooter = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex items-center p-6 pt-0', className)} {...props} />
))
CardFooter.displayName = 'CardFooter'

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
```

#### `src/components/ui/checkbox.jsx`

```jsx
import * as React from 'react'
import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const Checkbox = React.forwardRef(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      'peer h-4 w-4 shrink-0 rounded border border-border ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground cursor-pointer',
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className={cn('flex items-center justify-center text-current')}>
      <Check className="h-3 w-3" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
```

#### `src/components/ui/dialog.jsx`

```jsx
import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogPortal = DialogPrimitive.Portal
const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn('fixed inset-0 z-50 bg-black/50 backdrop-blur-sm', className)}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef(({ className, overlayClassName, children, showCloseButton = true, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay className={overlayClassName} />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border border-border bg-card p-6 shadow-xl rounded-xl duration-200',
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({ className, ...props }) => (
  <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)} {...props} />
)

const DialogFooter = ({ className, ...props }) => (
  <div className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)} {...props} />
)

const DialogTitle = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn('text-lg font-bold leading-none tracking-tight', className)} {...props} />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export { Dialog, DialogPortal, DialogOverlay, DialogClose, DialogTrigger, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription }
```

#### `src/components/ui/dropdown-menu.jsx`

```jsx
import * as React from 'react'
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { Check, ChevronRight, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'

const DropdownMenu = DropdownMenuPrimitive.Root
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger
const DropdownMenuGroup = DropdownMenuPrimitive.Group
const DropdownMenuPortal = DropdownMenuPrimitive.Portal
const DropdownMenuSub = DropdownMenuPrimitive.Sub
const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup

const DropdownMenuSubTrigger = React.forwardRef(({ className, inset, children, ...props }, ref) => (
  <DropdownMenuPrimitive.SubTrigger
    ref={ref}
    className={cn('flex cursor-pointer select-none items-center rounded-md px-2 py-1.5 text-sm outline-none focus:bg-muted data-[state=open]:bg-muted', inset && 'pl-8', className)}
    {...props}
  >
    {children}
    <ChevronRight className="ml-auto h-4 w-4" />
  </DropdownMenuPrimitive.SubTrigger>
))
DropdownMenuSubTrigger.displayName = DropdownMenuPrimitive.SubTrigger.displayName

const DropdownMenuSubContent = React.forwardRef(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.SubContent
    ref={ref}
    className={cn('z-50 min-w-[8rem] overflow-hidden rounded-lg border border-border bg-card p-1 text-foreground shadow-lg', className)}
    {...props}
  />
))
DropdownMenuSubContent.displayName = DropdownMenuPrimitive.SubContent.displayName

const DropdownMenuContent = React.forwardRef(({ className, sideOffset = 4, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn('z-50 min-w-[8rem] overflow-hidden rounded-lg border border-border bg-card p-1 text-foreground shadow-lg', className)}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
))
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName

const DropdownMenuItem = React.forwardRef(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn('relative flex cursor-pointer select-none items-center rounded-md px-2 py-1.5 text-sm outline-none transition-colors focus:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50', inset && 'pl-8', className)}
    {...props}
  />
))
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName

const DropdownMenuCheckboxItem = React.forwardRef(({ className, children, checked, ...props }, ref) => (
  <DropdownMenuPrimitive.CheckboxItem
    ref={ref}
    className={cn('relative flex cursor-pointer select-none items-center rounded-md py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-muted', className)}
    checked={checked}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.CheckboxItem>
))
DropdownMenuCheckboxItem.displayName = DropdownMenuPrimitive.CheckboxItem.displayName

const DropdownMenuRadioItem = React.forwardRef(({ className, children, ...props }, ref) => (
  <DropdownMenuPrimitive.RadioItem
    ref={ref}
    className={cn('relative flex cursor-pointer select-none items-center rounded-md py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-muted', className)}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Circle className="h-2 w-2 fill-current" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.RadioItem>
))
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName

const DropdownMenuLabel = React.forwardRef(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Label ref={ref} className={cn('px-2 py-1.5 text-sm font-semibold', inset && 'pl-8', className)} {...props} />
))
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName

const DropdownMenuSeparator = React.forwardRef(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator ref={ref} className={cn('-mx-1 my-1 h-px bg-border', className)} {...props} />
))
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName

const DropdownMenuShortcut = ({ className, ...props }) => (
  <span className={cn('ml-auto text-xs tracking-widest opacity-60', className)} {...props} />
)

export {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuCheckboxItem,
  DropdownMenuRadioItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuGroup,
  DropdownMenuPortal, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuRadioGroup,
}
```

#### `src/components/ui/input.jsx`

```jsx
import * as React from 'react'
import { cn } from '@/lib/utils'

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        'flex h-10 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive',
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Input.displayName = 'Input'

export { Input }
```

#### `src/components/ui/label.jsx`

```jsx
import * as React from 'react'
import * as LabelPrimitive from '@radix-ui/react-label'
import { cn } from '@/lib/utils'

const Label = React.forwardRef(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn('text-sm font-medium text-foreground leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70', className)}
    {...props}
  />
))
Label.displayName = LabelPrimitive.Root.displayName

export { Label }
```

#### `src/components/ui/otp-input.jsx`

```jsx
import * as React from 'react'
import { OTPInput, REGEXP_ONLY_DIGITS } from 'input-otp'
import { cn } from '@/lib/utils'

/**
 * One box of the code. Purely visual: the real (invisible) input sits on top of the whole row and
 * owns typing, paste, selection and autofill.
 */
function OtpSlot({ char, isActive, hasFakeCaret, invalid }) {
  const filled = char != null && char !== ''
  return (
    <div
      data-otp-box
      // Decoration only: assistive tech reads the real input, not the digits drawn in the boxes.
      aria-hidden="true"
      className={cn(
        'relative flex h-12 min-w-0 max-w-12 flex-1 items-center justify-center rounded-xl border-2 bg-card text-xl font-bold tabular-nums',
        'transition-all duration-200 motion-reduce:transition-none sm:h-14',
        filled ? 'border-primary/40 bg-primary/5 text-foreground' : 'border-border text-muted-foreground',
        isActive && 'border-primary shadow-md ring-4 ring-primary/15 motion-safe:-translate-y-0.5',
        invalid && 'border-destructive bg-destructive/5 text-destructive',
        invalid && isActive && 'ring-destructive/15',
      )}
    >
      {filled ? (
        // `key` restarts the pop each time the digit in this box changes.
        <span key={char} className="motion-safe:animate-otp-pop">{char}</span>
      ) : hasFakeCaret ? (
        <span className="h-6 w-0.5 rounded-full bg-primary motion-safe:animate-caret-blink" />
      ) : (
        <span className="h-1.5 w-1.5 rounded-full bg-border" />
      )}
      {/* Fills in under each entered digit, so the row reads as progress through the code. */}
      <span
        className={cn(
          'absolute inset-x-2.5 bottom-1.5 h-0.5 origin-left rounded-full transition-transform duration-300 motion-reduce:transition-none',
          invalid ? 'bg-destructive' : 'gradient-bg',
          filled ? 'scale-x-100' : 'scale-x-0',
        )}
      />
    </div>
  )
}

/**
 * Puts the selection on the box that was clicked or tapped. The real input's own (invisible) text
 * is not laid out under the boxes, so without this every click lands on the last digit. A filled
 * box gets its digit selected, so typing replaces it; an empty box means "continue at the end".
 */
function selectClickedBox(event) {
  // A click with no pointer position keeps the default: caret at the end.
  if (event.detail === 0) return
  const input = event.currentTarget
  const row = input.closest('[data-input-otp-container]')
  if (!row) return
  // So does a click that is not on the row: the browser forwards a press on the <label> to the
  // input as an ordinary click (detail 1 in Chrome) that carries the label's coordinates.
  const bounds = row.getBoundingClientRect()
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) return
  const boxes = Array.from(row.querySelectorAll('[data-otp-box]'))
  if (boxes.length === 0) return
  let index = 0
  let nearest = Infinity
  boxes.forEach((box, i) => {
    const rect = box.getBoundingClientRect()
    const distance = Math.abs(event.clientX - (rect.left + rect.width / 2))
    if (distance < nearest) {
      nearest = distance
      index = i
    }
  })
  const filled = input.value.length
  if (index < filled) input.setSelectionRange(index, index + 1)
  else input.setSelectionRange(filled, filled)
}

/**
 * One-time-code entry shown as separate boxes, one per digit, split into two groups.
 *
 * Underneath it is a single real text field (via `input-otp`), so typing, Backspace, arrow keys,
 * pasting a whole code and the phone keyboard's "code from message/mail" suggestion all behave as
 * they do in a normal input — the boxes only draw what that field holds.
 *
 * @param {object} props
 * @param {string} props.value - The digits entered so far.
 * @param {(value: string) => void} props.onChange
 * @param {(value: string) => void} [props.onComplete] - Called when every box is filled.
 * @param {number} [props.length=6] - Number of digits.
 * @param {boolean} [props.invalid=false] - Red boxes with a short shake (e.g. wrong code).
 * @param {string} [props.className] - Extra classes for the row of boxes.
 * Any other prop (`id`, `autoFocus`, `disabled`, `aria-label`, …) goes to the underlying input.
 */
const OtpInput = React.forwardRef(({ length = 6, invalid = false, className, onClick, value, onChange, ...props }, ref) => {
  const half = Math.ceil(length / 2)
  // Where the last edit removed a digit, read while the caret still sits there (the library moves
  // the selection straight afterwards).
  const removedAt = React.useRef(null)
  return (
    <OTPInput
      ref={ref}
      maxLength={length}
      inputMode="numeric"
      pattern={REGEXP_ONLY_DIGITS}
      autoComplete="one-time-code"
      // A code copied as "482 913" or "482-913" still pastes.
      pasteTransformer={(pasted) => pasted.replace(/\D/g, '')}
      aria-invalid={invalid || undefined}
      value={value}
      onInputCapture={(event) => {
        const field = event.currentTarget
        removedAt.current = field.value.length === (value ?? '').length - 1 ? field.selectionStart : null
      }}
      onChange={(next) => {
        const current = value ?? ''
        const at = removedAt.current
        removedAt.current = null
        // The one field cannot hold a gap. Removing a digit that is not the last would shift the
        // later digits left and leave the box before it selected, so the next digit typed would
        // land in the wrong box. Clear from the removed box onward instead: it becomes the empty,
        // active box.
        const leavesGap = at !== null && at < next.length && next === current.slice(0, at) + current.slice(at + 1)
        onChange?.(leavesGap ? current.slice(0, at) : next)
      }}
      // Runs before the library's own paste handler, which only replaces the selected box.
      onPasteCapture={(event) => {
        const digits = event.clipboardData.getData('text/plain').replace(/\D/g, '')
        if (digits.length === 0) {
          // Nothing usable: leave the code alone (the library would delete the selected digit).
          event.preventDefault()
          event.stopPropagation()
        } else if (digits.length >= length) {
          // A whole code replaces whatever is there instead of being spliced into the old digits.
          event.currentTarget.setSelectionRange(0, event.currentTarget.value.length)
        }
      }}
      onClick={(event) => {
        selectClickedBox(event)
        onClick?.(event)
      }}
      containerClassName={cn(
        'flex w-full items-center justify-center gap-1.5 has-[:disabled]:opacity-60 sm:gap-2',
        invalid && 'motion-safe:animate-otp-shake',
        className,
      )}
      render={({ slots }) => (
        <>
          {slots.slice(0, half).map((slot, index) => (
            <OtpSlot key={index} {...slot} invalid={invalid} />
          ))}
          <span className="h-1 w-2 shrink-0 rounded-full bg-border sm:w-3" aria-hidden="true" />
          {slots.slice(half).map((slot, index) => (
            <OtpSlot key={half + index} {...slot} invalid={invalid} />
          ))}
        </>
      )}
      {...props}
    />
  )
})
OtpInput.displayName = 'OtpInput'

export { OtpInput }
```

#### `src/components/ui/progress.jsx`

```jsx
import * as React from 'react'
import * as ProgressPrimitive from '@radix-ui/react-progress'
import { cn } from '@/lib/utils'

const Progress = React.forwardRef(({ className, value, indicatorClassName, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn('relative h-2 w-full overflow-hidden rounded-full bg-muted', className)}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className={cn('h-full w-full flex-1 transition-all duration-500 rounded-full', indicatorClassName ?? 'gradient-bg')}
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </ProgressPrimitive.Root>
))
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }
```

#### `src/components/ui/select.jsx`

```jsx
import * as React from 'react'
import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

const Select = SelectPrimitive.Root
const SelectGroup = SelectPrimitive.Group
const SelectValue = SelectPrimitive.Value

const SelectTrigger = React.forwardRef(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      'flex h-10 w-full items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer',
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName

const SelectContent = React.forwardRef(({ className, children, position = 'popper', ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        'relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-lg border border-border bg-card text-foreground shadow-md',
        position === 'popper' && 'data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1',
        className
      )}
      position={position}
      {...props}
    >
      <SelectPrimitive.ScrollUpButton className="flex cursor-default items-center justify-center py-1">
        <ChevronUp className="h-4 w-4" />
      </SelectPrimitive.ScrollUpButton>
      <SelectPrimitive.Viewport className={cn('p-1', position === 'popper' && 'h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]')}>
        {children}
      </SelectPrimitive.Viewport>
      <SelectPrimitive.ScrollDownButton className="flex cursor-default items-center justify-center py-1">
        <ChevronDown className="h-4 w-4" />
      </SelectPrimitive.ScrollDownButton>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
))
SelectContent.displayName = SelectPrimitive.Content.displayName

const SelectItem = React.forwardRef(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex w-full cursor-pointer select-none items-center rounded-md py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
SelectItem.displayName = SelectPrimitive.Item.displayName

export { Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectItem }
```

#### `src/components/ui/separator.jsx`

```jsx
import * as React from 'react'
import * as SeparatorPrimitive from '@radix-ui/react-separator'
import { cn } from '@/lib/utils'

const Separator = React.forwardRef(({ className, orientation = 'horizontal', decorative = true, ...props }, ref) => (
  <SeparatorPrimitive.Root
    ref={ref}
    decorative={decorative}
    orientation={orientation}
    className={cn('shrink-0 bg-border', orientation === 'horizontal' ? 'h-[1px] w-full' : 'h-full w-[1px]', className)}
    {...props}
  />
))
Separator.displayName = SeparatorPrimitive.Root.displayName

export { Separator }
```

#### `src/components/ui/skeleton.jsx`

```jsx
import { cn } from '@/lib/utils'

function Skeleton({ className, ...props }) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />
}

export { Skeleton }
```

#### `src/components/ui/stepper.jsx`

```jsx
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Horizontal step indicator for multi-step flows (e.g. a create wizard). Each step is a
 * numbered circle with its name centered BELOW it in small text; a connecting line runs between the
 * circles and fills up to the active step.
 *
 * @param {object} props
 * @param {Array<{ label: string }>} props.steps - Each step's `label` is shown under its number.
 * @param {number} props.current - 0-based index of the active step.
 * @param {number[]} [props.completed] - 0-based indexes already completed.
 * @param {(index: number) => void} [props.onStepClick] - Enables back-nav to a visited step.
 */
export function Stepper({ steps, current, completed = [], onStepClick, className }) {
  return (
    <ol className={cn('flex w-full items-start', className)}>
      {steps.map((step, index) => {
        const isCompleted = completed.includes(index) || index < current
        const isActive = index === current
        const clickable = typeof onStepClick === 'function' && (isCompleted || index < current)
        const Circle = clickable ? 'button' : 'div'
        const isLast = index === steps.length - 1

        return (
          <li key={step.label} className="flex flex-1 flex-col items-center">
            {/* Circle flanked by connector segments so the line stays continuous across steps. */}
            <div className="flex w-full items-center">
              <span
                className={cn(
                  'h-0.5 flex-1 transition-colors',
                  index === 0 ? 'invisible' : index <= current ? 'bg-primary' : 'bg-border'
                )}
              />
              <Circle
                type={clickable ? 'button' : undefined}
                onClick={clickable ? () => onStepClick(index) : undefined}
                aria-current={isActive ? 'step' : undefined}
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-colors',
                  isActive && 'gradient-bg border-0 text-white shadow-sm',
                  isCompleted && !isActive && 'gradient-bg border-0 text-white',
                  !isActive && !isCompleted && 'border-border bg-card text-muted-foreground',
                  clickable && 'cursor-pointer'
                )}
              >
                {isCompleted && !isActive ? <Check className="h-4 w-4" /> : index + 1}
              </Circle>
              <span
                className={cn(
                  'h-0.5 flex-1 transition-colors',
                  isLast ? 'invisible' : index < current ? 'bg-primary' : 'bg-border'
                )}
              />
            </div>
            <p
              className={cn(
                'mt-1.5 px-1 text-center text-[11px] font-medium leading-tight',
                isActive ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              {step.label}
            </p>
          </li>
        )
      })}
    </ol>
  )
}
```

#### `src/components/ui/switch.jsx`

```jsx
import * as React from 'react'
import * as SwitchPrimitives from '@radix-ui/react-switch'
import { cn } from '@/lib/utils'

const Switch = React.forwardRef(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-border',
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        'pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0'
      )}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
```

#### `src/components/ui/table.jsx`

```jsx
import * as React from 'react'
import { cn } from '@/lib/utils'

const Table = React.forwardRef(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-auto">
    <table ref={ref} className={cn('w-full caption-bottom text-sm', className)} {...props} />
  </div>
))
Table.displayName = 'Table'

const TableHeader = React.forwardRef(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn('[&_tr]:border-b border-border', className)} {...props} />
))
TableHeader.displayName = 'TableHeader'

const TableBody = React.forwardRef(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn('[&_tr:last-child]:border-0', className)} {...props} />
))
TableBody.displayName = 'TableBody'

const TableRow = React.forwardRef(({ className, ...props }, ref) => (
  <tr ref={ref} className={cn('border-b border-border transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted', className)} {...props} />
))
TableRow.displayName = 'TableRow'

const TableHead = React.forwardRef(({ className, ...props }, ref) => (
  <th ref={ref} className={cn('h-11 px-4 text-left align-middle text-xs font-semibold text-muted-foreground uppercase tracking-wider', className)} {...props} />
))
TableHead.displayName = 'TableHead'

const TableCell = React.forwardRef(({ className, ...props }, ref) => (
  <td ref={ref} className={cn('p-4 align-middle font-medium', className)} {...props} />
))
TableCell.displayName = 'TableCell'

export { Table, TableHeader, TableBody, TableHead, TableRow, TableCell }
```

#### `src/components/ui/tabs.jsx`

```jsx
import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '@/lib/utils'

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn('inline-flex h-10 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground', className)}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-all duration-200 ease-out hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm data-[state=active]:hover:text-primary-foreground cursor-pointer',
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn('mt-4 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', className)}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
```

#### `src/components/ui/textarea.jsx`

```jsx
import * as React from 'react'
import { cn } from '@/lib/utils'

const Textarea = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-[80px] w-full rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
})
Textarea.displayName = 'Textarea'

export { Textarea }
```

#### `src/components/ui/toast.jsx`

```jsx
import * as React from 'react'
import * as ToastPrimitives from '@radix-ui/react-toast'
import { cva } from 'class-variance-authority'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

const ToastProvider = ToastPrimitives.Provider

const ToastViewport = React.forwardRef(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn('fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse gap-2 p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]', className)}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitives.Viewport.displayName

const toastVariants = cva(
  'group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-lg border border-border p-4 pr-8 shadow-lg transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none motion-safe:data-[state=open]:animate-toast-in-top motion-safe:data-[state=open]:sm:animate-toast-in-bottom motion-safe:data-[state=closed]:animate-toast-out',
  {
    variants: {
      variant: {
        default: 'border bg-card text-foreground',
        // The 10% tint is mixed into `--toast-surface`, so the toast is opaque (a plain `bg-success/10` lets the page show through).
        success: 'border-success/20 bg-[color-mix(in_oklab,var(--color-success)_10%,var(--toast-surface))] text-success',
        destructive: 'border-destructive/20 bg-[color-mix(in_oklab,var(--color-destructive)_10%,var(--toast-surface))] text-destructive',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

const Toast = React.forwardRef(({ className, variant, onKeyDown, ...props }, ref) => (
  <ToastPrimitives.Root
    ref={ref}
    className={cn(toastVariants({ variant }), className)}
    onKeyDown={(event) => {
      onKeyDown?.(event)
      // A toast that is already closing is only still mounted for its exit animation. Keep Radix's own
      // Escape handler off it, or it swallows the Escape meant for the next toast.
      if (event.key === 'Escape' && event.currentTarget.dataset.state === 'closed') event.preventDefault()
    }}
    {...props}
  />
))
Toast.displayName = ToastPrimitives.Root.displayName

const ToastAction = React.forwardRef(({ className, ...props }, ref) => (
  <ToastPrimitives.Action ref={ref} className={cn('inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-border bg-transparent px-3 text-sm font-medium transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring', className)} {...props} />
))
ToastAction.displayName = ToastPrimitives.Action.displayName

const ToastClose = React.forwardRef(({ className, ...props }, ref) => (
  <ToastPrimitives.Close ref={ref} className={cn('absolute right-2 top-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100 cursor-pointer', className)} toast-close="" {...props}>
    <X className="h-4 w-4" />
  </ToastPrimitives.Close>
))
ToastClose.displayName = ToastPrimitives.Close.displayName

const ToastTitle = React.forwardRef(({ className, ...props }, ref) => (
  <ToastPrimitives.Title ref={ref} className={cn('text-sm font-semibold', className)} {...props} />
))
ToastTitle.displayName = ToastPrimitives.Title.displayName

const ToastDescription = React.forwardRef(({ className, ...props }, ref) => (
  <ToastPrimitives.Description ref={ref} className={cn('text-sm opacity-90', className)} {...props} />
))
ToastDescription.displayName = ToastPrimitives.Description.displayName

export { ToastProvider, ToastViewport, Toast, ToastTitle, ToastDescription, ToastClose, ToastAction }
```

#### `src/components/ui/toaster.jsx`

```jsx
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from '@/components/ui/toast'
import { useToast } from '@/hooks/use-toast'

export function Toaster() {
  const { toasts, dismiss } = useToast()
  // A toast that is sliding out is still the top Escape layer until it unmounts. It passes the key on
  // to the newest toast that is still open, so an Escape pressed during the exit is not lost.
  const closeNewestOpen = () => {
    const next = toasts.find((t) => t.open)
    if (next) dismiss(next.id)
  }
  return (
    <ToastProvider>
      {toasts.map(({ id, title, description, action, ...props }) => (
        <Toast key={id} {...props} onEscapeKeyDown={props.open ? props.onEscapeKeyDown : closeNewestOpen}>
          <div className="grid gap-1">
            {title && <ToastTitle>{title}</ToastTitle>}
            {description && <ToastDescription>{description}</ToastDescription>}
          </div>
          {action}
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  )
}
```

### Shared composites

#### `src/components/modals/ConfirmModal.jsx`

```jsx
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export function ConfirmModal({ open, onOpenChange, title, description, confirmLabel = 'Confirm', variant = 'default', onConfirm, loading }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button variant={variant === 'destructive' ? 'destructive' : 'default'} onClick={onConfirm} disabled={loading}>
            {loading ? 'Processing...' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

#### `src/components/modals/TypeConfirmModal.jsx`

```jsx
import { useId, useState } from 'react'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * A confirmation modal that requires the user to type an exact word (default `"DELETE"`,
 * case-sensitive) before the confirm button enables — a guardrail for destructive/irreversible
 * actions. Mirrors `ConfirmModal`'s props and styling, adding the typed-to-confirm Input. The typed
 * value resets whenever the dialog opens (the body remounts with `DialogContent`).
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {string} props.title
 * @param {string} props.description
 * @param {string} [props.confirmWord='DELETE'] - Exact text the user must type (case-sensitive).
 * @param {string} [props.confirmLabel='Delete']
 * @param {'default'|'destructive'} [props.variant='destructive']
 * @param {() => void} props.onConfirm
 * @param {boolean} [props.loading]
 */
export function TypeConfirmModal({
  open,
  onOpenChange,
  title,
  description,
  confirmWord = 'DELETE',
  confirmLabel = 'Delete',
  variant = 'destructive',
  onConfirm,
  loading,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {/* Rendered only while open (DialogContent unmounts on close), so the typed value always
            starts empty on the next open — no reset effect needed. */}
        <TypeConfirmBody
          confirmWord={confirmWord}
          confirmLabel={confirmLabel}
          variant={variant}
          onCancel={() => onOpenChange(false)}
          onConfirm={onConfirm}
          loading={loading}
        />
      </DialogContent>
    </Dialog>
  )
}

function TypeConfirmBody({ confirmWord, confirmLabel, variant, onCancel, onConfirm, loading }) {
  const [value, setValue] = useState('')
  const inputId = useId()
  const confirmed = value === confirmWord

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={inputId}>
          Type <span className="font-semibold text-foreground">{confirmWord}</span> to confirm
        </Label>
        <Input
          id={inputId}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={confirmWord}
          autoComplete="off"
          disabled={loading}
        />
      </div>
      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant={variant === 'destructive' ? 'destructive' : 'default'}
          onClick={onConfirm}
          disabled={loading || !confirmed}
        >
          {loading ? 'Processing...' : confirmLabel}
        </Button>
      </DialogFooter>
    </>
  )
}
```

#### `src/components/common/EmptyState.jsx`

```jsx
import { motion } from 'framer-motion'
import { Inbox } from 'lucide-react'

export function EmptyState({ title = 'No data found', description = 'Try adjusting your search or filters.' }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Inbox className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-bold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </motion.div>
  )
}
```

#### `src/components/common/SearchInput.jsx`

```jsx
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export function SearchInput({ value, onChange, placeholder = 'Search...', className }) {
  return (
    <div className={cn('relative', className)}>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9"
      />
    </div>
  )
}
```

#### `src/components/common/StatusBadge.jsx`

```jsx
import { Badge } from '@/components/ui/badge'
import { STATUS_COLORS } from '@/lib/constants'
import { cn } from '@/lib/utils'

export function StatusBadge({ status }) {
  return (
    <Badge variant="outline" className={cn('capitalize', STATUS_COLORS[status] || '')}>
      {status?.replace('_', ' ')}
    </Badge>
  )
}
```

#### `src/components/common/PageTransition.jsx`

```jsx
import { motion } from 'framer-motion'

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
}

export function PageTransition({ children, className }) {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
```

#### `src/components/common/AnimatedTabs.jsx`

```jsx
import { motion, useReducedMotion } from 'framer-motion'
import { TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

/**
 * A shadcn TabsList whose active tab is a blue pill that SLIDES between tabs (framer-motion
 * `layoutId`), with a two-layer label so the active text is always white-on-blue (no flash while the
 * pill is mid-slide). Must be used inside a CONTROLLED
 * `<Tabs value={v} onValueChange={setV}>` and given the same `value`.
 *
 * @param {object} props
 * @param {Array<{value: string, label: React.ReactNode}>} props.tabs
 * @param {string} props.value - the active tab value (same as the controlled `<Tabs value>`)
 * @param {string} props.layoutId - unique per mounted list (framer-motion shared-layout id)
 * @param {string} [props.className] - extra classes for the TabsList
 */
export function AnimatedTabsList({ tabs, value, layoutId, className }) {
  const reduceMotion = useReducedMotion()
  return (
    <TabsList className={cn('h-auto flex-wrap justify-start gap-1', className)}>
      {tabs.map((t) => (
        <TabsTrigger
          key={t.value}
          value={t.value}
          className="relative data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground data-[state=active]:hover:text-foreground"
        >
          {/* Sliding blue pill carries its own white label → active text is always white-on-blue. */}
          {value === t.value && (
            <motion.span
              layoutId={layoutId}
              aria-hidden="true"
              className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm"
              transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 40 }}
            >
              {t.label}
            </motion.span>
          )}
          {/* Base label stays readable on the muted track (dark, not white). */}
          <span>{t.label}</span>
        </TabsTrigger>
      ))}
    </TabsList>
  )
}

/**
 * A TabsContent whose body fades + slides in when its tab becomes active. Radix remounts a tab's
 * content on switch, so the enter animation replays every change. Respects prefers-reduced-motion.
 *
 * @param {object} props
 * @param {string} props.value
 * @param {string} [props.className]
 * @param {React.ReactNode} props.children
 */
export function AnimatedTabPanel({ value, className, children }) {
  const reduce = useReducedMotion()
  return (
    <TabsContent value={value}>
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduce ? 0 : 0.25, ease: 'easeOut' }}
        className={className}
      >
        {children}
      </motion.div>
    </TabsContent>
  )
}
```

### Data table (`src/components/tables/`)

#### `src/components/tables/DataTable.jsx`

```jsx
import { useState, useMemo, useReducer } from 'react'
import { ArrowUpDown, Download } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { EmptyState } from '@/components/common/EmptyState'
import { TableContainer } from '@/components/tables/TableContainer'
import { TablePagination } from '@/components/tables/TablePagination'
import { TableLoadingSkeleton } from '@/components/tables/TableLoadingSkeleton'
import { PAGE_SIZE } from '@/lib/pagination'
import { downloadCSV } from '@/lib/utils'

/**
 * Unified data table for client-side and server-side paginated lists.
 *
 * @param {object} props
 * @param {Array} props.columns - Column definitions with key, label, sortable, render(row, index)
 * @param {Array} props.data
 * @param {'client'|'server'} [props.mode='client']
 * @param {number} [props.pageSize]
 * @param {number} [props.page] - Server mode: 1-based current page
 * @param {number} [props.totalPages]
 * @param {number} [props.total]
 * @param {(page: number) => void} [props.onPageChange]
 * @param {boolean} [props.isLoading]
 * @param {boolean} [props.isFetching]
 * @param {string} [props.emptyTitle]
 * @param {string} [props.emptyDescription]
 * @param {string} [props.exportFilename]
 * @param {string} [props.itemLabel]
 * @param {boolean} [props.showExport]
 * @param {boolean} [props.selectable]
 * @param {Function} [props.onRowClick]
 * @param {Function} [props.bulkActions]
 * @param {(row: object) => string|number} [props.getRowId]
 */
// One shared empty list: an omitted `data` must keep the same identity on every render.
const NO_ROWS = []

// `clientPage` and `selected` are also reset during render (below), so they use useReducer, not useState:
// useState checks an event's update against the last render even when that render was thrown away
// (a pending transition), which drops or miscomputes the update. useReducer has no such shortcut.
const replaceState = (prev, next) => (typeof next === 'function' ? next(prev) : next)

export function DataTable({
  columns,
  data = NO_ROWS,
  mode = 'client',
  pageSize = PAGE_SIZE.client,
  page: serverPage = 1,
  totalPages: serverTotalPages = 1,
  total: serverTotal = 0,
  onPageChange,
  isLoading = false,
  isFetching = false,
  emptyTitle = 'No data found',
  emptyDescription = 'Try adjusting your search or filters.',
  exportFilename = 'export.csv',
  itemLabel = 'items',
  showExport = true,
  selectable = mode === 'client',
  onRowClick,
  bulkActions,
  getRowId = (row) => row.id,
}) {
  const [clientPage, setClientPage] = useReducer(replaceState, 1)
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [selected, setSelected] = useReducer(replaceState, [])

  const isServer = mode === 'server'
  const page = isServer ? serverPage : clientPage
  const total = isServer ? serverTotal : data.length
  const resolvedTotalPages = isServer
    ? serverTotalPages
    : Math.max(1, Math.ceil(data.length / pageSize))

  const sortedData = useMemo(() => {
    if (isServer || !sortKey) return data
    return [...data].sort((a, b) => {
      const aVal = a[sortKey]
      const bVal = b[sortKey]
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [data, sortKey, sortDir, isServer])

  const visibleData = isServer
    ? sortedData
    : sortedData.slice((clientPage - 1) * pageSize, clientPage * pageSize)

  // Both resets below compare with the previous render and update during render (not in an effect),
  // so the table never paints a stale page or a stale selection.

  // Client mode goes back to page 1 when the row count or the sort changes.
  const pageResetKey = `${isServer}|${data.length}|${sortKey}|${sortDir}`
  const [prevPageResetKey, setPrevPageResetKey] = useState(pageResetKey)
  if (prevPageResetKey !== pageResetKey) {
    setPrevPageResetKey(pageResetKey)
    if (!isServer) setClientPage(1)
  }

  // The selection belongs to one page of one data set: clear it when either changes.
  const [selectionScope, setSelectionScope] = useState({ page, data })
  if (!Object.is(selectionScope.page, page) || selectionScope.data !== data) {
    setSelectionScope({ page, data })
    if (selected.length) setSelected([])
  }

  const handleSort = (key) => {
    if (isServer || !key) return
    if (sortKey === key) setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const handlePageChange = (nextPage) => {
    if (isServer) onPageChange?.(nextPage)
    else setClientPage(nextPage)
  }

  const toggleAll = () => {
    if (selected.length === visibleData.length) setSelected([])
    else setSelected(visibleData.map((row) => getRowId(row)))
  }

  const toggleRow = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const handleExport = () => {
    const exportData = data.map((row) => {
      const obj = {}
      columns.forEach((col) => {
        if (col.key) obj[col.label] = row[col.key]
      })
      return obj
    })
    downloadCSV(exportData, exportFilename)
  }

  if (isLoading) {
    return <TableLoadingSkeleton rows={Math.min(pageSize, 5)} />
  }

  if (!data.length) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />
  }

  return (
    <div className="space-y-4">
      {(showExport || (bulkActions && selected.length > 0)) && (
        <div className="flex items-center justify-between gap-4">
          {bulkActions && selected.length > 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{selected.length} selected</span>
              {bulkActions(selected)}
            </div>
          ) : (
            <div />
          )}
          {showExport && (
            <div className="ml-auto">
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>
          )}
        </div>
      )}

      <TableContainer>
        <Table>
          <TableHeader>
            <TableRow>
              {selectable && (
                <TableHead className="w-12">
                  <Checkbox
                    checked={selected.length === visibleData.length && visibleData.length > 0}
                    onCheckedChange={toggleAll}
                    aria-label="Select all rows"
                  />
                </TableHead>
              )}
              {columns.map((col) => (
                <TableHead key={col.key || col.label}>
                  {col.sortable && !isServer ? (
                    <button
                      type="button"
                      className="flex items-center gap-1 cursor-pointer"
                      onClick={() => handleSort(col.key)}
                    >
                      {col.label}
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  ) : (
                    col.label
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleData.map((row, index) => {
              const rowId = getRowId(row)
              return (
                <TableRow
                  key={rowId}
                  className={onRowClick ? 'cursor-pointer' : ''}
                  onClick={() => onRowClick?.(row)}
                >
                  {selectable && (
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      <Checkbox
                        checked={selected.includes(rowId)}
                        onCheckedChange={() => toggleRow(rowId)}
                        aria-label={`Select row ${rowId}`}
                      />
                    </TableCell>
                  )}
                  {columns.map((col) => (
                    <TableCell key={col.key || col.label}>
                      {col.render ? col.render(row, index) : row[col.key]}
                    </TableCell>
                  ))}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        page={page}
        totalPages={resolvedTotalPages}
        total={total}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        isFetching={isFetching}
        itemLabel={itemLabel}
      />
    </div>
  )
}
```

#### `src/components/tables/TableContainer.jsx`

```jsx
import { cn } from '@/lib/utils'

/**
 * Standard bordered wrapper for all data tables.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {string} [props.className]
 */
export function TableContainer({ children, className }) {
  return (
    <div className={cn('rounded-xl border border-border bg-card overflow-hidden', className)}>
      {children}
    </div>
  )
}
```

#### `src/components/tables/TableLoadingSkeleton.jsx`

```jsx
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/**
 * Standard loading placeholder for table list pages.
 *
 * @param {object} props
 * @param {number} [props.rows=5]
 * @param {string} [props.rowClassName]
 * @param {string} [props.className]
 */
export function TableLoadingSkeleton({ rows = 5, rowClassName = 'h-12', className }) {
  return (
    <div className={cn('space-y-3', className)} role="status" aria-label="Loading table data">
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className={cn('w-full rounded-xl', rowClassName)} />
      ))}
    </div>
  )
}
```

#### `src/components/tables/TablePagination.jsx`

```jsx
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getPaginationSummary } from '@/lib/pagination'
import { cn } from '@/lib/utils'

/**
 * Standard pagination footer for all data tables.
 * Uses 1-based page indexing throughout the application.
 *
 * @param {object} props
 * @param {number} props.page - Current page (1-based)
 * @param {number} props.totalPages
 * @param {number} props.total - Total item count
 * @param {number} props.pageSize
 * @param {(page: number) => void} props.onPageChange
 * @param {boolean} [props.isFetching]
 * @param {string} [props.itemLabel]
 * @param {string} [props.className]
 */
export function TablePagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  isFetching = false,
  itemLabel = 'items',
  className,
}) {
  if (totalPages <= 1) return null

  const summary = getPaginationSummary({ page, pageSize, total, itemLabel, isFetching })

  return (
    <div
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between',
        className
      )}
      aria-label="Table pagination"
    >
      <p className="text-sm text-muted-foreground">{summary}</p>
      <div className="flex items-center gap-2 self-end sm:self-auto">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-[3.5rem] text-center text-sm font-medium" aria-live="polite">
          {page} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
```

#### `src/components/tables/TableToolbar.jsx`

```jsx
import { cn } from '@/lib/utils'

/**
 * Responsive toolbar row for list pages (search, filters, actions).
 *
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {string} [props.className]
 */
export function TableToolbar({ children, className }) {
  return (
    <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between', className)}>
      {children}
    </div>
  )
}

/**
 * Primary search area — grows to fill available width on desktop.
 */
export function TableToolbarSearch({ children, className }) {
  return <div className={cn('w-full sm:flex-1 sm:max-w-sm', className)}>{children}</div>
}

/**
 * Filter controls row (selects, tabs triggers, etc.).
 */
export function TableToolbarFilters({ children, className }) {
  return (
    <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-3', className)}>
      {children}
    </div>
  )
}

/**
 * Right-aligned actions (Add button, export, etc.).
 */
export function TableToolbarActions({ children, className }) {
  return <div className={cn('flex shrink-0 items-center gap-2', className)}>{children}</div>
}
```
