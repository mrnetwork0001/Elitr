# Deploying Elitr

## Production: AWS Lightsail + Caddy + systemd

Elitr runs on one AWS Lightsail instance (Ubuntu 24.04, 2 GB) in **Frankfurt**, an allowed region for the Binance Web3 API. Code is built on the server with pnpm. There is no Docker in production.

| Piece | How |
| --- | --- |
| systemd units | `elitr-analyst` (news 4001 + flow 4003, one process), `elitr-execution` (4002), `elitr-web` (3000), `elitr-desk` (9000, the Agent Studio seller "Elitr Desk Brief", `bag dev` behind Caddy) and `caddy`. All agent ports bind to `127.0.0.1`, `Restart=always`. |
| Caddyfile hosts | `elitr.xyz` (dashboard; `www` redirects), `analyst.elitr.xyz` → 4001, `flow.elitr.xyz` → 4003, `agent.elitr.xyz` → 4002, `desk.elitr.xyz` → 9000. Automatic Let's Encrypt certificates; SSE proxied unbuffered. |
| Watchdog | `elitr-watchdog.timer` runs [`deploy/watchdog.sh`](../deploy/watchdog.sh) every 5 minutes (`deploy/elitr-watchdog.service`): restarts an inactive unit or one that fails its local health check twice in a row, restarts `elitr-execution` when the last cycle is older than 2.5 × `LOOP_INTERVAL_SEC`, logs the public HTTPS hosts and the trader's USDT / BNB runway, and writes one health line per UTC day to `data/watchdog.log`. |
| Backup | a nightly systemd timer backs up `~/elitr/data/` (events, ledger, reputation, state). |
| Loop | `LOOP_INTERVAL_SEC=1800`: one cycle every 30 minutes, for each of the six traded bStocks. |
| Secrets | `~/elitr/.env` (mode 600), never committed. `CONTROL_TOKEN` is set, so `POST /cycle`, `/kill` and `/trade` need `Authorization: Bearer $CONTROL_TOKEN`. |

The rest of this page covers **alternatives** (Vercel for the dashboard, Railway / Fly.io / a VPS with docker compose for the agents). They are not what runs today, but the region warning in section 0 applies to every option.

For the alternatives, the dashboard (`apps/web`) is static and SSR Next.js whose browser talks to the agents directly and never calls Binance, so it can live on Vercel. The agents (`analyst` on 4001 + 4003, `execution` on 4002) are long-running processes with a loop, SSE streams and a persistent `data/` directory; serverless will not work. Both agent images are built from [`docker/agent.Dockerfile`](../docker/agent.Dockerfile) with `--build-arg APP=analyst-agent|execution-agent`. The build context is the repo root.

## 0. Before anything: pick an allowed region

The Binance Web3 API checks the caller's IP against its [prohibited regions list](https://web3.binance.com/en/dev-docs/web3-api-prohibited-regions). The hackathon page ([`docs/reference/hack.md`](reference/hack.md)) lists, among others, the **United States, Canada, the Netherlands, the United Kingdom and Japan**, as well as Iran, Cuba, North Korea, Crimea, DPR and LPR. Requests from those regions fail, and both agents call Binance: the analyst calls b402, the execution agent calls RWA Data, Market, Trading and Transaction.

Many default regions are restricted:

| Platform | Restricted defaults to avoid | Allowed candidates (check against the current list) |
| --- | --- | --- |
| Railway | US West, US East, **EU West (Amsterdam, NL)** | Southeast Asia (Singapore) |
| Fly.io | `iad`, `ord`, `lax`, `sjc`, `yyz`, `ams`, `lhr`, `nrt` | `sin` (Singapore), `fra` (Frankfurt), `syd` (Sydney) |
| VPS | US / CA / NL / UK / JP datacentres | e.g. Frankfurt, Singapore |

After deploying, confirm from inside the container. `GET /health` on the analyst should show b402 configured, and the first execution cycle should not log a `BinanceApiError` with a region or forbidden message.

The dashboard on Vercel does not call Binance, so its region does not matter.

## 1. Secrets and variables

All values are documented in [`.env.example`](../.env.example). Put them in the platform's secret store, never in the image.

