(function () {
  "use strict";

  const WORD_LENGTH = 5;
  const MAX_ATTEMPTS = 6;
  const ARABIC_LETTER_RE = /^[ء-ي]$/;

  const KEYBOARD_ROWS = [
    ["ض", "ص", "ث", "ق", "ف", "غ", "ع", "ه", "خ", "ح", "ج", "د"],
    ["ش", "س", "ي", "ب", "ل", "ا", "ت", "ن", "م", "ك", "ط"],
    ["ئ", "ء", "ؤ", "ر", "ى", "ة", "و", "ز", "ظ", "ذ"],
    ["ENTER", "DEL"],
  ];

  let target = "";
  let targetChars = [];
  let currentGuess = [];
  let guesses = []; // { chars: [...], statuses: [...] }
  let gameOver = false;
  let keyStatus = {}; // letter -> 'green' | 'yellow' | 'gray'

  const gridEl = document.getElementById("wordle-grid");
  const messageEl = document.getElementById("wordle-message");
  const keyboardEl = document.getElementById("keyboard");
  const restartBtn = document.getElementById("wordle-restart");

  function pickWord() {
    return WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)];
  }

  function startGame() {
    target = pickWord();
    targetChars = Array.from(target);
    currentGuess = [];
    guesses = [];
    gameOver = false;
    keyStatus = {};
    messageEl.textContent = "";
    messageEl.className = "wordle-message";
    restartBtn.classList.add("hidden");
    renderGrid();
    renderKeyboard();
  }

  function evaluateGuess(guessChars) {
    const statuses = new Array(WORD_LENGTH).fill("gray");
    const targetUsed = new Array(WORD_LENGTH).fill(false);

    for (let i = 0; i < WORD_LENGTH; i++) {
      if (guessChars[i] === targetChars[i]) {
        statuses[i] = "green";
        targetUsed[i] = true;
      }
    }

    for (let i = 0; i < WORD_LENGTH; i++) {
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
    for (let row = 0; row < MAX_ATTEMPTS; row++) {
      const rowEl = document.createElement("div");
      rowEl.className = "wordle-row";

      const submitted = guesses[row];
      const isCurrentRow = row === guesses.length;

      for (let col = 0; col < WORD_LENGTH; col++) {
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
    if (ARABIC_LETTER_RE.test(key) && currentGuess.length < WORD_LENGTH) {
      currentGuess.push(key);
      renderGrid();
    }
  }

  function submitGuess() {
    if (currentGuess.length < WORD_LENGTH) {
      showMessage("أدخل ٥ أحرف أولاً", "");
      return;
    }

    const statuses = evaluateGuess(currentGuess);
    guesses.push({ chars: currentGuess.slice(), statuses });
    updateKeyStatus(currentGuess, statuses);

    const won = statuses.every((s) => s === "green");
    const guessSnapshot = currentGuess.slice();
    currentGuess = [];
    renderGrid();
    renderKeyboard();

    if (won) {
      gameOver = true;
      showMessage("🎉 أحسنت! الكلمة هي: " + target, "win");
      restartBtn.classList.remove("hidden");
      return;
    }

    if (guesses.length >= MAX_ATTEMPTS) {
      gameOver = true;
      showMessage("😔 انتهت المحاولات! الكلمة كانت: " + target, "lose");
      restartBtn.classList.remove("hidden");
      return;
    }

    showMessage("", "");
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

  restartBtn.addEventListener("click", startGame);

  startGame();
})();
