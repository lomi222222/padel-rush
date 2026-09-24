// إعدادات آخر مباراة (عدد الجولات، وقت الجولة، الفئات) تبقى بعد إغلاق وإعادة فتح
// الصفحة — محلي وأونلاين (الهوست بس بالأونلاين).
const { launch, BASE } = require("./_browser");
let fail = 0;
const check = (n, ok, x) => { console.log((ok ? "✅ " : "‼️ ") + n + (x ? "  " + x : "")); if (!ok) fail++; };

(async () => {
  const browser = await launch();

  // ===== محلي =====
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
     await ctx.addInitScript(() => { try { localStorage.setItem("kw-tutorial-seen", "1"); } catch (e) {} });  // التجربة التوجيهية تطلع أول زيارة — نتخطاها بالاختبارات
    const page = await ctx.newPage();
     await page.addInitScript(() => { try { localStorage.setItem("kw-tutorial-seen", "1"); } catch (e) {} });  // التجربة التوجيهية تطلع أول زيارة — نتخطاها بالاختبارات
    const errs = [];
    page.on("pageerror", (e) => errs.push(String(e)));

    await page.goto(BASE + "/wordle.html");
    for (const inp of await page.$$("#wordle-team1-input, #wordle-team2-input")) await inp.fill("فريق");

    // نختار إعدادات غير الافتراضي: عدد جولات ٧، وقت مخصص ١٢ دقيقة، فئة وحدة بس
    await page.selectOption("#wordle-round-count", "7");
    await page.selectOption("#wordle-round-time", String(-1)); // CUSTOM_TIME
    await page.fill("#wordle-round-time-custom", "12");
    await page.click("#wordle-cat-all"); // يلغي الكل
    const labels = await page.$$("label.category-chip:not(.exclusive):not(.all)");
    let picked = "";
    for (const label of labels) {
      const text = (await label.textContent()).trim();
      if (text) { await (await label.$("input")).click(); picked = text; break; }
    }
    check("محلي: قدرنا نحدد فئة وحدة للاختبار", !!picked, picked);

    await page.click("#wordle-start-btn");
    await page.waitForTimeout(300);

    // نعيد فتح صفحة الإعداد من جديد (صفحة جديدة تماماً، بلا أي حالة بالذاكرة)
    const page2 = await ctx.newPage();
     await page2.addInitScript(() => { try { localStorage.setItem("kw-tutorial-seen", "1"); } catch (e) {} });  // التجربة التوجيهية تطلع أول زيارة — نتخطاها بالاختبارات
    page2.on("pageerror", (e) => errs.push(String(e)));
    await page2.goto(BASE + "/wordle.html");
    await page2.waitForTimeout(200);

    const roundVal = await page2.$eval("#wordle-round-count", (e) => e.value);
    check("محلي: عدد الجولات رجع ٧", roundVal === "7", "قيمة=" + roundVal);

    const timeVal = await page2.$eval("#wordle-round-time", (e) => e.value);
    check("محلي: مدة الجولة رجعت مخصصة", timeVal === "-1", "قيمة=" + timeVal);

    const customVisible = await page2.locator("#wordle-round-time-custom").isVisible();
    check("محلي: حقل الدقائق المخصصة ظاهر", customVisible);

    const customVal = await page2.$eval("#wordle-round-time-custom", (e) => e.value);
    check("محلي: قيمة الدقائق المخصصة = ١٢", customVal === "12", "قيمة=" + customVal);

    const allChecked = await page2.$eval("#wordle-cat-all", (e) => e.checked);
    check('محلي: "الكل" مو محدد (فئة وحدة بس محفوظة)', !allChecked);

    const checkedCount = await page2.$$eval(
      "label.category-chip:not(.exclusive):not(.all) input:checked",
      (els) => els.length
    );
    check("محلي: فئة وحدة بس محددة", checkedCount === 1, "عدد=" + checkedCount);

    check("محلي: ما صار خطأ JS", errs.length === 0, errs.join(" | "));
    await ctx.close();
  }

  // ===== أونلاين (الهوست) =====
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
     await ctx.addInitScript(() => { try { localStorage.setItem("kw-tutorial-seen", "1"); } catch (e) {} });  // التجربة التوجيهية تطلع أول زيارة — نتخطاها بالاختبارات
    const seed = await ctx.newPage();
     await seed.addInitScript(() => { try { localStorage.setItem("kw-tutorial-seen", "1"); } catch (e) {} });  // التجربة التوجيهية تطلع أول زيارة — نتخطاها بالاختبارات
    await seed.goto(BASE + "/wordle-online.html?net=local&pid=seed2");
    await seed.evaluate(() => localStorage.removeItem("kw-net-local-tree"));
    await seed.close();

    const host = await ctx.newPage();
     await host.addInitScript(() => { try { localStorage.setItem("kw-tutorial-seen", "1"); } catch (e) {} });  // التجربة التوجيهية تطلع أول زيارة — نتخطاها بالاختبارات
    const errs = [];
    host.on("pageerror", (e) => errs.push(String(e)));
    await host.goto(BASE + "/wordle-online.html?net=local&pid=H2");
    await host.fill("#online-name-input", "سالم");
    await host.click("#online-create-btn");
    await host.waitForTimeout(300);

    await host.selectOption("#online-round-count", "3");
    await host.selectOption("#online-round-time", "60");

    // نتأكد الحفظ يصير عند "بدء المباراة" — نحتاج فريقين، فنكمل دخول لاعب ثاني
    const code = (await host.$eval("#online-room-code", (e) => e.textContent)).trim();
    const foe = await ctx.newPage();
     await foe.addInitScript(() => { try { localStorage.setItem("kw-tutorial-seen", "1"); } catch (e) {} });  // التجربة التوجيهية تطلع أول زيارة — نتخطاها بالاختبارات
    foe.on("pageerror", (e) => errs.push(String(e)));
    await foe.goto(BASE + "/wordle-online.html?net=local&pid=F2");
    await foe.fill("#online-name-input", "بدر");
    await foe.fill("#online-code-input", code);
    await foe.click("#online-join-btn");
    await foe.waitForTimeout(300);
    await host.locator('.online-team-pick[data-team="0"]').click();
    await foe.locator('.online-team-pick[data-team="1"]').click();
    await host.waitForTimeout(300);
    await host.click("#online-start-btn");
    await host.waitForTimeout(500);

    // صفحة جديدة تماماً على نفس المتصفح (localStorage مشترك بالسياق)
    const host2 = await ctx.newPage();
     await host2.addInitScript(() => { try { localStorage.setItem("kw-tutorial-seen", "1"); } catch (e) {} });  // التجربة التوجيهية تطلع أول زيارة — نتخطاها بالاختبارات
    host2.on("pageerror", (e) => errs.push(String(e)));
    await host2.goto(BASE + "/wordle-online.html?net=local&pid=H3");
    await host2.waitForTimeout(200);

    const roundVal = await host2.$eval("#online-round-count", (e) => e.value);
    check("أونلاين: عدد الجولات رجع ٣", roundVal === "3", "قيمة=" + roundVal);
    const timeVal = await host2.$eval("#online-round-time", (e) => e.value);
    check("أونلاين: وقت الجولة رجع دقيقة", timeVal === "60", "قيمة=" + timeVal);

    check("أونلاين: ما صار خطأ JS", errs.length === 0, errs.join(" | "));
    await ctx.close();
  }

  await browser.close();
  console.log(fail ? "\n" + fail + " فحص فشل" : "\nكل الفحوص نجحت");
  process.exit(fail ? 1 : 0);
})();
