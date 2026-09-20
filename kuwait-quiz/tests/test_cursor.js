// الكتابة بموضع: اللاعب يضغط خانة بالصف الحالي ويكتب فيها بدل الترتيب الإجباري.
//
// الفحص الحاسم هنا هو الأونلاين: الحرف المكتوب بخانة ٣ لازم **يظل بخانة ٣** بعد ما
// يمر على الهوست ويرجع منشوراً. النسخة القديمة من sanitizeBuffer كانت ترصّ الحروف
// من البداية، فحرف بخانة ٣ يوصل الأجهزة بخانة ٠ — والعلة تمر بلا رسالة خطأ.
const { launch, BASE } = require("./_browser");
const { makeChecker } = require("./_browser");

const check = makeChecker();
const WORD = "سلحفاة"; // ٦ أحرف بلا مسافات — الخانة = العمود
const CAT = "حيوان";

// خانات الصف الحالي (الأول اللي ما فيه تقييم)
const curRow = (page, grid) =>
  page.evaluate((g) => {
    const rows = [...document.querySelectorAll(g + " .wordle-row")];
    const cur = rows.find((r) => ![...r.children].some((e) => /\b(green|yellow|gray)\b/.test(e.className))) || rows[0];
    return [...cur.children].map((e) => ({ cls: e.className, txt: e.textContent }));
  }, grid);

const letters = (st) => st.map((t) => t.txt || "·").join("");
const cursorAt = (st) => st.findIndex((t) => t.cls.includes("cursor"));

// الضغط لازم يصيب خانة **الصف الحالي** — الصفوف المُرسلة تجي قبله بالشبكة
async function tapTile(page, grid, col) {
  const rowIdx = await page.evaluate((g) => {
    const rows = [...document.querySelectorAll(g + " .wordle-row")];
    return rows.findIndex((r) => ![...r.children].some((e) => /\b(green|yellow|gray)\b/.test(e.className)));
  }, grid);
  // ":scope > *" عشان الفهرس = رقم العمود الحقيقي: خانات المسافة عناصر بالصف بعد
  // (بصنف wordle-tile-gap) ولو عدّينا .wordle-tile بس ينزاح الترقيم بالكلمات المركّبة
  await page.locator(grid + " .wordle-row").nth(rowIdx).locator(":scope > *").nth(col).click();
  await page.waitForTimeout(140);
}

// عدد الخانات المقيَّمة = دليل إن الإرسال صار فعلاً
const gradedCount = (page, grid) =>
  page.$$eval(grid + " .wordle-tile.green, " + grid + " .wordle-tile.yellow, " + grid + " .wordle-tile.gray", (e) => e.length);

// آخر صف مُرسَل: كل خاناته خضراء؟
const lastRowAllGreen = (page, grid) =>
  page.evaluate((g) => {
    const rows = [...document.querySelectorAll(g + " .wordle-row")].filter((r) =>
      [...r.children].some((e) => /\b(green|yellow|gray)\b/.test(e.className))
    );
    const last = rows[rows.length - 1];
    if (!last) return false;
    return [...last.children].every((e) => e.className.includes("gap") || e.className.includes("green"));
  }, grid);

// يفتح الوضع المحلي بفئة واحدة وكلمة مثبّتة
async function startLocal(browser, category, word) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.addInitScript(() => { try { localStorage.setItem("kw-tutorial-seen", "1"); } catch (e) {} });
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));

  await page.goto(BASE + "/wordle.html");
  await page.waitForTimeout(300);
  // نضمن إن «الكل» مؤشَّر ثم نلغيه — فتنفك كل الفئات ويبقى بس اللي نختاره
  if (!(await page.$eval("#wordle-cat-all", (el) => el.checked))) await page.click("#wordle-cat-all");
  await page.click("#wordle-cat-all");
  await page.waitForTimeout(80);
  const cats = await page.$$eval("#wordle-category-list label", (e) => e.map((x) => x.textContent.trim()));
  const ins = await page.$$("#wordle-category-list input");
  await ins[cats.findIndex((x) => x === category)].click();
  const info = await page.evaluate(({ c, w }) => {
    const pool = WORDS.filter((x) => x.category === c);
    return { poolLen: pool.length, idx: pool.findIndex((x) => x.word === w) };
  }, { c: category, w: word });
  await page.evaluate(({ idx, poolLen }) => { Math.random = () => (idx + 0.001) / poolLen; }, info);
  await page.click("#wordle-start-btn");
  await page.waitForTimeout(400);

  const key = async (ch) => {
    await page.locator('#keyboard .key:text-is("' + ch + '")').first().click();
    await page.waitForTimeout(80);
  };
  const tap = (col) => tapTile(page, "#wordle-grid", col);
  return { page, errs, key, tap };
}

