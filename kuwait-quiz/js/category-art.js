// رسومات بطاقات الفئات بشاشة الإعداد.
//
// **قاعدة ثابتة: بلا ذوات أرواح** — لا وجوه ولا عيون حيّة ولا أشخاص ولا حيوانات
// (قرار صاحب المشروع). «حيوان» أثر قدم، «أسماء» ظل بلا ملامح، «لاعبين» قميص،
// «أنميات» روبوت (الآلة ما فيها روح).
//
// نوعان من الرسم:
// - LAYERED: رموز بطبقات على شبكة 48، ولونها من الوضع: base كحلي متدرّج، accent
//   ذهبي معدني، knock فتحات بلون شريط البطاقة. بالداكن الكحلي ينقلب فاتح عشان
//   ينقرأ — نفس منطق باقي الواجهة.
// - RICH: أجسام «واقعية» مرسومة يدوياً بخاماتها. ألوانها ثابتة بالوضعين (الجسم
//   الحقيقي ما ينقلب لونه)، والظل بس يتغيّر.
//
// **بلا أي نص داخل الرسمة** (لا <title> ولا <text>): اختبارات كثيرة تلقى الفئة
// بمقارنة نص البطاقة حرفياً، وأي حرف زايد يكسرها.
(function () {
  "use strict";

  // نجمة بعدد رؤوس n حول (cx,cy) — للكأس والدرع
  function star(cx, cy, n, R, r, rot) {
    const pts = [];
    for (let i = 0; i < n * 2; i++) {
      const a = ((rot || -90) + (i * 180) / n) * (Math.PI / 180);
      const rad = i % 2 ? r : R;
      pts.push((cx + rad * Math.cos(a)).toFixed(2) + " " + (cy + rad * Math.sin(a)).toFixed(2));
    }
    return '<path d="M' + pts.join("L") + 'Z"/>';
  }

  // كل رمز = طبقات مرتّبة [دور، رسم]
  const LAYERED = {
    دولة: [
      ["base", '<circle cx="22" cy="21" r="13"/>'],
      ["knock", '<ellipse cx="22" cy="21" rx="5.6" ry="13" fill="none" stroke-width="2.6"/>' +
        '<path d="M9 21h26" fill="none" stroke-width="2.6"/>'],
      ["accent", '<path d="M9.27 33.73A18 18 0 0 0 34.73 8.27" fill="none" stroke-width="3" stroke-linecap="round"/>' +
        '<path d="M22 39v3" fill="none" stroke-width="3"/>' +
        '<rect x="15" y="41.5" width="14" height="3.5" rx="1.75"/>'],
    ],

    تاريخ: [
      // مخطوطة ملفوفة — «تاريخ» بلا عمود إغريقي
      ["base", '<rect x="12" y="10" width="24" height="28"/>'],
      ["knock", '<path d="M17 17.5h14M17 23h14M17 28.5h9" fill="none" stroke-width="2.4" stroke-linecap="round"/>'],
      ["accent", '<rect x="8.5" y="6" width="31" height="6.5" rx="3.25"/>' +
        '<rect x="8.5" y="35.5" width="31" height="6.5" rx="3.25"/>'],
    ],

    حيوان: [
      // أثر قدم — رمز الحيوان بلا صورة كائن
      ["base", '<path d="M24 23c-5.6 0-11.5 7.2-11.5 11.8 0 3.6 2.9 5.7 6.2 5.7 2.1 0 3.4-1 5.3-1s3.2 1 5.3 1c3.3 0 6.2-2.1 6.2-5.7C35.5 30.2 29.6 23 24 23Z"/>' +
        '<ellipse cx="11.6" cy="21.5" rx="3.7" ry="4.6" transform="rotate(-22 11.6 21.5)"/>' +
        '<ellipse cx="18.8" cy="12.8" rx="3.9" ry="5" transform="rotate(-8 18.8 12.8)"/>' +
        '<ellipse cx="29.2" cy="12.8" rx="3.9" ry="5" transform="rotate(8 29.2 12.8)"/>' +
        '<ellipse cx="36.4" cy="21.5" rx="3.7" ry="4.6" transform="rotate(22 36.4 21.5)"/>'],
    ],

    طعام: [
      ["base", '<circle cx="24" cy="24" r="11.2"/>'],
      ["knock", '<circle cx="24" cy="24" r="7.4" fill="none" stroke-width="1.8"/>'],
      ["accent",
        // شوكة
        '<path d="M6.5 8v6.5M9 8v6.5M11.5 8v6.5M6.5 14.5a2.5 2.5 0 0 0 5 0" fill="none" stroke-width="1.8" stroke-linecap="round"/>' +
        '<rect x="7.8" y="16" width="2.4" height="24" rx="1.2"/>' +
        // سكين
        '<path d="M37 8.5c2.8.6 4.5 4 4.5 9.5v6.5H37Z"/>' +
        '<rect x="37" y="23.5" width="3.2" height="16.5" rx="1.6"/>'],
    ],

    مهنة: [
      ["accent", '<path d="M18 13.5v-3.2A2.8 2.8 0 0 1 20.8 7.5h6.4a2.8 2.8 0 0 1 2.8 2.8v3.2" fill="none" stroke-width="3"/>'],
      ["base", '<rect x="6.5" y="13" width="35" height="26.5" rx="4.5"/>'],
      ["knock", '<path d="M6.5 24.5h35" fill="none" stroke-width="2.2"/>'],
      ["accent", '<rect x="20.5" y="21" width="7" height="7" rx="1.6"/>'],
    ],

    مكان: [
      ["accent", '<ellipse cx="24" cy="41.5" rx="9.5" ry="2.8"/>'],
      ["base", '<path d="M24 41S11.5 29.5 11.5 20a12.5 12.5 0 0 1 25 0C36.5 29.5 24 41 24 41Z"/>'],
      ["knock", '<circle cx="24" cy="20" r="5"/>'],
    ],

    عام: [
      ["accent", '<path d="M24 3.5v4M10.2 9.2l2.8 2.8M37.8 9.2 35 12M5 22h4M39 22h4" fill="none" stroke-width="2.6" stroke-linecap="round"/>'],
      ["base", '<path d="M24 11a11 11 0 0 0-6.6 19.8c1.3 1 2.1 2.4 2.1 4V35.5h9v-.7c0-1.6.8-3 2.1-4A11 11 0 0 0 24 11Z"/>' +
        '<rect x="19.5" y="37" width="9" height="3" rx="1.2"/><rect x="21" y="41.2" width="6" height="2.6" rx="1.3"/>'],
      // فتيل متموّج — شكل ٧ كان ينقرأ ✓
      ["knock", '<path d="M20.2 27c1.25-2.2 2.55-2.2 3.8 0s2.55 2.2 3.8 0" fill="none" stroke-width="2" stroke-linecap="round"/>'],
    ],

    مسلسلات: [
      ["base", '<rect x="5" y="8.5" width="38" height="26" rx="4.5"/>'],
      ["accent", '<path d="M24 34.5v5M17 41h14" fill="none" stroke-width="3" stroke-linecap="round"/>' +
        '<path d="M20.5 15.5v12.5l10.5-6.25Z" stroke-width="1.6" stroke-linejoin="round"/>'],
    ],

    "كرتون قديم": [
      ["accent", '<path d="M16.5 4.5 24 11.5l8-8" fill="none" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>'],
      ["base", '<rect x="5.5" y="11.5" width="37" height="27" rx="6"/>' +
        '<path d="M12 38.5v3.5M36 38.5v3.5" fill="none" stroke-width="3" stroke-linecap="round"/>'],
      ["knock", '<rect x="9.5" y="15.5" width="22" height="19" rx="5"/>'],
      ["accent", '<circle cx="36.5" cy="20.5" r="2.4"/><circle cx="36.5" cy="28" r="2.4"/>'],
    ],

    روايات: [
      ["base", '<path d="M23 13c-4.2-2.8-10.2-3.6-17.5-2.8v27.3c7.3-.8 13.3 0 17.5 2.8Z"/>' +
        '<path d="M25 13c4.2-2.8 10.2-3.6 17.5-2.8v27.3c-7.3-.8-13.3 0-17.5 2.8Z"/>'],
      ["knock", '<path d="M9.5 16.5c3.3-.3 6.5 0 9.5 1M9.5 22c3.3-.3 6.5 0 9.5 1M9.5 27.5c3.3-.3 6.5 0 9.5 1" fill="none" stroke-width="1.7" stroke-linecap="round"/>' +
        '<path d="M29 17.5c3-1 6.2-1.3 9.5-1M29 23c3-1 6.2-1.3 9.5-1" fill="none" stroke-width="1.7" stroke-linecap="round"/>'],
      ["accent", '<path d="M31 9.6v13l2.6-2.2 2.6 2.2V9.3" stroke-width="0.8" stroke-linejoin="round"/>'],
    ],

    رياضة: [
      ["base", '<path d="M21.5 26h5v6.5h-5Z"/><rect x="17" y="32" width="14" height="3" rx="1"/>' +
        '<rect x="13" y="35" width="22" height="6.5" rx="2"/>'],
      ["accent", '<path d="M14 7h20v10a10 10 0 0 1-20 0Z"/>' +
        '<path d="M14 10H9.5v3.5a6 6 0 0 0 6 6M34 10h4.5v3.5a6 6 0 0 1-6 6" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'],
      ["knock", star(24, 14.8, 5, 4.6, 2) +
        '<path d="M18.5 38.25h11" fill="none" stroke-width="1.8" stroke-linecap="round"/>'],
    ],

    ألوان: [
      ["base", '<path d="M24 7C13.5 7 6 14 6 23.5 6 32.5 13 40 22 40c3 0 4.5-1.6 4.5-3.8 0-1.2-.6-2.1-.6-3.2 0-1.8 1.4-3 3.2-3H34c5 0 8-3 8-8C42 13.5 34 7 24 7Z"/>'],
      ["accent", '<circle cx="14.5" cy="20.5" r="3"/><circle cx="31.5" cy="15.5" r="3"/>'],
      ["knock", '<circle cx="22.5" cy="14" r="3"/><circle cx="14" cy="29.5" r="3"/>'],
    ],

    "مناطق الكويت": [
      // أبراج الكويت — معلم، مو كائن. الكرات صافية بلا أشرطة (كانت تبان برجر)
      ["base", '<path d="M17 3v39M29.5 20v22" fill="none" stroke-width="3" stroke-linecap="round"/>' +
        '<path d="M38 12v30" fill="none" stroke-width="2.2" stroke-linecap="round"/>' +
        '<rect x="8" y="41.5" width="35" height="3" rx="1.5"/>'],
      ["accent", '<circle cx="17" cy="20.5" r="7.4"/><circle cx="17" cy="10" r="3.2"/><circle cx="29.5" cy="26" r="5.2"/>'],
    ],

    سيارات: [
      ["base", '<path d="M5.5 30.5v-5.3c0-1.7 1.1-3.2 2.7-3.7l5.8-2 4.6-6.3A5 5 0 0 1 22.6 11h9a5 5 0 0 1 3.9 1.9l5 6.3 1.4.4a3.8 3.8 0 0 1 2.6 3.6v7.3a2.5 2.5 0 0 1-2.5 2.5H8a2.5 2.5 0 0 1-2.5-2.5Z"/>'],
      ["knock", '<path d="M19.3 19.2l3.4-4.5c.4-.5 1-.8 1.6-.8h2.3v5.3Z"/>' +
        '<path d="M29.4 13.9h2.3c.6 0 1.2.3 1.6.8l3.4 4.5h-7.3Z"/>'],
      ["accent", '<circle cx="15" cy="33" r="5.4"/><circle cx="35" cy="33" r="5.4"/>'],
      ["knock", '<circle cx="15" cy="33" r="2"/><circle cx="35" cy="33" r="2"/>'],
    ],

    "أندية كرة قدم": [
      ["base", '<path d="M24 4.5l15 5.5v11.5c0 10-6.5 17.5-15 21.5C15.5 39 9 31.5 9 21.5V10Z"/>'],
      ["knock", '<path d="M24 9.5l11 4v8c0 7.6-4.8 13.2-11 16.2-6.2-3-11-8.6-11-16.2v-8Z" fill="none" stroke-width="1.8" stroke-linejoin="round"/>'],
      ["accent", star(24, 23, 5, 6.4, 2.8)],
    ],

    "لاعبين كرة قدم": [
      // قميص برقم ١٠ — بلا لاعب. الرقم خطوط مو <text> (النص يكسر الاختبارات)
      ["base", '<path d="M17 6 7 11l3.5 9 4-1.7V42h19V18.3l4 1.7 3.5-9-10-5c-.8 2.8-3.4 4.7-7 4.7S17.8 8.8 17 6Z"/>'],
      ["knock", '<path d="M18 7.5c1.3 2.6 3.4 4 6 4s4.7-1.4 6-4" fill="none" stroke-width="1.8" stroke-linecap="round"/>'],
      ["accent", '<path d="M19.3 23v12.5" fill="none" stroke-width="2.8" stroke-linecap="round"/>' +
        '<ellipse cx="27.8" cy="29.25" rx="3.6" ry="6.25" fill="none" stroke-width="2.8"/>'],
    ],

    "سور القرآن الكريم": [
      // مصحف مفتوح على رحل
      ["accent", '<path d="M14 26.5 34 44M34 26.5 14 44" fill="none" stroke-width="3.2" stroke-linecap="round"/>'],
      ["base", '<path d="M24 14 8 9.5v16L24 30Z"/><path d="M24 14l16-4.5v16L24 30Z"/>'],
      ["knock", '<path d="M24 14v16" fill="none" stroke-width="1.6"/>' +
        '<path d="M11.5 15l9 2.4M11.5 19.5l9 2.4M11.5 24l9 2.4M36.5 15l-9 2.4M36.5 19.5l-9 2.4M36.5 24l-9 2.4" fill="none" stroke-width="1.4" stroke-linecap="round"/>'],
    ],

    ألعاب: [
      ["base", '<path d="M13 15h22a9 9 0 0 1 8.8 7.1l2.3 11a5.4 5.4 0 0 1-9.4 4.5L32.5 33h-17l-4.2 4.6a5.4 5.4 0 0 1-9.4-4.5l2.3-11A9 9 0 0 1 13 15Z"/>'],
      ["knock", '<path d="M13.5 20v9M9 24.5h9" fill="none" stroke-width="3.2" stroke-linecap="round"/>' +
        '<circle cx="31" cy="24.5" r="2.1"/><circle cx="38" cy="24.5" r="2.1"/>'],
      ["accent", '<circle cx="34.5" cy="21" r="2.1"/><circle cx="34.5" cy="28" r="2.1"/>'],
    ],
  };

  const RICH = {
    // رأس روبوت «ميكا»: الروبوت بلا روح. تصميم أصلي بعلامات النوع (قرن V، خوذة
    // معدن، عيون مضيئة، ذقن بفتحات) — مو غاندام ولا غرندايزر، شخصيات محمية
    // والموقع علني
    أنميات:
      '<g class="ca-sh"><g transform="translate(24 24) scale(1.1) translate(-24 -23.5)">' +
      '<path d="M18.5 35H29.5V41.2Q24 43.2 18.5 41.2Z" fill="#0a2143"/>' +
      '<path d="M19 38.2Q24 39.6 29 38.2" fill="none" stroke="#3b5f8f" stroke-width=".6"/>' +
      '<rect x="7.2" y="19.5" width="7" height="14" rx="2.4" fill="url(#ca-navy)" stroke="#041430" stroke-width=".5"/>' +
      '<rect x="33.8" y="19.5" width="7" height="14" rx="2.4" fill="url(#ca-navy)" stroke="#041430" stroke-width=".5"/>' +
      '<path d="M8.8 23.5h3.8M8.8 26.5h3.8M8.8 29.5h3.8M35.4 23.5h3.8M35.4 26.5h3.8M35.4 29.5h3.8" stroke="#8fa9cc" stroke-width=".7" stroke-linecap="round"/>' +
      '<path d="M12.5 34.5V21Q12.5 11.6 24 10.8 35.5 11.6 35.5 21V34.5Z" fill="url(#ca-steel)" stroke="#6b788c" stroke-width=".7"/>' +
      '<path d="M22.4 11.1Q24 9.6 25.6 11.1V16H22.4Z" fill="url(#ca-navy)"/>' +
      '<path d="M12.9 21.2Q24 16.8 35.1 21.2V24Q24 19.8 12.9 24Z" fill="url(#ca-navy)"/>' +
      '<path d="M15.4 23.2Q24 20.2 32.6 23.2L31.2 35.8 24 39.8 16.8 35.8Z" fill="#07142a"/>' +
      '<path d="M16.2 24.1 23 25.1 22.1 28 16.9 26.8ZM31.8 24.1 25 25.1 25.9 28 31.1 26.8Z" fill="#f6c24e" opacity=".35"/>' +
      '<path d="M17 24.8 22.5 25.6 21.8 27.4 17.6 26.4ZM31 24.8 25.5 25.6 26.2 27.4 30.4 26.4Z" fill="url(#ca-eye)"/>' +
      '<path d="M17.6 28.8 24 29.9 30.4 28.8 29.5 35.3 24 38.6 18.5 35.3Z" fill="url(#ca-steel)" stroke="#6b788c" stroke-width=".45"/>' +
      '<path d="M24 30v3" stroke="#8d99ab" stroke-width=".5"/>' +
      '<path d="M20.6 33H27.4L26.6 37.2 24 38.5 21.4 37.2Z" fill="url(#ca-navy)"/>' +
      '<path d="M22.8 34v2.4M25.2 34v2.4" stroke="#9fb6d4" stroke-width=".7" stroke-linecap="round"/>' +
      '<path d="M14.8 19.5Q15.6 13.6 21.6 12.2" fill="none" stroke="#fff" stroke-width="1" stroke-linecap="round" opacity=".9"/>' +
      '<path d="M24 14.6 5.2 3.6 24 16.8Z" fill="#f7dc92"/>' +
      '<path d="M24 16.8 5.2 3.6 24 19Z" fill="#b07d22"/>' +
      '<path d="M24 14.6 42.8 3.6 24 16.8Z" fill="#f2cf78"/>' +
      '<path d="M24 16.8 42.8 3.6 24 19Z" fill="#9a6a18"/>' +
      '<path d="M21.3 14.6H26.7V18.6L24 20.8 21.3 18.6Z" fill="url(#ca-gold-edge)"/>' +
      '<path d="M22.1 15.3H25.9V18.2L24 19.8 22.1 18.2Z" fill="url(#ca-gold)"/>' +
      '<circle cx="24" cy="17.3" r="1.25" fill="#2f68ad"/><circle cx="23.6" cy="16.9" r=".4" fill="#fff"/>' +
      '</g></g>',

    // بطاقة موظف بحبل ومشبك. الصورة ظل بلا ملامح
    أسماء:
      '<g class="ca-sh">' +
      '<path d="M12.5 0 21.8 10M35.5 0 26.2 10" fill="none" stroke="#7a520f" stroke-width="4.4"/>' +
      '<path d="M12.5 0 21.8 10M35.5 0 26.2 10" fill="none" stroke="url(#ca-gold)" stroke-width="3.2"/>' +
      '<rect x="9.5" y="13.5" width="29" height="31" rx="3.2" fill="url(#ca-card)" stroke="#c3cddb" stroke-width=".6"/>' +
      '<path d="M9.5 16.7a3.2 3.2 0 0 1 3.2-3.2h22.6a3.2 3.2 0 0 1 3.2 3.2V21.5H9.5Z" fill="url(#ca-navy)"/>' +
      '<rect x="9.5" y="21.5" width="29" height="1.2" fill="url(#ca-gold)"/>' +
      '<rect x="20" y="15.3" width="8" height="2.1" rx="1.05" fill="#03101f"/>' +
      '<rect x="12.6" y="25" width="10" height="12" rx="1.3" fill="#d6dfeb" stroke="#aebbcd" stroke-width=".5"/>' +
      '<circle cx="17.6" cy="29.3" r="2.5" fill="#1b406f"/>' +
      '<path d="M13.2 37c0-3.4 2-5.2 4.4-5.2s4.4 1.8 4.4 5.2Z" fill="#1b406f"/>' +
      '<rect x="25" y="25.8" width="10.5" height="1.9" rx=".95" fill="#0b2b52"/>' +
      '<rect x="25" y="29.3" width="8" height="1.3" rx=".65" fill="#9aa9bd"/>' +
      '<rect x="25" y="32.2" width="9.5" height="1.3" rx=".65" fill="#9aa9bd"/>' +
      '<rect x="25" y="35.1" width="6" height="1.3" rx=".65" fill="#9aa9bd"/>' +
      '<path d="M13 39.5v3M14.2 39.5v3M15.8 39.5v3M16.7 39.5v3M18.4 39.5v3M20 39.5v3M20.9 39.5v3M22.6 39.5v3M24.4 39.5v3M25.3 39.5v3M27 39.5v3M28.1 39.5v3M29.8 39.5v3M31.4 39.5v3M32.3 39.5v3M34 39.5v3M35 39.5v3" stroke="#0b2b52" stroke-width=".55"/>' +
      '<path d="M14.2 39.5v3M18.4 39.5v3M24.4 39.5v3M29.8 39.5v3M34 39.5v3" stroke="#0b2b52" stroke-width="1.1"/>' +
      '<path d="M26 13.5h7L17 44.5h-7Z" fill="#fff" opacity=".22" clip-path="url(#ca-cardclip)"/>' +
      '<circle cx="24" cy="9.6" r="2.1" fill="none" stroke="#8c6015" stroke-width="1.5"/>' +
      '<circle cx="24" cy="9.6" r="2.1" fill="none" stroke="url(#ca-gold)" stroke-width=".9"/>' +
      '<rect x="21.3" y="11" width="5.4" height="5.6" rx="1.1" fill="url(#ca-gold-edge)"/>' +
      '<rect x="22" y="11.6" width="4" height="3.4" rx=".7" fill="url(#ca-gold)"/>' +
      '</g>',

    // خشبة مسرح كاملة (إطار، ستارة مربوطة، سبوت، ألواح) — الستارة لحالها
    // كانت تنقرأ «شباك»
    مسرحيات:
      '<g class="ca-sh">' +
      '<rect x="2.5" y="3" width="43" height="35" rx="2.5" fill="url(#ca-gold-edge)"/>' +
      '<rect x="3.5" y="4" width="41" height="33" rx="1.8" fill="url(#ca-gold)"/>' +
      '<path d="M6.2 37V13.2Q24 4.6 41.8 13.2V37" fill="none" stroke="#6e4a0e" stroke-width="1.1"/>' +
      '<circle cx="24" cy="6" r="1.5" fill="url(#ca-rivet)" stroke="#6e4a0e" stroke-width=".35"/>' +
      '<path d="M7 37V13.5Q24 5.5 41 13.5V37Z" fill="url(#ca-backdrop)"/>' +
      '<g clip-path="url(#ca-stage)">' +
      '<path d="M21.2 8h5.6L34 37H14Z" fill="url(#ca-beam)"/>' +
      '<ellipse cx="24" cy="36.6" rx="9.5" ry="1.8" fill="#fff4cf" opacity=".4"/>' +
      '<path d="M7 10H18.5C16.6 16.5 12.8 22.8 11.6 26.4 12.4 30 13.9 33.6 15.2 37H7Z" fill="url(#ca-velvet-l)"/>' +
      '<path d="M41 10H29.5C31.4 16.5 35.2 22.8 36.4 26.4 35.6 30 34.1 33.6 32.8 37H41Z" fill="url(#ca-velvet-r)"/>' +
      '<path d="M9.4 10C9.6 19 9.1 24 9.6 37M13.4 10C12.4 17.5 10.8 22.6 10.6 26.4M11.8 27.5C11.4 31 12.2 34.5 13 37" fill="none" stroke="#041430" stroke-width=".7" opacity=".8"/>' +
      '<path d="M38.6 10C38.4 19 38.9 24 38.4 37M34.6 10C35.6 17.5 37.2 22.6 37.4 26.4M36.2 27.5C36.6 31 35.8 34.5 35 37" fill="none" stroke="#041430" stroke-width=".7" opacity=".8"/>' +
      '<path d="M6 7H42V14Q37.7 18.4 33.5 14 29 18.4 24 14 19 18.4 14.5 14 10.3 18.4 6 14Z" fill="url(#ca-valance)"/>' +
      '<path d="M6 14Q10.3 18.4 14.5 14 19 18.4 24 14 29 18.4 33.5 14 37.7 18.4 42 14" fill="none" stroke="url(#ca-gold)" stroke-width="1"/>' +
      '</g>' +
      '<ellipse cx="11.4" cy="26.4" rx="1.9" ry="1.05" fill="url(#ca-gold)" stroke="#6e4a0e" stroke-width=".35"/>' +
      '<ellipse cx="36.6" cy="26.4" rx="1.9" ry="1.05" fill="url(#ca-gold)" stroke="#6e4a0e" stroke-width=".35"/>' +
      '<path d="M3 37H45L43 43H5Z" fill="url(#ca-wood)"/>' +
      '<path d="M11 37 6.4 43M16 37 13.2 43M20 37 18.6 43M24 37V43M28 37 29.4 43M32 37 34.8 43M37 37 41.6 43" stroke="#6f4510" stroke-width=".45" opacity=".75"/>' +
      '<path d="M3 37H45" stroke="#f3d58e" stroke-width=".6"/>' +
      '<rect x="3.5" y="43" width="41" height="2.8" rx=".7" fill="#4f320a"/>' +
      '<path d="M4 43.3H44" stroke="#b07a26" stroke-width=".5"/>' +
      '<g fill="#fff3c4"><circle cx="10" cy="38.4" r="1.6" opacity=".35"/><circle cx="17" cy="38.4" r="1.6" opacity=".35"/><circle cx="31" cy="38.4" r="1.6" opacity=".35"/><circle cx="38" cy="38.4" r="1.6" opacity=".35"/>' +
      '<circle cx="10" cy="38.4" r=".7"/><circle cx="17" cy="38.4" r=".7"/><circle cx="31" cy="38.4" r=".7"/><circle cx="38" cy="38.4" r=".7"/></g>' +
      '</g>',
  };

  // التدرّجات كلها userSpaceOnUse: الخط المستقيم عرض صندوقه صفر، فالتدرّج النسبي
  // (objectBoundingBox) يخليه يختفي. نسختان للكحلي والذهبي والظل (-l/-d)، والـCSS
  // يختار حسب data-theme
  const DEFS =
    '<linearGradient id="ca-ink-l" gradientUnits="userSpaceOnUse" x1="8" y1="4" x2="40" y2="46">' +
    '<stop offset="0" stop-color="#2a5d96"/><stop offset=".55" stop-color="#0b3263"/><stop offset="1" stop-color="#041a36"/></linearGradient>' +
    '<linearGradient id="ca-gold-l" gradientUnits="userSpaceOnUse" x1="6" y1="4" x2="42" y2="44">' +
    '<stop offset="0" stop-color="#f7de98"/><stop offset=".38" stop-color="#dcaa45"/><stop offset=".5" stop-color="#f0cf7c"/>' +
    '<stop offset=".62" stop-color="#c28c27"/><stop offset="1" stop-color="#8c6015"/></linearGradient>' +
    '<filter id="ca-sh-l" x="-20%" y="-20%" width="140%" height="150%">' +
    '<feDropShadow dx="0" dy="2.2" stdDeviation="1.5" flood-color="#06264a" flood-opacity=".32"/></filter>' +
    '<linearGradient id="ca-ink-d" gradientUnits="userSpaceOnUse" x1="8" y1="4" x2="40" y2="46">' +
    '<stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#dfe9f6"/><stop offset="1" stop-color="#aebfd6"/></linearGradient>' +
    '<linearGradient id="ca-gold-d" gradientUnits="userSpaceOnUse" x1="6" y1="4" x2="42" y2="44">' +
    '<stop offset="0" stop-color="#fbe7ad"/><stop offset=".38" stop-color="#e8b957"/><stop offset=".5" stop-color="#f7dc92"/>' +
    '<stop offset=".62" stop-color="#d19b34"/><stop offset="1" stop-color="#9b6c1b"/></linearGradient>' +
    '<filter id="ca-sh-d" x="-20%" y="-20%" width="140%" height="150%">' +
    '<feDropShadow dx="0" dy="2.2" stdDeviation="1.6" flood-color="#000" flood-opacity=".55"/></filter>' +
    `
    <linearGradient id="ca-steel" gradientUnits="userSpaceOnUse" x1="12" y1="10" x2="34" y2="40">
      <stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#e7ecf3"/><stop offset=".8" stop-color="#b8c2d0"/><stop offset="1" stop-color="#8e9aac"/>
    </linearGradient>
    <linearGradient id="ca-eye" gradientUnits="userSpaceOnUse" x1="17" y1="25" x2="22.5" y2="27">
      <stop offset="0" stop-color="#fffbe6"/><stop offset=".5" stop-color="#f7cc5c"/><stop offset="1" stop-color="#d98f1a"/>
    </linearGradient>
    <linearGradient id="ca-gold" gradientUnits="userSpaceOnUse" x1="8" y1="10" x2="40" y2="38">
      <stop offset="0" stop-color="#fbe6a6"/><stop offset=".28" stop-color="#e0b04c"/>
      <stop offset=".46" stop-color="#f6da8e"/><stop offset=".66" stop-color="#c38d2a"/><stop offset="1" stop-color="#94651a"/>
    </linearGradient>
    <linearGradient id="ca-gold-edge" gradientUnits="userSpaceOnUse" x1="8" y1="10" x2="40" y2="38">
      <stop offset="0" stop-color="#c99431"/><stop offset=".5" stop-color="#8e6117"/><stop offset="1" stop-color="#5c3d0b"/>
    </linearGradient>
    <radialGradient id="ca-rivet" cx=".35" cy=".32" r=".75">
      <stop offset="0" stop-color="#fff8dc"/><stop offset=".45" stop-color="#d7a43f"/><stop offset="1" stop-color="#5e400c"/>
    </radialGradient>
    
    <linearGradient id="ca-card" gradientUnits="userSpaceOnUse" x1="0" y1="13" x2="0" y2="45">
      <stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e3e9f1"/>
    </linearGradient>
    <linearGradient id="ca-navy" gradientUnits="userSpaceOnUse" x1="10" y1="12" x2="38" y2="24">
      <stop offset="0" stop-color="#2a5d96"/><stop offset=".6" stop-color="#0b3263"/><stop offset="1" stop-color="#041a36"/>
    </linearGradient>
    <clipPath id="ca-cardclip"><rect x="9.5" y="13.5" width="29" height="31" rx="3.2"/></clipPath>
    
    <radialGradient id="ca-backdrop" gradientUnits="userSpaceOnUse" cx="24" cy="30" r="20">
      <stop offset="0" stop-color="#2b4f80"/><stop offset=".55" stop-color="#0d2446"/><stop offset="1" stop-color="#040d1c"/>
    </radialGradient>
    <linearGradient id="ca-beam" gradientUnits="userSpaceOnUse" x1="0" y1="10" x2="0" y2="37">
      <stop offset="0" stop-color="#fff6d8" stop-opacity=".55"/><stop offset="1" stop-color="#fff6d8" stop-opacity=".08"/>
    </linearGradient>
    <linearGradient id="ca-velvet-l" gradientUnits="userSpaceOnUse" x1="7" y1="0" x2="18.5" y2="0">
      <stop offset="0" stop-color="#051634"/><stop offset=".55" stop-color="#1e5091"/><stop offset=".8" stop-color="#2f68ad"/><stop offset="1" stop-color="#0c2d5c"/>
    </linearGradient>
    <linearGradient id="ca-velvet-r" gradientUnits="userSpaceOnUse" x1="41" y1="0" x2="29.5" y2="0">
      <stop offset="0" stop-color="#051634"/><stop offset=".55" stop-color="#1e5091"/><stop offset=".8" stop-color="#2f68ad"/><stop offset="1" stop-color="#0c2d5c"/>
    </linearGradient>
    <linearGradient id="ca-valance" gradientUnits="userSpaceOnUse" x1="0" y1="8" x2="0" y2="17">
      <stop offset="0" stop-color="#06193a"/><stop offset=".7" stop-color="#1d4b88"/><stop offset="1" stop-color="#0d2d5a"/>
    </linearGradient>
    <linearGradient id="ca-wood" gradientUnits="userSpaceOnUse" x1="0" y1="37" x2="0" y2="43">
      <stop offset="0" stop-color="#c98f38"/><stop offset="1" stop-color="#9c6620"/>
    </linearGradient>
    <clipPath id="ca-stage"><path d="M7 37V13.5Q24 5.5 41 13.5V37Z"/></clipPath>
    `;

  // التعريفات مرة وحدة بالصفحة. **مو display:none** — المتصفح ما يرسم تدرّجاً
  // من svg مخفي، فتطلع الرسومات فاضية
  function ensureDefs() {
    if (document.getElementById("ca-defs")) return;
    const holder = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    holder.id = "ca-defs";
    holder.setAttribute("aria-hidden", "true");
    holder.setAttribute("width", "0");
    holder.setAttribute("height", "0");
    holder.style.position = "absolute";
    holder.innerHTML = "<defs>" + DEFS + "</defs>";
    document.body.appendChild(holder);
  }

  // رسمة الفئة كـSVG نصّي، أو "" لو ما لها رسمة (الاختبار يمسك هالحالة)
  function svg(name) {
    let inner;
    if (RICH[name]) {
      inner = RICH[name];
    } else if (LAYERED[name]) {
      // المجموعة تحدد اللون والعنصر يختار تعبئة أو خط. سُمك الخط صفر افتراضياً
      // عشان الأشكال المصمتة ما تنتفخ بحدّ
      inner =
        '<g class="ca-sh">' +
        LAYERED[name].map(([role, m]) => '<g class="ca-' + role + '" stroke-width="0">' + m + "</g>").join("") +
        "</g>";
    } else {
      return "";
    }
    ensureDefs();
    return '<svg class="ca-svg" viewBox="0 0 48 48" aria-hidden="true" focusable="false">' + inner + "</svg>";
  }

  window.CategoryArt = { svg, ensureDefs };
})();
