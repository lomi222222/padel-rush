// يتأكد إن الوضع المحلي ما انكسر بعد فصل المنطق عن الرسم
const { launch, BASE } = require("./_browser");

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log((ok ? "PASS" : "FAIL") + " | " + label + " => " + JSON.stringify(actual) + (ok ? "" : " (expected " + JSON.stringify(expected) + ")"));
}

async function pickAndStart(page, category, targetWord) {
  await page.click("#wordle-cat-all");
  const catTexts = await page.$$eval("#wordle-category-list label", (els) => els.map((e) => e.textContent));
  const inputs = await page.$$("#wordle-category-list input");
  await inputs[catTexts.indexOf(category)].click();

  const info = await page.evaluate(
    ({ cat, word }) => {
      const pool = WORDS.filter((w) => w.category === cat);
      return { poolLen: pool.length, idx: pool.findIndex((w) => w.word === word) };
    },
    { cat: category, word: targetWord }
  );
  await page.evaluate(({ idx, poolLen }) => {
    Math.random = () => (idx + 0.001) / poolLen;
  }, info);
  await page.click("#wordle-start-btn");
  await page.waitForTimeout(250);
  return info;
}

(async () => {
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
   await page.addInitScript(() => { try { localStorage.setItem("kw-tutorial-seen", "1"); } catch (e) {} });  // التجربة التوجيهية تطلع أول زيارة — نتخطاها بالاختبارات
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(BASE + "/wordle.html");
  await page.waitForTimeout(200);

  // حد أدنى بدل عدد ثابت: العدد الثابت كان ينكسر مع كل توسيع للبنك، والمهم إنه ما ينقص
  check("WORDS.length لا ينقص", await page.evaluate(() => WORDS.length >= 1014), true);
  check("categories count", await page.$$eval("#wordle-category-list label", (e) => e.length), 20);

  for (const inp of await page.$$("#wordle-team1-input, #wordle-team2-input")) await inp.fill("فريق");

  // 6 حروف => 6 محاولات بالصيغة الجديدة
  await pickAndStart(page, "حيوان", "سلحفاة");
  check("attempts for 6 letters", await page.$$eval(".wordle-row", (e) => e.length), 6);
  // العنوان صار داخل <p class="round-line"> عشان رقم النقاط يقعد جنبه، فنفحص
  // الترتيب بالكلاس مو بالـid
  check(
    "card order (categories then subtitle)",
    await page.$eval(".wordle-info", (el) =>
      Array.from(el.children).slice(0, 2).map((c) => c.id || c.className)),
    ["wordle-active-categories", "round-line"]
  );
  check(
    "العنوان ورقم النقاط داخل نفس السطر",
    await page.$eval(".round-line", (el) =>
      ["wordle-subtitle", "wordle-attempts", "wordle-points"].every((id) => !!el.querySelector("#" + id))),
    true
  );
  check(
    "الفئة المختارة تبين كحبّة",
    await page.$$eval("#wordle-active-categories .cat-pill", (e) => e.map((x) => x.textContent)),
    ["حيوان"]
  );
  check("keyboard keys count", await page.$$eval(".key", (e) => e.length), 35);

  // تلميح الفئة يشتغل ويطلع بالسجل
  await page.click("#wordle-hint-category-btn");
  await page.waitForTimeout(150);
  check("hint log has 1 entry", await page.$$eval("#wordle-hint-log .hint-box", (e) => e.length), 1);
  check("hint category text", await page.$eval("#wordle-hint-log .hint-box", (el) => el.textContent), "الفئة: حيوان");

  // تخمين خاطئ أولاً عشان نتأكد من التلوين
  async function clickKey(l) {
    await page.locator(`.key:text-is("${l}")`).first().click();
  }
  for (const ch of Array.from("سلحفاه")) await clickKey(ch);
  await clickKey("إدخال");
  await page.waitForTimeout(200);
  const firstRow = await page.$$eval(".wordle-row:first-child .wordle-tile", (els) =>
    els.map((e) => ({ t: e.textContent, c: e.className }))
  );
  check("first 5 tiles all green after near-miss", firstRow.slice(0, 5).map((t) => t.c.includes("green")), [true, true, true, true, true]);
  check("last tile not green (ه vs ة)", firstRow[5].c.includes("green"), false);

  // الآن الفوز
  for (const ch of Array.from("سلحفاة")) await clickKey(ch);
  await clickKey("إدخال");
  await page.waitForTimeout(250);
  check("round end visible after win", await page.$eval("#wordle-round-end", (el) => !el.classList.contains("hidden")), true);
  check("message is win", await page.$eval("#wordle-message", (el) => el.className.includes("win")), true);
  // فوز بالمحاولة ٢ مع تلميح الفئة: raw = 100*(6-2+1)=500، ثم نصف = 250
  check("score after win w/ category hint", await page.$eval("#wordle-scoreboard .team-chip .score", (el) => el.textContent), "٢٥٠ نقطة");

  // الدور التالي
  await page.click("#wordle-next-team-btn");
  await page.waitForTimeout(250);
  check("second team is current", await page.$$eval("#wordle-scoreboard .team-chip", (els) => els.map((e) => e.className.includes("current"))), [false, true]);

  // ±٢٥ يشتغل — صارت مخفية خلف زر القلم، فنفتحها أول
  await page.click("#wordle-score-edit-btn");
  await page.waitForTimeout(150);
  await page.locator("#wordle-scoreboard .team-chip").first().locator(".score-adjust-btn").last().click();
  await page.waitForTimeout(150);
  check("plus 25 works", await page.$eval("#wordle-scoreboard .team-chip .score", (el) => el.textContent), "٢٧٥ نقطة");

  // إنهاء اللعبة يوصّل لشاشة النهاية
  await page.click("#wordle-end-match-btn");
  await page.waitForTimeout(250);
  check("end screen visible", await page.$eval("#wordle-end-screen", (el) => !el.classList.contains("hidden")), true);
  check("final score rows", await page.$$eval("#wordle-final-scores .final-score-row", (e) => e.length), 2);

  check("no horizontal overflow", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true);
  check("no page errors", errors, []);

  await browser.close();
  console.log(failures === 0 ? "\nALL LOCAL REGRESSION CHECKS PASSED" : "\n" + failures + " CHECK(S) FAILED");
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
