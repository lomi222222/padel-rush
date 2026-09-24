#!/usr/bin/env node
// يحفظ محادثات هالمشروع كأرشيف Markdown مقروء وقابل للبحث.
//
// ليش: نصوص الجلسات تقعد بحاوية الجلسة السحابية بس، والحاوية تنمسح مع نهايتها
// أو بعد خمول. الخلاصة محفوظة بـCLAUDE.md ورسائل الـcommit، لكن النقاش نفسه —
// القرارات المرجوع عنها، الأرقام المقيسة، التشخيصات — ما فيه شي يحفظه.
//
// **الأرشيف يروح لمستودع خاص، مو لمستودع اللعبة**: مستودع اللعبة علني وفرع
// العمل نفسه هو اللي ينشره GitHub Pages، فأي ملف بالجذر ينحمّل من الموقع
// مباشرة. وضع المحادثة هناك ينشرها للعالم، وهذا ما ينرجع.
//
//   node tools/archive-chat.js <مسار-مستودع-الأرشيف>
//   node tools/archive-chat.js                       # يطبع الناتج بمجلد مؤقت
//
// نستخرج **نص الحوار فقط**: رسائل المستخدم وردود كلود. نستبعد استدعاءات
// الأدوات ومخرجاتها ومحتويات الملفات واللقطات — أصغر بكثير (‎٠٫٧ ميجا من أصل
// ‎٨٨) وأقل احتمالاً لتسريب شي ما قصدناه.
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const readline = require("readline");
const { execFileSync } = require("child_process");

