(function () {
  "use strict";

  const ARABIC_LETTER_RE = /^[ء-ي]$/;
  const ARABIC_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

  const KEYBOARD_ROWS = [
    ["ض", "ص", "ث", "ق", "ف", "غ", "ع", "ه", "خ", "ح", "ج", "د"],
    ["ش", "س", "ي", "ب", "ل", "ا", "ت", "ن", "م", "ك", "ط"],
    ["ئ", "ء", "ؤ", "ر", "ى", "ة", "و", "ز", "ظ", "ذ"],
    ["ENTER", "DEL"],
  ];

  let target = "";
  let targetChars = [];
  let wordLength = 5;
  let maxAttempts = 6;
  let category = "";
  let hintUsed = false;
  let currentGuess = [];
  let guesses = []; // { chars: [...], statuses: [...] }
  let gameOver = false;
  let keyStatus = {}; // letter -> 'green' | 'yellow' | 'gray'

  const subtitleEl = document.getElementById("wordle-subtitle");
  const gridEl = document.getElementById("wordle-grid");
  const messageEl = document.getElementById("wordle-message");
  const keyboardEl = document.getElementById("keyboard");
  const restartBtn = document.getElementById("wordle-restart");
  const hintBtn = document.getElementById("wordle-hint-btn");
  const hintBoxEl = document.getElementById("wordle-hint-box");

  function toArabicDigits(n) {
    return String(n)
      .split("")
      .map((d) => ARABIC_DIGITS[+d])
      .join("");
  }

  function pickWordEntry() {
    return WORDS[Math.floor(Math.random() * WORDS.length)];
  }

  // يحسب حجم المربع المناسب بناءً على العرض المتاح فعلياً وطول الكلمة الحالية،
  // حتى لا تفيض الكلمات الطويلة عن الشاشة ولا تصغر الكلمات القصيرة بلا داعٍ
  function applyTileSize() {
    const container = gridEl.parentElement;
    const cs = getComputedStyle(container);
    const paddingX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    const available = Math.max(container.clientWidth - paddingX, 200);
    const gapPx = window.innerWidth <= 400 ? 6 : 8;
    const raw = (available - gapPx * (wordLength - 1)) / wordLength;
    const size = Math.max(30, Math.min(56, Math.floor(raw)));
    gridEl.style.setProperty("--tile-size", size + "px");
  }

  function startGame() {
    const entry = pickWordEntry();
    target = entry.word;
    category = entry.category;
    targetChars = Array.from(target);
    wordLength = targetChars.length;
    maxAttempts = wordLength + 1;

    currentGuess = [];
    guesses = [];
    gameOver = false;
    keyStatus = {};
    hintUsed = false;

    subtitleEl.textContent =
      "خمّن الكلمة المكوّنة من " + toArabicDigits(wordLength) + " أحرف خلال " + toArabicDigits(maxAttempts) + " محاولات";
    messageEl.textContent = "";
    messageEl.className = "wordle-message";
    restartBtn.classList.add("hidden");
    hintBtn.disabled = false;
    hintBoxEl.classList.add("hidden");
    hintBoxEl.textContent = "";

    applyTileSize();
    renderGrid();
    renderKeyboard();
  }

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
      renderGrid();
    }
  }

  function submitGuess() {
    if (currentGuess.length < wordLength) {
      showMessage("أدخل " + toArabicDigits(wordLength) + " أحرف أولاً", "");
      return;
    }

    const statuses = evaluateGuess(currentGuess);
    guesses.push({ chars: currentGuess.slice(), statuses });
    updateKeyStatus(currentGuess, statuses);

    const won = statuses.every((s) => s === "green");
    currentGuess = [];
    renderGrid();
    renderKeyboard();

    if (won) {
      gameOver = true;
      showMessage("🎉 أحسنت! الكلمة هي: " + target, "win");
      restartBtn.classList.remove("hidden");
      return;
    }

    if (guesses.length >= maxAttempts) {
      gameOver = true;
      showMessage("😔 انتهت المحاولات! الكلمة كانت: " + target, "lose");
      restartBtn.classList.remove("hidden");
      return;
    }

    showMessage("", "");
  }

  function useHint() {
    if (hintUsed || gameOver) return;
    hintUsed = true;
    hintBtn.disabled = true;
    hintBoxEl.classList.remove("hidden");
    hintBoxEl.textContent = "💡 الفئة: " + category;
  }

  document.addEventListener("keydown", (e) => {
    if (gameOver) return;
    if (e.key === "Enter") {
      handleKey("ENTER");
    } else if (e.key === "Backspace") {
      handleKey("DEL");
    } else if (ARABIC_LETTER_RE.test(e.key)) {
      handleKey(e.key);
    }
  });

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(applyTileSize, 120);
  });

  restartBtn.addEventListener("click", startGame);
  hintBtn.addEventListener("click", useHint);

  startGame();
})();
