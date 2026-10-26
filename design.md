# Design System: Aesthetic Interiors OMS

How Aesthetic Interiors Operations Management System (OMS) looks, feels, and functions. This design system is built upon **BefUI** principles and tokens. Read this before adding or editing any component, variant, or page so the entire application remains cohesive, calm, and performant.

---

## 1. Principles

1. **Quiet by default.**
   Hairline borders (`1px border-border`), restrained shadows (`shadow-xs`), and a single focused accent color. The screens should look serene and orderly; project timelines, site progress, work orders, and floor plans are the loudest things on the page.
2. **One variable rebrands everything.**
   Every color is defined via CSS variables in `src/index.css` and exposed through `tailwind.config.js`. Changing `--primary` propagates cleanly through buttons, active navigation, focus rings, progress bars, and links across both light and dark modes. Components never hard-code raw hex values.
3. **Motion explains, it does not decorate.**
   Transitions exist to establish spatial awareness and cause-and-effect: slide-over drawers opening, a card shifting columns in Kanban, or a toast notification confirming an attendance check-in. Everything respects `prefers-reduced-motion: reduce`. No looping decorative animations.
4. **Real states, not just the happy path.**
   Every interactive element handles invalid, disabled, hover, active, and loading states. Every data table, list, and board includes intentional empty and error states.
5. **Cross-device clarity & Mobile PWA readiness.**
   Site supervisors and field workers use mobile phones on dusty job sites, while project managers use wide desktop displays. Touch targets are at least 44px, contrast meets accessibility benchmarks, and navigation transitions seamlessly from persistent desktop rail to mobile drawer.
6. **Accessible first.**
   Full keyboard navigability (e.g., `Alt + arrow keys` in the Kanban board), Radix-powered focus traps in modals and drawers, visible 2px focus rings (`--ring` at 40–50% opacity), and standard ARIA markup throughout.

---

## 2. Color Palette & Tokens

Tokens are defined in `src/index.css` under `:root, .light` and `.dark`, and configured in `tailwind.config.js`.

### Core Color Tokens

| Token | Light Mode | Dark Mode | Usage |
|---|---|---|---|
| `--background` | `#ffffff` | `#0a0c10` | App page background |
| `--foreground` | `#0f172a` | `#e6e9ef` | Primary text and body content |
| `--card` | `#ffffff` | `#0f1218` | Elevated surfaces, panels, cards |
| `--card-foreground` | `#0f172a` | `#e6e9ef` | Text on card surfaces |
| `--popover` | `#ffffff` | `#0f1218` | Menus, tooltips, dropdowns |
| `--popover-foreground` | `#0f172a` | `#e6e9ef` | Text within popovers and menus |
| `--primary` | `#4f46e5` | `#818cf8` | Primary brand accent: actions, active links, badges |
| `--primary-foreground` | `#ffffff` | `#0a0c10` | Text and icons on primary backgrounds |
| `--secondary` | `#f1f5f9` | `#171b23` | Subtle fills, secondary buttons, hover states |
| `--secondary-foreground` | `#0f172a` | `#e6e9ef` | Text on secondary elements |
| `--muted` | `#f8fafc` | `#11141b` | Muted backgrounds, table headers, inactive rails |
| `--muted-foreground` | `#64748b` | `#8b94a5` | Secondary text, placeholders, metadata labels |
| `--accent` | `#eef2ff` | `#1a1d3d` | Selected rows, soft card highlights, active items |
| `--accent-foreground` | `#4338ca` | `#a5b4fc` | Text on accent backgrounds |
| `--border` | `#e2e8f0` | `#1f2430` | Hairline dividers, card borders, table borders |
| `--input` | `#e2e8f0` | `#272d3a` | Form control borders |
| `--ring` | `#6366f1` | `#6366f1` | Focus ring outline (2px with opacity) |
| `--radius` | `8px` | `8px` | Base corner radius |

