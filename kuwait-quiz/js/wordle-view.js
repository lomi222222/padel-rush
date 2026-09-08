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

  // المقاس ينحسب مرة وحدة بأول الجولة ويثبت لين نهايتها.
  //
  // ليش: ارتفاع الشبكة هو الباقي بعد عمود الأدوات، وعمود الأدوات يكبر أثناء اللعب
  // (سجل التلميحات مع كل وسيلة مساعدة، ولافتة السرقة، ورسالة النتيجة). لو أعدنا
  // الحساب مع كل تغيير، تصغر الخلايا فجأة وسط الجولة. فنثبّت المقاس، ولو ما كفى
  // الارتفاع تنمرّر الصفوف داخل صندوق الشبكة.
  //
  // نعيد الحساب بحالتين بس: جولة يديدة (opts تتغيّر)، وتغيّر مقاس النافذة نفسها
  // (قلب الجهاز). و requestAnimationFrame عشان أول حساب يصير بعد ما يخلص الرسم
  // كامل — الكيبورد ينرسم بعد الشبكة ويغيّر المساحة المتاحة.
  function applyTileSize(gridEl, opts) {
    gridEl._tileOpts = opts;

    if (!gridEl._tileWatching) {
      gridEl._tileWatching = true;
      const onViewportChange = () => sizeTiles(gridEl, true);
      window.addEventListener("resize", onViewportChange);
      window.addEventListener("orientationchange", onViewportChange);
    }

    sizeTiles(gridEl, true);
    requestAnimationFrame(() => sizeTiles(gridEl, true));
  }

  function sizeTiles(gridEl, allowed) {
    const opts = gridEl._tileOpts;
    if (!opts || !allowed) return;
    const { wordLength, maxAttempts } = opts;
    const spaceCount = opts.spaceCount || 0;

    const container = gridEl.parentElement;
    const cs = getComputedStyle(container);
    const paddingX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    const available = Math.max(container.clientWidth - paddingX, 200);
    // الكلمات الطويلة يحدّها العرض مو الطول: ١٢ خانة بشاشة ٣٩٠ تعني الفراغات وحدها
    // تاكل خُمس السطر. فنضيّق الفراغ كل ما طالت الكلمة عشان الحرف نفسه يكبر
    const narrow = window.innerWidth <= 400;
    const gapPx = wordLength >= 10 ? 3 : wordLength >= 7 ? 5 : narrow ? 6 : 8;
    const spacerWidth = wordLength >= 10 ? 9 : narrow ? 14 : 20;

    const numLetters = Math.max(1, wordLength - spaceCount);

    const rawWidth = (available - gapPx * (wordLength - 1) - spacerWidth * spaceCount) / numLetters;

    // الشبكة تقعد داخل حاوية محدودة الارتفاع بالوضعين (flex:1 + min-height:0)، فنقيس
    // ارتفاعها الفعلي ونختار الأصغر بين ما يسمح به العرض وما يسمح به الطول — جذي
    // الشبكة تلقى مكانها كاملة بدون تمرير سواء الجهاز بالطول أو بالعرض
    const paddingY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const availableY = container.clientHeight - paddingY;
    const rawHeight =
      availableY > 0 ? (availableY - gapPx * (maxAttempts - 1)) / maxAttempts : Infinity;

    // ١٣ أصغر مقاس يظل الحرف مقروء فيه. تحته نفضّل التمرير داخل صندوق الشبكة على
    // إننا نصغّر لدرجة ما تنقرا — ويصير بـ٣٪ من البنك بس (العناوين الطويلة جداً)
    const size = Math.max(13, Math.min(72, Math.floor(Math.min(rawWidth, rawHeight))));
    // ما نكتب إلا لو تغيّر فعلاً — يقطع أي دورة بين المراقب وتغيّر المقاس
    if (gridEl._tileSize === size) return;
    gridEl._tileSize = size;
    gridEl.style.setProperty("--tile-size", size + "px");
    // الفراغ يجي من هنا بس — لو تركناه بالـCSS هم، الحساب فوق يختلف عن الرسم الفعلي
    gridEl.style.setProperty("--tile-gap", gapPx + "px");
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

  // الفئات المختارة كحبّات بدال سطر نص طويل. لو كلها مختارة نكتفي بحبّة وحدة،
  // ولو كثيرة نبيّن أول أربع و"+باقي" عشان ما تاكل ارتفاع الشبكة
  function renderCategoryPills(el, selectedCategories) {
    const list = [...selectedCategories];
    const all =
      list.length === Core.SELECTABLE_CATEGORIES.length && !Core.hasExclusive(selectedCategories);

    el.innerHTML = "";
    const add = (text, cls) => {
      const pill = document.createElement("span");
      pill.className = "cat-pill" + (cls ? " " + cls : "");
      pill.textContent = text;
      el.appendChild(pill);
    };

    if (all) {
      add("🎯 كل الفئات", "all");
      return;
    }

    const MAX_SHOWN = 4;
    list.slice(0, MAX_SHOWN).forEach((cat) => {
      add(cat, Core.EXCLUSIVE_CATEGORIES.has(cat) ? "gold" : "");
    });
    if (list.length > MAX_SHOWN) {
      add("+" + Core.toArabicDigits(list.length - MAX_SHOWN), "more");
      el.title = list.join("، ");
    } else {
      el.removeAttribute("title");
    }
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
    renderCategoryPills,
    showMessage,
    renderHintLog,
    renderCategoryChecklist,
    renderTimer,
    renderFinalScores,
  };
})();
