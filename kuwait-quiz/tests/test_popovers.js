// نافذة سجل التلميحات + نافذة «+٧» للفئات
const { launch, BASE } = require("./_browser");
let fail = 0;
const check = (n, ok, x) => { console.log((ok ? "✅ " : "‼️ ") + n + (x ? "  " + x : "")); if (!ok) fail++; };
const vis = (p, sel) => p.$$eval(sel, (els) => els.some((e) => {
  if (e.classList.contains("hidden")) return false;
  const r = e.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
})).catch(() => false);
const num = (s) => {
  const m = String(s).match(/[٠-٩]+/g);
  return m ? Number(m[m.length - 1].replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d))) : null;
};
const inViewport = (p, sel) => p.$$eval(sel, (els) => {
  const e = els.find((x) => !x.classList.contains("hidden"));
  if (!e) return false;
  const r = e.getBoundingClientRect();
  return r.top >= -1 && r.left >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1;
});

(async () => {
  const browser = await launch();

  // ============ ١) سجل التلميحات ============
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errs = [];
    page.on("pageerror", (e) => errs.push(String(e)));
    await page.addInitScript(() => { try { localStorage.setItem("kw-tutorial-seen", "1"); } catch (e) {} });
    await page.route("**://*.googleapis.com/**", (r) => r.abort());
    await page.goto(BASE + "/wordle.html");
    for (const i of await page.$$("#wordle-team1-input, #wordle-team2-input")) await i.fill("الأزرق");
    await page.click("#wordle-start-btn");
    await page.waitForTimeout(450);

    check("السجل انتقل جوّه النافذة (بـbody)",
      await page.evaluate(() => !!document.querySelector("body > .kw-popover #wordle-hint-log")));
    check("وانشال من عمود المعلومات",
      await page.evaluate(() => !document.querySelector(".wordle-info #wordle-hint-log")));
    check("الأزرار الثلاثة رجعت بصفّها بعمود المعلومات",
      await page.$$eval(".wordle-info .abilities-row .ability-btn", (e) => e.length) === 3);
    check("زر السجل مخفي قبل أي تلميح", !(await vis(page, "#wordle-hintlog-btn")));

    const infoBefore = await page.$eval(".wordle-info", (e) => Math.round(e.getBoundingClientRect().height));

    // أول تلميح: الزر يطلع والنافذة تنفتح لحالها
    await page.click("#wordle-hint-letter-btn");
    await page.waitForTimeout(400);
    check("بعد أول تلميح يطلع الزر", await vis(page, "#wordle-hintlog-btn"));
    check("والنافذة تنفتح تلقائياً", await vis(page, ".kw-popover"));
    check("والعدد عليه ١", num(await page.textContent("#wordle-hintlog-btn")) === 1,
      (await page.textContent("#wordle-hintlog-btn")).trim());
    check("ونص التلميح داخلها",
      /الحرف/.test(await page.$eval(".kw-popover:not(.hidden) #wordle-hint-log", (e) => e.textContent)),
      (await page.$eval(".kw-popover:not(.hidden) #wordle-hint-log", (e) => e.textContent)).trim().slice(0, 40));
    check("النافذة داخل حدود الشاشة", await inViewport(page, ".kw-popover"));

    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    check("Escape تسكّرها", !(await vis(page, ".kw-popover")));

    // **الهدف**: عمود المعلومات ما كبر مع التلميح
    const infoAfter = await page.$eval(".wordle-info", (e) => Math.round(e.getBoundingClientRect().height));
    check("عمود المعلومات ما كبر بعد التلميح", infoAfter === infoBefore,
      infoBefore + " → " + infoAfter);

    // فتح/سكّر بالزر
    await page.click("#wordle-hintlog-btn"); await page.waitForTimeout(250);
    check("الزر يفتحها", await vis(page, ".kw-popover"));
    await page.click("#wordle-hintlog-btn"); await page.waitForTimeout(250);
    check("وضغطة ثانية تسكّرها", !(await vis(page, ".kw-popover")));
    await page.click("#wordle-hintlog-btn"); await page.waitForTimeout(250);
    await page.mouse.click(5, 700); await page.waitForTimeout(250);
    check("وضغطة برّا تسكّرها", !(await vis(page, ".kw-popover")));

    // تلميحان إضافيان
    await page.click("#wordle-hint-category-btn"); await page.waitForTimeout(350);
    check("تلميح جديد يفتحها تلقائياً مرة ثانية", await vis(page, ".kw-popover"));
    await page.keyboard.press("Escape"); await page.waitForTimeout(150);
    await page.click("#wordle-hint-repeat-btn"); await page.waitForTimeout(350);
    await page.keyboard.press("Escape"); await page.waitForTimeout(200);
    check("العدد صار ٣", num(await page.textContent("#wordle-hintlog-btn")) === 3,
      (await page.textContent("#wordle-hintlog-btn")).trim());
    const info3 = await page.$eval(".wordle-info", (e) => Math.round(e.getBoundingClientRect().height));
    check("وبعد ثلاثة تلميحات العمود لا يزال ثابتاً", info3 === infoBefore,
      infoBefore + " → " + info3);

    // إعادة رسم بلا تلميح جديد ما تفتحها
    await page.evaluate(() => document.querySelector('.keyboard .key').click());
    await page.waitForTimeout(250);
    check("إعادة الرسم بلا تلميح جديد ما تفتحها", !(await vis(page, ".kw-popover")));

    check("ما صار خطأ JS", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  // ============ ٢) نافذة «+٧» للفئات ============
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errs = [];
    page.on("pageerror", (e) => errs.push(String(e)));
    await page.addInitScript(() => { try { localStorage.setItem("kw-tutorial-seen", "1"); } catch (e) {} });
    await page.route("**://*.googleapis.com/**", (r) => r.abort());
    await page.goto(BASE + "/wordle.html");
    await page.click("#wordle-cat-all"); await page.waitForTimeout(150);
    for (let i = 0; i < 11; i++) {
      const ins = await page.$$("#wordle-category-list input");
      if (i >= ins.length) break;
      await ins[i].click(); await page.waitForTimeout(50);
    }
    for (const i of await page.$$("#wordle-team1-input, #wordle-team2-input")) await i.fill("الأزرق");
    await page.click("#wordle-start-btn"); await page.waitForTimeout(450);

    const pills = await page.$$eval("#wordle-active-categories .cat-pill", (e) => e.map((x) => x.textContent.trim()));
    check("تطلع ٤ فئات + حبّة «+٧»", pills.length === 5 && pills[4] === "+٧", JSON.stringify(pills));
    check("«+٧» صارت زراً ينضغط",
      await page.evaluate(() => document.querySelector(".cat-pill.more").tagName === "BUTTON"));

    await page.click(".cat-pill.more"); await page.waitForTimeout(250);
    check("ضغطتها تفتح النافذة", await vis(page, ".kw-popover"));
    const shown = await page.$$eval(".kw-popover:not(.hidden) .cat-pill", (e) => e.map((x) => x.textContent.trim()));
    check("تعرض كل الفئات المختارة (١١)", shown.length === 11, "عدد=" + shown.length);
    check("داخل حدود الشاشة", await inViewport(page, ".kw-popover"));

    await page.click(".cat-pill.more"); await page.waitForTimeout(250);
    check("ضغطة ثانية تسكّرها", !(await vis(page, ".kw-popover")));
    await page.click(".cat-pill.more"); await page.waitForTimeout(250);
    await page.mouse.click(5, 700); await page.waitForTimeout(250);
    check("وضغطة برّا تسكّرها", !(await vis(page, ".kw-popover")));

    check("ما صار خطأ JS", errs.length === 0, errs.join(" | "));
    await page.close();
  }

  // ============ ٣) الأونلاين ============
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addInitScript(() => { try { localStorage.setItem("kw-tutorial-seen", "1"); } catch (e) {} });
    const mk = async (pid) => {
      const p = await ctx.newPage();
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
    await host.click("#online-start-btn");
    await host.waitForTimeout(800);

    check("أونلاين: السجل انتقل للنافذة",
      await host.evaluate(() => !!document.querySelector("body > .kw-popover #online-hint-log")));
    check("أونلاين: زر السجل مخفي قبل التلميح", !(await vis(host, "#online-hintlog-btn")));
    check("أونلاين: الأزرار الثلاثة بصفّها",
      await host.$$eval(".wordle-info .abilities-row .ability-btn", (e) => e.length) === 3);

    await host.click("#online-hint-category-btn");
    await host.waitForTimeout(700);
    check("أونلاين: الزر طلع والعدد ١",
      (await vis(host, "#online-hintlog-btn")) &&
      num(await host.textContent("#online-hintlog-btn")) === 1,
      (await host.textContent("#online-hintlog-btn")).trim());
    check("أونلاين: الخصم يشوف السجل بعد",
      num(await foe.textContent("#online-hintlog-btn")) === 1,
      (await foe.textContent("#online-hintlog-btn")).trim());

    // تحديثات حالة متتابعة بلا تلميح جديد ما تفتح النافذة
    await host.keyboard.press("Escape");
    await host.waitForTimeout(200);
    await host.locator('#online-keyboard .key:text-is("ا")').first().click();
    await host.waitForTimeout(600);
    check("أونلاين: تحديث الحالة بلا تلميح جديد ما يفتحها",
      !(await vis(host, ".kw-popover")));

    await ctx.close();
  }

  await browser.close();
  console.log(fail === 0 ? "\n✅ كل الفحوص نجحت" : "\n‼️ فشل " + fail);
  process.exit(fail ? 1 : 0);
})();
