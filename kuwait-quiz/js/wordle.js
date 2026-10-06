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
  // الفئات تبدأ فاضية دايماً — قرار صاحب المشروع: اللاعب يختار بنفسه كل مرة،
  // حتى لو لعب قبل (كنا نرجّع آخر اختيار، وانشال)
  let selectedCategories = new Set();
  let wordBag = Core.makeWordBag(selectedCategories);
  let roundsPerTeam = Core.DEFAULT_ROUNDS;
  let boqLeft = [Core.boqForRounds(roundsPerTeam), Core.boqForRounds(roundsPerTeam)];
  // العدد اللي بدأنا فيه — نميّز بيه «البوق مطفّي» (صفر من البداية) عن «خلصت
  // بوقاتك» (صفر بعد استخدام). الأول يخفي الزر، والثاني يعطّله ويبيّن ٠
  let boqPerTeam = boqLeft[0];
  // «غيّر السؤال» الباقي لكل فريق — مرة باللعبة كلها
  let changeLeft = [Core.CHANGE_WORD_PER_MATCH, Core.CHANGE_WORD_PER_MATCH];
  let roundSeconds = 0;

  // ===== حالة الجولة الحالية =====
  let target = "";
  let targetChars = [];
  let spaceIndexes = [];
  let wordLength = 5;
  let maxAttempts = 6;
  // محاولات انصرفت على كلمة قبل «غيّر السؤال» — صفوفها انمسحت بس تظل محسوبة
  // بالنقاط وبحد المحاولات. شوف Core.attemptsMade
  let attemptOffset = 0;
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
  // السرقة: null أو { team, attemptsLeft, value, rebound? }. البوق والفرصة الأخيرة
  // نفس الآلة (محاولة للخصم بقيمة ثابتة) — الفرق إن الفرصة تبدأ لحالها لما يفشل
  // الفريق، ولو فشلت تنتهي الجولة بدل ما يرجع الدور
  let steal = null;
  let deadline = null; // ختم زمني مطلق لنهاية الجولة، أو null بدون وقت
  let pausedRemainingMs = null; // المتبقي وقت إيقاف المؤقّت أثناء السرقة
  let tickTimer = null;

  // ===== حفظ المباراة =====
  // صاحب المشروع: لو طلع من اللعبة (أو سكّر الجوال) ورد، يلقى المباراة مثل ما
  // تركها — ما تنمسح إلا لما تخلص أو يضغط «إنهاء اللعبة». كل الحالة تنكتب
  // بـlocalStorage بعد أي تغيير (الرسم هو اللي ينادي save)، وتنقرى عند الفتح.
  // SAVE_SCHEMA يرتفع لو تغيّر شكل اللقطة: لقطة بشكل قديم تنرمى بدل ما تكسر الصفحة
  const SAVE_KEY = "kw-local-match";
  const SAVE_SCHEMA = 1;
  let matchActive = false;

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
  const boqCountSelect = document.getElementById("wordle-boq-count");
  const roundCountSelect = document.getElementById("wordle-round-count");
  const roundTimeSelect = document.getElementById("wordle-round-time");
  const roundTimeCustom = document.getElementById("wordle-round-time-custom");
  const roundTimeHint = document.getElementById("wordle-round-time-hint");
  const timerEl = document.getElementById("wordle-timer");
  const boqBtn = document.getElementById("wordle-boq-btn");
  const changeBtn = document.getElementById("wordle-change-btn");
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

  syncAllCheckbox(); // نطابق «الكل» مع الاختيار الفعلي قبل أول رسم (يبدأ فاضي)
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

  // عدد البوق: «تلقائي» أولاً عشان يظل الافتراضي، ثم الأرقام الصريحة
  const boqValues = [Core.BOQ_AUTO].concat(Core.BOQ_COUNT_OPTIONS.map(String));
  boqValues.forEach((v) => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = Core.boqCountLabel(v);
    boqCountSelect.appendChild(o);
  });
  boqCountSelect.value = Settings
    ? Settings.loadBoqCount(boqValues, Core.BOQ_AUTO)
    : Core.BOQ_AUTO;

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
      Settings.saveBoqCount(boqCountSelect.value);
      Settings.saveRoundTime(roundTimeSelect.value, roundTimeCustom.value);
    }
    // «تلقائي» يتوسّع مع عدد الجولات عشان يظل معنى البوق ثابتاً — شوف
    // boqForRounds؛ وإلا ناخذ رقم الهوست كما هو (والصفر يقفل البوق تماماً)
    const boqs = Core.resolveBoqCount(boqCountSelect.value, roundsPerTeam);
    boqLeft = [boqs, boqs];
    boqPerTeam = boqs;
    changeLeft = [Core.CHANGE_WORD_PER_MATCH, Core.CHANGE_WORD_PER_MATCH];

    teams = [
      { name: team1Input.value.trim() || Core.defaultTeamName(0), color: Core.TEAM_COLORS[0], score: 0 },
      { name: team2Input.value.trim() || Core.defaultTeamName(1), color: Core.TEAM_COLORS[1], score: 0 },
    ];
    teamIndex = 0;
    roundsPlayed = [0, 0];
    matchOver = false;
    target = "";
    matchActive = true;
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
    saveMatch();
    View.renderScoreboard(scoreboardEl, { teams, teamIndex, onAdjust: adjustScore });
  }

  function adjustScore(i, delta) {
    teams[i].score = Math.max(0, teams[i].score + delta);
    renderScoreboard();
  }

  function renderGrid() {
    saveMatch();
    View.renderGrid(gridEl, {
      guesses,
      currentGuess,
      wordLength,
      maxAttempts: Core.boardRows(maxAttempts, attemptOffset),
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

  // عدد محاولات الفريق الأصلي (بدون صفوف السرقة، ومع اللي انصرفت قبل تغيير السؤال)
  function ownAttemptCount() {
    return Core.attemptsMade(guesses, attemptOffset);
  }

  // أدوات الفريق المنتظر: البوق و«غيّر السؤال». الليبل قصير بعدّاد صغير بدل
  // «بوق — اسم الفريق (باقي ٢)»: الزرين يقعدون بسطر واحد مع زر السجل، والاسم
  // الطويل كان يلفّه وياكل من ارتفاع الشبكة. اسم الفريق صار بالتلميح (title)
  function updateBoqUi() {
    saveMatch();
    if (gameOver || matchOver) {
      boqBtn.classList.add("hidden");
      changeBtn.classList.add("hidden");
      stealNoteEl.classList.add("hidden");
      return;
    }
    if (steal) {
      boqBtn.classList.add("hidden");
      changeBtn.classList.add("hidden");
      stealNoteEl.classList.remove("hidden");
      stealNoteEl.textContent = View.stealNoteText(steal, teams);
      return;
    }
    stealNoteEl.classList.add("hidden");
    const w = waitingTeam();
    boqBtn.classList.toggle("hidden", boqPerTeam <= 0);
    boqBtn.disabled = boqLeft[w] <= 0;
    View.setIconLabelCount(boqBtn, "thief", "بوق", boqLeft[w]);
    boqBtn.title = "بوق — " + teams[w].name;
    changeBtn.classList.remove("hidden");
    changeBtn.disabled = changeLeft[w] <= 0;
    View.setIconLabelCount(changeBtn, "swap", "غيّر السؤال", changeLeft[w]);
    changeBtn.title = "غيّر السؤال — " + teams[w].name;
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
    if (steal && steal.rebound) {
      loseRound("⏰ خلص وقت الفرصة!");
      return;
    }
    startRebound("⏰ انتهى الوقت!");
  }

  // الفريق فشل (خلصت محاولاته أو وقته): الخصم ياخذ محاولة وحدة تلقائياً بوقت
  // ثابت — حتى لو اللعبة بدون وقت، عشان الجولة ما تتعلّق
  function startRebound(reason) {
    steal = {
      team: waitingTeam(),
      attemptsLeft: Core.REBOUND_ATTEMPTS,
      value: Core.REBOUND_POINTS,
      rebound: true,
    };
    currentGuess = Core.makeGuessBuffer(wordLength, spaceIndexes);
    cursor = Core.firstWritable(currentGuess, spaceIndexes);
    pausedRemainingMs = null;
    deadline = Date.now() + Core.REBOUND_SECONDS * 1000;
    View.renderTimer(timerEl, deadline, null);
    startTicking();
    showMessage(reason + " فرصة أخيرة: " + teams[steal.team].name, "");
    updateHintButtons();
    updateBoqUi();
    renderGrid();
    renderKeyboard();
  }

  function loseRound(reason) {
    gameOver = true;
    steal = null;
    showMessage(reason + " الكلمة كانت: " + target + " (٠ نقطة)", "lose");
    updateHintButtons();
    updateBoqUi();
    renderGrid();
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
      maxAttempts: Core.boardRows(maxAttempts, attemptOffset),
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

  // «غيّر السؤال»: كلمة جديدة بدل اللي يشتغلون عليها. الوقت يكمل، والكلمة
  // الجديدة بعددها العادي ناقص وحدة — Core.changedRound. المساعدات تنفتح من جديد
  // بلا خصم: كانت للكلمة القديمة
  changeBtn.addEventListener("click", () => {
    if (gameOver || steal) return;
    const w = waitingTeam();
    if (changeLeft[w] <= 0) return;
    changeLeft[w]--;

    loadWord(wordBag.pick(target));
    ({ maxAttempts, attemptOffset } = Core.changedRound(wordLength, spaceIndexes));
    guesses = [];
    keyStatus = {};
    hints = Core.newHints();
    hintLog = [];
    hintedLetters = {};
    currentGuess = Core.makeGuessBuffer(wordLength, spaceIndexes);
    cursor = Core.firstWritable(currentGuess, spaceIndexes);

    renderRoundLine();
    View.renderHintLog(hintLogEl, hintLog);
    syncHintLogBtn(hintLog);
    showMessage(
      "🔄 غيّر " +
        teams[w].name +
        " السؤال! باقي لكم " +
        Core.stealAttemptsLabel(Core.boardRows(maxAttempts, attemptOffset)),
      ""
    );
    updateHintButtons();
    updateBoqUi();
    applyTileSize();
    renderGrid();
    renderKeyboard();
  });

  function showMessage(text, kind) {
    View.showMessage(messageEl, text, kind);
  }

  function logHint(text) {
    hintLog.push(text);
    View.renderHintLog(hintLogEl, hintLog);
    syncHintLogBtn(hintLog);
  }

  function loadWord(entry) {
    target = entry.word;
    category = entry.category;
    targetChars = Array.from(target);
    spaceIndexes = Core.spaceIndexesOf(targetChars);
    wordLength = targetChars.length;
  }

  // العنوان يقول الصفوف الباقية للكلمة الحالية، مو العدد الكلي — بعد تغيير
  // السؤال الكلي يشمل صفوفاً انمسحت
  function renderRoundLine() {
    View.renderRoundLine(
      subtitleEl,
      attemptsEl,
      Core.roundSubtitle(
        teams[teamIndex].name,
        roundsPlayed[teamIndex] + 1,
        wordLength,
        Core.boardRows(maxAttempts, attemptOffset),
        spaceIndexes,
        roundsPerTeam
      )
    );
  }

  function startRound() {
    loadWord(wordBag.pick(target));
    maxAttempts = Core.attemptsForWord(wordLength, spaceIndexes);
    attemptOffset = 0;

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

    renderRoundLine();
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
  const hintUsesLeftEl = hintLetterBtn.querySelector(".uses-left");

  function updateHintButtons() {
    if (hintUsesLeftEl) hintUsesLeftEl.textContent = Core.toArabicDigits(Core.revealLetterUsesLeft(hints));
    // أثناء السرقة ما فيه تلميحات — محاولتين وبس
    hintCategoryBtn.disabled = gameOver || !!steal || hints.categoryUsed;
    hintRepeatBtn.disabled = gameOver || !!steal || hints.repeatUsed;

    // «اكشف حرف» تتكرر لحد MAX_REVEAL_LETTER_USES، وبعدها الزر ينقفل. الباقي
    // ينعرض برقم صغير داخل الزر (.uses-left) عشان اللاعب يعرف إن عنده مرتين بس
    // — بحبّة ضيّقة مو بكلمة، لأن الثلاثة لازم يقعدون بسطر واحد على ٣٧٥ بكسل
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

    // ===== مسار السرقة (البوق أو الفرصة الأخيرة) =====
    if (steal) {
      if (won) {
        gameOver = true;
        const stealingTeam = steal.team;
        const earned = steal.value;
        teams[stealingTeam].score += earned;
        showMessage(
          (steal.rebound ? "🎯 صادها " : "🥷 سرقها ") +
            teams[stealingTeam].name +
            (steal.rebound ? " بالفرصة الأخيرة" : "") +
            "! ربحوا " +
            Core.toArabicDigits(earned) +
            " نقطة",
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

      // فشلت الفرصة الأخيرة: ما فيه دور يرجع له — الجولة تنتهي
      if (steal.rebound) {
        loseRound("😔 راحت الفرصة!");
        return;
      }

      // فشل البوق: ينحرق ويكمل الفريق الأصلي محاولاته كاملة
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
      startRebound("😔 انتهت المحاولات!");
      return;
    }

    showMessage("", "");
  }

  // تحسب نهاية الجولة، وتقرر هل انتهت المباراة (كل فريق لعب 5 جولات) أو لسه في دور تالي
  function resolveRoundEnd() {
    stopTicking();
    // نهاية الجولة تتسجّل بعد ما يزيد roundsPlayed — شوف saveMatch تحت
    View.renderTimer(timerEl, null, null);
    roundsPlayed[teamIndex]++;
    matchOver = roundsPlayed.every((r) => r >= roundsPerTeam);
    View.setIconLabel(
      nextTeamBtn,
      matchOver ? "trophy" : "next",
      matchOver ? "عرض النتيجة النهائية" : "دور الفريق التالي"
    );
    roundEndEl.classList.remove("hidden");
    saveMatch();
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
    // خلصت المباراة أو ضغط «إنهاء اللعبة» — الحالتين اللي تمسح الحفظ
    matchActive = false;
    clearSavedMatch();
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

  function clearSavedMatch() {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch (e) {}
  }

  // الوقت يوقف وأنت برّا: نحفظ **الباقي** مو موعد النهاية، وعند الرجوع يبدأ العد
  // من جديد بنفس الباقي. لو حفظنا الموعد، أي طلعة طويلة تخلّص الجولة بغيابك
  function remainingMs() {
    if (!deadline) return null;
    if (pausedRemainingMs != null) return pausedRemainingMs;
    return Math.max(0, deadline - Date.now());
  }

  function saveMatch() {
    if (!matchActive) return;
    const snap = {
      schema: SAVE_SCHEMA,
      teams, teamIndex, roundsPlayed, matchOver, roundsPerTeam, roundSeconds,
      boqLeft, boqPerTeam, changeLeft,
      categories: [...selectedCategories],
      bag: wordBag.toJSON(),
      round: {
        target, category, maxAttempts, attemptOffset, currentGuess, cursor, guesses, gameOver,
        keyStatus, hints, hintLog, hintedLetters, steal,
        timerMs: remainingMs(),
        timerPaused: pausedRemainingMs != null,
        message: { text: messageEl.textContent, kind: (messageEl.className.match(/\b(win|lose)\b/) || [""])[0] },
      },
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(snap));
    } catch (e) {}
  }

  function loadSavedMatch() {
    try {
      const snap = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
      if (!snap || snap.schema !== SAVE_SCHEMA || !snap.round || !snap.round.target) return null;
      // الكلمة لازم تكون للحين بالبنك: لو انشالت بتحديث، اللقطة ما تنفع
      if (!WORDS.some((w) => w.word === snap.round.target)) return null;
      return snap;
    } catch (e) {
      return null;
    }
  }

  function restoreMatch(snap) {
    teams = snap.teams;
    teamIndex = snap.teamIndex;
    roundsPlayed = snap.roundsPlayed;
    matchOver = snap.matchOver;
    roundsPerTeam = snap.roundsPerTeam;
    roundSeconds = snap.roundSeconds;
    boqLeft = snap.boqLeft;
    boqPerTeam = snap.boqPerTeam;
    changeLeft = snap.changeLeft;
    selectedCategories = new Set(snap.categories);
    wordBag = Core.makeWordBag(selectedCategories);
    wordBag.restore(snap.bag || []);

    const r = snap.round;
    loadWord({ word: r.target, category: r.category });
    maxAttempts = r.maxAttempts;
    attemptOffset = r.attemptOffset || 0;
    currentGuess = r.currentGuess;
    cursor = r.cursor;
    guesses = r.guesses;
    gameOver = r.gameOver;
    keyStatus = r.keyStatus || {};
    hints = Object.assign(Core.newHints(), r.hints);
    hintLog = r.hintLog || [];
    hintedLetters = r.hintedLetters || {};
    steal = r.steal || null;
    pausedRemainingMs = null;
    deadline = null;
    if (r.timerMs != null && !gameOver) {
      if (r.timerPaused) {
        pausedRemainingMs = r.timerMs;
        deadline = Date.now() + r.timerMs;
      } else {
        deadline = Date.now() + r.timerMs;
      }
    }

    matchActive = true;
    setupScreen.classList.add("hidden");
    endScreen.classList.add("hidden");
    playScreen.classList.remove("hidden");
    syncTopbar(true);

    renderRoundLine();
    View.renderCategoryPills(activeCategoriesEl, selectedCategories);
    View.renderHintLog(hintLogEl, hintLog);
    // السجل ينفتح لحاله مع أي تلميح **جديد** — المسترجع مو جديد
    lastHintCount = hintLog.length;
    syncHintLogBtn(hintLog);
    showMessage(r.message ? r.message.text : "", r.message ? r.message.kind : "");
    View.renderTimer(timerEl, deadline, pausedRemainingMs);
    if (!gameOver) startTicking();
    if (gameOver) {
      View.setIconLabel(
        nextTeamBtn,
        matchOver ? "trophy" : "next",
        matchOver ? "عرض النتيجة النهائية" : "دور الفريق التالي"
      );
    }
    roundEndEl.classList.toggle("hidden", !gameOver);
    updateHintButtons();
    updateBoqUi();
    applyTileSize();
    renderGrid();
    renderKeyboard();
    renderScoreboard();
  }

  // آخر لحظة قبل ما تختفي الصفحة: الوقت الباقي يتسجّل بالضبط
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") saveMatch();
  });
  window.addEventListener("pagehide", saveMatch);

  document.getElementById("wordle-restart-btn").addEventListener("click", () => {
    endScreen.classList.add("hidden");
    setupScreen.classList.remove("hidden");
    syncTopbar(false);
    team1Input.value = "";
    team2Input.value = "";
  });

  const saved = loadSavedMatch();
  if (saved) restoreMatch(saved);
  else clearSavedMatch();
})();
