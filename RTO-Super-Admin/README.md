# RTO Super Admin

A production-ready Regional Transport Office (RTO) Super Admin dashboard built with React, Tailwind CSS, and ShadCN UI.

## Tech Stack

- React 19 + Vite
- Tailwind CSS v4
- ShadCN UI (Radix primitives)
- React Router DOM
- TanStack React Query
- Axios
- React Hook Form + Zod
- Framer Motion
- Recharts
- Lucide React

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

### API Configuration

Set `VITE_API_BASE_URL` in `.env` (default: `http://192.168.0.119:4002/api/v1`).

Login endpoint: `POST /auth/login`

```json
{ "email": "user@example.com", "password": "securePassword123" }
```

## Features

- JWT authentication with protected routes
- Dark / light mode
- Dashboard with KPI cards and analytics charts
- User management (dealers, agents, approvals)
- Request management with approval workflow
- Subscription monitoring
- Notification center
- Activity logs
- Settings & profile management

## Environment Variables

Copy `.env.example` to `.env`:

```
VITE_API_BASE_URL=http://192.168.0.119:4002/api/v1
VITE_APP_NAME=RTO Super Admin
```

## Project Structure

```
src/
├── components/
│   ├── ui/          # ShadCN UI primitives
│   ├── layout/      # Sidebar, Topbar, DashboardLayout
│   ├── dashboard/   # StatCard, etc.
│   ├── charts/      # Recharts components
│   ├── tables/      # DataTable
│   ├── forms/       # Login, Register forms
│   ├── modals/      # ConfirmModal
│   └── common/      # Shared utilities
├── pages/           # Route pages
├── context/         # Auth & Theme providers
├── hooks/           # Custom hooks
├── services/        # API service layer
├── data/            # Mock data
└── lib/             # Utils & constants
```

## Build

```bash
npm run build
npm run preview
```

## Storybook (Design System)

Storybook is the **single source of truth** for UI components and design tokens.

```bash
# Development — hot reload at http://localhost:6006
npm run storybook

# Production static build
npm run build-storybook

# Preview static build
npx serve storybook-static
```

### Storybook structure

```
src/stories/
├── Introduction.mdx          # Welcome & overview
├── design-system/            # Colors, typography, spacing, radius, shadows, animations
├── ui/                       # ShadCN primitives (Button, Input, Card, …)
├── common/                   # StatusBadge, SearchInput, EmptyState, PageTransition
├── dashboard/                # StatCard
├── charts/                   # Recharts wrappers
├── tables/                   # DataTable
├── modals/                   # ConfirmModal
├── forms/                    # Auth forms
└── layout/                   # AuthLayout, Sidebar
```

Use the **Theme** toolbar (sun/moon) to toggle light and dark mode. All stories use the same Tailwind tokens from `src/index.css`.

See also: `Global Design System.md`
