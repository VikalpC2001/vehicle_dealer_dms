# RTO Super Admin — Global Design System

**Version:** 1.0  
**Last Updated:** June 2025  
**Status:** Single source of truth for all UI decisions

This document defines the visual language, component standards, layout rules, and interaction patterns for the RTO Super Admin application. Every new screen, component, and feature must conform to these guidelines.

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Foundations](#2-foundations)
3. [Color System](#3-color-system)
4. [Typography](#4-typography)
5. [Spacing & Layout](#5-spacing--layout)
6. [Elevation & Borders](#6-elevation--borders)
7. [Icons](#7-icons)
8. [Motion & Animation](#8-motion--animation)
9. [Components](#9-components)
10. [Page Patterns](#10-page-patterns)
11. [Data Display](#11-data-display)
12. [Forms & Validation](#12-forms--validation)
13. [Feedback & States](#13-feedback--states)
14. [Accessibility](#14-accessibility)
15. [Implementation Reference](#15-implementation-reference)
16. [Do's and Don'ts](#16-dos-and-donts)

---

## 1. Design Philosophy

### Brand Personality

The RTO Super Admin interface is an **enterprise SaaS admin panel**. It must feel:

| Attribute | Description |
|-----------|-------------|
| **Clean** | Generous whitespace, no visual clutter |
| **Professional** | Trustworthy, government-grade reliability |
| **Premium** | Polished details, smooth interactions |
| **Fast** | Lightweight visuals, instant feedback |
| **Data-focused** | Content and metrics take priority |
| **Minimal** | Restrained color palette, purposeful decoration |

### Design Inspiration

The visual language draws from modern SaaS products:

- Stripe Dashboard — data clarity, subtle depth
- Linear — sharp typography, fast feel
- Notion — calm surfaces, readable hierarchy
- Vercel — monochrome base with accent gradients

### What to Avoid

- Outdated admin templates (heavy sidebars, dense tables)
- Heavy shadows on every element
- Multi-color rainbow palettes
- Cluttered multi-column layouts without hierarchy
- Bootstrap-like rounded pills and saturated backgrounds
- Decorative elements that do not serve function

---

## 2. Foundations

### Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | React 19 + Vite |
| Styling | Tailwind CSS v4 (`@theme` tokens) |
| Components | ShadCN UI (Radix primitives + CVA) |
| Icons | Lucide React |
| Animation | Framer Motion |
| Charts | Recharts |
| Forms | React Hook Form + Zod |
| Class merging | `cn()` utility (`clsx` + `tailwind-merge`) |

### Token Architecture

All design tokens live in `src/index.css` under `@theme` and `:root`. Components reference tokens via Tailwind semantic classes:

```
background, foreground, card, border, muted, primary, destructive, success, warning, ring
```

Custom utility classes:

| Class | Purpose |
|-------|---------|
| `.gradient-bg` | Primary blue gradient background |
| `.gradient-text` | Gradient-filled text (headlines, 404) |
| `.glass-card` | Frosted glass surface (auth panels) |

### Utility Function

Always merge classes with `cn()` from `src/lib/utils.js`:

```jsx
import { cn } from '@/lib/utils'

<div className={cn('base-classes', conditional && 'conditional-class', className)} />
```

---

## 3. Color System

### Core Palette

#### Light Mode

| Token | Hex | Tailwind Class | Usage |
|-------|-----|----------------|-------|
| Background | `#F8FAFC` | `bg-background` | Page canvas |
| Foreground | `#0F172A` | `text-foreground` | Primary text |
| Card | `#FFFFFF` | `bg-card` | Cards, sidebar, topbar |
| Border | `#E2E8F0` | `border-border` | Dividers, inputs, tables |
| Muted | `#F1F5F9` | `bg-muted` | Hover states, tab lists |
| Muted Foreground | `#64748B` | `text-muted-foreground` | Secondary text, labels |
| Primary | `#2563EB` | `bg-primary`, `text-primary` | CTAs, links, focus rings |
| Accent | `#3B82F6` | `bg-accent` | Secondary emphasis |
| Ring | `#3B82F6` | `ring-ring` | Focus indicators |

#### Dark Mode

Applied via `.dark` class on `<html>` (managed by `ThemeContext`).

| Token | Hex | Tailwind Class |
|-------|-----|----------------|
| Background | `#020617` | `bg-background` |
| Foreground | `#F8FAFC` | `text-foreground` |
| Card | `#0F172A` | `bg-card` |
| Border | `#1E293B` | `border-border` |
| Muted | `#1E293B` | `bg-muted` |
| Muted Foreground | `#94A3B8` | `text-muted-foreground` |

Theme transitions use `transition: background-color 0.3s ease, color 0.3s ease` on `body`.

### Blue Gradient (Brand Accent)

```css
linear-gradient(135deg, #2563EB 0%, #3B82F6 50%, #60A5FA 100%)
```

**Use for:**
- Primary buttons (`gradient-bg`)
- Active sidebar navigation items
- Avatar fallbacks
- KPI icon containers
- Progress bar fill
- Brand logo containers
- Login hero panel background

**Do not use for:** large background fills on content pages, body text, or status indicators.

### Semantic Colors

| Token | Hex | Tailwind | Meaning |
|-------|-----|----------|---------|
| Success | `#10B981` | `text-success`, `bg-success` | Active, approved, paid, positive growth |
| Warning | `#F59E0B` | `text-warning`, `bg-warning` | Pending, expiring, medium priority |
| Destructive | `#EF4444` | `text-destructive`, `bg-destructive` | Error, suspended, rejected, urgent, negative growth |

Semantic colors always appear as **tinted backgrounds** with matching text:

```
bg-{semantic}/10 text-{semantic} border-{semantic}/20
```

### Status Color Map

Defined in `src/lib/constants.js` → `STATUS_COLORS`. Used by `StatusBadge`.

| Status | Style |
|--------|-------|
| `active`, `approved` | Green tint |
| `pending`, `expiring`, `medium` | Amber tint |
| `suspended`, `rejected`, `expired`, `high` | Red tint |
| `in_progress` | Blue tint (`primary`) |
| `low` | Muted neutral |
| `urgent` | Solid destructive fill, white text |

### Chart Colors

| Element | Value |
|---------|-------|
| Primary stroke | `#2563EB` |
| Secondary stroke | `#60A5FA` |
| Area fill gradient | `#3B82F6` at 30% → 0% opacity |
| Bar gradient | `#2563EB` → `#60A5FA` |
| Grid lines | `#E2E8F0`, dashed `3 3` |
| Axis labels | `#64748B`, 12px |
| Tooltip border | `1px solid #E2E8F0`, `border-radius: 8px` |
| Tooltip shadow | `0 4px 12px rgba(0,0,0,0.08)` |

### Overlay & Backdrop

| Context | Value |
|---------|-------|
| Modal overlay | `bg-black/50 backdrop-blur-sm` |
| Mobile sidebar overlay | `bg-black/50` |
| Topbar | `bg-card/80 backdrop-blur-md` |
| Auth glass panels | `bg-white/10 backdrop-blur` on gradient |

---

## 4. Typography

### Font Family

**Inter** — loaded from Google Fonts.

```css
--font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
```

Weights in use: **400** (normal), **500** (medium), **600** (semibold), **700** (bold).

### Type Scale

| Role | Size | Weight | Tailwind | Usage |
|------|------|--------|----------|-------|
| Display / H1 | 36px | Bold (700) | `text-3xl font-bold` | Page titles, welcome headings |
| H2 | 30px | Bold (700) | `text-2xl font-bold` | Section titles, profile name |
| H3 | 24px | Bold (700) | `text-xl font-bold` | Auth headings, card group titles |
| Card Title | 18px | Bold (700) | `text-lg font-bold` | Card headers (default) |
| Card Title (compact) | 16px | Bold (700) | `text-base font-bold` | Chart cards, section cards |
| Body | 16px | Medium (500) | `text-sm font-medium` | Table cells, inputs, nav items |
| Body Large | 18px | Medium (500) | `text-lg font-medium` | Auth subtext |
| Small / Caption | 14px | Medium (500) | `text-sm` | Descriptions, metadata |
| Extra Small | 12px | Medium (500) | `text-xs` | Timestamps, badges, sidebar subtitle |
| Micro | 10px | Medium (500) | `text-[10px]` | Notification count badges |

### KPI Value

| Role | Size | Weight | Tailwind |
|------|------|--------|----------|
| Stat number | 30px | Bold (700) | `text-3xl font-bold tracking-tight` |

### Text Colors

| Purpose | Class |
|---------|-------|
| Primary content | `text-foreground` |
| Secondary / descriptions | `text-muted-foreground` |
| Links & actions | `text-primary` with `hover:underline` |
| Errors | `text-destructive` |
| Positive metrics | `text-success` |
| Negative metrics | `text-destructive` |
| On gradient surfaces | `text-white`, `text-white/80`, `text-white/60` |

### Heading Patterns

**Standard page header:**

```jsx
<h1 className="text-3xl font-bold">Page Title</h1>
<p className="text-muted-foreground mt-1">Supporting description</p>
```

**Card section header:**

```jsx
<CardTitle className="text-base">Section Name</CardTitle>
```

---

## 5. Spacing & Layout

### Layout Constants

| Variable | Value | Usage |
|----------|-------|-------|
| `--sidebar-width` | `280px` | Fixed sidebar |
| `--topbar-height` | `72px` | Sticky header |

### App Shell

```
┌─────────────────────────────────────────────────────┐
│ Sidebar (280px)  │  Topbar (72px, sticky)           │
│                  ├──────────────────────────────────│
│  Logo            │  Main Content (fluid)             │
│  Navigation      │  padding: p-4 → md:p-6 → lg:p-8  │
│  User Profile    │                                   │
│  Logout          │                                   │
└─────────────────────────────────────────────────────┘
```

- Main content offset: `lg:ml-[var(--sidebar-width)]`
- Page vertical rhythm: `space-y-6` (standard) or `space-y-8` (dashboard)
- Section internal spacing: `space-y-4`

### Content Padding

| Breakpoint | Main Padding |
|------------|--------------|
| Mobile (`< md`) | `p-4` (16px) |
| Tablet (`md`) | `p-6` (24px) |
| Desktop (`lg+`) | `p-8` (32px) |

### Grid Patterns

| Pattern | Classes | Used On |
|---------|---------|---------|
| KPI row | `grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6` | Dashboard stats |
| Chart grid | `grid grid-cols-1 lg:grid-cols-2 gap-6` | Analytics section |
| Two-column detail | `grid grid-cols-1 lg:grid-cols-2 gap-6` | User details |
| Quick actions | `grid grid-cols-2 md:grid-cols-4 gap-4` | Dashboard shortcuts |
| Form fields | `grid grid-cols-1 md:grid-cols-2 gap-4` | Registration form |
| Subscription cards | `grid grid-cols-1 md:grid-cols-2 gap-4` | Subscriptions page |

### Spacing Scale (Tailwind)

| Token | Value | Common Usage |
|-------|-------|--------------|
| `gap-1` / `space-y-1` | 4px | Tight icon groups |
| `gap-2` / `space-y-2` | 8px | Form label-to-input, badge groups |
| `gap-3` | 12px | Sidebar nav items, avatar rows |
| `gap-4` / `space-y-4` | 16px | Card sections, grid gaps |
| `gap-6` / `space-y-6` | 24px | Page sections |
| `gap-8` / `space-y-8` | 32px | Dashboard major sections |
| `p-3` | 12px | Compact inner cards |
| `p-4` | 16px | Notification items, list rows |
| `p-6` | 24px | Card content, auth forms |
| `p-8` / `p-12` | 32px / 48px | Auth panels |

### Responsive Breakpoints

| Prefix | Min Width | Behavior |
|--------|-----------|----------|
| default | 0px | Single column, mobile sidebar drawer |
| `sm` | 640px | 2-column grids, show topbar CTA |
| `md` | 768px | Inline search, 2-column forms |
| `lg` | 1024px | Persistent sidebar, 2-column charts |
| `xl` | 1280px | 4-column KPI grid |

### Z-Index Layers

| Layer | Z-Index | Element |
|-------|---------|---------|
| Base content | auto | Page content |
| Sticky topbar | `z-30` | Header |
| Mobile overlay | `z-30` | Sidebar backdrop |
| Sidebar | `z-40` | Navigation drawer |
| Modal overlay | `z-50` | Dialog backdrop + content |
| Toast | `z-[100]` | Toast viewport |

---

## 6. Elevation & Borders

### Border Radius

| Token | Value | Tailwind | Usage |
|-------|-------|----------|-------|
| `--radius-sm` | 6px | `rounded-md` | Small buttons, tab triggers |
| `--radius-md` | 8px | `rounded-lg` | Buttons, inputs, nav items, toasts |
| `--radius-lg` | 12px | `rounded-xl` | Cards, tables, modals, KPI icons |
| `--radius-xl` | 16px | `rounded-xl` | Cards (primary) |
| Full | 50% | `rounded-full` | Avatars, badges, count pills |

### Shadows

The system uses **restrained shadows**. Never stack multiple shadow layers.

| Level | Class | Usage |
|-------|-------|-------|
| None | — | Default card at rest |
| Subtle | `shadow-sm` | Cards, active nav item |
| Medium | `shadow-md` | Hover cards, dropdowns, chart tooltips |
| Elevated | `shadow-lg` | Toasts |
| Modal | `shadow-xl` | Dialog content |

**Hover pattern:** `transition-shadow hover:shadow-md` on interactive cards.

### Borders

- Default border: `border border-border` (1px solid)
- Dividers: `Separator` component or `border-b border-border`
- Input focus: `ring-2 ring-ring` (no border color change)
- Unread notification accent: `border-primary/30 bg-primary/5`

---

## 7. Icons

### Library

**Lucide React** — consistent 24px grid, stroke-based.

### Size Scale

| Context | Size | Class |
|---------|------|-------|
| Inline with small text | 12px | `h-3 w-3` |
| Inline with body / buttons | 16px | `h-4 w-4` |
| Topbar / sidebar nav | 16–20px | `h-4 w-4` to `h-5 w-5` |
| KPI / empty state | 24–32px | `h-6 w-6` to `h-8 w-8` |
| Empty state container | 32px | `h-8 w-8` inside 64px circle |

### Icon + Text Spacing

- Button icon leading: `mr-2` or `gap-2` on flex container
- Nav item: `gap-3` between icon and label

### Icon Containers

| Pattern | Classes |
|---------|---------|
| Sidebar logo | `h-9 w-9 rounded-lg gradient-bg` |
| KPI icon box | `h-12 w-12 rounded-xl gradient-bg` |
| Quick action box | `h-12 w-12 rounded-xl {color}` |
| Notification type | `h-10 w-10 rounded-full bg-muted` or `gradient-bg` |
| Empty state | `h-16 w-16 rounded-full bg-muted` |

### Navigation Icon Map

Defined in `Sidebar.jsx` — icons must match `NAV_ITEMS` in `constants.js`:

`LayoutDashboard`, `Users`, `FileText`, `CreditCard`, `Bell`, `Activity`, `Settings`

---

## 8. Motion & Animation

### Philosophy

Animations are **functional, not decorative**. They communicate state changes, guide attention, and reinforce premium feel. Keep durations between **200ms–500ms**.

### Framer Motion Patterns

#### Page Transition

```jsx
// PageTransition.jsx
initial: { opacity: 0, y: 12 }
animate: { opacity: 1, y: 0 }
exit:    { opacity: 0, y: -8 }
duration: 0.3s, ease: 'easeOut'
```

#### Staggered List Entry

```jsx
initial: { opacity: 0, y: 20 }
animate: { opacity: 1, y: 0 }
delay: index * 0.05 – 0.1
```

#### Card Hover

```jsx
whileHover={{ scale: 1.02 }}
```

#### Auth Illustration Float

```jsx
animate={{ y: [0, -10, 0] }}
transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
```

#### Badge Pop-in

```jsx
initial={{ scale: 0 }}
animate={{ scale: 1 }}
```

#### Form Entrance (Login)

```jsx
initial: { opacity: 0, x: 20 }
animate: { opacity: 1, x: 0 }
duration: 0.5s, delay: 0.2s
```

#### Empty State

```jsx
initial: { opacity: 0, scale: 0.95 }
animate: { opacity: 1, scale: 1 }
```

### CSS Transitions

| Element | Property | Duration |
|---------|----------|----------|
| Buttons | `transition-all` | `200ms` |
| Table rows | `transition-colors` | default |
| Theme switch | `background-color, color` | `300ms` |
| Progress bar | `transition-all` | `500ms` |
| Sidebar width | `transition-all` | `300ms` |

### Loading States

| Pattern | Implementation |
|---------|----------------|
| Button loading | `Loader2` icon + `animate-spin` + disabled state |
| Skeleton | `animate-pulse rounded-md bg-muted` |
| Page loading | Centered `text-muted-foreground` message |

---

## 9. Components

### 9.1 Button

**File:** `src/components/ui/button.jsx`

| Variant | Appearance | When to Use |
|---------|------------|-------------|
| `default` | Blue gradient, white text | Primary actions (Save, Sign In, Approve) |
| `destructive` | Red solid | Delete, Reject, irreversible actions |
| `outline` | Bordered card surface | Secondary actions (Export, Cancel) |
| `secondary` | Muted fill | Tertiary actions |
| `ghost` | No background, hover muted | Icon buttons, table actions, nav toggles |
| `link` | Primary text, underline on hover | Inline text actions |

| Size | Height | Padding |
|------|--------|---------|
| `sm` | 32px (`h-8`) | `px-3`, `text-xs` |
| `default` | 40px (`h-10`) | `px-4` |
| `lg` | 44px (`h-11`) | `px-8` |
| `icon` | 40×40px | — |

**Rules:**
- Always include `cursor-pointer` (built into component)
- Disabled: `opacity-50`, `pointer-events-none`
- Focus: `ring-2 ring-ring ring-offset-2`
- Full-width CTAs on mobile auth: `w-full size="lg"`

### 9.2 Input

**File:** `src/components/ui/input.jsx`

| Property | Value |
|----------|-------|
| Height | `h-10` (40px) |
| Radius | `rounded-lg` |
| Border | `border-border` |
| Background | `bg-card` |
| Text | `text-sm font-medium` |
| Placeholder | `text-muted-foreground` |
| Focus | `ring-2 ring-ring`, no outline |
| Disabled | `opacity-50`, `cursor-not-allowed` |

**Search input variant** (`SearchInput.jsx`):
- Leading `Search` icon at `left-3`
- Input padding: `pl-9`
- Topbar variant: `bg-muted/50 border-0`

**Password input pattern:**
- Toggle button: absolute `right-3 top-1/2 -translate-y-1/2`
- Icon: `Eye` / `EyeOff` at `h-4 w-4`

### 9.3 Label

**File:** `src/components/ui/label.jsx`

- `text-sm font-medium text-foreground`
- Form field wrapper: `space-y-2` (label + input + error)
- Inline checkbox label: `text-sm font-normal cursor-pointer`

### 9.4 Card

**File:** `src/components/ui/card.jsx`

```
Card:       rounded-xl border border-border bg-card shadow-sm
CardHeader: p-6, flex flex-col space-y-1.5
CardTitle:  text-lg font-bold (override to text-base for charts)
CardDesc:   text-sm text-muted-foreground
CardContent: p-6 pt-0
CardFooter:  p-6 pt-0, flex items-center
```

**Interactive card hover:** add `hover:shadow-md transition-shadow`

**Stat card inner padding:** `CardContent className="p-6"`

### 9.5 Badge

**File:** `src/components/ui/badge.jsx`

| Variant | Usage |
|---------|-------|
| `default` | Primary solid (rare) |
| `secondary` | Role labels (dealer, agent) |
| `outline` | Status badges (via StatusBadge) |
| `success` | Paid, active confirmations |
| `warning` | Expiring states |
| `destructive` | Error states |

Base: `rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize`

### 9.6 Avatar

**File:** `src/components/ui/avatar.jsx`

| Size | Class | Context |
|------|-------|---------|
| Small | `h-9 w-9` | Sidebar, topbar |
| Default | `h-10 w-10` | Standard |
| Large | `h-20 w-20` | Profile pages |

**Fallback pattern:**
```jsx
<AvatarFallback className="gradient-bg text-white text-xs">
  {getInitials(name)}
</AvatarFallback>
```

### 9.7 Tabs

**File:** `src/components/ui/tabs.jsx`

```
TabsList:    h-10 rounded-lg bg-muted p-1
TabsTrigger: rounded-md px-3 py-1.5 text-sm font-medium
  Active:    bg-card text-foreground shadow-sm
  Inactive:  text-muted-foreground
TabsContent: mt-4
```

Use for: Users filters, Notifications filter, Settings sections.

### 9.8 Dialog / Modal

**File:** `src/components/ui/dialog.jsx`  
**Pattern:** `src/components/modals/ConfirmModal.jsx`

| Element | Style |
|---------|-------|
| Overlay | `bg-black/50 backdrop-blur-sm` |
| Content | `max-w-lg rounded-xl border p-6 shadow-xl` |
| Title | `text-lg font-bold` |
| Description | `text-sm text-muted-foreground` |
| Footer | Cancel (`outline`) + Confirm (`default` or `destructive`) |
| Close | `X` icon, top-right, `opacity-70` |

**Rule:** All destructive admin actions (delete, suspend, reject) must use `ConfirmModal`.

### 9.9 Toast

**File:** `src/components/ui/toast.jsx`  
**Hook:** `src/hooks/use-toast.js`

| Variant | Style |
|---------|-------|
| `default` | Card background |
| `success` | Green tint border + background |
| `destructive` | Red tint border + background |

- Position: bottom-right on desktop, top on mobile
- Max width: `420px`
- Auto-dismiss: `4000ms`
- Max visible: `3`
- Title: `text-sm font-semibold`
- Description: `text-sm opacity-90`

### 9.10 Select, Checkbox, Switch

Follow the same `h-10 rounded-lg border-border` pattern as inputs.

- **Checkbox:** checked state `bg-primary`
- **Switch:** checked `bg-primary`, thumb translates `translate-x-4`
- **Select:** chevron trailing icon, popover `rounded-lg shadow-md`

### 9.11 Progress

**File:** `src/components/ui/progress.jsx`

- Track: `h-2 rounded-full bg-muted`
- Fill: `gradient-bg`, `transition-all duration-500`
- Used for: subscription progress, password strength

### 9.12 Skeleton

**File:** `src/components/ui/skeleton.jsx`

- `animate-pulse rounded-md bg-muted`
- Match dimensions of content being loaded
- Dashboard KPI: `h-36 rounded-xl`

### 9.13 Separator

- Horizontal: `h-[1px] w-full bg-border`
- Used between sidebar logo and nav, settings sections

---

## 10. Page Patterns

### 10.1 Authentication — Login

**Layout:** Split screen (50/50 on `lg+`)

| Left Panel | Right Panel |
|------------|-------------|
| `gradient-bg` hero | `bg-background`, centered form |
| Floating illustration animation | `LoginForm`, max-width `md` (448px) |
| White text, glass stat cards | Heading: `text-3xl font-bold` |

Hidden on mobile: left panel (`hidden lg:flex`).

### 10.2 Authentication — Register

**Layout:** Centered single column, max-width `2xl` (672px).

- Logo centered above card
- `Card` with `shadow-xl border-0`
- Success state: `CheckCircle2` icon animation → redirect

### 10.3 Dashboard Page

**Structure (top to bottom):**

1. Welcome header — `text-3xl font-bold` + date + primary CTA
2. KPI grid — 4 `StatCard` components
3. Quick actions — 4 icon cards with `whileHover scale(1.02)`
4. Charts — 2×2 grid of Recharts cards
5. Activity feed — bordered list inside Card

### 10.4 List Page (Users, Requests, Dealers, State & City)

**Structure:**

1. Page header (title + description)
2. Optional KPI cards (Dealers)
3. Toolbar (`TableToolbar`: search + filters + actions)
4. Tabs (if applicable — Users, State & City)
5. `DataTable` (client or server mode)
6. `ConfirmModal` (if destructive actions)

```jsx
<div className="space-y-6">
  {/* Header */}
  {/* Toolbar */}
  {/* Tabs / Table */}
</div>
```

### 10.5 Detail Page (User Details)

**Structure:**

1. Back button (`variant="ghost"`, `ArrowLeft` icon)
2. Profile header card (avatar + badges + action buttons)
3. Two-column info grid (personal + business)
4. Full-width subscription card with progress + payment history

### 10.6 Settings Page

- Tabbed sections inside `space-y-6`
- Each tab: single `Card` with `CardHeader` + `CardContent`
- Toggle settings: label/description left, `Switch` right
- Save button: primary, bottom of page

### 10.7 Not Found

- Centered layout, `text-8xl font-bold gradient-text` for "404"
- Two CTAs: primary (Dashboard) + outline (Go Back)

---

## 11. Data Display

### 11.1 Table

**Files:** `src/components/ui/table.jsx`, `src/components/tables/DataTable.jsx`

#### Anatomy

```
┌─────────────────────────────────────────────────┐
│ [ ] │ COLUMN ▲  │ COLUMN  │ STATUS  │ ACTIONS  │  ← TableHead: h-11, uppercase, text-xs
├─────────────────────────────────────────────────┤
│ [ ] │ Cell data │ Cell    │ Badge   │ Icons    │  ← TableCell: p-4, font-medium
│ [ ] │ ...       │ ...     │ ...     │ ...      │  ← Row hover: bg-muted/50
└─────────────────────────────────────────────────┘
  Showing 1–8 of 24          [←]  1/3  [→]
```

#### Specifications

| Element | Style |
|---------|-------|
| Container | `rounded-xl border border-border bg-card overflow-hidden` |
| Header row | `border-b border-border` |
| Header cell | `h-11 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider` |
| Body cell | `p-4 font-medium text-sm` |
| Row hover | `hover:bg-muted/50 transition-colors` |
| Sortable header | `ArrowUpDown h-3 w-3` icon inline |
| Row click | `cursor-pointer` when `onRowClick` provided |
| Default page size | `8` rows |

#### Table Actions

- Icon-only buttons: `variant="ghost" size="icon"`
- Destructive action icons: `text-destructive`
- Row links: `font-semibold text-primary hover:underline`

#### Export

- Button: `variant="outline" size="sm"` with `Download` icon
- Position: top-right above table

#### Pagination

**File:** `src/components/tables/TablePagination.jsx`

All tables must use `TablePagination` — never inline prev/next controls in pages.

| Property | Rule |
|----------|------|
| Page index | **1-based** everywhere (client and server) |
| Summary | `Showing {start}–{end} of {total} {itemLabel}` |
| Fetching | Append ` · Updating...` when `isFetching` |
| Visibility | Hidden when `totalPages <= 1` |
| Controls | `ChevronLeft` / `ChevronRight` in `variant="outline" size="sm"` buttons |
| Layout | `flex-col gap-3 sm:flex-row sm:items-center sm:justify-between` |

**Default page sizes** (`src/lib/pagination.js`):

| Context | Constant | Size |
|---------|----------|------|
| Client lists (Users, Requests) | `PAGE_SIZE.client` | 8 |
| CRUD tables (Dealers) | `PAGE_SIZE.crud` | 10 |
| Location tables (States, Cities) | `PAGE_SIZE.location` | 50 |

#### DataTable Modes

**File:** `src/components/tables/DataTable.jsx`

| Mode | Use when | Key props |
|------|----------|-----------|
| `client` (default) | Mock or fully loaded data | `data`, `pageSize`, `sortable` columns |
| `server` | API paginated lists | `page`, `totalPages`, `total`, `onPageChange`, `isLoading`, `isFetching` |

Both modes share: `TableContainer`, `TablePagination`, `EmptyState`, `TableLoadingSkeleton`.

```jsx
// Client-side (Users, Requests)
<DataTable columns={columns} data={users} itemLabel="users" isLoading={isLoading} />

// Server-side (Dealers, States, Cities)
<DataTable
  mode="server"
  columns={columns}
  data={dealers}
  page={page}
  totalPages={totalPages}
  total={total}
  pageSize={PAGE_SIZE.crud}
  onPageChange={setPage}
  isLoading={isLoading}
  isFetching={isFetching}
  itemLabel="dealers"
  showExport={false}
  selectable={false}
/>
```

#### Table Toolbar & Filters

**File:** `src/components/tables/TableToolbar.jsx`

List pages with search/filters use the toolbar composition pattern:

```jsx
<TableToolbar>
  <TableToolbarSearch>
    <SearchInput value={search} onChange={setSearch} placeholder="Search..." />
  </TableToolbarSearch>
  <TableToolbarFilters>
    <Select>...</Select>
  </TableToolbarFilters>
  <TableToolbarActions>
    <Button>Add</Button>
  </TableToolbarActions>
</TableToolbar>
```

| Pattern | Implementation |
|---------|----------------|
| Debounced search | `useDebounce(search, 300)` + include in React Query `queryKey` |
| Filter change | Reset page to `1` when filter changes |
| Tabs as filter | `Tabs` above `DataTable` (Users page) |
| Select filter | `TableToolbarFilters` + `Select` (Requests, Cities) |

#### Loading States

**File:** `src/components/tables/TableLoadingSkeleton.jsx`

| Context | Component | Never use |
|---------|-----------|-----------|
| Table / list pages | `TableLoadingSkeleton` or `DataTable isLoading` | Ad-hoc "Loading..." text |
| Dashboard cards | `Skeleton` blocks | — |
| Inline field load | `Skeleton` single row | Full-page spinner |

Default: 5 rows, `h-12 rounded-xl`. Dealer lists: `h-14`.

#### Empty States

Always use `EmptyState` — pass contextual copy via props:

| Scenario | title | description |
|----------|-------|-------------|
| Filtered search | `No {entity} found` | `Try adjusting your search or filters.` |
| CRUD first record | `No {entity} found` | `Add your first {entity} to get started.` |
| Missing dependency | `No states available` | `Add states first before managing cities.` |

DataTable props: `emptyTitle`, `emptyDescription`.

### 11.2 Status Badge

**File:** `src/components/common/StatusBadge.jsx`

Always use `StatusBadge` for entity statuses. Never hardcode status colors in pages.

```jsx
<StatusBadge status="pending" />
// Renders: rounded-full, tinted bg, capitalize, underscores → spaces
```

### 11.3 KPI Stat Card

**File:** `src/components/dashboard/StatCard.jsx`

| Element | Style |
|---------|-------|
| Title | `text-sm font-medium text-muted-foreground` |
| Value | `text-3xl font-bold tracking-tight` |
| Growth positive | `text-success` + `TrendingUp` |
| Growth negative | `text-destructive` + `TrendingDown` |
| Growth label | `text-muted-foreground font-normal` "vs last month" |
| Icon container | `h-12 w-12 rounded-xl gradient-bg` |
| Hover | `scale(1.02)` + `hover:shadow-md` |

### 11.4 Charts

**Files:** `src/components/charts/*.jsx`

- Wrapped in `Card` with `CardTitle className="text-base"`
- Chart height: `280px` (`ResponsiveContainer`)
- Entry animation: `opacity 0→1, y 20→0, delay 0.2–0.5s`
- No vertical grid lines — horizontal only
- No axis lines — `axisLine={false} tickLine={false}`

### 11.5 Empty State

**File:** `src/components/common/EmptyState.jsx`

- Centered, `py-16`
- Icon in `h-16 w-16 rounded-full bg-muted`
- Title: `text-lg font-bold`
- Description: `text-sm text-muted-foreground`
- Always pass contextual `title` and `description` — never rely on defaults in production pages

### 11.6 Notification Item

- Card with `hover:shadow-md`
- Unread: `border-primary/30 bg-primary/5` + blue dot `h-2 w-2 rounded-full bg-primary`
- Read: muted icon container
- Timestamp: `text-xs text-muted-foreground`

### 11.7 Activity Log Item

- Standard `Card` row layout
- Icon in `h-10 w-10 rounded-full bg-muted`
- Action: `text-sm font-semibold`
- Meta: `text-xs text-muted-foreground`

---

## 12. Forms & Validation

### Form Stack

- **React Hook Form** for state
- **Zod** for schema validation
- **`zodResolver`** for integration

### Field Layout

```jsx
<div className="space-y-2">
  <Label htmlFor="field">Field Name</Label>
  <Input id="field" {...register('field')} />
  {errors.field && (
    <p className="text-sm text-destructive">{errors.field.message}</p>
  )}
</div>
```

### Form Spacing

| Context | Class |
|---------|-------|
| Between fields | `space-y-4` or `space-y-5` |
| Field internal | `space-y-2` |
| Multi-column | `grid grid-cols-1 md:grid-cols-2 gap-4` |

### Validation Display

- Error text: `text-sm text-destructive` directly below field
- No error borders on inputs — rely on text feedback
- Password strength: `Progress` bar + `text-xs text-muted-foreground` label

### Password Strength Colors

| Score | Label | Progress Color |
|-------|-------|----------------|
| 1 | Weak | `bg-destructive` |
| 2 | Fair | `bg-warning` |
| 3 | Good | `bg-accent` |
| 4 | Strong | `bg-success` |

### Form Buttons

| Position | Style |
|----------|-------|
| Primary submit | `w-full size="lg"` (auth) or standard (settings) |
| Secondary | `variant="ghost" w-full` |
| Inline link | `text-primary font-medium hover:underline` |

### Loading Submit

```jsx
<Button disabled={loading}>
  {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Save'}
</Button>
```

---

## 13. Feedback & States

### Interaction States

| State | Visual Treatment |
|-------|------------------|
| Default | Base token colors |
| Hover | `hover:bg-muted`, `hover:shadow-md`, `hover:opacity-90` |
| Active/Selected | `gradient-bg text-white` (nav) or `bg-card shadow-sm` (tabs) |
| Focus | `ring-2 ring-ring ring-offset-2` |
| Disabled | `opacity-50 pointer-events-none` |
| Loading | Spinner icon + disabled button |
| Error | Toast `destructive` variant + inline `text-destructive` |

### Toast Usage

| Action | Toast |
|--------|-------|
| Login success | `variant: 'success'`, "Welcome back!" |
| Login failure | `variant: 'destructive'` |
| CRUD success | `variant: 'success'` |
| CRUD failure | `variant: 'destructive'` |
| Settings saved | `variant: 'success'` |

### Confirmation Flow

```
User action → ConfirmModal → Mutation → Toast → Query invalidation → UI update
```

Every admin action (approve, reject, suspend, delete, renew) must follow this flow and log to Activity.

### Count Badges

| Context | Style |
|---------|-------|
| Notification bell | `h-4 w-4 rounded-full bg-destructive text-[10px] text-white` |
| Pending requests CTA | `h-5 min-w-5 rounded-full bg-destructive px-1.5 text-xs text-white` |
| Unread dot | `h-2 w-2 rounded-full bg-primary` |

---

## 14. Accessibility

### Requirements

- All interactive elements must be keyboard accessible (Radix primitives handle this)
- Focus rings must remain visible — never `outline-none` without `ring` replacement
- Form fields must have associated `<Label htmlFor>` attributes
- Icon-only buttons must have accessible names (visually hidden text or `aria-label`)
- Color alone must not convey meaning — pair with text labels and icons
- Dialog close button includes `<span className="sr-only">Close</span>`
- Minimum touch target: 40×40px (buttons, icon buttons)

### Contrast

- Primary text on background: passes WCAG AA
- Muted foreground for secondary content only — not for critical information
- Status badges: tinted backgrounds maintain readable text contrast

### Motion

- Respect `prefers-reduced-motion` (recommended future enhancement)
- Avoid animations longer than 500ms for functional transitions

---

## 15. Implementation Reference

### File Structure

```
src/
├── components/
│   ├── ui/              # Primitive design system components
│   ├── layout/          # Sidebar, Topbar, DashboardLayout
│   ├── dashboard/       # StatCard, dashboard-specific
│   ├── charts/          # Recharts wrappers
│   ├── tables/          # DataTable
│   ├── forms/           # LoginForm, RegisterForm
│   ├── modals/          # ConfirmModal
│   └── common/          # StatusBadge, SearchInput, EmptyState, PageTransition
├── pages/               # Route-level page compositions
├── context/             # ThemeContext, AuthContext
├── hooks/               # useToast, useDebounce
├── lib/
│   ├── constants.js     # STATUS_COLORS, NAV_ITEMS
│   └── utils.js         # cn(), formatters
└── index.css            # Design tokens (@theme)
```

### Component Import Convention

```jsx
// UI primitives
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// Shared patterns
import { StatusBadge } from '@/components/common/StatusBadge'
import { DataTable } from '@/components/tables/DataTable'
import { TablePagination } from '@/components/tables/TablePagination'
import { TableToolbar, TableToolbarSearch, TableToolbarFilters } from '@/components/tables/TableToolbar'
import { TableLoadingSkeleton } from '@/components/tables/TableLoadingSkeleton'
import { PAGE_SIZE } from '@/lib/pagination'

// Utilities
import { cn, formatDate } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
```

### Adding a New Page Checklist

- [ ] Use `space-y-6` or `space-y-8` root container
- [ ] Include `text-3xl font-bold` page title + `text-muted-foreground` description
- [ ] Wrap content in `PageTransition` (automatic via `DashboardLayout`)
- [ ] Use existing UI primitives — do not create one-off styled elements
- [ ] Use `StatusBadge` for all status indicators
- [ ] Destructive actions go through `ConfirmModal`
- [ ] Success/error feedback via `toast()`
- [ ] Loading states via `TableLoadingSkeleton` or `DataTable isLoading`
- [ ] Empty data via `EmptyState` with contextual title/description
- [ ] Tables via `DataTable` (client or server mode) — never inline pagination
- [ ] Pagination via `TablePagination` only (1-based pages)
- [ ] Search via `SearchInput` + `useDebounce` in `TableToolbarSearch`
- [ ] Filters via `TableToolbarFilters`; reset page to 1 on filter change
- [ ] Responsive grid following established breakpoints

### Adding a New Status Type

1. Add to relevant constant in `src/lib/constants.js`
2. Add color mapping to `STATUS_COLORS`
3. Use `<StatusBadge status="new_status" />` — no inline styles

### Theming

```jsx
import { useTheme } from '@/context/ThemeContext'

const { toggleTheme, isDark, theme, setTheme } = useTheme()
```

Theme persisted in `localStorage` key `rto_theme`. Values: `light` | `dark`.

---

## 16. Do's and Don'ts

### Do

- Use semantic Tailwind tokens (`bg-card`, `text-muted-foreground`) over raw hex values
- Use `gradient-bg` for primary brand moments only
- Keep cards flat at rest, elevate on hover
- Use `text-3xl font-bold` for every page-level heading
- Use Framer Motion for page transitions and list entry
- Use `cn()` for conditional classes
- Maintain 40px input/button height for touch-friendly targets
- Use uppercase tracking on table headers
- Capitalize status labels via CSS or `StatusBadge`
- Format dates with `formatDate()` / `formatDateTime()` (en-IN locale)
- Format currency with `formatCurrency()` (INR)

### Don't

- Don't use raw hex colors in components — reference tokens
- Don't add heavy `shadow-2xl` or multiple stacked shadows
- Don't create custom button styles outside `buttonVariants`
- Don't use more than one accent color per view
- Don't skip confirmation modals for destructive admin actions
- Don't use font weights below 500 for body text
- Don't place text directly on `gradient-bg` without white color
- Don't create tables without the rounded container wrapper (`TableContainer` or `DataTable`)
- Don't implement inline pagination controls in pages — use `TablePagination`
- Don't use different border radii on the same screen without reason
- Don't mix icon libraries — Lucide only
- Don't hardcode sidebar/topbar dimensions — use CSS variables
- Don't animate layout-shifting properties without user intent

---

## Appendix A: Quick Reference Card

```
Colors:     White #FFFFFF · Black #0F172A · Blue #2563EB→#60A5FA
Surface:    bg-background · bg-card · border-border
Text:       text-foreground · text-muted-foreground
Semantic:   success #10B981 · warning #F59E0B · destructive #EF4444
Font:       Inter · bold headings · medium body
Radius:     lg (inputs/buttons) · xl (cards/modals) · full (avatars/badges)
Spacing:    page space-y-6/8 · card p-6 · main p-4/6/8
Layout:     sidebar 280px · topbar 72px
Motion:     200–500ms · easeOut · hover scale 1.02
Icons:      Lucide · h-4 w-4 default · h-5 w-5 nav
```

---

## Appendix B: Related Files

| File | Purpose |
|------|---------|
| `src/index.css` | Token definitions, global styles, utility classes |
| `src/lib/constants.js` | Status colors, navigation items |
| `src/lib/utils.js` | `cn()`, formatters, password strength |
| `src/context/ThemeContext.jsx` | Dark/light mode provider |
| `src/components/ui/*` | All primitive components |
| `src/components/common/PageTransition.jsx` | Standard page animation |
| `src/components/tables/DataTable.jsx` | Unified client/server data table |
| `src/components/tables/TablePagination.jsx` | Standard pagination footer |
| `src/components/tables/TableToolbar.jsx` | Search/filter toolbar layout |
| `src/components/tables/TableLoadingSkeleton.jsx` | Table loading placeholder |
| `src/lib/pagination.js` | Page sizes, API normalization, summary text |
| `src/components/modals/ConfirmModal.jsx` | Standard confirmation pattern |

---

*This document is maintained alongside the codebase. When tokens or patterns change in code, update this file in the same pull request.*
