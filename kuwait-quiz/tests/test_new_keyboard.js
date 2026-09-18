// تخطيط الكيبورد: كل حرف موجود ببنك الكلمات لازم يكون على الكيبورد، وإلا فيه
// كلمة ما ينقدر ينكتب أصلاً.
//
// كان هذا الملف يطبع النتيجة بس ولا يفشل أبداً — يعني «نجاح» كاذب بكل تشغيلة.
// صار يفحص فعلاً.
const { launch, BASE, makeChecker } = require("./_browser");

const check = makeChecker();

(async () => {
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  // التجربة التوجيهية تطلع أول زيارة — نتخطاها بالاختبارات
  await page.addInitScript(() => {
    try {
      localStorage.setItem("kw-tutorial-seen", "1");
    } catch (e) {}
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(BASE + "/wordle.html");
  for (const inp of await page.$$("#wordle-team1-input, #wordle-team2-input")) await inp.fill("فريق");
  await page.click("#wordle-start-btn");
  await page.waitForTimeout(300);

  const rows = await page.$$eval(".keyboard-row", (rowsEl) =>
    rowsEl.map((r) => Array.from(r.children).map((k) => k.textContent))
  );
  rows.forEach((r, i) => console.log("        صف " + (i + 1) + ": " + r.join(" ")));

  check("الكيبورد أربعة صفوف", rows.length === 4, rows.length + " صف");

  const flat = rows.flat();
  check("فيه مفتاح إدخال", flat.includes("إدخال"));
  check("فيه مفتاح مسح", flat.includes("⌫"));

  // الفحص الأهم: ولا حرف ببنك الكلمات ناقص من الكيبورد
  const missing = await page.evaluate(() => {
    const keys = new Set();
    document.querySelectorAll(".key").forEach((k) => {
      const t = k.textContent;
      if (t !== "إدخال" && t !== "⌫") keys.add(t);
    });
    const out = new Set();
    WORDS.forEach((w) => {
      Array.from(w.word).forEach((ch) => {
        if (ch !== " " && !keys.has(ch)) out.add(ch);
      });
    });
    return [...out];
  });
  check("كل حروف بنك الكلمات على الكيبورد", missing.length === 0, missing.join(" "));

  check("ما صار خطأ JS", errors.length === 0, errors.join(" | "));

  await browser.close();
  check.done("تخطيط الكيبورد سليم");
})().catch((e) => {
  console.error("‼️ طاح:", e.message);
  process.exit(1);
});
