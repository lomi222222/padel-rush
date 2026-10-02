// يتأكد إن مسار Firebase الحقيقي (بدون ?net=local) يقرأ الإعداد ويبني الغرفة صح.
// نحقن بديل وهمي لمكتبة Firebase لأن الساندبوكس يمنع تحميلها من gstatic.
const { launch, BASE } = require("./_browser");

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log((ok ? "PASS" : "FAIL") + " | " + label + " => " + JSON.stringify(actual) +
    (ok ? "" : "  (expected " + JSON.stringify(expected) + ")"));
}

const FAKE_SDK = () => {
  // شجرة بيانات بالذاكرة تحاكي Realtime Database
  window.__fbWrites = [];
  window.__fbInitConfig = null;
  const tree = {};
  const listeners = [];
  const segs = (p) => String(p).split("/").filter(Boolean);
  function getAt(path) {
    let n = tree;
    for (const s of segs(path)) {
      if (n === null || typeof n !== "object") return null;
      n = n[s];
      if (n === undefined) return null;
    }
    return n === undefined ? null : n;
  }
  function setAt(path, v) {
    const p = segs(path);
    let n = tree;
    for (let i = 0; i < p.length - 1; i++) {
      if (typeof n[p[i]] !== "object" || n[p[i]] === null) n[p[i]] = {};
      n = n[p[i]];
    }
    if (v === null) delete n[p[p.length - 1]];
    else n[p[p.length - 1]] = v;
    listeners.forEach((l) => {
      if (path.startsWith(l.path) || l.path.startsWith(path)) l.cb({ val: () => getAt(l.path) });
    });
  }
  window.firebase = {
    apps: [],
    initializeApp(cfg) {
      window.__fbInitConfig = cfg;
      window.firebase.apps.push({});
    },
    database() {
      return {
        ref(path) {
          return {
            set(v) { window.__fbWrites.push(path); setAt(path, v); return Promise.resolve(); },
            update(o) {
              window.__fbWrites.push(path);
              Object.keys(o).forEach((k) => setAt(path + "/" + k, o[k]));
              return Promise.resolve();
            },
            remove() { setAt(path, null); return Promise.resolve(); },
            once() { return Promise.resolve({ val: () => getAt(path) }); },
            on(evt, cb) { listeners.push({ path: String(path), cb }); cb({ val: () => getAt(path) }); return cb; },
            off() {},
            onDisconnect() { return { remove() {} }; },
          };
        },
      };
    },
  };
};

(async () => {
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
   await page.addInitScript(() => { try { localStorage.setItem("kw-tutorial-seen", "1"); } catch (e) {} });  // التجربة التوجيهية تطلع أول زيارة — نتخطاها بالاختبارات
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.addInitScript(FAKE_SDK);
  await page.goto(BASE + "/wordle-online.html"); // بدون net=local => مسار Firebase
  await page.waitForTimeout(400);

  const cfg = await page.evaluate(() => window.__fbInitConfig);
  check("initializeApp got the real config", cfg && cfg.projectId, "alathka-c6ca1");
  check("databaseURL passed through", cfg && cfg.databaseURL, "https://alathka-c6ca1-default-rtdb.firebaseio.com");
  check("no error banner on firebase path", await page.$eval("#online-status", (el) => el.classList.contains("hidden")), true);
  check("create button enabled", await page.$eval("#online-create-btn", (el) => el.disabled), false);

  // ينشئ غرفة فعلياً عبر مسار Firebase
  await page.fill("#online-name-input", "سالم");
  await page.click("#online-create-btn");
  await page.waitForTimeout(500);
  const code = (await page.$eval("#online-room-code", (el) => el.textContent)).trim();
  check("room code created", code.length, 4);
  check("lobby shown", await page.$eval("#online-lobby", (el) => !el.classList.contains("hidden")), true);
  check("host row rendered", await page.$$eval(".online-player-row", (e) => e.length), 1);

  const writes = await page.evaluate(() => window.__fbWrites);
  check("wrote room meta", writes.some((w) => w === "rooms/" + code + "/meta"), true);
  check("wrote host player node", writes.some((w) => w === "rooms/" + code + "/players/" + w.split("/").pop()), true);
  check("all writes are under rooms/", writes.every((w) => w.startsWith("rooms/")), true);

  check("no page errors", errors, []);
  await browser.close();
  console.log(failures === 0 ? "\nFIREBASE WIRING OK" : "\n" + failures + " CHECK(S) FAILED");
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error("FAILED:", e); process.exit(1); });
