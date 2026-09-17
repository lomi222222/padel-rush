const { launch, BASE } = require("./_browser");
const OUT = "/tmp/claude-0/-home-user-padel-rush/55c4bca1-66a2-5e7c-94f5-390441a85d62/scratchpad/";
let fail = 0;
const check = (n, ok, x) => { console.log((ok ? "✅ " : "‼️ ") + n + (x ? "  " + x : "")); if (!ok) fail++; };

// حالة الشبكة كما يشوفها اللاعب: الصف الحالي فقط
const rowState = (page) =>
  page.evaluate(() => {
    const rows = [...document.querySelectorAll("#wordle-grid .wordle-row")];
    const done = document.querySelectorAll("#wordle-grid .wordle-tile.green, #wordle-grid .wordle-tile.yellow, #wordle-grid .wordle-tile.gray").length;
    const cur = rows[0];
    return [...cur.children].map((el) => ({
      cls: el.className,
      txt: el.textContent,
    }));
  });

(async () => {
  const b = await launch();
  const page = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
   await page.addInitScript(() => { try { localStorage.setItem("kw-tutorial-seen", "1"); } catch (e) {} });  // التجربة التوجيهية تطلع أول زيارة — نتخطاها بالاختبارات
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));

  await page.goto(BASE + "/wordle.html");
  await page.click("#wordle-start-btn");
  await page.waitForTimeout(400);

  // نضغط "اكشف حرف" لين يطلع تلميح أخضر (بموضع محدّد)
  let ghostCol = -1, ghostLetter = "";
  for (let i = 0; i < 12 && ghostCol < 0; i++) {
    await page.click("#wordle-hint-letter-btn");
    await page.waitForTimeout(150);
    const st = await rowState(page);
    const idx = st.findIndex((t) => t.cls.includes("ghost"));
    if (idx >= 0) { ghostCol = idx; ghostLetter = st[idx].txt; }
  }
  check("طلع طيف بعد استخدام «اكشف حرف»", ghostCol >= 0, ghostCol >= 0 ? `العمود ${ghostCol} الحرف "${ghostLetter}"` : "ما طلع");
  if (ghostCol < 0) { await b.close(); process.exit(1); }

  await page.screenshot({ path: OUT + "ghost-light.png" });

  // الطيف ما ينحسب كحرف مكتوب: التخمين لسه فاضي
  let st = await rowState(page);
  check("الطيف مو حرف مكتوب (ما فيه filled)", !st.some((t) => t.cls.includes("filled")));

  // نكتب حروف مختلفة عمداً لين نغطي خانة الطيف
  const other = ghostLetter === "ب" ? "ت" : "ب";
  const typed = [];
  for (let i = 0; i <= ghostCol; i++) {
    const st0 = await rowState(page);
    if (st0[i].cls.includes("wordle-tile-gap")) continue; // خانة مسافة
    await page.click(`.keyboard .key:has-text("${other}")`);
    typed.push(i);
    await page.waitForTimeout(80);
  }
  st = await rowState(page);
  check("الكتابة غطّت الطيف بحرف اللاعب", st[ghostCol].txt === other && st[ghostCol].cls.includes("filled"),
    `الخانة فيها "${st[ghostCol].txt}"`);
  check("ما بقي أي طيف بالخانة المغطّاة", !st[ghostCol].cls.includes("ghost"));

  // نمسح — الطيف لازم يرجع
  await page.click('.keyboard .key:has-text("⌫")').catch(async () => {
    await page.keyboard.press("Backspace");
  });
  await page.waitForTimeout(150);
  st = await rowState(page);
  check("المسح يرجّع الطيف", st[ghostCol].cls.includes("ghost") && st[ghostCol].txt === ghostLetter,
    `الخانة الآن "${st[ghostCol].txt}" (${st[ghostCol].cls})`);

  // التقييم لازم يصير على حرف اللاعب مو على الحرف الملمّح
  const wordLength = await page.evaluate(() => document.querySelectorAll("#wordle-grid .wordle-row")[0].children.length);
  while (true) {
    const s = await rowState(page);
    const filled = s.filter((t) => t.cls.includes("filled")).length;
    const gaps = s.filter((t) => t.cls.includes("wordle-tile-gap")).length;
    if (filled + gaps >= wordLength) break;
    await page.click(`.keyboard .key:has-text("${other}")`);
    await page.waitForTimeout(60);
  }
  const beforeSubmit = await rowState(page);
  const submittedGhostCell = beforeSubmit[ghostCol].txt;
  await page.click('.keyboard .key:has-text("إدخال")');
  await page.waitForTimeout(300);
  const firstRow = await page.evaluate(() =>
    [...document.querySelectorAll("#wordle-grid .wordle-row")[0].children].map((e) => ({ c: e.className, t: e.textContent }))
  );
  check("التخمين انقبل وانقيّم", firstRow.some((t) => /green|yellow|gray/.test(t.c)),
    firstRow.map((t) => t.t).join(""));
  check("الخانة الملمّحة انقيّمت على حرف اللاعب", firstRow[ghostCol].t === submittedGhostCell,
    `أُرسل "${submittedGhostCell}" وظهر "${firstRow[ghostCol].t}"`);

  // الوضع الغامق للقطة
  await page.evaluate(() => { localStorage.setItem("kw-theme", "dark"); document.documentElement.setAttribute("data-theme", "dark"); });
  await page.goto(BASE + "/wordle.html");
  await page.click("#wordle-start-btn");
  await page.waitForTimeout(400);
  for (let i = 0; i < 12; i++) {
    await page.click("#wordle-hint-letter-btn");
    await page.waitForTimeout(120);
    const s = await rowState(page);
    if (s.some((t) => t.cls.includes("ghost"))) break;
  }
  await page.screenshot({ path: OUT + "ghost-dark.png" });

  check("ما صار أي خطأ JS", errs.length === 0, errs.join(" | "));
  await b.close();
  process.exit(fail ? 1 : 0);
})();
