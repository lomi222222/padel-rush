// التجربة التوجيهية — تطلع للاعب الجديد أول زيارة بس.
//
// ليش تفاعلية مو نص: المجرّبون الجدد قالوا "ما فهمنا اللعبة"، وحائط الكلام
// (شاشة "طريقة اللعب") ما حلّها. هني اللاعب يكتب تخمينه بنفسه، والألوان تنشرح
// **على تخمينه هو** مو على مثال جاهز.
//
// طبقة مستقلة تُلحق بـbody زي js/howto.js تماماً، فما تدخل على قياسات شاشة
// اللعب ولا شاشة الإعداد. والتقييم يجي من Core.evaluateGuess نفسها اللي تشتغل
// باللعبة — فاللي يتعلّمه هني هو اللي بيشوفه بالضبط.
(function () {
  "use strict";

  const Core = window.WordleCore;
  const View = window.WordleView;
  if (!Core || !View) return; // صفحة ما فيها اللعبة — ما نسوي شي

  // نقرأه وقت الاستعمال مو وقت التحميل: ترتيب الوسوم بالـHTML ما يضمن إن
  // settings.js انحمّل قبلنا، ولو انقلب الترتيب يوم من الأيام ما نطيح
  const settings = () => window.WordleSettings;

  // كلمة التدريب: أربعة أحرف، شائعة، وكل حروفها موجودة بكيبورد اللعبة.
  // (الكيبورد ما فيه أ/إ/آ، فكلمات مثل "أرنب" ما تنكتب أصلاً)
  const WORD = "حصان";
  const TARGET = Array.from(WORD);
  const MAX_TRIES = 3;

  let overlay = null;
  let guesses = [];
  let currentGuess = [];
  let finished = false;
  let onDone = null;

  function legendRow(state, label, text) {
    return (
      '<div class="tutorial-legend-row">' +
      '<span class="wordle-tile ' + state + ' tutorial-legend-tile"></span>' +
      "<span><b>" + label + "</b>: " + text + "</span>" +
      "</div>"
    );
  }

  function build() {
    overlay = document.createElement("div");
    overlay.className = "howto-overlay tutorial-overlay hidden";
    overlay.innerHTML =
      '<div class="howto-card tutorial-card" role="dialog" aria-modal="true" aria-labelledby="tut-title">' +
      '<div class="howto-head">' +
      '<h2 id="tut-title">تعلَّم اللعبة في دقيقة</h2>' +
      '<button type="button" class="howto-close" aria-label="تخطّي">×</button>' +
      "</div>" +
      '<div class="howto-body tutorial-body">' +
      '<p id="tut-say" class="tutorial-say"></p>' +
      '<div id="tut-grid" class="wordle-grid tutorial-grid"></div>' +
      '<div id="tut-note" class="tutorial-note hidden"></div>' +
      '<div id="tut-keyboard" class="keyboard tutorial-keyboard"></div>' +
      "</div>" +
      '<button type="button" class="btn btn-primary btn-block tutorial-next hidden"></button>' +
      "</div>";
    document.body.appendChild(overlay);

    overlay.querySelector(".howto-close").addEventListener("click", () => finish());
    overlay.querySelector(".tutorial-next").addEventListener("click", () => finish());
  }

  const el = (id) => overlay.querySelector("#" + id);

  function say(text) {
    el("tut-say").innerHTML = text;
  }

  function drawGrid() {
    View.renderGrid(el("tut-grid"), {
      guesses: guesses,
      currentGuess: currentGuess,
      wordLength: TARGET.length,
      maxAttempts: MAX_TRIES,
      spaceIndexes: [],
    });
  }

  function drawKeyboard() {
    View.renderKeyboard(el("tut-keyboard"), {
      keyStatus: keyStatus(),
      disabled: finished,
      onKey: onKey,
    });
  }

  // نبنيها من التخمينات بدل ما نمسك حالة منفصلة — أبسط وما ينحرف
  function keyStatus() {
    const status = {};
    guesses.forEach((g) => Core.mergeKeyStatus(status, g.chars, g.statuses));
    return status;
  }

  function onKey(key) {
    if (finished) return;
    if (key === "DEL") {
      currentGuess.pop();
    } else if (key === "ENTER") {
      if (currentGuess.length < TARGET.length) {
        flashNote("أكمل الأحرف الأربعة أولاً.");
        return;
      }
      submit();
      return;
    } else if (currentGuess.length < TARGET.length) {
      currentGuess.push(key);
    }
    drawGrid();
  }

  function flashNote(text) {
    const note = el("tut-note");
    note.textContent = text;
    note.classList.remove("hidden");
    note.classList.add("warn");
    setTimeout(() => note.classList.remove("warn"), 1200);
  }

  function submit() {
    const statuses = Core.evaluateGuess(currentGuess, TARGET);
    guesses.push({ chars: currentGuess.slice(), statuses: statuses });
    const won = statuses.every((s) => s === "green");
    currentGuess = [];
    drawGrid();
    drawKeyboard();

    if (won) return step("won");
    if (guesses.length >= MAX_TRIES) return step("lost");
    step(guesses.length === 1 ? "explain" : "again");
  }

  function step(name) {
    const note = el("tut-note");
    note.classList.add("hidden");

    if (name === "start") {
      say("الكلمة السرية مكوّنة من <b>أربعة أحرف</b>. اكتب أي كلمة من أربعة أحرف ثم اضغط «إدخال»، ولا تقلق إن كانت خاطئة — الخطأ هو ما يدلّك على الإجابة.");
      return;
    }

    if (name === "explain") {
      // نشرح الألوان اللي طلعت على تخمينه هو، فالشرح يصير ملموساً مو نظرياً
      const got = new Set(guesses[0].statuses);
      let lines = "";
      if (got.has("green")) lines += legendRow("green", "الأخضر", "الحرف صحيح، وموضعه صحيح.");
      if (got.has("yellow")) lines += legendRow("yellow", "الأصفر", "الحرف موجود في الكلمة، لكن في موضع آخر.");
      if (got.has("gray")) lines += legendRow("gray", "الرمادي", "الحرف غير موجود في الكلمة إطلاقاً.");
      note.innerHTML = lines;
      note.classList.remove("hidden");
      say("انظر إلى ألوان محاولتك:");
      return;
    }

    if (name === "again") {
      say("استعن بالألوان وحاول مرة أخرى.");
      return;
    }

    if (name === "won" || name === "lost") {
      finished = true;
      drawKeyboard();
      if (name === "won") {
        say("أحسنت! الكلمة هي <b>" + WORD + "</b>. هذه هي اللعبة كلها.");
        if (View.celebrateWin) View.celebrateWin();
      } else {
        say("الكلمة كانت <b>" + WORD + "</b>. لا بأس — في اللعبة تحصل على محاولات أكثر كلما طالت الكلمة.");
      }
      note.innerHTML =
        "<p>وفي اللعبة الحقيقية تجد أيضاً:</p>" +
        '<ul class="howto-list">' +
        "<li><b>ثلاث مساعدات</b> تكشف لك شيئاً عن الكلمة مقابل خصم من نقاطك.</li>" +
        "<li><b>رقم ذهبي</b> بجانب عدد المحاولات يبيّن النقاط التي ستحصل عليها إن أصبت الآن.</li>" +
        "<li><b>البوق</b>: يستطيع الفريق المنتظر مقاطعة دور خصمه ومحاولة خطف الكلمة مرة واحدة.</li>" +
        "</ul>" +
        '<p class="muted">تجد الشرح كاملاً في أي وقت من زر «؟» في الأعلى.</p>';
      note.classList.remove("hidden");
      const next = overlay.querySelector(".tutorial-next");
      next.textContent = "ابدأ اللعب";
      next.classList.remove("hidden");
      return;
    }
  }

  function finish() {
    overlay.classList.add("hidden");
    const st = settings();
    if (st) st.markTutorialSeen();
    if (typeof onDone === "function") {
      const cb = onDone;
      onDone = null;
      cb();
    }
  }

  function open(done) {
    if (!overlay) build();
    onDone = done || null;
    guesses = [];
    currentGuess = [];
    finished = false;
    overlay.querySelector(".tutorial-next").classList.add("hidden");
    overlay.classList.remove("hidden");
    step("start");
    drawGrid();
    drawKeyboard();
  }

  // تطلع تلقائياً أول زيارة بس
  function openIfFirstVisit() {
    const st = settings();
    if (st && st.tutorialSeen()) return false;
    open();
    return true;
  }

  window.WordleTutorial = { open, openIfFirstVisit };

  document.addEventListener("DOMContentLoaded", openIfFirstVisit);
})();
