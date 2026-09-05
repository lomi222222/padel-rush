// دوال رسم واجهة "احزر الكلمة" — كلها "ارسم من الحالة" وتاخذ كل شي تحتاجه كمعاملات
// صريحة، فتنفع للوضع المحلي وللأونلاين بنفس الشكل.
(function () {
  "use strict";

  const Core = window.WordleCore;

  function renderGrid(gridEl, opts) {
    const { guesses, currentGuess, wordLength, maxAttempts } = opts;
    const spaces = opts.spaceIndexes instanceof Set ? opts.spaceIndexes : new Set(opts.spaceIndexes || []);

    // صفوف السرقة (البوق) تنضاف فوق العدد الأصلي عشان الفريق الأصلي ما يخسر محاولاته
    const stealRows = guesses.filter((g) => g && g.steal).length;
    const totalRows = Math.max(maxAttempts + stealRows, guesses.length + 1);

    gridEl.innerHTML = "";
    for (let row = 0; row < totalRows; row++) {
      const rowEl = document.createElement("div");
      rowEl.className = "wordle-row";

      const submitted = guesses[row];
      const isCurrentRow = row === guesses.length;
      if (submitted && submitted.steal) rowEl.classList.add("steal");
      if (isCurrentRow && opts.stealActive) rowEl.classList.add("steal");

      for (let col = 0; col < wordLength; col++) {
        if (spaces.has(col)) {
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

  function renderKeyboard(keyboardEl, opts) {
    const keyStatus = opts.keyStatus || {};
    const onKey = opts.onKey;
    const disabled = !!opts.disabled;

    keyboardEl.innerHTML = "";
    Core.KEYBOARD_ROWS.forEach((row) => {
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

        if (disabled) btn.disabled = true;
        else btn.addEventListener("click", () => onKey(key));

        rowEl.appendChild(btn);
      });
      keyboardEl.appendChild(rowEl);
    });
  }

  function applyTileSize(gridEl, opts) {
    const { wordLength, maxAttempts } = opts;
    const spaceCount = opts.spaceCount || 0;

    const container = gridEl.parentElement;
    const cs = getComputedStyle(container);
    const paddingX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    const available = Math.max(container.clientWidth - paddingX, 200);
    const gapPx = window.innerWidth <= 400 ? 6 : 8;
    const spacerWidth = window.innerWidth <= 400 ? 14 : 20;

    const numLetters = Math.max(1, wordLength - spaceCount);

    const rawWidth = (available - gapPx * (wordLength - 1) - spacerWidth * spaceCount) / numLetters;

    // .wordle-grid-scroll only gets a max-height in landscape mode (see CSS); outside of
    // that it's "none", so maxHeightPx is 0 and rawHeight falls back to Infinity — meaning
    // portrait/desktop sizing is purely width-based.
    const maxHeightPx = parseFloat(cs.maxHeight);
    const rawHeight = maxHeightPx ? (maxHeightPx - gapPx * (maxAttempts - 1)) / maxAttempts : Infinity;

    const size = Math.max(24, Math.min(56, Math.floor(Math.min(rawWidth, rawHeight))));
    gridEl.style.setProperty("--tile-size", size + "px");
    gridEl.style.setProperty("--tile-gap-width", spacerWidth + "px");
  }

  // onAdjust اختيارية — لو ما مُرِّرت ما نرسم أزرار ±٢٥ (أجهزة اللاعبين بالأونلاين)
  function renderScoreboard(scoreboardEl, opts) {
    const { teams, teamIndex } = opts;
    const onAdjust = opts.onAdjust;

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
      score.textContent = Core.toArabicDigits(team.score) + " نقطة";

      chip.appendChild(name);
      chip.appendChild(score);

      if (onAdjust) {
        const adjustRow = document.createElement("div");
        adjustRow.className = "score-adjust-row";

        const minusBtn = document.createElement("button");
        minusBtn.type = "button";
        minusBtn.className = "score-adjust-btn";
        minusBtn.textContent = "−٢٥";
        minusBtn.addEventListener("click", () => onAdjust(i, -25));

        const plusBtn = document.createElement("button");
        plusBtn.type = "button";
        plusBtn.className = "score-adjust-btn";
        plusBtn.textContent = "+٢٥";
        plusBtn.addEventListener("click", () => onAdjust(i, 25));

        adjustRow.appendChild(minusBtn);
        adjustRow.appendChild(plusBtn);
        chip.appendChild(adjustRow);
      }

      scoreboardEl.appendChild(chip);
    });
  }

  function showMessage(messageEl, text, kind) {
    messageEl.textContent = text;
    messageEl.className = "wordle-message" + (kind ? " " + kind : "");
  }

  function renderHintLog(hintLogEl, entries) {
    hintLogEl.innerHTML = "";
    (entries || []).forEach((text) => {
      const box = document.createElement("div");
      box.className = "hint-box";
      box.textContent = text;
      hintLogEl.appendChild(box);
    });
  }

  // onChange(nextSelectedSet) — منطق الحصرية كله في Core.applyCategoryToggle
  function renderCategoryChecklist(listEl, selectedCategories, onChange) {
    listEl.innerHTML = "";
    Core.ALL_CATEGORIES.forEach((cat) => {
      const label = document.createElement("label");
      label.className = "category-chip";
      if (Core.EXCLUSIVE_CATEGORIES.has(cat)) label.classList.add("exclusive");

      const box = document.createElement("input");
      box.type = "checkbox";
      box.checked = selectedCategories.has(cat);
      box.addEventListener("change", () => {
        onChange(Core.applyCategoryToggle(selectedCategories, cat, box.checked));
      });

      label.appendChild(box);
      label.appendChild(document.createTextNode(cat));
      listEl.appendChild(label);
    });
  }

  // deadline = ختم زمني مطلق بالميلي ثانية، أو null يعني بدون وقت
  function renderTimer(timerEl, deadline, pausedRemainingMs) {
    if (!deadline && !pausedRemainingMs) {
      timerEl.classList.add("hidden");
      return;
    }
    timerEl.classList.remove("hidden");
    const ms = pausedRemainingMs != null ? pausedRemainingMs : deadline - Date.now();
    const seconds = Math.max(0, ms / 1000);
    timerEl.textContent = (pausedRemainingMs != null ? "⏸️ " : "⏳ ") + Core.formatClock(seconds);
    timerEl.classList.toggle("low", pausedRemainingMs == null && seconds <= 10);
  }

  function renderFinalScores(els, teams) {
    const sorted = teams.slice().sort((a, b) => b.score - a.score);
    const topScore = sorted[0].score;
    const winners = sorted.filter((t) => t.score === topScore);

    if (winners.length > 1) {
      els.winnerName.textContent = "🏆 تعادل بين: " + winners.map((w) => w.name).join(" و ");
    } else {
      els.winnerName.textContent = "🏆 الفريق الفائز: " + winners[0].name;
    }
    els.winnerScore.textContent = "بمجموع " + Core.toArabicDigits(topScore) + " نقطة";

    els.finalScores.innerHTML = "";
    sorted.forEach((team, i) => {
      const row = document.createElement("div");
      row.className = "final-score-row" + (i === 0 ? " first" : "");

      const left = document.createElement("span");
      left.textContent = i + 1 + ". " + team.name;
      const right = document.createElement("span");
      right.textContent = Core.toArabicDigits(team.score) + " نقطة";

      row.appendChild(left);
      row.appendChild(right);
      els.finalScores.appendChild(row);
    });
  }

  window.WordleView = {
    renderGrid,
    renderKeyboard,
    applyTileSize,
    renderScoreboard,
    showMessage,
    renderHintLog,
    renderCategoryChecklist,
    renderTimer,
    renderFinalScores,
  };
})();
