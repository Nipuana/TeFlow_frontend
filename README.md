# Teflow — Frontend

The Teflow web client: a Next.js (App Router, TypeScript) application with the
"Console" audit-terminal design.

## What it does

The user-facing app for Teflow. It covers signing in and registering, the
dashboard, projects, the per-project task ledger, task detail, and account
settings. It talks to the Teflow backend API for all data and authorization.

## Running it

Start the backend first (see `../backend`), then:

```bash
cd frontend
npm install
npm run dev          # http://localhost:3001
```

Other scripts:

```bash
npm test             # run the widget + unit tests
npm run build        # production build (also type-checks)
npm run typecheck    # type-check only, no output
```

The client calls the backend API. If your backend is not at the default
`http://localhost:3000`, set `NEXT_PUBLIC_API_URL` accordingly.
