// نافذة "طريقة اللعب": الزر موجود بالتوبار، يفتح وياسكر صح، وما يكسر شي.
const { launch, BASE } = require("./_browser");
let fail = 0;
const check = (n, ok, x) => { console.log((ok ? "✅ " : "‼️ ") + n + (x ? "  " + x : "")); if (!ok) fail++; };

async function testPage(url, label) {
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
   await page.addInitScript(() => { try { localStorage.setItem("kw-tutorial-seen", "1"); } catch (e) {} });  // التجربة التوجيهية تطلع أول زيارة — نتخطاها بالاختبارات
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  await page.goto(url);
  await page.waitForTimeout(200);

  const btnVisible = await page.locator("#wordle-howto-btn").isVisible();
  check(`${label}: زر طريقة اللعب ظاهر بالتوبار`, btnVisible);

  // الزر لازم يكون جوا .topbar-actions مع زر الثيم (theme.js نقله)
  const insideActions = await page.evaluate(() => {
    const b = document.getElementById("wordle-howto-btn");
    return !!(b && b.closest(".topbar-actions"));
  });
  check(`${label}: الزر انضم لمجموعة أزرار التوبار`, insideActions);

  await page.click("#wordle-howto-btn");
  await page.waitForTimeout(150);
  const opened = await page.locator(".howto-overlay").isVisible();
  check(`${label}: النافذة تفتح`, opened);

  const sections = await page.locator(".howto-body h3").count();
  check(`${label}: فيها كل الأقسام (٦)`, sections === 6, "عدد=" + sections);

  const tiles = await page.locator(".howto-tiles .wordle-tile").count();
  check(`${label}: أمثلة الألوان الثلاثة موجودة`, tiles === 3, "عدد=" + tiles);

  // الأيقونات لازم تكون امتلأت (مو فاضية) لو WordleView محمّل
  const iconsFilled = await page.evaluate(() =>
    [...document.querySelectorAll(".howto-ico")].every((el) => el.querySelector("svg"))
  );
  check(`${label}: أيقونات المساعدات معبّاة`, iconsFilled);

  // إغلاق بالضغط على الخلفية
  await page.mouse.click(5, 5);
  await page.waitForTimeout(150);
  const closedByBackdrop = !(await page.locator(".howto-overlay").isVisible());
  check(`${label}: تنسكر بالضغط على الخلفية`, closedByBackdrop);

  // فتح وإغلاق بـEscape
  await page.click("#wordle-howto-btn");
  await page.waitForTimeout(100);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
  const closedByEsc = !(await page.locator(".howto-overlay").isVisible());
  check(`${label}: تنسكر بـEscape`, closedByEsc);

  // فتح وإغلاق بزر ×
  await page.click("#wordle-howto-btn");
  await page.waitForTimeout(100);
  await page.click(".howto-close");
  await page.waitForTimeout(150);
  const closedByX = !(await page.locator(".howto-overlay").isVisible());
  check(`${label}: تنسكر بزر ×`, closedByX);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check(`${label}: بلا تجاوز أفقي`, !overflow);

  check(`${label}: ما صار خطأ JS`, errs.length === 0, errs.join(" | "));
  await browser.close();
}

(async () => {
  await testPage(BASE + "/wordle.html", "محلي");
  await testPage(BASE + "/wordle-online.html", "أونلاين");
  console.log(fail ? "\n" + fail + " فحص فشل" : "\nكل الفحوص نجحت");
  process.exit(fail ? 1 : 0);
})();
