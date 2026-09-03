// الوضع المحلي (جهاز واحد) للعبة "احزر الكلمة".
// المنطق المشترك في js/wordle-core.js والرسم المشترك في js/wordle-view.js — هذا الملف
// متحكّم الوضع المحلي فقط.
(function () {
  "use strict";

  const Core = window.WordleCore;
  const View = window.WordleView;

  // ===== حالة الفريقين =====
  let teams = [];
  let teamIndex = 0;
  let roundsPlayed = [0, 0];
  let matchOver = false;
  let selectedCategories = new Set(Core.ALL_CATEGORIES);
  let wordBag = Core.makeWordBag(selectedCategories);

  // ===== حالة الجولة الحالية =====
  let target = "";
  let targetChars = [];
  let spaceIndexes = [];
  let wordLength = 5;
  let maxAttempts = 6;
  let category = "";
  let currentGuess = [];
  let guesses = [];
  let gameOver = false;
  let keyStatus = {};
  let hints = Core.newHints();
  let hintLog = [];

  // ===== عناصر DOM =====
  const setupScreen = document.getElementById("wordle-setup-screen");
  const playScreen = document.getElementById("wordle-play-screen");
  const endScreen = document.getElementById("wordle-end-screen");
  const team1Input = document.getElementById("wordle-team1-input");
  const team2Input = document.getElementById("wordle-team2-input");
  const startBtn = document.getElementById("wordle-start-btn");

  const scoreboardEl = document.getElementById("wordle-scoreboard");
  const subtitleEl = document.getElementById("wordle-subtitle");
  const activeCategoriesEl = document.getElementById("wordle-active-categories");
  const gridEl = document.getElementById("wordle-grid");
  const messageEl = document.getElementById("wordle-message");
  const keyboardEl = document.getElementById("keyboard");
  const hintLogEl = document.getElementById("wordle-hint-log");
  const hintCategoryBtn = document.getElementById("wordle-hint-category-btn");
  const hintRepeatBtn = document.getElementById("wordle-hint-repeat-btn");
  const hintLetterBtn = document.getElementById("wordle-hint-letter-btn");
  const roundEndEl = document.getElementById("wordle-round-end");
  const nextTeamBtn = document.getElementById("wordle-next-team-btn");
  const endMatchBtn = document.getElementById("wordle-end-match-btn");
  const catAllCheckbox = document.getElementById("wordle-cat-all");
  const catListEl = document.getElementById("wordle-category-list");
  const catErrorEl = document.getElementById("wordle-category-error");

  // ===== اختيار الفئات =====
  function renderCategoryChecklist() {
    View.renderCategoryChecklist(catListEl, selectedCategories, syncAllCheckbox);
  }

  function syncAllCheckbox() {
    catAllCheckbox.checked = selectedCategories.size === Core.ALL_CATEGORIES.length;
  }

  catAllCheckbox.addEventListener("change", () => {
    selectedCategories = new Set(catAllCheckbox.checked ? Core.ALL_CATEGORIES : []);
    wordBag = Core.makeWordBag(selectedCategories);
    renderCategoryChecklist();
  });

  renderCategoryChecklist();

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
    renderScoreboard();
    startRound();
  });

  function renderScoreboard() {
    View.renderScoreboard(scoreboardEl, { teams, teamIndex, onAdjust: adjustScore });
  }

  function adjustScore(i, delta) {
    teams[i].score = Math.max(0, teams[i].score + delta);
    renderScoreboard();
  }

  function renderGrid() {
    View.renderGrid(gridEl, { guesses, currentGuess, wordLength, maxAttempts, spaceIndexes });
  }

  function renderKeyboard() {
    View.renderKeyboard(keyboardEl, { keyStatus, onKey: handleKey });
  }

  function applyTileSize() {
    View.applyTileSize(gridEl, { wordLength, maxAttempts, spaceCount: spaceIndexes.length });
  }

  function showMessage(text, kind) {
    View.showMessage(messageEl, text, kind);
  }

  function logHint(text) {
    hintLog.push(text);
    View.renderHintLog(hintLogEl, hintLog);
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
    Core.autoFillSpaces(currentGuess, wordLength, spaceIndexes);

    subtitleEl.textContent = Core.roundSubtitle(
      teams[teamIndex].name,
      roundsPlayed[teamIndex] + 1,
      wordLength,
      maxAttempts
    );
    activeCategoriesEl.textContent = Core.categoriesLabel(selectedCategories);
    showMessage("", "");
    View.renderHintLog(hintLogEl, hintLog);
    roundEndEl.classList.add("hidden");
    updateHintButtons();

    applyTileSize();
    renderGrid();
    renderKeyboard();
    renderScoreboard();
  }

  function updateHintButtons() {
    hintCategoryBtn.disabled = gameOver || hints.categoryUsed;
    hintRepeatBtn.disabled = gameOver || hints.repeatUsed;
    hintLetterBtn.disabled = gameOver || Core.allLettersKnown(targetChars, keyStatus);
  }

  hintCategoryBtn.addEventListener("click", () => {
    if (hintCategoryBtn.disabled) return;
    hints.categoryUsed = true;
    logHint("💡 الفئة: " + category);
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

    renderKeyboard();
    updateHintButtons();
  });

  function handleKey(key) {
    if (gameOver) return;

    if (key === "ENTER") {
      submitGuess();
      return;
    }
    if (key === "DEL") {
      currentGuess.pop();
      renderGrid();
      return;
    }
    if (Core.ARABIC_LETTER_RE.test(key) && currentGuess.length < wordLength) {
      currentGuess.push(key);
      Core.autoFillSpaces(currentGuess, wordLength, spaceIndexes);
      renderGrid();
    }
  }

  function submitGuess() {
    if (currentGuess.length < wordLength) {
      showMessage("أدخل " + Core.toArabicDigits(wordLength) + " أحرف أولاً", "");
      return;
    }

    const statuses = Core.evaluateGuess(currentGuess, targetChars);
    const attemptNumber = guesses.length + 1;
    guesses.push({ chars: currentGuess.slice(), statuses });
    Core.mergeKeyStatus(keyStatus, currentGuess, statuses);

    const won = statuses.every((s) => s === "green");
    currentGuess = [];
    Core.autoFillSpaces(currentGuess, wordLength, spaceIndexes);
    renderGrid();
    renderKeyboard();
    updateHintButtons();

    if (won) {
      gameOver = true;
      const earned = Core.finalScoreForAttempt(attemptNumber, maxAttempts, hints);
      teams[teamIndex].score += earned;
      showMessage(
        "🎉 أحسنت يا " + teams[teamIndex].name + "! ربحتوا " + Core.toArabicDigits(earned) + " نقطة",
        "win"
      );
      renderScoreboard();
      updateHintButtons();
      resolveRoundEnd();
      return;
    }

    if (guesses.length >= maxAttempts) {
      gameOver = true;
      showMessage("😔 انتهت المحاولات! الكلمة كانت: " + target + " (٠ نقطة)", "lose");
      updateHintButtons();
      resolveRoundEnd();
      return;
    }

    showMessage("", "");
  }

  // تحسب نهاية الجولة، وتقرر هل انتهت المباراة (كل فريق لعب 5 جولات) أو لسه في دور تالي
  function resolveRoundEnd() {
    roundsPlayed[teamIndex]++;
    matchOver = roundsPlayed.every((r) => r >= Core.ROUNDS_PER_TEAM);
    nextTeamBtn.textContent = matchOver ? "عرض النتيجة النهائية 🏆" : "دور الفريق التالي 👉";
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
    playScreen.classList.add("hidden");
    endScreen.classList.remove("hidden");

    View.renderFinalScores(
      {
        winnerName: document.getElementById("wordle-winner-name"),
        winnerScore: document.getElementById("wordle-winner-score"),
        finalScores: document.getElementById("wordle-final-scores"),
      },
      teams
    );
  }

  document.getElementById("wordle-restart-btn").addEventListener("click", () => {
    endScreen.classList.add("hidden");
    setupScreen.classList.remove("hidden");
    team1Input.value = "";
    team2Input.value = "";
  });
})();
