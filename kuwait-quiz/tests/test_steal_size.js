// يتأكد إن استخدام البوق (اللي يضيف صف سرقة فوق العدد الأصلي) ما يصغّر الخلايا،
// وإن صف النتائج ما يتداخل مع عمود الأدوات بأي مقاس.
const { launch, BASE } = require("./_browser");

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    (ok ? "PASS" : "FAIL") + " | " + label + " => " + JSON.stringify(actual) +
    (ok ? "" : "  (expected " + JSON.stringify(expected) + ")")
  );
}

const tile = (page) =>
  page.evaluate(() =>
    parseInt(getComputedStyle(document.querySelector("#wordle-grid")).getPropertyValue("--tile-size"))
  );

const rows = (page) => page.$$eval(".wordle-row", (e) => e.length);

// تداخل حقيقي: تقاطع صندوق صف النتائج مع أي عنصر ظاهر بعمود الأدوات
const overlap = (page) =>
  page.evaluate(() => {
    const vis = (e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 ? r : null;
    };
    const sr = vis(document.querySelector(".score-row"));
    if (!sr) return 0;
    let worst = 0;
    for (const el of document.querySelectorAll(".wordle-controls *, .wordle-info *")) {
      const r = vis(el);
      if (!r) continue;
      const dy = Math.min(sr.bottom, r.bottom) - Math.max(sr.top, r.top);
      const dx = Math.min(sr.right, r.right) - Math.max(sr.left, r.left);
      if (dy > 1 && dx > 1) worst = Math.max(worst, Math.round(dy));
    }
    return worst;
  });

async function startRound(page, word, category) {
  await page.goto(BASE + "/wordle.html");
  await page.click("#wordle-cat-all");
  const texts = await page.$$eval("#wordle-category-list label", (e) => e.map((x) => x.textContent.trim()));
  const inputs = await page.$$("#wordle-category-list input");
  const state = await page.$$eval("#wordle-category-list input", (e) => e.map((x) => x.checked));
  for (let i = 0; i < inputs.length; i++) if (state[i]) await inputs[i].click();
  await inputs[texts.findIndex((t) => t.includes(category))].click();
  await page.evaluate(({ w, c }) => {
    const pool = WORDS.filter((x) => x.category === c);
    const idx = pool.findIndex((x) => x.word === w);
    Math.random = () => (idx + 0.001) / pool.length;
  }, { w: word, c: category });
  await page.click("#wordle-start-btn");
  await page.waitForTimeout(450);
}

const key = (page, ch) => page.locator('#keyboard .key:text-is("' + ch + '")').first().click();

(async () => {
  const browser = await launch();

  for (const [name, w, h] of [["طولي 390x844", 390, 844], ["عرضي 844x390", 844, 390]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
     await page.addInitScript(() => { try { localStorage.setItem("kw-tutorial-seen", "1"); } catch (e) {} });  // التجربة التوجيهية تطلع أول زيارة — نتخطاها بالاختبارات
    page.on("pageerror", (e) => { failures++; console.log("PAGEERROR:", e.message); });

    await startRound(page, "سلحفاة", "حيوان"); // ٦ أحرف => ٦ محاولات
    const base = await tile(page);
    check(name + " | ٦ صفوف بالبداية", await rows(page), 6);

    // ١) وسائل المساعدة الثلاث — سجل التلميحات يطول، والمقاس لازم يثبت
    await page.click("#wordle-hint-category-btn");
    await page.waitForTimeout(200);
    check(name + " | المقاس ثابت بعد تلميح الفئة", await tile(page), base);
    await page.click("#wordle-hint-repeat-btn");
    await page.waitForTimeout(200);
    check(name + " | المقاس ثابت بعد تلميح التكرار", await tile(page), base);
    await page.click("#wordle-hint-letter-btn");
    await page.waitForTimeout(200);
    check(name + " | المقاس ثابت بعد كشف حرف", await tile(page), base);

    // ٢) تخمين خاطئ
    for (const ch of Array.from("حمامة")) await key(page, ch);
    await key(page, "ة");
    await key(page, "إدخال");
    await page.waitForTimeout(350);
    check(name + " | المقاس ثابت بعد تخمين", await tile(page), base);

    // ٣) البوق — بدل زر البوق تطلع لافتة السرقة
    await page.click("#wordle-boq-btn");
    await page.waitForTimeout(400);
    check(name + " | المقاس ثابت بعد البوق", await tile(page), base);

    // ٤) الفريق السارق يخمّن — هنا ينضاف صف السرقة فوق الستة
    for (const ch of Array.from("حمامه")) await key(page, ch);
    await key(page, "ة");
    await key(page, "إدخال");
    await page.waitForTimeout(450);
    const rowsAfter = await rows(page);
    check(name + " | صف السرقة انضاف فوق الستة", rowsAfter > 6, true);
    check(name + " | المقاس ثابت بعد صف السرقة", await tile(page), base);

    check(name + " | ما في تداخل مع صف النتائج", await overlap(page), 0);
    check(
      name + " | الصفحة ما تنزل وتصعد",
      await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight + 1),
      false
    );
    console.log("        INFO  خلية=" + base + "، صفوف=6 → " + rowsAfter);
    await page.close();
  }

  await browser.close();
  console.log(failures ? "\n" + failures + " FAILURE(S)" : "\nALL STEAL-SIZE CHECKS PASSED");
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.log("FAILED:", e.message);
  process.exit(1);
});
