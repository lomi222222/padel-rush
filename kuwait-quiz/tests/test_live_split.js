// يثبت إن ضغطة الحرف ما تنشر الحالة كاملة: state ما يتغيّر أبداً أثناء الكتابة،
// وبس عقدة live الصغيرة اللي تتحدّث — مع بقاء المزامنة بين الأجهزة شغّالة.
const { launch, BASE } = require("./_browser");

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    (ok ? "PASS" : "FAIL") + " | " + label + " => " + JSON.stringify(actual) +
    (ok ? "" : "  (expected " + JSON.stringify(expected) + ")")
  );
}

const url = (pid) => BASE + "/wordle-online.html?net=local&pid=" + pid;

async function newTab(context, pid) {
  const page = await context.newPage();
   await page.addInitScript(() => { try { localStorage.setItem("kw-tutorial-seen", "1"); } catch (e) {} });  // التجربة التوجيهية تطلع أول زيارة — نتخطاها بالاختبارات
  page.on("pageerror", (e) => {
    failures++;
    console.log("PAGEERROR(" + pid + "):", e.message);
  });
  await page.goto(url(pid));
  await page.waitForTimeout(150);
  return page;
}

// يقرأ عقدتي الغرفة من شجرة النقل المحلي
const readRoom = (page) =>
  page.evaluate(() => {
    const tree = JSON.parse(localStorage.getItem("kw-net-local-tree") || "{}");
    const room = Object.values(tree.rooms || {})[0] || {};
    return {
      state: JSON.stringify(room.state || null),
      live: JSON.stringify(room.live || null),
    };
  });

async function tap(page, ch) {
  await page.locator('#online-keyboard .key:text-is("' + ch + '")').first().click();
  await page.waitForTimeout(120);
}

(async () => {
  const browser = await launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
   await context.addInitScript(() => { try { localStorage.setItem("kw-tutorial-seen", "1"); } catch (e) {} });  // التجربة التوجيهية تطلع أول زيارة — نتخطاها بالاختبارات

  const seed = await context.newPage();
   await seed.addInitScript(() => { try { localStorage.setItem("kw-tutorial-seen", "1"); } catch (e) {} });  // التجربة التوجيهية تطلع أول زيارة — نتخطاها بالاختبارات
  await seed.goto(url("seed"));
  await seed.evaluate(() => localStorage.removeItem("kw-net-local-tree"));
  await seed.close();

  const host = await newTab(context, "hostA");
  await host.fill("#online-name-input", "سالم");
  await host.click("#online-create-btn");
  await host.waitForTimeout(300);
  const code = (await host.$eval("#online-room-code", (el) => el.textContent)).trim();

  const p2 = await newTab(context, "playerB");
  await p2.fill("#online-name-input", "ناصر");
  await p2.fill("#online-code-input", code);
  await p2.click("#online-join-btn");
  await p2.waitForTimeout(300);

  await host.locator('.online-team-pick[data-team="0"]').click();
  await p2.locator('.online-team-pick[data-team="1"]').click();
  await host.waitForTimeout(250);

  // فئة وكلمة مثبّتة: "سلحفاة"
  await host.click("#online-cat-all");
  const catTexts = await host.$$eval("#online-category-list label", (e) => e.map((x) => x.textContent));
  const catInputs = await host.$$("#online-category-list input");
  await catInputs[catTexts.indexOf("حيوان")].click();
  const info = await host.evaluate(() => {
    const pool = WORDS.filter((w) => w.category === "حيوان");
    return { poolLen: pool.length, idx: pool.findIndex((w) => w.word === "سلحفاة") };
  });
  await host.evaluate(({ idx, poolLen }) => {
    Math.random = () => (idx + 0.001) / poolLen;
  }, info);
  await host.click("#online-start-btn");
  await host.waitForTimeout(600);

  // ===== الادعاء الأساسي =====
  const before = await readRoom(p2);
  check("state node exists before typing", before.state !== "null", true);
  check("live node exists before typing", before.live !== "null", true);

  for (const ch of ["س", "ل", "ح"]) await tap(host, ch);
  await host.waitForTimeout(300);

  const after = await readRoom(p2);
  check("3 keystrokes did NOT rewrite the state node", after.state === before.state, true);
  check("the live node did change", after.live !== before.live, true);

  const liveObj = JSON.parse(after.live);
  // المصفوفة بطول الكلمة دائماً والخانات الفاضية "" — عشان الحرف يحتفظ بموضعه لما
  // يكتب اللاعب بخانة مو بالترتيب
  check("live carries the typed letters", liveObj.currentGuess, ["س", "ل", "ح", "", "", ""]);
  check("live is tiny (bytes)", after.live.length < 200, true);
  check("state is the heavy node (bytes)", after.state.length > 600, true);
  console.log(
    "INFO | حجم العقدتين: state=" + after.state.length + "B  live=" + after.live.length + "B" +
    "  => توفير " + (100 - Math.round((100 * after.live.length) / after.state.length)) + "%"
  );

  // ===== السرية ما انكسرت بالتقسيم =====
  check("live does not leak the answer", after.live.includes("سلحفاة"), false);
  check("live has no target key", after.live.includes("target"), false);

  // ===== المزامنة لازم تظل شغّالة عند الطرف الثاني =====
  const p2Tiles = await p2.$$eval("#online-grid .wordle-row:first-child .wordle-tile", (els) =>
    els.map((e) => e.textContent).join("")
  );
  check("other device sees the letters live", p2Tiles.startsWith("سلح"), true);

  // ===== المسح يتزامن هم =====
  await host.locator('#online-keyboard .key:text-is("⌫")').first().click();
  await host.waitForTimeout(300);
  const afterDel = await readRoom(p2);
  check("delete also stays on the live node", afterDel.state === before.state, true);
  check("delete synced to the other device", JSON.parse(afterDel.live).currentGuess, ["س", "ل", "", "", "", ""]);

  // ===== الإرسال: هنا لازم state يتغيّر (المخزن بعد المسح = س ل، وباقي ح ف ا ة) =====
  for (const ch of ["ح", "ف", "ا", "ة"]) await tap(host, ch);
  await host.locator('#online-keyboard .key:text-is("إدخال")').first().click();
  await host.waitForTimeout(600);
  const won = await readRoom(p2);
  check("a submit DOES rewrite the state node", won.state !== before.state, true);
  check("rev matches across both nodes", JSON.parse(won.state).rev, JSON.parse(won.live).rev);

  await browser.close();
  console.log(failures ? "\n" + failures + " FAILURE(S)" : "\nALL LIVE-SPLIT CHECKS PASSED");
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.log("FAILED:", e.message);
  process.exit(1);
});
