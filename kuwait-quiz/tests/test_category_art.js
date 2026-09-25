// رسومات بطاقات الفئات (js/category-art.js).
//
// اللي يحرسه:
// - **كل فئة بالبنك لها رسمة**: القائمة من WordleCore.ALL_CATEGORIES وقت التشغيل،
//   فأي فئة جديدة بلا رسمة تطيح هني بدل ما تطلع بطاقة فاضية بصمت
// - **نص البطاقة = اسم الفئة حرفياً**: اختبارات كثيرة تلقى الفئة بمقارنة النص،
//   فأي <text> أو <title> داخل الرسمة يكسرها
// - **الرسمة مرسومة فعلاً بالبكسل** بالفاتح والداكن: التدرّجات والظلال بـsvg
//   تعريفات منفصل، ولو انكسر (مخفي بـdisplay:none، أو id غلط) الرسمة تطلع فاضية
//   وما يطيح أي خطأ. فنصوّر كل رسمة ونعد البكسلات الملوّنة
// - غير المختارة رمادية، والمختارة ملوّنة — إلا الحصرية (القرآن) تظل ذهبية
// - الملف ضمن مخزن sw.js — وإلا الصفحة بلا نت تطلع بلا رسومات
const { launch, BASE, makeChecker } = require("./_browser");

const check = makeChecker();

// يعد البكسلات اللي تختلف عن لون الشريط (الخلفية) — يعني البكسلات المرسومة —
// وكم بكسل منها ذهبي. التحليل داخل المتصفح نفسه عبر canvas، بلا مكتبات PNG
async function analyse(page, png) {
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = "data:image/png;base64," + b64;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext("2d");
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    // لون الخلفية من نص الحافة اليسرى. **مو من الزاوية**: زاوية البطاقة مدوّرة،
    // فبكسل الزاوية يطلع من خلفية الصفحة مو من الشريط
    const o = (Math.floor(c.height / 2) * c.width + 2) * 4;
    const [br, bg, bb] = [d[o], d[o + 1], d[o + 2]];
    let drawn = 0;
    let gold = 0;
    for (let i = 0; i < d.length; i += 4) {
      const diff = Math.abs(d[i] - br) + Math.abs(d[i + 1] - bg) + Math.abs(d[i + 2] - bb);
      if (diff > 60) {
        drawn++;
        // ذهبي = أحمر أعلى من الأزرق بوضوح. **مو التشبّع**: البطاقة غير المختارة
        // شفافة جزئياً، فكحلي الصفحة يبين من تحتها ويرفع التشبّع وهي رمادية فعلاً
        if (d[i] - d[i + 2] > 50) gold++;
      }
    }
    return { ratio: drawn / (c.width * c.height), gold };
  }, png.toString("base64"));
}

