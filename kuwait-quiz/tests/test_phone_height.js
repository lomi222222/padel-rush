// الجوال بارتفاعه الحقيقي: بوضع التطبيق شريط الساعة والهوم ينقصون من الصفحة،
// فآيفون ٣٩٣×٨٥٢ يطلع ~٧٩٣. كنا نقيس على ٣٩٠×٨٤٤ بس، وصاحب المشروع لقى المربعات
// صغيرة على جواله:
// - الضغط كان يبدأ من ٧٨٠، فجواله (٧٩٣) ياخذ الإطار بحجمه الكامل ⇒ صندوق الشبكة ٢٤٧
// - رسالة «غيّر السؤال» (سطرين) تاكل من الشبكة والخانة تنحسب وهي ظاهرة ⇒ ٢٠٥
// الحين الرسالة فقاعة ما تاخذ مكان، والضغط يشمل الطولي لين ٩٠٠ بدون ما يخفي الدليل.
const { launch, BASE, makeChecker, pickOnlyCategory } = require("./_browser");

const check = makeChecker();

async function measure(page) {
  return page.evaluate(() => {
    const box = document.querySelector(".wordle-grid-scroll");
    const grid = document.querySelector("#wordle-grid").getBoundingClientRect();
    const card = document.querySelector("#wordle-play-screen").getBoundingClientRect();
    const legend = document.querySelector(".wordle-info .wordle-legend");
    const msg = document.querySelector("#wordle-message");
    return {
      box: box.clientHeight,
      tile: Math.round(document.querySelector("#wordle-grid .wordle-tile").getBoundingClientRect().width),
      outside: grid.left < card.left - 0.5 || grid.right > card.right + 0.5,
      legend: !!legend && getComputedStyle(legend).display !== "none",
      msgText: msg.textContent,
      msgToast: msg.classList.contains("toast"),
      msgGone: msg.classList.contains("toast-gone"),
    };
  });
}

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 393, height: 793 } });
  await ctx.addInitScript(() => localStorage.setItem("kw-tutorial-seen", "1"));
  await ctx.route("**://*.googleapis.com/**", (r) => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE + "/wordle.html");
  await pickOnlyCategory(page, "wordle", "حيوان");
  // الوقت مفعّل: سطر المؤقت يزيد على المعلومات، وهذا اللي يلعب فيه صاحب المشروع
  const opts = await page.$$eval("#wordle-round-time option", (os) => os.map((o) => o.value));
  await page.selectOption("#wordle-round-time", opts.find((v) => Number(v) > 0));
  await page.evaluate(() => {
    const pool = WORDS.filter((x) => x.category === "حيوان");
    const i = pool.findIndex((x) => x.word === "سلحفاة");
    Math.random = () => (i + 0.001) / pool.length;
  });
  await page.click("#wordle-start-btn");
  await page.waitForTimeout(400);

  const start = await measure(page);
  check("صندوق الشبكة ياخذ الطول (≥ ٣٢٠، كان ٢٤٧)", start.box >= 320, "" + start.box);
  check("كلمة ٦ أحرف خانتها ≥ ٤٨ (كانت ٣٦)", start.tile >= 48, "" + start.tile);
  check("الدليل ظاهر (اختيار صاحب المشروع)", start.legend);
  check("الشبكة داخل البطاقة", !start.outside);

  // «غيّر السؤال» لكلمة ٥ أحرف: الرسالة تطلع فقاعة والصندوق ما يصغر
  await page.evaluate(() => {
    const pool = WORDS.filter((x) => x.category === "حيوان");
    const i = pool.findIndex((x) => Array.from(x.word).length === 5 && !x.word.includes(" "));
    Math.random = () => (i + 0.001) / pool.length;
  });
  await page.click("#wordle-change-btn");
  await page.waitForTimeout(400);
  const changed = await measure(page);
  check("رسالة التغيير طالعة كفقاعة", changed.msgToast && changed.msgText.includes("غيّر"), changed.msgText);
  check("الصندوق ما صغر بعد التغيير (كان ينقص ٤٢)", changed.box >= start.box, start.box + " ← " + changed.box);
  check("خانة الكلمة الجديدة ما تعدّت السقف (٦٢، مثل ووردل)", changed.tile <= 62 && changed.tile >= 55, "" + changed.tile);
  check("الشبكة داخل البطاقة بعد التغيير", !changed.outside);

  await page.waitForTimeout(3400);
  const later = await measure(page);
  check("الفقاعة تختفي بعد ثواني", later.msgGone);
  check("ونصها يظل بالعنصر (الاختبارات والقارئ)", later.msgText === changed.msgText);

  check("بلا أخطاء JS", errors.length === 0, errors.join(" | "));
  await browser.close();
  check.done();
})().catch((e) => {
  console.log("‼️ سقط الاختبار:", e.message);
  process.exit(1);
});
