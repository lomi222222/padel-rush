const { launch, BASE } = require("./_browser");
const url = (pid) => BASE + "/wordle-online.html?net=local&pid=" + pid;
let fail = 0;
const check = (n, ok, x) => { console.log((ok ? "✅ " : "‼️ ") + n + (x ? "  " + x : "")); if (!ok) fail++; };

// الصف الحالي = أول صف ما فيه أي خانة مقيَّمة (الصفوف المُرسلة تجي قبله)
const row = (page) =>
  page.evaluate(() => {
    const rows = [...document.querySelectorAll("#online-grid .wordle-row")];
    const cur = rows.find((r) => ![...r.children].some((e) => /\b(green|yellow|gray)\b/.test(e.className))) || rows[0];
    return [...cur.children].map((e) => ({ cls: e.className, txt: e.textContent }));
  });

async function key(page, ch) {
  await page.locator('#online-keyboard .key:text-is("' + ch + '")').first().click();
  await page.waitForTimeout(90);
}

(async () => {
  const b = await launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 900 } });
   await ctx.addInitScript(() => { try { localStorage.setItem("kw-tutorial-seen", "1"); } catch (e) {} });  // التجربة التوجيهية تطلع أول زيارة — نتخطاها بالاختبارات
  const errs = [];

  const seed = await ctx.newPage();
   await seed.addInitScript(() => { try { localStorage.setItem("kw-tutorial-seen", "1"); } catch (e) {} });  // التجربة التوجيهية تطلع أول زيارة — نتخطاها بالاختبارات
  await seed.goto(url("seed"));
  await seed.evaluate(() => localStorage.removeItem("kw-net-local-tree"));
  await seed.close();

  const host = await ctx.newPage();
   await host.addInitScript(() => { try { localStorage.setItem("kw-tutorial-seen", "1"); } catch (e) {} });  // التجربة التوجيهية تطلع أول زيارة — نتخطاها بالاختبارات
  const foe = await ctx.newPage();
   await foe.addInitScript(() => { try { localStorage.setItem("kw-tutorial-seen", "1"); } catch (e) {} });  // التجربة التوجيهية تطلع أول زيارة — نتخطاها بالاختبارات
  for (const p of [host, foe]) p.on("pageerror", (e) => errs.push(String(e)));

  await host.goto(url("H"));
  await host.fill("#online-name-input", "سالم");
  await host.click("#online-create-btn");
  await host.waitForTimeout(300);
  const code = (await host.$eval("#online-room-code", (e) => e.textContent)).trim();

  await foe.goto(url("F"));
  await foe.fill("#online-name-input", "بدر");
  await foe.fill("#online-code-input", code);
  await foe.click("#online-join-btn");
  await foe.waitForTimeout(300);

  await host.locator('.online-team-pick[data-team="0"]').click();
  await foe.locator('.online-team-pick[data-team="1"]').click();
  await host.waitForTimeout(300);

  // نثبّت الكلمة: "سلحفاة" من فئة حيوان
  await host.click("#online-cat-all");
  const labels = await host.$$eval("#online-category-list label", (e) => e.map((x) => x.textContent.trim()));
  const ins = await host.$$("#online-category-list input");
  await ins[labels.findIndex((x) => x.includes("حيوان"))].click();
  await host.evaluate(() => {
    const pool = WORDS.filter((x) => x.category === "حيوان");
    const idx = pool.findIndex((x) => x.word === "سلحفاة");
    Math.random = () => (idx + 0.001) / pool.length;
  });
  await host.click("#online-start-btn");
  await host.waitForTimeout(700);

  // نكتب حروفاً خاطئة ونرسل عشان تتكوّن حروف صفراء يبني عليها التلميح
  for (const ch of ["ب", "ت", "ث", "ج", "خ", "د"]) await key(host, ch);
  await host.locator('#online-keyboard .key:text-is("إدخال")').click();
  await host.waitForTimeout(500);

  let ghostCol = -1, ghostLetter = "";
  for (let i = 0; i < 10 && ghostCol < 0; i++) {
    await host.click("#online-hint-letter-btn");
    await host.waitForTimeout(400);
    const st = await row(host);
    const idx = st.findIndex((t) => t.cls.includes("ghost"));
    if (idx >= 0) { ghostCol = idx; ghostLetter = st[idx].txt; }
  }
  check("الطيف ظهر على جهاز الهوست", ghostCol >= 0, ghostCol >= 0 ? `العمود ${ghostCol} "${ghostLetter}"` : "");
  if (ghostCol < 0) { await b.close(); process.exit(1); }

  // الطيف لازم يوصل جهاز اللاعب الثاني هم (المعلومة تُنشر مع الحالة)
  await foe.waitForTimeout(400);
  const foeRow = await row(foe);
  check("الطيف وصل جهاز اللاعب الثاني", foeRow[ghostCol].cls.includes("ghost") && foeRow[ghostCol].txt === ghostLetter,
    `"${foeRow[ghostCol].txt}" (${foeRow[ghostCol].cls})`);

  // السرّية: الكلمة ما تنكشف قبل نهاية الجولة
  const leak = await foe.evaluate(() => {
    try {
      const tree = JSON.parse(localStorage.getItem("kw-net-local-tree"));
      const room = Object.values(tree.rooms)[0];
      return { revealed: room.state.round.revealedWord, hasTarget: JSON.stringify(room.state).includes("سلحفاة") };
    } catch (e) { return { err: String(e) }; }
  });
  check("الكلمة لسه محجوبة بالحالة المنشورة", leak.revealed === null && leak.hasTarget === false, JSON.stringify(leak));

  // نكتب حرفاً مختلفاً بخانة الطيف ونتأكد إنه هو اللي انحسب
  const other = ghostLetter === "ب" ? "ت" : "ب";
  const st0 = await row(host);
  const gaps = st0.slice(0, ghostCol).filter((t) => t.cls.includes("wordle-tile-gap")).length;
  for (let i = 0; i < ghostCol + 1 - gaps; i++) await key(host, other);
  const st1 = await row(host);
  check("حرف اللاعب غطّى الطيف", st1[ghostCol].txt === other && st1[ghostCol].cls.includes("filled"),
    `"${st1[ghostCol].txt}"`);

  // مسح ثم إعادة — الطيف يرجع
  await host.locator('#online-keyboard .key:text-is("⌫")').click();
  await host.waitForTimeout(350);
  const st2 = await row(host);
  check("المسح يرجّع الطيف بالأونلاين", st2[ghostCol].cls.includes("ghost"), `(${st2[ghostCol].cls})`);

  check("ما صار أي خطأ JS", errs.length === 0, errs.join(" | "));
  await b.close();
  process.exit(fail ? 1 : 0);
})();
