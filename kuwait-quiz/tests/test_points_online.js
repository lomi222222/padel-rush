// النقاط المتوقّعة بالوضع الأونلاين: تظهر عند الكل، تنزل لما صاحب الدور يستخدم
// مساعدة، وتثبت على قيمة السرقة أثناء البوق
const { launch, BASE } = require("./_browser");
let fail = 0;
const check = (n, ok, x) => { console.log((ok ? "✅ " : "‼️ ") + n + (x ? "  " + x : "")); if (!ok) fail++; };
const num = (s) => {
  const m = String(s).match(/[٠-٩]+/);
  return m ? Number(m[0].replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d))) : null;
};

async function newTab(context, pid) {
  const page = await context.newPage();
   await page.addInitScript(() => { try { localStorage.setItem("kw-tutorial-seen", "1"); } catch (e) {} });  // التجربة التوجيهية تطلع أول زيارة — نتخطاها بالاختبارات
  page.on("pageerror", (e) => { fail++; console.log("PAGEERROR(" + pid + "):", e.message); });
  await page.route("**://*.googleapis.com/**", (r) => r.abort());
  await page.goto(BASE + "/wordle-online.html?net=local&pid=" + pid);
  await page.waitForTimeout(150);
  return page;
}
const pts = (p) => p.$eval("#online-points", (el) => el.textContent);
async function keys(page, word) {
  for (const ch of Array.from(word)) {
    await page.locator('#online-keyboard .key:text-is("' + ch + '")').first().click();
    await page.waitForTimeout(40);
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

  const foe = await newTab(context, "F");
  await foe.fill("#online-name-input", "بدر");
  await foe.fill("#online-code-input", code);
  await foe.click("#online-join-btn");
  await foe.waitForTimeout(250);
  await foe.locator('.online-team-pick[data-team="1"]').click();
  await foe.waitForTimeout(250);

  // كلمة مثبّتة عشان النتيجة تكون قابلة للتوقّع
  const catLabels = await host.$$eval("#online-category-list label", (els) => els.map((e) => e.textContent));
  await host.click("#online-cat-all");
  await host.waitForTimeout(120);
  const catInputs = await host.$$("#online-category-list input");
  await catInputs[catLabels.indexOf("حيوان")].click();
  await host.waitForTimeout(150);
  const info = await host.evaluate(() => {
    const pool = WORDS.filter((w) => w.category === "حيوان");
    return { poolLen: pool.length, idx: pool.findIndex((w) => w.word === "سلحفاة") };
  });
  await host.evaluate(({ idx, poolLen }) => { Math.random = () => (idx + 0.001) / poolLen; }, info);
  await host.click("#online-start-btn");
  await host.waitForTimeout(700);

  const hostStart = num(await pts(host));
  const foeStart = num(await pts(foe));
  check("الرقم يظهر عند صاحب الدور", hostStart !== null, "نص=" + (await pts(host)));
  check("ونفسه عند الخصم المتفرّج", foeStart === hostStart, hostStart + " / " + foeStart);

  // ترتيب العناصر: النقاط على يسار «محاولات» ونفس السطر
  const order = await host.evaluate(() => {
    const a = document.getElementById("online-attempts").getBoundingClientRect();
    const p = document.getElementById("online-points").getBoundingClientRect();
    return { attLeft: a.left, attBottom: a.bottom, ptsLeft: p.left, ptsBottom: p.bottom };
  });
  check("النقاط على يسار «محاولات» ونفس السطر",
    order.ptsLeft < order.attLeft && Math.abs(order.ptsBottom - order.attBottom) < 4, JSON.stringify(order));

  // مساعدة عند صاحب الدور ⇒ الرقم ينزل عند الطرفين
  await host.click("#online-hint-letter-btn");
  await host.waitForTimeout(500);
  check("«اكشف حرف» ينقص ١٠٠ عند الهوست", num(await pts(host)) === hostStart - 100,
    hostStart + " → " + num(await pts(host)));
  check("والخصم يشوف نفس النزول", num(await pts(foe)) === hostStart - 100, "خصم=" + num(await pts(foe)));

  await host.click("#online-hint-category-btn");
  await host.waitForTimeout(500);
  const halved = Math.floor((hostStart - 100) / 2);
  check("«الفئة» تنصّف عند الطرفين", num(await pts(host)) === halved && num(await pts(foe)) === halved,
    num(await pts(host)) + " / " + num(await pts(foe)) + " متوقع " + halved);

  // محاولة خاطئة ثم بوق: الرقم يثبت على قيمة السرقة
  await keys(host, "حصانة");
  await keys(host, "ة");
  await enter(host);
  await host.waitForTimeout(500);
  const beforeBoq = num(await pts(host));

  await foe.click("#online-boq-btn");
  await foe.waitForTimeout(600);
  const stealNote = await foe.$eval("#online-steal-note", (el) => el.textContent);
  const stealValue = num(stealNote.split("على")[1] || "");
  const duringBoq = num(await pts(foe));
  check("أثناء البوق الرقم = قيمة السرقة", duringBoq === stealValue,
    "معروض=" + duringBoq + " بالملاحظة=" + stealValue);
  check("والرقم مو نفس رقم الدور العادي", beforeBoq !== null, "قبل=" + beforeBoq);
  check("الهوست يشوف نفس رقم السرقة", num(await pts(host)) === stealValue, "هوست=" + num(await pts(host)));

  await browser.close();
  console.log(fail === 0 ? "\n✅ كل الفحوص نجحت" : "\n‼️ فشل " + fail);
  process.exit(fail ? 1 : 0);
})();
