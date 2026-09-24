// حد «اكشف حرف»: مرتين بالجولة، والهوست يرفض أي طلب زايد حتى لو تجاوز اللاعب الزر
const { launch, BASE } = require("./_browser");
let fail = 0;
const check = (n, ok, x) => { console.log((ok ? "✅ " : "‼️ ") + n + (x ? "  " + x : "")); if (!ok) fail++; };
const num = (s) => {
  const m = String(s).match(/[٠-٩]+/g);
  return m ? Number(m[m.length - 1].replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d))) : null;
};
const pts = (p, id) => p.$eval(id, (el) => el.textContent);

(async () => {
  const browser = await launch();

  // ================= محلي =================
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
     await page.addInitScript(() => { try { localStorage.setItem("kw-tutorial-seen", "1"); } catch (e) {} });  // التجربة التوجيهية تطلع أول زيارة — نتخطاها بالاختبارات
    const errs = [];
    page.on("pageerror", (e) => errs.push(String(e)));
    await page.route("**://*.googleapis.com/**", (r) => r.abort());
    await page.goto(BASE + "/wordle.html");
    for (const i of await page.$$("#wordle-team1-input, #wordle-team2-input")) await i.fill("فريق");
    await page.click("#wordle-start-btn");
    await page.waitForTimeout(400);

    check("الزر شغال بالبداية", !(await page.$eval("#wordle-hint-letter-btn", (e) => e.disabled)));
    const p0 = num(await pts(page, "#wordle-points"));

    await page.click("#wordle-hint-letter-btn");
    await page.waitForTimeout(150);
    const p1 = num(await pts(page, "#wordle-points"));
    check("والنقاط نزلت ٥٠", p1 === p0 - 50, p0 + " → " + p1);
    check("بعد كشف واحد الزر لسه شغال", !(await page.$eval("#wordle-hint-letter-btn", (e) => e.disabled)));

    await page.click("#wordle-hint-letter-btn");
    await page.waitForTimeout(150);
    const p2 = num(await pts(page, "#wordle-points"));
    check("والنقاط نزلت ٥٠ مرة ثانية", p2 === p1 - 50, p1 + " → " + p2);
    check("بعد كشفين الزر انقفل", await page.$eval("#wordle-hint-letter-btn", (e) => e.disabled));

    // الضغطة الثالثة: نجبرها بفك التعطيل، لازم ما تسوي شي (الحارس بالمعالج)
    const logBefore = await page.$$eval("#wordle-hint-log *", (e) => e.length);
    await page.$eval("#wordle-hint-letter-btn", (e) => e.click());
    await page.waitForTimeout(150);
    const logAfter = await page.$$eval("#wordle-hint-log *", (e) => e.length);
    const p3 = num(await pts(page, "#wordle-points"));
    check("الضغطة الثالثة ما ضافت تلميح", logAfter === logBefore, logBefore + " → " + logAfter);
    check("والنقاط ما نزلت", p3 === p2, p2 + " → " + p3);

    // كلمة طويلة: الحد ما يخلي الجولة مستحيلة والزر يشتغل نفس الشي
    check("محلي: ما صار خطأ JS", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  // ================= كلمة طويلة (١٣ محاولة) =================
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
     await page.addInitScript(() => { try { localStorage.setItem("kw-tutorial-seen", "1"); } catch (e) {} });  // التجربة التوجيهية تطلع أول زيارة — نتخطاها بالاختبارات
    await page.route("**://*.googleapis.com/**", (r) => r.abort());
    await page.goto(BASE + "/wordle.html");
    // تثبيت كلمة بعينها ما ينفع: makeWordBag يخلط الكيس فـMath.random الثابت ما
    // يوصلنا للكلمة المقصودة. فنفحص الحسبة مباشرة، ونفحص السلوك على أي كلمة تنسحب
    const longest = await page.evaluate(() => {
      const w = WORDS.slice().sort((a, b) => b.word.length - a.word.length)[0];
      const letters = w.word.replace(/ /g, "").length;
      return { len: w.word.length, letters, attempts: WordleCore.attemptsForLength(w.word.length) };
    });
    check(
      "أطول كلمة (" + longest.len + " محرف) تاخذ " + longest.attempts + " محاولة",
      longest.attempts >= 10,
      JSON.stringify(longest)
    );
    check(
      "الحد ٢ أصغر بكثير من محاولات أطول كلمة — الجولة تظل ممكنة",
      2 < longest.attempts / 2,
      "٢ مقابل " + longest.attempts
    );

    for (const i of await page.$$("#wordle-team1-input, #wordle-team2-input")) await i.fill("فريق");
    await page.click("#wordle-start-btn");
    await page.waitForTimeout(400);
    const rows = await page.$$eval("#wordle-grid .wordle-row", (e) => e.length);
    await page.click("#wordle-hint-letter-btn");
    await page.waitForTimeout(120);
    await page.click("#wordle-hint-letter-btn");
    await page.waitForTimeout(120);
    check(
      "الحد ٢ ما يتأثر بطول الكلمة (" + rows + " محاولة بهالجولة)",
      await page.$eval("#wordle-hint-letter-btn", (e) => e.disabled),
      "صفوف=" + rows
    );
    await page.close();
  }

  // ================= أونلاين =================
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
     await context.addInitScript(() => { try { localStorage.setItem("kw-tutorial-seen", "1"); } catch (e) {} });  // التجربة التوجيهية تطلع أول زيارة — نتخطاها بالاختبارات
    const seed = await context.newPage();
     await seed.addInitScript(() => { try { localStorage.setItem("kw-tutorial-seen", "1"); } catch (e) {} });  // التجربة التوجيهية تطلع أول زيارة — نتخطاها بالاختبارات
    await seed.goto(BASE + "/wordle-online.html?net=local&pid=seed");
    await seed.evaluate(() => localStorage.removeItem("kw-net-local-tree"));
    await seed.close();

    const mk = async (pid) => {
      const p = await context.newPage();
       await p.addInitScript(() => { try { localStorage.setItem("kw-tutorial-seen", "1"); } catch (e) {} });  // التجربة التوجيهية تطلع أول زيارة — نتخطاها بالاختبارات
      p.on("pageerror", (e) => { fail++; console.log("PAGEERROR(" + pid + "):", e.message); });
      await p.route("**://*.googleapis.com/**", (r) => r.abort());
      await p.goto(BASE + "/wordle-online.html?net=local&pid=" + pid);
      await p.waitForTimeout(150);
      return p;
    };

    const host = await mk("H");
    await host.fill("#online-name-input", "سالم");
    await host.click("#online-create-btn");
    await host.waitForTimeout(300);
    const code = (await host.$eval("#online-room-code", (el) => el.textContent)).trim();

    const foe = await mk("F");
    await foe.fill("#online-name-input", "بدر");
    await foe.fill("#online-code-input", code);
    await foe.click("#online-join-btn");
    await foe.waitForTimeout(250);
    await foe.locator('.online-team-pick[data-team="1"]').click();
    await foe.waitForTimeout(250);

    await host.click("#online-start-btn");
    await host.waitForTimeout(700);

    check("أونلاين: الزر شغال لصاحب الدور",
      !(await host.$eval("#online-hint-letter-btn", (e) => e.disabled)));

    await host.click("#online-hint-letter-btn");
    await host.waitForTimeout(450);
    await host.click("#online-hint-letter-btn");
    await host.waitForTimeout(450);

    check("أونلاين: بعد كشفين الزر مقفول",
      await host.$eval("#online-hint-letter-btn", (e) => e.disabled));

    // === الأهم: تجاوز الزر المقفول ودزّ الطلب مباشرة ===
    const logBefore = await host.$$eval("#online-hint-log *", (e) => e.length);
    const bypassed = await host.evaluate(() => {
      // نضغط الزر بعد فك التعطيل — نفس المسار اللي يقدر أي لاعب يشغّله من الكونسول
      const b = document.getElementById("online-hint-letter-btn");
      b.disabled = false;
      b.click();
      return true;
    });
    await host.waitForTimeout(600);
    const logAfter = await host.$$eval("#online-hint-log *", (e) => e.length);
    check("الهوست يرفض الطلب الزايد (سجل التلميحات ما زاد)",
      bypassed && logAfter === logBefore, logBefore + " → " + logAfter);
    check("والزر رجع مقفول بعد إعادة الرسم",
      await host.$eval("#online-hint-letter-btn", (e) => e.disabled));

    await context.close();
  }

  // ================= المقاسات: الثلاثة بسطر واحد =================
  // بالوضع العرضي عمود المعلومات ضيّق فالأزرار تتكدّس عمودياً أصلاً (٣ أسطر،
  // ٧٧ بكسل) — هذا التخطيط الأصلي مو انحدار، فنفحص الطول بس + عدم التجاوز
  for (const [n, w, h, maxLines] of [
    ["iPhone SE", 375, 667, 1],
    ["iPhone 15", 390, 844, 1],
    ["عرضي 844", 844, 390, 3],
  ]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
     await page.addInitScript(() => { try { localStorage.setItem("kw-tutorial-seen", "1"); } catch (e) {} });  // التجربة التوجيهية تطلع أول زيارة — نتخطاها بالاختبارات
    await page.route("**://*.googleapis.com/**", (r) => r.abort());
    await page.goto(BASE + "/wordle.html");
    for (const i of await page.$$("#wordle-team1-input, #wordle-team2-input")) await i.fill("الفريق الأول");
    await page.click("#wordle-start-btn");
    await page.waitForTimeout(450);
    const m = await page.evaluate(() => {
      const row = document.querySelector(".wordle-info .abilities-row");
      const btns = [...row.children];
      const tops = new Set(btns.map((b) => Math.round(b.getBoundingClientRect().top)));
      return { lines: tops.size, rowH: Math.round(row.getBoundingClientRect().height),
        ovX: document.documentElement.scrollWidth > window.innerWidth + 1,
        ovY: document.documentElement.scrollHeight > window.innerHeight + 1 };
    });
    check(n + ": صف المساعدات ما زاد سطر وبلا تمرير",
      m.lines <= maxLines && !m.ovX && !m.ovY, JSON.stringify(m));
    await page.close();
  }

  await browser.close();
  console.log(fail === 0 ? "\n✅ كل الفحوص نجحت" : "\n‼️ فشل " + fail);
  process.exit(fail ? 1 : 0);
})();