| Variable | analyst | execution | web (build time) |
| --- | :-: | :-: | :-: |
| `BINANCE_WEB3_API_KEY`, `BINANCE_WEB3_API_SECRET` | ✓ | ✓ | |
| `ANALYST_PAY_TO`, `ANALYST_PRICE_WEI`, `ANALYST_PAYMENT_ASSET`, `ANALYST_PAYMENT_METHOD` | ✓ | | |
| `ANALYST_PUBLIC_URL` (public **https** URL of the news analyst) | ✓ | | |
| `ANTHROPIC_BASE_URL` + `ANTHROPIC_AUTH_TOKEN` (0G Router) or `ANTHROPIC_API_KEY`, `ANALYST_MODEL` | ✓ | | |
| `EXECUTION_PRIVATE_KEY` (dedicated hot wallet, small balance) | | ✓ | |
| `EXECUTION_HOST=0.0.0.0` | | ✓ | |
| `CONTROL_TOKEN` (`openssl rand -hex 32`). **Required** when not on loopback; the agent refuses to start without it. When set, `POST /cycle`, `/kill` and `/trade` need it as a bearer | | ✓ | |
| `ANALYSTS=analyst=https://…,analyst-flow=https://…`, `ANALYST_URL` | | ✓ | |
| `BSC_RPC_URL`, `LOOP_INTERVAL_SEC`, `LIVE_TRADING`, `RISK_*`, `KILL_SWITCH` | | ✓ | |
| `DASHBOARD_ORIGIN=https://<your-dashboard>.vercel.app` (CORS) | ✓ | ✓ | |
| `NEXT_PUBLIC_ANALYST_URL`, `NEXT_PUBLIC_FLOW_ANALYST_URL`, `NEXT_PUBLIC_EXECUTION_URL` | | | ✓ |

`DASHBOARD_ORIGIN` must match the dashboard origin exactly: scheme + host, no trailing slash. Otherwise the browser blocks the SSE streams and `/state`.

### The URL loop

The pieces reference each other, so deploy in this order:

1. Deploy the **agents** first with `DASHBOARD_ORIGIN` set to a placeholder. Note their public **HTTPS** URLs.
2. Deploy the **dashboard** with `NEXT_PUBLIC_*` set to those HTTPS URLs. The page is served over HTTPS, so `http://` agent URLs would be blocked as mixed content.
3. Set `DASHBOARD_ORIGIN` on both agents to the dashboard URL and restart them.
4. Set `ANALYST_PUBLIC_URL` on the analyst to its HTTPS URL. This is the `resource` URL inside the 402 challenge.

`NEXT_PUBLIC_*` values are inlined into the browser bundle at build time. After you change them, **redeploy** the dashboard. A restart is not enough.

## 2. Dashboard on Vercel

1. *New Project* → import the GitHub repo.
2. **Root Directory:** `apps/web`. Leave *Include source files outside of the Root Directory* **enabled**, because the app imports `packages/shared`.
3. Framework preset: **Next.js**. Vercel detects pnpm from `pnpm-lock.yaml` at the repo root and installs the whole workspace.
4. **Build Command** (override). Workspace dependencies must be compiled first:
   ```
   cd ../.. && pnpm --filter @elitr/web... build
   ```
   Leave **Install Command** at the default (`pnpm install`) and **Output Directory** at the default (`.next`).
5. **Node.js version:** 22.x or 24.x (Project Settings → General).
6. **Environment variables** (Production + Preview): `NEXT_PUBLIC_ANALYST_URL`, `NEXT_PUBLIC_FLOW_ANALYST_URL`, `NEXT_PUBLIC_EXECUTION_URL`.
7. Deploy, then copy the production URL into `DASHBOARD_ORIGIN` on the agents.

CLI alternative, from the repo root: `vercel link` (choose root directory `apps/web`), then `vercel env add NEXT_PUBLIC_ANALYST_URL`, and so on, then `vercel --prod`.

> Self-hosting the dashboard instead: [`docker/web.Dockerfile`](../docker/web.Dockerfile) runs `next start`. It passes the `NEXT_PUBLIC_*` URLs as build args. A smaller image is possible with `output: "standalone"` in `apps/web/next.config.ts`, which is not enabled today.

## 3a. Agents on Railway

Create one project with **two services** from the same repo, both in an allowed region (Singapore).

| Setting | analyst | execution |
| --- | --- | --- |
| Builder | Dockerfile | Dockerfile |
| `RAILWAY_DOCKERFILE_PATH` | `docker/agent.Dockerfile` | `docker/agent.Dockerfile` |
| Build arg (service variable) `APP` | `analyst-agent` | `execution-agent` |
| `HEALTH_PORT` | `4001` | `4002` |
| Healthcheck path | `/health` | `/health` |
| Volume mounted at | `/app/data` | `/app/data` |
| Public domain → port | 4001 (news) | 4002 |

- Railway passes service variables to `ARG`s with the same name, so `APP` set as a variable becomes the build arg.
- Railway mounts volumes owned by root. Set `RAILWAY_RUN_UID=0` on both services. The image entrypoint then `chown`s `/app/data` and drops to the unprivileged `node` user via `setpriv`.
- Railway gives one public domain per port. The flow analyst on **4003** needs a second domain on the analyst service (Settings → Networking → add domain → port 4003).
- Execution must have `EXECUTION_HOST=0.0.0.0` and `CONTROL_TOKEN`. Use the analyst's private network URL (`http://analyst.railway.internal:4001` and `:4003`) in `ANALYSTS` / `ANALYST_URL`. That keeps agent-to-agent traffic off the public internet.
- If you don't want the execution agent publicly reachable, skip its public domain. The dashboard then can't show execution data. It needs `GET /state` and `/events`, which are read-only. The control `POST`s are protected by `CONTROL_TOKEN`.

