// اختبار البوق + المؤقّت + الفئة الحصرية + صيغة المحاولات بالوضع المحلي
const { launch, BASE } = require("./_browser");

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log((ok ? "PASS" : "FAIL") + " | " + label + " => " + JSON.stringify(actual) +
    (ok ? "" : "  (expected " + JSON.stringify(expected) + ")"));
}

async function pickCategory(page, category) {
  // نضمن البداية من "لا شيء مختار" مهما كانت الحالة الحالية
  if (!(await page.$eval("#wordle-cat-all", (el) => el.checked))) {
    await page.click("#wordle-cat-all"); // يصير مختار الكل
    await page.waitForTimeout(80);
  }
  await page.click("#wordle-cat-all"); // يصير بدون أي فئة
  await page.waitForTimeout(80);
  const catTexts = await page.$$eval("#wordle-category-list label", (els) => els.map((e) => e.textContent));
  const inputs = await page.$$("#wordle-category-list input");
  await inputs[catTexts.indexOf(category)].click();
  await page.waitForTimeout(120);
  const picked = await page.$$eval("#wordle-category-list input", (els) => els.filter((e) => e.checked).length);
  if (picked !== 1) throw new Error("category setup failed: " + picked + " selected");
}

async function pinWord(page, category, word) {
  const info = await page.evaluate(({ cat, w }) => {
    const pool = WORDS.filter((x) => x.category === cat);
    return { poolLen: pool.length, idx: pool.findIndex((x) => x.word === w) };
  }, { cat: category, w: word });
  await page.evaluate(({ idx, poolLen }) => { Math.random = () => (idx + 0.001) / poolLen; }, info);
  return info;
}

async function keys(page, word) {
  for (const ch of Array.from(word)) {
    await page.locator(`.key:text-is("${ch}")`).first().click();
  }
}
const enter = (page) => page.locator('.key:text-is("إدخال")').first().click();

