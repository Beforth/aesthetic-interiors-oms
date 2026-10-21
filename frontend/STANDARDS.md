# Project Standards

This is the **single source of truth** for how this codebase is built. Every developer and every AI agent must follow it.

If a new convention is agreed in chat, in review, or in code, **add it here in the same change**. Do not leave a rule only in conversation.

---

## 1. Project overview

| Project | Tech | Purpose |
|---|---|---|
| `<backend>/` | Django 5 + DRF + Simple JWT | REST API |
| `Aesthetic Interiors OSM/` | React 18 + Vite + Tailwind CSS | Operations & CRM web client |

- Backend and frontend are independent projects. They talk **only** through the versioned HTTP API.
- In local dev the frontend proxies `/api` and `/media` to the backend (`vite.config.js`), so the frontend `.env` can stay empty.
- Secrets live in `.env` (gitignored). Commit only `.env.example`. Never hardcode `SECRET_KEY`, DB passwords, tokens, or API keys.

---

## 2. Architecture

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

Every API response uses this shape:

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

---

## 4. Auth and permissions

- Auth transport: JWT (Simple JWT). Clients send `Authorization: Bearer <access>`.
- **Authorization** is permission-based, not role-name-based. Code checks a permission codename (`clients.view`), never `if user.role == "admin"`. Roles/groups are just bundles of permissions.
- Permission codenames are defined in one place (`src/config/permissions.js`) and referenced by constant.
- UI reads permissions through one hook (`useAuth().hasPermission(codename)`), never from the login payload.

### Client login flow

1. `POST /api/v1/accounts/login/` with credentials.
2. Store tokens + user in `localStorage` under a single prefix (`osm.auth.*`).
3. `GET /api/v1/accounts/permissions/` with the Bearer token; store the result.
4. UI reads permissions through one hook (`useAuth().hasPermission(codename)`), never from the login payload.
5. On logout, clear every key under the prefix.
6. The **only** place that clears the session on `401` is `services/apiClient.js`.

---

## 5. Frontend conventions

- Feedback goes through one toast helper (`utils/toast.js`); do not build toasts by hand.
- Tooltips: a single delegated manager driven by `data-tooltip`. Icon-only controls need **both** `data-tooltip` and `aria-label`. Never use native `title=` for icon controls. A control with a visible label gets no tooltip.
- Every list handles three states: loading, empty, error. Every form shows field errors from `errors` in the envelope.
- Disable the submit button while a request is in flight to prevent double submits.
- Design tokens (colours, spacing, radii) come from the Tailwind config; no magic hex values in components.
- Warm Walnut/Umber theme `#7D5A44` is the single source of truth for brand coloring.

---

## Changelog

- `2026-10-19` — Initial standards adopted for Aesthetic Interiors OSM.
