// صوت الفوز النهائي فقط — بلا أي صوت على الحركات العادية (نقرة، كشف حرف...) عشان
// ما يصير إزعاج.
//
// الملف: audio/win.mp3 — تصفيق جمهور صغير، من Pixabay (رفعه freesound_community)،
// ورخصة Pixabay تسمح بالاستخدام التجاري. مقصوص من ٩٫٥ ثواني لـ٣ على حدود إطارات
// MP3 (بلا إعادة ترميز فما نقصت الجودة). توثيق المصدر مهم لأن اللعبة رايحة للمتاجر.
(function () {
  "use strict";

  const SRC = "audio/win.mp3";
  const VOLUME = 0.9;
  const FADE_OUT = 0.6; // آخر ثانية تخفت تدريجياً فما ينسمع القص كـ"طقة"

  let ctx = null;
  let bufferPromise = null;

  function getCtx() {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    if (!ctx) ctx = new Ctor();
    return ctx;
  }

  function loadBuffer(c) {
    if (bufferPromise) return bufferPromise;
    bufferPromise = fetch(SRC)
      .then((r) => r.arrayBuffer())
      .then(
        (data) =>
          new Promise((resolve, reject) => {
            // سفاري القديم ما يرجّع Promise من decodeAudioData — يبي callbacks،
            // فنمرّرها ونتعامل مع الشكلين
            const maybe = c.decodeAudioData(data, resolve, reject);
            if (maybe && maybe.then) maybe.then(resolve, reject);
          })
      )
      .catch(() => null); // ما انحمّل (بلا نت مثلاً) — نكمل بلا صوت بصمت
    return bufferPromise;
  }

  // يُستدعى مع أول لمسة بالصفحة: (١) الآيفون ما يسمح بالصوت إلا بعد تفاعل
  // المستخدم — وبالأونلاين شاشة الفوز تنفتح من تحديث Firebase مو من ضغطة، فبدون
  // هذا الفتح المبكر الصوت ينمنع. (٢) نحمّل الملف مقدماً فيكون جاهز لحظة الفوز
  function prewarm() {
    const c = getCtx();
    if (!c) return;
    try {
      if (c.state === "suspended") c.resume();
      const unlock = c.createBufferSource();
      unlock.buffer = c.createBuffer(1, 1, c.sampleRate);
      unlock.connect(c.destination);
      unlock.start(0);
      loadBuffer(c);
    } catch (e) {
      /* نتجاهل */
    }
  }

  function playWin() {
    const c = getCtx();
    if (!c) return;
    try {
      if (c.state === "suspended") c.resume();
      loadBuffer(c).then((buf) => {
        if (!buf) return;
        const src = c.createBufferSource();
        src.buffer = buf;
        const gain = c.createGain();
        const t = c.currentTime;
        const dur = buf.duration;
        gain.gain.setValueAtTime(VOLUME, t);
        gain.gain.setValueAtTime(VOLUME, t + Math.max(0, dur - FADE_OUT));
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(gain).connect(c.destination);
        src.start(t);
      });
    } catch (e) {
      /* أوديو غير متاح بهذا المتصفح — نتجاهل بصمت */
    }
  }

  document.addEventListener("pointerdown", prewarm, { once: true });
  document.addEventListener("keydown", prewarm, { once: true });

  window.KwSound = { playWin, prewarm };
})();
