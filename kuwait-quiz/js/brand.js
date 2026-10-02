// إعادة تشغيل حركة انقلاب خانات الشعار عند الضغط عليه.
// الحركة معرّفة بالـCSS داخل @media (prefers-reduced-motion: no-preference)، فلو الجهاز
// طالب تقليل الحركة ما راح ينصاف شي — وهذا المطلوب، ما نحتاج فحص إضافي هني.
(function () {
  const btn = document.querySelector(".brand-tiles");
  if (!btn) return;

  let busy = false;

  btn.addEventListener("click", function () {
    if (busy) return; // ضغطة وسط الحركة ما تقطعها على نص الطريق
    const tiles = btn.querySelectorAll(".brand-tile");
    if (!tiles.length) return;

    busy = true;
    btn.classList.remove("replay");
    // قراءة offsetWidth تجبر المتصفح يعيد الحساب، وبدونها إزالة الكلاس وإرجاعه
    // بنفس اللحظة ما يشغّل الحركة من جديد
    void btn.offsetWidth;
    btn.classList.add("replay");

    const last = tiles[tiles.length - 1];
    const done = function () {
      busy = false;
      last.removeEventListener("animationend", done);
    };
    last.addEventListener("animationend", done);
    // شبكة أمان: لو ما وصل حدث النهاية (تبويب مخفي مثلاً) ما نعلّق الزر للأبد
    setTimeout(done, 1200);
  });
})();
