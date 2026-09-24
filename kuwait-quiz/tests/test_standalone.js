// النسخة الاحتياطية بملف واحد: تنبني، وتُفتح من file:// (مو من سيرفر)، ويُلعب
// فيها دور كامل. الهدف إنها تشتغل لو ما فيه نت ولا سيرفر ولا حتى GitHub.
const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { launch, makeChecker } = require("./_browser");

const check = makeChecker();
const REPO = path.join(__dirname, "..", "..");
const OUT = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "kw-standalone-")), "صيدها.html");

(async () => {
  // ===== البناء =====
  let buildLog = "";
  try {
    buildLog = execFileSync(process.execPath, [path.join(REPO, "tools", "build-standalone.js"), OUT], {
      encoding: "utf8",
    });
  } catch (e) {
    check("البناء نجح", false, (e.stdout || "") + (e.stderr || ""));
    check.done();
  }
  check("البناء نجح", fs.existsSync(OUT), Math.round(fs.statSync(OUT).size / 1024) + " كيلو");

  // لو ما فيه نت وقت البناء، الخط ما ينزّل — وقتها ما نقدر نطالب بصفر طلبات
  const fontsInlined = !/⚠️/.test(buildLog);
  if (!fontsInlined) console.log("        ⚠️  انبنى بلا نت: الخط مو مدموج، نتساهل بفحص الطلبات");

  // ===== التشغيل من file:// =====
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  const external = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  page.on("request", (r) => {
    const u = r.url();
    if (!u.startsWith("file:") && !u.startsWith("data:")) external.push(u);
  });
  await page.addInitScript(() => {
    try {
      localStorage.setItem("kw-tutorial-seen", "1");
    } catch (e) {}
  });

  await page.goto("file://" + OUT.split(path.sep).map(encodeURIComponent).join("/"));
  await page.waitForTimeout(500);

  check("الصفحة فتحت من file://", (await page.$("#wordle-setup-screen")) !== null);
  check(
    "ولا وسم <link> يودّي لملف خارجي",
    await page.$$eval("link", (e) => e.every((l) => (l.getAttribute("href") || "").startsWith("data:")))
  );
  check("كل السكربتات مدموجة", await page.$$eval("script", (e) => e.every((s) => !s.src)));
  const rules = await page.evaluate(() => {
    try {
      return document.styleSheets[0].cssRules.length;
    } catch (e) {
      return -1;
    }
  });
  check("الستايل مدموج وانقرأ", rules > 100, rules + " قاعدة");

  // ===== دور كامل =====
  for (const i of await page.$$("#wordle-team1-input, #wordle-team2-input")) await i.fill("الأزرق");
  await page.click("#wordle-start-btn");
  await page.waitForTimeout(500);

  const tiles = await page.$$eval("#wordle-grid .wordle-tile", (e) => e.length);
  check("اللعبة بدأت والشبكة انرسمت", tiles > 0, tiles + " خانة");
  check("الكيبورد انرسم", (await page.$$eval("#keyboard .key", (e) => e.length)) > 20);

  const rowLen = await page.$eval("#wordle-grid .wordle-row", (r) => r.querySelectorAll(".wordle-tile").length);
  for (let i = 0; i < rowLen; i++) await page.locator('#keyboard .key:text-is("ا")').first().click();
  await page.waitForTimeout(250);
  const filled = await page.$$eval("#wordle-grid .wordle-tile", (e) => e.filter((t) => t.textContent.trim()).length);
  check("الكتابة بالكيبورد تشتغل", filled >= rowLen, filled + "/" + rowLen);

  await page.click("#wordle-hint-letter-btn");
  await page.waitForTimeout(400);
  check(
    "المساعدة تشتغل ونافذة السجل تنفتح",
    await page.$$eval(".kw-popover", (e) => e.some((x) => !x.classList.contains("hidden")))
  );

  // الصوت: fetch على data: URI لازم ينجح ويتفكّك، وإلا الفوز بلا صوت
  const audio = await page.evaluate(async () => {
    const t = [...document.querySelectorAll("script")]
      .map((s) => s.textContent)
      .find((x) => x && x.includes("data:audio/mpeg;base64,"));
    if (!t) return "ما انلقى صوت مدموج";
    try {
      const uri = t.match(/"(data:audio\/mpeg;base64,[^"]+)"/)[1];
      const buf = await (await fetch(uri)).arrayBuffer();
      const dec = await new (window.AudioContext || window.webkitAudioContext)().decodeAudioData(buf);
      return dec.duration > 0.5 ? "ok " + dec.duration.toFixed(1) + "ث" : "مدّة صفر";
    } catch (e) {
      return "طاح: " + e.message;
    }
  });
  check("صوت الفوز مدموج ويتفكّك", String(audio).startsWith("ok"), String(audio));

  if (fontsInlined) {
    check("خط Cairo مدموج وانحمّل", await page.evaluate(() => document.fonts.check('700 20px Cairo')));
    check("ولا طلب لملف خارجي", external.length === 0, external.slice(0, 3).join(" "));
  }
  check("ولا خطأ JS", errs.length === 0, errs.join(" | "));

  await browser.close();
  fs.rmSync(path.dirname(OUT), { recursive: true, force: true });
  check.done("الملف الواحد يشتغل بلا سيرفر ولا نت");
})().catch((e) => {
  console.error("‼️ طاح:", e.message);
  process.exit(1);
});
