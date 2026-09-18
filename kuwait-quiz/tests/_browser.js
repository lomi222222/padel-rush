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

module.exports = { BASE, launch, makeChecker, requirePlaywright };
