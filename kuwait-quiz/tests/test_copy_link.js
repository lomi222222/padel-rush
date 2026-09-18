// زر "نسخ الرابط" لازم ينسخ رابط الغرفة فعلاً، ويبيّن للاعب إنه اننسخ.
const { launch, BASE } = require("./_browser");
let fail = 0;
const check = (n, ok, x) => { console.log((ok ? "✅ " : "‼️ ") + n + (x ? "  " + x : "")); if (!ok) fail++; };

(async () => {
  const b = await launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 900 } });
   await ctx.addInitScript(() => { try { localStorage.setItem("kw-tutorial-seen", "1"); } catch (e) {} });  // التجربة التوجيهية تطلع أول زيارة — نتخطاها بالاختبارات
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"]);
  const page = await ctx.newPage();
   await page.addInitScript(() => { try { localStorage.setItem("kw-tutorial-seen", "1"); } catch (e) {} });  // التجربة التوجيهية تطلع أول زيارة — نتخطاها بالاختبارات
  await page.route("**://*.googleapis.com/**", (r) => r.abort());
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));

  await page.goto(BASE + "/wordle-online.html?net=local&pid=C1");
  await page.evaluate(() => localStorage.removeItem("kw-net-local-tree"));
  await page.goto(BASE + "/wordle-online.html?net=local&pid=C1");
  await page.fill("#online-name-input", "سالم");
  await page.click("#online-create-btn");
  await page.waitForTimeout(400);

  const code = (await page.$eval("#online-room-code", (e) => e.textContent)).trim();
  check("انفتحت غرفة", !!code, "رمز=" + code);

  // نفضّي الحافظة أول عشان نتأكد إن اللي ينقرأ بعدين جاي من الزر
  await page.evaluate(() => navigator.clipboard.writeText("__فاضي__"));

  await page.click("#online-copy-btn");
  await page.waitForTimeout(400);

  const clip = await page.evaluate(() => navigator.clipboard.readText());
  check("الحافظة فيها رابط الغرفة", clip.includes("room=" + code), clip);
  check("الرابط كامل وصحيح", /^https?:\/\/.+wordle-online\.html\?.*room=/.test(clip), clip);

  const label = (await page.$eval("#online-copy-btn", (e) => e.textContent)).trim();
  check("الزر يبيّن إنه اننسخ", label.includes("اننسخ"), label);

  // بعد ثانيتين يرجع لنصه الأصلي
  await page.waitForTimeout(2200);
  const back = (await page.$eval("#online-copy-btn", (e) => e.textContent)).trim();
  check("الزر يرجع لنصه الأصلي", back.includes("نسخ الرابط"), back);
  const iconBack = await page.$eval("#online-copy-btn", (e) => !!e.querySelector("svg"));
  check("أيقونة الزر رجعت", iconBack);

  check("ما صار خطأ JS", errs.length === 0, errs.join(" | "));
  await b.close();
  console.log(fail ? "\n" + fail + " فحص فشل" : "\nكل الفحوص نجحت");
  process.exit(fail ? 1 : 0);
})();
