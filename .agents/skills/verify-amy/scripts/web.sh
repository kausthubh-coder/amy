#!/usr/bin/env sh
# Expo web instance for verifying Amy. Usage: web.sh start | doctor | stop
# State lives in .artifacts/verify/.run (pid, port, log). Evidence folders beside it are never touched.
set -eu

ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
RUN="$ROOT/.artifacts/verify/.run"
PORT="${AMY_WEB_PORT:-19077}"
mkdir -p "$RUN"

windows() {
  case "$(uname -s)" in
    MINGW*|MSYS*|CYGWIN*) return 0 ;;
    *) return 1 ;;
  esac
}

alive() {
  [ -f "$RUN/pid" ] || return 1
  pid="$(cat "$RUN/pid")"
  if windows; then
    tasklist //FI "PID eq $pid" //NH 2>/dev/null | grep -qE "^[^ ]+ +$pid "
  else
    kill -0 "$pid" 2>/dev/null
  fi
}

http_code() {
  curl -s -o /dev/null -w '%{http_code}' --max-time "${2:-10}" "$1" || echo 000
}

bundle_url() {
  echo "http://localhost:$PORT/index.ts.bundle?platform=web&dev=true&hot=false&lazy=true&transform.engine=hermes&transform.routerRoot=app&unstable_transformProfile=hermes-stable"
}

case "${1:-}" in
  start)
    if alive; then
      echo "already running: pid $(cat "$RUN/pid"), port $(cat "$RUN/port")"
      exit 0
    fi
    [ -d "$ROOT/node_modules/expo" ] || { echo "run npm ci first"; exit 1; }
    echo "$PORT" > "$RUN/port"
    cd "$ROOT"
    EXPO_NO_TELEMETRY=1 BROWSER=none node node_modules/expo/bin/cli start --web --port "$PORT" > "$RUN/web.log" 2>&1 &
    pid=$!
    # In Git Bash $! is an MSYS pid. tasklist and taskkill want the Windows pid of the shell that
    # runs node; killing that pid with /T takes node down with it.
    if windows; then
      winpid="$(cat "/proc/$pid/winpid" 2>/dev/null || true)"
      [ -n "$winpid" ] && pid="$winpid"
    fi
    echo "$pid" > "$RUN/pid"
    i=0
    while [ "$i" -lt 60 ]; do
      [ "$(http_code "http://localhost:$PORT/")" = "200" ] && break
      i=$((i + 1)); sleep 1
    done
    [ "$(http_code "http://localhost:$PORT/")" = "200" ] || { echo "Metro did not answer on port $PORT; see $RUN/web.log"; exit 1; }
    # The first bundle takes 20 to 40 s; building it here keeps the browser from timing out later.
    code="$(http_code "$(bundle_url)" 180)"
    [ "$code" = "200" ] || { echo "bundle request returned $code; see $RUN/web.log"; exit 1; }
    echo "ready: pid $(cat "$RUN/pid"), http://localhost:$PORT/ (log: $RUN/web.log)"
    ;;
  doctor)
    alive || { echo "NOT RUNNING: no live pid in $RUN/pid"; exit 1; }
    PORT="$(cat "$RUN/port")"
    [ "$(http_code "http://localhost:$PORT/")" = "200" ] || { echo "pid alive but http://localhost:$PORT/ is not answering"; exit 1; }
    [ "$(http_code "$(bundle_url)" 180)" = "200" ] || { echo "bundle fails to build; read $RUN/web.log"; exit 1; }
    if grep -q "ERROR" "$RUN/web.log"; then echo "note: ERROR lines in $RUN/web.log (may be from edits since the last reload)"; fi
    echo "OK: pid $(cat "$RUN/pid") serves http://localhost:$PORT/ and the bundle builds"
    ;;
  stop)
    if ! alive; then echo "nothing running"; rm -f "$RUN/pid"; exit 0; fi
    pid="$(cat "$RUN/pid")"
    if windows; then
      taskkill //PID "$pid" //T //F > /dev/null 2>&1 || true
    else
      kill "$pid" 2>/dev/null || true
    fi
    rm -f "$RUN/pid"
    echo "stopped pid $pid"
    ;;
  *)
    echo "usage: web.sh start | doctor | stop"; exit 2 ;;
esac
