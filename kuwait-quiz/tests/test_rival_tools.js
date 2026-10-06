// أدوات الفريق الخصم: «غيّر السؤال» و«الفرصة الأخيرة» — محلي وأونلاين.
//
// القواعد (قرارات صاحب المشروع):
// - غيّر السؤال: مرة وحدة باللعبة كلها لكل فريق. الوقت يكمل، والكلمة الجديدة
//   بعددها العادي ناقص وحدة (مهما صرفوا على القديمة)، وأول تخمين عليها ينحسب
//   «ثاني محاولة». والمساعدات تنفتح من جديد بلا خصم
// - الفرصة الأخيرة: تلقائية كل ما فشل الفريق (محاولات أو وقت)، محاولة وحدة بـ١٥
//   ثانية، والصح = ٥٠. ولو فشلت الجولة تنتهي
//
// الكلمات: نثبّت Math.random على قيمة وحدة قبل البداية، ونعيد نفس الخلطة داخل
// الصفحة (WordleCore.shuffle بنفس الـrandom) — فنعرف كل كلمة بتنسحب بالترتيب
// بدل ما نثبّت كلمات بالنص (تنكسر أول ما يتغيّر البنك)
const { launch, BASE, makeChecker, pickOnlyCategory } = require("./_browser");

const check = makeChecker();
// check يستقبل شرطاً مو «فعلي ومتوقع» — فمقارنة القيم لازم تمر من هني، وإلا
// false وصفر يطيحون دايماً وأي قيمة ثانية تنجح بالغلط
const eq = (name, got, want) =>
  check(name, JSON.stringify(got) === JSON.stringify(want), "طلع " + JSON.stringify(got) + " والمتوقع " + JSON.stringify(want));
const CAT = "حيوان";
const AR = "٠١٢٣٤٥٦٧٨٩";
// «١:٠٠» ← ٦٠ ثانية (مو ١٠٠)
const secs = (t) => {
  const d = String(t).replace(/[٠-٩]/g, (x) => AR.indexOf(x)).match(/(\d+):(\d+)/);
  return d ? Number(d[1]) * 60 + Number(d[2]) : NaN;
};
const num = (t) => Number(String(t).replace(/[٠-٩]/g, (d) => AR.indexOf(d)).replace(/[^\d]/g, "")) || 0;

// ترتيب سحب الكلمات: الكيس ينخلط مرة وينسحب من آخره
async function plannedWords(page) {
  return page.evaluate((cat) => {
    Math.random = () => 0.5;
    const pool = WORDS.filter((w) => w.category === cat).slice();
    WordleCore.shuffle(pool);
    return pool.map((w) => w.word).reverse();
  }, CAT);
}

// نكتب بأحداث keydown على document — نفس اللي يسمعه المتحكّمان (شوف loseRound).
//
// **ونعيد لين ينحسب الصف**: بالأونلاين الكتابة بدفعة وحدة تسابق وصول الحالة من
// الهوست، ولو وصل إطار قديم وسط الكتابة يكتب فوق الصف فيروح الإرسال ناقصاً. نمسح
// أول ونعيد لين يزيد عدد الخانات الملوّنة (أو تنتهي الجولة) — نفس علاج loseRound
async function submitRow(page, prefix, word) {
  const letters = Array.from(word).filter((c) => c !== " ");
  for (let t = 0; t < 6; t++) {
    const before = await graded(page, prefix);
    await page.evaluate(({ w, n }) => {
      const key = (k) => document.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
      for (let i = 0; i < n; i++) key("Backspace");
      for (const ch of w) key(ch);
      key("Enter");
    }, { w: letters, n: letters.length + 2 });
    try {
      await page.waitForFunction(
        ({ p, b }) =>
          document.querySelectorAll("#" + p + "-grid .wordle-tile.gray, #" + p + "-grid .wordle-tile.green, #" + p + "-grid .wordle-tile.yellow").length > b ||
          !document.querySelector("#" + p + "-round-end").classList.contains("hidden"),
        { p: prefix, b: before },
        { timeout: 1500 }
      );
      return;
    } catch (e) {}
  }
  throw new Error("الصف ما انحسب: " + word);
}

const typeWord = (page, word, prefix) => submitRow(page, prefix || "wordle", word);
const wrongGuess = (page, prefix, len) => submitRow(page, prefix, "ء".repeat(len));

