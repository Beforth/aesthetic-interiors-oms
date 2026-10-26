# AGENTS.md — AI Agent & Developer Instructions

> **Single Source of Truth** for all AI Agents (Antigravity, Claude, Cursor, Copilot) and Human Developers working on the **Aesthetic Interiors Operations Management System (OMS)**.
> All agents MUST strictly read, acknowledge, and adhere to these rules before generating or modifying any UI code.

---

## 🚨 Non-Negotiable Core Directives

### 1. BefUI is the Sole UI Component Standard
- **Every UI component MUST come strictly from BefUI**:
  - Official Reference Site: [https://befui.vercel.app/#/](https://befui.vercel.app/#/)
  - Official AI LLM Specification: [https://befui.vercel.app/llms.txt](https://befui.vercel.app/llms.txt)
- **NEVER go outside of BefUI.**
- Do **NOT** introduce or copy components from other libraries (MUI, Chakra, Mantine, AntD, raw Shadcn, Bootstrap).
- If a component is missing in the project, fetch its exact specification from the BefUI JSON registry:
  `https://raw.githubusercontent.com/RandomKid24/befui/main/public/r/<name>.json`
  and place the component into `src/components/ui/<name>.(jsx|tsx)`.

### 2. Follow `design.md` Strictly
- All styles must adhere to the tokens and principles defined in [`design.md`](./design.md).
- **Tokens Only**: Use Tailwind CSS variable classes:
  - Surfaces: `bg-background`, `bg-card`, `bg-secondary`, `bg-muted`
  - Text: `text-foreground`, `text-muted-foreground`, `text-secondary-foreground`, `text-primary-foreground`
  - Accents & Borders: `border-border`, `bg-primary`, `bg-accent`, `ring-ring`
  - Status: `text-destructive`, `bg-destructive`, `text-success`, `bg-success`, `text-warning`, `bg-warning`, `text-info`, `bg-info`
- **Zero Magic Hex Values**: Never hardcode colors like `bg-[#4f46e5]` or `style={{ color: '#0f172a' }}` in JSX components.

### 3. Icon Rule: Zero External Icon Packages
- **Never install or import external icon packages** (`lucide-react`, `react-icons`, `@heroicons/react`, `font-awesome`).
- All icons must come from our unified BefUI SVG icon system:
  ```tsx
  import { SearchIcon, CalendarIcon, CheckIcon, PlusIcon } from '@/components/ui/icons';
  ```
  - Standard 24px grid.
  - Uniform `1.75` stroke width.
  - `currentColor` stroke for automatic dark mode and hover adaptability.
  - Optional smooth draw animation via `draw` prop.

### 4. Zero Duplicate Designs (Single Source of Truth)
- Never create ad-hoc or disparate implementations of the same component on different screens.
- **Example (Kanban)**: All workflow boards across the entire system (Projects, Tasks, Site Trade Execution) **MUST** use the single official BefUI component:
  ```tsx
  import { Kanban, type KanbanColumn } from '@/components/ui/kanban';
  ```
- No custom HTML drag-and-drop divs or competing column designs.

### 5. Strict Dashboard Immunity
- **DO NOT TOUCH `src/pages/DashboardPage.jsx`**.
- Its colors, layout, and component structure are locked and must remain untouched.

---

## 🛠️ BefUI Component Selection Directory

Consult this guide (from `https://befui.vercel.app/llms.txt`) before choosing which component to use:

| Requirement / Use Case | Required BefUI Component | Location / Import |
|---|---|---|
| **Columns of draggable task cards** | `Kanban` | `@/components/ui/kanban` |
| **User & artisan avatars with status dot** | `Avatar` | `@/components/ui/avatar` |
| **Status chips & stage indicators** | `Badge`, `StatusBadge` | `@/components/ui/badge` |
| **Action triggers & loading states** | `Button`, `IconButton` | `@/components/ui/Button` |
| **Surface containers & panels** | `Card`, `CardHeader`, `CardContent` | `@/components/ui/Card` |
| **Slide-over drawers & mobile navigation** | `Drawer` / `Sheet` | `@/components/ui/Drawer` |
| **Dialogs & confirmation modals** | `Modal`, `ConfirmDialog` | `@/components/ui/Modal` |
| **App shell & collapsible sidebar** | `Sidebar`, `SidebarProvider` | `@/components/ui/sidebar` |
| **Rankings & team leaderboards** | `Leaderboard` | `@/components/ui/leaderboard` |
| **Tab navigation & view switchers** | `Tabs` | `@/components/ui/Tabs` |
| **Data lists & tabular views** | `Table`, `DataTable` | `@/components/ui/Table` |
| **Role & permission matrices** | `PermissionMatrix` | `@/components/ui/permission-matrix` |
| **KPI & summary metric cards** | `StatCard` | `@/components/ui/StatCard` |
| **Toast notifications** | `Toast` | `@/context/ToastContext` |
| **Visual meters & progress tracks** | `ProgressBar`, `charts` | `@/components/ui/charts` |

---

## 📐 Component Authoring Standards

1. **Variants Over Props Soup**:
   Components define explicit variants (`variant="outline"`, `size="sm"`) rather than multiple arbitrary boolean flags.
2. **Controlled Inputs**:
   Stateful inputs must always be controlled: pass `value` and `onChange` (or `checked` and `onCheckedChange` for toggleable controls).
3. **Class Merging**:
   Always merge Tailwind classes using `cn()` from `@/lib/utils`:
   ```tsx
   import { cn } from '@/lib/utils';
   <div className={cn('flex items-center gap-2 rounded-lg border border-border p-3', className)} />
   ```
4. **Spacing & Sizing**:
   - 4px modular spacing grid (`gap-1` [4px], `gap-2` [8px], `gap-3` [12px], `gap-4` [16px]).
   - Base radius is 8px (`rounded-lg`).
   - Mobile touch targets must be at least 44px (`min-h-[44px]`).
5. **Real States**:
   Always design and handle loading (`Spinner`, `Skeleton`), empty (`EmptyState`), disabled (`disabled:opacity-50`), and error states.

---

## 🔄 Environment & Running Modes

- **Mock Mode (No Backend Required)**:
  - In `.env`: `VITE_DEBUG=true` (and `DEBUG=true`).
  - Frontend runs standalone using local mock data and local storage.
- **Live API Mode (Django Backend Required)**:
  - In `.env`: `VITE_DEBUG=false` (and `DEBUG=false`).
  - Connects strictly to backend REST API at `http://127.0.0.1:8000`.

---

## 📋 Verification Checklist for Agents

Before completing any task or replying to the user, every agent must verify:
- [ ] Did I use components exclusively from BefUI (`https://befui.vercel.app/#/` or `https://befui.vercel.app/llms.txt`)?
- [ ] Did I use icons from `@/components/ui/icons` instead of external packages?
- [ ] Did I follow [`design.md`](./design.md) color tokens without hardcoding hex values?
- [ ] Did I preserve the immunity of `DashboardPage.jsx`?
- [ ] Does `npm run build` exit with code `0`?
