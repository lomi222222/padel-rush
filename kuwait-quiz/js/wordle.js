(function () {
  "use strict";

  const ARABIC_LETTER_RE = /^[ء-ي]$/;
  const ARABIC_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  const TEAM_COLORS = ["#12539f", "#06264a"];
  const ROUNDS_PER_TEAM = 5;

  const KEYBOARD_ROWS = [
    ["ض", "ص", "ث", "ق", "ف", "غ", "ع", "ه", "خ", "ح", "ج", "د"],
    ["ش", "س", "ي", "ب", "ل", "ا", "ت", "ن", "م", "ك", "ط"],
    ["ئ", "ء", "ؤ", "ر", "ى", "ة", "و", "ز", "ظ", "ذ"],
    ["ENTER", "DEL"],
  ];

  const ALL_CATEGORIES = [...new Set(WORDS.map((w) => w.category))];

  // ===== حالة الفريقين =====
  let teams = [];
  let teamIndex = 0;
  let roundsPlayed = [0, 0];
  let matchOver = false;
  let selectedCategories = new Set(ALL_CATEGORIES);

  // ===== حالة الجولة الحالية =====
  let target = "";
  let targetChars = [];
  let wordLength = 5;
  let maxAttempts = 6;
  let category = "";
  let currentGuess = [];
  let guesses = [];
  let gameOver = false;
  let keyStatus = {};
  let hints = { categoryUsed: false, repeatUsed: false, revealLetterUses: 0 };

  function toArabicDigits(n) {
    return String(n)
      .split("")
      .map((d) => ARABIC_DIGITS[+d])
      .join("");
  }

  function defaultTeamName(i) {
    return "الفريق " + (i === 0 ? "الأول" : "الثاني");
  }

  // ===== عناصر DOM =====
  const setupScreen = document.getElementById("wordle-setup-screen");
  const playScreen = document.getElementById("wordle-play-screen");
  const endScreen = document.getElementById("wordle-end-screen");
  const team1Input = document.getElementById("wordle-team1-input");
  const team2Input = document.getElementById("wordle-team2-input");
  const startBtn = document.getElementById("wordle-start-btn");

  const scoreboardEl = document.getElementById("wordle-scoreboard");
  const subtitleEl = document.getElementById("wordle-subtitle");
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
    catListEl.innerHTML = "";
    ALL_CATEGORIES.forEach((cat) => {
      const label = document.createElement("label");
      label.className = "category-chip";

      const box = document.createElement("input");
      box.type = "checkbox";
      box.checked = selectedCategories.has(cat);
      box.addEventListener("change", () => {
        if (box.checked) selectedCategories.add(cat);
        else selectedCategories.delete(cat);
        syncAllCheckbox();
      });

      label.appendChild(box);
      label.appendChild(document.createTextNode(cat));
      catListEl.appendChild(label);
    });
  }

  function syncAllCheckbox() {
    catAllCheckbox.checked = selectedCategories.size === ALL_CATEGORIES.length;
  }

  catAllCheckbox.addEventListener("change", () => {
    selectedCategories = new Set(catAllCheckbox.checked ? ALL_CATEGORIES : []);
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

    teams = [
      { name: team1Input.value.trim() || defaultTeamName(0), color: TEAM_COLORS[0], score: 0 },
      { name: team2Input.value.trim() || defaultTeamName(1), color: TEAM_COLORS[1], score: 0 },
    ];
    teamIndex = 0;
    roundsPlayed = [0, 0];
    matchOver = false;
    setupScreen.classList.add("hidden");
    playScreen.classList.remove("hidden");
    endScreen.classList.add("hidden");
    renderScoreboard();
    startRound();
  });

  function renderScoreboard() {
    scoreboardEl.innerHTML = "";
    teams.forEach((team, i) => {
      const chip = document.createElement("div");
      chip.className = "team-chip" + (i === teamIndex ? " current" : "");
      chip.style.background = team.color;

      const name = document.createElement("div");
      name.className = "name";
      name.textContent = team.name;

      const score = document.createElement("div");
      score.className = "score";
      score.textContent = toArabicDigits(team.score) + " نقطة";

      const adjustRow = document.createElement("div");
      adjustRow.className = "score-adjust-row";

      const minusBtn = document.createElement("button");
      minusBtn.type = "button";
      minusBtn.className = "score-adjust-btn";
      minusBtn.textContent = "−٢٥";
      minusBtn.addEventListener("click", () => adjustScore(i, -25));

      const plusBtn = document.createElement("button");
      plusBtn.type = "button";
      plusBtn.className = "score-adjust-btn";
      plusBtn.textContent = "+٢٥";
      plusBtn.addEventListener("click", () => adjustScore(i, 25));

      adjustRow.appendChild(minusBtn);
      adjustRow.appendChild(plusBtn);

      chip.appendChild(name);
      chip.appendChild(score);
      chip.appendChild(adjustRow);
      scoreboardEl.appendChild(chip);
    });
  }

  function adjustScore(i, delta) {
    teams[i].score = Math.max(0, teams[i].score + delta);
    renderScoreboard();
  }

  // الكلمات المكوّنة من كلمتين تحتوي على مسافة بينهما — نملأ خانة المسافة تلقائياً
  // في مكانها الصحيح بدل ما نطلب من اللاعب يكتبها بنفسه
  function autoFillSpaces() {
    while (currentGuess.length < wordLength && targetChars[currentGuess.length] === " ") {
      currentGuess.push(" ");
    }
  }

  function pickWordEntry() {
    const pool = WORDS.filter((w) => selectedCategories.has(w.category));
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function applyTileSize() {
    const container = gridEl.parentElement;
    const cs = getComputedStyle(container);
    const paddingX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    const available = Math.max(container.clientWidth - paddingX, 200);
    const gapPx = window.innerWidth <= 400 ? 6 : 8;
    const spacerWidth = window.innerWidth <= 400 ? 14 : 20;

    const numSpaces = targetChars.filter((c) => c === " ").length;
    const numLetters = wordLength - numSpaces;

    const rawWidth = (available - gapPx * (wordLength - 1) - spacerWidth * numSpaces) / numLetters;

    // also bound tile size by the vertical space budgeted for the grid (.wordle-grid-scroll's
    // own max-height), so short words with many rows don't get oversized tiles that then need
    // to scroll vertically anyway
    const maxHeightPx = parseFloat(cs.maxHeight);
    const rawHeight = maxHeightPx ? (maxHeightPx - gapPx * (maxAttempts - 1)) / maxAttempts : Infinity;

    const size = Math.max(24, Math.min(56, Math.floor(Math.min(rawWidth, rawHeight))));
    gridEl.style.setProperty("--tile-size", size + "px");
    gridEl.style.setProperty("--tile-gap-width", spacerWidth + "px");
  }

  // ===== نقاط الجولة =====
  // المحاولة الأولى = 200×N (مضاعفة تلقائياً)، وأي محاولة بعدها = 100×(N-k+1)
  function rawScoreForAttempt(attemptNumber) {
    if (attemptNumber === 1) return 200 * maxAttempts;
    return 100 * (maxAttempts - attemptNumber + 1);
  }

  function finalScoreForAttempt(attemptNumber) {
    let score = rawScoreForAttempt(attemptNumber);
    const flatDeduction = (hints.repeatUsed ? 50 : 0) + hints.revealLetterUses * 100;
    score = Math.max(0, score - flatDeduction);
    if (hints.categoryUsed) score = Math.floor(score / 2);
    return score;
  }

  function startRound() {
    const entry = pickWordEntry();
    target = entry.word;
    category = entry.category;
    targetChars = Array.from(target);
    wordLength = targetChars.length;
    maxAttempts = Math.min(wordLength + 1, 10);

    currentGuess = [];
    guesses = [];
    gameOver = false;
    keyStatus = {};
    hints = { categoryUsed: false, repeatUsed: false, revealLetterUses: 0 };
    autoFillSpaces();

    subtitleEl.textContent =
      "دور " + teams[teamIndex].name + " (الجولة " + toArabicDigits(roundsPlayed[teamIndex] + 1) + " من " + toArabicDigits(ROUNDS_PER_TEAM) + ") — كلمة من " + toArabicDigits(wordLength) + " أحرف خلال " + toArabicDigits(maxAttempts) + " محاولات";
    messageEl.textContent = "";
    messageEl.className = "wordle-message";
    hintLogEl.innerHTML = "";
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

    const relevantChars = [...new Set(targetChars)].filter((c) => c !== " ");
    const allKnown = relevantChars.every((c) => keyStatus[c] === "green");
    hintLetterBtn.disabled = gameOver || allKnown;
  }

  function logHint(text) {
    const box = document.createElement("div");
    box.className = "hint-box";
    box.textContent = text;
    hintLogEl.appendChild(box);
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
    const hasDup = new Set(targetChars).size !== targetChars.length;
    logHint(hasDup ? "🔁 نعم، يوجد حرف متكرر في الكلمة" : "🔁 لا، لا يوجد حرف متكرر في الكلمة");
    updateHintButtons();
  });

  hintLetterBtn.addEventListener("click", () => {
    if (hintLetterBtn.disabled) return;

    const yellowLetter = Object.keys(keyStatus).find((l) => keyStatus[l] === "yellow" && l !== " ");
    if (yellowLetter) {
      hints.revealLetterUses++;
      const pos = targetChars.indexOf(yellowLetter);
      keyStatus[yellowLetter] = "green";
      logHint('🔤 الحرف "' + yellowLetter + '" في الموضع ' + toArabicDigits(pos + 1));
    } else {
      const revealed = new Set(Object.keys(keyStatus));
      const candidates = [...new Set(targetChars)].filter((c) => !revealed.has(c) && c !== " ");
      if (candidates.length === 0) return;
      hints.revealLetterUses++;
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      keyStatus[pick] = "yellow";
      logHint('🔤 الحرف "' + pick + '" موجود في الكلمة');
    }

    renderKeyboard();
    updateHintButtons();
  });

  function evaluateGuess(guessChars) {
    const statuses = new Array(wordLength).fill("gray");
    const targetUsed = new Array(wordLength).fill(false);

    for (let i = 0; i < wordLength; i++) {
      if (guessChars[i] === targetChars[i]) {
        statuses[i] = "green";
        targetUsed[i] = true;
      }
    }

    for (let i = 0; i < wordLength; i++) {
      if (statuses[i] === "green") continue;
      const idx = targetChars.findIndex((c, j) => c === guessChars[i] && !targetUsed[j]);
      if (idx !== -1) {
        statuses[i] = "yellow";
        targetUsed[idx] = true;
      }
    }

    return statuses;
  }

  function statusRank(s) {
    return s === "green" ? 3 : s === "yellow" ? 2 : 1;
  }

  function updateKeyStatus(chars, statuses) {
    chars.forEach((ch, i) => {
      const s = statuses[i];
      if (!keyStatus[ch] || statusRank(s) > statusRank(keyStatus[ch])) {
        keyStatus[ch] = s;
      }
    });
  }

  function renderGrid() {
    gridEl.innerHTML = "";
    for (let row = 0; row < maxAttempts; row++) {
      const rowEl = document.createElement("div");
      rowEl.className = "wordle-row";

      const submitted = guesses[row];
      const isCurrentRow = row === guesses.length;

      for (let col = 0; col < wordLength; col++) {
        if (targetChars[col] === " ") {
          const gap = document.createElement("div");
          gap.className = "wordle-tile-gap";
          rowEl.appendChild(gap);
          continue;
        }

        const tile = document.createElement("div");
        tile.className = "wordle-tile";

        if (submitted) {
          tile.textContent = submitted.chars[col];
          tile.classList.add(submitted.statuses[col]);
        } else if (isCurrentRow && currentGuess[col]) {
          tile.textContent = currentGuess[col];
          tile.classList.add("filled");
        }

        rowEl.appendChild(tile);
      }
      gridEl.appendChild(rowEl);
    }
  }

  function renderKeyboard() {
    keyboardEl.innerHTML = "";
    KEYBOARD_ROWS.forEach((row) => {
      const rowEl = document.createElement("div");
      rowEl.className = "keyboard-row";
      row.forEach((key) => {
        const btn = document.createElement("button");
        btn.className = "key";
        if (key === "ENTER" || key === "DEL") btn.classList.add("wide");
        btn.textContent = key === "ENTER" ? "إدخال" : key === "DEL" ? "⌫" : key;

        if (key !== "ENTER" && key !== "DEL" && keyStatus[key]) {
          btn.classList.add(keyStatus[key]);
        }

        btn.addEventListener("click", () => handleKey(key));
        rowEl.appendChild(btn);
      });
      keyboardEl.appendChild(rowEl);
    });
  }

  function showMessage(text, kind) {
    messageEl.textContent = text;
    messageEl.className = "wordle-message" + (kind ? " " + kind : "");
  }

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
    if (ARABIC_LETTER_RE.test(key) && currentGuess.length < wordLength) {
      currentGuess.push(key);
      autoFillSpaces();
      renderGrid();
    }
  }

  function submitGuess() {
    if (currentGuess.length < wordLength) {
      showMessage("أدخل " + toArabicDigits(wordLength) + " أحرف أولاً", "");
      return;
    }

    const statuses = evaluateGuess(currentGuess);
    const attemptNumber = guesses.length + 1;
    guesses.push({ chars: currentGuess.slice(), statuses });
    updateKeyStatus(currentGuess, statuses);

    const won = statuses.every((s) => s === "green");
    currentGuess = [];
    autoFillSpaces();
    renderGrid();
    renderKeyboard();
    updateHintButtons();

    if (won) {
      gameOver = true;
      const earned = finalScoreForAttempt(attemptNumber);
      teams[teamIndex].score += earned;
      showMessage("🎉 أحسنت يا " + teams[teamIndex].name + "! ربحتوا " + toArabicDigits(earned) + " نقطة", "win");
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
    matchOver = roundsPlayed.every((r) => r >= ROUNDS_PER_TEAM);
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
    } else if (ARABIC_LETTER_RE.test(e.key)) {
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

    const sorted = teams.slice().sort((a, b) => b.score - a.score);
    const topScore = sorted[0].score;
    const winners = sorted.filter((t) => t.score === topScore);

    const winnerNameEl = document.getElementById("wordle-winner-name");
    const winnerScoreEl = document.getElementById("wordle-winner-score");
    if (winners.length > 1) {
      winnerNameEl.textContent = "🏆 تعادل بين: " + winners.map((w) => w.name).join(" و ");
    } else {
      winnerNameEl.textContent = "🏆 الفريق الفائز: " + winners[0].name;
    }
    winnerScoreEl.textContent = "بمجموع " + toArabicDigits(topScore) + " نقطة";

    const finalScoresEl = document.getElementById("wordle-final-scores");
    finalScoresEl.innerHTML = "";
    sorted.forEach((team, i) => {
      const row = document.createElement("div");
      row.className = "final-score-row" + (i === 0 ? " first" : "");
      row.style.color = "#0c2036";
      row.innerHTML =
        "<span>" + (i + 1) + ". " + team.name + "</span><span>" + toArabicDigits(team.score) + " نقطة</span>";
      finalScoresEl.appendChild(row);
    });
  }

  document.getElementById("wordle-restart-btn").addEventListener("click", () => {
    endScreen.classList.add("hidden");
    setupScreen.classList.remove("hidden");
    team1Input.value = "";
    team2Input.value = "";
  });
})();
