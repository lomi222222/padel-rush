// اختبار الوضع الأونلاين كامل عبر النقل المحلي (?net=local) بثلاث تبويبات:
// هوست + لاعب بنفس فريقه + لاعب بالفريق الخصم
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

const url = (pid) => BASE + "/wordle-online.html?net=local&pid=" + pid;

async function newTab(context, pid) {
  const page = await context.newPage();
   await page.addInitScript(() => { try { localStorage.setItem("kw-tutorial-seen", "1"); } catch (e) {} });  // التجربة التوجيهية تطلع أول زيارة — نتخطاها بالاختبارات
  page.on("pageerror", (e) => {
    failures++;
    console.log("PAGEERROR(" + pid + "):", e.message);
  });
  await page.goto(url(pid));
  await page.waitForTimeout(150);
  return page;
}

async function keys(page, word) {
  for (const ch of Array.from(word)) {
    await page.locator('#online-keyboard .key:text-is("' + ch + '")').first().click();
    await page.waitForTimeout(60);
  }
}

(async () => {
  const browser = await launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
   await context.addInitScript(() => { try { localStorage.setItem("kw-tutorial-seen", "1"); } catch (e) {} });  // التجربة التوجيهية تطلع أول زيارة — نتخطاها بالاختبارات

  // نظّف أي حالة سابقة
  const seed = await context.newPage();
   await seed.addInitScript(() => { try { localStorage.setItem("kw-tutorial-seen", "1"); } catch (e) {} });  // التجربة التوجيهية تطلع أول زيارة — نتخطاها بالاختبارات
  await seed.goto(BASE + "/wordle-online.html?net=local&pid=seed");
  await seed.evaluate(() => localStorage.removeItem("kw-net-local-tree"));
  await seed.close();

  // ===== الهوست ينشئ غرفة =====
  const host = await newTab(context, "hostA");
  await host.fill("#online-name-input", "سالم");
  await host.click("#online-create-btn");
  await host.waitForTimeout(300);

  const code = (await host.$eval("#online-room-code", (el) => el.textContent)).trim();
  check("room code is 4 chars", code.length, 4);
  check("host sees lobby", await host.$eval("#online-lobby", (el) => !el.classList.contains("hidden")), true);
  check("host controls visible", await host.$eval("#online-host-controls", (el) => !el.classList.contains("hidden")), true);
  check("host player row count", await host.$$eval(".online-player-row", (e) => e.length), 1);

  // ===== لاعبان يدخلان عبر الرمز =====
  const p2 = await newTab(context, "playerB");
  await p2.fill("#online-name-input", "ناصر");
  await p2.fill("#online-code-input", code);
  await p2.click("#online-join-btn");
  await p2.waitForTimeout(300);
  check("p2 in lobby", await p2.$eval("#online-lobby", (el) => !el.classList.contains("hidden")), true);
  check("p2 sees no host controls", await p2.$eval("#online-host-controls", (el) => el.classList.contains("hidden")), true);
  check("p2 sees waiting text", await p2.$eval("#online-wait-host", (el) => !el.classList.contains("hidden")), true);

  const p3 = await newTab(context, "playerC");
  await p3.fill("#online-name-input", "بدر");
  await p3.fill("#online-code-input", code);
  await p3.click("#online-join-btn");
  await p3.waitForTimeout(300);

  await host.waitForTimeout(300);
  check("host now sees 3 players", await host.$$eval(".online-player-row", (e) => e.length), 3);
  check("p2 also sees 3 players", await p2.$$eval(".online-player-row", (e) => e.length), 3);

  // ===== اللاعب يختار فريقه بنفسه =====
  await p2.locator('.online-team-pick[data-team="0"]').click();
  await p2.waitForTimeout(250);
  await p3.locator('.online-team-pick[data-team="1"]').click();
  await p3.waitForTimeout(250);

  const teamsInLobby = await host.$$eval(".online-player-row .online-team-badge", (els) => els.map((e) => e.textContent));
  check("no player left without a team", teamsInLobby.filter((t) => t === "بدون فريق").length, 0);

  // ===== الهوست يبدأ اللعبة بفئة وكلمة معروفة =====
  await host.click("#online-cat-all"); // إلغاء الكل
  const catTexts = await host.$$eval("#online-category-list label", (els) => els.map((e) => e.textContent));
  const catInputs = await host.$$("#online-category-list input");
  await catInputs[catTexts.indexOf("حيوان")].click();
  await host.waitForTimeout(150);

  // نثبّت الكلمة على "سلحفاة" (٦ أحرف => ٥ محاولات)
  const info = await host.evaluate(() => {
    const pool = WORDS.filter((w) => w.category === "حيوان");
    return { poolLen: pool.length, idx: pool.findIndex((w) => w.word === "سلحفاة") };
  });
  await host.evaluate(({ idx, poolLen }) => {
    Math.random = () => (idx + 0.001) / poolLen;
  }, info);

  await host.click("#online-start-btn");
  await host.waitForTimeout(500);

  check("host on play screen", await host.$eval("#online-play", (el) => !el.classList.contains("hidden")), true);
  check("p2 on play screen", await p2.$eval("#online-play", (el) => !el.classList.contains("hidden")), true);
  check("p3 on play screen", await p3.$eval("#online-play", (el) => !el.classList.contains("hidden")), true);
  check("grid rows = 6 attempts", await host.$$eval("#online-grid .wordle-row", (e) => e.length), 6);
  check(
    "الفئة المختارة توصل لأجهزة اللاعبين كحبّة",
    await p3.$$eval("#online-active-categories .cat-pill", (e) => e.map((x) => x.textContent)),
    ["حيوان"]
  );

  // ===== السرية: الكلمة ما تنشر لأجهزة اللاعبين =====
  const leak = await p3.evaluate(() => {
    const raw = localStorage.getItem("kw-net-local-tree") || "";
    const tree = JSON.parse(raw);
    const room = Object.values(tree.rooms || {})[0] || {};
    return {
      stateHasWord: JSON.stringify(room.state || {}).includes("سلحفاة"),
      hasTargetKey: JSON.stringify(room.state || {}).includes("target"),
    };
  });
  check("published state does NOT contain the answer", leak.stateHasWord, false);
  check("published state has no target key", leak.hasTargetKey, false);

  // ===== الأدوار: الفريق الأول يكتب، الثاني ممنوع =====
  check("host turn note is 'my turn'", await host.$eval("#online-turn-note", (el) => el.className.includes("mine")), true);
  check("p2 (same team) turn note is 'my turn'", await p2.$eval("#online-turn-note", (el) => el.className.includes("mine")), true);
  check("p3 (other team) is watching", await p3.$eval("#online-turn-note", (el) => el.className.includes("watching")), true);
  check("p3 keyboard disabled", await p3.$eval('#online-keyboard .key', (el) => el.disabled), true);
  check("host keyboard enabled", await host.$eval('#online-keyboard .key', (el) => el.disabled), false);

  // ===== كتابة مشتركة: الهوست يكتب ٣ أحرف والزميل يكمل =====
  await keys(host, "سلح");
  await p2.waitForTimeout(400);
  const p2Sees = await p2.$$eval("#online-grid .wordle-row:first-child .wordle-tile", (els) =>
    els.map((e) => e.textContent).join("")
  );
  check("teammate sees host's live typing", p2Sees, "سلح");
  const p3Sees = await p3.$$eval("#online-grid .wordle-row:first-child .wordle-tile", (els) =>
    els.map((e) => e.textContent).join("")
  );
  check("opponent also sees the shared board", p3Sees, "سلح");

  await keys(p2, "فاة");
  await host.waitForTimeout(400);
  const hostSees = await host.$$eval("#online-grid .wordle-row:first-child .wordle-tile", (els) =>
    els.map((e) => e.textContent).join("")
  );
  check("host sees teammate's letters", hostSees, "سلحفاة");

  // ===== تلميح من زميل يوصل للجميع =====
  await p2.click("#online-hint-category-btn");
  await p2.waitForTimeout(400);
  check("hint reached host", await host.$eval("#online-hint-log .hint-box", (el) => el.textContent), "الفئة: حيوان");
  check("hint reached opponent", await p3.$eval("#online-hint-log .hint-box", (el) => el.textContent), "الفئة: حيوان");

  // ===== الإرسال والفوز =====
  await p2.locator('#online-keyboard .key:text-is("إدخال")').first().click();
  await p2.waitForTimeout(500);
  check("win message on host", await host.$eval("#online-message", (el) => el.className.includes("win")), true);
  check("win message on opponent too", await p3.$eval("#online-message", (el) => el.className.includes("win")), true);
  // فوز بالمحاولة ١ مع تلميح الفئة: 200*6 = 1200، ناقص ٢٥٪ = 900
  check("score synced", await p3.$eval("#online-scoreboard .team-chip .score", (el) => el.textContent), "٩٠٠ نقطة");
  check("round-end row visible for all", await p3.$eval("#online-round-end", (el) => !el.classList.contains("hidden")), true);
  check("next button only for host", await host.$eval("#online-next-team-btn", (el) => !el.classList.contains("hidden")), true);
  check("player sees waiting-for-host", await p3.$eval("#online-round-end-wait", (el) => !el.classList.contains("hidden")), true);

  // ===== الدور التالي: ينقلب الفريق الفعّال =====
  await host.click("#online-next-team-btn");
  await host.waitForTimeout(500);
  check("now p3 turn", await p3.$eval("#online-turn-note", (el) => el.className.includes("mine")), true);
  check("host now watching", await host.$eval("#online-turn-note", (el) => el.className.includes("watching")), true);
  check("host keyboard disabled now", await host.$eval("#online-keyboard .key", (el) => el.disabled), true);
  check("p3 keyboard enabled now", await p3.$eval("#online-keyboard .key", (el) => el.disabled), false);
  check("hint log cleared for new round", await host.$$eval("#online-hint-log .hint-box", (e) => e.length), 0);

  // ===== الفريق الخصم ما يقدر يأثر لما مو دوره =====
  const before = await p3.$$eval("#online-grid .wordle-row:first-child .wordle-tile", (els) => els.length);
  await host.evaluate(() => {
    // محاولة إرسال إدخال مباشرة من جهاز مو دوره
    const tree = JSON.parse(localStorage.getItem("kw-net-local-tree"));
    const code = Object.keys(tree.rooms)[0];
    tree.rooms[code].inputs = tree.rooms[code].inputs || {};
    tree.rooms[code].inputs["hostA"] = { seq: Date.now() + 999, action: "submit", buffer: ["ا","ا","ا","ا","ا","ا"] };
    localStorage.setItem("kw-net-local-tree", JSON.stringify(tree));
    new BroadcastChannel("kw-net-local").postMessage({ path: "rooms/" + code + "/inputs" });
  });
  await host.waitForTimeout(400);
  check("out-of-turn input rejected (no guesses recorded)", await p3.$$eval("#online-grid .wordle-tile.gray, #online-grid .wordle-tile.green, #online-grid .wordle-tile.yellow", (e) => e.length), 0);

  // ===== إنهاء المباراة =====
  await host.click("#online-end-match-btn");
  await host.waitForTimeout(500);
  check("host end screen", await host.$eval("#online-end", (el) => !el.classList.contains("hidden")), true);
  check("p2 end screen", await p2.$eval("#online-end", (el) => !el.classList.contains("hidden")), true);
  check("p3 end screen", await p3.$eval("#online-end", (el) => !el.classList.contains("hidden")), true);
  check("final rows", await p3.$$eval("#online-final-scores .final-score-row", (e) => e.length), 2);
  check("winner name shown", (await p3.$eval("#online-winner-name", (el) => el.textContent)).includes("الفريق"), true);

  await browser.close();
  console.log(failures === 0 ? "\nALL ONLINE CHECKS PASSED" : "\n" + failures + " CHECK(S) FAILED");
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
