// يخلي اللعبة تشتغل بلا نت. اللعب على جهاز واحد ما يحتاج شبكة أصلاً، فما فيه
// سبب تطيح بدون تغطية.
//
// رقم النسخة: **لازم يتغيّر مع أي تعديل على الملفات المخزّنة**، وإلا اللاعب يظل
// عالق على النسخة القديمة بعد أي تحديث. تغييره يخلي المتصفح يخزّن من جديد ويمسح
// المخزن القديم عند التفعيل.
const VERSION = "v23";
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
  "js/category-art.js",
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
  // **ما نستلم لحالنا** (ولا skipWaiting هني): الصفحة هي اللي تقرر وقت التبديل
  // عبر js/pwa.js، عشان ما نقطع لاعباً بنص جولة — حالة الجولة كلها بالذاكرة
});

// الإذن بالاستلام يجي من الصفحة. ولو ما وصل أبداً (pwa.js طاح مثلاً) النسخة
// المنتظرة تتفعّل لما تنسكّر كل تبويبات الموقع — يعني أسوأ حالة سلوك اليوم
self.addEventListener("message", (e) => {
  if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting();
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

  // **كل شي من نفس المخزن — الصفحات وباقي الملفات سواء.**
  //
  // كانت الصفحات «شبكة أولاً» عشان التحديث يوصل بسرعة، وباقي الملفات «مخزن
  // أولاً». والنتيجة إن كل تحديث يمر بنافذة يحمّل فيها اللاعب **HTML جديد فوق
  // JS قديم** — وهذا مو إزعاج، هذي صفحة مكسورة: أول ما أضفنا قائمة «عدد البوق»
  // طلعت عند صاحب المشروع فاضية تقول No Options، لأن العنصر وصل والكود اللي
  // يعبّيه لا.
  //
  // اسم المخزن (saydha-vN) هو وحدة الذرّية: كل شي من مخزن واحد ⇒ إما النسخة
  // كاملة قديمة أو كاملة جديدة، ولا شي بينهما. وإيصال الجديد شغلة js/pwa.js
  // (يفحص كل تحميل وعند رجوع الصفحة للظهور) — نسخة قديمة **شغّالة** أهون بكثير
  // من نسخة نصها جديد ومكسورة
  const fallback = () => (req.mode === "navigate" ? caches.match("index.html") : undefined);
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req)
          .then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
            return res;
          })
          .catch(() => fallback())
    )
  );
});
