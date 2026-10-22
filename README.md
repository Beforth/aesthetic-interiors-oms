# ae-oms-fe

React + Vite + Tailwind frontend for Aesthetic Interiors OSM. Rules and conventions: `docs/STANDARDS.md`.

## Run it

The app talks to the backend (repo `ae-oms-be`) through a dev proxy, so **start the backend first**
(its README has the steps). Then, from this folder:

```powershell
npm install        # once, and after package.json changes
npm run dev        # http://localhost:5173
```

Sign in with one of the demo accounts the backend's `seed_demo` command creates, or click a role button
on the login page:

| Username | Password | Role |
|---|---|---|
| `admin` | `admin123` | Owner |
| `manager` | `demo123` | Manager |
| `supervisor` | `demo123` | Site Supervisor |
| `worker` | `demo123` | Site Worker |
| `client` | `demo123` | Client |

If the login says "Unable to reach the backend server", the backend is not running.

## Wired to the backend so far

Login and session refresh, and the **Settings** tab (users, roles, 12-stage template). The other tabs
still use local mock data until their turn.