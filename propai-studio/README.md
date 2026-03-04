# PropAI Studio

PropAI Studio is the local web UI for `propai` / `propaiclaw`.

## Prerequisites

- Node.js 22+
- npm

## Configure

1. Copy `.env.example` to `.env.local` (or run the included `.bat` launcher once).
2. Set `VITE_PROPAICLAW_GATEWAY_URL` if your gateway is not the default.

Example:

```env
VITE_PROPAICLAW_GATEWAY_URL="http://127.0.0.1:8787/v1/api"
```

## Run Locally

```bash
npm install
npm run dev
```

The UI runs on `http://localhost:3000`.

## Windows One-Click Start

Double-click:

`start-propai-studio.bat`

## Run From Repo Root

```bash
pnpm propai:studio
```
