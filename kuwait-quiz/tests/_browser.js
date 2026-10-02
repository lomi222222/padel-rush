// وحدة مشتركة: تلقى Playwright والمتصفح، وتوحّد عنوان السيرفر.
//
// ليش: الاختبارات كانت تكتب "/opt/node22/lib/node_modules/playwright" بالنص —
// مسار خاص بجهاز واحد يكسر على أي جهاز ثاني. المسارات كلها هني بمكان واحد.
"use strict";

const fs = require("fs");

const BASE = process.env.KW_BASE || "http://127.0.0.1:8951";

// بترتيب الأفضلية: مثبّت عادي، ثم مسارات معروفة بهالبيئة
const PLAYWRIGHT_PATHS = [
  "playwright",
  "/opt/node22/lib/node_modules/playwright",
  "/usr/lib/node_modules/playwright",
];

// متصفح مثبّت مسبقاً بهالبيئة. لو ما انلقى نخلي Playwright يدوّر بنفسه
const CHROMIUM_PATHS = ["/opt/pw-browsers/chromium"];

function requirePlaywright() {
  const tried = [];
  for (const p of PLAYWRIGHT_PATHS) {
    try {
      return require(p);
    } catch (e) {
      tried.push(p);
    }
  }
  throw new Error(
    "ما انلقى playwright. جرّبت:\n  " + tried.join("\n  ") + "\nثبّته بـ: npm i -g playwright"
  );
}

function chromiumPath() {
  if (process.env.KW_CHROMIUM) return process.env.KW_CHROMIUM;
  return CHROMIUM_PATHS.find((p) => fs.existsSync(p)) || undefined;
}

// launch(opts) — نفس توقيع chromium.launch بس بالمسارات محلولة
async function launch(opts) {
  const { chromium } = requirePlaywright();
  const exe = chromiumPath();
  return chromium.launch(Object.assign(exe ? { executablePath: exe } : {}, opts));
}

// عدّاد فحوص موحّد: check("الوصف", شرط, "تفاصيل اختيارية")
function makeChecker() {
  const state = { fail: 0 };
  const check = (name, ok, extra) => {
    console.log((ok ? "✅ " : "‼️ ") + name + (extra ? "  " + extra : ""));
    if (!ok) state.fail++;
  };
  check.done = (okMsg) => {
    console.log(state.fail === 0 ? "\n✅ " + (okMsg || "كل الفحوص نجحت") : "\n‼️ فشل " + state.fail);
    process.exit(state.fail ? 1 : 0);
  };
  check.state = state;
  return check;
}

// ===== أدوات مشتركة للاختبارات الطويلة =====

// يختار فئة وحدة بس. رقصة "الكل": نتأكد إنه مؤشَّر ثم نلغيه فتنفك كل الفئات،
// وبعدها نأشّر اللي نبي. كانت مكرّرة نصاً بستة اختبارات.
// prefix = "wordle" أو "online"
// يفتح صفحة اللعب المحلي **بدون مباراة محفوظة**. المباراة تنحفظ وترجع لما تنفتح
// الصفحة من جديد (طلب صاحب المشروع)، فاختبار يبدأ لعبة ثانية بنفس المتصفح كان
// يلقى الأولى بدل شاشة الإعداد
//
// المسح من صفحة ثانية بنفس الموقع: صفحة اللعب نفسها **تحفظ وهي طالعة** (pagehide)،
// فلو مسحنا منها وحدّثناها ترجع تكتب المباراة على طول
async function openFreshLocal(page, url) {
  await page.goto(new URL("manifest.json", url).href);
  await page.evaluate(() => localStorage.removeItem("kw-local-match"));
  await page.goto(url);
}

// يلغي كل الفئات مهما كانت البداية. الشاشة تبدأ فاضية الحين، فضغطة «الكل» وحدة
// صارت **تختار** الكل بدل ما تلغيه — وكانت مكررة بعشر اختبارات على الافتراض
// القديم. رقصة «الكل»: نتأكد إنه مؤشَّر ثم نلغيه فتنفك كل الفئات (حتى الحصرية)
async function clearCategories(page, prefix) {
  const all = "#" + prefix + "-cat-all";
  if (!(await page.$eval(all, (el) => el.checked))) await page.click(all);
  await page.click(all);
  await page.waitForTimeout(80);
}

// يختار كل الفئات العادية — اللي كان الافتراضي قبل. اختبارات كثيرة تبدأ لعبة وما
// يهمها الفئة، فكانت تضغط «ابدأ» على طول؛ الحين الشاشة تبدأ فاضية وبدون فئة
// البداية تنرفض
async function selectAllCategories(page, prefix) {
  const all = "#" + prefix + "-cat-all";
  if (!(await page.$eval(all, (el) => el.checked))) await page.click(all);
  await page.waitForTimeout(60);
}

