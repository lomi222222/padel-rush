// محرّك الأصوات — ملفات قصيرة مسجّلة (مو موسيقى) تُشغّل عبر Web Audio.
//
// الأصوات من حزمة uisfx (uisfx.com) — رخصة CC0 1.0 (ملكية عامة، الاستخدام التجاري
// مسموح بدون إذن). الحزمة المستخدمة: glass.
//
// ثلاث قواعد تخلي الصوت "لايق" مو مزعج:
//   ١) صوت ضغطة الحرف خافت جداً وتتغيّر نبرته شوي كل مرة عشان ما يصير ممل بالتكرار
//   ٢) حد أدنى للمسافة بين الصوت ونفسه (throttle) فما تتراكم الأصوات فوق بعض
//   ٣) زر كتم يُحفظ بالجهاز، وكل شي ينطفي منه
(function () {
  "use strict";

  const BASE = "sounds/";
  const STORE_KEY = "kw-sound";

  // name: [ملف, مستوى الصوت, أقل مسافة زمنية بالميلي ثانية, تغيّر النبرة ±]
  const CUES = {
    key: ["press", 0.22, 40, 0.06],
    submit: ["send", 0.38, 120, 0.02],
    win: ["success", 0.55, 300, 0],
    lose: ["error", 0.45, 300, 0],
    timeLow: ["warning", 0.4, 1000, 0],
    steal: ["notification", 0.55, 300, 0],
    stealWin: ["reward", 0.6, 300, 0],
    roundStart: ["start", 0.32, 300, 0],
    matchEnd: ["complete", 0.55, 500, 0],
    playerJoin: ["connect", 0.35, 400, 0],
  };

  let ctx = null;
  let master = null;
  const buffers = {};
  const lastPlayed = {};
  let muted = readMuted();
  let unlocked = false;

  function readMuted() {
    try {
      return localStorage.getItem(STORE_KEY) === "off";
    } catch (e) {
      return false;
    }
  }

  function writeMuted(v) {
    try {
      localStorage.setItem(STORE_KEY, v ? "off" : "on");
    } catch (e) {
      /* تجاهل */
    }
  }

  function ensureContext() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);
    return ctx;
  }

  async function loadCue(file) {
    if (buffers[file]) return buffers[file];
    const c = ensureContext();
    if (!c) return null;
    try {
      const res = await fetch(BASE + file + ".mp3");
      if (!res.ok) return null;
      const raw = await res.arrayBuffer();
      buffers[file] = await c.decodeAudioData(raw);
      return buffers[file];
    } catch (e) {
      return null; // ما نكسر اللعبة لو فشل تحميل صوت
    }
  }

  // المتصفحات تمنع الصوت قبل أول لمسة من اللاعب — نفكّه من أول تفاعل ونحمّل الملفات
  function unlock() {
    if (unlocked) return;
    unlocked = true;
    const c = ensureContext();
    if (!c) return;
    if (c.state === "suspended") c.resume();
    Object.keys(CUES).forEach((name) => loadCue(CUES[name][0]));
  }

  function play(name) {
    if (muted) return;
    const cue = CUES[name];
    if (!cue) return;
    const [file, volume, minGap, drift] = cue;

    const now = Date.now();
    if (lastPlayed[name] && now - lastPlayed[name] < minGap) return;
    lastPlayed[name] = now;

    const c = ensureContext();
    if (!c) return;
    if (c.state === "suspended") c.resume();

    const buf = buffers[file];
    if (!buf) {
      loadCue(file); // أول مرة: نحمّله للمرة الجاية بدل ما نأخّر اللعب
      return;
    }

    const src = c.createBufferSource();
    src.buffer = buf;
    if (drift) src.playbackRate.value = 1 + (Math.random() * 2 - 1) * drift;
    const gain = c.createGain();
    gain.gain.value = volume;
    src.connect(gain);
    gain.connect(master);
    src.start(0);
  }

  function setMuted(v) {
    muted = !!v;
    writeMuted(muted);
  }

  // ===== زر الكتم بشريط العنوان =====
  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "theme-toggle-btn";
    btn.setAttribute("aria-label", "تشغيل/كتم الصوت");

    function updateIcon() {
      btn.textContent = muted ? "🔇" : "🔊";
    }
    updateIcon();

    btn.addEventListener("click", () => {
      setMuted(!muted);
      updateIcon();
      if (!muted) {
        unlock();
        play("key");
      }
    });

    // theme.js ينشئ .topbar-actions، وهذا الملف يُحمّل بعده فتكون موجودة.
    // بالصفحات اللي ما فيها شريط عنوان (القائمة الرئيسية) نخليه عائم جنب زر الثيم.
    const actions = document.querySelector(".topbar-actions");
    if (actions) {
      btn.classList.add("theme-toggle-inline");
      actions.insertBefore(btn, actions.firstChild);
    } else {
      btn.classList.add("sound-toggle-floating");
      document.body.appendChild(btn);
    }
  });

  ["pointerdown", "keydown", "touchstart"].forEach((evt) => {
    window.addEventListener(evt, unlock, { once: true, passive: true });
  });

  window.Sound = { play, unlock, setMuted, isMuted: () => muted };
})();
