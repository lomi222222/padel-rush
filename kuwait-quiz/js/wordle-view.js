// دوال رسم واجهة "صيد الكلمة" — كلها "ارسم من الحالة" وتاخذ كل شي تحتاجه كمعاملات
// صريحة، فتنفع للوضع المحلي وللأونلاين بنفس الشكل.
(function () {
  "use strict";

  const Core = window.WordleCore;

  // ===== أيقونات الواجهة =====
  // رسمات خطّية بنفس لغة الصفحة الرئيسية: حد ٢px، currentColor، أطراف مدوّرة.
  // القاعدة بكل اللعبة: أيقونة لأدوات التحكم، وإيموجي داخل الجُمل بس (رسائل اللعب).
  // المقاس بالـem مع vertical-align عشان ما تغيّر ارتفاع السطر ولا تمس أي قياس.
  const ICON_PATHS = {
    // عين = اكشف. جرّبنا قبلها "خانة فيها حرف" وما كانت مفهومة بحجم ١٣px — الشكل
    // الحرفي يحتاج تفاصيل تتحول لطخة، والعين تُقرأ فوراً بأي حجم
    letter: '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="2.8"/>',
    // خانتان متطابقتان = تكرار
    repeat: '<rect x="2.5" y="6.5" width="8.5" height="11" rx="2.5"/><rect x="13" y="6.5" width="8.5" height="11" rx="2.5"/>',
    // مصباح
    bulb: '<path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.5.4.5 1 .5 1.6v.5h6v-.5c0-.6 0-1.2.5-1.6A6 6 0 0 0 12 3z"/>',
    // البوق = سرقة الكلمة من الفريق الثاني، فالأيقونة لصّ: قبّعة مصمتة فوق وقناع
    // عيون تحتها (الشكل اللي اختاره المستخدم من صورة مرجعية).
    // الفرق الجوهري بين قناع اللص وقناع النوم هو الحافة السفلية: فصّان بينهما
    // قمّة بالنص. القوس الواحد المستمر يطلع قناع نوم — جرّبناه وانرفض.
    // الشكلان معبّيان والفتحات مقطوعة بـevenodd: الصورة الظلّية تُقرأ بحجم ١٥px
    // بينما الخطوط الرفيعة تضيع. والرسمة تملأ إطار الـ24 كامل عشان تطلع بأكبر حجم
    // بدون تكبير الأيقونة نفسها (تكبيرها يكبّر صندوق السطر وياكل من ارتفاع الشبكة)
    thief:
      '<path fill="currentColor" stroke="none" fill-rule="evenodd" d="' +
      // القبّعة
      "M2.9 10.1 C2.9 5.3 6.9 1.8 12 1.8 C17.1 1.8 21.1 5.3 21.1 10.1 Z " +
      // القناع: حافة عليا شبه مستقيمة، وحافة سفلى بفصّين وقمّة بالنص
      "M1.3 15.1 C1.3 13.6 2.5 12.4 4 12.4 H20 C21.5 12.4 22.7 13.6 22.7 15.1 " +
      "C22.7 18.7 20.2 21.8 16.8 21.8 C14.6 21.8 13 20.3 12 18.4 " +
      "C11 20.3 9.4 21.8 7.2 21.8 C3.8 21.8 1.3 18.7 1.3 15.1 Z " +
      // فتحتا العين — بيضاويتان مو دائرتين، أقرب لشكل العين
      "M7.6 18.4 A2.7 2.3 0 1 0 7.6 13.8 A2.7 2.3 0 0 0 7.6 18.4 Z " +
      'M16.4 18.4 A2.7 2.3 0 1 0 16.4 13.8 A2.7 2.3 0 0 0 16.4 18.4 Z"/>',
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
    // صح — تأكيد نجاح عملية (مثلاً: اننسخ الرابط)
    check: '<path d="M4.5 12.5l5 5 10-11"/>',
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

  // تحت هالحجم الحرف العربي ما ينقرا — الخط نصف الخانة وأرضيته ١٠px
  const WIDE_GRID_BELOW = 30;

  // الفراغات تضيق كل ما طالت الكلمة: ١٢ خانة بشاشة ٣٩٠ تعني الفراغات وحدها تاكل
  // خُمس السطر، فنضيّقها عشان الحرف نفسه يكبر
  function spacingFor(wordLength) {
    const narrow = window.innerWidth <= 400;
    return {
      gapPx: wordLength >= 10 ? 3 : wordLength >= 7 ? 5 : narrow ? 6 : 8,
      spacerWidth: wordLength >= 10 ? 9 : narrow ? 14 : 20,
    };
  }

  // عرض الخانة اللي يسمح به عرض الحاوية الحالي
  function widthPerTile(container, opts) {
    const { wordLength } = opts;
    const spaceCount = opts.spaceCount || 0;
    const cs = getComputedStyle(container);
    const paddingX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    const available = Math.max(container.clientWidth - paddingX, 200);
    const { gapPx, spacerWidth } = spacingFor(wordLength);
    const numLetters = Math.max(1, wordLength - spaceCount);
    return (available - gapPx * (wordLength - 1) - spacerWidth * spaceCount) / numLetters;
  }

  // يقرر: هل ننزّل الكيبورد تحت عشان الشبكة تاخذ العرض كله؟
  //
  // **القرار يُقاس دائماً من الحالة الضيّقة** — نشيل الراية ونقيس ثم نقرر. لو
  // قِسنا من الحالة الحالية لتذبذب: بالعريض العرض كبير فالجواب "لا نحتاج"، وأول
  // ما نرجع ضيّق يصير "نحتاج"، وهكذا مع كل تغيير مقاس.
  function decideWideGrid(gridEl, opts) {
    const wrap = gridEl.closest(".wordle-wrap");
    if (!wrap) return;
    wrap.removeAttribute("data-wide-grid");
    // قراءة clientWidth بعد الشيل تجبر إعادة تخطيط، فالقياس يطلع للحالة الضيّقة
    if (widthPerTile(gridEl.parentElement, opts) < WIDE_GRID_BELOW) {
      wrap.setAttribute("data-wide-grid", "");
    }
  }

  function sizeTiles(gridEl, allowed) {
    const opts = gridEl._tileOpts;
    if (!opts || !allowed) return;
    const { wordLength, maxAttempts } = opts;
    const spaceCount = opts.spaceCount || 0;

    // العرض هو القيد القاتل بالوضع العرضي: الكيبورد ياخذ عموداً جنب الشبكة فيقسم
    // العرض نصّين، وكلمة ١٥ خانة تطلع خانتها ١٨px وخطها يوصل أرضيته فيختفي الحرف.
    // القرار هني مو بالـCSS لأن CSS ما يعرف طول الكلمة
    decideWideGrid(gridEl, opts);

    const container = gridEl.parentElement;
    const cs = getComputedStyle(container);
    const { gapPx, spacerWidth } = spacingFor(wordLength);

    const rawWidth = widthPerTile(container, opts);

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
    // أرضية الارتفاع: تحتها تنمرَّر الصفوف رأسياً بدل ما تصغر الخانة.
    // بالتخطيط العريض نرفعها — هناك نزّلنا الكيبورد عمداً عشان الخانة تكبر، فلو
    // خلّينا الأرضية ٢٦ صارت هي السقف وضاع المكسب كله (قِسناه: ٢٦px بدل ٤٣).
    // والتمرير الرأسي مقبول هناك أصلاً، وهو اللي طلبه المستخدم صراحةً
    const isWide = gridEl.closest(".wordle-wrap")?.hasAttribute("data-wide-grid");
    const READABLE = isWide ? 40 : 26;
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
  // ===== نافذة منبثقة صغيرة =====
  // تُلحق بـdocument.body بموضع fixed — مو داخل عمود المعلومات: .wordle-info فيه
  // overflow-y:auto و #wordle-play-screen فيه overflow:hidden، فأي شي بموضع مطلق
  // جوّاهم ينقص. والإحداثيات تنحسب من صندوق الزر وتنحصر داخل الشاشة.
  // كل النوافذ المفتوحة — فتح وحدة يسكّر الباقي، وإلا انفتحت نافذتان فوق بعض
  // (سجل التلميحات + قائمة الفئات) وتغطّيان الشاشة
  const openPopovers = [];

  // opts.placeBelow: عنصر يُحسب الموضع الرأسي تحته بدل الزر نفسه. نحتاجه لسجل
  // التلميحات: زرّه بصف البوق، فلو انفتحت تحته مباشرة غطّت أزرار المساعدات
  // اللي تحته — وهي تنفتح تلقائياً بعد كل تلميح، فتصير حاجزاً أمام التلميح التالي
  function createPopover(anchor, fill, opts) {
    const panel = document.createElement("div");
    panel.className = "kw-popover hidden";
    document.body.appendChild(panel);

    function place() {
      const a = anchor.getBoundingClientRect();
      const below = (opts && opts.placeBelow) || anchor;
      const b = below.getBoundingClientRect();
      // نقيسه وهو ظاهر عشان العرض والارتفاع يكونون حقيقيين
      const p = panel.getBoundingClientRect();
      const margin = 8;
      // تحت العنصر المرجعي، وفوق الزر لو ما فيه مساحة
      let top = b.bottom + 6;
      if (top + p.height > window.innerHeight - margin) {
        top = Math.max(margin, a.top - p.height - 6);
      }
      // متمركز أفقياً على الزر ومحصور داخل الشاشة
      let left = a.left + a.width / 2 - p.width / 2;
      left = Math.max(margin, Math.min(left, window.innerWidth - p.width - margin));
      panel.style.top = Math.round(top) + "px";
      panel.style.left = Math.round(left) + "px";
    }

    function isOpen() {
      return !panel.classList.contains("hidden");
    }

    function close() {
      if (!isOpen()) return;
      panel.classList.add("hidden");
      anchor.setAttribute("aria-expanded", "false");
      const i = openPopovers.indexOf(api);
      if (i >= 0) openPopovers.splice(i, 1);
      document.removeEventListener("pointerdown", onOutside, true);
      document.removeEventListener("keydown", onKeydown, true);
      window.removeEventListener("resize", close);
    }

    function open() {
      if (isOpen()) return;
      openPopovers.slice().forEach((o) => o.close());
      openPopovers.push(api);
      if (fill) fill(panel);
      panel.classList.remove("hidden");
      anchor.setAttribute("aria-expanded", "true");
      place();
      document.addEventListener("pointerdown", onOutside, true);
      document.addEventListener("keydown", onKeydown, true);
      window.addEventListener("resize", close);
    }

    function onOutside(e) {
      if (panel.contains(e.target) || anchor.contains(e.target)) return;
      close();
    }

    function onKeydown(e) {
      if (e.key === "Escape") close();
    }

    anchor.setAttribute("aria-expanded", "false");
    anchor.addEventListener("click", (e) => {
      e.preventDefault();
      if (anchor.disabled) return;
      isOpen() ? close() : open();
    });

    const api = { panel, open, close, isOpen };
    return api;
  }

  // سطر الجولة: الجزء الأول بعنصر، و«خلال ٦ محاولات» بعنصر ثاني ملصوق برقم
  // النقاط داخل مجموعة ما تنكسر. بالأونلاين يوصلنا العنوان نص جاهز من الهوست،
  // فالفصل يصير هني على النص نفسه بدل ما نغيّر شكل البيانات المنشورة
  function renderRoundLine(subtitleEl, attemptsEl, text) {
    const parts = Core.splitRoundSubtitle(text || "");
    subtitleEl.textContent = parts.head;
    attemptsEl.textContent = parts.tail;
  }

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
    if (list.length <= MAX_SHOWN) return;

    // «+٧» زر حقيقي يفتح كل الفئات المختارة. كان قبلها title بس — والـtitle ما
    // يشتغل باللمس إطلاقاً، يعني على الجوال ما كان فيه أي طريقة يشوف المخفي
    const more = document.createElement("button");
    more.type = "button";
    more.className = "cat-pill more";
    more.textContent = "+" + Core.toArabicDigits(list.length - MAX_SHOWN);
    more.setAttribute("aria-label", "عرض كل الفئات المختارة");
    el.appendChild(more);

    createPopover(more, (panel) => {
      panel.innerHTML = "";
      const title = document.createElement("p");
      title.className = "kw-popover-title";
      title.textContent = "الفئات المختارة";
      panel.appendChild(title);
      const wrap = document.createElement("div");
      wrap.className = "cat-pills";
      list.forEach((cat) => {
        const pill = document.createElement("span");
        pill.className = "cat-pill" + (Core.EXCLUSIVE_CATEGORIES.has(cat) ? " gold" : "");
        pill.textContent = cat;
        wrap.appendChild(pill);
      });
      panel.appendChild(wrap);
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
    const paused = pausedRemainingMs != null;
    setIconLabel(timerEl, paused ? "pause" : "clock", Core.formatClock(seconds));
    // حالة الإيقاف تنقال بكلاس مو بالأيقونة: القراءة من شكل الأيقونة تنكسر مع أي
    // تغيير برسمتها، والكلاس يخلي الحالة متاحة للـCSS بعد
    timerEl.classList.toggle("paused", paused);
    timerEl.classList.toggle("low", !paused && seconds <= 10);
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

  // احتفال إعلان الفوز النهائي: صوت + كونفيتي/ألعاب نارية. يُستدعى مرة وحدة بس عند
  // انتهاء المباراة فعلياً (مو كل جولة) — الأونلاين يتحمّل هو مسؤولية عدم التكرار
  // لأن حالته تنرسم أكثر من مرة من Firebase.
  function celebrateWin() {
    if (window.KwSound) window.KwSound.playWin();
    spawnCelebrationOverlay();
  }

  function spawnCelebrationOverlay() {
    const overlay = document.createElement("div");
    overlay.className = "celebrate-overlay";
    document.body.appendChild(overlay);

    const colors = ["#b8862b", "#06264a", "#e6c15c", "#2f6fb0", "#f6efe0"];

    for (let i = 0; i < 60; i++) {
      const piece = document.createElement("span");
      piece.className = "confetti-piece";
      piece.style.left = Math.random() * 100 + "%";
      piece.style.background = colors[i % colors.length];
      piece.style.setProperty("--spin", Math.random() * 720 - 360 + "deg");
      piece.style.animationDuration = 2.2 + Math.random() * 1.4 + "s";
      piece.style.animationDelay = Math.random() * 0.5 + "s";
      overlay.appendChild(piece);
    }

    for (let b = 0; b < 4; b++) {
      setTimeout(() => spawnFireworkBurst(overlay, colors), b * 350);
    }

    setTimeout(() => overlay.remove(), 3600);
  }

  function spawnFireworkBurst(overlay, colors) {
    const cx = 15 + Math.random() * 70; // vw
    const cy = 12 + Math.random() * 35; // vh
    const particleCount = 18;
    for (let i = 0; i < particleCount; i++) {
      const p = document.createElement("span");
      p.className = "firework-particle";
      const angle = (Math.PI * 2 * i) / particleCount;
      const dist = 55 + Math.random() * 40;
      p.style.left = cx + "vw";
      p.style.top = cy + "vh";
      p.style.background = colors[i % colors.length];
      p.style.setProperty("--dx", Math.cos(angle) * dist + "px");
      p.style.setProperty("--dy", Math.sin(angle) * dist + "px");
      p.style.animationDuration = "0.9s";
      overlay.appendChild(p);
    }
  }

  window.WordleView = {
    iconSvg,
    setIconLabel,
    renderGrid,
    renderKeyboard,
    applyTileSize,
    renderScoreboard,
    renderCategoryPills,
    renderRoundLine,
    createPopover,
    showMessage,
    renderHintLog,
    renderCategoryChecklist,
    renderTimer,
    renderFinalScores,
    celebrateWin,
  };
})();
