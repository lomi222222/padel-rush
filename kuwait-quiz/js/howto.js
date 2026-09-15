// شاشة "طريقة اللعب" — نافذة منبثقة تُبنى بالكامل هنا وتُلحَق بـbody، فما تدخل
// على قياسات شاشة الإعداد ولا شاشة اللعب. الزر نفسه موجود بالـHTML (topbar) وتنقّله
// theme.js لمجموعة الأزرار — هذا الملف يبني محتوى النافذة ويربط فتحها/إغلاقها بس.
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
    "<p>فريقان يتناوبون. كل فريق ياخذ دوره كامل يصيد فيه كلمة عربية سرية، حرف حرف.</p>" +
    "</section>" +
    "<section>" +
    "<h3>الألوان</h3>" +
    '<div class="howto-tiles">' +
    tile("ب", "green") +
    tile("د", "yellow") +
    tile("ر", "gray") +
    "</div>" +
    "<p><b>أخضر</b>: الحرف صح ومكانه صح. <b>أصفر</b>: الحرف موجود بالكلمة بس بمكان ثاني. <b>رمادي</b>: الحرف مو موجود إطلاقاً.</p>" +
    "</section>" +
    "<section>" +
    "<h3>المساعدات الثلاث</h3>" +
    '<ul class="howto-list">' +
    '<li><span class="howto-ico" data-icon="bulb"></span> <b>الفئة</b>: يلمّح لك فئة الكلمة، وينقص من نقاط الجولة.</li>' +
    '<li><span class="howto-ico" data-icon="repeat"></span> <b>حرف مكرر؟</b>: يقولك إذا فيه حرف يتكرر بالكلمة أو لا.</li>' +
    '<li><span class="howto-ico" data-icon="letter"></span> <b>اكشف حرف</b>: يحط حرف صحيح شفّاف بمكانه — تقدر تكتب فوقه أو تشيله بالمسح، مو لازم تحطه.</li>' +
    "</ul>" +
    "<p>كل مساعدة تُستخدم مرة وحدة بالجولة، وتنقص من نقاط الجولة بالمقدار المكتوب على زرّها.</p>" +
    "<p>الرقم الذهبي اللي جنب عدد المحاولات يوريك كم نقطة بتاخذ لو صدتها الحين — وينزل على طول مع كل مساعدة تستخدمها.</p>" +
    "</section>" +
    "<section>" +
    "<h3>البوق (السرقة)</h3>" +
    '<p><span class="howto-ico" data-icon="thief"></span> الفريق المنتظر يقدر "يبوق" أثناء دور الفريق الثاني ويسرق محاولة وحدة بس. لو خمّن صح ياخذ نقاط الجولة كاملة لحسابه.</p>' +
    "</section>" +
    "<section>" +
    "<h3>الفوز</h3>" +
    "<p>بعد ما كل فريق يلعب كل جولاته، الفريق صاحب أعلى مجموع نقاط يفوز بالمباراة.</p>" +
    "</section>" +
    "</div>" +
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
