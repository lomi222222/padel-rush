// يبني نسخة احتياطية بملف واحد: كل الـCSS والـJS والصوت والشعار مدموجين جوّه
// صفحة HTML وحدة، تشتغل بالدبل-كلك بلا سيرفر ولا نت.
//
// الاستخدام:  node tools/build-standalone.js  [اسم-الناتج]
//
// ليش تشتغل من file:// أصلاً: ما فيه ولا سكربت بـtype="module" (الوحدات تُمنع
// على file:// لأسباب CORS)، والـfetch الوحيد بالمشروع هو صوت الفوز — وfetch على
// data: URI ينجح، فالصوت يظل شغال بعد الدمج.
//
// يحتاج نت وقت البناء بس: خط Cairo ينزّل من غوغل وينحط جوّه. الناتج بعدها ما
// يطلب ولا بايت من برّا.
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "kuwait-quiz");
const OUT = path.resolve(process.argv[2] || path.join(__dirname, "..", "صيدها.html"));

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const dataUri = (rel, mime) =>
  "data:" + mime + ";base64," + fs.readFileSync(path.join(ROOT, rel)).toString("base64");

// النص المدموج ينتهي بوسم إغلاق، فأي "</script" جوّه يقفل الوسم بدري. ما فيه ولا
// وحدة بالمشروع حالياً، بس الحارس رخيص والانكسار صامت
const guard = (s) => s.replace(/<\/(script|style)/gi, "<\\/$1");

// غوغل يرجّع صيغاً مختلفة حسب المتصفح — نطلب بهوية كروم عشان يعطينا woff2 (الأصغر)
const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// خط Cairo ينزّل من غوغل بـ@import بأول style.css. بدونه النسخة «الاحتياطية»
// تحتاج نت عشان تطلع بشكلها الصحيح — وهذا يلغي فكرتها. فنحلّ الـ@import ونحوّل
// كل ملف خط لـdata URI.
//
// ملاحظة: Cairo خط متغيّر، فغوغل يرجّع **نفس الملف** للأوزان الأربعة — ١٢ رابط
// و٣ ملفات فريدة بس. التخزين حسب الرابط يخلي المجموع ~٨١ كيلو بدل ٣١٧
async function inlineFonts(css) {
  const importRe = /@import url\("(https:\/\/fonts\.googleapis\.com\/[^"]+)"\);?\n?/;
  const m = css.match(importRe);
  if (!m) return { css, note: null };

  let fontCss;
  try {
    const res = await fetch(m[1], { headers: { "User-Agent": CHROME_UA } });
    if (!res.ok) throw new Error("HTTP " + res.status);
    fontCss = await res.text();
  } catch (e) {
    // ما نطيح البناء: الملف يظل شغالاً، بس بخط النظام لو ما فيه نت
    return { css, note: "⚠️  ما قدرت أنزّل خط Cairo (" + e.message + ") — الملف بيحتاج نت للخط" };
  }

  // كل كتلة @font-face ↔ رابطها ونطاق محارفها. الأوزان الأربعة تتشارك نفس
  // الرابط، فلو دمجنا كل كتلة على حدة انكرر الخط ٤ مرات (٧٨٧ كيلو بدل ٤٦٥).
  // بدالها نطلع **كتلة وحدة لكل ملف** بمدى أوزان — وهذي الصيغة الصحيحة أصلاً
  // لخط متغيّر
  const byUrl = new Map();
  for (const block of fontCss.match(/@font-face\s*\{[^}]*\}/g) || []) {
    const url = (block.match(/https:\/\/fonts\.gstatic\.com\/[^)]+/) || [])[0];
    const range = (block.match(/unicode-range:\s*([^;}]+)/) || [])[1];
    if (url && !byUrl.has(url)) byUrl.set(url, range && range.trim());
  }
  if (!byUrl.size) return { css, note: "⚠️  ما انلقت ملفات خط بردّ غوغل" };

  const urls = [...byUrl.keys()];
  const bytes = await Promise.all(
    urls.map(async (u) => Buffer.from(await (await fetch(u)).arrayBuffer()))
  );

  let total = 0;
  const faces = urls.map((u, i) => {
    total += bytes[i].length;
    const range = byUrl.get(u);
    return (
      "@font-face {\n" +
      '  font-family: "Cairo";\n' +
      "  font-style: normal;\n" +
      "  font-weight: 400 800;\n" + // خط متغيّر: ملف واحد يغطي المدى كله
      "  font-display: swap;\n" +
      '  src: url("data:font/woff2;base64,' +
      bytes[i].toString("base64") +
      "\") format('woff2');\n" +
      (range ? "  unicode-range: " + range + ";\n" : "") +
      "}"
    );
  });

  return {
    css: css.replace(importRe, faces.join("\n") + "\n"),
    note: "خط Cairo مدموج: " + urls.length + " ملف · " + Math.round(total / 1024) + " كيلو",
  };
}

