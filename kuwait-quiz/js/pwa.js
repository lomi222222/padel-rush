// تسجيل الـservice worker — هو اللي يخلي اللعبة تنثبّت وتشتغل بلا نت.
// الفشل ما يضر شي: اللعبة تكمل شغل عادي بدونه (متصفح قديم، أو بلا https).
(function () {
  "use strict";
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {
      /* نتجاهل */
    });
  });
})();
