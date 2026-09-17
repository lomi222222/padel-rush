// اختبارات إضافية: رابط الدعوة، التوزيع التلقائي، تبديل الفريق من الهوست،
// إعادة الدخول بعد تحديث الصفحة، ورسالة غياب إعداد Firebase
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

async function newTab(context, query) {
  const page = await context.newPage();
   await page.addInitScript(() => { try { localStorage.setItem("kw-tutorial-seen", "1"); } catch (e) {} });  // التجربة التوجيهية تطلع أول زيارة — نتخطاها بالاختبارات
  page.on("pageerror", (e) => {
    failures++;
    console.log("PAGEERROR:", e.message);
  });
  await page.goto(BASE + "/wordle-online.html" + query);
  await page.waitForTimeout(150);
  return page;
}

(async () => {
  const browser = await launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
   await context.addInitScript(() => { try { localStorage.setItem("kw-tutorial-seen", "1"); } catch (e) {} });  // التجربة التوجيهية تطلع أول زيارة — نتخطاها بالاختبارات

  const seed = await newTab(context, "?net=local&pid=seed");
  await seed.evaluate(() => localStorage.removeItem("kw-net-local-tree"));
  await seed.close();

  // ===== غياب إعداد Firebase: رسالة عربية واضحة والأزرار معطّلة =====
  const noCfg = await newTab(context, "");
  await noCfg.waitForTimeout(400);
  const statusText = await noCfg.$eval("#online-status", (el) => el.textContent);
  // بالساندبوكس ما فيه إنترنت فمكتبة Firebase ما تتحمّل أصلاً، فأي من الرسالتين صحيحة
  check(
    "clear arabic error when online is not usable",
    statusText.includes("Firebase") || statusText.includes("مكتبة الاتصال"),
    true
  );
  check("create button disabled without config", await noCfg.$eval("#online-create-btn", (el) => el.disabled), true);
  check("join button disabled without config", await noCfg.$eval("#online-join-btn", (el) => el.disabled), true);
  await noCfg.close();

  // ===== الهوست ينشئ غرفة =====
  const host = await newTab(context, "?net=local&pid=H1");
  await host.fill("#online-name-input", "سالم");
  await host.click("#online-create-btn");
  await host.waitForTimeout(300);
  const code = (await host.$eval("#online-room-code", (el) => el.textContent)).trim();

  // ===== الدخول عبر رابط الدعوة (?room=) =====
  const invited = await newTab(context, "?net=local&pid=I1&room=" + code);
  await invited.waitForTimeout(200);
  check("invite link hides create button", await invited.$eval("#online-create-btn", (el) => el.classList.contains("hidden")), true);
  check("invite link hides code input", await invited.$eval("#online-code-input", (el) => el.classList.contains("hidden")), true);
  check("join button mentions the room code", (await invited.$eval("#online-join-btn", (el) => el.textContent)).includes(code), true);

  await invited.fill("#online-name-input", "ناصر");
  await invited.click("#online-join-btn");
  await invited.waitForTimeout(400);
  check("invited player entered lobby", await invited.$eval("#online-lobby", (el) => !el.classList.contains("hidden")), true);

  const p3 = await newTab(context, "?net=local&pid=P3&room=" + code);
  await p3.fill("#online-name-input", "بدر");
  await p3.click("#online-join-btn");
  await p3.waitForTimeout(400);

  const p4 = await newTab(context, "?net=local&pid=P4&room=" + code);
  await p4.fill("#online-name-input", "فهد");
  await p4.click("#online-join-btn");
  await p4.waitForTimeout(400);

  await host.waitForTimeout(300);
  check("4 players in lobby", await host.$$eval(".online-player-row", (e) => e.length), 4);

  // ===== التوزيع التلقائي: توزيع متساوٍ =====
  await host.click("#online-auto-assign-btn");
  await host.waitForTimeout(500);
  const badges = await host.$$eval(".online-player-row .online-team-badge", (els) => els.map((e) => e.textContent));
  check("nobody left teamless after auto-assign", badges.filter((b) => b === "بدون فريق").length, 0);
  const counts = {};
  badges.forEach((b) => (counts[b] = (counts[b] || 0) + 1));
  check("auto-assign split 2/2", Object.values(counts).sort(), [2, 2]);

  // ===== الهوست يبدّل فريق لاعب بالضغط على صفه =====
  const beforeBadge = await p3.$eval(".online-player-row .online-team-badge", (el) => el.textContent);
  await host.locator(".online-player-row").first().click();
  await host.waitForTimeout(400);
  const afterBadge = await p3.$eval(".online-player-row .online-team-badge", (el) => el.textContent);
  check("host click changed a player's team", afterBadge !== beforeBadge, true);

  // ===== لا يمكن البدء وفريق فاضي =====
  await host.locator(".online-player-row").nth(0).click();
  await host.waitForTimeout(200);
  // نخلي الكل بنفس الفريق
  await host.evaluate(() => {
    const tree = JSON.parse(localStorage.getItem("kw-net-local-tree"));
    const code = Object.keys(tree.rooms)[0];
    Object.keys(tree.rooms[code].players).forEach((pid) => {
      tree.rooms[code].players[pid].team = 0;
    });
    localStorage.setItem("kw-net-local-tree", JSON.stringify(tree));
    new BroadcastChannel("kw-net-local").postMessage({ path: "rooms/" + code + "/players" });
  });
  await host.waitForTimeout(400);
  await host.click("#online-start-btn");
  await host.waitForTimeout(300);
  check("start blocked with an empty team", await host.$eval("#online-lobby-error", (el) => !el.classList.contains("hidden")), true);
  check("still in lobby", await host.$eval("#online-lobby", (el) => !el.classList.contains("hidden")), true);

  // نرجّع التوزيع ونبدأ
  await host.click("#online-auto-assign-btn");
  await host.waitForTimeout(400);
  await host.click("#online-start-btn");
  await host.waitForTimeout(600);
  check("match started", await host.$eval("#online-play", (el) => !el.classList.contains("hidden")), true);

  // ===== إعادة تحميل صفحة لاعب: يرجع لنفس مقعده ويشوف اللعبة =====
  await p4.reload();
  await p4.waitForTimeout(300);
  await p4.fill("#online-name-input", "فهد");
  await p4.click("#online-join-btn");
  await p4.waitForTimeout(600);
  check("rejoined player lands straight in the game", await p4.$eval("#online-play", (el) => !el.classList.contains("hidden")), true);
  check("rejoined player sees the scoreboard", await p4.$$eval("#online-scoreboard .team-chip", (e) => e.length), 2);

  // اللاعب اللي رجع يقدر يكتب لو دوره
  const p4Turn = await p4.$eval("#online-turn-note", (el) => el.className.includes("mine"));
  if (p4Turn) {
    await p4.locator('#online-keyboard .key:text-is("ا")').first().click();
    await p4.waitForTimeout(500);
    const tiles = await host.$$eval("#online-grid .wordle-row:first-child .wordle-tile", (els) =>
      els.map((e) => e.textContent).join("")
    );
    check("rejoined player's typing reaches host", tiles.includes("ا"), true);
  } else {
    console.log("INFO | rejoined player is on the waiting team this round (typing test skipped)");
  }

  check("no horizontal overflow (host)", await host.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true);
  check("no horizontal overflow (player)", await p3.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true);

  await browser.close();
  console.log(failures === 0 ? "\nALL ONLINE-2 CHECKS PASSED" : "\n" + failures + " CHECK(S) FAILED");
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
