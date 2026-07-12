---
name: create-shadcn-component
description: >-
  Create a new shadcn/Radix UI component or shared component in RTO-Super-Admin using CVA, design
  tokens, atomic-design placement, a Storybook story, and a11y. Use when the user says "create a
  shadcn component", "add a UI primitive", or "build a <component> following the design system".
---

# Create a shadcn component (RTO-Super-Admin)

Deterministic checklist. For judgment-heavy design-system work, delegate to the `shadcn-component-author` agent.

## 0. Read first
- `RTO-Super-Admin/docs/COMPONENT_GUIDE.md` and the relevant parts of `Global Design System.md`.
- Mirror an existing primitive: `src/components/ui/button.jsx` (CVA) / `badge.jsx`; for Radix-backed parts, `dialog.jsx` / `select.jsx`.

## 1. Check it doesn't exist
- Search `src/components/ui/` (and `common/`) so you don't duplicate a component.

## 2. Install the Radix primitive (if needed)
- If it wraps a Radix part, add the `@radix-ui/react-*` dependency and note it in `package.json`.

## 3. Author the component
- `src/components/ui/<name>.jsx` (or the correct atomic folder — see step 5).
- `React.forwardRef`, `displayName`, spread `...props`, merge classes with `cn()` (`@/lib/utils`).
- Variants via **CVA**; export the component **and** its `*Variants`.

## 4. Use design tokens only
- Map every variant to `@theme` token classes (`bg-primary`, `text-foreground`, `text-muted-foreground`, `bg-card`, `border-border`, `bg-destructive`, `text-success`, `bg-warning`, `gradient-bg`). **No hardcoded hex or raw palette colors.** Tokenized radii (`rounded-md/lg/xl`); Inter font; dark mode automatic.

## 5. Place by atomic level
- **Atom** (token-driven primitive) → `components/ui/`; **molecule** (a few atoms, generic) → `components/common/`; **organism** (self-contained block) → `components/{tables,forms,modals}/` or a domain folder; **template** → `components/layout/`. Don't refactor existing folders.

## 6. Storybook story
- Add a story under `src/stories/` mirroring the component's folder; cover the main `variant`/`size`/state permutations.

## 7. Accessibility
- `<label htmlFor>` for inputs, `aria-label` on icon-only controls, visible focus rings (`focus-visible:ring-2 ring-ring`), keyboard operability, ≥40×40px targets.

## 8. Report
Component, variants/props, atomic level + path, any new dependency, and the story added. Do not commit unless asked.