## 3b. Agents on Fly.io

One app per agent, in an allowed region (`sin` or `fra`). Example for the execution agent (`fly.execution.toml`):

```toml
app = "elitr-execution"
primary_region = "sin"

[build]
  dockerfile = "docker/agent.Dockerfile"
  [build.args]
    APP = "execution-agent"
    RUNTIME_USER = "root"      # Fly volumes are root-owned; entrypoint chowns and drops to `node`

[env]
  EXECUTION_HOST = "0.0.0.0"
  EXECUTION_PORT = "4002"
  HEALTH_PORT = "4002"
  ANALYST_URL = "http://elitr-analyst.internal:4001"
  ANALYSTS = "analyst=http://elitr-analyst.internal:4001,analyst-flow=http://elitr-analyst.internal:4003"

[mounts]
  source = "elitr_data"
  destination = "/app/data"

[http_service]
  internal_port = 4002
  force_https = true
  auto_stop_machines = "off"   # the trading loop must keep running
  min_machines_running = 1

[[http_service.checks]]
  path = "/health"
  interval = "30s"
  timeout = "5s"
```

```bash
fly apps create elitr-execution
fly volumes create elitr_data --region sin --size 1 -a elitr-execution
fly secrets set -a elitr-execution BINANCE_WEB3_API_KEY=… BINANCE_WEB3_API_SECRET=… \
  EXECUTION_PRIVATE_KEY=… CONTROL_TOKEN=$(openssl rand -hex 32) DASHBOARD_ORIGIN=https://<dashboard>.vercel.app
fly deploy -c fly.execution.toml
```

The analyst is the same with `APP = "analyst-agent"`, `HEALTH_PORT = "4001"` and `internal_port = 4001`. Expose 4003 with an extra `[[services]]` block (`internal_port = 4003`, `ports = [{ port = 4003, handlers = ["tls","http"] }]`). Fly's TLS on 4003 means the public flow URL becomes `https://elitr-analyst.fly.dev:4003`. Keep **one machine per agent**: the state file and the reputation file are single-writer.

## 3c. VPS with docker compose

The simplest alternative that matches local exactly (production uses systemd units without Docker, see the top of this page):

```bash
# on a VPS in an allowed region (Docker + compose plugin installed)
git clone https://github.com/mrnetwork0001/Elitr.git && cd Elitr
cp .env.example .env && chmod 600 .env     # fill in keys, CONTROL_TOKEN, DASHBOARD_ORIGIN, NEXT_PUBLIC_* (https)
docker compose up -d --build
docker compose ps                          # all services "healthy"
```

- State lives in the `elitr-data` named volume. Back it up with `docker run --rm -v elitr-data:/d -v $PWD:/b busybox tar czf /b/elitr-data.tgz -C /d .`.
- Port 4002 is published on `127.0.0.1` only. Put a TLS reverse proxy in front for public HTTPS, and serve 4001, 4003, 4002 and 3000 under subdomains. An example `Caddyfile`:
  ```
  analyst.example.com   { reverse_proxy localhost:4001 }
  flow.example.com      { reverse_proxy localhost:4003 }
  execution.example.com { reverse_proxy localhost:4002 }
  app.example.com       { reverse_proxy localhost:3000 }
  ```
  SSE needs no buffering. Caddy handles it by default. On nginx, set `proxy_buffering off;` for `/events`.
- When the dashboard runs on Vercel instead, drop the `web` service: `docker compose up -d analyst execution`.

## 4. Smoke test after deploy

```bash
curl -s https://analyst.example.com/health | jq     # b402Configured: true, llmConfigured: true
curl -si https://analyst.example.com/signal?symbol=NVDAB | head -n 1   # HTTP/2 402 (payment required)
curl -s https://execution.example.com/health | jq
curl -s https://execution.example.com/state | jq '.liveTrading, .killSwitch, .configErrors'
curl -s -X POST -H "Authorization: Bearer $CONTROL_TOKEN" https://execution.example.com/cycle   # 202
```

Then open the dashboard. All agent connections should show as live, and the cycle's events should stream in.

## 5. Going live

Keep `LIVE_TRADING=0` until a few simulated cycles look right on the dashboard. Every swap must show `tx.simulated ok`. Then fund the hot wallet with a few dollars of USDT plus about 0.005 BNB, set `LIVE_TRADING=1`, and restart the execution agent. `POST /kill` (with the token) or `KILL_SWITCH=1` stops trading immediately.
