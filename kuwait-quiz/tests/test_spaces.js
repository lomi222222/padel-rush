const { launch, BASE } = require("./_browser");
let failures = 0;
const check = (l, a, e) => {
  const ok = JSON.stringify(a) === JSON.stringify(e);
  if (!ok) failures++;
  console.log((ok ? "PASS" : "FAIL") + " | " + l + " => " + JSON.stringify(a) + (ok ? "" : "  (expected " + JSON.stringify(e) + ")"));
};

async function playWord(page, category, word) {
  await page.goto(BASE + "/wordle.html");
  await page.waitForTimeout(300);
  await page.fill("#wordle-team1-input", "أ");
  await page.fill("#wordle-team2-input", "ب");
  if (!(await page.$eval("#wordle-cat-all", (el) => el.checked))) await page.click("#wordle-cat-all");
  await page.click("#wordle-cat-all");
  await page.waitForTimeout(80);
  const cats = await page.$$eval("#wordle-category-list label", (e) => e.map((x) => x.textContent));
  const inputs = await page.$$("#wordle-category-list input");
  await inputs[cats.indexOf(category)].click();
  await page.waitForTimeout(100);
  const info = await page.evaluate(({ c, w }) => {
    const pool = WORDS.filter((x) => x.category === c);
    return { poolLen: pool.length, idx: pool.findIndex((x) => x.word === w) };
  }, { c: category, w: word });
  await page.evaluate(({ idx, poolLen }) => { Math.random = () => (idx + 0.001) / poolLen; }, info);
  await page.click("#wordle-start-btn");
  await page.waitForTimeout(300);

  // الفراغات تُرسم كفواصل مو كمربعات
  const layout = await page.$eval("#wordle-grid .wordle-row", (row) =>
    Array.from(row.children).map((c) => (c.className.includes("gap") ? " " : "#")).join("")
  );
  // نكتب الحروف بدون مسافة — لازم المسافة تنملأ تلقائياً
  for (const ch of Array.from(word.replace(/ /g, ""))) {
    await page.locator(`.key:text-is("${ch}")`).first().click();
  }
  await page.locator('.key:text-is("إدخال")').first().click();
  await page.waitForTimeout(300);
  const won = await page.$eval("#wordle-message", (el) => el.className.includes("win"));
  return { layout, won, expectedLayout: Array.from(word).map((c) => (c === " " ? " " : "#")).join("") };
}

(async () => {
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
   await page.addInitScript(() => { try { localStorage.setItem("kw-tutorial-seen", "1"); } catch (e) {} });  // التجربة التوجيهية تطلع أول زيارة — نتخطاها بالاختبارات

  // فئات قديمة (موجودة من قبل الفئات الجديدة)
  for (const [cat, word] of [["رياضة", "كرة قدم"], ["مسلسلات", "درب الزلق"], ["روايات", "جزيرة الكنز"], ["مسرحيات", "باي باي لندن"], ["كرتون قديم", "عدنان و لينا"], ["كرتون قديم", "توم و جيري"], ["مسلسلات", "خرج و لم يعد"]]) {
    const r = await playWord(page, cat, word);
    check(`"${word}" [${cat}] — الفراغ برسم الشبكة بمكانه`, r.layout, r.expectedLayout);
    check(`"${word}" [${cat}] — فوز بكتابة الحروف بدون مسافة`, r.won, true);
  }
  await browser.close();
  console.log(failures === 0 ? "\nALL SPACE CHECKS PASSED" : "\n" + failures + " CHECK(S) FAILED");
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error("FAILED:", e); process.exit(1); });
