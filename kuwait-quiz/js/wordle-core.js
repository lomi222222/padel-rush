// منطق لعبة "صيد الكلمة" بدون أي تعامل مع الواجهة — مشترك بين الوضع المحلي والأونلاين.
// كل الدوال هنا نقية أو تشتغل على كائنات تُمرَّر لها، عشان نفس المنطق يشتغل على جهاز
// الهوست (اللي يمسك الكلمة السرية) وعلى أجهزة اللاعبين (اللي ما تعرف الكلمة).
(function () {
  "use strict";

  const ARABIC_LETTER_RE = /^[ء-ي]$/;
  const ARABIC_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  const TEAM_COLORS = ["#12539f", "#06264a"];

  // عدد جولات كل فريق — يختاره الهوست. كل فريق يلعب نفس العدد فما فيه أفضلية للبادئ
  const ROUND_COUNT_OPTIONS = [3, 5, 7, 10];
  const DEFAULT_ROUNDS = 5;

  const KEYBOARD_ROWS = [
    ["ض", "ص", "ث", "ق", "ف", "غ", "ع", "ه", "خ", "ح", "ج"],
    ["ش", "س", "ي", "ب", "ل", "ا", "ت", "ن", "م", "ك", "ة"],
    ["ء", "ظ", "ط", "ذ", "د", "ز", "ر", "و", "ى", "DEL"],
    ["ئ", "ؤ", "ENTER"],
  ];

  const ALL_CATEGORIES = [...new Set(WORDS.map((w) => w.category))];

  // فئات تُلعب لحالها: أسماؤها تحتوي أسماء وحيوانات وأماكن... فلو انخلطت مع فئة ثانية
  // صار التلميح بالفئة بلا معنى. اختيارها يلغي الباقي والعكس، وزر "الكل" ما يشملها.
  const EXCLUSIVE_CATEGORIES = new Set(["سور القرآن الكريم"]);
  const SELECTABLE_CATEGORIES = ALL_CATEGORIES.filter((c) => !EXCLUSIVE_CATEGORIES.has(c));

  // البوق: الفريق المنتظر يقاطع ويسرق الكلمة — محاولة وحدة.
  //
  // عدد البوقات يتوسّع مع عدد الجولات عمداً. البوق ياخذ قيمة الجولة كاملة، فلو خليناه
  // ثابتاً (٢) يصير معناه مختلفاً تماماً حسب طول المباراة: بـ٣ جولات يكون متاحاً
  // بـ٦٧٪ من أدوار انتظارك فتصير اللعبة "لعبة بوق"، وبـ١٠ جولات ينزل لـ٢٠٪ فيصير
  // هامشاً. القسمة على ٢.٥ تثبّت النسبة تقريباً: ٣→١، ٥→٢، ٧→٣، ١٠→٤
  function boqForRounds(roundsPerTeam) {
    return Math.max(1, Math.round(roundsPerTeam / 2.5));
  }

  const BOQ_ATTEMPTS = 1;

  // مدة الجولة (بالثواني) — 0 يعني بدون وقت، و CUSTOM_TIME يفتح حقل رقم بالدقائق
  const CUSTOM_TIME = -1;
  const ROUND_TIME_OPTIONS = [
    { value: 0, label: "بدون وقت" },
    { value: 30, label: "٣٠ ثانية" },
    { value: 60, label: "دقيقة" },
    { value: 120, label: "دقيقتان" },
    { value: 180, label: "٣ دقائق" },
    { value: 300, label: "٥ دقائق" },
    { value: CUSTOM_TIME, label: "⏱️ وقت مخصص" },
  ];

  // يقرأ مدة الجولة من قائمة الاختيار + حقل الدقائق المخصص
  function readRoundSeconds(selectEl, customInputEl) {
    const picked = Number(selectEl.value);
    if (picked !== CUSTOM_TIME) return picked > 0 ? picked : 0;
    const minutes = Number(customInputEl.value);
    if (!isFinite(minutes) || minutes <= 0) return 0;
    return Math.round(Math.min(minutes, 60) * 60);
  }

  // نص عدد المحاولات المتبقية للسرقة بصيغة عربية سليمة
  // تمييز العدد بالعربي: ٢ مثنى، ٣-١٠ جمع، ١١ فما فوق مفرد منصوب
  function countLabel(n, forms) {
    if (n === 1) return forms.one;
    if (n === 2) return forms.two;
    return toArabicDigits(n) + " " + (n <= 10 ? forms.few : forms.many);
  }

  const ATTEMPT_FORMS = { one: "محاولة وحدة", two: "محاولتين", few: "محاولات", many: "محاولة" };

  function stealAttemptsLabel(n) {
    return countLabel(n, ATTEMPT_FORMS);
  }

  // نص خيار عدد الجولات — عبر countLabel عشان التمييز يظل سليماً لو انضافت خيارات
  // خارج نطاق ٣-١٠ بعدين (١ تصير "جولة" و٢ "جولتين" بدل "١ جولات")
  function roundCountLabel(n) {
    return countLabel(n, { one: "جولة", two: "جولتين", few: "جولات", many: "جولة" }) + " لكل فريق";
  }

  // يطبّق اختيار/إلغاء فئة مع مراعاة الحصرية، ويرجّع المجموعة الجديدة
  function applyCategoryToggle(selected, category, checked) {
    const next = new Set(selected);
    if (!checked) {
      next.delete(category);
      return next;
    }
    if (EXCLUSIVE_CATEGORIES.has(category)) return new Set([category]);
    [...next].forEach((c) => {
      if (EXCLUSIVE_CATEGORIES.has(c)) next.delete(c);
    });
    next.add(category);
    return next;
  }

  function hasExclusive(selected) {
    return [...selected].some((c) => EXCLUSIVE_CATEGORIES.has(c));
  }

  function toArabicDigits(n) {
    return String(n)
      .split("")
      .map((d) => (ARABIC_DIGITS[+d] !== undefined ? ARABIC_DIGITS[+d] : d))
      .join("");
  }

  function defaultTeamName(i) {
    return "الفريق " + (i === 0 ? "الأول" : "الثاني");
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // كيس عشوائي: نخلط كل كلمات الفئات المختارة، ونسحب منه بدون تكرار حتى ينفد كامل
  // الكيس — بعدها نرجع نخلطه من جديد. هذا يمنع تكرار نفس الكلمة قبل ما تُستخدم كل
  // الكلمات المتاحة مرة وحدة على الأقل.
  function makeWordBag(selectedCategories) {
    let bag = [];

    function refill() {
      const pool = WORDS.filter((w) => selectedCategories.has(w.category));
      bag = shuffle(pool.slice());
    }

    function pick(lastWord) {
      if (bag.length === 0) refill();
      const entry = bag.pop();
      // تحسّب احتياطي: لو أول كلمة بالكيس الجديد نفس آخر كلمة تكررت (ممكن يصير بس
      // بفئات صغيرة جداً)، بدّلها مع كلمة ثانية بالكيس
      if (entry.word === lastWord && bag.length > 0) {
        const swapIdx = Math.floor(Math.random() * bag.length);
        bag.push(entry);
        return bag.splice(swapIdx, 1)[0];
      }
      return entry;
    }

    return {
      refill,
      pick,
      size: () => bag.length,
      toJSON: () => bag.map((e) => e.word),
      restore(words) {
        const byWord = new Map(WORDS.map((w) => [w.word, w]));
        bag = words.map((w) => byWord.get(w)).filter(Boolean);
      },
    };
  }

  // كل حرفين زيادة = محاولة زيادة: ٣←٤، ٤و٥←٥، ٦و٧←٦، ٨و٩←٧ ...
  function attemptsForLength(wordLength) {
    return 3 + Math.ceil((Math.max(wordLength, 1) - 1) / 2);
  }

  function spaceIndexesOf(targetChars) {
    const out = [];
    targetChars.forEach((c, i) => {
      if (c === " ") out.push(i);
    });
    return out;
  }

  // ===== مخزن التخمين: مصفوفة بطول الكلمة، كل خانة بموضعها =====
  //
  // كان المخزن يُبنى بـpush والطول هو موضع الكتابة، فالكتابة كانت بالترتيب إجبارياً.
  // صار بطول ثابت عشان اللاعب يقدر يضغط أي خانة ويكتب فيها: خانة فاضية = ""،
  // وخانة مسافة = " " موضوعة من البداية بمكانها الصحيح.
  //
  // "" مو undefined عمداً: فايربيس يشيل undefined من المصفوفات فتنخرب المواضع.
  //
  // ملاحظة: الحروف الملمّحة (تلميح "اكشف حرف") ما تدخل المخزن أبداً — تُرسم كطيف بس،
  // شوف renderGrid. فالمخزن دايماً حروف اللاعب + المسافات، ولا شي غيرهم.
  const asSpaces = (s) => (s instanceof Set ? s : new Set(s || []));

  function makeGuessBuffer(wordLength, spaceIndexes) {
    const spaces = asSpaces(spaceIndexes);
    return Array.from({ length: wordLength }, (_, i) => (spaces.has(i) ? " " : ""));
  }

  const isWritable = (buf, i, spaceIndexes) =>
    i >= 0 && i < buf.length && !asSpaces(spaceIndexes).has(i);

  function writeAt(buf, i, ch, spaceIndexes) {
    if (isWritable(buf, i, spaceIndexes)) buf[i] = ch;
    return buf;
  }

  function clearAt(buf, i, spaceIndexes) {
    if (isWritable(buf, i, spaceIndexes)) buf[i] = "";
    return buf;
  }

  // أول خانة فاضية بعد from — حركة المؤشر بعد كتابة حرف. على صف فاضي تعطي
  // الموضع التالي مباشرة، فالكتابة بالترتيب تحس نفسها بالضبط
  function nextEmpty(buf, from, spaceIndexes) {
    const spaces = asSpaces(spaceIndexes);
    for (let i = from; i < buf.length; i++) if (!spaces.has(i) && !buf[i]) return i;
    return -1;
  }

  function firstWritable(buf, spaceIndexes) {
    const spaces = asSpaces(spaceIndexes);
    for (let i = 0; i < buf.length; i++) if (!spaces.has(i)) return i;
    return -1;
  }

  // الخانة القابلة للكتابة قبل from — يستخدمها المسح لما تكون الخانة الحالية فاضية
  function prevWritable(buf, from, spaceIndexes) {
    const spaces = asSpaces(spaceIndexes);
    for (let i = from - 1; i >= 0; i--) if (!spaces.has(i)) return i;
    return -1;
  }

  // يحل محل فحص `length < wordLength` القديم: الطول صار ثابتاً دائماً، فالاكتمال
  // يعني ألا تبقى خانة فاضية
  function isGuessComplete(buf, spaceIndexes) {
    const spaces = asSpaces(spaceIndexes);
    for (let i = 0; i < buf.length; i++) if (!spaces.has(i) && !buf[i]) return false;
    return buf.length > 0;
  }

  function evaluateGuess(guessChars, targetChars) {
    const wordLength = targetChars.length;
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

  function mergeKeyStatus(keyStatus, chars, statuses) {
    chars.forEach((ch, i) => {
      const s = statuses[i];
      if (!keyStatus[ch] || statusRank(s) > statusRank(keyStatus[ch])) {
        keyStatus[ch] = s;
      }
    });
    return keyStatus;
  }

  // ===== نقاط الجولة =====
  // المحاولة الأولى = 200×N (مضاعفة تلقائياً)، وأي محاولة بعدها = 100×(N-k+1)
  function rawScoreForAttempt(attemptNumber, maxAttempts) {
    if (attemptNumber === 1) return 200 * maxAttempts;
    return 100 * (maxAttempts - attemptNumber + 1);
  }

  function finalScoreForAttempt(attemptNumber, maxAttempts, hints) {
    let score = rawScoreForAttempt(attemptNumber, maxAttempts);
    const flatDeduction = (hints.repeatUsed ? 50 : 0) + hints.revealLetterUses * 100;
    score = Math.max(0, score - flatDeduction);
    if (hints.categoryUsed) score = Math.floor(score / 2);
    return score;
  }

  function newHints() {
    return { categoryUsed: false, repeatUsed: false, revealLetterUses: 0 };
  }

  // «اكشف حرف» هي المساعدة الوحيدة اللي تتكرر، فلازم لها حد أقصى: بدونه يقدر
  // اللاعب يكشف الكلمة كاملة، وبعد ما النقاط توصل صفر ما فيه شي يوقفه لأن الخصم
  // ما ينزل تحت الصفر (شوف Math.max بـfinalScoreForAttempt) — فالكشف يصير مجانياً
  const MAX_REVEAL_LETTER_USES = 2;

  function revealLetterUsesLeft(hints) {
    const used = (hints && hints.revealLetterUses) || 0;
    return Math.max(0, MAX_REVEAL_LETTER_USES - used);
  }

  // النقاط اللي بياخذها الفريق لو حزرها بالمحاولة الجاية — نفس حساب لحظة الفوز
  // بالضبط عشان المعروض ما يختلف عن المقبوض.
  // مع البوق: القيمة تنثبّت من لحظة السرقة (steal.value) فما تتأثر بأي مساعدة
  // بعدها، وهذا مقصود — السارق ياخذ الرقم اللي وافق عليه.
  // attemptsMade لازم تكون محاولات الفريق نفسه بدون محاولات السرقة.
  function potentialScore(opts) {
    if (opts.steal) return opts.steal.value;
    // الحالة المنشورة من فايربيس ممكن ترجع بحقول ناقصة (فايربيس ما يخزّن null)،
    // فنكمّلها هني بدل ما يطلع NaN بوجه اللاعب
    const h = Object.assign(newHints(), opts.hints || {});
    return finalScoreForAttempt(opts.attemptsMade + 1, opts.maxAttempts, h);
  }

  // نص الرقم زي ما ينعرض جنب المحاولات: «٦٠٠ نقطة» — نفس صيغة رسالة الفوز
  function potentialScoreLabel(opts) {
    return toArabicDigits(potentialScore(opts)) + " نقطة";
  }

  function categoriesLabel(selectedCategories) {
    const size = selectedCategories instanceof Set ? selectedCategories.size : selectedCategories.length;
    if (size === SELECTABLE_CATEGORIES.length && !hasExclusive(selectedCategories)) {
      return "الفئات: الكل";
    }
    return "الفئات: " + [...selectedCategories].join("، ");
  }

  function formatClock(seconds) {
    const s = Math.max(0, Math.ceil(seconds));
    const m = Math.floor(s / 60);
    return toArabicDigits(m) + ":" + toArabicDigits(String(s % 60).padStart(2, "0"));
  }

  function roundSubtitle(teamName, roundNumber, wordLength, maxAttempts, spaceIndexes, roundsPerTeam) {
    // المسافات في العناوين متعددة الكلمات تنعبّي تلقائياً، فما تنعدّ حروفاً
    const spaces = spaceIndexes instanceof Set ? spaceIndexes.size : (spaceIndexes || []).length;
    const letters = Math.max(1, wordLength - spaces);

    return (
      "دور " +
      teamName +
      " (الجولة " +
      toArabicDigits(roundNumber) +
      " من " +
      toArabicDigits(roundsPerTeam || DEFAULT_ROUNDS) +
      ") — " +
      (spaces ? countLabel(spaces + 1, { one: "كلمة", two: "كلمتين", few: "كلمات", many: "كلمة" }) : "كلمة") +
      " من " +
      countLabel(letters, { one: "حرف واحد", two: "حرفين", few: "أحرف", many: "حرفاً" }) +
      " " +
      SUBTITLE_TAIL_MARK +
      " " +
      countLabel(maxAttempts, ATTEMPT_FORMS)
    );
  }

  // آخر جزء بالعنوان («خلال ٦ محاولات»). الواجهة تفصله عشان تلصق رقم النقاط فيه
  // بمجموعة ما تنكسر، فيظل الرقم على يسار «المحاولات» مهما لف السطر.
  // بالأونلاين العنوان يوصل نص جاهز من الهوست، فالفصل لازم يصير من النص نفسه —
  // وهني المكان الوحيد اللي يعرف الصيغة، فما يصير انحراف بين البناء والفصل
  const SUBTITLE_TAIL_MARK = "خلال";

  function splitRoundSubtitle(text) {
    const s = text || "";
    const i = s.lastIndexOf(" " + SUBTITLE_TAIL_MARK + " ");
    if (i < 0) return { head: s, tail: "" };
    return { head: s.slice(0, i), tail: s.slice(i + 1) };
  }

  // هل زر التلميح "حرف موجود" لازم ينقفل؟ (كل حروف الكلمة صارت معروفة)
  function allLettersKnown(targetChars, keyStatus) {
    const relevantChars = [...new Set(targetChars)].filter((c) => c !== " ");
    return relevantChars.every((c) => keyStatus[c] === "green");
  }

  // منطق تلميح "حرف موجود" — يرجّع وصف التغيير بدون ما يلمس الواجهة
  function revealLetterHint(targetChars, keyStatus) {
    const yellowLetter = Object.keys(keyStatus).find((l) => keyStatus[l] === "yellow" && l !== " ");
    if (yellowLetter) {
      const pos = targetChars.indexOf(yellowLetter);
      return {
        letter: yellowLetter,
        status: "green",
        pos,
        text: 'الحرف "' + yellowLetter + '" في الموضع ' + toArabicDigits(pos + 1),
      };
    }
    const revealed = new Set(Object.keys(keyStatus));
    const candidates = [...new Set(targetChars)].filter((c) => !revealed.has(c) && c !== " ");
    if (candidates.length === 0) return null;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    return { letter: pick, status: "yellow", text: 'الحرف "' + pick + '" موجود في الكلمة' };
  }

  function repeatHintText(targetChars) {
    const hasDup = new Set(targetChars).size !== targetChars.length;
    return hasDup ? "نعم، يوجد حرف متكرر في الكلمة" : "لا، لا يوجد حرف متكرر في الكلمة";
  }

  window.WordleCore = {
    ARABIC_LETTER_RE,
    TEAM_COLORS,
    ROUND_COUNT_OPTIONS,
    DEFAULT_ROUNDS,
    roundCountLabel,
    KEYBOARD_ROWS,
    ALL_CATEGORIES,
    EXCLUSIVE_CATEGORIES,
    SELECTABLE_CATEGORIES,
    boqForRounds,
    BOQ_ATTEMPTS,
    ROUND_TIME_OPTIONS,
    CUSTOM_TIME,
    readRoundSeconds,
    stealAttemptsLabel,
    applyCategoryToggle,
    hasExclusive,
    formatClock,
    toArabicDigits,
    defaultTeamName,
    shuffle,
    makeWordBag,
    attemptsForLength,
    spaceIndexesOf,
    makeGuessBuffer,
    writeAt,
    clearAt,
    nextEmpty,
    firstWritable,
    prevWritable,
    isGuessComplete,
    evaluateGuess,
    statusRank,
    mergeKeyStatus,
    rawScoreForAttempt,
    finalScoreForAttempt,
    potentialScore,
    potentialScoreLabel,
    MAX_REVEAL_LETTER_USES,
    revealLetterUsesLeft,
    splitRoundSubtitle,
    newHints,
    categoriesLabel,
    roundSubtitle,
    allLettersKnown,
    revealLetterHint,
    repeatHintText,
  };
})();
