// شاشة "طريقة اللعب" — نافذة منبثقة تُبنى بالكامل هنا وتُلحَق بـbody، فما تدخل
// على قياسات شاشة الإعداد ولا شاشة اللعب. الزر نفسه موجود بالـHTML (topbar) وتنقّله
// theme.js لمجموعة الأزرار — هذا الملف يبني محتوى النافذة ويربط فتحها/إغلاقها بس.
//
// لغة هذه الشاشة **فصحى** عمداً، بينما باقي اللعبة باللهجة الكويتية: هذي الشاشة
// مرجع يُقرأ بتركيز وقد يقرأه لاعب عربي غير كويتي، فالوضوح فيها أهم من النكهة.
(function () {
  "use strict";

  const openBtn = document.getElementById("wordle-howto-btn");
  if (!openBtn) return; // هذي الصفحة ما فيها زر (احتياط، وين ما ينحط الملف)

  function tile(letter, state) {
    return (
      '<div class="wordle-tile ' + state + '" style="width:34px;height:34px;font-size:16px">' +
      letter +
      "</div>"
    );
  }

  const overlay = document.createElement("div");
  overlay.className = "howto-overlay hidden";
  overlay.innerHTML =
    '<div class="howto-card" role="dialog" aria-modal="true" aria-labelledby="howto-title">' +
    '<div class="howto-head">' +
    '<h2 id="howto-title">طريقة اللعب</h2>' +
    '<button type="button" class="howto-close" aria-label="إغلاق">×</button>' +
    "</div>" +
    '<div class="howto-body">' +
    "<section>" +
    "<h3>الفكرة</h3>" +
    "<p>يتناوب فريقان على الأدوار. في كل دور تظهر كلمة عربية سرية، وعلى الفريق أن يخمّنها حرفاً حرفاً خلال عدد محدود من المحاولات.</p>" +
    "</section>" +
    "<section>" +
    "<h3>معنى الألوان</h3>" +
    "<p>بعد كل محاولة يتلوّن كل حرف كتبته بلون يدلّك على موضعه:</p>" +
    '<div class="howto-tiles">' +
    tile("ب", "green") +
    tile("د", "yellow") +
    tile("ر", "gray") +
    "</div>" +
    "<p><b>الأخضر</b>: الحرف صحيح وموضعه صحيح. <b>الأصفر</b>: الحرف موجود في الكلمة، لكن في موضع آخر. <b>الرمادي</b>: الحرف غير موجود في الكلمة إطلاقاً.</p>" +
    "</section>" +
    "<section>" +
    "<h3>المساعدات الثلاث</h3>" +
    '<ul class="howto-list">' +
    '<li><span class="howto-ico" data-icon="bulb"></span> <b>الفئة</b>: تكشف لك الفئة التي تنتمي إليها الكلمة، مثل «حيوان» أو «دولة».</li>' +
    '<li><span class="howto-ico" data-icon="repeat"></span> <b>حرف مكرر؟</b>: تخبرك إن كان في الكلمة حرف يتكرر أم لا.</li>' +
    '<li><span class="howto-ico" data-icon="letter"></span> <b>اكشف حرف</b>: تضع حرفاً صحيحاً باهتاً في موضعه. أنت حرّ في كتابته أو تجاهله.</li>' +
    "</ul>" +
    "<p><b>الفئة</b> و<b>حرف مكرر؟</b> تُستخدم كل منهما مرة واحدة في الجولة، و<b>اكشف حرف</b> مرتين على الأكثر ثم يُقفل زرّها. وكل مساعدة تخصم من نقاط الجولة بالمقدار المكتوب على زرّها.</p>" +
    "</section>" +
    "<section>" +
    "<h3>النقاط</h3>" +
    "<p>كلما أصبت الكلمة في محاولة أبكر زادت نقاطك، والإصابة من المحاولة الأولى تُضاعف النقاط.</p>" +
    "<p>الرقم الذهبي بجانب عدد المحاولات يبيّن النقاط التي ستحصل عليها إن أصبت الآن، وينقص فور استخدامك أي مساعدة.</p>" +
    "</section>" +
    "<section>" +
    "<h3>البوق</h3>" +
    '<p><span class="howto-ico" data-icon="thief"></span> يستطيع الفريق المنتظر أن يقاطع دور خصمه ويحاول تخمين الكلمة مرة واحدة فقط. فإن أصابها نال نقاط الجولة كاملة، وإن أخطأ عاد الدور إلى صاحبه بمحاولاته كما هي.</p>' +
    "</section>" +
    "<section>" +
    "<h3>الفوز</h3>" +
    "<p>بعد أن يُتمّ كل فريق جولاته، يفوز صاحب المجموع الأعلى من النقاط.</p>" +
    "</section>" +
    "</div>" +
    '<button type="button" class="btn btn-outline btn-block howto-replay hidden">أعد التجربة التوجيهية</button>' +
    '<button type="button" class="btn btn-primary btn-block howto-got-it">فهمت</button>' +
    "</div>";
  document.body.appendChild(overlay);

  // الأيقونات الحقيقية نفسها المستخدمة بأزرار المساعدات — نجيبها من WordleView
  // لو محمّل بهذي الصفحة، وإلا نسيبها فاضية (النص لحاله واضح)
  if (window.WordleView && typeof WordleView.setIconLabel === "function") {
    overlay.querySelectorAll(".howto-ico").forEach((el) => {
      WordleView.setIconLabel(el, el.dataset.icon, "");
    });
  }

  function open() {
    overlay.classList.remove("hidden");
  }
  function close() {
    overlay.classList.add("hidden");
  }

  // زر إعادة التجربة يبين بس لو ملف التجربة محمّل بهالصفحة
  const replayBtn = overlay.querySelector(".howto-replay");
  if (window.WordleTutorial) {
    replayBtn.classList.remove("hidden");
    replayBtn.addEventListener("click", () => {
      close();
      window.WordleTutorial.open();
    });
  }

  openBtn.addEventListener("click", open);
  overlay.querySelector(".howto-close").addEventListener("click", close);
  overlay.querySelector(".howto-got-it").addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close(); // نقرة على الخلفية المعتّمة
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !overlay.classList.contains("hidden")) close();
  });
})();