(async () => {
  const browser = await launch();
  const errors = [];

  for (const theme of ["light", "dark"]) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**://*.googleapis.com/**", (r) => r.abort());
    await page.addInitScript((t) => {
      try {
        localStorage.setItem("kw-tutorial-seen", "1");
        localStorage.setItem("kw-theme", t);
      } catch (e) {}
    }, theme);
    await page.goto(BASE + "/wordle.html");
    await page.waitForSelector("#wordle-category-list .category-chip");
    // الحركة (transition) على الفلتر تخلي لقطة البطاقة المختارة تطلع نص رمادية
    await page.addStyleTag({ content: "*{transition:none!important}" });

    const cats = await page.evaluate(() => [...WordleCore.ALL_CATEGORIES]);
    const tag = theme === "light" ? "الفاتح" : "الداكن";

    if (theme === "light") {
      const s = await page.evaluate(() => {
        const labels = [...document.querySelectorAll("#wordle-category-list label.category-chip")];
        return labels.map((l) => ({
          text: l.textContent,
          shapes: l.querySelectorAll(".cat-art svg.ca-svg path, .cat-art svg.ca-svg circle, .cat-art svg.ca-svg rect, .cat-art svg.ca-svg ellipse").length,
          textNodes: l.querySelectorAll(".cat-art text, .cat-art title").length,
        }));
      });
      check("بطاقة لكل فئة بالبنك", s.length === cats.length, s.length + " من " + cats.length);
      const noArt = cats.filter((c, i) => !s[i] || s[i].shapes === 0);
      check("كل فئة لها رسمة", noArt.length === 0, noArt.join("، "));
      const badText = cats.filter((c, i) => !s[i] || s[i].text !== c || s[i].textNodes > 0);
      check("نص كل بطاقة = اسم الفئة حرفياً (بلا نص داخل الرسمة)", badText.length === 0, badText.join("، "));

      // كل url(#…) بالرسومات لازم يدل على عنصر موجود، والتعريفات مو مخفية
      const refs = await page.evaluate(() => {
        const html = document.querySelector("#wordle-category-list").innerHTML;
        const ids = [...new Set([...html.matchAll(/url\(#([\w-]+)\)/g)].map((m) => m[1]))];
        const defs = document.getElementById("ca-defs");
        return {
          missing: ids.filter((id) => !document.getElementById(id)),
          count: ids.length,
          defsCount: document.querySelectorAll("#ca-defs").length,
          defsDisplay: defs ? getComputedStyle(defs).display : "—",
        };
      });
      check("كل المراجع (تدرّجات وقصّات) موجودة", refs.missing.length === 0 && refs.count > 0,
        refs.missing.join("، ") || refs.count + " مرجع");
      check("التعريفات مضافة مرة وحدة ومو مخفية", refs.defsCount === 1 && refs.defsDisplay !== "none",
        refs.defsCount + " · " + refs.defsDisplay);
    }

    // اختيار الكل عشان كل البطاقات تتصوّر ملوّنة
    await page.evaluate(() => {
      const all = document.getElementById("wordle-cat-all");
      if (all && !all.checked) all.click();
    });
    await page.waitForTimeout(50);

    const arts = await page.$$("#wordle-category-list label.category-chip .cat-art");
    const blank = [];
    let minRatio = 1;
    for (let i = 0; i < arts.length; i++) {
      const selected = await arts[i].evaluate((a) => a.parentElement.querySelector("input").checked);
      if (!selected) continue;
      await arts[i].scrollIntoViewIfNeeded();
      const r = await analyse(page, await arts[i].screenshot());
      minRatio = Math.min(minRatio, r.ratio);
      // ‎٤٪ من الشريط = رسمة شبه فاضية. الأصغر فعلياً فوق ‎١٠٪
      if (r.ratio < 0.04) blank.push(cats[i] + " (" + (r.ratio * 100).toFixed(1) + "٪)");
    }
    check("كل الرسومات مرسومة بالبكسل — " + tag, blank.length === 0,
      blank.join("، ") || "أقل تغطية " + (minRatio * 100).toFixed(1) + "٪");

    // الحصرية (القرآن) لازم تبان «فئة من نوع ثاني» من برا وهي غير مختارة. انكسرت
    // مرتين وبلّغ عنها صاحب المشروع: الرمادي مسح ذهبها (صفر بكسل)، ثم كانت بطاقة
    // ذهبية باهتة ما تبين (~٢٥٠). الشريط العريض ~٢٩٠٠ — والحد ١٠٠٠ يمسك الحالتين
    const excl = page.locator("#wordle-category-list label.category-chip.exclusive").first();
    await excl.scrollIntoViewIfNeeded();
    const exclOff = await excl.evaluate((l) => !l.querySelector("input").checked);
    const exclGold = await analyse(page, await excl.screenshot());
    check("الفئة الحصرية ذهبية وهي غير مختارة — " + tag, exclOff && exclGold.gold > 1000,
      "بكسلات ذهبية " + exclGold.gold);

    // المختار ملوّن، وغير المختار رمادي — نفس الرسمة
    // القائمة تنرسم من جديد مع كل ضغطة، فنستخدم locator يرجع يدوّر على العنصر
    const firstCat = cats[0];
    const firstArt = page.locator("#wordle-category-list label.category-chip .cat-art").first();
    const colored = await analyse(page, await firstArt.screenshot());
    await (await page.$("#wordle-category-list label.category-chip input")).click();
    await page.waitForTimeout(50);
    const off = await page.$eval("#wordle-category-list label.category-chip input", (i) => !i.checked);
    const gray = await analyse(page, await firstArt.screenshot());
    check("غير المختارة رمادية والمختارة ملوّنة — " + tag,
      off && colored.gold > 30 && gray.gold === 0,
      firstCat + " بكسلات ذهبية: مختارة " + colored.gold + " · غير مختارة " + gray.gold);

    await page.close();
  }

  // صفحة الأونلاين تحمّل نفس الملف
  const online = await browser.newPage();
  await online.route("**://*.googleapis.com/**", (r) => r.abort());
  await online.route("**://*.gstatic.com/**", (r) => r.abort());
  await online.goto(BASE + "/wordle-online.html?net=local&pid=art");
  const hasArt = await online.evaluate(() => !!(window.CategoryArt && CategoryArt.svg("دولة")));
  check("الأونلاين يحمّل الرسومات", hasArt);
  await online.close();

  // بالمخزن — وإلا بلا نت تطلع البطاقات فاضية
  const sw = await (await fetch(BASE + "/sw.js")).text();
  check("category-art.js ضمن مخزن sw.js", sw.includes('"js/category-art.js"'));

  check("بلا أخطاء JS", errors.length === 0, errors.join(" | "));
  await browser.close();
  check.done();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