const graded = (page, prefix) =>
  page.evaluate((p) => document.querySelectorAll("#" + p + "-grid .wordle-tile.gray, #" + p + "-grid .wordle-tile.green, #" + p + "-grid .wordle-tile.yellow").length, prefix);
const rows = (page, prefix) => page.$$eval("#" + prefix + "-grid .wordle-row", (e) => e.length);
const text = (page, sel) => page.$eval(sel, (e) => e.textContent);
const visible = (page, sel) => page.$eval(sel, (e) => !e.classList.contains("hidden"));
const scores = (page, prefix) =>
  page.$$eval("#" + prefix + "-scoreboard .team-chip .score", (els) => els.map((e) => e.textContent));
// صفوف الكلمة الجديدة بعد التغيير: عددها العادي ناقص وحدة. الحروف بس، فلو طلع
// عنوان من كلمتين ما تنحسب المسافة
const changedRows = (page, word) =>
  page.evaluate((w) => WordleCore.attemptsForLength(Array.from(w).filter((c) => c !== " ").length) - 1, word);
const expected = (page, attempt, max) =>
  page.evaluate(({ a, m }) => WordleCore.finalScoreForAttempt(a, m, WordleCore.newHints()), { a: attempt, m: max });

async function local(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem("kw-tutorial-seen", "1"));
  await page.route("**://*.googleapis.com/**", (r) => r.abort());
  await page.goto(BASE + "/wordle.html");
  await pickOnlyCategory(page, "wordle", CAT);
  await page.selectOption("#wordle-round-count", "3");
  await page.selectOption("#wordle-round-time", "60");
  const W = await plannedWords(page);
  await page.click("#wordle-start-btn");
  await page.waitForTimeout(300);

  // ===== الجولة ١: الفريق الأول يلعب، والثاني يغيّر السؤال بعد محاولتين =====
  const len1 = Array.from(W[0]).length;
  const rows0 = await rows(page, "wordle");
  eq("محلي: زر «غيّر السؤال» ظاهر للخصم", await visible(page, "#wordle-change-btn"), true);
  // مساعدة قبل التغيير — لازم ما ينحسب خصمها على الكلمة الجديدة
  await page.click("#wordle-hint-category-btn");
  await wrongGuess(page, "wordle", len1);
  await wrongGuess(page, "wordle", len1);
  // نقدّم الساعة ٢٠ ثانية: بدونها كل هذا يصير بأقل من ثانية والعدّاد يظل ١:٠٠
  // قبل وبعد — فما نقدر نفرّق «كمّل» عن «رجع من البداية»
  await page.evaluate(() => {
    const base = Date.now;
    Date.now = () => base() + 20000;
  });
  await page.waitForTimeout(400);
  const clockBefore = secs(await text(page, "#wordle-timer"));
  await page.click("#wordle-change-btn");
  await page.waitForTimeout(200);

  eq("محلي: صفوف الكلمة الجديدة = عددها العادي − ١", await rows(page, "wordle"), await changedRows(page, W[1]));
  eq("محلي: الشبكة انمسحت", await graded(page, "wordle"), 0);
  eq("محلي: ألوان الكيبورد تصفّرت",
    await page.$$eval("#keyboard .key.green, #keyboard .key.yellow, #keyboard .key.gray", (e) => e.length), 0);
  eq("محلي: مساعدة الفئة انفتحت من جديد", await page.$eval("#wordle-hint-category-btn", (b) => !b.disabled), true);
  eq("محلي: رسالة التغيير", (await text(page, "#wordle-message")).includes("غيّر"), true);
  const clockAfter = secs(await text(page, "#wordle-timer"));
  check("محلي: المؤقّت ما رجع من البداية", clockAfter <= clockBefore && clockAfter <= 45, clockBefore + " ← " + clockAfter);
  eq("محلي: الزر انقفل للفريق اللي استخدمه", await page.$eval("#wordle-change-btn", (b) => b.disabled), true);

  // النقاط تكمل السلّم: المحاولة الجاية رقم ٣ من (الأصل + ١)، وبلا خصم الفئة
  // أول تخمين على الجديدة = «ثاني محاولة» من عددها العادي
  const want1 = await expected(page, 2, (await changedRows(page, W[1])) + 1);
  eq("محلي: النقاط المعروضة تكمل السلّم بلا خصم المساعدات",
    num(await text(page, "#wordle-points")), want1);
  await typeWord(page, W[1]);
  await page.waitForTimeout(250);
  eq("محلي: الفوز بعد التغيير يعطي نفس الرقم", num((await scores(page, "wordle"))[0]), want1);

  // ===== الجولة ٢: الفريق الثاني يلعب، والأول يغيّر قبل أي محاولة =====
  await page.click("#wordle-next-team-btn");
  await page.waitForTimeout(250);
  await page.click("#wordle-change-btn");
  await page.waitForTimeout(200);
  eq("محلي: حتى قبل أي محاولة تنقص وحدة", await rows(page, "wordle"), await changedRows(page, W[3]));

  // نخلّص محاولاتهم ⇒ فرصة أخيرة للفريق الأول
  const len2 = Array.from(W[3]).length;
  const rowsAfter = await rows(page, "wordle");
  for (let i = 0; i < rowsAfter; i++) await wrongGuess(page, "wordle", len2);
  eq("محلي: الفرصة الأخيرة بدأت لحالها",
    (await visible(page, "#wordle-steal-note")) && (await text(page, "#wordle-steal-note")).includes("فرصة أخيرة"), true);
  eq("محلي: الجولة ما انتهت وقت الفرصة", await visible(page, "#wordle-round-end"), false);
  eq("محلي: الكلمة ما انكشفت وقت الفرصة", (await text(page, "#wordle-message")).includes(W[3]), false);
  check("محلي: عدّاد الفرصة ١٥ ثانية أو أقل", secs(await text(page, "#wordle-timer")) <= 15, await text(page, "#wordle-timer"));
  const before2 = await scores(page, "wordle");
  await typeWord(page, W[3]);
  await page.waitForTimeout(250);
  const after2 = await scores(page, "wordle");
  eq("محلي: الفرصة الصح = +٥٠ للخصم", num(after2[0]) - num(before2[0]), 50);
  eq("محلي: وما ياخذ صاحب الدور شي", num(after2[1]), num(before2[1]));
  eq("محلي: رسالة الفرصة", (await text(page, "#wordle-message")).includes("بالفرصة الأخيرة"), true);

  // ===== الجولة ٣: الفريق الأول يلعب — الثاني استخدم مرته باللعبة =====
  await page.click("#wordle-next-team-btn");
  await page.waitForTimeout(250);
  eq("محلي: «غيّر السؤال» مرة باللعبة كلها مو بالجولة", await page.$eval("#wordle-change-btn", (b) => b.disabled), true);
  const r3 = await rows(page, "wordle");
  const len3 = Array.from(W[4]).length;
  for (let i = 0; i < r3; i++) await wrongGuess(page, "wordle", len3);
  const before3 = await scores(page, "wordle");
  await wrongGuess(page, "wordle", len3);
  eq("محلي: الفرصة الغلط تنهي الجولة", await visible(page, "#wordle-round-end"), true);
  eq("محلي: وتكشف الكلمة", (await text(page, "#wordle-message")).includes(W[4]), true);
  eq("محلي: وبلا نقاط", await scores(page, "wordle"), before3);

  // ===== الجولة ٤: خلوص وقت الفرصة =====
  await page.click("#wordle-next-team-btn");
  await page.waitForTimeout(250);
  const r4 = await rows(page, "wordle");
  const len4 = Array.from(W[5]).length;
  for (let i = 0; i < r4; i++) await wrongGuess(page, "wordle", len4);
  await page.evaluate(() => {
    const base = Date.now;
    Date.now = () => base() + 16000;
  });
  await page.waitForTimeout(700);
  eq("محلي: خلوص وقت الفرصة ينهي الجولة", await visible(page, "#wordle-round-end"), true);
  eq("محلي: برسالة الوقت", (await text(page, "#wordle-message")).includes("خلص وقت الفرصة"), true);

  check("محلي: بلا أخطاء JS", errors.length === 0, errors.join(" | "));
  await page.close();
}

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

  const host = await open("host");
  await host.fill("#online-name-input", "سالم");
  await host.click("#online-create-btn");
  await host.waitForTimeout(400);
  const code = (await host.$eval("#online-room-code", (e) => e.textContent)).trim();
  const foe = await open("foe");
  await foe.fill("#online-name-input", "بدر");
  await foe.fill("#online-code-input", code);
  await foe.click("#online-join-btn");
  await foe.waitForTimeout(400);
  await host.locator('.online-team-pick[data-team="0"]').click();
  await foe.locator('.online-team-pick[data-team="1"]').click();
  await host.waitForTimeout(300);
  await pickOnlyCategory(host, "online", CAT);
  await host.selectOption("#online-round-count", "3");
  const W = await plannedWords(host);
  await host.click("#online-start-btn");
  await host.waitForTimeout(600);

  // نيّة خام تتخطّى الزر — عشان نختبر حارس الهوست نفسه مو الزر
  // الرقم: نص خطوة فوق آخر إدخال للاعب. أكبر ⇒ الهوست يقبلها، بس إدخاله الحقيقي
  // الجاي (آخر رقم + ١) يظل أكبر منها — لو كبّرناها، الهوست يتجاهل كل كتابته بعدها
  const rawIntent = (page, pid, action) =>
    page.evaluate(async ({ c, p, a }) => {
      const ref = NetLocal.create().ref("rooms/" + c + "/inputs/" + p);
      const last = await ref.get();
      await ref.set({ seq: ((last && last.seq) || 0) + 0.5, action: a, buffer: [] });
    }, { c: code, p: pid, a: action });

  const rows0 = await rows(host, "online");
  eq("أونلاين: «غيّر السؤال» مخفي عن الفريق اللي يلعب", await visible(host, "#online-change-btn"), false);
  eq("أونلاين: وظاهر للخصم", await visible(foe, "#online-change-btn"), true);

  await rawIntent(host, "host", "change");
  await host.waitForTimeout(500);
  eq("أونلاين: الهوست يرفض التغيير من الفريق اللي يلعب", (await text(host, "#online-message")).includes("غيّر"), false);

  const len1 = Array.from(W[0]).length;
  await wrongGuess(host, "online", len1);
  await wrongGuess(host, "online", len1);
  await foe.click("#online-change-btn");
  await host.waitForFunction(() => document.querySelector("#online-message").textContent.includes("غيّر"), null, { timeout: 5000 });
  const wantRows = await changedRows(host, W[1]);
  eq("أونلاين: صفوف الكلمة الجديدة عند الهوست = عددها العادي − ١", await rows(host, "online"), wantRows);
  eq("أونلاين: ونفسها عند الخصم", await rows(foe, "online"), wantRows);
  await foe.waitForTimeout(200);
  eq("أونلاين: زر الخصم انقفل بعد مرته", await foe.$eval("#online-change-btn", (b) => b.disabled), true);

  const rowsNow = await rows(host, "online");
  await rawIntent(foe, "foe", "change");
  await host.waitForTimeout(500);
  eq("أونلاين: الهوست يرفض المرة الثانية", await rows(host, "online"), rowsNow);

  const want = await expected(host, 2, wantRows + 1);
  await typeWord(host, W[1], "online");
  await host.waitForFunction(() => !document.querySelector("#online-round-end").classList.contains("hidden"), null, { timeout: 5000 });
  eq("أونلاين: الفوز بعد التغيير يكمل السلّم", num((await scores(foe, "online"))[0]), want);

  // ===== الجولة ٢: الخصم يلعب ويخسر ⇒ فرصة أخيرة لفريق الهوست =====
  await host.click("#online-next-team-btn");
  await host.waitForTimeout(500);
  const r2 = await rows(foe, "online");
  const len2 = Array.from(W[2]).length;
  for (let i = 0; i < r2; i++) await wrongGuess(foe, "online", len2);
  await host.waitForFunction(() => {
    const k = document.querySelector("#online-keyboard .key");
    return k && !k.disabled;
  }, null, { timeout: 5000 });
  eq("أونلاين: الدور صار للخصم بالفرصة", (await text(host, "#online-steal-note")).includes("فرصة أخيرة"), true);
  const before = await scores(host, "online");
  await typeWord(host, W[2], "online");
  await host.waitForFunction(() => !document.querySelector("#online-round-end").classList.contains("hidden"), null, { timeout: 5000 });
  const after = await scores(host, "online");
  eq("أونلاين: الفرصة الصح = +٥٠", num(after[0]) - num(before[0]), 50);

  check("أونلاين: بلا أخطاء JS", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

(async () => {
  const browser = await launch();
  await local(browser);
  await online(browser);
  await browser.close();
  check.done();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
