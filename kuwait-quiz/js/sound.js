// صوت الفوز النهائي فقط — بلا أي صوت على الحركات العادية (نقرة، كشف حرف...) عشان
// ما يصير إزعاج. مصنّع بـWeb Audio API مباشرة، بلا أي ملف صوتي أو مكتبة خارجية.
(function () {
  "use strict";

  let ctx = null;
  function getCtx() {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    if (!ctx) ctx = new Ctor();
    return ctx;
  }

  // نغمة وحدة بمغلّف صعود/هبوط (ADSR مبسّط) عشان ما تطلع "طقة" حادة
  function note(c, t0, freq, dur, peakGain, type) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peakGain, t0 + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  // فانفير قصيرة: أربع نغمات صاعدة (دو-مي-صول-دو أوكتاف) ثم وتر ختامي
  function playWin() {
    const c = getCtx();
    if (!c) return;
    try {
      if (c.state === "suspended") c.resume();
      const t = c.currentTime;
      const rising = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
      rising.forEach((freq, i) => note(c, t + i * 0.12, freq, 0.5, 0.2, "triangle"));
      const chord = [783.99, 987.77, 1318.5]; // G5 B5 E6
      chord.forEach((freq) => note(c, t + 0.55, freq, 1.0, 0.14, "sine"));
    } catch (e) {
      /* أوديو غير متاح بهذا المتصفح — نتجاهل بصمت */
    }
  }

  window.KwSound = { playWin };
})();
