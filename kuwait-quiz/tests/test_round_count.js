// عدد الجولات يختاره الهوست، والبوق يتوسّع معه.
const { launch, BASE, pickOnlyCategory, loseRound } = require("./_browser");
let fail = 0;
const check = (n, ok, x) => { console.log((ok ? "✅ " : "‼️ ") + n + (x ? "  " + x : "")); if (!ok) fail++; };

async function runMatch(b, rounds, expectedBoq) {
  const page = await b.newPage({ viewport: { width: 390, height: 900 } });
   await page.addInitScript(() => { try { localStorage.setItem("kw-tutorial-seen", "1"); } catch (e) {} });  // التجربة التوجيهية تطلع أول زيارة — نتخطاها بالاختبارات
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  await page.goto(BASE + "/wordle.html");

  // فئة "حيوان" أقصر فئة بالبنك: مباراة ١٠ جولات تعني ٢٠ جولة تُخسَر صفاً صفاً،
  // فطول الكلمة هو اللي يقرر الوقت
  await pickOnlyCategory(page, "wordle", "حيوان");
  await page.selectOption("#wordle-round-count", String(rounds));
  await page.click("#wordle-start-btn");
  await page.waitForTimeout(400);

  const sub = await page.$eval("#wordle-subtitle", (e) => e.textContent);
  const ar = (n) => String(n).split("").map((d) => "٠١٢٣٤٥٦٧٨٩"[+d]).join("");
  check(`[${rounds}] العنوان يقول "من ${ar(rounds)}"`, sub.includes("من " + ar(rounds)), sub.slice(0, 40));

  const boqText = await page.$eval("#wordle-boq-btn", (e) => e.textContent);
  check(`[${rounds}] البوق يبدأ بـ${expectedBoq}`, boqText.includes(ar(expectedBoq)), boqText.trim());

  // نلعب كل الجولات لين تنتهي المباراة، ونعدّ كم جولة صارت
  let played = 0;
  for (let i = 0; i < rounds * 2 + 4; i++) {
    const over = await page.evaluate(() => !document.querySelector("#wordle-end-screen").classList.contains("hidden"));
    if (over) break;
    await loseRound(page, "wordle");
    played++;
    const nextVisible = await page.evaluate(() => !document.querySelector("#wordle-round-end").classList.contains("hidden"));
    if (nextVisible) {
      await page.click("#wordle-next-team-btn");
      await page.waitForTimeout(300);
    }
  }

  const ended = await page.evaluate(() => !document.querySelector("#wordle-end-screen").classList.contains("hidden"));
  check(`[${rounds}] المباراة انتهت`, ended);
  check(`[${rounds}] عدد الجولات الفعلي = ${rounds * 2}`, played === rounds * 2, "لعبنا " + played);
  check(`[${rounds}] ما صار خطأ JS`, errs.length === 0, errs.join(" | "));

  await page.close();
}

(async () => {
  const b = await launch();
  await runMatch(b, 3, 1);
  await runMatch(b, 10, 4);
  await b.close();
  console.log(fail ? "\n" + fail + " فحص فشل" : "\nكل الفحوص نجحت");
  process.exit(fail ? 1 : 0);
})();