// ===================== الوضع المحلي =====================
async function localMode(browser) {
  const { page, errs, key, tap } = await startLocal(browser, CAT, WORD);

  let st = await curRow(page, "#wordle-grid");
  check("محلي: المؤشر يبدأ على أول خانة", cursorAt(st) === 0, "العمود " + cursorAt(st));

  await tap(3);
  st = await curRow(page, "#wordle-grid");
  check("محلي: الضغط ينقل المؤشر للخانة ٣", cursorAt(st) === 3, "العمود " + cursorAt(st));

  await key("ف");
  st = await curRow(page, "#wordle-grid");
  check("محلي: الحرف انكتب بالخانة ٣ وحدها", letters(st) === "···ف··", letters(st));
  check("محلي: المؤشر انتقل لأول فاضي بعده (٤)", cursorAt(st) === 4, "العمود " + cursorAt(st));

  // الإرسال مرفوض لين تمتلئ كل الخانات — الصف مو «طوله ٤» بل فيه فراغات بالنص
  await page.locator('#keyboard .key:text-is("إدخال")').first().click();
  await page.waitForTimeout(200);
  const graded = await gradedCount(page, "#wordle-grid");
  check("محلي: الإرسال مرفوض والصف ناقص", graded === 0, "خانات مقيَّمة=" + graded);

  // المسح عند المؤشر: الخانة ٤ فاضية ⇒ يرجع للخانة ٣ ويمسحها
  await page.locator('#keyboard .key:text-is("⌫")').first().click();
  await page.waitForTimeout(150);
  st = await curRow(page, "#wordle-grid");
  check("محلي: المسح رجع ومسح الخانة ٣", letters(st) === "······", letters(st));
  check("محلي: المؤشر قعد على ٣ بعد المسح", cursorAt(st) === 3, "العمود " + cursorAt(st));

  // صف جديد ⇒ المؤشر يرجع لأول خانة: نرسل تخميناً غلطاً كاملاً ونكتب بعده
  await tap(0);
  for (const ch of Array.from("بتثجخد")) await key(ch);
  await page.locator('#keyboard .key:text-is("إدخال")').first().click();
  await page.waitForTimeout(500);
  await key("س");
  st = await curRow(page, "#wordle-grid");
  check("محلي: الحرف بعد الإرسال بدأ من أول خانة", letters(st) === "س·····", letters(st));

  // الكتابة العادية بالترتيب ما تغيّرت: نكمل الكلمة من نفس المكان
  for (const ch of Array.from(WORD).slice(1)) await key(ch);
  st = await curRow(page, "#wordle-grid");
  check("محلي: الكتابة بالترتيب تعبّي الصف كما كانت", letters(st) === WORD, letters(st));
  await page.locator('#keyboard .key:text-is("إدخال")').first().click();
  await page.waitForTimeout(500);
  check("محلي: الإرسال اشتغل والكلمة صحيحة", await lastRowAllGreen(page, "#wordle-grid"));

  check("محلي: ما صار أي خطأ JS", errs.length === 0, errs.join(" | "));
  await page.close();
}

// ============ كلمة فيها مسافة: المؤشر ما يقف على الفراغ ولا ينكتب فيه ============
// "ون بيس" ⇒ الأعمدة 0,1 حروف · 2 فراغ · 3,4,5 حروف
async function spacedWord(browser) {
  const { page, errs, key, tap } = await startLocal(browser, "أنميات", "ون بيس");

  let st = await curRow(page, "#wordle-grid");
  check("مسافة: الشبكة رسمت الفراغ بمكانه", st.map((t) => (t.cls.includes("gap") ? " " : "#")).join("") === "## ###",
    st.map((t) => (t.cls.includes("gap") ? " " : "#")).join(""));
  check("مسافة: خانة الفراغ مو قابلة للضغط", !st[2].cls.includes("tappable"), st[2].cls);

  // الضغط على خانة بعد الفراغ: الحرف يقعد بعمودها الحقيقي مو بعمود منزاح
  await tap(3);
  await key("ب");
  st = await curRow(page, "#wordle-grid");
  check("مسافة: الحرف انكتب بالعمود ٣ بالضبط", letters(st) === "···ب··", letters(st));
  check("مسافة: المؤشر ما وقف على الفراغ", cursorAt(st) === 4, "العمود " + cursorAt(st));

  // نمسح حرف العمود ٣ ونرجع للبداية: الكتابة بالترتيب تتخطى الفراغ لحالها
  await tap(3);
  await page.locator('#keyboard .key:text-is("⌫")').first().click();
  await page.waitForTimeout(150);
  await tap(0);
  for (const ch of Array.from("ونبيس")) await key(ch);
  st = await curRow(page, "#wordle-grid");
  check("مسافة: الكتابة بالترتيب تخطّت الفراغ", letters(st) === "ون·بيس", letters(st));
  await page.locator('#keyboard .key:text-is("إدخال")').first().click();
  await page.waitForTimeout(500);
  check("مسافة: الإرسال اشتغل والكلمة صحيحة", await lastRowAllGreen(page, "#wordle-grid"));

  check("مسافة: ما صار أي خطأ JS", errs.length === 0, errs.join(" | "));
  await page.close();
}

