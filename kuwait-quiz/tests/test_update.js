// هل يوصل التحديث للاعب بفتحة وحدة؟
//
// الاختبار **ينشر تحديثاً فعلياً** وسط التشغيل: ينسخ اللعبة لمجلد مؤقت، يرفع
// عليه سيرفراً، ثم يعدّل ملفات النسخة المؤقتة ويشوف هل الصفحة التقطت الجديد.
//
// ليش CSS هو الدليل: الـSW يخدم الصفحات شبكة-أولاً، فلو غيّرنا HTML بس راح
// يتحدّث على أي حال والفحص يمر بلا ما يثبت شي. ملفات CSS و JS هي اللي بمسار
// "المخزن أولاً" — وهي اللي كانت تعلق على النسخة القديمة.
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const { launch, makeChecker } = require("./_browser");

const check = makeChecker();
const SRC = path.join(__dirname, "..");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".mp3": "audio/mpeg",
};

// ننسخ اللعبة كاملة (بلا tests) عشان نقدر نعدّل عليها بأمان
function copySite() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kw-update-"));
  for (const entry of fs.readdirSync(SRC)) {
    if (entry === "tests") continue;
    fs.cpSync(path.join(SRC, entry), path.join(dir, entry), { recursive: true });
  }
  return dir;
}

// سيرفر خاص بهالاختبار على منفذ يختاره النظام (0). كان يرفع python على منفذ
// محسوب من رقم العملية، وهذا انكسر: المدى كان يشمل ٨٩٥١ منفذ طقم الاختبارات —
// فلو تصادم، python يفشل بالربط بهدوء، والفحص بـcurl ينجح لأن **سيرفر الطقم**
// هو اللي يرد. فيشتغل الاختبار على جذر غلط (المستودع الحقيقي مو النسخة المؤقتة)
// وما يشوف التحديث المنشور أبداً. منفذ ٠ يقفل الباب: النظام يعطينا منفذاً حراً
// ونمسك المقبس بأنفسنا، فما فيه سباق ولا فحص يخمّن
function serve(dir) {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "") || "index.html";
    const file = path.join(dir, rel);
    if (!file.startsWith(dir)) {
      res.writeHead(403).end();
      return;
    }
    fs.readFile(file, (err, body) => {
      if (err) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, {
        "Content-Type": TYPES[path.extname(file)] || "application/octet-stream",
        // بلا تخزين المتصفح: اللي نختبره هو مخزن الـservice worker وحده
        "Cache-Control": "no-store",
      });
      res.end(body);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve({ server, base: "http://127.0.0.1:" + server.address().port });
    });
  });
}

// "ينشر" نسخة جديدة: يغيّر لوناً بـCSS ويرفع رقم نسخة الـSW — نفس اللي نسويه فعلاً
function publish(dir, color, version) {
  const css = path.join(dir, "style.css");
  const before = fs.readFileSync(css, "utf8");
  const after = before.replace(/--green: #[0-9a-fA-F]{6};/, "--green: " + color + ";");
  if (after === before) throw new Error("ما انلقى --green بـstyle.css");
  fs.writeFileSync(css, after);

  const swPath = path.join(dir, "sw.js");
  const sw = fs.readFileSync(swPath, "utf8");
  const swAfter = sw.replace(/const VERSION = "[^"]+";/, 'const VERSION = "' + version + '";');
  if (swAfter === sw) throw new Error("ما انلقى VERSION بـsw.js");
  fs.writeFileSync(swPath, swAfter);
}

const readGreen = (page) =>
  page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--green").trim());

const cacheNames = (page) => page.evaluate(() => caches.keys());

// ننتظر الـSW يخلص تخزين الشِل قبل ما نعتبر الزيارة "مكتملة"
async function settle(page) {
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => {}));
  await sleep(1500);
}

(async () => {
  const dir = copySite();
  const { server, base: BASE } = await serve(dir);
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem("kw-tutorial-seen", "1");
    } catch (e) {}
  });
  const errs = [];

  try {
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errs.push(String(e)));
    await page.goto(BASE + "/wordle.html");
    await settle(page);

    const first = await readGreen(page);
    check("الزيارة الأولى: الـSW اشتغل وخزّن", (await cacheNames(page)).includes("saydha-v17"),
      JSON.stringify(await cacheNames(page)));
    check("الزيارة الأولى: ولا إعادة تحميل (ما فيه نسخة سابقة)", first === "#1fa363", first);

    // ===== الادعاء الأساسي: تحديث ينزل ⇒ فتحة وحدة تكفي =====
    publish(dir, "#ff0000", "v900");
    await page.reload();
    let landed = true;
    try {
      await page.waitForFunction(
        () => getComputedStyle(document.documentElement).getPropertyValue("--green").trim() === "#ff0000",
        { timeout: 15000 }
      );
    } catch (e) {
      landed = false;
    }
    check("التحديث وصل بفتحة وحدة بلا إعادة تحميل يدوية", landed, await readGreen(page));

    const keys = await cacheNames(page);
    check("المخزن القديم انمسح وما بقي غير الجديد", keys.length === 1 && keys[0] === "saydha-v900",
      JSON.stringify(keys));

    // ===== حارس الجولة: ما نقطع لاعباً وهو يلعب =====
    await page.click("#wordle-start-btn");
    await page.waitForTimeout(400);
    check("دخلنا جولة", await page.$eval("#wordle-play-screen", (el) => !el.classList.contains("hidden")));

    // علامة تعيش بالذاكرة بس — لو الصفحة أُعيد تحميلها تنمسح
    await page.evaluate(() => { window.__aliveSince = Date.now(); });
    publish(dir, "#00ff00", "v901");
    await page.evaluate(() =>
      navigator.serviceWorker.getRegistration().then((r) => r && r.update()).catch(() => {})
    );
    await page.waitForTimeout(4000);

    check("وسط الجولة: الصفحة ما أُعيد تحميلها", await page.evaluate(() => !!window.__aliveSince));
    check("وسط الجولة: الجولة قاعدة مكانها",
      await page.$eval("#wordle-play-screen", (el) => !el.classList.contains("hidden")));
    check("وسط الجولة: النسخة الجديدة منتظرة مو مستلمة", await readGreen(page) === "#ff0000",
      await readGreen(page));

    // ===== وبالفتحة الجاية تنطبق =====
    await page.goto(BASE + "/wordle.html");
    let applied = true;
    try {
      await page.waitForFunction(
        () => getComputedStyle(document.documentElement).getPropertyValue("--green").trim() === "#00ff00",
        { timeout: 15000 }
      );
    } catch (e) {
      applied = false;
    }
    check("المؤجَّلة انطبقت بالفتحة الجاية", applied, await readGreen(page));

    // تحديثان شرعيان بجلسة وحدة ⇒ إعادتا تحميل بالضبط. أكثر من كذا يعني حلقة
    const reloads = await page.evaluate(() => Number(sessionStorage.getItem("kw-sw-reloads") || 0));
    check("ما فيه حلقة إعادة تحميل", reloads === 2, "عدد الإعادات=" + reloads);

    check("ما صار أي خطأ JS", errs.length === 0, errs.join(" | "));
  } finally {
    await browser.close();
    server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }

  check.done();
})().catch((e) => {
  console.log("‼️ سقط الاختبار:", e.message);
  process.exit(1);
});
