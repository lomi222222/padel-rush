// صوت الفوز النهائي فقط — بلا أي صوت على الحركات العادية (نقرة، كشف حرف...) عشان
// ما يصير إزعاج. تصفيق جمهور، مصنّع بـWeb Audio مباشرة بلا أي ملف صوتي خارجي.
(function () {
  "use strict";

  const SECONDS = 2.6;

  let ctx = null;
  let cachedApplause = null; // نبنيه مرة وحدة ونعيد استخدامه

  function getCtx() {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    if (!ctx) ctx = new Ctor();
    return ctx;
  }

  // كل تصفيقة = دفعة ضوضاء قصيرة تخبو بسرعة (هذي فيزياء صوت الكف فعلياً). نوزّع
  // مئات التصفيقات عشوائياً على المدة، ومنحنى الكثافة يعلّيها بالبداية ويخفّتها
  // بالنهاية — فتُسمع كجمهور يصفّق مو كضجيج ثابت. القناتان تتولّدان بعشوائية
  // مستقلة فيطلع الصوت واسع (ستيريو) طبيعياً
  function buildApplause(c, seconds) {
    const sr = c.sampleRate;
    const len = Math.ceil(sr * seconds);
    const buf = c.createBuffer(2, len, sr);
    const clapLen = Math.floor(sr * 0.035);

    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      const claps = Math.floor(seconds * 320);
      for (let i = 0; i < claps; i++) {
        const start = Math.floor(Math.random() * (len - clapLen));
        const pos = start / len;
        const swell = Math.min(1, pos / 0.12) * (1 - pos * pos);
        if (swell <= 0) continue;
        const amp = swell * (0.35 + Math.random() * 0.65);
        for (let j = 0; j < clapLen; j++) {
          data[start + j] += (Math.random() * 2 - 1) * Math.exp(-j / (clapLen * 0.25)) * amp;
        }
      }
      // تسوية المستوى — بدونها تتراكم التصفيقات المتداخلة ويتشوّه الصوت
      let peak = 0;
      for (let i = 0; i < len; i++) {
        const v = Math.abs(data[i]);
        if (v > peak) peak = v;
      }
      if (peak > 0) {
        const g = 0.85 / peak;
        for (let i = 0; i < len; i++) data[i] *= g;
      }
    }
    return buf;
  }

  // يُستدعى مع أول لمسة بالصفحة: (١) الآيفون ما يسمح بالصوت إلا بعد تفاعل
  // المستخدم — وبالأونلاين شاشة الفوز تنفتح من تحديث Firebase مو من ضغطة، فبدون
  // هذا الفتح المبكر الصوت ينمنع. (٢) نجهّز العيّنة مقدماً عشان ما يهنّج شي
  // لحظة الفوز، والبناء نأجّله لحظة عشان ما يعطّل استجابة اللمسة نفسها
  function prewarm() {
    const c = getCtx();
    if (!c) return;
    try {
      if (c.state === "suspended") c.resume();
      const unlock = c.createBufferSource();
      unlock.buffer = c.createBuffer(1, 1, c.sampleRate);
      unlock.connect(c.destination);
      unlock.start(0);
      if (!cachedApplause) {
        setTimeout(() => {
          try {
            if (!cachedApplause) cachedApplause = buildApplause(c, SECONDS);
          } catch (e) {
            /* نتجاهل — playWin بيبنيه عند الحاجة */
          }
        }, 0);
      }
    } catch (e) {
      /* نتجاهل */
    }
  }

  function playWin() {
    const c = getCtx();
    if (!c) return;
    try {
      if (c.state === "suspended") c.resume();
      if (!cachedApplause) cachedApplause = buildApplause(c, SECONDS);

      const src = c.createBufferSource();
      src.buffer = cachedApplause;

      // نشيل الطنين الواطي والحدّة العالية — بدون الفلترة تُسمع "تشويش" مو "كفوف"
      const hp = c.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 900;
      hp.Q.value = 0.707;
      const lp = c.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 6500;
      lp.Q.value = 0.707;

      // يعلى بسرعة، يثبت، ثم يخبو — زي تصفيق يبدأ وينتهي
      const gain = c.createGain();
      const t = c.currentTime;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.9, t + 0.12);
      gain.gain.setValueAtTime(0.9, t + 1.6);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + SECONDS - 0.05);

      src.connect(hp).connect(lp).connect(gain).connect(c.destination);
      src.start(t);
      src.stop(t + SECONDS);
    } catch (e) {
      /* أوديو غير متاح بهذا المتصفح — نتجاهل بصمت */
    }
  }

  document.addEventListener("pointerdown", prewarm, { once: true });
  document.addEventListener("keydown", prewarm, { once: true });

  window.KwSound = { playWin, prewarm };
})();
