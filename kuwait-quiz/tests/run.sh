#!/usr/bin/env bash
# يشغّل كل اختبارات اللعبة: يرفع سيرفراً ثابتاً، يمر على test_*.js، ويطفّيه بعدها.
#
#   bash kuwait-quiz/tests/run.sh              كل الاختبارات
#   bash kuwait-quiz/tests/run.sh popovers     الاختبارات اللي اسمها فيه "popovers"
set -u

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$HERE")"
PORT="${KW_PORT:-8951}"
export KW_BASE="http://127.0.0.1:$PORT"

NODE="$(command -v node || echo /opt/node22/bin/node)"
[ -x "$NODE" ] || { echo "‼️  ما انلقى node"; exit 1; }

# ما نرفع سيرفراً لو فيه واحد شغال على نفس المنفذ — ونخلّيه شغالاً بعدنا
OWN_SERVER=0
if curl -fsS -o /dev/null --max-time 2 "$KW_BASE/wordle.html" 2>/dev/null; then
  echo "‣ أستخدم السيرفر الشغّال على $PORT"
else
  ( cd "$ROOT" && python3 -m http.server "$PORT" >/dev/null 2>&1 ) &
  SERVER_PID=$!
  OWN_SERVER=1
  # ننتظره يرد بدل sleep ثابت
  for _ in $(seq 1 40); do
    curl -fsS -o /dev/null --max-time 1 "$KW_BASE/wordle.html" 2>/dev/null && break
    sleep 0.25
  done
  if ! curl -fsS -o /dev/null --max-time 2 "$KW_BASE/wordle.html" 2>/dev/null; then
    echo "‼️  السيرفر ما اشتغل على $PORT"
    kill "$SERVER_PID" 2>/dev/null
    exit 1
  fi
  echo "‣ رفعت سيرفراً على $PORT (pid $SERVER_PID)"
fi

# trap عشان السيرفر ينطفي حتى لو انقطع التشغيل بـCtrl-C
cleanup() { [ "$OWN_SERVER" = 1 ] && kill "$SERVER_PID" 2>/dev/null; }
trap cleanup EXIT INT TERM

FILTER="${1:-}"
pass=0; fail=0; failed=()

for f in "$HERE"/test_*.js; do
  name="$(basename "$f" .js)"
  [ -n "$FILTER" ] && [[ "$name" != *"$FILTER"* ]] && continue
  printf '\n──── %s ────\n' "$name"
  if "$NODE" "$f"; then
    pass=$((pass+1))
  else
    fail=$((fail+1)); failed+=("$name")
  fi
done

printf '\n════════════════════\n'
if [ "$fail" -eq 0 ]; then
  echo "✅ نجحت كلها ($pass)"
else
  echo "‼️ نجح $pass · طاح $fail"
  printf '   %s\n' "${failed[@]}"
fi
exit $((fail > 0))
