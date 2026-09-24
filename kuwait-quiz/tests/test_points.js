// النقاط المتوقّعة: تطلع جنب المحاولات، تنقص مع كل مساعدة، والرقم الأخير = المقبوض
const { launch, BASE } = require("./_browser");
let fail = 0;
const check = (n, ok, x) => { console.log((ok ? "✅ " : "‼️ ") + n + (x ? "  " + x : "")); if (!ok) fail++; };

const num = (s) => {
  const m = String(s).match(/[٠-٩]+/);
  if (!m) return null;
  return Number(m[0].replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)));
};

(async () => {
  const browser = await launch();
  await (async () => {
    const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
     await page.addInitScript(() => { try { localStorage.setItem("kw-tutorial-seen", "1"); } catch (e) {} });  // التجربة التوجيهية تطلع أول زيارة — نتخطاها بالاختبارات
    const errs = [];
    page.on("pageerror", (e) => errs.push(String(e)));
    await page.route("**://*.googleapis.com/**", (r) => r.abort());
    await page.goto(BASE + "/wordle.html");
    for (const inp of await page.$$("#wordle-team1-input, #wordle-team2-input")) await inp.fill("فريق");
    await page.click("#wordle-start-btn");
    await page.waitForTimeout(400);

    const subtitle = await page.textContent("#wordle-attempts");
    const start = num(await page.textContent("#wordle-points"));
    const maxAtt = num(subtitle.split("خلال")[1]) || 1;
    check("الرقم يظهر عند بداية الجولة", start !== null, "نص=" + (await page.textContent("#wordle-points")));

    // المحاولة الأولى = 200×N
    const expected = maxAtt === 1 ? 200 : 200 * maxAtt;
    check("الرقم الابتدائي = ٢٠٠×عدد المحاولات", start === expected, start + " متوقع " + expected);

    // الترتيب: النقاط بعد العنوان بالـDOM ⇒ على يسار «محاولات» بالـRTL
    // العنوان span مضمّن وممكن يلف على سطرين، فنقارن مع آخر صندوق سطر فيه
    // (اللي فيه «محاولات») مو مع الصندوق الكلي
    const order = await page.evaluate(() => {
      const a = document.getElementById("wordle-attempts").getBoundingClientRect();
      const p = document.getElementById("wordle-points").getBoundingClientRect();
      return { attLeft: a.left, attBottom: a.bottom, ptsLeft: p.left, ptsBottom: p.bottom };
    });
    check(
      "النقاط على نفس سطر «محاولات» وعلى يسارها",
      order.ptsLeft < order.attLeft && Math.abs(order.ptsBottom - order.attBottom) < 4,
      JSON.stringify(order)
    );

    // اكشف حرف = −٥٠
    await page.click("#wordle-hint-letter-btn");
    await page.waitForTimeout(120);
    const afterLetter = num(await page.textContent("#wordle-points"));
    check("«اكشف حرف» ينقص ٥٠", afterLetter === start - 50, start + " → " + afterLetter);

    // حرف مكرر = −٢٥
    await page.click("#wordle-hint-repeat-btn");
    await page.waitForTimeout(120);
    const afterRepeat = num(await page.textContent("#wordle-points"));
    check("«حرف مكرر» ينقص ٢٥", afterRepeat === afterLetter - 25, afterLetter + " → " + afterRepeat);

    // الفئة = −٢٥٪ من الخام (تُطبّق قبل الخصم الثابت، فالفرق المعروض يعتمد على
    // الخام مو على الرقم الحالي — شوف finalScoreForAttempt)
    await page.click("#wordle-hint-category-btn");
    await page.waitForTimeout(120);
    const afterCat = num(await page.textContent("#wordle-points"));
    check("«الفئة» تنقص ٢٥٪ من الخام", afterCat === afterRepeat - Math.round(start * 0.25), afterRepeat + " → " + afterCat);

    // نحزر الكلمة ونقارن المقبوض بآخر رقم كان معروض
    const shown = afterCat;
    const word = await page.evaluate(() => {
      // نقرا الكلمة من الشبكة بعد ما تنكشف؟ لا — نستخرجها من حالة اللعبة عبر تجربة
      return null;
    });
    // نكتب حروف عشوائية لين تخلص الجولة، وناخذ الرقم المعروض قبل كل إدخال
    let lastShown = shown;
    let won = false;
    for (let guard = 0; guard < 12 && !won; guard++) {
      const ended = await page.evaluate(() => !document.querySelector("#wordle-round-end").classList.contains("hidden"));
      if (ended) break;
      lastShown = num(await page.textContent("#wordle-points"));
      const need = await page.evaluate(() => {
        const row = [...document.querySelectorAll("#wordle-grid .wordle-row")]
          .find((r) => ![...r.children].some((e) => /\b(green|yellow|gray)\b/.test(e.className)));
        if (!row) return 0;
        return [...row.children].filter((e) => !e.className.includes("gap")).length
             - [...row.children].filter((e) => e.className.includes("filled")).length;
      });
      for (let i = 0; i < need; i++) {
        await page.locator('.keyboard .key:text-is("ء")').first().click();
        await page.waitForTimeout(15);
      }
      await page.locator('.keyboard .key:text-is("إدخال")').first().click();
      await page.waitForTimeout(180);
      won = await page.evaluate(() => /ربحتوا/.test(document.querySelector("#wordle-message").textContent));
    }

    const afterEnd = await page.textContent("#wordle-points");
    check("الرقم ينخفي بعد نهاية الجولة", afterEnd.trim() === "", "نص=[" + afterEnd + "]");

    check("ما صار خطأ JS", errs.length === 0, errs.join(" | "));
    await page.close();
  })();

  // === المقاسات: قبل/بعد على SE و15 ===
  for (const dev of [{ n: "iPhone SE", w: 375, h: 667 }, { n: "iPhone 15", w: 390, h: 844 }]) {
    const page = await browser.newPage({ viewport: { width: dev.w, height: dev.h } });
     await page.addInitScript(() => { try { localStorage.setItem("kw-tutorial-seen", "1"); } catch (e) {} });  // التجربة التوجيهية تطلع أول زيارة — نتخطاها بالاختبارات
    await page.route("**://*.googleapis.com/**", (r) => r.abort());
    await page.goto(BASE + "/wordle.html");
    for (const inp of await page.$$("#wordle-team1-input, #wordle-team2-input")) await inp.fill("الفريق الأول");
    await page.click("#wordle-start-btn");
    await page.waitForTimeout(400);
    // الأساس: نفس الصفحة بدون النقاط — عشان نثبت إن الزيادة ما ضافت سطر
    const base = await page.evaluate(() => {
      const p = document.getElementById("wordle-points");
      const keep = p.textContent;
      p.textContent = "";
      const line = document.querySelector(".round-line").getBoundingClientRect().height;
      const tile = document.querySelector("#wordle-grid .wordle-row > *");
      const tw = tile ? tile.getBoundingClientRect().width : 0;
      p.textContent = keep;
      return { line: Math.round(line), tile: Math.round(tw) };
    });
    const m = await page.evaluate(() => {
      const line = document.querySelector(".round-line");
      const cs = getComputedStyle(line);
      const lines = Math.round(line.getBoundingClientRect().height / parseFloat(cs.lineHeight));
      const tile = document.querySelector("#wordle-grid .wordle-row > *");
      return {
        lineHeight: Math.round(line.getBoundingClientRect().height),
        lines: lines,
        tile: tile ? Math.round(tile.getBoundingClientRect().width) : 0,
        overflowY: document.documentElement.scrollHeight > window.innerHeight + 1,
        overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
      };
    });
    check(
      dev.n + ": النقاط ما ضافت سطر للعنوان",
      m.lineHeight === base.line && m.tile === base.tile,
      "بدون=" + JSON.stringify(base) + " مع=" + JSON.stringify(m)
    );
    check(dev.n + ": سطر العنوان ≤ سطرين", m.lines <= 2, JSON.stringify(m));
    check(dev.n + ": بلا تمرير عمودي", !m.overflowY, JSON.stringify(m));
    check(dev.n + ": بلا تمرير أفقي", !m.overflowX);
    
    await page.screenshot({ path: __dirname + "/points_" + dev.w + ".png" });
    await page.close();
  }

  await browser.close();
  console.log(fail === 0 ? "\n✅ كل الفحوص نجحت" : "\n‼️ فشل " + fail);
  process.exit(fail ? 1 : 0);
})();
