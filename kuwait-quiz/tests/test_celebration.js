// نتأكد إن احتفال الفوز (صوت + كونفيتي/ألعاب نارية) يشتغل مرة وحدة فقط، وما يكسر التخطيط.
const { launch, BASE } = require("./_browser");
let fail = 0;
const check = (n, ok, x) => { console.log((ok ? "✅ " : "‼️ ") + n + (x ? "  " + x : "")); if (!ok) fail++; };

async function playRoundOut(page, prefix) {
  const endSel = prefix === "#wordle" ? "#wordle-end-screen" : "#online-end";
  for (let guard = 0; guard < 40; guard++) {
    const done = await page.evaluate(({ p, e }) =>
      !document.querySelector(p + "-round-end").classList.contains("hidden") ||
      !document.querySelector(e).classList.contains("hidden"), { p: prefix, e: endSel });
    if (done) return;
    const need = await page.evaluate(() => {
      const row = [...document.querySelectorAll("#wordle-grid .wordle-row, #online-grid .wordle-row")]
        .find((r) => ![...r.children].some((e) => /\b(green|yellow|gray)\b/.test(e.className)));
      if (!row) return 0;
      return [...row.children].filter((e) => !e.className.includes("gap")).length
           - [...row.children].filter((e) => e.className.includes("filled")).length;
    });
    for (let i = 0; i < need; i++) {
      await page.locator('.keyboard .key:text-is("ء")').first().click();
      await page.waitForTimeout(20);
    }
    await page.locator('.keyboard .key:text-is("إدخال")').first().click();
    await page.waitForTimeout(150);
  }
}

(async () => {
  const browser = await launch();

  // === محلي ===
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
     await page.addInitScript(() => { try { localStorage.setItem("kw-tutorial-seen", "1"); } catch (e) {} });  // التجربة التوجيهية تطلع أول زيارة — نتخطاها بالاختبارات
    const errs = [];
    page.on("pageerror", (e) => errs.push(String(e)));
    await page.goto(BASE + "/wordle.html");
    for (const inp of await page.$$("#wordle-team1-input, #wordle-team2-input")) await inp.fill("فريق");
    await page.selectOption("#wordle-round-count", "3");
    await page.click("#wordle-start-btn");
    await page.waitForTimeout(300);

    for (let i = 0; i < 6; i++) {
      const ended = await page.evaluate(() => !document.querySelector("#wordle-end-screen").classList.contains("hidden"));
      if (ended) break;
      await playRoundOut(page, "#wordle");
      const nextVisible = await page.evaluate(() => !document.querySelector("#wordle-round-end").classList.contains("hidden"));
      if (nextVisible) { await page.click("#wordle-next-team-btn"); await page.waitForTimeout(250); }
    }
    await page.waitForTimeout(200);

    const overlayCount = await page.locator(".celebrate-overlay").count();
    check("محلي: طبقة الاحتفال ظهرت", overlayCount >= 1, "count=" + overlayCount);
    const pieces = await page.evaluate(() => document.querySelectorAll(".confetti-piece").length);
    check("محلي: فيها قطع كونفيتي", pieces > 0, "قطع=" + pieces);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    check("محلي: بلا تجاوز أفقي أثناء الاحتفال", !overflow);
    check("محلي: ما صار خطأ JS", errs.length === 0, errs.join(" | "));
    await page.waitForTimeout(3600);
    const overlayAfter = await page.locator(".celebrate-overlay").count();
    check("محلي: الطبقة تزول لحالها", overlayAfter === 0, "count=" + overlayAfter);
    await page.close();
  }

  // === أونلاين: نتأكد إن الاحتفال ما يتكرر مع كل إعادة رسم ===
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
     await ctx.addInitScript(() => { try { localStorage.setItem("kw-tutorial-seen", "1"); } catch (e) {} });  // التجربة التوجيهية تطلع أول زيارة — نتخطاها بالاختبارات
    const seed = await ctx.newPage();
     await seed.addInitScript(() => { try { localStorage.setItem("kw-tutorial-seen", "1"); } catch (e) {} });  // التجربة التوجيهية تطلع أول زيارة — نتخطاها بالاختبارات
    await seed.goto(BASE + "/wordle-online.html?net=local&pid=seed");
    await seed.evaluate(() => localStorage.removeItem("kw-net-local-tree"));
    await seed.close();

    const host = await ctx.newPage();
     await host.addInitScript(() => { try { localStorage.setItem("kw-tutorial-seen", "1"); } catch (e) {} });  // التجربة التوجيهية تطلع أول زيارة — نتخطاها بالاختبارات
    const foe = await ctx.newPage();
     await foe.addInitScript(() => { try { localStorage.setItem("kw-tutorial-seen", "1"); } catch (e) {} });  // التجربة التوجيهية تطلع أول زيارة — نتخطاها بالاختبارات
    const errs = [];
    for (const p of [host, foe]) p.on("pageerror", (e) => errs.push(String(e)));

    await host.goto(BASE + "/wordle-online.html?net=local&pid=H");
    await host.fill("#online-name-input", "سالم");
    await host.click("#online-create-btn");
    await host.waitForTimeout(300);
    const code = (await host.$eval("#online-room-code", (e) => e.textContent)).trim();

    await foe.goto(BASE + "/wordle-online.html?net=local&pid=F");
    await foe.fill("#online-name-input", "بدر");
    await foe.fill("#online-code-input", code);
    await foe.click("#online-join-btn");
    await foe.waitForTimeout(300);

    await host.locator('.online-team-pick[data-team="0"]').click();
    await foe.locator('.online-team-pick[data-team="1"]').click();
    await host.waitForTimeout(300);
    await host.selectOption("#online-round-count", "3");
    await host.click("#online-start-btn");
    await host.waitForTimeout(500);

    for (let i = 0; i < 6; i++) {
      const ended = await host.evaluate(() => !document.querySelector("#online-end").classList.contains("hidden"));
      if (ended) break;
      const hostTurn = await host.evaluate(() => {
        const k = document.querySelector("#online-keyboard .key");
        return k && !k.disabled;
      });
      const page = hostTurn ? host : foe;
      await playRoundOut(page, "#online");
      await host.waitForTimeout(300);
      const nextVisible = await host.evaluate(() =>
        !document.querySelector("#online-round-end").classList.contains("hidden") &&
        !document.querySelector("#online-next-team-btn").classList.contains("hidden"));
      if (nextVisible) { await host.click("#online-next-team-btn"); await host.waitForTimeout(400); }
    }
    await host.waitForTimeout(500);

    const hostOverlay = await host.locator(".celebrate-overlay").count();
    check("أونلاين (هوست): طبقة الاحتفال ظهرت مرة وحدة", hostOverlay === 1, "count=" + hostOverlay);
    // ننتظر ونتأكد إنها ما ترجع تتكرر (لو صار إعادة رسم من Firebase)
    await host.waitForTimeout(1500);
    const hostOverlayLater = await host.locator(".celebrate-overlay").count();
    check("أونلاين (هوست): ما تكرّرت مع إعادة الرسم", hostOverlayLater <= 1, "count=" + hostOverlayLater);
    check("أونلاين: ما صار خطأ JS", errs.length === 0, errs.join(" | "));

    await ctx.close();
  }

  await browser.close();
  console.log(fail ? "\n" + fail + " فحص فشل" : "\nكل الفحوص نجحت");
  process.exit(fail ? 1 : 0);
})();
