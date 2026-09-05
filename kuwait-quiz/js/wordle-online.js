// الوضع الأونلاين للعبة "احزر الكلمة".
//
// المعمارية: جهاز الهوست هو السيرفر. هو وحده اللي يمسك الكلمة السرية وكيس الكلمات
// ويقيّم التخمينات ويحسب النقاط، وينشر "حالة عامة منقّحة" ما فيها الجواب. أجهزة
// اللاعبين ترسم من هالحالة وترسل نوايا فقط (الحروف اللي كتبوها / إرسال / تلميح).
(function () {
  "use strict";

  const Core = window.WordleCore;
  const View = window.WordleView;

  const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // بدون الحروف الملتبسة
  const HEARTBEAT_MS = 10000;
  const OFFLINE_AFTER_MS = 30000;

  // ===== الهوية =====
  function randomId(len, alphabet) {
    const chars = alphabet || "abcdefghijklmnopqrstuvwxyz0123456789";
    let out = "";
    for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  }

  function storedPlayerId() {
    // ?pid= يسمح بفتح أكثر من لاعب على نفس الجهاز/المتصفح (تجربة أو اختبار)
    const forced = new URLSearchParams(location.search).get("pid");
    if (forced) return forced;
    try {
      let id = localStorage.getItem("kw-online-player");
      if (!id) {
        id = randomId(12);
        localStorage.setItem("kw-online-player", id);
      }
      return id;
    } catch (e) {
      return randomId(12);
    }
  }

  const playerId = storedPlayerId();

  // ===== حالة عامة للصفحة =====
  let transport = null;
  let roomCode = null;
  let isHost = false;
  let myName = "";
  let players = {};
  let pub = null;
  // العقدة السريعة (rooms/<code>/live): فيها currentGuess و ack بس. منفصلة عن state
  // لأن مستمع value على عقدة أب ينزّل العقدة كاملة مع أي تغيير جواها — فلو خليناهم
  // مع بعض، كل ضغطة حرف تنزّل ~١.٥ كيلو على كل جهاز بدال ~٤٥ بايت
  let live = null;
  // نبدأ من الوقت الحالي عشان الترقيم يظل تصاعدي حتى لو اللاعب حدّث الصفحة، وإلا
  // الهوست بيتجاهل إدخالاته لأن رقمها أصغر من آخر رقم عالجه له
  let mySeq = Date.now();
  let localBuffer = [];
  let heartbeatTimer = null;
  let unsubscribers = [];
  let lastPlayersSignature = "";
  let lastKeyboardSignature = "";
  let lastScoreboardSignature = "";

  // حالة الهوست الخاصة (ما تُنشر أبداً كاملة)
  let hostState = null;
  let lastSeqByPlayer = {};

  // ===== عناصر DOM =====
  const el = (id) => document.getElementById(id);

  const statusEl = el("online-status");
  const homeScreen = el("online-home");
  const lobbyScreen = el("online-lobby");
  const playScreen = el("online-play");
  const endScreen = el("online-end");

  const nameInput = el("online-name-input");
  const createBtn = el("online-create-btn");
  const codeInput = el("online-code-input");
  const joinBtn = el("online-join-btn");
  const homeErrorEl = el("online-home-error");
  const dividerEl = document.querySelector(".online-divider");

  const roomCodeEl = el("online-room-code");
  const copyBtn = el("online-copy-btn");
  const waBtn = el("online-wa-btn");
  const playersEl = el("online-players");
  const teamPickBtns = Array.from(document.querySelectorAll(".online-team-pick"));
  const hostControlsEl = el("online-host-controls");
  const autoAssignBtn = el("online-auto-assign-btn");
  const team1Input = el("online-team1-input");
  const team2Input = el("online-team2-input");
  const catAllCheckbox = el("online-cat-all");
  const catListEl = el("online-category-list");
  const lobbyErrorEl = el("online-lobby-error");
  const startBtn = el("online-start-btn");
  const waitHostEl = el("online-wait-host");

  const scoreboardEl = el("online-scoreboard");
  const endMatchBtn = el("online-end-match-btn");
  const activeCategoriesEl = el("online-active-categories");
  const subtitleEl = el("online-subtitle");
  const turnNoteEl = el("online-turn-note");
  const gridEl = el("online-grid");
  const hintCategoryBtn = el("online-hint-category-btn");
  const hintRepeatBtn = el("online-hint-repeat-btn");
  const hintLetterBtn = el("online-hint-letter-btn");
  const hintLogEl = el("online-hint-log");
  const messageEl = el("online-message");
  const keyboardEl = el("online-keyboard");
  const roundEndEl = el("online-round-end");
  const nextTeamBtn = el("online-next-team-btn");
  const roundEndWaitEl = el("online-round-end-wait");
  const roundTimeSelect = el("online-round-time");
  const roundTimeCustom = el("online-round-time-custom");
  const roundTimeHint = el("online-round-time-hint");
  const timerEl = el("online-timer");
  const boqBtn = el("online-boq-btn");
  const stealNoteEl = el("online-steal-note");

  let selectedCategories = new Set(Core.SELECTABLE_CATEGORIES);
  let tickTimer = null; // عدّاد العرض عند الجميع
  let hostClockTimer = null; // عدّاد الهوست اللي يحسم انتهاء الوقت

  Core.ROUND_TIME_OPTIONS.forEach((opt) => {
    const o = document.createElement("option");
    o.value = String(opt.value);
    o.textContent = opt.label;
    roundTimeSelect.appendChild(o);
  });

  roundTimeSelect.addEventListener("change", () => {
    const custom = Number(roundTimeSelect.value) === Core.CUSTOM_TIME;
    roundTimeCustom.classList.toggle("hidden", !custom);
    roundTimeHint.classList.toggle("hidden", !custom);
    if (custom) roundTimeCustom.focus();
  });

  // ===== أدوات عامة =====
  function showScreen(which) {
    [homeScreen, lobbyScreen, playScreen, endScreen].forEach((s) => s.classList.add("hidden"));
    which.classList.remove("hidden");
  }

  function showStatus(text, kind) {
    if (!text) {
      statusEl.classList.add("hidden");
      return;
    }
    statusEl.textContent = text;
    statusEl.className = "online-status" + (kind ? " " + kind : "");
  }

  function showError(target, text) {
    if (!text) {
      target.classList.add("hidden");
      return;
    }
    target.textContent = text;
    target.classList.remove("hidden");
  }

  function roomRef(sub) {
    return transport.ref("rooms/" + roomCode + (sub ? "/" + sub : ""));
  }

  function joinUrl() {
    const url = new URL(location.href);
    url.searchParams.set("room", roomCode);
    return url.toString();
  }

  function cleanupSubs() {
    unsubscribers.forEach((fn) => {
      try {
        fn();
      } catch (e) {}
    });
    unsubscribers = [];
  }

  // ===== تهيئة النقل =====
  function initTransport() {
    const t = window.Net.create();
    if (!t || t.error) {
      const reason =
        !t || t.error === "config-missing"
          ? "اللعب الأونلاين محتاج إعداد Firebase أول (ملف js/firebase-config.js لسه فاضي)."
          : t.error === "sdk-missing"
          ? "ما قدرنا نحمّل مكتبة الاتصال. تأكد من الإنترنت وأعد تحميل الصفحة."
          : "ما قدرنا نبدأ الاتصال بالخادم.";
      showStatus(reason, "error");
      createBtn.disabled = true;
      joinBtn.disabled = true;
      return false;
    }
    transport = t;
    if (transport.onConnectionChange) {
      transport.onConnectionChange((connected) => {
        if (roomCode) showStatus(connected ? "" : "انقطع الاتصال… نحاول نرجع", "error");
      });
    }
    return true;
  }

  // ===== شاشة البداية =====
  const urlRoom = (new URLSearchParams(location.search).get("room") || "").toUpperCase();

  function setupHomeScreen() {
    if (urlRoom) {
      // جاي من رابط دعوة: نخفي إنشاء الغرفة ونخليه يكتب اسمه بس
      createBtn.classList.add("hidden");
      if (dividerEl) dividerEl.classList.add("hidden");
      codeInput.value = urlRoom;
      codeInput.classList.add("hidden");
      joinBtn.textContent = "دخول الغرفة " + urlRoom;
      joinBtn.classList.remove("btn-outline");
      joinBtn.classList.add("btn-primary");
    }
    try {
      nameInput.value = localStorage.getItem("kw-online-name") || "";
    } catch (e) {}
    nameInput.focus();
  }

  function readName() {
    const name = nameInput.value.trim();
    if (!name) {
      showError(homeErrorEl, "اكتب اسمك أول");
      return null;
    }
    try {
      localStorage.setItem("kw-online-name", name);
    } catch (e) {}
    return name;
  }

  createBtn.addEventListener("click", async () => {
    const name = readName();
    if (!name) return;
    myName = name;
    isHost = true;
    roomCode = randomId(4, CODE_ALPHABET);

    await roomRef("meta").set({
      hostId: playerId,
      createdAt: Date.now(),
      status: "lobby",
    });
    await roomRef("config").set({
      team1Name: "",
      team2Name: "",
    });
    await roomRef("players/" + playerId).set({
      name: myName,
      team: 0,
      isHost: true,
      lastSeen: Date.now(),
    });

    initHostEngine();
    enterRoom();
  });

  joinBtn.addEventListener("click", async () => {
    const name = readName();
    if (!name) return;
    const code = (urlRoom || codeInput.value.trim()).toUpperCase();
    if (code.length !== 4) {
      showError(homeErrorEl, "رمز الغرفة لازم يكون ٤ خانات");
      return;
    }
    myName = name;
    roomCode = code;

    const meta = await roomRef("meta").get();
    if (!meta) {
      roomCode = null;
      showError(homeErrorEl, "ما لقينا غرفة بهذا الرمز. تأكد من الرمز أو اطلب رابط جديد.");
      return;
    }
    isHost = meta.hostId === playerId;

    const existing = await roomRef("players/" + playerId).get();
    await roomRef("players/" + playerId).set({
      name: myName,
      team: existing && typeof existing.team === "number" ? existing.team : null,
      isHost: isHost,
      lastSeen: Date.now(),
    });

    if (isHost) initHostEngine();
    enterRoom();
  });

  // ===== الدخول للغرفة =====
  function enterRoom() {
    showError(homeErrorEl, "");
    roomCodeEl.textContent = roomCode;
    waBtn.href = "https://wa.me/?text=" + encodeURIComponent("تعال العب وياي 🔤 " + joinUrl());

    hostControlsEl.classList.toggle("hidden", !isHost);
    waitHostEl.classList.toggle("hidden", isHost);
    endMatchBtn.classList.toggle("hidden", !isHost);

    if (isHost) {
      renderCategoryChecklist();
    }

    unsubscribers.push(
      roomRef("players").on((val) => {
        players = val || {};
        if (isHost && hostState) hostState.players = players;
        // نبضات lastSeen تجي كل ١٠ ثواني من كل جهاز. لو أعدنا الرسم معها، الكيبورد
        // ينبني من جديد وممكن تضيع ضغطة اللاعب اللي صادفت لحظة البناء — فما نعيد
        // الرسم إلا لو تغيّر شي فعلاً (اسم أو فريق أو لاعب جديد).
        const sig = playersSignature();
        if (sig === lastPlayersSignature) return;
        lastPlayersSignature = sig;
        renderCurrent();
      })
    );
    unsubscribers.push(
      roomRef("state").on((val) => {
        pub = val;
        adoptServerBuffer();
        renderCurrent();
      })
    );
    // العقدة السريعة: توصل مع كل ضغطة حرف، فما نعيد رسم الصفحة كاملة — الشبكة بس
    unsubscribers.push(
      roomRef("live").on((val) => {
        live = val;
        adoptServerBuffer();
        redrawGridOnly();
      })
    );
    unsubscribers.push(
      roomRef("config").on((val) => {
        const cfg = val || {};
        if (!isHost) {
          if (cfg.team1Name !== undefined) team1Input.value = cfg.team1Name || "";
          if (cfg.team2Name !== undefined) team2Input.value = cfg.team2Name || "";
        }
        updateTeamPickLabels(cfg);
      })
    );

    if (isHost) {
      unsubscribers.push(
        roomRef("inputs").on((val) => {
          if (!val) return;
          Object.keys(val).forEach((pid) => processInput(pid, val[pid]));
        })
      );
    }

    startHeartbeat();
    // renderCurrent مو showScreen(lobbyScreen): اللاعب اللي يدش ومباراة شغالة لازم
    // يوصل لشاشة اللعب مباشرة بدل ما يعلق باللوبي
    renderCurrent();
  }

  function startHeartbeat() {
    const beat = () => {
      if (!roomCode) return;
      roomRef("players/" + playerId + "/lastSeen").set(Date.now());
    };
    beat();
    heartbeatTimer = setInterval(beat, HEARTBEAT_MS);
    window.addEventListener("beforeunload", () => clearInterval(heartbeatTimer));
  }

  // ===== اللوبي =====
  function teamNames(cfg) {
    const c = cfg || {};
    return [c.team1Name || Core.defaultTeamName(0), c.team2Name || Core.defaultTeamName(1)];
  }

  function updateTeamPickLabels(cfg) {
    const names = teamNames(cfg);
    teamPickBtns.forEach((btn) => {
      const t = Number(btn.dataset.team);
      btn.textContent = names[t];
      btn.style.borderColor = Core.TEAM_COLORS[t];
      const me = players[playerId];
      const mine = me && me.team === t;
      btn.classList.toggle("selected", !!mine);
    });
  }

  teamPickBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      roomRef("players/" + playerId + "/team").set(Number(btn.dataset.team));
    });
  });

  // بصمة تتجاهل lastSeen — تتغيّر بس لو دخل/طلع لاعب أو تغيّر اسمه أو فريقه
  function playersSignature() {
    return Object.keys(players)
      .sort()
      .map((pid) => {
        const p = players[pid] || {};
        return pid + ":" + p.name + ":" + p.team + ":" + !!p.isHost;
      })
      .join("|");
  }

  function sortedPlayerIds() {
    return Object.keys(players).sort((a, b) => {
      const pa = players[a] || {};
      const pb = players[b] || {};
      if (!!pb.isHost !== !!pa.isHost) return pb.isHost ? 1 : -1;
      return String(pa.name || "").localeCompare(String(pb.name || ""), "ar");
    });
  }

  function renderLobby() {
    const now = Date.now();
    const cfg = { team1Name: team1Input.value, team2Name: team2Input.value };
    const names = teamNames(cfg);

    playersEl.innerHTML = "";
    sortedPlayerIds().forEach((pid) => {
      const p = players[pid] || {};
      const row = document.createElement("div");
      row.className = "online-player-row";
      if (typeof p.team === "number") row.style.borderRightColor = Core.TEAM_COLORS[p.team];

      const nameEl = document.createElement("span");
      nameEl.className = "online-player-name";
      nameEl.textContent = p.name || "لاعب";
      if (p.isHost) nameEl.textContent += " 👑";
      if (pid === playerId) nameEl.textContent += " (أنت)";

      const badge = document.createElement("span");
      badge.className = "online-team-badge";
      if (typeof p.team === "number") {
        badge.textContent = names[p.team];
        badge.style.background = Core.TEAM_COLORS[p.team];
      } else {
        badge.textContent = "بدون فريق";
        badge.classList.add("none");
      }

      row.appendChild(nameEl);

      if (p.lastSeen && now - p.lastSeen > OFFLINE_AFTER_MS) {
        const off = document.createElement("span");
        off.className = "online-offline-dot";
        off.textContent = "غير متصل";
        row.appendChild(off);
      }

      row.appendChild(badge);

      if (isHost) {
        // الهوست يقدر يبدّل فريق أي لاعب بالضغط على الصف
        row.classList.add("clickable");
        row.addEventListener("click", () => {
          const cur = players[pid] ? players[pid].team : null;
          const next = cur === 0 ? 1 : cur === 1 ? null : 0;
          roomRef("players/" + pid + "/team").set(next);
        });
      }

      playersEl.appendChild(row);
    });

    updateTeamPickLabels(cfg);
  }

  function renderCategoryChecklist() {
    View.renderCategoryChecklist(catListEl, selectedCategories, (next) => {
      selectedCategories = next;
      syncAllCheckbox();
      renderCategoryChecklist();
    });
  }

  function syncAllCheckbox() {
    catAllCheckbox.checked =
      selectedCategories.size === Core.SELECTABLE_CATEGORIES.length && !Core.hasExclusive(selectedCategories);
  }

  catAllCheckbox.addEventListener("change", () => {
    selectedCategories = new Set(catAllCheckbox.checked ? Core.SELECTABLE_CATEGORIES : []);
    renderCategoryChecklist();
  });

  [team1Input, team2Input].forEach((input) => {
    input.addEventListener("change", () => {
      if (!isHost) return;
      roomRef("config").update({
        team1Name: team1Input.value.trim(),
        team2Name: team2Input.value.trim(),
      });
    });
  });

  autoAssignBtn.addEventListener("click", () => {
    const ids = Core.shuffle(Object.keys(players).slice());
    ids.forEach((pid, i) => {
      roomRef("players/" + pid + "/team").set(i % 2);
    });
  });

  startBtn.addEventListener("click", () => {
    const counts = [0, 0];
    Object.keys(players).forEach((pid) => {
      const t = players[pid] && players[pid].team;
      if (t === 0 || t === 1) counts[t]++;
    });
    if (counts[0] === 0 || counts[1] === 0) {
      showError(lobbyErrorEl, "لازم يكون في لاعب واحد على الأقل بكل فريق قبل البدء");
      return;
    }
    if (selectedCategories.size === 0) {
      showError(lobbyErrorEl, "اختر فئة واحدة على الأقل قبل البدء");
      return;
    }
    showError(lobbyErrorEl, "");
    hostStartMatch();
  });

  // ===== محرّك الهوست =====
  function initHostEngine() {
    hostState = {
      phase: "lobby",
      // رقم الجولة الداخلي: يزيد مع كل جولة يديدة، وينكتب بالعقدتين عشان الجهاز
      // يعرف إن الـlive اللي وصله يخص نفس الجولة اللي عنده وإلا يتجاهله
      rev: 0,
      teams: [],
      teamIndex: 0,
      roundsPlayed: [0, 0],
      matchOver: false,
      bag: null,
      target: "",
      targetChars: [],
      spaceIndexes: [],
      wordLength: 0,
      maxAttempts: 0,
      category: "",
      currentGuess: [],
      guesses: [],
      keyStatus: {},
      hints: Core.newHints(),
      hintLog: [],
      gameOver: false,
      message: { text: "", kind: "" },
      ack: null,
      roundNumber: 1,
      players: {},
      boqLeft: [Core.BOQ_PER_TEAM, Core.BOQ_PER_TEAM],
      steal: null,
      roundSeconds: 0,
      deadline: null,
      pausedRemainingMs: null,
    };
    lastSeqByPlayer = {};
  }

  function hostWaitingTeam() {
    return (hostState.teamIndex + 1) % 2;
  }

  function hostOwnAttemptCount() {
    return hostState.guesses.filter((g) => !g.steal).length;
  }

  // ===== ساعة الهوست =====
  function hostStopClock() {
    clearInterval(hostClockTimer);
    hostClockTimer = null;
  }

  function hostStartClock() {
    hostStopClock();
    if (!hostState.deadline) return;
    hostClockTimer = setInterval(() => {
      const h = hostState;
      if (h.pausedRemainingMs != null || !h.deadline) return;
      if (Date.now() >= h.deadline) {
        hostStopClock();
        hostTimeUp();
      }
    }, 500);
  }

  function hostTimeUp() {
    const h = hostState;
    if (h.gameOver || h.phase !== "playing") return;
    h.gameOver = true;
    h.steal = null;
    h.deadline = null;
    h.message = { text: "⏰ انتهى الوقت! الكلمة كانت: " + h.target + " (٠ نقطة)", kind: "lose" };
    hostResolveRoundEnd();
  }

  function hostStartMatch() {
    hostState.teams = [
      {
        name: team1Input.value.trim() || Core.defaultTeamName(0),
        color: Core.TEAM_COLORS[0],
        score: 0,
      },
      {
        name: team2Input.value.trim() || Core.defaultTeamName(1),
        color: Core.TEAM_COLORS[1],
        score: 0,
      },
    ];
    hostState.teamIndex = 0;
    hostState.roundsPlayed = [0, 0];
    hostState.matchOver = false;
    hostState.phase = "playing";
    hostState.target = "";
    hostState.bag = Core.makeWordBag(selectedCategories);
    hostState.bag.refill();
    hostState.categoriesLabel = Core.categoriesLabel(selectedCategories);
    hostState.boqLeft = [Core.BOQ_PER_TEAM, Core.BOQ_PER_TEAM];
    hostState.roundSeconds = Core.readRoundSeconds(roundTimeSelect, roundTimeCustom);

    roomRef("meta/status").set("playing");
    hostStartRound();
  }

  function hostStartRound() {
    hostState.rev++;
    const entry = hostState.bag.pick(hostState.target);
    hostState.target = entry.word;
    hostState.category = entry.category;
    hostState.targetChars = Array.from(entry.word);
    hostState.spaceIndexes = Core.spaceIndexesOf(hostState.targetChars);
    hostState.wordLength = hostState.targetChars.length;
    hostState.maxAttempts = Core.attemptsForLength(hostState.wordLength);

    hostState.currentGuess = [];
    Core.autoFillSpaces(hostState.currentGuess, hostState.wordLength, hostState.spaceIndexes);
    hostState.guesses = [];
    hostState.keyStatus = {};
    hostState.hints = Core.newHints();
    hostState.hintLog = [];
    hostState.gameOver = false;
    hostState.message = { text: "", kind: "" };
    hostState.ack = null;
    hostState.roundNumber = hostState.roundsPlayed[hostState.teamIndex] + 1;
    hostState.steal = null;
    hostState.pausedRemainingMs = null;
    hostState.deadline = hostState.roundSeconds ? Date.now() + hostState.roundSeconds * 1000 : null;
    hostStartClock();

    publishState();
  }

  // ===== النشر =====
  // العقدة البطيئة: كل شي يتغيّر مرة بالتخمين أو بالجولة، مو مع كل ضغطة حرف
  function buildState() {
    const h = hostState;
    return {
      rev: h.rev,
      phase: h.phase,
      teams: h.teams,
      teamIndex: h.teamIndex,
      roundsPlayed: h.roundsPlayed,
      matchOver: h.matchOver,
      categoriesLabel: h.categoriesLabel || "",
      round: {
        wordLength: h.wordLength,
        maxAttempts: h.maxAttempts,
        spaceIndexes: h.spaceIndexes,
        guesses: h.guesses,
        keyStatus: h.keyStatus,
        hintLog: h.hintLog,
        hints: h.hints,
        gameOver: h.gameOver,
        message: h.message,
        roundNumber: h.roundNumber,
        subtitle: h.teams.length
          ? Core.roundSubtitle(h.teams[h.teamIndex].name, h.roundNumber, h.wordLength, h.maxAttempts, h.spaceIndexes)
          : "",
        // الكلمة ما تنكشف إلا بعد نهاية الجولة
        revealedWord: h.gameOver ? h.target : null,
        // السرقة والمؤقّت — deadline ختم زمني مطلق فاللاعبون يعدّون محلياً بدون
        // كتابة كل ثانية على الشبكة
        steal: h.steal,
        boqLeft: h.boqLeft,
        deadline: h.deadline,
        pausedRemainingMs: h.pausedRemainingMs,
      },
    };
  }

  // العقدة السريعة: هذي اللي تنكتب مع كل ضغطة حرف — ولا شي فيها غير الحروف والإيصال
  function buildLive() {
    const h = hostState;
    return { rev: h.rev, currentGuess: h.currentGuess, ack: h.ack };
  }

  // تغيّر بطيء: نكتب العقدتين بكتابة ذرّية وحدة عشان ما تنفصل الحالة عن الحروف
  function publishState() {
    roomRef().update({ state: buildState(), live: buildLive() });
  }

  // تغيّر سريع (ضغطة حرف): العقدة الصغيرة بس
  function publishLive() {
    roomRef("live").set(buildLive());
  }

  // يعيد بناء المخزن المؤقت من الحروف اللي وصلت، ويتجاهل أي شي غير صالح، ويحط
  // المسافات بمكانها — عشان ما نثق بأي شي يجي من جهاز اللاعب
  function sanitizeBuffer(buf) {
    const letters = (buf || []).filter(
      (c) => typeof c === "string" && Core.ARABIC_LETTER_RE.test(c)
    );
    const out = [];
    Core.autoFillSpaces(out, hostState.wordLength, hostState.spaceIndexes);
    for (const ch of letters) {
      if (out.length >= hostState.wordLength) break;
      out.push(ch);
      Core.autoFillSpaces(out, hostState.wordLength, hostState.spaceIndexes);
    }
    return out;
  }

  function processInput(pid, input) {
    if (!input || typeof input.seq !== "number") return;
    if (input.seq <= (lastSeqByPlayer[pid] || 0)) return;
    lastSeqByPlayer[pid] = input.seq;

    if (hostState.phase !== "playing" || hostState.gameOver) return;
    const player = players[pid];
    if (!player) return;

    // البوق: يطلبه لاعب من الفريق المنتظر فقط، ولمّا ما فيه سرقة جارية
    if (input.action === "boq") {
      if (hostState.steal) return;
      const w = hostWaitingTeam();
      if (player.team !== w) return;
      if (hostState.boqLeft[w] <= 0) return;
      hostStartSteal(w);
      return;
    }

    // اللي يكتب لازم يكون: صاحب الدور، أو الفريق السارق لو فيه سرقة جارية
    const allowedTeam = hostState.steal ? hostState.steal.team : hostState.teamIndex;
    if (player.team !== allowedTeam) return;

    if (input.action === "buffer" || input.action === "submit") {
      hostState.currentGuess = sanitizeBuffer(input.buffer);
    }
    hostState.ack = { pid: pid, seq: input.seq };

    if (input.action === "submit") {
      hostSubmitGuess();
      return;
    }
    if (input.action === "hint") {
      // ما فيه تلميحات أثناء السرقة
      if (hostState.steal) return publishState();
      hostApplyHint(input.hint);
      return;
    }
    // ضغطة حرف: ما تغيّر غير currentGuess و ack، فنكتفي بالعقدة الصغيرة
    publishLive();
  }

  function hostStartSteal(teamIdx) {
    const h = hostState;
    h.boqLeft[teamIdx]--;
    // القيمة تتثبّت الحين: نفس النقاط اللي كان بياخذها الفريق الأصلي لو حزر بهاللحظة
    h.steal = {
      team: teamIdx,
      attemptsLeft: Core.BOQ_ATTEMPTS,
      value: Core.finalScoreForAttempt(hostOwnAttemptCount() + 1, h.maxAttempts, h.hints),
    };
    h.currentGuess = [];
    Core.autoFillSpaces(h.currentGuess, h.wordLength, h.spaceIndexes);
    h.ack = null;
    h.message = { text: "", kind: "" };
    // نوقف المؤقّت طول السرقة
    if (h.deadline) h.pausedRemainingMs = Math.max(0, h.deadline - Date.now());
    publishState();
  }

  function hostApplyHint(kind) {
    const h = hostState;
    if (kind === "category") {
      if (h.hints.categoryUsed) return publishState();
      h.hints.categoryUsed = true;
      h.hintLog.push("💡 الفئة: " + h.category);
    } else if (kind === "repeat") {
      if (h.hints.repeatUsed) return publishState();
      h.hints.repeatUsed = true;
      h.hintLog.push(Core.repeatHintText(h.targetChars));
    } else if (kind === "letter") {
      if (Core.allLettersKnown(h.targetChars, h.keyStatus)) return publishState();
      const hint = Core.revealLetterHint(h.targetChars, h.keyStatus);
      if (!hint) return publishState();
      h.hints.revealLetterUses++;
      h.keyStatus[hint.letter] = hint.status;
      h.hintLog.push(hint.text);
    }
    publishState();
  }

  function hostSubmitGuess() {
    const h = hostState;
    if (h.currentGuess.length < h.wordLength) {
      h.message = { text: "أدخل " + Core.toArabicDigits(h.wordLength) + " أحرف أولاً", kind: "" };
      publishState();
      return;
    }

    const statuses = Core.evaluateGuess(h.currentGuess, h.targetChars);
    const attemptNumber = hostOwnAttemptCount() + 1;
    h.guesses.push({ chars: h.currentGuess.slice(), statuses, steal: !!h.steal });
    Core.mergeKeyStatus(h.keyStatus, h.currentGuess, statuses);

    const won = statuses.every((s) => s === "green");
    h.currentGuess = [];
    Core.autoFillSpaces(h.currentGuess, h.wordLength, h.spaceIndexes);

    // ===== مسار السرقة =====
    if (h.steal) {
      if (won) {
        h.gameOver = true;
        const stealingTeam = h.steal.team;
        const earned = h.steal.value;
        h.teams[stealingTeam].score += earned;
        h.message = {
          text: "🥷 سرقها " + h.teams[stealingTeam].name + "! ربحوا " + Core.toArabicDigits(earned) + " نقطة",
          kind: "win",
        };
        h.steal = null;
        h.deadline = null;
        h.pausedRemainingMs = null;
        hostStopClock();
        hostResolveRoundEnd();
        return;
      }

      h.steal.attemptsLeft--;
      if (h.steal.attemptsLeft > 0) {
        h.message = { text: "🥷 باقي محاولة وحدة للسرقة", kind: "" };
        publishState();
        return;
      }

      // فشلت السرقة: يرجع الدور للفريق الأصلي بمحاولاته كاملة والمؤقّت يكمل
      h.steal = null;
      if (h.pausedRemainingMs != null) {
        h.deadline = Date.now() + h.pausedRemainingMs;
        h.pausedRemainingMs = null;
        hostStartClock();
      }
      h.message = { text: "🥷 راحت عليهم! يكمل " + h.teams[h.teamIndex].name, kind: "" };
      publishState();
      return;
    }

    if (won) {
      h.gameOver = true;
      const earned = Core.finalScoreForAttempt(attemptNumber, h.maxAttempts, h.hints);
      h.teams[h.teamIndex].score += earned;
      h.message = {
        text:
          "🎉 أحسنت يا " + h.teams[h.teamIndex].name + "! ربحتوا " + Core.toArabicDigits(earned) + " نقطة",
        kind: "win",
      };
      hostStopClock();
      h.deadline = null;
      hostResolveRoundEnd();
      return;
    }

    if (hostOwnAttemptCount() >= h.maxAttempts) {
      h.gameOver = true;
      h.message = { text: "😔 انتهت المحاولات! الكلمة كانت: " + h.target + " (٠ نقطة)", kind: "lose" };
      hostStopClock();
      h.deadline = null;
      hostResolveRoundEnd();
      return;
    }

    h.message = { text: "", kind: "" };
    publishState();
  }

  function hostResolveRoundEnd() {
    const h = hostState;
    hostStopClock();
    h.deadline = null;
    h.pausedRemainingMs = null;
    h.roundsPlayed[h.teamIndex]++;
    h.matchOver = h.roundsPlayed.every((r) => r >= Core.ROUNDS_PER_TEAM);
    publishState();
  }

  nextTeamBtn.addEventListener("click", () => {
    if (!isHost || !hostState) return;
    if (hostState.matchOver) {
      hostEndMatch();
      return;
    }
    hostState.teamIndex = (hostState.teamIndex + 1) % 2;
    hostStartRound();
  });

  endMatchBtn.addEventListener("click", () => {
    if (!isHost || !hostState) return;
    hostEndMatch();
  });

  function hostEndMatch() {
    hostState.phase = "ended";
    hostState.gameOver = true;
    publishState();
    roomRef("meta/status").set("ended");
  }

  function hostAdjustScore(i, delta) {
    if (!isHost || !hostState) return;
    hostState.teams[i].score = Math.max(0, hostState.teams[i].score + delta);
    publishState();
  }

  // ===== إدخال اللاعب =====
  function myTeam() {
    const me = players[playerId];
    return me && typeof me.team === "number" ? me.team : null;
  }

  // أثناء السرقة اللي يكتب هو الفريق السارق، وغير كذا صاحب الدور
  function isMyTurn() {
    if (!pub || pub.phase !== "playing") return false;
    const r = pub.round || {};
    if (r.gameOver) return false;
    const allowedTeam = r.steal ? r.steal.team : pub.teamIndex;
    return myTeam() === allowedTeam;
  }

  // البوق متاح للفريق المنتظر لما ما فيه سرقة جارية وباقي له بوقات
  function canBoq() {
    if (!pub || pub.phase !== "playing") return false;
    const r = pub.round || {};
    if (r.gameOver || r.steal) return false;
    const mine = myTeam();
    if (mine === null || mine === pub.teamIndex) return false;
    const left = (r.boqLeft || [0, 0])[mine];
    return left > 0;
  }

  boqBtn.addEventListener("click", () => {
    if (!canBoq()) return;
    sendInput("boq");
  });

  function adoptServerBuffer() {
    if (!pub || !pub.round || !live) return;
    // العقدتين توصل كل وحدة بحدها، فلو الـlive من جولة سابقة نتجاهله لين يوصل اللي بعده
    if (live.rev !== pub.rev) return;
    const ack = live.ack || null;
    // لو آخر إدخال عالجه الهوست هو إدخالي وأنا كتبت بعده، نخلي المحلي عشان ما ترجع
    // الحروف اللي كتبتها للحين ما وصلت
    if (ack && ack.pid === playerId && ack.seq < mySeq) return;
    localBuffer = (live.currentGuess || []).slice();
  }

  function sendInput(action, extra) {
    mySeq++;
    const payload = Object.assign(
      { seq: mySeq, action: action, buffer: localBuffer.slice(), ts: Date.now() },
      extra || {}
    );
    roomRef("inputs/" + playerId).set(payload);
  }

  function handleKey(key) {
    if (!isMyTurn()) return;
    const r = pub.round || {};

    if (key === "ENTER") {
      if (localBuffer.length < r.wordLength) {
        View.showMessage(messageEl, "أدخل " + Core.toArabicDigits(r.wordLength) + " أحرف أولاً", "");
        return;
      }
      sendInput("submit");
      return;
    }
    if (key === "DEL") {
      localBuffer.pop();
      renderPlay();
      sendInput("buffer");
      return;
    }
    if (Core.ARABIC_LETTER_RE.test(key) && localBuffer.length < r.wordLength) {
      localBuffer.push(key);
      Core.autoFillSpaces(localBuffer, r.wordLength, r.spaceIndexes || []);
      renderPlay();
      sendInput("buffer");
    }
  }

  [
    [hintCategoryBtn, "category"],
    [hintRepeatBtn, "repeat"],
    [hintLetterBtn, "letter"],
  ].forEach(([btn, kind]) => {
    btn.addEventListener("click", () => {
      if (btn.disabled || !isMyTurn()) return;
      sendInput("hint", { hint: kind });
    });
  });

  document.addEventListener("keydown", (e) => {
    if (playScreen.classList.contains("hidden") || !isMyTurn()) return;
    if (e.key === "Enter") handleKey("ENTER");
    else if (e.key === "Backspace") handleKey("DEL");
    else if (e.key === " ") e.preventDefault();
    else if (Core.ARABIC_LETTER_RE.test(e.key)) handleKey(e.key);
  });

  // عدّاد العرض عند الجميع — يقرأ من deadline المنشور فما فيه أي كتابة على الشبكة
  function startTicking() {
    const r = (pub && pub.round) || {};
    const paused = r.pausedRemainingMs != null;
    if (!r.deadline || paused || r.gameOver) {
      clearInterval(tickTimer);
      tickTimer = null;
      return;
    }
    if (tickTimer) return;
    tickTimer = setInterval(() => {
      const rr = (pub && pub.round) || {};
      if (!rr.deadline || rr.pausedRemainingMs != null || rr.gameOver) {
        clearInterval(tickTimer);
        tickTimer = null;
        return;
      }
      View.renderTimer(timerEl, rr.deadline, null);
    }, 250);
  }

  // ===== الرسم =====
  function renderCurrent() {
    if (!roomCode) return;
    if (!pub || pub.phase === "lobby") {
      renderLobby();
      showScreen(lobbyScreen);
      return;
    }
    if (pub.phase === "ended") {
      renderEnd();
      showScreen(endScreen);
      return;
    }
    renderPlay();
    showScreen(playScreen);
  }

  function drawGrid(r) {
    View.renderGrid(gridEl, {
      guesses: r.guesses || [],
      currentGuess: localBuffer,
      wordLength: r.wordLength,
      maxAttempts: r.maxAttempts,
      spaceIndexes: r.spaceIndexes || [],
      stealActive: !!r.steal,
    });
  }

  // مسار الضغطة: حجم الخلايا ولوحة النتائج والكيبورد كلهم ما يتغيّرون مع الحرف،
  // فما نلمس غير الشبكة
  function redrawGridOnly() {
    if (!pub || !pub.round || pub.phase !== "playing") return;
    if (playScreen.classList.contains("hidden")) return;
    drawGrid(pub.round);
  }

  function renderPlay() {
    if (!pub || !pub.round) return;
    const r = pub.round;
    const teams = pub.teams || [];
    const mine = myTeam();
    const myTurn = isMyTurn();

    const scoreSig = JSON.stringify(teams) + "|" + pub.teamIndex;
    if (scoreSig !== lastScoreboardSignature) {
      lastScoreboardSignature = scoreSig;
      View.renderScoreboard(scoreboardEl, {
        teams: teams,
        teamIndex: pub.teamIndex,
        onAdjust: isHost ? hostAdjustScore : null,
      });
    }

    activeCategoriesEl.textContent = pub.categoriesLabel || "";
    subtitleEl.textContent = r.subtitle || "";

    const activeTeamName = teams[pub.teamIndex] ? teams[pub.teamIndex].name : "";
    if (mine === null) {
      turnNoteEl.textContent = "👀 أنت متفرّج — الهوست يقدر يحطك بفريق";
      turnNoteEl.className = "online-turn-note watching";
    } else if (myTurn) {
      turnNoteEl.textContent = r.steal ? "🥷 دوركم! سرقوا الكلمة" : "✍️ دوركم! اكتبوا الكلمة";
      turnNoteEl.className = "online-turn-note mine";
    } else {
      turnNoteEl.textContent = "👀 دور " + activeTeamName + " — انتظر دورك";
      turnNoteEl.className = "online-turn-note watching";
    }

    // ===== البوق =====
    if (r.steal) {
      boqBtn.classList.add("hidden");
      stealNoteEl.classList.remove("hidden");
      stealNoteEl.textContent =
        "🥷 بوق! دور " +
        (teams[r.steal.team] ? teams[r.steal.team].name : "") +
        " — " +
        Core.stealAttemptsLabel(r.steal.attemptsLeft) +
        " على " +
        Core.toArabicDigits(r.steal.value) +
        " نقطة";
    } else {
      stealNoteEl.classList.add("hidden");
      const showBoq = mine !== null && mine !== pub.teamIndex && !r.gameOver;
      boqBtn.classList.toggle("hidden", !showBoq);
      if (showBoq) {
        const left = (r.boqLeft || [0, 0])[mine];
        boqBtn.disabled = left <= 0;
        boqBtn.textContent = "🥷 بوق (باقي " + Core.toArabicDigits(left) + ")";
      }
    }

    // ===== المؤقّت =====
    View.renderTimer(timerEl, r.deadline || null, r.pausedRemainingMs != null ? r.pausedRemainingMs : null);
    startTicking();

    const stealRows = (r.guesses || []).filter((g) => g && g.steal).length;
    View.applyTileSize(gridEl, {
      wordLength: r.wordLength,
      maxAttempts: r.maxAttempts + stealRows,
      spaceCount: (r.spaceIndexes || []).length,
    });
    drawGrid(r);
    // ما نعيد بناء الكيبورد إلا لو تغيّر تلوينه أو صلاحية الكتابة — إعادة البناء
    // وسط ضغطة اللاعب تضيّع الضغطة
    const keyboardSig = JSON.stringify(r.keyStatus || {}) + "|" + myTurn;
    if (keyboardSig !== lastKeyboardSignature) {
      lastKeyboardSignature = keyboardSig;
      View.renderKeyboard(keyboardEl, {
        keyStatus: r.keyStatus || {},
        onKey: handleKey,
        disabled: !myTurn,
      });
    }
    View.renderHintLog(hintLogEl, r.hintLog || []);
    View.showMessage(messageEl, (r.message && r.message.text) || "", (r.message && r.message.kind) || "");

    // ما فيه تلميحات أثناء السرقة — محاولتين وبس
    const hints = r.hints || Core.newHints();
    const hintsAllowed = myTurn && !r.steal;
    hintCategoryBtn.disabled = !hintsAllowed || hints.categoryUsed;
    hintRepeatBtn.disabled = !hintsAllowed || hints.repeatUsed;
    hintLetterBtn.disabled = !hintsAllowed;

    roundEndEl.classList.toggle("hidden", !r.gameOver);
    nextTeamBtn.classList.toggle("hidden", !isHost);
    roundEndWaitEl.classList.toggle("hidden", isHost);
    nextTeamBtn.textContent = pub.matchOver ? "عرض النتيجة النهائية 🏆" : "دور الفريق التالي 👉";
  }

  function renderEnd() {
    View.renderFinalScores(
      {
        winnerName: el("online-winner-name"),
        winnerScore: el("online-winner-score"),
        finalScores: el("online-final-scores"),
      },
      pub.teams || []
    );
  }

  // ===== البداية =====
  setupHomeScreen();
  initTransport();
})();