// مجلد جلسات هذا المشروع يُشتق من مسار العمل (‎/home/user/padel-rush ⇒
// -home-user-padel-rush) — نفس مبدأ tests/_browser.js: لا مسارات مكتوبة بالنص
function sessionsDir() {
  if (process.env.KW_SESSIONS_DIR) return process.env.KW_SESSIONS_DIR;
  const repo = path.resolve(__dirname, "..");
  return path.join(os.homedir(), ".claude", "projects", repo.replace(/\//g, "-"));
}

// كتل يحقنها البرنامج بدور "رسالة مستخدم" وما كتبها إنسان
const STRIP = [
  /<system-reminder>[\s\S]*?<\/system-reminder>/g,
  /<local-command-stdout>[\s\S]*?<\/local-command-stdout>/g,
  /<command-message>[\s\S]*?<\/command-message>/g,
  /<command-name>[\s\S]*?<\/command-name>/g,
  /<command-args>[\s\S]*?<\/command-args>/g,
];

// رسائل آلية تجي بنفس شكل رسالة المستخدم — إشعارات مهام خلفية وتنبيهات النظام
const AUTOMATED = [
  "[SYSTEM NOTIFICATION - NOT USER INPUT]",
  "<task-notification>",
  "Caveat: The messages below were generated",
  "This session is being continued from a previous conversation",
];

// نصوص يكتبها البرنامج عند رفض أداة — مو كلام المستخدم
const DENIAL_BOILERPLATE = [
  "The user doesn't want to proceed with this tool use",
  "[Request interrupted by user",
  "The user doesn't want to take this action",
];

function cleanText(raw) {
  let t = raw || "";
  for (const re of STRIP) t = t.replace(re, "");
  return t.trim();
}

// نص الرسالة سواء جاء نصاً مباشراً أو مصفوفة كتل
function messageText(message) {
  const c = message && message.content;
  if (typeof c === "string") return { text: cleanText(c), images: 0 };
  if (!Array.isArray(c)) return { text: "", images: 0 };
  const text = cleanText(c.filter((b) => b.type === "text").map((b) => b.text).join("\n"));
  const images = c.filter((b) => b.type === "image").length;
  return { text, images };
}

function parseSession(file) {
  return new Promise((resolve) => {
    const turns = [];
    let skipped = 0;
    const rl = readline.createInterface({ input: fs.createReadStream(file) });
    rl.on("line", (line) => {
      if (!line.trim()) return;
      let o;
      try {
        o = JSON.parse(line);
      } catch (e) {
        return;
      }
      if (o.type !== "user" && o.type !== "assistant") return;
      // مسارات الوكلاء الفرعية تتكرر مع المحادثة الأصلية فنتركها
      if (o.isSidechain) return;

      // رفض أداة: المستخدم أحياناً يكتب سبب الرفض، وهالنص ينحفظ **كنتيجة أداة**
      // مو كرسالة. لولا هالفرع نخسر بالضبط اللحظات اللي يصحّح فيها المسار —
      // وهي أهم ما بالمحادثة
      if (o.type === "user" && o.toolDenialKind) {
        const blocks = Array.isArray(o.message && o.message.content) ? o.message.content : [];
        const said = cleanText(
          blocks.map((b) => (typeof b.content === "string" ? b.content : "")).join("\n")
        );
        if (said && !DENIAL_BOILERPLATE.some((b) => said.includes(b))) {
          turns.push({ who: "user", text: said, images: 0, at: o.timestamp || "", denial: true });
        }
        return;
      }

      const { text, images } = messageText(o.message);
      if (!text && !images) return;
      if (o.type === "user" && AUTOMATED.some((m) => text.includes(m))) {
        skipped++;
        return;
      }
      turns.push({ who: o.type, text, images, at: o.timestamp || "" });
    });
    rl.on("close", () => resolve({ turns, skipped }));
  });
}

const stamp = (iso) => (iso || "").replace("T", " ").slice(0, 16);

function render(sessionId, turns, skipped) {
  const users = turns.filter((t) => t.who === "user").length;
  const bot = turns.length - users;
  const first = stamp(turns[0] && turns[0].at);
  const last = stamp(turns[turns.length - 1] && turns[turns.length - 1].at);

  const out = [
    "# محادثة " + sessionId,
    "",
    "| | |",
    "|---|---|",
    "| من | " + first + " |",
    "| إلى | " + last + " |",
    "| رسائلك | " + users + " |",
    "| ردود كلود | " + bot + " |",
    "",
    "> نص الحوار فقط — استدعاءات الأدوات ومخرجاتها واللقطات مستبعدة عمداً." +
      (skipped ? " (وتُخطّيت " + skipped + " رسالة آلية.)" : ""),
    "",
    "---",
    "",
  ];

  for (const t of turns) {
    out.push(
      "### " + (t.who === "user" ? "أنت" : "كلود") + " · " + stamp(t.at) +
        (t.denial ? " · (رفض أداة)" : "")
    );
    out.push("");
    if (t.images) out.push("_[" + t.images + " صورة مرفقة]_", "");
    if (t.text) out.push(t.text, "");
  }
  return out.join("\n");
}

(async () => {
  const dir = sessionsDir();
  if (!fs.existsSync(dir)) {
    console.error("‼️  ما انلقى مجلد الجلسات: " + dir);
    process.exit(1);
  }
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
  if (!files.length) {
    console.error("‼️  ما فيه جلسات بـ" + dir);
    process.exit(1);
  }

  const target = process.argv[2];
  const outRoot = target || fs.mkdtempSync(path.join(os.tmpdir(), "saydha-archive-"));
  const sessionsOut = path.join(outRoot, "sessions");
  fs.mkdirSync(sessionsOut, { recursive: true });

  const index = [];
  for (const f of files) {
    const id = path.basename(f, ".jsonl");
    const { turns, skipped } = await parseSession(path.join(dir, f));
    if (!turns.length) continue;
    const day = stamp(turns[0].at).slice(0, 10) || "بلا-تاريخ";
    // ملف لكل جلسة: إعادة التشغيل تحدّث ملف الجلسة الحالية بس، فالأرشيف تراكمي
    // بطبيعته وما يصير فيه تعارض مع الجلسات القديمة
    const name = day + "-" + id.slice(0, 8) + ".md";
    const body = render(id, turns, skipped);
    fs.writeFileSync(path.join(sessionsOut, name), body);
    const users = turns.filter((t) => t.who === "user").length;
    index.push({ name, day, users, bot: turns.length - users, kb: Math.round(Buffer.byteLength(body) / 1024) });
    console.log("‣ " + name + "  رسائلك=" + users + "  ردود=" + (turns.length - users) + "  " + Math.round(Buffer.byteLength(body) / 1024) + "ك");
  }

  index.sort((a, b) => a.name.localeCompare(b.name));
  fs.writeFileSync(
    path.join(outRoot, "INDEX.md"),
    [
      "# أرشيف محادثات «صيدها»",
      "",
      "يتجدد بـ`node tools/archive-chat.js <مسار-هذا-المستودع>` من مستودع اللعبة.",
      "",
      "| الجلسة | التاريخ | رسائلك | ردود كلود | الحجم |",
      "|---|---|---|---|---|",
      ...index.map((r) => `| [${r.name}](sessions/${r.name}) | ${r.day} | ${r.users} | ${r.bot} | ${r.kb}ك |`),
      "",
    ].join("\n")
  );

  const isRepo = target && fs.existsSync(path.join(outRoot, ".git"));
  if (!isRepo) {
    console.log("\n✅ الأرشيف بـ" + outRoot + (target ? " (مو مستودع git — ما دفعنا)" : ""));
    return;
  }

  const git = (...args) => execFileSync("git", args, { cwd: outRoot, encoding: "utf8" });
  git("add", "-A");
  if (!git("status", "--porcelain").trim()) {
    console.log("\n✅ ما فيه جديد — الأرشيف محدّث");
    return;
  }
  git("commit", "-m", "archive chat through " + new Date().toISOString().slice(0, 10));
  git("push");
  console.log("\n✅ اندفع الأرشيف");
})();