(async () => {
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
   await page.addInitScript(() => { try { localStorage.setItem("kw-tutorial-seen", "1"); } catch (e) {} });  // التجربة التوجيهية تطلع أول زيارة — نتخطاها بالاختبارات
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(BASE + "/wordle.html");
  await page.waitForTimeout(250);

  // ===== صيغة المحاولات الجديدة =====
  const table = await page.evaluate(() =>
    [3, 4, 5, 6, 7, 8, 9].map((n) => WordleCore.attemptsForLength(n))
  );
  check("attempts table 3..9", table, [4, 5, 5, 6, 6, 7, 7]);

  // ===== الفئة الحصرية =====
  // حد أدنى مو رقم ثابت — الرقم الثابت ينكسر مع كل توسيع للبنك
  check("bank size لا ينقص", await page.evaluate(() => WORDS.length >= 1196), true);
  // حد أدنى بعد — الفئة كاملة ١١٤ سورة، والرقم الثابت ينكسر مع أي تنقيح لها
  check("surah category count", await page.evaluate(
    () => WORDS.filter((w) => w.category === "سور القرآن الكريم").length >= 110), true);
  check("exclusive chip is gold-styled", await page.$eval(
    "#wordle-category-list label.exclusive", (el) => el.textContent), "سور القرآن الكريم");

  // "الكل" ما يشمل الحصرية
  const allChecked = await page.$$eval("#wordle-category-list input", (els) => els.map((e) => e.checked));
  const labels = await page.$$eval("#wordle-category-list label", (els) => els.map((e) => e.textContent));
  const surahIdx = labels.indexOf("سور القرآن الكريم");
  check('"الكل" leaves the exclusive category unchecked', allChecked[surahIdx], false);
  check('"الكل" checks every normal category', allChecked.filter((c, i) => i !== surahIdx).every(Boolean), true);

  // اختيار الحصرية يلغي كل الباقي
  const inputs = await page.$$("#wordle-category-list input");
  await inputs[surahIdx].click();
  await page.waitForTimeout(150);
  const afterSurah = await page.$$eval("#wordle-category-list input", (els) => els.map((e) => e.checked));
  check("picking the exclusive clears all others", afterSurah.filter(Boolean).length, 1);
  check("the one left checked is the exclusive", afterSurah[surahIdx], true);

  // اختيار فئة عادية يلغي الحصرية
  await (await page.$$("#wordle-category-list input"))[0].click();
  await page.waitForTimeout(150);
  const afterNormal = await page.$$eval("#wordle-category-list input", (els) => els.map((e) => e.checked));
  check("picking a normal category clears the exclusive", afterNormal[surahIdx], false);
  check("only that normal category stays", afterNormal.filter(Boolean).length, 1);

  // ===== البوق =====
  for (const inp of await page.$$("#wordle-team1-input, #wordle-team2-input")) await inp.fill("");
  await page.fill("#wordle-team1-input", "الأول");
  await page.fill("#wordle-team2-input", "الثاني");
  await pickCategory(page, "حيوان");
  await pinWord(page, "حيوان", "سلحفاة"); // ٦ أحرف => ٦ محاولات بالصيغة الجديدة
  await page.click("#wordle-start-btn");
  await page.waitForTimeout(300);

  check("6-letter word now gets 6 rows", await page.$$eval(".wordle-row", (e) => e.length), 6);
  check("boq button visible", await page.$eval("#wordle-boq-btn", (el) => !el.classList.contains("hidden")), true);
  check("boq labelled for the waiting team", (await page.$eval("#wordle-boq-btn", (el) => el.textContent)).includes("الثاني"), true);
  check("boq shows 2 left", (await page.$eval("#wordle-boq-btn", (el) => el.textContent)).includes("٢"), true);

  // الفريق الأصلي يحاول محاولة خاطئة أول
  await keys(page, "حصانن".slice(0, 6));
  await keys(page, "ة");
  await enter(page);
  await page.waitForTimeout(250);
  const ownRows = await page.$$eval(".wordle-row .wordle-tile.gray, .wordle-row .wordle-tile.green, .wordle-row .wordle-tile.yellow", (e) => e.length);
  check("first guess registered", ownRows > 0, true);

  // ===== البوق الأول: محاولة وحدة وتضيع =====
  await page.click("#wordle-boq-btn");
  await page.waitForTimeout(250);
  check("steal note visible", await page.$eval("#wordle-steal-note", (el) => !el.classList.contains("hidden")), true);
  const note = await page.$eval("#wordle-steal-note", (el) => el.textContent);
  check("steal note names the stealing team", note.includes("الثاني"), true);
  check("steal says one attempt only", note.includes("محاولة وحدة"), true);
  check("steal locked value = 500", note.includes("٥٠٠"), true);
  check("hints disabled during steal", await page.$eval("#wordle-hint-category-btn", (el) => el.disabled), true);
  check("boq button hidden during steal", await page.$eval("#wordle-boq-btn", (el) => el.classList.contains("hidden")), true);

  // خطأ واحد ينهي السرقة على طول
  await keys(page, "حصانة");
  await keys(page, "ة");
  await enter(page);
  await page.waitForTimeout(300);
  check("a single miss ends the steal", await page.$eval("#wordle-steal-note", (el) => el.classList.contains("hidden")), true);
  check("original team resumes", (await page.$eval("#wordle-message", (el) => el.textContent)).includes("يكمل"), true);
  check("boq now shows 1 left", (await page.$eval("#wordle-boq-btn", (el) => el.textContent)).includes("١"), true);

  // ===== البوق الثاني (الأخير): يسرقها من أول محاولة =====
  await page.click("#wordle-boq-btn");
  await page.waitForTimeout(250);
  check("second steal still worth 500", (await page.$eval("#wordle-steal-note", (el) => el.textContent)).includes("٥٠٠"), true);
  await keys(page, "سلحفاة");
  await enter(page);
  await page.waitForTimeout(300);
  check("steal success message", (await page.$eval("#wordle-message", (el) => el.textContent)).includes("سرقها"), true);
  const scores = await page.$$eval("#wordle-scoreboard .team-chip .score", (els) => els.map((e) => e.textContent));
  check("stealing team got exactly 500", scores[1], "٥٠٠ نقطة");
  check("original team got nothing", scores[0], "٠ نقطة");
  check("round ended", await page.$eval("#wordle-round-end", (el) => !el.classList.contains("hidden")), true);

  // الجولة الجديدة: عدّاد البوق نقص للفريق الثاني
  await page.click("#wordle-next-team-btn");
  await page.waitForTimeout(300);
  check("now team2's turn so team1 can boq", (await page.$eval("#wordle-boq-btn", (el) => el.textContent)).includes("الأول"), true);
  check("team1 still has 2 boqs", (await page.$eval("#wordle-boq-btn", (el) => el.textContent)).includes("٢"), true);

  check("no page errors", errors, []);
  await browser.close();
  console.log(failures === 0 ? "\nALL BOQ/LOCAL CHECKS PASSED" : "\n" + failures + " CHECK(S) FAILED");
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error("FAILED:", e); process.exit(1); });