async function build() {
let html = read("wordle.html");
const inlined = [];

// ===== الصوت: مسار ملف ← data URI داخل sound.js =====
const winAudio = dataUri("audio/win.mp3", "audio/mpeg");

// ===== الستايل (مع الخط مدموجاً جوّه) =====
const { css, note: fontNote } = await inlineFonts(read("style.css"));
html = html.replace(/[ \t]*<link rel="stylesheet" href="style\.css"[^>]*>\n?/, () => {
  inlined.push("style.css");
  return "    <style>\n" + guard(css) + "\n    </style>\n";
});

// ===== الشعار (الأيقونة بالتبويب) =====
html = html.replace(/href="logo\.svg"/g, () => {
  inlined.push("logo.svg");
  return 'href="' + dataUri("logo.svg", "image/svg+xml") + '"';
});

// ===== ما لهم معنى بملف واحد: الـmanifest وأيقونة آبل والـservice worker =====
html = html
  .replace(/[ \t]*<link rel="manifest"[^>]*>\n?/g, "")
  .replace(/[ \t]*<link rel="apple-touch-icon"[^>]*>\n?/g, "")
  .replace(/[ \t]*<script src="js\/pwa\.js"[^>]*><\/script>\n?/g, "");

// ===== السكربتات، كل واحد مكان وسمه بالضبط فالترتيب محفوظ =====
html = html.replace(/[ \t]*<script src="(js\/[^"]+)"[^>]*><\/script>\n?/g, (m, src) => {
  let code = read(src);
  if (src === "js/sound.js") {
    const before = code;
    code = code.replace(/const SRC = "audio\/win\.mp3";/, 'const SRC = "' + winAudio + '";');
    if (code === before) throw new Error("ما انلقى مسار الصوت بـjs/sound.js — تغيّر الكود؟");
    inlined.push("audio/win.mp3");
  }
  inlined.push(src);
  return "    <script>\n" + guard(code) + "\n    <\/script>\n";
});

// ===== الروابط لصفحات ثانية: ما فيه صفحات ثانية بملف واحد =====
// كل قصّة تتأكد إنها صادت شي — لو تغيّر الـHTML نبي البناء يطيح بصوت عالي بدل
// ما يطلع ملف فيه أزرار ميتة
function cut(re, label) {
  if (!re.test(html)) throw new Error("ما انلقى «" + label + "» — تغيّر wordle.html؟");
  html = html.replace(re, "");
}

// «العب أونلاين مع ربعك» مع فاصل «أو» فوقه — الأونلاين يحتاج صفحة ثانية وفايربيس
cut(
  /[ \t]*<div class="online-divider">[\s\S]*?<a class="btn btn-outline btn-block" href="wordle-online\.html">[\s\S]*?<\/a>\n?/,
  "زر الأونلاين"
);
// «القائمة الرئيسية» بشاشة النهاية
cut(
  /[ \t]*<a class="btn btn-outline btn-block" href="index\.html">[\s\S]*?<\/a>\n?/,
  "زر القائمة الرئيسية"
);
// شعار «صيدها» بالشريط العلوي يبقى ظاهر بس ما يودّي مكان
html = html.replace(/(<a class="home-link") href="index\.html"/, "$1");

// ===== ما يصير يبقى أي طلب لملف خارجي =====
// ملفات مجاورة (مسارات نسبية)
const missing = [...html.matchAll(/(?:src|href)="(?!data:|#|https?:)([^"]+)"/g)].map((m) => m[1]);
if (missing.length) throw new Error("بقت مراجع لملفات مجاورة: " + [...new Set(missing)].join("، "));

// وطلبات شبكة جوّه الـCSS: @import أو url(http…). روابط og:/twitter: بالميتا
// مستثناة — هذي بيانات مشاركة، المتصفح ما يجيبها
const netRefs = [
  ...html.matchAll(/@import[^;]*https?:/g),
  ...html.matchAll(/url\(\s*['"]?https?:[^)]*\)/g),
].map((m) => m[0].slice(0, 60));
if (netRefs.length) throw new Error("بقت طلبات شبكة بالـCSS: " + [...new Set(netRefs)].join("، "));

fs.writeFileSync(OUT, html);
const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
console.log("✅ " + OUT);
console.log("   " + kb + " كيلو · دُمج " + inlined.length + " ملف: " + inlined.join("، "));
if (fontNote) console.log("   " + fontNote);
}

build().catch((e) => {
  console.error("‼️  " + e.message);
  process.exit(1);
});
