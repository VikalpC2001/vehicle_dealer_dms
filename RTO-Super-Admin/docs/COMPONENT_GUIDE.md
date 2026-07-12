# Component Authoring Guide

How to build UI components in this app: shadcn-style primitives, design tokens, and an atomic-design taxonomy. The canonical visual spec (colors, typography, spacing, motion, page patterns) is [`../Global Design System.md`](../Global%20Design%20System.md) — read it for *what* to build; this doc covers *how* to build it here.

## shadcn the manual way (no CLI, no `components.json`)

This project installed shadcn primitives by hand on top of Radix. To add or extend a primitive, mirror [`src/components/ui/button.jsx`](../src/components/ui/button.jsx):

```jsx
import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'      // only if it needs `asChild`
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const widgetVariants = cva('base classes using @theme tokens', {
  variants: {
    variant: { default: 'bg-primary text-primary-foreground', outline: 'border border-border bg-card' },
    size: { default: 'h-10 px-4', sm: 'h-8 px-3 text-xs' },
  },
  defaultVariants: { variant: 'default', size: 'default' },
})

const Widget = React.forwardRef(({ className, variant, size, ...props }, ref) => (
  <div ref={ref} className={cn(widgetVariants({ variant, size, className }))} {...props} />
))
Widget.displayName = 'Widget'

export { Widget, widgetVariants }
```

Rules:
- **`React.forwardRef`** + a **`displayName`**; spread `...props`; merge classes with **`cn()`**; export the component **and** its `*Variants`.
- For Radix-backed primitives (dialog, select, switch…), add the matching `@radix-ui/react-*` dependency (note it in `package.json`) and wrap the primitive parts, following an existing one (e.g. `dialog.jsx`).
- **No hardcoded colors** — only `@theme` token classes (see token table below).

## Design tokens (from `src/index.css @theme`)

Use these as Tailwind classes; they auto-swap in dark mode (`.dark` on `<html>`). Never inline hex.

| Token class | Light | Use |
|---|---|---|
| `bg-background` / `text-foreground` | `#f8fafc` / `#0f172a` | page surface / primary text |
| `bg-card` / `text-card-foreground` | `#ffffff` / `#0f172a` | cards, panels |
| `border-border` | `#e2e8f0` | borders, dividers |
| `bg-muted` / `text-muted-foreground` | `#f1f5f9` / `#64748b` | subtle fills / secondary text |
| `bg-primary` / `text-primary` | `#2563eb` | brand actions, links |
| `bg-secondary` | `#f1f5f9` | secondary buttons |
| `text-accent` / `ring-ring` | `#3b82f6` | accents, focus rings |
| `bg-destructive` | `#ef4444` | delete/danger |
| `text-success` | `#10b981` | success states |
| `text-warning` | `#f59e0b` | warnings |
| Utility `gradient-bg` / `gradient-text` | blue 135° gradient | primary buttons, hero text |
| Utility `glass-card` | frosted surface | auth/login panels |

Radii: `rounded-sm` `.375rem` · `rounded-md` `.5rem` · `rounded-lg` `.75rem` · `rounded-xl` `1rem`. Font: **Inter** (`--font-sans`). Status pills: use the `STATUS_COLORS` map in `@/lib/constants`, not ad-hoc classes.

## Atomic-design taxonomy (for new shared components)

Classify new shared components by this taxonomy. **Don't refactor the existing tree** — keep the current folders; just place new shared pieces by their level and keep them composable.

| Level | What it is | Where it lives here |
|---|---|---|
| **Atoms** | Token-driven primitives, no business logic | `components/ui/` (Button, Input, Badge, Switch…) |
| **Molecules** | A few atoms combined, still generic | `components/common/` (SearchInput, StatusBadge, EmptyState) |
| **Organisms** | Self-contained functional blocks | `components/tables/`, `components/forms/`, `components/modals/`, domain folders (`dealers/`, `locations/`) |
| **Templates** | Page scaffolding / layout | `components/layout/` (DashboardLayout, Sidebar, Topbar, AuthLayout) |
| **Pages** | Routed screens wiring data to templates | `pages/` |

Guidance: atoms never import molecules/organisms; keep business/data logic out of atoms and molecules (push it up to organisms/pages); a component that fetches data is at least an organism/page.

## Storybook & accessibility (required for shared components)

- Add a story under `src/stories/` mirroring the component's folder; cover the main `variant`/`size`/state permutations.
- Accessibility: real `<label htmlFor>` for inputs (see `DealerForm`'s `Field`), `aria-label` on icon-only buttons, visible focus rings (`focus-visible:ring-2 ring-ring`), ≥40×40px touch targets, keyboard operability. Match the patterns already in `components/ui/`.

## Checklist for a new component

1. Right level chosen (atom/molecule/organism/…); placed in the matching folder.
2. `forwardRef` + `displayName`; `cn()` for classes; CVA for variants; exports include `*Variants`.
3. Tokens only — no hardcoded colors; dark mode verified.
4. Radix dependency added if needed.
5. Storybook story added; a11y verified.
