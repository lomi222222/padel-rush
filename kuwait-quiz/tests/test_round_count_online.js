// الهوست يختار عدد الجولات، واللاعب يشوف نفس العدد بالعنوان المنشور.
const { launch, BASE } = require("./_browser");
const url = (pid) => BASE + "/wordle-online.html?net=local&pid=" + pid;
let fail = 0;
const check = (n, ok, x) => { console.log((ok ? "✅ " : "‼️ ") + n + (x ? "  " + x : "")); if (!ok) fail++; };

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

  // قائمة عدد الجولات لازم تكون عند الهوست بس
  const foeHasSelect = await foe.evaluate(() => {
    const el = document.querySelector("#online-round-count");
    return !!el && !el.closest("#online-host-controls").classList.contains("hidden");
  });
  check("قائمة عدد الجولات مخفية عن غير الهوست", !foeHasSelect);

  await host.selectOption("#online-round-count", "7");
  await host.click("#online-start-btn");
  await host.waitForTimeout(800);

  const hostSub = await host.$eval("#online-subtitle", (e) => e.textContent);
  const foeSub = await foe.$eval("#online-subtitle", (e) => e.textContent);
  check("عنوان الهوست يقول «من ٧»", hostSub.includes("من ٧"), hostSub.slice(0, 42));
  check("عنوان اللاعب يقول «من ٧» هم", foeSub.includes("من ٧"), foeSub.slice(0, 42));

  // البوق عند ٧ جولات = ٣
  const boqText = await foe.$eval("#online-boq-btn", (e) => e.textContent);
  check("البوق يبدأ بـ٣ عند ٧ جولات", boqText.includes("٣"), boqText.trim());

  check("ما صار أي خطأ JS", errs.length === 0, errs.join(" | "));
  await b.close();
  console.log(fail ? "\n" + fail + " فحص فشل" : "\nكل الفحوص نجحت");
  process.exit(fail ? 1 : 0);
})();
