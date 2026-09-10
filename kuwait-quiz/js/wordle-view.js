// دوال رسم واجهة "احزر الكلمة" — كلها "ارسم من الحالة" وتاخذ كل شي تحتاجه كمعاملات
// صريحة، فتنفع للوضع المحلي وللأونلاين بنفس الشكل.
(function () {
  "use strict";

  const Core = window.WordleCore;

  // ===== أيقونات الواجهة =====
  // رسمات خطّية بنفس لغة الصفحة الرئيسية: حد ٢px، currentColor، أطراف مدوّرة.
  // القاعدة بكل اللعبة: أيقونة لأدوات التحكم، وإيموجي داخل الجُمل بس (رسائل اللعب).
  // المقاس بالـem مع vertical-align عشان ما تغيّر ارتفاع السطر ولا تمس أي قياس.
  const ICON_PATHS = {
    // خانة انكشف فيها حرف — من مفردة اللعبة نفسها. عمداً قليلة الخطوط: الأيقونة
    // تنعرض بحدود ١٣px، وأي تفصيل زيادة يتحوّل لطخة
    letter: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 9v6"/><path d="M9.5 15h5"/>',
    // خانتان متراكبتان = تكرار
    repeat: '<rect x="3.5" y="3.5" width="12" height="12" rx="3.5"/><path d="M8.5 20.5h9a3 3 0 0 0 3-3v-9"/>',
    // مصباح
    bulb: '<path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.5.4.5 1 .5 1.6v.5h6v-.5c0-.6 0-1.2.5-1.6A6 6 0 0 0 12 3z"/>',
    // بوق — الاسم عربي ومعناه بوق فعلاً
    horn: '<path d="M3 10.5v3a1.5 1.5 0 0 0 1.5 1.5H7l7 4.5V4.5L7 9H4.5A1.5 1.5 0 0 0 3 10.5z"/><path d="M17.5 8.5a5 5 0 0 1 0 7"/><path d="M20 6a8.5 8.5 0 0 1 0 12"/>',
    // عَلَم
    flag: '<path d="M6 21V4"/><path d="M6 4.5h11l-2.5 4 2.5 4H6"/>',
    // سهم للأمام (يشير لجهة السرد العربي: يسار)
    next: '<path d="M20 12H5"/><path d="M11 6l-6 6 6 6"/>',
    // شبكة مربّعات = كل الفئات
    grid: '<rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/>',
    // كأس
    trophy: '<path d="M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M7 6H4.5v1.5A3.5 3.5 0 0 0 8 11"/><path d="M17 6h2.5v1.5A3.5 3.5 0 0 1 16 11"/><path d="M12 14v3"/><path d="M8.5 20h7"/>',
    sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>',
    // المؤقّت: شغّال / موقوف
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    pause: '<circle cx="12" cy="12" r="8.5"/><path d="M10 9v6M14 9v6"/>',
  };

  function iconSvg(name) {
    return (
      '<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" ' +
      'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      ICON_PATHS[name] +
      "</svg>"
    );
  }

  // يعبّي عنصراً بأيقونة + نص. نستخدم textContent للنص عشان ما ندخل HTML من بيانات
  // اللعبة (أسماء الفرق يكتبها اللاعبون)
  function setIconLabel(el, name, text) {
    el.innerHTML = iconSvg(name);
    el.appendChild(document.createTextNode(" " + text));
  }

  function renderGrid(gridEl, opts) {
    const { guesses, currentGuess, wordLength, maxAttempts } = opts;
    const spaces = opts.spaceIndexes instanceof Set ? opts.spaceIndexes : new Set(opts.spaceIndexes || []);
    // حروف تلميح "اكشف حرف" — تنعرض كطيف باهت بمكانها ولا تدخل التخمين. اللاعب حر
    // يكتبها أو يكتب غيرها؛ أول ما يكتب بالخانة يغطّي الطيف، ولو مسح يرجع
    const hinted = opts.hintedLetters || {};

    // صفوف السرقة (البوق) تنضاف فوق العدد الأصلي عشان الفريق الأصلي ما يخسر محاولاته.
    // ملاحظة: guesses.length ما يتجاوز maxAttempts+stealRows أبداً بالتصميم الحالي
    // (الجولة تنتهي بمجرد الوصول للحد، وزر البوق ينقفل بمجرد gameOver) — فما نحتاج
    // أي هامش زيادة، وأي هامش كان يطلع صف فاضي زيادة بعد آخر محاولة
    const stealRows = guesses.filter((g) => g && g.steal).length;
    const totalRows = maxAttempts + stealRows;

    // كشف الصف المُرسَل حديثاً: الشبكة تُرسم من الصفر مع كل ضغطة حرف، فلو علّقنا
    // الحركة على كل الصفوف المُرسلة راح تنعاد بكل ضغطة. نتذكّر عدد التخمينات على
    // العنصر نفسه، والحركة تشتغل بس لما يزيد — فتنطبق مرة وحدة على الصف الجديد،
    // وتشتغل بنفس الكود على جهاز اللاعب وأجهزة المتفرجين بالأونلاين
    const prevCount = gridEl._lastGuessCount;
    const revealRow = prevCount != null && guesses.length > prevCount ? guesses.length - 1 : -1;
    gridEl._lastGuessCount = guesses.length;

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
          if (row === revealRow) {
            tile.classList.add("reveal");
            tile.style.setProperty("--reveal-delay", col * 0.07 + "s");
          }
        } else if (isCurrentRow && currentGuess[col]) {
          tile.textContent = currentGuess[col];
          tile.classList.add("filled");
        } else if (isCurrentRow && hinted[col]) {
          tile.textContent = hinted[col];
          tile.classList.add("ghost");
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

    // قيد الارتفاع له أرضية، وقيد العرض ما له. الفرق مقصود:
    // - لو الطول ما يكفي، الشبكة تنزل وتصعد داخل .wordle-grid-scroll — أحسن من إننا
    //   نصغّر الخانة لدرجة ما تنقرا (٢٠px بالعرضي كانت النتيجة قبل).
    // - لو العرض ما يكفي، ما نقدر نتجاوزه: الشبكة بتطلع برّا الشاشة أفقياً، وتمرير
    //   الكلمة يمين ويسار يخرب اللعبة نفسها. فالعرض يبقى سقفاً صلباً.
    const READABLE = 26;
    const byHeight = Math.max(READABLE, rawHeight);
    const size = Math.max(13, Math.min(72, Math.floor(Math.min(rawWidth, byHeight))));
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
    const add = (text, cls, icon) => {
      const pill = document.createElement("span");
      pill.className = "cat-pill" + (cls ? " " + cls : "");
      if (icon) setIconLabel(pill, icon, text);
      else pill.textContent = text;
      el.appendChild(pill);
    };

    if (all) {
      add("كل الفئات", "all", "grid");
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
    setIconLabel(timerEl, pausedRemainingMs != null ? "pause" : "clock", Core.formatClock(seconds));
    timerEl.classList.toggle("low", pausedRemainingMs == null && seconds <= 10);
  }

  function renderFinalScores(els, teams) {
    const sorted = teams.slice().sort((a, b) => b.score - a.score);
    const topScore = sorted[0].score;
    const winners = sorted.filter((t) => t.score === topScore);

    if (winners.length > 1) {
      setIconLabel(els.winnerName, "trophy", "تعادل بين: " + winners.map((w) => w.name).join(" و "));
    } else {
      setIconLabel(els.winnerName, "trophy", "الفريق الفائز: " + winners[0].name);
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
    iconSvg,
    setIconLabel,
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
