# Elitr demo film

A 2:58 film (3840×2160 master and 1920×1080, 60 fps) made with [Remotion](https://www.remotion.dev) for the judges of the **BNB Hack: Tokenized Stocks Edition**. It covers the problem (tokenized stocks trade around the clock while Wall Street is closed, and an AI agent has no way to buy information and judge whom to trust), Elitr working live on BSC mainnet, and what makes it different.

The film's motif is **the tape**: a stock-ticker tape that carries real desk events instead of quotes ("402 payment required · paid 0.01 usdt · settled on bsc · signal metab 48 neutral · hold"). Elitr's mark is six slanted bars, so at "Meet Elitr" six tapes, one per traded bStock, collapse into the six bars. The film opens on the status code the tape is about: HTTP 402 Payment Required, reserved in 1997 and answered here by agents over Binance b402.

Outputs (in `out/`, not committed): `elitr-demo-4k.mp4` (master), `elitr-demo-1080p.mp4` (Lanczos downscale of the master), `elitr-thumbnail.png` and `elitr-thumbnail-4k.png`. YouTube title, description and chapters are at the end of this file.

## What is real

**Footage.** Every app shot is the real, public Elitr dashboard at https://elitr.xyz reading the live agents on BSC mainnet. Nothing is mocked. No operator token was used and nothing was sent: every action in the clips is a page load, a filter chip, a hover or a scroll.
- Recorded on 10 Oct 2026 (Saturday, US market closed) with headless Chrome over the DevTools protocol (`scripts/capture.mjs`, `scripts/cdp.mjs`), 1600×900 CSS px at device scale 2 (3200×1800 frames). Every clip is "stepped": the page is posed for every 1/60 s (eased scroll and pointer) and one screenshot is taken per step, so motion is even. Encoded at 60 fps, H.264 CRF 11.

| Clip | URL | What happens |
|---|---|---|
| analysts | `/dashboard/analysts` | The two analyst cards (hit rate, trust, weight), the pointer on the flow analyst's trust bar, an eased scroll to Recent calls and the ERC-8004 ratings the trader posted |
| activity | `/dashboard/activity` | A real click on the Payments filter: the b402 challenges, payments and verifications |
| markets | `/dashboard/markets` | Eased scroll down the 14 buy-side risk checks with observed vs limit values |
| trades | `/dashboard/trades` | The autonomous stop-loss SELL and the live BUY of NVDAB with their tx links, and the earlier reverted swap |
| gaps | `/dashboard/gaps` | The weekend gap board (RWA Data API + Yahoo), "US market: CLOSED since Fri 16:00 ET", a real click on the bStocks issuer chip |
| overview | `/dashboard` | The desk at a glance (recorded, not used in the cut) |

**Numbers on screen and their sources.** All from the live system on 10 Oct 2026 (`data/execution-events.jsonl`, `data/reputation.json` and `GET /state` on the server, the public dashboard, and BSC mainnet).
- 137 paid signals, every one a b402 settlement on BSC (`payment.sent` events with a tx hash).
- Track records: flow analyst 13 right of 21 counted calls, trust 0.61; news analyst 0 of 6, trust 0.13 (`/state`, Analysts view).
- 46 ERC-8004 ratings posted by the trader to the reputation registry `0x8004BAa1…9b63` (`reputation.posted` events, each with a tx).
- Four ERC-8004 identities on the BSC identity registry: #365554 news analyst, #365555 flow analyst, #365556 trader, #367734 Elitr Desk Brief (BNB Agent Studio).
- The b402 purchase in the sequence diagram: trader to flow analyst, METAB, 0.01 USDT, tx `0x7ccdd0c0…31e1`, block 126,614,626, 9 Oct 09:49 UTC, signal 48/100 neutral.
- Live buy: 2 USDT → 0.008433 NVDAB @ $237.15, tx `0x0ce91120…3807`, 7 Oct 13:00 UTC. Autonomous stop-loss sell: mark 231.90 ≤ 232.41 (cost − 200 bps), 0.008433 NVDAB → 1.96 USDT, tx `0x37ff1c71…3b11`, 8 Oct 17:16 UTC.
- Binance Agentic Wallet purchase in U via EIP-3009, 3.5 s from signature to signal, tx `0xd2535021…2e4e`.
- The Desk Brief headline is quoted verbatim from `https://desk.elitr.xyz/x402?prompt=brief`, fetched 10 Oct 2026.
- CRCLB on-chain $85.44 vs Yahoo's Friday close $84.51 (+1.1%), and 488 tokenized stocks on BSC (46 bStocks, 442 Ondo), from the gap board's `GET /rwa/board` on 10 Oct.
- Six bStock prices on the tapes are the on-chain prices on 10 Oct (NVDAB 230.44, TSLAB 382.90, BABAB 110.85, CRCLB 85.44, SNDKB 1590.42, METAB 719.05).
- Risk limits (14 checks, $5 max trade, $25 position, $25 daily, $1/day data, confidence ≥ 65, gap ≥ 50 bps, liquidity ≥ $50k) are the live `risk` config in `/state`.
- HTTP 402 history: RFC 2068 (HTTP/1.1, January 1997) lists "402 Payment Required: This code is reserved for future use."

**Illustrations.** The New York clock, the sequence diagram, the cards and the tapes are motion graphics that present the real data above. They are not app UI.

**Logos.**
- **BNB Chain:** the official SVGs from https://www.bnbchain.org/en/brand-guidelines, used as supplied (never recoloured or modified) and only with "Built on" wording, as those guidelines ask. The guidelines also ask projects to seek approval before using the logo.
- **Elitr:** the six-bar mark from `apps/web/components/landing/Hero.tsx`, redrawn as an animatable SVG (`src/ui/Mark.tsx`); the background of the close is Elitr's own hero art (`apps/web/public/hero.jpg`).

**Voice, music and sound.** All from ElevenLabs.
- **Narration:** **Daniel** (premade, id `onwK4e9ZLuTAKqWW03F9`), model `eleven_multilingual_v2`, via `/v1/text-to-speech/{voice}/with-timestamps`, every line normalised to −16 LUFS. A few words are respelled for the voice only (for example "Ee-leeter" for Elitr, "E-R-C-eight-thousand-four" for ERC-8004, "Lyve" so "live" rhymes with "five"), so captions keep the real spelling.
- **The server's line** ("Four oh two. Payment required.") is a second voice, **River** (premade, id `SAz9YHcvj6GT2YYXdXww`), band-limited like a machine on a terminal (`scripts/vofx.mjs`).
- **Score:** the ElevenLabs Music API with a 12-section composition plan that follows the film's timeline (`scripts/music.mjs`).
- **Sound effects:** 17, made with `/v1/sound-generation` (`scripts/sfx.mjs`).
- **Final mix:** −14 LUFS integrated, true peak at or below −1 dBTP.

## Build it

The ElevenLabs key is read at runtime from `/Users/mrnetwork/Syntura/video/.env` (`ELEVENLABS_API_KEY`, see `scripts/env.mjs`). It is never printed, logged or stored in this project.

```
npm ci
node scripts/voiceover.mjs                 # narration + word timings, -16 LUFS per line
node scripts/vocheck.mjs                   # speech-to-text check of every line
node scripts/timing.mjs                    # src/timing.json: every word on a 60 fps frame
node scripts/music.mjs && node scripts/timing.mjs
node scripts/sfx.mjs
node scripts/capture.mjs && node scripts/encode.mjs   # live footage from https://elitr.xyz
node scripts/stills.mjs                    # half-scale check stills + contact sheets (out/stills)
npx remotion render src/index.ts Elitr out/elitr-demo-4k-raw.mp4 --scale 2 --codec h264 --crf 14 --x264-preset medium --image-format jpeg --jpeg-quality 100 --pixel-format yuv420p --audio-codec aac --audio-bitrate 320k
node scripts/finish.mjs out/elitr-demo-4k-raw.mp4 out/elitr-demo-4k.mp4         # -14 LUFS, TP <= -1 dBTP
ffmpeg -i out/elitr-demo-4k.mp4 -vf scale=1920:1080:flags=lanczos -c:v libx264 -crf 16 -preset slow -pix_fmt yuv420p -c:a copy -movflags +faststart out/elitr-demo-1080p.mp4
npx remotion still src/index.ts Poster out/elitr-thumbnail.png && npx remotion still src/index.ts Poster out/elitr-thumbnail-4k.png --scale 2
```

The film folder is outside the pnpm workspace (`pnpm-workspace.yaml` lists only `apps/*` and `packages/*`), and its `node_modules`, renders, caches and footage are git-ignored, so the app's build never sees it.

## YouTube

**Title:** Elitr: AI agents trade tokenized stocks on BNB Chain, and pay for being right

**Description:**

Two AI analysts sell trading signals to an execution agent over Binance b402. The trader picks the analyst with the better track record, scores every call on-chain with ERC-8004, checks 14 hard risk rules, dry-runs every swap with the Binance Transaction API, and trades bStocks live on BSC mainnet. Built for the BNB Hack: Tokenized Stocks Edition.

Live: https://elitr.xyz
Dashboard: https://elitr.xyz/dashboard
BNB Agent Studio agent: https://desk.elitr.xyz

0:00 HTTP 402, reserved in 1997
0:17 After the bell
0:27 The weekend gap
0:42 Meet Elitr
0:50 The sellers
1:02 One b402 purchase
1:21 Keeping score with ERC-8004
1:43 Fail closed
1:57 Live on mainnet
2:13 Agentic Wallet and Agent Studio
2:27 Why it's different
2:44 elitr.xyz
