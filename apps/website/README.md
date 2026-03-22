<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/354f91ef-434d-4818-bb23-18c0978a40aa

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Railway Environment Notes

Website service:
- `CONTROL_API_URL` (e.g. `https://control-api.up.railway.app`)
- `GATEWAY_URL` (e.g. `https://app.propai.live`)
- `LICENSING_URL` (e.g. `https://propailicense.up.railway.app`)

Gateway service (for `/app` redirect when Control UI assets are missing):
- `CONTROL_UI_REDIRECT_URL` (e.g. `https://propai.live/app`)

## Health Endpoints

- `GET /api/health` — website service is up
- `GET /api/health/ui` — UI build exists on disk
- `GET /api/health/control` — control‑api reachable
- `GET /api/health/full` — UI + control‑api + gateway in one call
