// التثبيت (PWA) + العمل بلا نت + وسوم المشاركة.
const { launch, BASE } = require("./_browser");
const fs = require("fs");
const path = require("path");
const DIR = path.join(__dirname, "..");
// العدد المتوقّع يُقرأ من البنك نفسه مو مكتوباً برقم: الرقم الثابت ينكسر مع أي
// تنقيح للكلمات، والمقصود «انخزن البنك كامل بلا نت» لا «البنك فيه ١٢٤٧»
const { WORDS } = require("../js/words.js");
let fail = 0;
const check = (n, ok, x) => { console.log((ok ? "✅ " : "‼️ ") + n + (x ? "  " + x : "")); if (!ok) fail++; };

function pngSize(p) {
  const b = fs.readFileSync(p);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

(async () => {
  // ===== ١. مقاسات الصور فعلياً =====
  for (const [f, w, h] of [
    ["icons/icon-192.png", 192, 192],
    ["icons/icon-512.png", 512, 512],
    ["icons/icon-512-maskable.png", 512, 512],
    ["icons/apple-touch-icon-180.png", 180, 180],
    ["og-image.png", 1200, 630],
  ]) {
    const s = pngSize(`${DIR}/${f}`);
    check(`${f} مقاسها ${w}×${h}`, s.w === w && s.h === h, `${s.w}×${s.h}`);
  }

  // ===== ٢. الـmanifest =====
  const man = JSON.parse(fs.readFileSync(`${DIR}/manifest.json`, "utf8"));
  check("manifest: JSON صالح وفيه الحقول المطلوبة",
    man.name && man.start_url && man.display === "standalone" && man.icons.length >= 3);
  check("manifest: فيه أيقونة maskable للأندرويد",
    man.icons.some((i) => i.purpose === "maskable"));

  const browser = await launch();

  // ===== ٣. الوسوم بالصفحات الثلاث =====
  for (const [page_, mustHave] of [
    ["index.html", "صيدها — لعبة كلمات كويتية"],
    ["wordle.html", "صيد الكلمة — صيدها"],
    ["wordle-online.html", "تعال العب وياي — صيدها"],
  ]) {
    const ctx = await browser.newContext();
     await ctx.addInitScript(() => { try { localStorage.setItem("kw-tutorial-seen", "1"); } catch (e) {} });  // التجربة التوجيهية تطلع أول زيارة — نتخطاها بالاختبارات
    const p = await ctx.newPage();
     await p.addInitScript(() => { try { localStorage.setItem("kw-tutorial-seen", "1"); } catch (e) {} });  // التجربة التوجيهية تطلع أول زيارة — نتخطاها بالاختبارات
    await p.route("**://*.googleapis.com/**", (r) => r.abort());
    await p.goto(`${BASE}/${page_}`);
    const tags = await p.evaluate(() => {
      const g = (sel, attr) => { const el = document.querySelector(sel); return el ? el.getAttribute(attr) : null; };
      return {
        desc: g('meta[name="description"]', "content"),
        ogTitle: g('meta[property="og:title"]', "content"),
        ogImage: g('meta[property="og:image"]', "content"),
        ogUrl: g('meta[property="og:url"]', "content"),
        twitter: g('meta[name="twitter:card"]', "content"),
        manifest: g('link[rel="manifest"]', "href"),
        appleIcon: g('link[rel="apple-touch-icon"]', "href"),
        appleCapable: g('meta[name="apple-mobile-web-app-capable"]', "content"),
      };
    });
    check(`${page_}: وصف موجود`, !!tags.desc && tags.desc.length > 30);
    check(`${page_}: عنوان المشاركة صحيح`, tags.ogTitle === mustHave, tags.ogTitle);
    check(`${page_}: رابط الصورة مطلق`, /^https:\/\//.test(tags.ogImage || ""), tags.ogImage);
    check(`${page_}: og:url مطلق`, /^https:\/\//.test(tags.ogUrl || ""), tags.ogUrl);
    check(`${page_}: بطاقة تويتر كبيرة`, tags.twitter === "summary_large_image");
    check(`${page_}: manifest + أيقونة آبل + وضع التطبيق`,
      !!tags.manifest && !!tags.appleIcon && tags.appleCapable === "yes");
    await ctx.close();
  }

  // ===== ٤. تسجيل الـservice worker والعمل بلا نت =====
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
     await ctx.addInitScript(() => { try { localStorage.setItem("kw-tutorial-seen", "1"); } catch (e) {} });  // التجربة التوجيهية تطلع أول زيارة — نتخطاها بالاختبارات
    const p = await ctx.newPage();
     await p.addInitScript(() => { try { localStorage.setItem("kw-tutorial-seen", "1"); } catch (e) {} });  // التجربة التوجيهية تطلع أول زيارة — نتخطاها بالاختبارات
    await p.route("**://*.googleapis.com/**", (r) => r.abort());
    const errs = [];
    p.on("pageerror", (e) => errs.push(String(e)));

    await p.goto(`${BASE}/wordle.html`);
    const reg = await p.evaluate(() =>
      navigator.serviceWorker.ready.then((r) => !!r.active).catch(() => false)
    );
    check("الـservice worker انسجّل وصار فعّال", reg);

    // ننطر التخزين يخلص، ثم نقطع النت ونعيد التحميل
    await p.waitForTimeout(2500);
    await ctx.setOffline(true);
    await p.reload();
    await p.waitForTimeout(600);

    const offline = await p.evaluate(() => ({
      title: document.title,
      hasStart: !!document.getElementById("wordle-start-btn"),
      words: typeof WORDS !== "undefined" ? WORDS.length : 0,
      cats: document.querySelectorAll("label.category-chip").length,
    }));
    check("بلا نت: الصفحة تفتح", offline.title.includes("صيد الكلمة"), offline.title);
    check("بلا نت: بنك الكلمات كامل", offline.words === WORDS.length,
      "كلمات=" + offline.words + " (البنك " + WORDS.length + ")");
    check("بلا نت: الفئات تنرسم", offline.cats > 15, "فئات=" + offline.cats);

    // نلعب جولة كاملة وإحنا بلا نت
    for (const inp of await p.$$("#wordle-team1-input, #wordle-team2-input")) await inp.fill("فريق");
    await p.click("#wordle-start-btn");
    await p.waitForTimeout(500);
    const playing = await p.evaluate(() => ({
      keys: document.querySelectorAll(".keyboard .key").length,
      grid: document.querySelectorAll("#wordle-grid .wordle-row").length,
    }));
    check("بلا نت: اللعبة تبدأ فعلاً (كيبورد + شبكة)", playing.keys > 20 && playing.grid > 0,
      `مفاتيح=${playing.keys} صفوف=${playing.grid}`);

    check("بلا نت: ما صار خطأ JS", errs.length === 0, errs.join(" | "));
    await ctx.setOffline(false);
    await ctx.close();
  }

  await browser.close();
  console.log(fail ? "\n" + fail + " فحص فشل" : "\nكل الفحوص نجحت");
  process.exit(fail ? 1 : 0);
})();
