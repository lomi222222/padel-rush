// واجهة وحدة تتمدد (طلب صاحب المشروع: «لو كبير يتكبّر ويصير على حجمه»): شكلان
// بس — طولي وعرضي — وكل الأحجام مضروبة بمعامل --s من js/wordle-view.js.
//
// الادعاءات بالأرقام:
// - الجوال معامله ١ بالضبط، فما تغيّر فيه بكسل (كل قيود التخطيط مقاسة عليه)
// - الآيباد والتلفزيون معاملهم أكبر، والخانة والمفتاح والخط يكبرون فعلاً
// - ولا شي يطلع برّا الشاشة، وزر البدء ظاهر بالإعداد العرضي (عمودين). بالطولي
//   الإعداد يمرّر وزر البدء تحت من أول — حتى على الجوال — فما نفحصه هناك
const { launch, BASE, makeChecker, pickOnlyCategory } = require("./_browser");

const check = makeChecker();

async function measure(browser, w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  await ctx.addInitScript(() => localStorage.setItem("kw-tutorial-seen", "1"));
  await ctx.route("**://*.googleapis.com/**", (r) => r.abort());
  await ctx.route("**://*.gstatic.com/**", (r) => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE + "/wordle.html");
  await page.waitForTimeout(150);

  const setup = await page.evaluate(() => {
    const start = document.querySelector("#wordle-start-btn").getBoundingClientRect();
    return {
      s: Number(getComputedStyle(document.documentElement).getPropertyValue("--s")),
      catFont: parseFloat(getComputedStyle(document.querySelector("#wordle-category-list .cat-name")).fontSize),
      startVisible: start.bottom <= innerHeight && start.top >= 0 && start.height > 0,
    };
  });

  // كلمة ٦ حروف ثابتة عشان المقارنة بين الأجهزة عادلة
  await pickOnlyCategory(page, "wordle", "حيوان");
  await page.evaluate(() => {
    const pool = WORDS.filter((x) => x.category === "حيوان");
    const i = pool.findIndex((x) => x.word === "سلحفاة");
    Math.random = () => (i + 0.001) / pool.length;
  });
  await page.click("#wordle-start-btn");
  await page.waitForTimeout(400);

  const play = await page.evaluate(() => {
    const box = (s) => document.querySelector(s).getBoundingClientRect();
    const fs = (s) => parseFloat(getComputedStyle(document.querySelector(s)).fontSize);
    // أي عنصر ظاهر بشاشة اللعب يطلع برّا حدود الشاشة؟
    const out = [...document.querySelectorAll("#wordle-play-screen *")].filter((e) => {
      const r = e.getBoundingClientRect();
      if (!r.width || !r.height) return false;
      return r.right > innerWidth + 1 || r.left < -1 || r.bottom > innerHeight + 1;
    }).length;
    return {
      tile: Math.round(box("#wordle-grid .wordle-tile").width),
      keyFont: fs(".key"),
      subFont: fs("#wordle-subtitle"),
      out,
    };
  });
  await ctx.close();
  return Object.assign({ errors }, setup, play);
}

(async () => {
  const browser = await launch();
  const phone = await measure(browser, 390, 844);
  const phoneLand = await measure(browser, 844, 390);
  const ipad = await measure(browser, 820, 1180);
  const ipadLand = await measure(browser, 1180, 820);
  const tv = await measure(browser, 1920, 1080);

  check("الجوال طولي: المعامل ١", phone.s === 1, "s=" + phone.s);
  check("الجوال عرضي: المعامل ١", phoneLand.s === 1, "s=" + phoneLand.s);
  check("الآيباد: المعامل أكبر من ١", ipad.s > 1 && ipadLand.s > 1, ipad.s + " / " + ipadLand.s);
  check("التلفزيون أكبر من الآيباد", tv.s > ipadLand.s, tv.s + " / " + ipadLand.s);

  // ٧٢ سقف الجوال: الشاشات الكبيرة لازم تعدّيه، وإلا رجعنا لشكوى «المربعات صغيرة»
  check("الآيباد طولي: الخانة أكبر من الجوال", ipad.tile > phone.tile, phone.tile + " ← " + ipad.tile);
  check("الآيباد عرضي: الخانة أكبر من الجوال العرضي", ipadLand.tile > phoneLand.tile, phoneLand.tile + " ← " + ipadLand.tile);
  check("التلفزيون: الخانة فوق سقف الجوال", tv.tile > 72, "" + tv.tile);

  // النصوص تكبر بنفس المعامل — مو بس الخانات
  check("خط الكيبورد يكبر على التلفزيون", tv.keyFont > phoneLand.keyFont * 1.4, phoneLand.keyFont + " ← " + tv.keyFont);
  check("خط سطر الجولة يكبر على الآيباد", ipad.subFont > phone.subFont, phone.subFont + " ← " + ipad.subFont);
  check("خط الفئات يكبر على التلفزيون", tv.catFont > phone.catFont * 1.4, phone.catFont + " ← " + tv.catFont);

  for (const [name, m] of [["الجوال", phone], ["الجوال عرضي", phoneLand], ["الآيباد", ipad], ["الآيباد عرضي", ipadLand], ["التلفزيون", tv]]) {
    check(name + ": ولا عنصر برّا الشاشة", m.out === 0, "عدد=" + m.out);
    check(name + ": بلا أخطاء JS", m.errors.length === 0, m.errors.join(" | "));
  }
  for (const [name, m] of [["الجوال عرضي", phoneLand], ["الآيباد عرضي", ipadLand], ["التلفزيون", tv]]) {
    check(name + ": زر البدء ظاهر بالإعداد بلا تمرير", m.startVisible);
  }

  await browser.close();
  check.done();
})().catch((e) => {
  console.log("‼️ سقط الاختبار:", e.message);
  process.exit(1);
});