async function pickOnlyCategory(page, prefix, name) {
  const list = "#" + prefix + "-category-list";
  await clearCategories(page, prefix);
  const labels = await page.$$eval(list + " label", (els) => els.map((x) => x.textContent.trim()));
  const inputs = await page.$$(list + " input");
  const i = labels.findIndex((t) => t === name);
  if (i < 0) throw new Error('ما انلقت فئة "' + name + '" بـ' + list);
  await inputs[i].click();
  await page.waitForTimeout(80);
}

// يحرق جولة كاملة: يكتب حروفاً غلط لين تخلص المحاولات.
//
// ليش نبعث KeyboardEvent بدل ضغط مفاتيح الشاشة: المتحكّمان يسمعان keydown على
// document (wordle.js:629 و wordle-online.js:1228) بنفس منطق المفاتيح، فنقدر
// نكتب صفاً كاملاً **برحلة وحدة** للمتصفح بدل ضغطة locator لكل حرف (كل ضغطة
// فيها فحوص قابلية تفاعل). بمباراة ٢٠ جولة الفرق دقايق.
//
// ملاحظة: page.keyboard.type ما ينفع هني — Playwright ما يوصّل الحروف العربية
// كـ`key` بالـkeydown، فالحرف ما يمر على ARABIC_LETTER_RE ولا ينكتب شي.
//
// كيبورد الشاشة نفسه مغطّى بعمق بـtest_cursor و test_online و test_new_keyboard،
// فهالدالة أداة لحرق الجولات مو الشي المُختبَر.
//
// الخسارة ما تنهي الجولة فوراً: الخصم ياخذ «فرصة أخيرة» (محاولة وحدة). بالمحلي
// نفس الجهاز يكتبها فتنحرق عادي. بالأونلاين الفرصة على جهاز الخصم، فمرّر
// الأجهزة كلها (مصفوفة) والدالة تكتب على اللي عليه الدور — وإلا تنتظر ١٥ ثانية
// لين يخلص وقت الفرصة بكل جولة
async function loseRound(pageOrPages, prefix) {
  const pages = Array.isArray(pageOrPages) ? pageOrPages : [pageOrPages];
  const sel = {
    grid: "#" + prefix + "-grid",
    roundEnd: "#" + prefix + "-round-end",
    end: prefix === "wordle" ? "#wordle-end-screen" : "#online-end",
  };

  // اللي عليه الدور: بالأونلاين الكيبورد مقفول عند غيره. بالمحلي جهاز واحد
  const turnPage = async () => {
    if (pages.length === 1) return pages[0];
    for (const p of pages) {
      const mine = await p.evaluate(() => {
        const k = document.querySelector("#online-keyboard .key");
        return !!k && !k.disabled;
      });
      if (mine) return p;
    }
    return pages[0];
  };
  let page = pages[0];

  const read = () =>
    page.evaluate((s) => {
      const hidden = (q) => document.querySelector(q).classList.contains("hidden");
      const graded = document.querySelectorAll(
        [".green", ".yellow", ".gray"].map((c) => s.grid + " .wordle-tile" + c).join(", ")
      ).length;
      const row = [...document.querySelectorAll(s.grid + " .wordle-row")].find(
        (r) => ![...r.children].some((e) => /\b(green|yellow|gray)\b/.test(e.className))
      );
      return {
        done: !hidden(s.roundEnd) || !hidden(s.end),
        graded,
        cells: row ? [...row.children].filter((e) => !e.className.includes("gap")).length : 0,
      };
    }, sel);

  for (let attempt = 0; attempt < 40; attempt++) {
    page = await turnPage();
    const before = await read();
    if (before.done) return;
    if (!before.cells) {
      await page.waitForTimeout(100);
      continue;
    }

    await page.evaluate((n) => {
      const key = (k) => document.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
      // نمسح قبل ما نكتب: لو بقيت حروف من محاولة ما وصلت للهوست، الكتابة فوقها
      // تخلي الصف ممتلئاً بلا ما ينحسب — والمسح يفكّ هالقفلة
      for (let i = 0; i < n; i++) key("Backspace");
      for (let i = 0; i < n; i++) key("ء");
      key("Enter");
    }, before.cells);

    // **نتحقق إن المحاولة انحسبت فعلاً** بدل ما نفترض. هالدالة تكتب صفاً كاملاً
    // بجزء من الألف من الثانية — أسرع بمراحل من أي لاعب — فالأونلاين يصير فيه
    // سباق بين الإرسال ووصول الحالة. بلا هالتحقق تدور الحلقة أربعين مرة على صف
    // عالق وتنتهي بهدوء كأن شي ما صار
    for (let w = 0; w < 25; w++) {
      await page.waitForTimeout(80);
      const now = await read();
      if (now.done || now.graded > before.graded) break;
    }
  }
}

module.exports = { BASE, launch, makeChecker, requirePlaywright, openFreshLocal, clearCategories, selectAllCategories, pickOnlyCategory, loseRound };

