// التجربة التوجيهية + ترتيب الشريط العلوي + إخفاء أزرار ±٢٥
const { launch, BASE } = require("./_browser");
let fail = 0;
const check = (n, ok, x) => { console.log((ok ? "✅ " : "‼️ ") + n + (x ? "  " + x : "")); if (!ok) fail++; };
const vis = (p, sel) => p.$eval(sel, (e) => {
  if (e.classList.contains("hidden")) return false;
  const r = e.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden";
}).catch(() => false);

(async () => {
  const browser = await launch();

  // ============ ١) التجربة تطلع أول زيارة وتشتغل فعلاً ============
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const errs = [];
    page.on("pageerror", (e) => errs.push(String(e)));
    await page.route("**://*.googleapis.com/**", (r) => r.abort());
    await page.goto(BASE + "/wordle.html");
    await page.waitForTimeout(600);

    check("أول زيارة: التجربة تطلع لحالها", await vis(page, ".tutorial-overlay"));

    // نكتب «كتاب» ونتأكد إن التقييم مطابق لـCore.evaluateGuess على «حصان»
    const guess = "كتاب";
    for (const ch of Array.from(guess)) {
      await page.locator('.tutorial-keyboard .key:text-is("' + ch + '")').first().click();
      await page.waitForTimeout(40);
    }
    const expected = await page.evaluate((g) =>
      WordleCore.evaluateGuess(Array.from(g), Array.from("حصان")), guess);
    await page.locator('.tutorial-keyboard .key:text-is("إدخال")').first().click();
    await page.waitForTimeout(400);

    const shown = await page.$$eval(".tutorial-grid .wordle-row:first-child .wordle-tile",
      (els) => els.map((e) => ["green", "yellow", "gray"].find((c) => e.classList.contains(c)) || null));
    check("التقييم مطابق لمنطق اللعبة نفسه",
      JSON.stringify(shown) === JSON.stringify(expected),
      JSON.stringify(shown) + " متوقع " + JSON.stringify(expected));

    // شرح الألوان يذكر بالضبط الألوان اللي طلعت بتخمينه
    const note = await page.$eval("#tut-note", (e) => e.textContent);
    const got = new Set(expected);
    check("شرح الألوان يطابق ألوان محاولته",
      (got.has("green") === note.includes("الأخضر")) &&
      (got.has("yellow") === note.includes("الأصفر")) &&
      (got.has("gray") === note.includes("الرمادي")),
      "ألوانه=" + [...got].join(",") + " | النص=" + note.slice(0, 60));

    // نكمّل لين تخلص
    for (let round = 0; round < 2; round++) {
      const done = await vis(page, ".tutorial-next");
      if (done) break;
      for (const ch of Array.from("حصان")) {
        await page.locator('.tutorial-keyboard .key:text-is("' + ch + '")').first().click();
        await page.waitForTimeout(40);
      }
      await page.locator('.tutorial-keyboard .key:text-is("إدخال")').first().click();
      await page.waitForTimeout(400);
    }
    check("بعد إصابة الكلمة يطلع زر «ابدأ اللعب»", await vis(page, ".tutorial-next"));

    await page.click(".tutorial-next");
    await page.waitForTimeout(200);
    check("الزر يقفل التجربة", !(await vis(page, ".tutorial-overlay")));
    check("وشاشة الإعداد صارت شغّالة", await vis(page, "#wordle-setup-screen"));
    check("ما صار خطأ JS", errs.length === 0, errs.join(" | "));

    // إعادة تحميل ⇒ ما تطلع مرة ثانية (نفس الـcontext = نفس localStorage)
    await page.reload();
    await page.waitForTimeout(600);
    check("الزيارة الثانية: ما تطلع", !(await vis(page, ".tutorial-overlay")));

    // زر إعادتها من شاشة الشرح
    await page.click("#wordle-howto-btn");
    await page.waitForTimeout(250);
    check("زر «أعد التجربة التوجيهية» موجود بالشرح", await vis(page, ".howto-replay"));
    await page.click(".howto-replay");
    await page.waitForTimeout(300);
    check("والزر يرجّعها", await vis(page, ".tutorial-overlay"));

    await context.close();
  }

  // ============ ٢) الشريط العلوي + ±٢٥ + الطريق للرئيسية ============
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.addInitScript(() => { try { localStorage.setItem("kw-tutorial-seen", "1"); } catch (e) {} });
    const errs = [];
    page.on("pageerror", (e) => errs.push(String(e)));
    await page.route("**://*.googleapis.com/**", (r) => r.abort());
    await page.goto(BASE + "/wordle.html");
    await page.waitForTimeout(500);

    check("شاشة الإعداد: رابط الرئيسية ظاهر", await vis(page, ".topbar .home-link"));
    check("شاشة الإعداد: «إنهاء اللعبة» مخفي", !(await vis(page, "#wordle-end-match-btn")));
    check("زر الثيم داخل الشريط مو عائم",
      await page.$eval(".topbar-actions", (e) => !!e.querySelector(".theme-toggle-inline")));

    for (const i of await page.$$("#wordle-team1-input, #wordle-team2-input")) await i.fill("الأزرق");
    await page.click("#wordle-start-btn");
    await page.waitForTimeout(500);

    check("شاشة اللعب: «إنهاء اللعبة» ظاهر", await vis(page, "#wordle-end-match-btn"));
    check("شاشة اللعب: رابط الرئيسية مخفي", !(await vis(page, ".topbar .home-link")));

    // ±٢٥ مخفية لين يضغط القلم
    const adjVisible = () => page.$eval(".score-adjust-row", (e) => e.offsetParent !== null).catch(() => false);
    check("±٢٥ مخفية افتراضياً", !(await adjVisible()));
    await page.click("#wordle-score-edit-btn");
    await page.waitForTimeout(200);
    check("القلم يظهرها", await adjVisible());
    const before = await page.$eval("#wordle-scoreboard .team-chip .score", (e) => e.textContent);
    await page.locator('.score-adjust-btn:text-is("+٢٥")').first().click();
    await page.waitForTimeout(200);
    const after = await page.$eval("#wordle-scoreboard .team-chip .score", (e) => e.textContent);
    check("والتعديل يشتغل فعلاً", before !== after, before + " → " + after);
    await page.click("#wordle-score-edit-btn");
    await page.waitForTimeout(200);
    check("وضغطة ثانية تخفيها", !(await adjVisible()));

    // الطريق للرئيسية بعد الإنهاء
    await page.click("#wordle-end-match-btn");
    await page.waitForTimeout(500);
    check("شاشة النتائج: «إنهاء اللعبة» انخفى", !(await vis(page, "#wordle-end-match-btn")));
    const homeHref = await page.$$eval("#wordle-end-screen a", (els) =>
      els.map((e) => e.getAttribute("href")));
    check("شاشة النتائج فيها طريق للرئيسية", homeHref.includes("index.html"), JSON.stringify(homeHref));
    await page.click('#wordle-end-screen a[href="index.html"]');
    await page.waitForTimeout(600);
    check("والزر يوصّل فعلاً", page.url().endsWith("index.html"), page.url());
    check("ما صار خطأ JS", errs.length === 0, errs.join(" | "));
    await context.close();
  }

  // ============ ٣) الأونلاين: نفس القواعد ============
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const mk = async (pid) => {
      const p = await context.newPage();
      await p.addInitScript(() => { try { localStorage.setItem("kw-tutorial-seen", "1"); } catch (e) {} });
      p.on("pageerror", (e) => { fail++; console.log("PAGEERROR(" + pid + "):", e.message); });
      await p.route("**://*.googleapis.com/**", (r) => r.abort());
      await p.goto(BASE + "/wordle-online.html?net=local&pid=" + pid);
      await p.waitForTimeout(200);
      return p;
    };
    const seed = await mk("seed");
    await seed.evaluate(() => localStorage.removeItem("kw-net-local-tree"));
    await seed.close();

    const host = await mk("H");
    await host.fill("#online-name-input", "سالم");
    await host.click("#online-create-btn");
    await host.waitForTimeout(400);
    const code = (await host.$eval("#online-room-code", (e) => e.textContent)).trim();

    const foe = await mk("F");
    await foe.fill("#online-name-input", "بدر");
    await foe.fill("#online-code-input", code);
    await foe.click("#online-join-btn");
    await foe.waitForTimeout(300);
    await foe.locator('.online-team-pick[data-team="1"]').click();
    await foe.waitForTimeout(300);

    check("أونلاين/لوبي: رابط الرئيسية ظاهر", await vis(host, ".topbar .home-link"));
    check("أونلاين/لوبي: «إنهاء اللعبة» مخفي", !(await vis(host, "#online-end-match-btn")));

    await host.click("#online-start-btn");
    await host.waitForTimeout(800);

    check("أونلاين/لعب: الهوست يشوف «إنهاء اللعبة»", await vis(host, "#online-end-match-btn"));
    check("أونلاين/لعب: الرابط انخفى عند الهوست", !(await vis(host, ".topbar .home-link")));
    check("أونلاين/لعب: اللاعب العادي ما يشوف «إنهاء اللعبة»",
      !(await vis(foe, "#online-end-match-btn")));
    check("أونلاين: القلم للهوست بس",
      (await vis(host, "#online-score-edit-btn")) && !(await vis(foe, "#online-score-edit-btn")));

    const onlineHome = await host.$$eval("#online-end a", (els) => els.map((e) => e.getAttribute("href")));
    check("أونلاين: شاشة النتائج فيها طريق للرئيسية",
      onlineHome.includes("index.html"), JSON.stringify(onlineHome));

    await context.close();
  }

  await browser.close();
  console.log(fail === 0 ? "\n✅ كل الفحوص نجحت" : "\n‼️ فشل " + fail);
  process.exit(fail ? 1 : 0);
})();
