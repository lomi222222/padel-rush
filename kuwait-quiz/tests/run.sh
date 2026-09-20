#!/usr/bin/env bash
# يشغّل كل اختبارات اللعبة: يرفع سيرفراً ثابتاً، يمر على test_*.js، ويطفّيه بعدها.
#
#   bash kuwait-quiz/tests/run.sh              كل الاختبارات
#   bash kuwait-quiz/tests/run.sh popovers     الاختبارات اللي اسمها فيه "popovers"
#   KW_JOBS=1 bash kuwait-quiz/tests/run.sh    تسلسلي بمخرجات مباشرة (للتشخيص)
#
# التوازي: كل اختبار يفتح متصفحه بملف تعريف منفصل، فـlocalStorage معزول بينهم
# والسيرفر للقراءة بس — يعني ما فيه تداخل حالة. الي يتداخل هو **المخرجات**،
# لهذا نخزّن مخرجات كل اختبار بملف ونطبعها بالترتيب بعدين.
#
# لو طاح اختبار بالتوازي وما طاح بـKW_JOBS=1 فهو تقلّب من التزاحم مو علّة —
# نزّل KW_JOBS. الطقم المتقلّب أسوأ من البطيء لأنك تبطّل تثق فيه.
set -u

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$HERE")"
PORT="${KW_PORT:-8951}"
JOBS="${KW_JOBS:-4}"
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

OUTDIR="$(mktemp -d)"
# trap عشان السيرفر ينطفي حتى لو انقطع التشغيل بـCtrl-C
cleanup() {
  [ "$OWN_SERVER" = 1 ] && kill "$SERVER_PID" 2>/dev/null
  rm -rf "$OUTDIR"
}
trap cleanup EXIT INT TERM

FILTER="${1:-}"
FILES=()
for f in "$HERE"/test_*.js; do
  name="$(basename "$f" .js)"
  [ -n "$FILTER" ] && [[ "$name" != *"$FILTER"* ]] && continue
  FILES+=("$f")
done

pass=0; fail=0; failed=()

if [ "$JOBS" = 1 ]; then
  # تسلسلي بمخرجات مباشرة: أسهل بالتشخيص لأنك تشوف وين وقف
  for f in "${FILES[@]}"; do
    name="$(basename "$f" .js)"
    printf '\n──── %s ────\n' "$name"
    if "$NODE" "$f"; then
      pass=$((pass+1))
    else
      fail=$((fail+1)); failed+=("$name")
    fi
  done
else
  echo "‣ بالتوازي: $JOBS بالمرة"
  # سيرفر الملفات وظيفة خلفية هو بعد، وما ينتهي أبداً. فلو عددنا الوظائف بـjobs
  # أو انتظرنا بـwait المجرّد راح ناخذ منه خانة من السقف، والأسوأ: wait بالنهاية
  # يعلّق للأبد ننتظر سيرفراً ما راح يخلص. نمسك أرقام عمليات الاختبارات وحدها
  PIDS=()
  running() {
    local n=0 p
    for p in $(jobs -rp); do
      [ "${OWN_SERVER:-0}" = 1 ] && [ "$p" = "${SERVER_PID:-}" ] && continue
      n=$((n+1))
    done
    printf '%s' "$n"
  }
  for f in "${FILES[@]}"; do
    name="$(basename "$f" .js)"
    while [ "$(running)" -ge "$JOBS" ]; do wait -n; done
    (
      if "$NODE" "$f" > "$OUTDIR/$name.out" 2>&1; then
        echo ok > "$OUTDIR/$name.status"; printf '   ✅ %s\n' "$name"
      else
        echo fail > "$OUTDIR/$name.status"; printf '   ‼️ %s\n' "$name"
      fi
    ) &
    PIDS+=($!)
  done
  for p in "${PIDS[@]}"; do wait "$p" 2>/dev/null; done

  # نطبع بترتيب الملفات مو بترتيب الانتهاء — عشان السجل يكون ثابتاً وقابلاً للمقارنة
  for f in "${FILES[@]}"; do
    name="$(basename "$f" .js)"
    printf '\n──── %s ────\n' "$name"
    cat "$OUTDIR/$name.out" 2>/dev/null
    if [ "$(cat "$OUTDIR/$name.status" 2>/dev/null)" = ok ]; then
      pass=$((pass+1))
    else
      fail=$((fail+1)); failed+=("$name")
    fi
  done
fi

printf '\n════════════════════\n'
if [ "$fail" -eq 0 ]; then
  echo "✅ نجحت كلها ($pass)"
else
  echo "‼️ نجح $pass · طاح $fail"
  printf '   %s\n' "${failed[@]}"
fi
exit $((fail > 0))
