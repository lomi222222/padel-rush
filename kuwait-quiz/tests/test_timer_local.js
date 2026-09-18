// المؤقّت + مسار فشل البوق + حد الـ٣ بوقات
const { launch, BASE } = require("./_browser");

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log((ok ? "PASS" : "FAIL") + " | " + label + " => " + JSON.stringify(actual) +
    (ok ? "" : "  (expected " + JSON.stringify(expected) + ")"));
}

async function pickCategory(page, category) {
  if (!(await page.$eval("#wordle-cat-all", (el) => el.checked))) {
    await page.click("#wordle-cat-all");
    await page.waitForTimeout(80);
  }
  await page.click("#wordle-cat-all");
  await page.waitForTimeout(80);
  const catTexts = await page.$$eval("#wordle-category-list label", (els) => els.map((e) => e.textContent));
  const inputs = await page.$$("#wordle-category-list input");
  await inputs[catTexts.indexOf(category)].click();
  await page.waitForTimeout(120);
}

async function pinWord(page, category, word) {
  const info = await page.evaluate(({ cat, w }) => {
    const pool = WORDS.filter((x) => x.category === cat);
    return { poolLen: pool.length, idx: pool.findIndex((x) => x.word === w) };
  }, { cat: category, w: word });
  await page.evaluate(({ idx, poolLen }) => { Math.random = () => (idx + 0.001) / poolLen; }, info);
}