// ===================== الأونلاين =====================
async function onlineMode(browser) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  await ctx.addInitScript(() => { try { localStorage.setItem("kw-tutorial-seen", "1"); } catch (e) {} });
  const errs = [];
  const url = (pid) => BASE + "/wordle-online.html?net=local&pid=" + pid;

  const seed = await ctx.newPage();
  await seed.goto(url("seed"));
  await seed.evaluate(() => localStorage.removeItem("kw-net-local-tree"));
  await seed.close();

  const open = async (pid) => {
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errs.push(pid + ": " + e.message));
    await p.goto(url(pid));
    await p.waitForTimeout(150);
    return p;
  };

  const host = await open("H");
  await host.fill("#online-name-input", "سالم");
  await host.click("#online-create-btn");
  await host.waitForTimeout(300);
  const code = (await host.$eval("#online-room-code", (e) => e.textContent)).trim();

  const mate = await open("M"); // زميل الهوست — هو اللي بيكتب، فيمر إدخاله على الهوست
  await mate.fill("#online-name-input", "ناصر");
  await mate.fill("#online-code-input", code);
  await mate.click("#online-join-btn");
  await mate.waitForTimeout(300);

  const foe = await open("F");
  await foe.fill("#online-name-input", "بدر");
  await foe.fill("#online-code-input", code);
  await foe.click("#online-join-btn");
  await foe.waitForTimeout(300);

  await host.locator('.online-team-pick[data-team="0"]').click();
  await mate.locator('.online-team-pick[data-team="0"]').click();
  await foe.locator('.online-team-pick[data-team="1"]').click();
  await host.waitForTimeout(300);

  await host.click("#online-cat-all");
  const cats = await host.$$eval("#online-category-list label", (e) => e.map((x) => x.textContent.trim()));
  const ins = await host.$$("#online-category-list input");
  await ins[cats.findIndex((x) => x === CAT)].click();
  const info = await host.evaluate((c) => {
    const pool = WORDS.filter((x) => x.category === c);
    return { poolLen: pool.length, idx: pool.findIndex((x) => x.word === "سلحفاة") };
  }, CAT);
  await host.evaluate(({ idx, poolLen }) => { Math.random = () => (idx + 0.001) / poolLen; }, info);
  await host.click("#online-start-btn");
  await host.waitForTimeout(700);

  const liveGuess = (page) =>
    page.evaluate(() => {
      const tree = JSON.parse(localStorage.getItem("kw-net-local-tree") || "{}");
      const room = Object.values(tree.rooms || {})[0] || {};
      return (room.live || {}).currentGuess || null;
    });
  const key = async (page, ch) => {
    await page.locator('#online-keyboard .key:text-is("' + ch + '")').first().click();
    await page.waitForTimeout(140);
  };
  const tap = (page, col) => tapTile(page, "#online-grid", col);

  // ===== المؤشر يلحق كتابة الزميل بدل ما يكتب فوقها =====
  // مؤشر الزميل للحين على ٠ وما لمس شي؛ لو ما لحق حروف الهوست راح يكتب فوقها
  for (const ch of ["س", "ل", "ح"]) await key(host, ch);
  await mate.waitForTimeout(500);
  await key(mate, "ف");
  await host.waitForTimeout(400);
  const followed = await curRow(host, "#online-grid");
  check("أونلاين: الزميل كتب ورا الهوست مو فوقه", letters(followed) === "سلحف··", letters(followed));

  // ===== صف جديد ⇒ المؤشر يرجع لأول خانة =====
  // نكمل الصف بحرف غلط ونرسله. بدون تصفير المؤشر يظل عند آخر خانة بالصف السابق
  // وكل الحروف الجديدة تتكدّس فيها
  for (const ch of ["ا", "ب"]) await key(mate, ch);
  await mate.locator('#online-keyboard .key:text-is("إدخال")').first().click();
  await mate.waitForTimeout(600);
  // الهوست كان يتفرّج على الصف وهو ينملي — لازم مؤشره يرجع ٠ مو يعلق بآخر الصف
  await key(host, "س");
  await mate.waitForTimeout(400);
  const fresh = await curRow(host, "#online-grid");
  check("أونلاين: الحرف بعد الإرسال بدأ من أول خانة", letters(fresh) === "س·····", letters(fresh));
  await key(mate, "ل");
  await host.waitForTimeout(400);
  const fresh2 = await curRow(mate, "#online-grid");
  check("أونلاين: والزميل كمّل بالخانة اللي بعدها", letters(fresh2) === "سل····", letters(fresh2));

  // نفضّي الصف بالمسح عشان نبدأ فحص الضغط من صفر
  for (let i = 0; i < 5; i++) {
    await mate.locator('#online-keyboard .key:text-is("⌫")').first().click();
    await mate.waitForTimeout(140);
  }
  await host.waitForTimeout(300);
  const emptied = await liveGuess(mate);
  check("أونلاين: الصف انفضى بالمسح", JSON.stringify(emptied) === JSON.stringify(["", "", "", "", "", ""]), JSON.stringify(emptied));

  // ===== الفحص الحاسم: حرف بخانة ٣ يظل بخانة ٣ بعد رحلة الهوست =====
  await tap(mate, 3);
  await key(mate, "ف");
  await host.waitForTimeout(400);

  const wire = await liveGuess(mate);
  check("أونلاين: الحالة المنشورة حافظت على الموضع", JSON.stringify(wire) === JSON.stringify(["", "", "", "ف", "", ""]), JSON.stringify(wire));

  const mateRow = await curRow(mate, "#online-grid");
  check("أونلاين: شبكة الكاتب تعرض الحرف بخانة ٣", letters(mateRow) === "···ف··", letters(mateRow));
  const hostRow = await curRow(host, "#online-grid");
  check("أونلاين: الهوست يشوفه بخانة ٣ مو ٠", letters(hostRow) === "···ف··", letters(hostRow));
  const foeRow = await curRow(foe, "#online-grid");
  check("أونلاين: الخصم المتفرّج يشوفه بخانة ٣ بعد", letters(foeRow) === "···ف··", letters(foeRow));
  check("أونلاين: المؤشر ما يبين للخصم", cursorAt(foeRow) === -1, "العمود " + cursorAt(foeRow));

  // الإرسال مرفوض والصف ناقص
  const gradedBefore = await gradedCount(host, "#online-grid");
  await mate.locator('#online-keyboard .key:text-is("إدخال")').first().click();
  await mate.waitForTimeout(400);
  const gradedAfter = await gradedCount(host, "#online-grid");
  check("أونلاين: الإرسال مرفوض والصف ناقص", gradedAfter === gradedBefore, "قبل=" + gradedBefore + " بعد=" + gradedAfter);

  // المسح عند المؤشر ⇒ الخانة ٣ تنمسح والصف يرجع فاضياً عند الجميع
  await mate.locator('#online-keyboard .key:text-is("⌫")').first().click();
  await mate.waitForTimeout(400);
  const cleared = await liveGuess(mate);
  check("أونلاين: المسح فرّغ خانة ٣", JSON.stringify(cleared) === JSON.stringify(["", "", "", "", "", ""]), JSON.stringify(cleared));

  // ===== نكمل الكلمة ونرسل =====
  await tap(mate, 0);
  for (const ch of Array.from(WORD)) await key(mate, ch);
  await host.waitForTimeout(500);
  const shared = await curRow(host, "#online-grid");
  check("أونلاين: الصف اكتمل عند الجميع", letters(shared) === WORD, letters(shared));

  await mate.locator('#online-keyboard .key:text-is("إدخال")').first().click();
  await mate.waitForTimeout(600);
  check("أونلاين: الإرسال اشتغل والكلمة صحيحة", await lastRowAllGreen(host, "#online-grid"));

  // ===== صف جديد ⇒ المؤشر يرجع للبداية (لا يعلق بآخر الصف السابق) =====
  await host.click("#online-next-team-btn");
  await host.waitForTimeout(700);
  const foeFresh = await curRow(foe, "#online-grid");
  check("أونلاين: المؤشر رجع لأول خانة بالجولة الجديدة", cursorAt(foeFresh) === 0, "العمود " + cursorAt(foeFresh));

  check("أونلاين: ما صار أي خطأ JS", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

(async () => {
  const browser = await launch();
  await localMode(browser);
  await spacedWord(browser);
  await onlineMode(browser);
  await browser.close();
  check.done();
})().catch((e) => {
  console.log("‼️ سقط الاختبار:", e.message);
  process.exit(1);
});
