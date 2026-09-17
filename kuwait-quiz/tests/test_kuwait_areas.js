const { launch, BASE } = require("./_browser");

(async () => {
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
   await page.addInitScript(() => { try { localStorage.setItem("kw-tutorial-seen", "1"); } catch (e) {} });  // التجربة التوجيهية تطلع أول زيارة — نتخطاها بالاختبارات
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(BASE + "/wordle.html");
  const wTeamInputs = await page.$$("#wordle-team1-input, #wordle-team2-input");
  for (const inp of wTeamInputs) await inp.fill("فريق");
  await page.click("#wordle-cat-all");
  const labels = await page.$$("label.category-chip:not(.all)");
  for (const label of labels) {
    const text = await label.textContent();
    if (text.includes("مناطق الكويت")) {
      await (await label.$("input")).click();
      break;
    }
  }
  const info = await page.evaluate(() => {
    const pool = WORDS.filter((w) => w.category === "مناطق الكويت");
    return { poolLen: pool.length, idx: pool.findIndex((w) => w.word === "بوبيان") };
  });
  console.log("مناطق الكويت pool size:", info.poolLen, "| idx of بوبيان:", info.idx);
  await page.evaluate(({ idx, poolLen }) => {
    Math.random = () => (idx + 0.001) / poolLen;
  }, info);
  await page.click("#wordle-start-btn");
  await page.waitForTimeout(300);

  const attempts = await page.$$eval(".wordle-row", (els) => els.length); // بوبيان = 6 letters
  console.log("بوبيان attempts (expect 5):", attempts);

  async function clickKey(l) {
    await page.locator(`.key:text-is("${l}")`).first().click();
  }
  for (const ch of Array.from("بوبيان")) await clickKey(ch);
  await clickKey("إدخال");
  await page.waitForTimeout(300);
  const won = await page.$eval("#wordle-round-end", (el) => !el.classList.contains("hidden"));
  console.log("Win بوبيان (new مناطق الكويت word):", won);

  // check no horizontal/vertical overflow with new active-categories line at top
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  console.log("No horizontal overflow:", overflow);

  console.log("ERRORS:", errors);
  await browser.close();
})().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
