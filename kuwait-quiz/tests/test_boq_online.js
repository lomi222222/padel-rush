// البوق والمؤقّت بالوضع الأونلاين (٣ تبويبات عبر النقل المحلي)
const { launch, BASE } = require("./_browser");

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log((ok ? "PASS" : "FAIL") + " | " + label + " => " + JSON.stringify(actual) +
    (ok ? "" : "  (expected " + JSON.stringify(expected) + ")"));
}

async function newTab(context, pid) {
  const page = await context.newPage();
   await page.addInitScript(() => { try { localStorage.setItem("kw-tutorial-seen", "1"); } catch (e) {} });  // التجربة التوجيهية تطلع أول زيارة — نتخطاها بالاختبارات
  page.on("pageerror", (e) => { failures++; console.log("PAGEERROR(" + pid + "):", e.message); });
  await page.goto(BASE + "/wordle-online.html?net=local&pid=" + pid);
  await page.waitForTimeout(150);
  return page;
}
async function keys(page, word) {
  for (const ch of Array.from(word)) {
    await page.locator('#online-keyboard .key:text-is("' + ch + '")').first().click();
    await page.waitForTimeout(50);
  }
}
const enter = (p) => p.locator('#online-keyboard .key:text-is("إدخال")').first().click();

(async () => {
  const browser = await launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
   await context.addInitScript(() => { try { localStorage.setItem("kw-tutorial-seen", "1"); } catch (e) {} });  // التجربة التوجيهية تطلع أول زيارة — نتخطاها بالاختبارات

  const seed = await context.newPage();
   await seed.addInitScript(() => { try { localStorage.setItem("kw-tutorial-seen", "1"); } catch (e) {} });  // التجربة التوجيهية تطلع أول زيارة — نتخطاها بالاختبارات
  await seed.goto(BASE + "/wordle-online.html?net=local&pid=seed");
  await seed.evaluate(() => localStorage.removeItem("kw-net-local-tree"));
  await seed.close();

  const host = await newTab(context, "H");
  await host.fill("#online-name-input", "سالم");
  await host.click("#online-create-btn");
  await host.waitForTimeout(300);
  const code = (await host.$eval("#online-room-code", (el) => el.textContent)).trim();

  const mate = await newTab(context, "M");
  await mate.fill("#online-name-input", "ناصر");
  await mate.fill("#online-code-input", code);
  await mate.click("#online-join-btn");
  await mate.waitForTimeout(250);

  const foe = await newTab(context, "F");
  await foe.fill("#online-name-input", "بدر");
  await foe.fill("#online-code-input", code);
  await foe.click("#online-join-btn");
  await foe.waitForTimeout(250);

  await mate.locator('.online-team-pick[data-team="0"]').click();
  await mate.waitForTimeout(200);
  await foe.locator('.online-team-pick[data-team="1"]').click();
  await foe.waitForTimeout(250);

  // ===== الفئة الحصرية باللوبي =====
  const catLabels = await host.$$eval("#online-category-list label", (els) => els.map((e) => e.textContent));
  const surahIdx = catLabels.indexOf("سور القرآن الكريم");
  check("surah category listed online", surahIdx >= 0, true);
  check("surah chip has the gold class", await host.$eval(
    "#online-category-list label.exclusive", (el) => el.textContent), "سور القرآن الكريم");
  const checkedNow = await host.$$eval("#online-category-list input", (els) => els.map((e) => e.checked));
  check('"الكل" excludes the exclusive category online', checkedNow[surahIdx], false);

  const catInputs = await host.$$("#online-category-list input");
  await catInputs[surahIdx].click();
  await host.waitForTimeout(200);
  check("picking it clears the rest online", await host.$$eval(
    "#online-category-list input", (els) => els.filter((e) => e.checked).length), 1);

  // ===== نبدأ اللعبة بفئة حيوان وكلمة مثبّتة، ومؤقّت دقيقة =====
  await host.click("#online-cat-all");
  await host.waitForTimeout(120);
  await host.click("#online-cat-all");
  await host.waitForTimeout(120);
  const catInputs2 = await host.$$("#online-category-list input");
  await catInputs2[catLabels.indexOf("حيوان")].click();
  await host.waitForTimeout(150);
  await host.selectOption("#online-round-time", "60");

  const info = await host.evaluate(() => {
    const pool = WORDS.filter((w) => w.category === "حيوان");
    return { poolLen: pool.length, idx: pool.findIndex((w) => w.word === "سلحفاة") };
  });
  await host.evaluate(({ idx, poolLen }) => { Math.random = () => (idx + 0.001) / poolLen; }, info);
  await host.click("#online-start-btn");
  await host.waitForTimeout(600);

  check("timer visible for everyone", await foe.$eval("#online-timer", (el) => !el.classList.contains("hidden")), true);
  check("timer counting on the opponent's device", await foe.$eval("#online-timer", (el) => !el.classList.contains("paused") && /[٠-٩\d]/.test(el.textContent)), true);

  // ===== زر البوق يظهر للفريق المنتظر فقط =====
  check("boq hidden for the active team (host)", await host.$eval("#online-boq-btn", (el) => el.classList.contains("hidden")), true);
  check("boq hidden for the active team's mate", await mate.$eval("#online-boq-btn", (el) => el.classList.contains("hidden")), true);
  check("boq visible for the waiting team", await foe.$eval("#online-boq-btn", (el) => !el.classList.contains("hidden")), true);
  check("boq shows 2 left", (await foe.$eval("#online-boq-btn", (el) => el.textContent)).includes("٢"), true);

  // الفريق الأصلي يحاول محاولة خاطئة
  await keys(host, "حصانة");
  await keys(host, "ة");
  await enter(host);
  await host.waitForTimeout(400);

  // ===== الخصم يبوق =====
  await foe.click("#online-boq-btn");
  await foe.waitForTimeout(500);
  check("steal note reached everyone", await host.$eval("#online-steal-note", (el) => !el.classList.contains("hidden")), true);
  // المحاولة ٢ من ٦ => 100*(6-2+1) = 500
  check("locked steal value is 500", (await mate.$eval("#online-steal-note", (el) => el.textContent)).includes("٥٠٠"), true);
  check("timer paused during steal (host view)", await host.$eval("#online-timer", (el) => el.classList.contains("paused")), true);
  check("timer paused during steal (foe view)", await foe.$eval("#online-timer", (el) => el.classList.contains("paused")), true);

  // الأدوار انقلبت: السارق يكتب والأصلي ممنوع
  check("stealing team can type now", await foe.$eval("#online-keyboard .key", (el) => el.disabled), false);
  check("original team blocked during steal", await host.$eval("#online-keyboard .key", (el) => el.disabled), true);
  check("hints blocked during steal", await foe.$eval("#online-hint-category-btn", (el) => el.disabled), true);

  // الفريق الأصلي يحاول يرسل رغم إنه مو دوره — لازم ينرفض
  const before = await host.evaluate(() => {
    const t = JSON.parse(localStorage.getItem("kw-net-local-tree"));
    const c = Object.keys(t.rooms)[0];
    return (t.rooms[c].state.round.guesses || []).length;
  });
  await host.evaluate(() => {
    const t = JSON.parse(localStorage.getItem("kw-net-local-tree"));
    const c = Object.keys(t.rooms)[0];
    t.rooms[c].inputs = t.rooms[c].inputs || {};
    t.rooms[c].inputs["H"] = { seq: Date.now() + 5000, action: "submit", buffer: ["س","ل","ح","ف","ا","ة"] };
    localStorage.setItem("kw-net-local-tree", JSON.stringify(t));
    new BroadcastChannel("kw-net-local").postMessage({ path: "rooms/" + c + "/inputs" });
  });
  await host.waitForTimeout(500);
  const after = await host.evaluate(() => {
    const t = JSON.parse(localStorage.getItem("kw-net-local-tree"));
    const c = Object.keys(t.rooms)[0];
    return (t.rooms[c].state.round.guesses || []).length;
  });
  check("out-of-turn submit rejected during steal", after, before);

  // ===== السرقة تنجح =====
  await keys(foe, "سلحفاة");
  await enter(foe);
  await foe.waitForTimeout(600);
  check("steal success seen by all", (await mate.$eval("#online-message", (el) => el.textContent)).includes("سرقها"), true);
  const scores = await mate.$$eval("#online-scoreboard .team-chip .score", (els) => els.map((e) => e.textContent));
  check("stealing team scored exactly 500", scores[1], "٥٠٠ نقطة");
  check("original team got nothing", scores[0], "٠ نقطة");
  check("timer cleared after round end", await host.$eval("#online-timer", (el) => el.classList.contains("hidden")), true);

  // ===== الجولة التالية: البوق نقص للخصم فقط =====
  await host.click("#online-next-team-btn");
  await host.waitForTimeout(600);
  check("host can boq now (waiting team)", await host.$eval("#online-boq-btn", (el) => !el.classList.contains("hidden")), true);
  check("host team still has 2 boqs", (await host.$eval("#online-boq-btn", (el) => el.textContent)).includes("٢"), true);
  check("foe is now the active team", await foe.$eval("#online-turn-note", (el) => el.className.includes("mine")), true);

  check("no horizontal overflow", await foe.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true);
  await browser.close();
  console.log(failures === 0 ? "\nALL ONLINE BOQ/TIMER CHECKS PASSED" : "\n" + failures + " CHECK(S) FAILED");
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error("FAILED:", e); process.exit(1); });
