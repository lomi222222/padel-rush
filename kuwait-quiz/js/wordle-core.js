// منطق لعبة "احزر الكلمة" بدون أي تعامل مع الواجهة — مشترك بين الوضع المحلي والأونلاين.
// كل الدوال هنا نقية أو تشتغل على كائنات تُمرَّر لها، عشان نفس المنطق يشتغل على جهاز
// الهوست (اللي يمسك الكلمة السرية) وعلى أجهزة اللاعبين (اللي ما تعرف الكلمة).
(function () {
  "use strict";

  const ARABIC_LETTER_RE = /^[ء-ي]$/;
  const ARABIC_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  const TEAM_COLORS = ["#12539f", "#06264a"];
  const ROUNDS_PER_TEAM = 5;

  const KEYBOARD_ROWS = [
    ["ض", "ص", "ث", "ق", "ف", "غ", "ع", "ه", "خ", "ح", "ج"],
    ["ش", "س", "ي", "ب", "ل", "ا", "ت", "ن", "م", "ك", "ة"],
    ["ء", "ظ", "ط", "ذ", "د", "ز", "ر", "و", "ى", "DEL"],
    ["ئ", "ؤ", "ENTER"],
  ];

  const ALL_CATEGORIES = [...new Set(WORDS.map((w) => w.category))];

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

  function attemptsForLength(wordLength) {
    return 3 + Math.floor(wordLength / 3);
  }

  function spaceIndexesOf(targetChars) {
    const out = [];
    targetChars.forEach((c, i) => {
      if (c === " ") out.push(i);
    });
    return out;
  }

  // الكلمات المكوّنة من كلمتين تحتوي على مسافة بينهما — نملأ خانة المسافة تلقائياً في
  // مكانها الصحيح بدل ما نطلب من اللاعب يكتبها بنفسه. نمرر مواضع المسافات (مو الكلمة
  // نفسها) عشان جهاز اللاعب بالأونلاين يقدر يسوي نفس الشي بدون ما يعرف الكلمة.
  function autoFillSpaces(currentGuess, wordLength, spaceIndexes) {
    const spaces = spaceIndexes instanceof Set ? spaceIndexes : new Set(spaceIndexes || []);
    while (currentGuess.length < wordLength && spaces.has(currentGuess.length)) {
      currentGuess.push(" ");
    }
    return currentGuess;
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

  function categoriesLabel(selectedCategories) {
    const size = selectedCategories instanceof Set ? selectedCategories.size : selectedCategories.length;
    if (size === ALL_CATEGORIES.length) return "الفئات: الكل";
    return "الفئات: " + [...selectedCategories].join("، ");
  }

  function roundSubtitle(teamName, roundNumber, wordLength, maxAttempts) {
    return (
      "دور " +
      teamName +
      " (الجولة " +
      toArabicDigits(roundNumber) +
      " من " +
      toArabicDigits(ROUNDS_PER_TEAM) +
      ") — كلمة من " +
      toArabicDigits(wordLength) +
      " أحرف خلال " +
      toArabicDigits(maxAttempts) +
      " محاولات"
    );
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
        text: '🔤 الحرف "' + yellowLetter + '" في الموضع ' + toArabicDigits(pos + 1),
      };
    }
    const revealed = new Set(Object.keys(keyStatus));
    const candidates = [...new Set(targetChars)].filter((c) => !revealed.has(c) && c !== " ");
    if (candidates.length === 0) return null;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    return { letter: pick, status: "yellow", text: '🔤 الحرف "' + pick + '" موجود في الكلمة' };
  }

  function repeatHintText(targetChars) {
    const hasDup = new Set(targetChars).size !== targetChars.length;
    return hasDup ? "🔁 نعم، يوجد حرف متكرر في الكلمة" : "🔁 لا، لا يوجد حرف متكرر في الكلمة";
  }

  window.WordleCore = {
    ARABIC_LETTER_RE,
    TEAM_COLORS,
    ROUNDS_PER_TEAM,
    KEYBOARD_ROWS,
    ALL_CATEGORIES,
    toArabicDigits,
    defaultTeamName,
    shuffle,
    makeWordBag,
    attemptsForLength,
    spaceIndexesOf,
    autoFillSpaces,
    evaluateGuess,
    statusRank,
    mergeKeyStatus,
    rawScoreForAttempt,
    finalScoreForAttempt,
    newHints,
    categoriesLabel,
    roundSubtitle,
    allLettersKnown,
    revealLetterHint,
    repeatHintText,
  };
})();
