// حفظ المباراة: لو طلع اللاعب ورد، يلقى نفس المباراة — ما تنمسح إلا لما تخلص أو
// يضغط «إنهاء اللعبة». (طلب صاحب المشروع، محلي وأونلاين)
//
// «طلع ورد» = إعادة تحميل الصفحة: هذا اللي يصير لما سفاري يطرد التبويب من الذاكرة
// أو اللاعب يسكّر التطبيق ويفتحه
const { launch, BASE, makeChecker, pickOnlyCategory } = require("./_browser");

const check = makeChecker();
const eq = (name, got, want) =>
  check(name, JSON.stringify(got) === JSON.stringify(want), "طلع " + JSON.stringify(got) + " والمتوقع " + JSON.stringify(want));

const AR = "٠١٢٣٤٥٦٧٨٩";
const secs = (t) => {
  const d = String(t).replace(/[٠-٩]/g, (x) => AR.indexOf(x)).match(/(\d+):(\d+)/);
  return d ? Number(d[1]) * 60 + Number(d[2]) : NaN;
};
const key = (page, k) =>
  page.evaluate((x) => document.dispatchEvent(new KeyboardEvent("keydown", { key: x, bubbles: true })), k);

// كل اللي يبين على الشاشة ويهم: لو تطابق قبل وبعد التحميل، الاسترجاع صح
async function snapshot(page) {
  return page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const tiles = [...document.querySelectorAll("#wordle-grid .wordle-tile")];
    return {
      screen: ["wordle-setup-screen", "wordle-play-screen", "wordle-end-screen"].find((id) => !q("#" + id).classList.contains("hidden")),
      scores: [...document.querySelectorAll("#wordle-scoreboard .team-chip .score")].map((e) => e.textContent),
      subtitle: q("#wordle-subtitle").textContent,
      letters: tiles.map((t) => t.textContent).join(""),
      graded: tiles.filter((t) => /\b(green|yellow|gray)\b/.test(t.className)).length,
      rows: q("#wordle-grid").children.length,
      points: q("#wordle-points").textContent,
      catHintUsed: q("#wordle-hint-category-btn").disabled,
      hintLog: q("#wordle-hint-log").textContent,
      keys: [...document.querySelectorAll("#keyboard .key.gray")].length,
      boq: q("#wordle-boq-btn").textContent,
    };
  });
}