### Status Tokens

| Semantic Status | Light Mode | Dark Mode | Usage |
|---|---|---|---|
| `--destructive` | `#e11d48` | `#f43f5e` | Errors, delete actions, missed deadlines, absent alerts |
| `--success` | `#059669` | `#10b981` | Completed tasks, check-in success, approved milestones |
| `--warning` | `#d97706` | `#f59e0b` | Pending review, approaching deadlines, on-leave badges |
| `--info` | `#2563eb` | `#60a5fa` | Informational callouts, active filters, announcements |

### Palette Guidelines
- **High Contrast**: Text on `--primary` must always use `--primary-foreground` (WCAG AA compliant, 4.5:1 ratio).
- **Dual Indicators**: Never rely on color alone to communicate status. Always pair status badges with an icon or clear text (e.g., `CheckIcon` + "Completed").
- **Dark Mode Philosophy**: Dark mode avoids stark `#000000` pitch black; it uses cool slate tones (`#0a0c10`, `#0f1218`, `#171b23`) and relies on subtle borders (`#1f2430`) rather than heavy drop shadows.

---

## 3. Typography

- **Primary Font**: `Inter`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `Roboto`, `sans-serif`
- **Monospace Font**: `JetBrains Mono`, `ui-monospace`, `Menlo`, `monospace` (used for task keys, order numbers, financial amounts, and measurement units)

### Type Scale

| Size Class | Pixel Equivalent | Recommended Application |
|---|---|---|
| `text-[10px]` / `text-[11px]` | 10–11px | Badges, avatar initials, uppercase tracked table headers |
| `text-xs` | 12px | Timestamps, secondary metadata, sub-labels |
| `text-[13px]` | 13px | Dense table cells, form help text, compact cards |
| `text-sm` | 14px | **Default application font size**, inputs, buttons, menu items |
| `text-base` | 16px | Section headers, card titles, featured descriptions |
| `text-lg` | 18px | Modal titles, page subheadings, KPI stat numbers |
| `text-xl` – `text-2xl` | 20–24px | Page titles, primary dashboard metrics |

### Weights & Tracking
- **Body & Content**: `font-normal` (400)
- **Labels & Controls**: `font-medium` (500)
- **Headings & Badges**: `font-semibold` (600)
- **Header Tracking**: `tracking-tight` (`-0.02em`) on headings for crisp modern appearance.
- **Tabular Numbers**: Use `tabular-nums` class for currencies, dates, measurements, and numerical tables to prevent visual jitter.

---

## 4. Shape, Space & Sizing

### Corner Radius
- **Base (`--radius`)**: `8px` (`rounded-lg`) applied to buttons, inputs, dropdowns, and menu popovers.
- **Small**: `6px` (`rounded-md`) for badges, internal chips, and sub-controls.
- **Card / Dialog**: `12px` – `14px` (`rounded-xl` or `rounded-2xl`) for elevated containers.
- **Full**: `9999px` (`rounded-full`) for avatars, tag pills, and presence indicator dots.

### Spacing Grid
The application follows a strict **4px modular grid**:
- Spacing 1 (`4px`), 2 (`8px`), 3 (`12px`), 4 (`16px`), 5 (`20px`), 6 (`24px`), 8 (`32px`).
- Card padding: `p-4` (mobile) to `p-5` or `p-6` (desktop).
- List density: `gap-2` to `gap-3`.
- Section gutters: `px-4` on mobile, `px-6` to `px-8` on desktop.

### Touch & Control Heights
- Default desktop control height: `36px` (`h-9`).
- Compact control height: `32px` (`h-8`).
- Mobile touch target minimum: `44px` (`min-h-[44px]`, `min-w-[44px]`).

---

## 5. Motion & Micro-interactions

Motion in Aesthetic Interiors OMS is subtle and purposeful.

