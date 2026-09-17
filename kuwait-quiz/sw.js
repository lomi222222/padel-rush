// يخلي اللعبة تشتغل بلا نت. اللعب على جهاز واحد ما يحتاج شبكة أصلاً، فما فيه
// سبب تطيح بدون تغطية.
//
// رقم النسخة: **لازم يتغيّر مع أي تعديل على الملفات المخزّنة**، وإلا اللاعب يظل
// عالق على النسخة القديمة بعد أي تحديث. تغييره يخلي المتصفح يخزّن من جديد ويمسح
// المخزن القديم عند التفعيل.
const VERSION = "v7";
const CACHE = "saydha-" + VERSION;

const SHELL = [
  "./",
  "index.html",
  "wordle.html",
  "wordle-online.html",
  "style.css",
  "logo.svg",
  "manifest.json",
  "audio/win.mp3",
  "js/words.js",
  "js/wordle-core.js",
  "js/wordle-view.js",
  "js/sound.js",
  "js/howto.js",
  "js/settings.js",
  "js/tutorial.js",
  "js/wordle.js",
  "js/net-local.js",
  "js/net.js",
  "js/wordle-online.js",
  "js/theme.js",
  "js/brand.js",
  "js/pwa.js",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon-180.png",
];

self.addEventListener("install", (e) => {
  // addAll تفشل كلها لو طاح ملف واحد، فنخزّن كل ملف لحاله ونتسامح مع الناقص
  e.waitUntil(
    caches.open(CACHE).then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => {}))))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  // طلبات غير موقعنا (Firebase، خط Cairo) تمرّ بلا لمس — الأونلاين يحتاج شبكة
  // بطبيعته، وتخزينه يخرّب المزامنة
  if (new URL(req.url).origin !== self.location.origin) return;

  // الصفحات: الشبكة أولاً عشان أي تحديث يوصل فوراً، والمخزن احتياط لو ما فيه نت
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match("index.html")))
    );
    return;
  }

  // باقي الملفات: المخزن أولاً (أسرع)، ومع أول تحميل ناجح نحدّث النسخة المخزّنة
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
    )
  );
});