// الأونلاين: الهوست يحدّث الصفحة وسط الجولة ويكمل الحكم بنفس الكلمة، واللاعب
// يحدّث ويرجع للغرفة لحاله. وبعد ما تخلص المباراة ما يرجع لها
async function online(browser) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => localStorage.setItem("kw-tutorial-seen", "1"));
  await ctx.route("**://*.googleapis.com/**", (r) => r.abort());
  await ctx.route("**://*.gstatic.com/**", (r) => r.abort());
  const errors = [];
  const open = async (pid) => {
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errors.push(pid + ": " + e.message));
    await p.goto(BASE + "/wordle-online.html?net=local&pid=" + pid);
    return p;
  };
  const shown = (p, id) => p.$eval(id, (e) => !e.classList.contains("hidden"));
  const graded = (p) => p.$$eval("#online-grid .wordle-tile.gray, #online-grid .wordle-tile.green, #online-grid .wordle-tile.yellow", (e) => e.length);
  const rowLen = (p) => p.$$eval("#online-grid .wordle-row:first-child .wordle-tile", (e) => e.length);
  const sendRow = async (p, n) => {
    const before = await graded(p);
    for (let i = 0; i < n; i++) await key(p, "ء");
    await key(p, "Enter");
    await p.waitForFunction((b) => document.querySelectorAll("#online-grid .wordle-tile.gray").length > b, before, { timeout: 5000 });
  };

  const host = await open("sh");
  await host.fill("#online-name-input", "سالم");
  await host.click("#online-create-btn");
  await host.waitForTimeout(400);
  const code = (await host.$eval("#online-room-code", (e) => e.textContent)).trim();
  const foe = await open("sf");
  await foe.fill("#online-name-input", "بدر");
  await foe.fill("#online-code-input", code);
  await foe.click("#online-join-btn");
  await foe.waitForTimeout(400);
  await host.locator('.online-team-pick[data-team="0"]').click();
  await foe.locator('.online-team-pick[data-team="1"]').click();
  await host.waitForTimeout(300);
  await pickOnlyCategory(host, "online", "حيوان");
  await host.click("#online-start-btn");
  await host.waitForTimeout(600);

  const n = await rowLen(host);
  await sendRow(host, n);
  const subtitle = await host.textContent("#online-subtitle");

  // الهوست يحدّث: يرجع لحاله لشاشة اللعب، ونفس الجولة
  await host.reload();
  await host.waitForSelector("#online-play:not(.hidden)", { timeout: 5000 });
  eq("أونلاين: الهوست رجع للعب بدون ما يضغط شي", await shown(host, "#online-play"), true);
  eq("أونلاين: نفس الجولة", await host.textContent("#online-subtitle"), subtitle);
  eq("أونلاين: التخمين القديم ما تكرّر", await graded(host), n);

  // الحكم يشتغل بعد الرجوع: تخمين جديد ينحسب عند الخصم
  await sendRow(host, n);
  await foe.waitForFunction((x) => document.querySelectorAll("#online-grid .wordle-tile.gray").length >= x, n * 2, { timeout: 5000 });
  check("أونلاين: الهوست يحكم بعد الرجوع (الخصم شاف التخمين الثاني)", true);

  // الخصم يحدّث: يرجع لحاله
  await foe.reload();
  await foe.waitForSelector("#online-play:not(.hidden)", { timeout: 5000 });
  eq("أونلاين: اللاعب رجع للغرفة لحاله", await shown(foe, "#online-play"), true);

  // بعد نهاية المباراة ما يرجع لها
  await host.click("#online-end-match-btn");
  await foe.waitForSelector("#online-end:not(.hidden)", { timeout: 5000 });
  await foe.reload();
  await foe.waitForTimeout(800);
  eq("أونلاين: بعد نهاية المباراة يفتح على البداية", await shown(foe, "#online-home"), true);

  check("أونلاين: بلا أخطاء JS", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => localStorage.setItem("kw-tutorial-seen", "1"));
  await ctx.route("**://*.googleapis.com/**", (r) => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE + "/wordle.html");
  await pickOnlyCategory(page, "wordle", "حيوان");
  await page.selectOption("#wordle-round-time", "60");
  await page.click("#wordle-start-btn");
  await page.waitForTimeout(300);

  // تخمين واحد مرسل + مساعدة + حروف بالصف الحالي ما انرسلت
  const len = await page.$$eval("#wordle-grid .wordle-row:first-child .wordle-tile", (e) => e.length);
  for (let i = 0; i < len; i++) await key(page, "ء");
  await key(page, "Enter");
  await page.waitForTimeout(150);
  await page.click("#wordle-hint-category-btn");
  await key(page, "ب");
  await key(page, "ت");
  await page.waitForTimeout(150);
  const before = await snapshot(page);
  const clockBefore = secs(await page.textContent("#wordle-timer"));

  await page.reload();
  await page.waitForTimeout(500);
  const after = await snapshot(page);
  eq("محلي: رجع على شاشة اللعب مو الإعداد", after.screen, "wordle-play-screen");
  eq("محلي: نفس الجولة والفريق", after.subtitle, before.subtitle);
  eq("محلي: التخمين المرسل رجع بألوانه", after.graded, before.graded);
  eq("محلي: الحروف اللي ما انرسلت رجعت", after.letters, before.letters);
  eq("محلي: النقاط المعروضة نفسها (المساعدة محسوبة)", after.points, before.points);
  eq("محلي: المساعدة مستخدمة ومسجّلة", [after.catHintUsed, after.hintLog], [before.catHintUsed, before.hintLog]);
  eq("محلي: ألوان الكيبورد رجعت", after.keys, before.keys);
  const clockAfter = secs(await page.textContent("#wordle-timer"));
  check("محلي: الوقت كمّل من مكانه", clockAfter <= clockBefore && clockBefore - clockAfter <= 3, clockBefore + " ← " + clockAfter);

  // **الوقت يوقف وأنت برّا**: نخفي الصفحة، نقدّم الساعة ٣٠ ثانية، ونرجّع
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const clockHidden = secs(await page.textContent("#wordle-timer"));
  await page.addInitScript(() => {
    const base = Date.now;
    Date.now = () => base() + 30000;
  });
  await page.reload();
  await page.waitForTimeout(500);
  const clockBack = secs(await page.textContent("#wordle-timer"));
  check("محلي: الغياب ما ياكل من الوقت", clockHidden - clockBack <= 3, clockHidden + " ← " + clockBack);

  // نتيجة: نكسب الجولة، نحمّل، والنقاط محفوظة وشاشة نهاية الجولة ظاهرة
  const word = await page.evaluate(() => {
    const snap = JSON.parse(localStorage.getItem("kw-local-match"));
    return snap.round.target;
  });
  for (let i = 0; i < 12; i++) await key(page, "Backspace");
  for (const ch of Array.from(word)) await key(page, ch);
  await key(page, "Enter");
  await page.waitForTimeout(300);
  const won = await snapshot(page);
  await page.reload();
  await page.waitForTimeout(500);
  const wonAfter = await snapshot(page);
  eq("محلي: النقاط بعد الفوز محفوظة", wonAfter.scores, won.scores);
  check("محلي: شاشة نهاية الجولة رجعت", await page.$eval("#wordle-round-end", (e) => !e.classList.contains("hidden")));

  // الجولة الجاية تكمل عادي بعد الاسترجاع
  await page.click("#wordle-next-team-btn");
  await page.waitForTimeout(300);
  check("محلي: دور الفريق الثاني بعد الاسترجاع", (await page.textContent("#wordle-subtitle")).includes("الثاني"));

  // «إنهاء اللعبة» يمسح الحفظ
  await page.click("#wordle-end-match-btn");
  await page.waitForTimeout(200);
  await page.reload();
  await page.waitForTimeout(400);
  eq("محلي: بعد «إنهاء اللعبة» ترجع للإعداد", (await snapshot(page)).screen, "wordle-setup-screen");

  check("محلي: بلا أخطاء JS", errors.length === 0, errors.join(" | "));
  await ctx.close();

  await online(browser);
  await browser.close();
  check.done();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
