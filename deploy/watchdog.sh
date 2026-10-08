#!/usr/bin/env bash
# Elitr watchdog: run every 5 min by elitr-watchdog.timer. Restarts dead or unhealthy services,
# catches a stalled trading loop, checks the public HTTPS endpoints and the wallet runway, and
# writes one health line per day. Log: ~/elitr/data/watchdog.log (+ journald).
set -uo pipefail
ROOT=/home/ubuntu/elitr
LOG=$ROOT/data/watchdog.log
STATE=$ROOT/data/watchdog.state
mkdir -p "$ROOT/data"; touch "$STATE"
log() { echo "$(date -u +%FT%TZ) $*" | tee -a "$LOG"; }
fails() { grep -E "^$1=" "$STATE" | cut -d= -f2 || true; }
setfails() { grep -vE "^$1=" "$STATE" > "$STATE.tmp" || true; echo "$1=$2" >> "$STATE.tmp"; mv "$STATE.tmp" "$STATE"; }

LOOP=$(grep -E "^LOOP_INTERVAL_SEC=" "$ROOT/.env" | cut -d= -f2); LOOP=${LOOP:-1800}

# service -> local health URL
declare -A HEALTH=(
  [elitr-analyst]="http://127.0.0.1:4001/health http://127.0.0.1:4003/health"
  [elitr-execution]="http://127.0.0.1:4002/health"
  [elitr-web]="http://127.0.0.1:3000/"
  [elitr-desk]="http://127.0.0.1:9000/.well-known/agent-card.json"
  [caddy]=""
)

for svc in "${!HEALTH[@]}"; do
  if ! systemctl is-active --quiet "$svc"; then
    log "WARN $svc inactive -> restart"; sudo systemctl restart "$svc"; continue
  fi
  ok=1
  for url in ${HEALTH[$svc]}; do
    curl -fsS -m 10 -o /dev/null "$url" || ok=0
  done
  if [ "$ok" = 1 ]; then setfails "$svc" 0; continue; fi
  n=$(( $(fails "$svc" || echo 0) + 1 )); n=${n:-1}; setfails "$svc" "$n"
  if [ "$n" -ge 2 ]; then log "WARN $svc unhealthy twice -> restart"; sudo systemctl restart "$svc"; setfails "$svc" 0
  else log "INFO $svc health check failed once"; fi
done

# Stalled trading loop: last cycle older than 2.5x the interval while not mid-cycle.
STATEJSON=$(curl -fsS -m 15 http://127.0.0.1:4002/state 2>/dev/null || echo '{}')
read -r STALL USDT BNB NET MODE KILL < <(python3 - "$STATEJSON" "$LOOP" <<'PY'
import json, sys, time
s = json.loads(sys.argv[1] or "{}"); loop = int(sys.argv[2])
last = (s.get("lastCycleAt") or 0) / 1000
stall = int(bool(last) and not s.get("running") and time.time() - last > 2.5 * loop)
b = s.get("balances") or {}; p = s.get("pnl") or {}
print(stall, b.get("usdt") or "?", b.get("bnb") or "?", round(p.get("netUsd") or 0, 3), s.get("mode") or "?", s.get("killSwitch"))
PY
)
if [ "${STALL:-0}" = 1 ]; then log "WARN trading loop stalled (> 2.5x ${LOOP}s) -> restart elitr-execution"; sudo systemctl restart elitr-execution; fi

# Wallet runway
python3 - "$USDT" "$BNB" <<'PY' | while read -r line; do [ -n "$line" ] && log "$line"; done
import sys
try:
    u, b = float(sys.argv[1]), float(sys.argv[2])
    if u < 5: print(f"WARN trader USDT low: {u:.2f}")
    if b < 0.003: print(f"WARN trader BNB low: {b:.5f}")
except ValueError:
    pass
PY

# Public HTTPS (log only)
for u in https://elitr.xyz/ https://analyst.elitr.xyz/health https://flow.elitr.xyz/health https://agent.elitr.xyz/health https://desk.elitr.xyz/.well-known/agent-card.json; do
  code=$(curl -s -m 15 -o /dev/null -w "%{http_code}" "$u"); [ "$code" = 200 ] || log "WARN public $u -> HTTP $code"
done

# One health line per UTC day
TODAY=$(date -u +%F)
if [ "$(fails daily)" != "$TODAY" ]; then
  log "DAILY mode=$MODE kill=$KILL usdt=$USDT bnb=$BNB netUsd=$NET services=$(systemctl is-active elitr-analyst elitr-execution elitr-web elitr-desk caddy | tr '\n' ',' | sed 's/,$//')"
  setfails daily "$TODAY"
fi
