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
| `ae-oms-be/` | Django 6 + DRF + Simple JWT + PostgreSQL | REST API |
| `ae-oms-fe/` | React 18 + Vite + Tailwind CSS (JavaScript) | Operations & CRM web client |

- Backend and frontend are independent projects. They talk **only** through the versioned HTTP API.
- In local dev the frontend proxies `/api` and `/media` to the backend (`vite.config.js`), so the frontend `.env` can stay empty.
- Backend local setup: `docker compose --env-file ae-oms-be/.env up -d` (Postgres), then in `ae-oms-be/`: `pip install -r requirements.txt`, `python manage.py migrate`, `python manage.py runserver`. Run `python manage.py check` and `python manage.py makemigrations --check` before committing.
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
ae-oms-be/
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
- Lists are paginated with one shared paginator (`count`, `next`, `previous`, `results`). Define default and max page size once in `core/pagination.py`.

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
- Token lifetimes come from `.env`.
- Issue tokens in one function in `accounts/services.py` (e.g. `issue_tokens(user, ...)`). Never build tokens in views.
- All user/auth logic lives in the `accounts` app and is reached through `accounts.services`.
- **Authorization** is permission-based, not role-name-based. Code checks a permission codename (`clients.view`), never `if user.role == "admin"`. Roles/groups are just bundles of permissions.
- Permission codenames are defined once per side: `accounts/permissions.py` (authoritative, enforced by the backend via `HasPermission`) and `src/config/permissions.js` (UI gating). Keep them identical; add a codename to both in the same change.
- Do **not** return permissions inside the login/token response. Clients fetch them from a dedicated `GET .../permissions/` endpoint after login.
- Superuser bypass is allowed and must be implemented in one helper, not repeated per view.
- Every new endpoint must declare its permission. "Any authenticated user" is a deliberate choice and should be stated in the endpoint table.

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
- **Soft delete by default** for business data: an `is_deleted`/`deleted_at` field and a default manager that hides deleted rows. Hard delete only for throwaway data and only when stated here. Models inherit `core.models.BaseModel` (timestamps + soft delete); admin uses `all_objects`. Uniqueness on soft-deletable models must use a conditional `UniqueConstraint(condition=Q(is_deleted=False))`; the only exception is `User.email`, which stays globally unique because it is `USERNAME_FIELD`.
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