async function keys(page, word) {
  for (const ch of Array.from(word)) await page.locator(`.key:text-is("${ch}")`).first().click();
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

  // خيارات المؤقّت موجودة + خيار الوقت المخصص
  const opts = await page.$$eval("#wordle-round-time option", (els) => els.map((e) => e.textContent));
  check("timer options", opts, ["بدون وقت", "٣٠ ثانية", "دقيقة", "دقيقتان", "٣ دقائق", "٥ دقائق", "⏱️ وقت مخصص"]);
  check("default is no timer", await page.$eval("#wordle-round-time", (el) => el.value), "0");
  check("custom field hidden by default", await page.$eval("#wordle-round-time-custom", (el) => el.classList.contains("hidden")), true);

  // ===== وقت مخصص: ٤ دقائق =====
  await page.selectOption("#wordle-round-time", "-1");
  await page.waitForTimeout(150);
  check("custom field appears when picked", await page.$eval("#wordle-round-time-custom", (el) => !el.classList.contains("hidden")), true);
  await page.fill("#wordle-round-time-custom", "4");
  await page.fill("#wordle-team1-input", "أ");
  await page.fill("#wordle-team2-input", "ب");
  await pickCategory(page, "حيوان");
  await pinWord(page, "حيوان", "سلحفاة");
  await page.click("#wordle-start-btn");
  await page.waitForTimeout(400);
  const customShown = await page.$eval("#wordle-timer", (el) => el.textContent);
  check("custom 4 minutes started the clock at ~4:00", /[٣٤]:[٠-٩][٠-٩]/.test(customShown), true);
  await page.click("#wordle-end-match-btn");
  await page.waitForTimeout(200);
  await page.click("#wordle-restart-btn");
  await page.waitForTimeout(200);
  await page.selectOption("#wordle-round-time", "0");
  await page.waitForTimeout(150);
  check("custom field hides again", await page.$eval("#wordle-round-time-custom", (el) => el.classList.contains("hidden")), true);

  // ===== بدون وقت: المؤقّت مخفي =====
  await page.fill("#wordle-team1-input", "الأول");
  await page.fill("#wordle-team2-input", "الثاني");
  await pickCategory(page, "حيوان");
  await pinWord(page, "حيوان", "سلحفاة");
  await page.click("#wordle-start-btn");
  await page.waitForTimeout(300);
  check("timer hidden when 'no time'", await page.$eval("#wordle-timer", (el) => el.classList.contains("hidden")), true);

  // ===== فشل البوق: ينحرق ويكمل الفريق الأصلي بمحاولاته كاملة =====
  await page.click("#wordle-boq-btn");
  await page.waitForTimeout(200);
  await keys(page, "حصانة");
  await keys(page, "ة");
  await enter(page);
  await page.waitForTimeout(300);
  check("steal note gone after the single miss", await page.$eval("#wordle-steal-note", (el) => el.classList.contains("hidden")), true);
  check("original team resumes", (await page.$eval("#wordle-message", (el) => el.textContent)).includes("يكمل"), true);
  check("boq now shows 1 left", (await page.$eval("#wordle-boq-btn", (el) => el.textContent)).includes("١"), true);
  check("hints re-enabled after failed steal", await page.$eval("#wordle-hint-category-btn", (el) => el.disabled), false);

  // الفريق الأصلي لسه عنده كل محاولاته الستة (صف السرقة زيادة مو خصم)
  const ownLeft = await page.evaluate(() => {
    const rows = document.querySelectorAll("#wordle-grid .wordle-row").length;
    const steal = document.querySelectorAll("#wordle-grid .wordle-row.steal").length;
    return { rows, steal };
  });
  check("1 steal row added on top of the 6", ownLeft, { rows: 7, steal: 1 });

  // الفريق الأصلي يفوز الحين: المحاولة الأولى له => 200*6 = 1200
  await keys(page, "سلحفاة");
  await enter(page);
  await page.waitForTimeout(300);
  const scores = await page.$$eval("#wordle-scoreboard .team-chip .score", (els) => els.map((e) => e.textContent));
  check("original team still scored as attempt 1 (1200)", scores[0], "١٢٠٠ نقطة");

  // ===== المؤقّت الفعلي: ٣٠ ثانية، نقصّره عبر تقديم الساعة =====
  await page.click("#wordle-next-team-btn");
  await page.waitForTimeout(200);
  await page.click("#wordle-end-match-btn");
  await page.waitForTimeout(200);
  await page.click("#wordle-restart-btn");
  await page.waitForTimeout(200);

  await page.fill("#wordle-team1-input", "الأول");
  await page.fill("#wordle-team2-input", "الثاني");
  await pickCategory(page, "حيوان");
  await page.selectOption("#wordle-round-time", "30");
  await pinWord(page, "حيوان", "سلحفاة");
  await page.click("#wordle-start-btn");
  await page.waitForTimeout(400);
  check("timer visible with a duration set", await page.$eval("#wordle-timer", (el) => !el.classList.contains("hidden")), true);
  const shown = await page.$eval("#wordle-timer", (el) => el.textContent);
  check("timer counts down from ~30s", /٠:[٢٣][٠-٩]/.test(shown), true);

  // البوق يوقف المؤقّت
  await page.click("#wordle-boq-btn");
  await page.waitForTimeout(400);
  check("timer paused during steal", await page.$eval("#wordle-timer", (el) => el.classList.contains("paused")), true);
  const pausedA = await page.$eval("#wordle-timer", (el) => el.textContent);
  await page.waitForTimeout(1200);
  check("paused clock does not move", await page.$eval("#wordle-timer", (el) => el.textContent), pausedA);

  // نفشّل السرقة فيرجع المؤقّت يمشي
  await keys(page, "حصانة");
  await keys(page, "ة");
  await enter(page);
  await page.waitForTimeout(300);
  check("timer resumed after failed steal", await page.$eval("#wordle-timer", (el) => !el.classList.contains("paused") && /[٠-٩\d]/.test(el.textContent)), true);

  // نخلي الوقت يخلص فوراً
  await page.evaluate(() => {
    const realNow = Date.now;
    Date.now = () => realNow() + 60000;
  });
  await page.waitForTimeout(700);
  check("round lost when the clock runs out", (await page.$eval("#wordle-message", (el) => el.textContent)).includes("انتهى الوقت"), true);
  check("timeout message reveals the word", (await page.$eval("#wordle-message", (el) => el.textContent)).includes("سلحفاة"), true);
  check("round-end shown after timeout", await page.$eval("#wordle-round-end", (el) => !el.classList.contains("hidden")), true);
  const scores2 = await page.$$eval("#wordle-scoreboard .team-chip .score", (els) => els.map((e) => e.textContent));
  check("no points awarded on timeout", scores2[0], "٠ نقطة");

  check("no horizontal overflow", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true);
  check("no page errors", errors, []);
  await browser.close();
  console.log(failures === 0 ? "\nALL TIMER/STEAL-FAIL CHECKS PASSED" : "\n" + failures + " CHECK(S) FAILED");
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error("FAILED:", e); process.exit(1); });
