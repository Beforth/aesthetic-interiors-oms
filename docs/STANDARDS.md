# Project Standards

This is the **single source of truth** for how this codebase is built. Every developer and every AI agent must follow it.

If a new convention is agreed in chat, in review, or in code, **add it here in the same change**. Do not leave a rule only in conversation.

---

## How to add a future rule

1. Find the matching section below. If none fits, add a new `##` section before the changelog.
2. Write the rule as an instruction (what to do / what not to do), not as a history note.
3. Include a short example when the rule affects code shape or API shape.
4. Append a dated line to [Changelog](#changelog).
5. Do not delete or weaken an existing rule unless the owner explicitly replaces it.

Rule entry template:

```markdown
### Short rule name

- **Must:** what to do
- **Must not:** what to avoid
- **Where:** files or layers this applies to
- **Why:** one line (only if it is not obvious)
```

---

## 1. Project overview

| Project | Tech | Purpose |
|---|---|---|
| `ae-oms-be` (separate repo) | Django 6 + DRF + Simple JWT + PostgreSQL | REST API |
| `ae-oms-fe` (this repo) | React 18 + Vite + Tailwind CSS (JavaScript) | Operations & CRM web client |

- Backend and frontend are **separate repositories**, kept side by side in one parent folder (`Aesthetic-Interior/`). They talk **only** through the versioned HTTP API. This repo holds the frontend only; the backend sections below are the rules the backend repo follows.
- In local dev the frontend proxies `/api` and `/media` to the backend (`vite.config.js`). Set `DEBUG=true` in `.env` to run standalone without any backend API (mock mode); set `DEBUG=false` to strictly connect to the live backend API.
- Frontend local setup, from the root of this repo: `npm install`, then `npm run dev` (Vite on http://localhost:5173; it proxies `/api` and `/media` to the backend on http://127.0.0.1:8000, so start the backend first and sign in with a backend user, for example the `admin` / `admin123` demo account). `npm run build` makes a production build. The backend's own setup steps live in the `ae-oms-be` repo.
- Git: never commit directly to `main`. Work on a `feat/...` branch and merge through a pull request. Swagger UI is at `http://127.0.0.1:8000/api/docs/` (schema at `/api/schema/`). Run `python manage.py check` and `python manage.py makemigrations --check` before committing.
- Secrets live in `.env` (gitignored). Commit only `.env.example`. Never hardcode `SECRET_KEY`, DB passwords, tokens, or API keys.

---

## 2. Architecture

### Layers (backend)

```
request → urls → view → serializer (validate) → service (business logic) → model → DB
                  ↓
              response envelope
```

| Layer | File | Responsibility | Must not |
|---|---|---|---|
| URL | `urls.py` | Route + name | Contain logic |
| View | `views.py` | Auth/permission check, parse input, call a service, return the envelope | Query models directly, hold business rules |
| Serializer | `serializers.py` | Shape and validate input/output | Create/update other models, call external services |
| **Service** | `services.py` | **All business logic**: rules, transactions, multi-model writes, external calls | Know about `request` / HTTP |
| Model | `models.py` | Fields, constraints, small model-level helpers | Contain workflows |
| Admin | `admin.py` | Staff tooling | Duplicate business rules (call services) |

- **Business logic belongs in the app's `services.py`.** Views, serializers, admin, management commands, and tasks all call services.
- Keep views thin: validate input → call a service → return the standard response.
- A service is a plain function (or small class) that takes plain arguments and returns a model/value or raises a domain error. Wrap multi-write operations in `transaction.atomic()`.
- Cross-app calls go through the other app's `services.py`, never its models/views.

### Backend folder layout

```
ae-oms-be/                 # repo root
├── core/                  # project module: settings, root urls, shared utils
│   ├── settings.py
│   ├── api_urls.py        # mounts every app under /api/<version>/
│   ├── responses.py       # success_response(...)
│   ├── exceptions.py      # custom_exception_handler
│   ├── pagination.py
│   └── models.py          # BaseModel: timestamps + soft delete
├── <app>/                 # one Django app per feature area
│   ├── models.py
│   ├── serializers.py
│   ├── services.py        # business logic lives here
│   ├── views.py
│   ├── urls.py
│   ├── permissions.py
│   ├── admin.py
│   ├── tasks.py           # background jobs (if any)
│   ├── migrations/
│   └── tests/
├── manage.py
├── requirements.txt
└── .env.example

(docs/STANDARDS.md — this file — lives at the repo root, not inside either project.)
```

- New feature area → its own app (`python manage.py startapp <name>`), then register it in `INSTALLED_APPS` and mount its URLs in `core/api_urls.py`.
- Use a **custom user model from day one** (`AUTH_USER_MODEL`). It cannot be changed cheaply later.
- Keep apps small and cohesive. If an app needs another app's internals, the boundary is wrong — move the shared piece into a service or into `core`.

### Frontend folder layout

```
src/
├── components/
│   ├── common/            # shared, presentation-only building blocks (ui/)
│   ├── domain/            # domain-specific components (ClientCard, ProjectCard, StageTimeline...)
│   └── layout/            # layout & structural components (AppShell, Topbar, Sidebar, Nav)
├── pages/                 # one component per route (thin; compose components)
├── hooks/                 # reusable stateful logic (useAuth, usePermission, ...)
├── services/              # API layer: apiClient.js + one file per domain feature
├── context/               # app-wide state (AuthContext, ToastContext)
├── utils/                 # pure helpers (formatters, toast, progress)
├── config/                # central configs (permissions, roles, navigation, iconMap)
├── routes/                # route table + permission guards
└── data/                  # mock data layer
```

- **Components never call `fetch`/`axios` directly.** They call functions from `services/`, which go through the single `apiClient`.
- Pages are thin: fetch via a service/hook, render components, no business rules.
- Pure logic (calculations, formatting) goes in `utils/` so it can be reused and tested.

---

## 3. API design

### Response envelope

Every API response uses this shape. Success: `core.responses.success_response`. Errors: wrapped by `core.exceptions.custom_exception_handler`.

Success:

```json
{ "success": true, "message": "Created", "data": {}, "errors": null }
```

Error:

```json
{
  "success": false,
  "message": "Name - This field is required.",
  "data": null,
  "errors": { "name": ["This field is required."] }
}
```

- **Must:** return `success_response(data=..., message="...")` from views / API layer.
- **Must not:** return raw serializer data or a bare `Response({...})` that omits `success` / `message` / `data` / `errors`.
- `data` is the payload (object, list, or `null`). `errors` is `null` on success, a dict/list on failure.
- `message` is a short human-readable sentence. On field validation errors it names the field so clients can toast it directly.
- Never leak stack traces or internals in `message`/`errors`. Unexpected errors return a generic 500 envelope and are logged server-side.
- Exceptions to the envelope must be listed here explicitly. Current exceptions: `GET /health/` (plain `{"status": "ok"}`), file downloads, and third-party webhooks that require their own shape. Token refresh must be wrapped by our own view so it uses the envelope.

### Versioning

- Every client API is versioned in the URL: `/api/<version>/...` (start with `v1`).
- Register app routes in `core/api_urls.py` so they inherit the prefix. **Must not** add unversioned client routes in `core/urls.py`. Admin, health check, static/media, OpenAPI schema, and Swagger UI may stay unversioned.
- View handlers accept `*args, **kwargs` so the `version` kwarg does not break them.
- A breaking change needs a new version (`v2`). Do not break `v1` clients.

### URLs and verbs

- Nouns, plural, kebab-case: `/api/v1/<app>/<resources>/`, `/api/v1/<app>/<resources>/{id}/`.
- Verbs map to HTTP methods: `GET` read, `POST` create, `PATCH` partial update, `PUT` full replace (rare), `DELETE` remove.
- Non-CRUD actions are sub-resources with `POST`: `/orders/{id}/cancel/`.
- Use query params for filtering/search/pagination: `?search=&status=&page=&page_size=`.
- Lists are paginated with one shared paginator (`count`, `next`, `previous`, `results`). Define default and max page size once in `core/pagination.py`. Views return lists through `core.views.paginated_response`; the frontend reads every page through `apiClient.getAll(...)`.

### Status codes

| Code | Use |
|---|---|
| 200 | OK (read, update) |
| 201 | Created |
| 200 | Also used for delete: return the envelope with `data: null` (never 204, so the envelope is always present) |
| 400 | Validation error |
| 401 | Missing/invalid/expired token |
| 403 | Authenticated but not allowed |
| 404 | Not found (also for rows the caller may not know exist) |
| 409 | Conflict (duplicate, stale update) |
| 500 | Unexpected error (generic envelope) |

---

## 4. Auth and permissions

- Auth transport: JWT (Simple JWT). Clients send `Authorization: Bearer <access>`.
- Default permission class is `IsAuthenticated`. Public endpoints (login, refresh) explicitly set `AllowAny` and empty `authentication_classes`.
- Token lifetimes come from `.env`. **Sliding idle session:** the access token is short (`JWT_ACCESS_MINUTES`, 5) and the refresh token lives `JWT_REFRESH_MINUTES` (10). Every refresh rotates and blacklists the old refresh token and restarts the 10-minute window. The frontend (`AuthContext`) refreshes only while the user is active (mouse, keys, scroll, touch) and signs the user out after 10 idle minutes; `apiClient` also refreshes once and retries on a 401. Keep the two numbers in sync.
- Issue tokens in one function in `accounts/services.py` (e.g. `issue_tokens(user, ...)`). Never build tokens in views.
- All user/auth logic lives in the `accounts` app and is reached through `accounts.services`.
- **Authorization** is permission-based, not role-name-based. Code checks a permission codename (`clients.view`), never `if user.role == "admin"`. Roles/groups are just bundles of permissions.
- Permission codenames: `accounts/defaults.py` lists them and seeds the system roles; the live source of truth is `Role.permissions` in the database (admins edit it through `/accounts/roles/`). `accounts/permissions.py` enforces it via `HasPermission` (set `required_permissions = {'GET': [...any of...], 'POST': 'x.manage'}` on the view). `src/config/permissions.js` mirrors the codenames for UI gating. Add a new codename to both files in the same change.
- **Sidebar items and their permissions are defined side by side.** For every sidebar item, the exact codenames it needs are written in a block at the top of `accounts/defaults.py` (backend) and in `src/config/permissions.js` plus `src/config/navigation.js` (frontend) in the same change, with the default roles that hold them. The item is visible when the user holds ANY of its codenames, and the page shows only the parts each codename allows. Settings: `users.manage` (Users tab), `roles.change` (create and edit roles), `settings.stageTemplate` (12-stage master template). The frontend never invents a codename the backend does not list.
- **Row-level access** (which clients/projects a caller sees) lives in the app's `services.py` (`accessible_projects`, `accessible_clients`), never in the view. The widest permission wins: `projects.viewAll`, then `viewAssigned`, then `viewOwn`. The Owner role holds every codename, so UI code must test `viewOwn && !viewAll` to detect a client.
- Do **not** return permissions inside the login/token response. Clients fetch them from a dedicated `GET .../permissions/` endpoint after login.
- Superuser bypass is allowed and must be implemented in one helper, not repeated per view.
- Every new endpoint must declare its permission and an `@extend_schema` (request, and `core.schema.responses(...)` for the envelope) so Swagger stays accurate. "Any authenticated user" is a deliberate choice and should be stated in the endpoint table.

### Client login flow

1. `POST /api/v1/accounts/login/` with credentials.
2. Store tokens + user in `localStorage` under a single prefix (`osm.auth.*`).
3. `GET /api/v1/accounts/permissions/` with the Bearer token; store the result.
4. UI reads permissions through one hook (`useAuth().hasPermission(codename)`), never from the login payload.
5. On logout, clear every key under the prefix.
6. The **only** place that clears the session on `401` is `services/apiClient.js`.

---

## 5. Data model and database

- Every model has: primary key, `created_at`, `updated_at` (shared abstract base in `core`).
- **Soft delete by default** for business data: an `is_deleted`/`deleted_at` field and a default manager that hides deleted rows. Hard delete only for throwaway data and only when stated here. Models inherit `core.models.BaseModel` (timestamps + soft delete); admin uses `all_objects`. Uniqueness on soft-deletable models must use a conditional `UniqueConstraint(condition=Q(is_deleted=False))`; the only exceptions are `User.email` (it is `USERNAME_FIELD`) and the optional `User.username`: both identify who is signing in, so they stay globally unique even after a soft delete. `Role.key` uses the conditional constraint.
- Enforce rules in the database too: `unique`, `unique_together`/`UniqueConstraint`, `CheckConstraint`, `null=False` by default. Do not rely on serializers alone.
- Name FKs for what they are (`customer`, not `customer_fk`). Always set `on_delete` deliberately and `related_name` when there is more than one FK to the same model.
- Money: `DecimalField`, never `float`. Store a currency or document the single currency (INR). Round in one place.
- Dates/times: store UTC (`USE_TZ = True`); convert only at the edge.
- Use `choices` via `TextChoices`/`IntegerChoices` for enumerations; do not scatter string literals.
- Add indexes for columns used in filters/ordering on large tables.
- Multi-step writes use `transaction.atomic()`.

---

## 6. Frontend conventions

### Stack and commands

Run in project root:

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |

### State management

- Local UI state → `useState`/`useReducer` in the component.
- Shared across a feature → a context/hook scoped to that feature.
- App-wide (auth, settings, permissions) → one context/store (`AuthContext`, `ToastContext`).
- **Server data** lives behind service functions + hooks; do not duplicate it into global state without a reason.
- Never store derived data; compute it.

### API layer

- One `apiClient` (axios/fetch wrapper) that: adds the Bearer token, unwraps the envelope, normalises errors, handles refresh/401.
- One service file per domain (`services/clientService.js`, `services/projectService.js`, etc.). Functions return unwrapped payload or throw normalized errors.
- Mock layer mimics versioned envelope (`/api/v1/...`).

### Routing and gating

- A route table in `routes/` is the only place routes are declared.
- Route guards check **permissions** (`hasPermission`), not role names. Components and pages must not branch on `role ===`; use `hasPermission(codename)` (role labels may be displayed, never used for logic).
- Hide UI the user cannot use, but never rely on that — the backend enforces.

### Components

- One component per file, `PascalCase` file and name. Small, single-purpose.
- Props are validated / documented; no prop drilling beyond 2 levels (use context/hook).
- Reuse `components/common/*` before building new primitives.
- Shared patterns (dropdown/select, modal, confirm dialog, toast, tooltip) have **one** implementation each. Do not hand-roll a second one; extend the shared one.
- Destructive actions (delete, cancel, reset) always ask for confirmation through the shared `ConfirmDialog`. Never use `window.confirm/alert/prompt`.
- Popovers/menus inside scroll containers are rendered in a portal or click-outside wrapper.

### UX consistency

- Feedback goes through one toast helper (`utils/toast.js`); do not build toasts by hand.
- Tooltips: a single delegated manager driven by `data-tooltip`. Icon-only controls need **both** `data-tooltip` and `aria-label`. Never use native `title=` for icon controls. A control with a visible label gets no tooltip.
- Every list handles three states: loading, empty, error. Every form shows field errors from `errors` in the envelope.
- Disable the submit button while a request is in flight to prevent double submits.

### Styling

- Tailwind utility classes; extract repeated groups into a component, not a custom CSS file.
- Design tokens (colours, spacing, radii) come from the Tailwind config; no magic hex values in components.
- Responsive by default; test at mobile and desktop widths.
- Warm Walnut/Umber theme `#7D5A44` is the single source of truth for brand coloring. Every brand shade (including `brand-espresso`, `brand-umber`, `brand-bark`, `brand-clay`, `brand-canvas`) is a token in `tailwind.config.js`; no arbitrary `bg-[#hex]` values in components.

### Accessibility

- Interactive elements are real `button`/`a`/`input`. Labels for every input. Keyboard reachable. Visible focus. Sufficient contrast.

---

## Changelog

- `2026-10-19` — Initial standards adopted for Aesthetic Interiors OSM: standardized `osm.auth.*` storage prefix, permission-first route guards, `apiClient` envelope unwrapping, and tooltip `data-tooltip` conventions.
- `2026-10-21` — Cleaned up template leftovers; named projects `ae-oms-be`/`ae-oms-fe`; delete returns 200 + envelope; permissions defined on backend and frontend; soft-delete uniqueness rule; brand colour tokens; no `window.confirm`; role-name branching banned in UI; backend env-driven settings with Postgres.
- `2026-10-21` — Phase 1 backend (accounts/roles/users, clients, agencies, projects/stages/template) built to the frontend's shapes; sliding 10-minute idle session with refresh rotation; role permissions stored in the database; Swagger via drf-spectacular; row-level access in services.
- `2026-10-22` - Backend moved to its own repo (`ae-oms-be`) beside the frontend repo; setup steps, committed `requirements.txt` and the no-direct-commits-to-main rule added.
- `2026-10-22` - Custom `User` (email sign-in, optional username) and `Role` models created before the first migration; the five system roles are seeded by a data migration from `accounts/defaults.py`. Every backend step is tested before it is committed.
- `2026-10-22` - Sign-in, rotating refresh token (sliding 10-minute idle session, old token blacklisted), logout, `me` and `permissions` endpoints added. Tests that depend on time use `accounts/tests/utils.py` (`at(minutes)` freezes the clock) and use the fast password hasher.
- `2026-10-22` - Swagger UI at `/api/docs/` and schema at `/api/schema/`. Every endpoint is described with `@extend_schema` and `core.schema.responses(...)` (the success and error envelopes). Tests fail if a new endpoint is undocumented or if `spectacular --validate --fail-on-warn` reports anything. Serializer method fields need a return type hint.
- `2026-10-22` - Roles and permissions: `HasPermission` guard (declare `required_permissions = {'GET': [...any of...], 'POST': 'x.manage'}` on every view; undeclared methods are denied, `IsAuthenticated` goes first so anonymous gets 401), role CRUD at `/accounts/roles/` and the codename list at `/accounts/permissions/catalog/`. Role changes apply on the user's next request. Operations on one resource that share a name need an explicit `operation_id`. Aggregate queries must be ordered explicitly before paginating.
- `2026-10-22` - Users API at `/accounts/users/` (list, create, edit, activate/deactivate, soft delete) plus the minimal `/accounts/users/directory/` for pickers. Rules: nobody can assign a role with more permissions than they hold or manage a user who holds more than they do (superusers exempt); nobody can change their own role or deactivate/delete themselves; passwords must pass Django's validators; email and username stay reserved after a soft delete; a deactivated or deleted user's tokens stop working immediately.
- `2026-10-22` - Clients app at `/clients/clients/` (list, create, edit, soft delete) and spreadsheet import at `/clients/clients/import/`. Row-level access lives in `clients/services.py`: `clients.view` sees every client, a client login sees only the records linked to it, and a record the caller may not see is a 404, never a 403. A client login means a role with `projects.viewOwn` and without `projects.viewAll` (the widest permission wins; the Owner holds both). The import skips bad rows and duplicates (same email, or same phone ignoring spaces and dashes, against existing clients and earlier rows) and reports each skipped row with its position and reason. A client with projects will be refused deletion once the projects app exists.
- `2026-10-22` - Agencies app at `/agencies/agencies/`. Contact details of subcontractors need `agencies.manage` or `projects.viewAll`; names are unique among live agencies ignoring capitals (database constraint plus a friendly 409); rating is 0-5 with one decimal and 0 means not rated.
- `2026-10-22` - Projects app at `/projects/projects/` (list, create, edit, soft delete, replace stages, edit one stage) and the master stage template at `/projects/stage-template/`. Creating a project generates one stage per template row. Row-level access in `projects/services.py`: `projects.viewAll` sees all, `viewAssigned` the projects the user is assigned to, `viewOwn` a client's own projects. Changing assignees needs `projects.assignPeople`; other project fields `projects.create`; stage status `stages.updateStatus`; stage name/dates/agency `stages.editDates` or `stages.editProjectStages`. Clients with projects and agencies allocated to stages cannot be deleted. Assigned staff now also see their projects' clients and their project team in the directory. Apps may call each other only through `services.py`; a function-level import breaks an import cycle. Projects were implemented before their tests: the tests for projects/stages are the first job when testing resumes.
- `2026-10-22` - Frontend repo flattened: the app now sits at the repo root (no `ae-oms-fe/` subfolder) and holds no backend files. Frontend and backend are separate repos side by side in one parent folder. This file is a copy of the backend repo's standards; keep the two in sync.
- `2026-10-22` - Settings wired end to end: login, session refresh, users, roles and the stage template run on the backend. Added the four codenames the backend was missing (`dsr.viewClientLink`, `feedback.view`, `payments.labour.viewOwn`, `reports.export`) so both sides list the same 40, plus a data migration that gives them to the built-in roles. Roles are edited on the Roles tab (list, create, edit, delete).
- `2026-10-22` - `seed_demo` (development only) creates one demo account per built-in role, with usernames matching the frontend's quick-login chips. A README was added to each repo with the run steps. The frontend treats a "client" as `projects.viewOwn` without `projects.viewAll` (the Owner holds every permission), and the Settings sidebar item opens for any of `users.manage`, `roles.change`, `settings.stageTemplate`.
- `2026-10-23` - For local development the idle sign-out is off (the frontend skips it under `npm run dev`) and the backend `.env` may use long `JWT_ACCESS_MINUTES` / `JWT_REFRESH_MINUTES` (for example 1440 and 10080); production keeps 5 and 10. The DSR page opens the signed-in person's own report, and people with `dsr.viewAll` pick anyone else from one Person filter.
