// فئة «مناطق الكويت»: تنختار، وكلمتها تنكتب وتُقبل وتفوز، وعدد الصفوف يطابق
// الصيغة، وما يصير تجاوز أفقي.
//
// **ما يثبّت كلمة بالنص**: كان يثبّت «بوبيان»، فانكسر أول ما انشالت من البنك.
// نفس الدرس من test_new_titles اللي انهمل لأنه ثبّت مواضع كلمات. الحين ياخذ
// الكلمة من الفئة وقت التشغيل، فيصمد مهما تغيّر البنك.
//
// وكان يطبع نتائجه بلا فحص (process.exit(1) الوحيد داخل catch) — يعني يطلع
// أخضر حتى لو الجولة ما انتهت. صار يفحص فعلاً.
const { launch, BASE, makeChecker } = require("./_browser");

const CAT = "مناطق الكويت";
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

  // نختار الفئة وحدها
  await page.click("#wordle-cat-all");
  let picked = false;
  for (const label of await page.$$("label.category-chip")) {
    if ((await label.textContent()).includes(CAT)) {
      await (await label.$("input")).click();
      picked = true;
      break;
    }
  }
  check("الفئة موجودة بقائمة الاختيار", picked);

  // الكلمة تنختار وقت التشغيل — أول وحدة بالفئة، بلا أي تثبيت
  const info = await page.evaluate((cat) => {
    const pool = WORDS.filter((w) => w.category === cat);
    if (!pool.length) return { poolLen: 0 };
    Math.random = () => 0.001 / pool.length; // ⇒ الفهرس ٠
    return { poolLen: pool.length, word: pool[0].word };
  }, CAT);

  check("الفئة مو فاضية", info.poolLen > 0, info.poolLen + " منطقة");
  const target = info.word;
  const letters = Array.from(target).filter((c) => c !== " ");

  await page.click("#wordle-start-btn");
  await page.waitForTimeout(350);

  // عدد الصفوف = صيغة المحاولات نفسها، تُقرأ من Core مو مكتوبة برقم
  const expected = await page.evaluate((n) => WordleCore.attemptsForLength(n), letters.length);
  const actual = await page.$$eval(".wordle-row", (els) => els.length);
  check("عدد الصفوف يطابق الصيغة", actual === expected, "«" + target + "» ⇒ " + actual + " (متوقع " + expected + ")");

  for (const ch of letters) await page.locator(`.key:text-is("${ch}")`).first().click();
  await page.locator('.key:text-is("إدخال")').first().click();
  await page.waitForTimeout(400);

  const won = await page.$eval("#wordle-round-end", (el) => !el.classList.contains("hidden"));
  check("الكلمة الصحيحة تفوز بالجولة", won, "«" + target + "»");

  const allGreen = await page.evaluate(() => {
    const row = [...document.querySelectorAll(".wordle-row")].find((r) =>
      [...r.children].some((t) => t.className.includes("green"))
    );
    if (!row) return false;
    const tiles = [...row.children].filter((t) => !t.className.includes("gap"));
    return tiles.length > 0 && tiles.every((t) => t.className.includes("green"));
  });
  check("الصف كله أخضر", allGreen);

  check(
    "ولا تجاوز أفقي",
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
  );
  check("ما صار خطأ JS", errors.length === 0, errors.join(" | "));

  await browser.close();
  check.done("فئة مناطق الكويت سليمة");
})().catch((e) => {
  console.error("‼️ طاح:", e.message);
  process.exit(1);
});
