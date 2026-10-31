# Liangqi OAuth Worker

GitHub / Gitee OAuth broker for 两讫. It exchanges an OAuth code for a token and
posts the token back to the app window. It never stores or proxies ledger data.

## 1. Create OAuth apps

### GitHub

- Settings → Developer settings → OAuth Apps → New OAuth App
- Homepage URL: your app URL, e.g. `https://ledger.example.com`
- Authorization callback URL:
  `https://<your-worker>.workers.dev/auth/github/callback`

### Gitee

- Settings → Third-party applications → Create application
- Callback URL:
  `https://<your-worker>.workers.dev/auth/gitee/callback`
- Scope: `projects`

## 2. Configure secrets

```bash
cd server/oauth-worker
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
npx wrangler secret put GITEE_CLIENT_ID
npx wrangler secret put GITEE_CLIENT_SECRET
npx wrangler secret put STATE_SECRET       # random 32+ byte string
npx wrangler secret put APP_ORIGINS        # https://ledger.example.com,http://localhost:5173
```

`APP_ORIGINS` is a comma-separated allowlist. The app sends its `origin` when it
opens the login popup; the worker rejects origins that are not listed.

## 3. Deploy

```bash
npx wrangler deploy
```

Health check:

```bash
curl https://<your-worker>.workers.dev/health
```

## 4. Use in the app

Open **Data source → GitHub / Gitee → OAuth service** and paste the worker URL.
The app opens a popup, receives the token through `postMessage`, and stores it in
the browser for the connection. Tokens are not sent to the worker again.

## Security notes

- Keep `*_CLIENT_SECRET` and `STATE_SECRET` as Worker secrets, never in the app.
- `APP_ORIGINS` must contain only your real app origins; do not use `*`.
- OAuth tokens are stored in the browser's `localStorage` so the connection
  survives reloads. Use a dedicated fine-grained token if that is a concern.
- The worker only handles the OAuth redirect; if you self-host, put it behind
  HTTPS.
