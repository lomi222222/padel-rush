// تسجيل الـservice worker وإيصال التحديثات للاعب.
// الفشل ما يضر شي: اللعبة تكمل شغل عادي بدونه (متصفح قديم، أو بلا https).
//
// ليش هالملف أكبر من مجرد register: الـSW يخدم JS و CSS من المخزن أولاً، يعني
// الصفحة اللي قدام اللاعب تشتغل بالكود القديم حتى لو نزلت نسخة جديدة بالخلفية.
// بدون الي تحت، اللاعب لازم يفتح اللعبة **مرتين** عشان يشوف أي تعديل — وهذا
// اللي صار فعلاً: جهاز محدّث وجهاز لا، بنفس الرابط.
(function () {
  "use strict";
  if (!("serviceWorker" in navigator)) return;

  const sw = navigator.serviceWorker;

  // تُقرأ **الحين** قبل أي تسجيل: بأول زيارة ما فيه controller، و`controllerchange`
  // يصير هناك بعد عند أول تثبيت. لولا هالعلم راح نعيد تحميل الصفحة بأول زيارة
  // لكل لاعب جديد — دورة بلا أي فايدة
  const hadController = !!sw.controller;
  let reloading = false;

  // جولة شغّالة؟ كل حالتها بالذاكرة، فإعادة التحميل تضيّعها. قرار صاحب المشروع:
  // ما نزعج اللاعب — النسخة الجديدة تقعد منتظرة وتنطبق بالفتحة الجاية
  const inRound = () =>
    !!document.querySelector("#wordle-play-screen:not(.hidden), #online-play:not(.hidden)");

  // النسخة المنتظرة ما تستلم إلا لما نأذن لها. الإذن من هني عشان نقدر نأجّله
  function activate(reg) {
    if (reg && reg.waiting && !inRound()) reg.waiting.postMessage({ type: "SKIP_WAITING" });
  }

  // حزام أمان: سقف لعدد مرات إعادة التحميل بالجلسة الوحدة. لو صار خلل بالنشر
  // وظلت "نسخة جديدة" تنزل كل مرة، بلا سقف تدخل الصفحة بحلقة تحميل لا نهائية
  // عند كل اللاعبين — وهذا أسوأ بكثير من نسخة قديمة. ثلاثة تكفي لأي تحديث
  // شرعي بجلسة وحدة، وتوقف الحلقة بسرعة
  const COUNT_KEY = "kw-sw-reloads";
  const MAX_RELOADS = 3;
  function reloadForUpdate() {
    if (reloading) return;
    try {
      const done = Number(sessionStorage.getItem(COUNT_KEY) || 0);
      if (done >= MAX_RELOADS) return;
      sessionStorage.setItem(COUNT_KEY, String(done + 1));
    } catch (e) {
      /* تصفح خاص: نكمل بلا السقف — علم reloading يمنع التكرار بهالصفحة */
    }
    reloading = true;
    location.reload();
  }

  sw.addEventListener("controllerchange", () => {
    // نسخة جديدة استلمت، بس الصفحة للحين مشغّلة ملفات النسخة القديمة (انحمّلت
    // قبل الاستلام) — فما فيه طريقة غير إعادة التحميل
    if (!hadController) return;
    reloadForUpdate();
  });

  window.addEventListener("load", () => {
    sw.register("sw.js")
      .then((reg) => {
        // نسخة منتظرة من زيارة سابقة (مثلاً وصلت وهو بنص جولة أمس)
        activate(reg);
        reg.addEventListener("updatefound", () => {
          const fresh = reg.installing;
          if (!fresh) return;
          fresh.addEventListener("statechange", () => {
            if (fresh.state === "installed") activate(reg);
          });
        });
        // التطبيق المثبّت يرجع من الخلفية بلا تنقّل، فما يفحص التحديث لحاله —
        // بدون هذا يظل على النسخة القديمة بلا سقف زمني
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") reg.update().catch(() => {});
        });
      })
      .catch(() => {
        /* نتجاهل */
      });
  });
})();
