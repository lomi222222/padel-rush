// الوضع المحلي (جهاز واحد) للعبة "صيد الكلمة".
// المنطق المشترك في js/wordle-core.js والرسم المشترك في js/wordle-view.js — هذا الملف
// متحكّم الوضع المحلي فقط.
(function () {
  "use strict";

  const Core = window.WordleCore;
  const View = window.WordleView;
  const Settings = window.WordleSettings;

  // ===== حالة الفريقين =====
  let teams = [];
  let teamIndex = 0;
  let roundsPlayed = [0, 0];
  let matchOver = false;
  let selectedCategories =
    (Settings && Settings.loadCategories(Core.ALL_CATEGORIES)) || new Set(Core.SELECTABLE_CATEGORIES);
  let wordBag = Core.makeWordBag(selectedCategories);
  let roundsPerTeam = Core.DEFAULT_ROUNDS;
  let boqLeft = [Core.boqForRounds(roundsPerTeam), Core.boqForRounds(roundsPerTeam)];
  let roundSeconds = 0;

  // ===== حالة الجولة الحالية =====
  let target = "";
  let targetChars = [];
  let spaceIndexes = [];
  let wordLength = 5;
  let maxAttempts = 6;
  let category = "";
  let currentGuess = [];
  // موضع الكتابة الحالي بالصف. اللاعب يحرّكه بضغط أي خانة
  let cursor = 0;
  let guesses = [];
  let gameOver = false;
  let keyStatus = {};
  let hints = Core.newHints();
  let hintLog = [];
  // خريطة {موضع: حرف} من تلميح "حرف موجود" بعد ما يتأكد موضعه — تتصفّر كل جولة
  let hintedLetters = {};
  // السرقة (البوق): null أو { team, attemptsLeft, value }
  let steal = null;
  let deadline = null; // ختم زمني مطلق لنهاية الجولة، أو null بدون وقت
  let pausedRemainingMs = null; // المتبقي وقت إيقاف المؤقّت أثناء السرقة
  let tickTimer = null;

  // ===== عناصر DOM =====
  const setupScreen = document.getElementById("wordle-setup-screen");
  const playScreen = document.getElementById("wordle-play-screen");
  const endScreen = document.getElementById("wordle-end-screen");
  const team1Input = document.getElementById("wordle-team1-input");
  const team2Input = document.getElementById("wordle-team2-input");
  const startBtn = document.getElementById("wordle-start-btn");

  const scoreboardEl = document.getElementById("wordle-scoreboard");
  const subtitleEl = document.getElementById("wordle-subtitle");
  const attemptsEl = document.getElementById("wordle-attempts");
  const pointsEl = document.getElementById("wordle-points");
  const activeCategoriesEl = document.getElementById("wordle-active-categories");
  const gridEl = document.getElementById("wordle-grid");
  const messageEl = document.getElementById("wordle-message");
  const keyboardEl = document.getElementById("keyboard");
  const hintLogEl = document.getElementById("wordle-hint-log");
  const hintCategoryBtn = document.getElementById("wordle-hint-category-btn");
  const hintRepeatBtn = document.getElementById("wordle-hint-repeat-btn");
  const hintLetterBtn = document.getElementById("wordle-hint-letter-btn");
  const hintLogBtn = document.getElementById("wordle-hintlog-btn");
  const hintLogCountEl = document.getElementById("wordle-hintlog-count");
  const roundEndEl = document.getElementById("wordle-round-end");
  const nextTeamBtn = document.getElementById("wordle-next-team-btn");
  const endMatchBtn = document.getElementById("wordle-end-match-btn");
  const scoreEditBtn = document.getElementById("wordle-score-edit-btn");
  const homeLink = document.querySelector(".topbar .home-link");
  const catAllCheckbox = document.getElementById("wordle-cat-all");
  const catListEl = document.getElementById("wordle-category-list");
  const catErrorEl = document.getElementById("wordle-category-error");
  const roundCountSelect = document.getElementById("wordle-round-count");
  const roundTimeSelect = document.getElementById("wordle-round-time");
  const roundTimeCustom = document.getElementById("wordle-round-time-custom");
  const roundTimeHint = document.getElementById("wordle-round-time-hint");
  const timerEl = document.getElementById("wordle-timer");
  const boqBtn = document.getElementById("wordle-boq-btn");
  const stealNoteEl = document.getElementById("wordle-steal-note");

  // ===== اختيار الفئات =====
  function renderCategoryChecklist() {
    View.renderCategoryChecklist(catListEl, selectedCategories, (next) => {
      selectedCategories = next;
      syncAllCheckbox();
      renderCategoryChecklist();
    });
  }

  function syncAllCheckbox() {
    catAllCheckbox.checked =
      selectedCategories.size === Core.SELECTABLE_CATEGORIES.length && !Core.hasExclusive(selectedCategories);
  }

  catAllCheckbox.addEventListener("change", () => {
    selectedCategories = new Set(catAllCheckbox.checked ? Core.SELECTABLE_CATEGORIES : []);
    wordBag = Core.makeWordBag(selectedCategories);
    renderCategoryChecklist();
  });

  syncAllCheckbox(); // الفئات المسترجعة ممكن تكون غير "الكل" — نطابق شكل الدقّة قبل أول رسم
  renderCategoryChecklist();

  // ===== عدد الجولات =====
  const savedRoundCount = Settings
    ? Settings.loadRoundCount(Core.ROUND_COUNT_OPTIONS, Core.DEFAULT_ROUNDS)
    : Core.DEFAULT_ROUNDS;
  Core.ROUND_COUNT_OPTIONS.forEach((n) => {
    const o = document.createElement("option");
    o.value = String(n);
    o.textContent = Core.roundCountLabel(n);
    roundCountSelect.appendChild(o);
  });
  // نحدد القيمة بعد ما تنضاف كل الخيارات (أثبت من selected أثناء الإنشاء)
  roundCountSelect.value = String(savedRoundCount);

  // ===== مدة الجولة =====
  Core.ROUND_TIME_OPTIONS.forEach((opt) => {
    const o = document.createElement("option");
    o.value = String(opt.value);
    o.textContent = opt.label;
    roundTimeSelect.appendChild(o);
  });

  function syncRoundTimeCustomVisibility() {
    const custom = Number(roundTimeSelect.value) === Core.CUSTOM_TIME;
    roundTimeCustom.classList.toggle("hidden", !custom);
    roundTimeHint.classList.toggle("hidden", !custom);
    return custom;
  }

  if (Settings) {
    const savedTime = Settings.loadRoundTime();
    const validValue = Core.ROUND_TIME_OPTIONS.some((o) => String(o.value) === savedTime.value);
    if (validValue) {
      roundTimeSelect.value = savedTime.value;
      if (syncRoundTimeCustomVisibility() && savedTime.customMinutes) {
        roundTimeCustom.value = savedTime.customMinutes;
      }
    }
  }

  roundTimeSelect.addEventListener("change", () => {
    if (syncRoundTimeCustomVisibility()) roundTimeCustom.focus();
  });

  // ===== إعداد الفريقين =====
  startBtn.addEventListener("click", () => {
    if (selectedCategories.size === 0) {
      catErrorEl.textContent = "اختر فئة واحدة على الأقل قبل البدء";
      catErrorEl.classList.remove("hidden");
      return;
    }
    catErrorEl.classList.add("hidden");
    wordBag = Core.makeWordBag(selectedCategories);
    wordBag.refill();
    roundSeconds = Core.readRoundSeconds(roundTimeSelect, roundTimeCustom);
    roundsPerTeam = Number(roundCountSelect.value) || Core.DEFAULT_ROUNDS;
    if (Settings) {
      Settings.saveRoundCount(roundsPerTeam);
      Settings.saveRoundTime(roundTimeSelect.value, roundTimeCustom.value);
      Settings.saveCategories(selectedCategories);
    }
    // البوق يتوسّع مع عدد الجولات عشان يظل معناه ثابتاً — شوف boqForRounds
    boqLeft = [Core.boqForRounds(roundsPerTeam), Core.boqForRounds(roundsPerTeam)];

    teams = [
      { name: team1Input.value.trim() || Core.defaultTeamName(0), color: Core.TEAM_COLORS[0], score: 0 },
      { name: team2Input.value.trim() || Core.defaultTeamName(1), color: Core.TEAM_COLORS[1], score: 0 },
    ];
    teamIndex = 0;
    roundsPlayed = [0, 0];
    matchOver = false;
    target = "";
    setupScreen.classList.add("hidden");
    playScreen.classList.remove("hidden");
    endScreen.classList.add("hidden");
    syncTopbar(true);
    renderScoreboard();
    startRound();
  });

  // الشريط العلوي يعرض واحداً بس: "إنهاء اللعبة" وأنت تلعب، ورابط "القائمة
  // الرئيسية" بغير ذلك. اجتماعهما كان تكراراً بلا فايدة — وشيل الرابط لحاله كان
  // بيحبس اللاعب داخل اللعبة، فشاشة النتائج فيها زر للرئيسية
  function syncTopbar(playing) {
    endMatchBtn.classList.toggle("hidden", !playing);
    if (homeLink) homeLink.classList.toggle("hidden", playing);
  }

  function renderScoreboard() {
    View.renderScoreboard(scoreboardEl, { teams, teamIndex, onAdjust: adjustScore });
  }

  function adjustScore(i, delta) {
    teams[i].score = Math.max(0, teams[i].score + delta);
    renderScoreboard();
  }

  function renderGrid() {
    View.renderGrid(gridEl, {
      guesses,
      currentGuess,
      wordLength,
      maxAttempts,
      spaceIndexes,
      hintedLetters,
      stealActive: !!steal,
      cursor,
      onTileTap: moveCursorTo,
    });
  }

  // الفريق اللي ينتظر دوره — هو اللي يحق له البوق
  function waitingTeam() {
    return (teamIndex + 1) % 2;
  }

  // عدد محاولات الفريق الأصلي (بدون صفوف السرقة)
  function ownAttemptCount() {
    return guesses.filter((g) => !g.steal).length;
  }

  function updateBoqUi() {
    if (gameOver || matchOver) {
      boqBtn.classList.add("hidden");
      stealNoteEl.classList.add("hidden");
      return;
    }
    if (steal) {
      boqBtn.classList.add("hidden");
      stealNoteEl.classList.remove("hidden");
      stealNoteEl.textContent =
        "🥷 بوق! دور " +
        teams[steal.team].name +
        " — " +
        Core.stealAttemptsLabel(steal.attemptsLeft) +
        " على " +
        Core.toArabicDigits(steal.value) +
        " نقطة";
      return;
    }
    stealNoteEl.classList.add("hidden");
    const w = waitingTeam();
    boqBtn.classList.remove("hidden");
    boqBtn.disabled = boqLeft[w] <= 0;
    View.setIconLabel(
      boqBtn,
      "thief",
      "بوق — " + teams[w].name + " (باقي " + Core.toArabicDigits(boqLeft[w]) + ")"
    );
  }

  // ===== المؤقّت =====
  function stopTicking() {
    clearInterval(tickTimer);
    tickTimer = null;
  }

  function startTicking() {
    stopTicking();
    if (!deadline) return;
    tickTimer = setInterval(() => {
      View.renderTimer(timerEl, deadline, pausedRemainingMs);
      if (pausedRemainingMs == null && deadline && Date.now() >= deadline) {
        stopTicking();
        timeUp();
      }
    }, 250);
  }

  function pauseTimer() {
    if (!deadline) return;
    pausedRemainingMs = Math.max(0, deadline - Date.now());
    View.renderTimer(timerEl, deadline, pausedRemainingMs);
  }

  function resumeTimer() {
    if (!deadline || pausedRemainingMs == null) return;
    deadline = Date.now() + pausedRemainingMs;
    pausedRemainingMs = null;
    View.renderTimer(timerEl, deadline, null);
  }

  function timeUp() {
    if (gameOver) return;
    gameOver = true;
    steal = null;
    showMessage("⏰ انتهى الوقت! الكلمة كانت: " + target + " (٠ نقطة)", "lose");
    updateHintButtons();
    updateBoqUi();
    renderKeyboard();
    resolveRoundEnd();
  }

  function renderKeyboard() {
    View.renderKeyboard(keyboardEl, { keyStatus, onKey: handleKey });
  }

  function applyTileSize() {
    View.applyTileSize(gridEl, {
      // maxAttempts مو totalRows(): صفوف السرقة تنضاف فوق العدد الأصلي، ولو حسبنا
      // المقاس عليها تصغر الخلايا فجأة وسط الجولة. المقاس يثبت والصفوف الزايدة
      // تنمرّر داخل صندوق الشبكة
      wordLength,
      maxAttempts,
      spaceCount: spaceIndexes.length,
    });
  }

  boqBtn.addEventListener("click", () => {
    if (gameOver || steal) return;
    const w = waitingTeam();
    if (boqLeft[w] <= 0) return;

    boqLeft[w]--;
    // القيمة تتثبّت الحين: نفس النقاط اللي كان بياخذها الفريق الأصلي لو حزر بهاللحظة
    steal = {
      team: w,
      attemptsLeft: Core.BOQ_ATTEMPTS,
      value: Core.finalScoreForAttempt(ownAttemptCount() + 1, maxAttempts, hints),
    };
    currentGuess = Core.makeGuessBuffer(wordLength, spaceIndexes);
    cursor = Core.firstWritable(currentGuess, spaceIndexes);
    pauseTimer();
    showMessage("", "");
    updateHintButtons();
    updateBoqUi();
    // بدون applyTileSize: المقاس يثبت طول الجولة (شوف wordle-view.js)
    renderGrid();
  });

  function showMessage(text, kind) {
    View.showMessage(messageEl, text, kind);
  }

  function logHint(text) {
    hintLog.push(text);
    View.renderHintLog(hintLogEl, hintLog);
    syncHintLogBtn(hintLog);
  }

  function startRound() {
    const entry = wordBag.pick(target);
    target = entry.word;
    category = entry.category;
    targetChars = Array.from(target);
    spaceIndexes = Core.spaceIndexesOf(targetChars);
    wordLength = targetChars.length;
    maxAttempts = Core.attemptsForLength(wordLength);

    currentGuess = [];
    guesses = [];
    gameOver = false;
    keyStatus = {};
    hints = Core.newHints();
    hintLog = [];
    hintedLetters = {};
    steal = null;
    pausedRemainingMs = null;
    deadline = roundSeconds ? Date.now() + roundSeconds * 1000 : null;
    currentGuess = Core.makeGuessBuffer(wordLength, spaceIndexes);
    cursor = Core.firstWritable(currentGuess, spaceIndexes);
    View.renderTimer(timerEl, deadline, null);
    startTicking();
    updateBoqUi();

    View.renderRoundLine(
      subtitleEl,
      attemptsEl,
      Core.roundSubtitle(
        teams[teamIndex].name,
        roundsPlayed[teamIndex] + 1,
        wordLength,
        maxAttempts,
        spaceIndexes,
        roundsPerTeam
      )
    );
    View.renderCategoryPills(activeCategoriesEl, selectedCategories);
    showMessage("", "");
    View.renderHintLog(hintLogEl, hintLog);
    syncHintLogBtn(hintLog);
    roundEndEl.classList.add("hidden");
    updateHintButtons();

    applyTileSize();
    renderGrid();
    renderKeyboard();
    renderScoreboard();
  }

  // ننقل صف المساعدات نفسه جوّه النافذة — نفس العناصر والـid، فـupdateHintButtons
  // تشتغل عليها مثل ما كانت بالضبط
  // ===== سجل التلميحات بنافذة منبثقة =====
  // صناديق السجل كانت تاكل لين ٩٢ بكسل من عمود المعلومات أول ما يستخدم اللاعب
  // المساعدات، فتنسحق الشبكة. ننقل السجل نفسه (بنفس الـid والعناصر) جوّه نافذة،
  // فـView.renderHintLog تشتغل عليه مثل ما كانت بالضبط.
  const hintLogPopover = View.createPopover(hintLogBtn, null, {
    placeBelow: document.querySelector("#wordle-play-screen .wordle-info"),
  });
  hintLogPopover.panel.appendChild(hintLogEl);

  // نفتحها تلقائياً أول ما يدخل تلميح جديد: اللاعب دفع نقاطاً مقابل هالمعلومة،
  // فإخفاؤها لحظة شرائها أسوأ من الوضع القديم. الفتح معلّق على **زيادة العدد**
  // مو على كل إعادة رسم، وإلا بالأونلاين تنفتح مع كل تحديث حالة من فايربيس
  let lastHintCount = 0;
  function syncHintLogBtn(entries) {
    const n = (entries || []).length;
    hintLogBtn.classList.toggle("hidden", n === 0);
    hintLogCountEl.textContent = "التلميحات " + Core.toArabicDigits(n);
    if (n > lastHintCount) hintLogPopover.open();
    else if (n === 0) hintLogPopover.close();
    lastHintCount = n;
  }

  // كم نقطة بياخذها لو حزرها الحين. ينخفي بعد نهاية الجولة عشان ما يزاحم رسالة
  // الفوز اللي فيها الرقم المقبوض فعلاً
  function renderPoints() {
    if (gameOver) {
      pointsEl.textContent = "";
      return;
    }
    pointsEl.textContent = Core.potentialScoreLabel({
      attemptsMade: ownAttemptCount(),
      maxAttempts: maxAttempts,
      hints: hints,
      steal: steal,
    });
  }

  // تنادى بعد كل مساعدة وكل محاولة وعند بداية/نهاية السرقة، فهي المكان الطبيعي
  // اللي يخلي رقم النقاط متزامن مع حالة المساعدات
  function updateHintButtons() {
    // أثناء السرقة ما فيه تلميحات — محاولتين وبس
    hintCategoryBtn.disabled = gameOver || !!steal || hints.categoryUsed;
    hintRepeatBtn.disabled = gameOver || !!steal || hints.repeatUsed;

    // «اكشف حرف» تتكرر لحد MAX_REVEAL_LETTER_USES، وبعدها الزر ينقفل.
    // ما نكتب الباقي على الزر عمداً: الثلاثة لازم يقعدون بسطر واحد (شوف
    // .wordle-info .ability-btn بالـCSS)، وأي حرفين زيادة يلفّون السطر على
    // ٣٧٥ بكسل وياكلون ~٣٠ بكسل من ارتفاع الشبكة
    hintLetterBtn.disabled =
      gameOver ||
      !!steal ||
      Core.revealLetterUsesLeft(hints) === 0 ||
      Core.allLettersKnown(targetChars, keyStatus);

    renderPoints();
  }

  hintCategoryBtn.addEventListener("click", () => {
    if (hintCategoryBtn.disabled) return;
    hints.categoryUsed = true;
    logHint("الفئة: " + category);
    updateHintButtons();
  });

  hintRepeatBtn.addEventListener("click", () => {
    if (hintRepeatBtn.disabled) return;
    hints.repeatUsed = true;
    logHint(Core.repeatHintText(targetChars));
    updateHintButtons();
  });

  hintLetterBtn.addEventListener("click", () => {
    if (hintLetterBtn.disabled) return;

    const hint = Core.revealLetterHint(targetChars, keyStatus);
    if (!hint) return;

    hints.revealLetterUses++;
    keyStatus[hint.letter] = hint.status;
    logHint(hint.text);

    // "حرف موجود" الأخضر معناه موضعه معروف — نعرضه كطيف باهت بمربعه. ما ننكتبه
    // بالتخمين: اللاعب حر يكتبه أو يكتب غيره أو يتجاهله
    if (hint.status === "green" && typeof hint.pos === "number") {
      hintedLetters[hint.pos] = hint.letter;
      renderGrid();
    }

    renderKeyboard();
    updateHintButtons();
  });

  function handleKey(key) {
    if (gameOver) return;

    if (key === "ENTER") {
      submitGuess();
      return;
    }
    // المسح عند المؤشر: لو خانته فيها حرف تنفرّغ ويبقى مكانه، وإلا يرجع للسابق
    // ويفرّغها — نفس سلوك أي حقل كتابة
    if (key === "DEL") {
      if (currentGuess[cursor]) {
        Core.clearAt(currentGuess, cursor, spaceIndexes);
      } else {
        const back = Core.prevWritable(currentGuess, cursor, spaceIndexes);
        if (back >= 0) {
          Core.clearAt(currentGuess, back, spaceIndexes);
          cursor = back;
        }
      }
      renderGrid();
      return;
    }
    if (Core.ARABIC_LETTER_RE.test(key) && cursor >= 0) {
      Core.writeAt(currentGuess, cursor, key, spaceIndexes);
      // المؤشر يقفز لأول فاضية بعده. على صف فاضي هذي هي الخانة التالية مباشرة،
      // فالكتابة بالترتيب تظل تحس نفسها بالضبط
      const next = Core.nextEmpty(currentGuess, cursor + 1, spaceIndexes);
      if (next >= 0) cursor = next;
      renderGrid();
    }
  }

  // ضغط خانة بالصف الحالي — نقطة دخول الميزة. خانات المسافات مستثناة
  function moveCursorTo(col) {
    if (gameOver || spaceIndexes.includes(col)) return;
    cursor = col;
    renderGrid();
  }

  function submitGuess() {
    if (!Core.isGuessComplete(currentGuess, spaceIndexes)) {
      showMessage("أدخل " + Core.toArabicDigits(wordLength) + " أحرف أولاً", "");
      return;
    }

    const statuses = Core.evaluateGuess(currentGuess, targetChars);
    const attemptNumber = ownAttemptCount() + 1;
    guesses.push({ chars: currentGuess.slice(), statuses, steal: !!steal });
    Core.mergeKeyStatus(keyStatus, currentGuess, statuses);

    const won = statuses.every((s) => s === "green");
    currentGuess = Core.makeGuessBuffer(wordLength, spaceIndexes);
    cursor = Core.firstWritable(currentGuess, spaceIndexes);
    renderGrid();
    renderKeyboard();
    updateHintButtons();

    // ===== مسار السرقة (البوق) =====
    if (steal) {
      if (won) {
        gameOver = true;
        const stealingTeam = steal.team;
        const earned = steal.value;
        teams[stealingTeam].score += earned;
        showMessage(
          "🥷 سرقها " + teams[stealingTeam].name + "! ربحوا " + Core.toArabicDigits(earned) + " نقطة",
          "win"
        );
        steal = null;
        stopTicking();
        renderScoreboard();
        updateHintButtons();
        updateBoqUi();
        resolveRoundEnd();
        return;
      }

      steal.attemptsLeft--;
      if (steal.attemptsLeft > 0) {
        showMessage("🥷 باقي محاولة وحدة للسرقة", "");
        updateBoqUi();
        return;
      }

      // فشلت السرقة: ينحرق البوق ويكمل الفريق الأصلي محاولاته كاملة
      steal = null;
      resumeTimer();
      showMessage("🥷 راحت عليهم! يكمل " + teams[teamIndex].name, "");
      updateHintButtons();
      updateBoqUi();
      // نعيد رسم الشبكة عشان الإطار الذهبي ما يظل على الصف الحالي بعد نهاية السرقة
      renderGrid();
      renderKeyboard();
      return;
    }

    if (won) {
      gameOver = true;
      const earned = Core.finalScoreForAttempt(attemptNumber, maxAttempts, hints);
      teams[teamIndex].score += earned;
      showMessage(
        "🎉 أحسنت يا " + teams[teamIndex].name + "! ربحتوا " + Core.toArabicDigits(earned) + " نقطة",
        "win"
      );
      stopTicking();
      renderScoreboard();
      updateHintButtons();
      updateBoqUi();
      resolveRoundEnd();
      return;
    }

    if (ownAttemptCount() >= maxAttempts) {
      gameOver = true;
      showMessage("😔 انتهت المحاولات! الكلمة كانت: " + target + " (٠ نقطة)", "lose");
      stopTicking();
      updateHintButtons();
      updateBoqUi();
      resolveRoundEnd();
      return;
    }

    showMessage("", "");
  }

  // تحسب نهاية الجولة، وتقرر هل انتهت المباراة (كل فريق لعب 5 جولات) أو لسه في دور تالي
  function resolveRoundEnd() {
    stopTicking();
    View.renderTimer(timerEl, null, null);
    roundsPlayed[teamIndex]++;
    matchOver = roundsPlayed.every((r) => r >= roundsPerTeam);
    View.setIconLabel(
      nextTeamBtn,
      matchOver ? "trophy" : "next",
      matchOver ? "عرض النتيجة النهائية" : "دور الفريق التالي"
    );
    roundEndEl.classList.remove("hidden");
  }

  document.addEventListener("keydown", (e) => {
    if (gameOver || playScreen.classList.contains("hidden")) return;
    if (e.key === "Enter") {
      handleKey("ENTER");
    } else if (e.key === "Backspace") {
      handleKey("DEL");
    } else if (e.key === " ") {
      e.preventDefault();
    } else if (Core.ARABIC_LETTER_RE.test(e.key)) {
      handleKey(e.key);
    }
  });

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(applyTileSize, 120);
  });

  nextTeamBtn.addEventListener("click", () => {
    if (matchOver) {
      showEndScreen();
      return;
    }
    teamIndex = (teamIndex + 1) % teams.length;
    startRound();
  });

  endMatchBtn.addEventListener("click", showEndScreen);

  function showEndScreen() {
    stopTicking();
    playScreen.classList.add("hidden");
    endScreen.classList.remove("hidden");
    syncTopbar(false);

    View.renderFinalScores(
      {
        winnerName: document.getElementById("wordle-winner-name"),
        winnerScore: document.getElementById("wordle-winner-score"),
        finalScores: document.getElementById("wordle-final-scores"),
      },
      teams
    );
    View.celebrateWin();
  }

  // أزرار ±٢٥ مخفية لين يطلبها اللاعب — CSS يتكفّل بالإظهار عبر كلاس editing
  scoreEditBtn.addEventListener("click", () => {
    const on = scoreboardEl.classList.toggle("editing");
    scoreEditBtn.setAttribute("aria-pressed", on ? "true" : "false");
  });

  document.getElementById("wordle-restart-btn").addEventListener("click", () => {
    endScreen.classList.add("hidden");
    setupScreen.classList.remove("hidden");
    syncTopbar(false);
    team1Input.value = "";
    team2Input.value = "";
  });
})();