| Context | Transition Properties | Duration & Timing |
|---|---|---|
| Hover, active press, focus states | `background-color`, `border-color`, `color`, `opacity` | `150ms ease` |
| Dropdowns, popovers, select menus | `opacity`, `transform` (2px translateY) | `150ms ease-out` |
| Accordions, collapsible groups | `max-height`, `grid-template-rows` | `200ms – 250ms ease` |
| Drawers, slide-over panels, modals | `transform`, `opacity` | `250ms – 280ms cubic-bezier(0.22, 1, 0.36, 1)` |
| Toasts & Floating alerts | `transform`, `opacity` | `250ms ease-out` |
| Progress bars, chart reveals | `width`, stroke-dashoffset | `700ms – 1000ms ease-out` (runs once) |

> **Accessibility**: Wrap dynamic motion in `@media (prefers-reduced-motion: no-preference)` or use Tailwind utility `motion-reduce:transition-none` to guarantee zero motion sickness for sensitive users.

---

## 6. BefUI Component Architecture

All reusable UI components live in `src/components/ui/` and adhere to BefUI conventions:

1. **Variants Over Props Soup**:
   Components utilize structured variants (e.g. `variant: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive'`) rather than an explosion of boolean props.
2. **Compositional Design**:
   Build complex screens by composing simple, declarative primitives:
   ```jsx
   <Card>
     <CardHeader>
       <CardTitle>Kitchen Renovation</CardTitle>
     </CardHeader>
     <CardContent>...</CardContent>
   </Card>
   ```
3. **Self-Contained Files**:
   Each component is clean and standalone in `src/components/ui/<component>.{jsx,tsx}`. Dependencies are limited to `clsx`, `tailwind-merge` (`@/lib/utils`), and icons.
4. **Custom SVG Icon System (`src/components/ui/icons.tsx`)**:
   - 24px coordinate grid.
   - Uniform `1.75` stroke weight.
   - `currentColor` stroke for automatic light/dark and hover adaptation.
   - Optional stroke-draw animation when hovered via the `draw` prop.

---

## 7. Key BefUI Components in OMS

- **Kanban (`src/components/ui/kanban.tsx`)**:
  - Drag-and-drop task columns with keyboard accessibility (`Alt + Arrow keys`).
  - Tone-coded column headers (To Do, In Progress, In Review, Done).
  - Used for project task phases, agency assignments, and daily site supervisor logs.
- **Avatar (`src/components/ui/avatar.tsx`)**:
  - Consistent deterministic tone-hashed initial badges based on employee or client name.
  - Presence indicator dots (`online`, `away`, `busy`, `offline`).
- **Sidebar & AppShell (`src/components/layout/Sidebar.jsx`, `AppShell.jsx`)**:
  - Responsive layout: persistent rail on `lg` screens, slide-out drawer on tablet/mobile.
  - Active route highlighted with `--primary` or `--accent`.
- **Leaderboard (`src/components/ui/leaderboard.tsx`)**:
  - Ranked worker/agency performance board with animated proportional fill bars.
  - Top 3 podium badges (gold, silver, bronze).
- **StatCard & Metrics**:
  - Clean KPI cards with subtle border, primary stat figure, and trend badge.
- **StatusBadge**:
  - Semantic colored pill badges for project statuses (active, on hold, completed, delayed).

---

## 8. Development & Maintenance Rules

1. **Strict Dashboard Immunity**:
   Do **NOT** alter the core layout, colors, or structure of `DashboardPage.jsx` without explicit instruction. The dashboard maintains its verified baseline.
2. **No Hard-coded Hex Colors in Components**:
   Always use Tailwind CSS variable utilities (`bg-background`, `text-foreground`, `bg-card`, `border-border`, `text-muted-foreground`, `bg-primary`, `text-primary-foreground`).
3. **Test Build Integrity**:
   Run `npm run build` after any design token or component update to ensure zero TypeScript/JSX compilation errors.
