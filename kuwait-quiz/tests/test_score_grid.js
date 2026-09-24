// قيد صاحب المشروع: **كل نقطة باللعبة لازم تكون من مضاعفات ٢٥**. «١٨٨ ما يصير».
//
// القيد يعتمد على ترتيب العمليات داخل finalScoreForAttempt: النسبة (الفئة)
// أولاً ثم الخصم الثابت. الخام دايماً مضاعف ١٠٠، و×٠.٧٥ عليه يعطي مضاعف ٢٥،
// وطرح مضاعفات ٢٥ بعده يحافظ على الخاصية. لو انعكس الترتيب تطلع كسور بصمت —
// ما فيه خطأ ولا تحذير، بس اللاعب يشوف ٥٨١.٢٥ بلوحة النقاط.
//
// نشغّل الفحص **داخل الصفحة** على window.WordleCore عشان نختبر الكود المنشور
// نفسه مو نسخة منه.
const { launch, BASE, makeChecker } = require("./_browser");

const check = makeChecker();

(async () => {
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  await page.goto(BASE + "/wordle.html");

  // ===== المسح الشامل =====
  const sweep = await page.evaluate(() => {
    const C = window.WordleCore;
    const bad = [];
    let checked = 0;
    for (let len = 3; len <= 21; len++) {
      const max = C.attemptsForLength(len);
      for (let k = 1; k <= max; k++) {
        for (const cat of [false, true]) {
          for (const rev of [0, 1, 2]) {
            for (const rep of [false, true]) {
              const v = C.finalScoreForAttempt(k, max, {
                categoryUsed: cat,
                revealLetterUses: rev,
                repeatUsed: rep,
              });
              checked++;
              if (!Number.isFinite(v) || v < 0 || v % 25 !== 0) {
                if (bad.length < 3) bad.push({ len, k, cat, rev, rep, v });
              }
            }
          }
        }
      }
    }
    return { checked, bad };
  });

  check(
    "كل النقاط من مضاعفات ٢٥ وغير سالبة",
    sweep.bad.length === 0,
    "فُحصت " + sweep.checked + " حالة" + (sweep.bad.length ? " · مثال " + JSON.stringify(sweep.bad[0]) : "")
  );
  check("المسح غطّى كل الأطوال والمحاولات", sweep.checked > 1500, "عدد الحالات=" + sweep.checked);

  // ===== قيم صريحة: المسح وحده يمر حتى لو الأسعار كلها صفر =====
  const vals = await page.evaluate(() => {
    const C = window.WordleCore;
    const N = C.attemptsForLength(6); // ٦ حروف ⇒ ٦ محاولات ⇒ خام المحاولة ١ = 1200
    const f = (h) =>
      C.finalScoreForAttempt(1, N, Object.assign({ categoryUsed: false, repeatUsed: false, revealLetterUses: 0 }, h));
    return {
      max: N,
      none: f({}),
      cat: f({ categoryUsed: true }),
      rev1: f({ revealLetterUses: 1 }),
      rev2: f({ revealLetterUses: 2 }),
      rep: f({ repeatUsed: true }),
      all: f({ categoryUsed: true, revealLetterUses: 2, repeatUsed: true }),
    };
  });

  check("٦ حروف ⇒ ٦ محاولات", vals.max === 6, "max=" + vals.max);
  check("بلا مساعدة = ١٢٠٠", vals.none === 1200, "" + vals.none);
  check("الفئة ⇒ ناقص ٢٥٪ = ٩٠٠", vals.cat === 900, "" + vals.cat);
  check("اكشف حرف ⇒ ناقص ٥٠ = ١١٥٠", vals.rev1 === 1150, "" + vals.rev1);
  check("كشفان ⇒ ناقص ١٠٠ = ١١٠٠", vals.rev2 === 1100, "" + vals.rev2);
  check("حرف مكرر ⇒ ناقص ٢٥ = ١١٧٥", vals.rep === 1175, "" + vals.rep);
  check("الكل ⇒ ٧٧٥", vals.all === 775, "" + vals.all);

  // ===== المعروض = المقبوض =====
  // potentialScore تمر على نفس الدالة، فلو انفصلا يشوف اللاعب رقماً ويقبض غيره
  const same = await page.evaluate(() => {
    const C = window.WordleCore;
    const N = C.attemptsForLength(6);
    const hints = { categoryUsed: true, repeatUsed: true, revealLetterUses: 1 };
    return {
      shown: C.potentialScore({ attemptsMade: 2, maxAttempts: N, hints }),
      earned: C.finalScoreForAttempt(3, N, hints),
    };
  });
  check("المعروض قبل التخمين = المقبوض بعد الفوز", same.shown === same.earned, same.shown + " / " + same.earned);

  // ===== عدد البوق =====
  const boq = await page.evaluate(() => {
    const C = window.WordleCore;
    return {
      auto: [3, 5, 7, 10].map((r) => C.resolveBoqCount(C.BOQ_AUTO, r)),
      explicit: [0, 1, 4, 7].map((n) => C.resolveBoqCount(String(n), 5)),
      // قيمة محفوظة قديمة أو مخربطة ما تكسر البداية
      junk: C.resolveBoqCount("كلام", 5),
      options: C.BOQ_COUNT_OPTIONS,
    };
  });
  check("تلقائي يتوسّع مع الجولات", JSON.stringify(boq.auto) === JSON.stringify([1, 2, 3, 4]), JSON.stringify(boq.auto));
  check("الاختيار الصريح يُحترم (والصفر صفر)", JSON.stringify(boq.explicit) === JSON.stringify([0, 1, 4, 7]), JSON.stringify(boq.explicit));
  check("قيمة مخربطة ترجع للتلقائي", boq.junk === 2, "" + boq.junk);
  check("الخيارات من ٠ إلى ٧", JSON.stringify(boq.options) === JSON.stringify([0, 1, 2, 3, 4, 5, 6, 7]), JSON.stringify(boq.options));

  check("ما صار أي خطأ JS", errs.length === 0, errs.join(" | "));
  await browser.close();
  check.done();
})().catch((e) => {
  console.log("‼️ سقط الاختبار:", e.message);
  process.exit(1);
});
