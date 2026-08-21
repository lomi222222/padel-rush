(function () {
  "use strict";

  const TEAM_COLORS = ["#12539f", "#06264a", "#2f8ce0", "#0b3d78"];
  const MAX_TEAMS = 4;
  const MIN_TEAMS = 2;
  const CELLS_PER_CATEGORY = 6; // 2 easy + 2 medium + 2 hard
  const DIFFICULTY_ORDER = ["easy", "easy", "medium", "medium", "hard", "hard"];

  const ABILITIES = [
    { key: "twoGuesses", label: "إجابتين 2️⃣" },
    { key: "choices", label: "الاختيارات 🔀" },
    { key: "firstLetter", label: "الحرف الأول 🔤" },
    { key: "doublePoints", label: "مضاعفة النقاط ✖️2" },
  ];

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function pickRandom(list, n) {
    return shuffle(list).slice(0, n);
  }

  // ===== State =====
  let teamCount = 2;
  let teams = [];
  let pickerIndex = 0; // whose turn it is to pick a category/cell (does not restrict who can answer)
  let board = []; // { cat, diff, points, question, used }
  let cellsUsedCount = 0;
  let totalCells = 0;
  let activeCell = null; // { boardIndex, points, correctAnswer, choicesShuffled, revealedHint, revealedChoices, revealed, doubledByTeam, twoGuessByTeam }

  function defaultTeamName(i) {
    return "الفريق " + ["الأول", "الثاني", "الثالث", "الرابع"][i];
  }

  // ===== Setup screen =====
  const teamCountLabel = document.getElementById("team-count-label");
  const teamSetupList = document.getElementById("team-setup-list");
  const decBtn = document.getElementById("dec-team");
  const incBtn = document.getElementById("inc-team");
  const startBtn = document.getElementById("start-game-btn");

  let teamNameInputs = [];

  function renderTeamSetup() {
    teamCountLabel.textContent = String(teamCount);
    decBtn.disabled = teamCount <= MIN_TEAMS;
    incBtn.disabled = teamCount >= MAX_TEAMS;

    const existingValues = teamNameInputs.map((inp) => inp.value);
    teamSetupList.innerHTML = "";
    teamNameInputs = [];

    for (let i = 0; i < teamCount; i++) {
      const row = document.createElement("div");
      row.className = "team-setup-row";

      const swatch = document.createElement("div");
      swatch.className = "team-swatch";
      swatch.style.background = TEAM_COLORS[i];

      const input = document.createElement("input");
      input.type = "text";
      input.maxLength = 20;
      input.placeholder = defaultTeamName(i);
      input.value = existingValues[i] || "";

      row.appendChild(swatch);
      row.appendChild(input);
      teamSetupList.appendChild(row);
      teamNameInputs.push(input);
    }
  }

  decBtn.addEventListener("click", () => {
    if (teamCount > MIN_TEAMS) {
      teamCount--;
      renderTeamSetup();
    }
  });

  incBtn.addEventListener("click", () => {
    if (teamCount < MAX_TEAMS) {
      teamCount++;
      renderTeamSetup();
    }
  });

  startBtn.addEventListener("click", () => {
    teams = teamNameInputs.map((input, i) => ({
      name: input.value.trim() || defaultTeamName(i),
      color: TEAM_COLORS[i],
      score: 0,
      abilitiesUsed: {
        twoGuesses: false,
        choices: false,
        firstLetter: false,
        doublePoints: false,
      },
    }));
    pickerIndex = 0;
    buildBoard();
    document.getElementById("setup-screen").classList.add("hidden");
    document.getElementById("board-screen").classList.remove("hidden");
    renderScoreboard();
    renderBoard();
  });

  renderTeamSetup();

  // ===== Board building =====
  function buildBoard() {
    board = [];
    CATEGORIES.forEach((category) => {
      const byDiff = { easy: [], medium: [], hard: [] };
      QUESTIONS.forEach((q) => {
        if (q.cat === category.key) byDiff[q.diff].push(q);
      });

      const chosen = [
        ...pickRandom(byDiff.easy, 2),
        ...pickRandom(byDiff.medium, 2),
        ...pickRandom(byDiff.hard, 2),
      ];

      chosen.forEach((question, idx) => {
        const diff = DIFFICULTY_ORDER[idx];
        board.push({
          cat: category.key,
          diff,
          points: POINTS_BY_DIFFICULTY[diff],
          question,
          used: false,
        });
      });
    });
    cellsUsedCount = 0;
    totalCells = board.length; // 36
  }

  // ===== Scoreboard =====
  function renderScoreboard() {
    const el = document.getElementById("scoreboard");
    el.innerHTML = "";
    teams.forEach((team, i) => {
      const chip = document.createElement("div");
      chip.className = "team-chip" + (i === pickerIndex ? " current" : "");
      chip.style.background = team.color;

      const name = document.createElement("div");
      name.className = "name";
      name.textContent = team.name;

      const score = document.createElement("div");
      score.className = "score";
      score.textContent = team.score + " نقطة";

      const abilitiesRow = document.createElement("div");
      abilitiesRow.className = "abilities";
      ABILITIES.forEach((a) => {
        const dot = document.createElement("div");
        dot.className = "ability-dot" + (team.abilitiesUsed[a.key] ? " used" : "");
        dot.title = a.label;
        dot.textContent = a.label.slice(0, 1);
        abilitiesRow.appendChild(dot);
      });

      chip.appendChild(name);
      chip.appendChild(score);
      chip.appendChild(abilitiesRow);
      el.appendChild(chip);
    });
  }

  // ===== Board rendering =====
  function renderBoard() {
    const el = document.getElementById("board");
    el.innerHTML = "";

    CATEGORIES.forEach((category) => {
      const header = document.createElement("div");
      header.className = "cat-header";
      const icon = document.createElement("div");
      icon.className = "icon";
      icon.textContent = category.icon;
      const label = document.createElement("div");
      label.textContent = category.name;
      header.appendChild(icon);
      header.appendChild(label);
      el.appendChild(header);
    });

    for (let row = 0; row < CELLS_PER_CATEGORY; row++) {
      CATEGORIES.forEach((category, colIdx) => {
        const boardIndex = colIdx * CELLS_PER_CATEGORY + row;
        const cell = board[boardIndex];
        const btn = document.createElement("button");
        btn.className = "cell-btn";
        btn.textContent = cell.points;
        btn.disabled = cell.used;
        btn.addEventListener("click", () => openQuestion(boardIndex));
        el.appendChild(btn);
      });
    }
  }

  // ===== Question overlay =====
  const overlay = document.getElementById("question-overlay");
  const qPickerEl = document.getElementById("q-picker");
  const qCategoryEl = document.getElementById("q-category");
  const qPointsEl = document.getElementById("q-points");
  const qTextEl = document.getElementById("q-text");
  const qHintEl = document.getElementById("q-hint");
  const qChoicesEl = document.getElementById("q-choices");
  const qTeamAbilitiesEl = document.getElementById("q-team-abilities");
  const revealBtn = document.getElementById("reveal-btn");
  const qAnswerBox = document.getElementById("q-answer-box");
  const qAnswerText = document.getElementById("q-answer-text");
  const qWinnerButtonsEl = document.getElementById("q-winner-buttons");

  function categoryName(key) {
    const c = CATEGORIES.find((x) => x.key === key);
    return c ? c.icon + " " + c.name : key;
  }

  function openQuestion(boardIndex) {
    const cell = board[boardIndex];
    activeCell = {
      boardIndex,
      points: cell.points,
      correctAnswer: cell.question.choices[0],
      choicesShuffled: shuffle(cell.question.choices),
      revealedHint: false,
      revealedChoices: false,
      revealed: false,
      doubledByTeam: null,
      twoGuessByTeam: null,
    };
    renderQuestionOverlay(cell);
    overlay.classList.remove("hidden");
  }

  function renderQuestionOverlay(cell) {
    const picker = teams[pickerIndex];

    qPickerEl.textContent = "يختار الفئة: " + picker.name;
    qPickerEl.style.background = picker.color;
    qPickerEl.style.color = "#fff";
    qCategoryEl.textContent = categoryName(cell.cat);
    qPointsEl.textContent =
      activeCell.doubledByTeam !== null
        ? activeCell.points * 2 + " نقطة (مضاعفة لفريق " + teams[activeCell.doubledByTeam].name + ")"
        : activeCell.points + " نقطة";
    qTextEl.textContent = cell.question.q;

    // hint
    if (activeCell.revealedHint) {
      qHintEl.classList.remove("hidden");
      qHintEl.textContent = "الحرف الأول: " + activeCell.correctAnswer.trim().charAt(0);
    } else {
      qHintEl.classList.add("hidden");
    }

    // choices
    if (activeCell.revealedChoices) {
      qChoicesEl.classList.remove("hidden");
      qChoicesEl.innerHTML = "";
      activeCell.choicesShuffled.forEach((c) => {
        const div = document.createElement("div");
        div.className = "choice-item";
        div.textContent = c;
        qChoicesEl.appendChild(div);
      });
    } else {
      qChoicesEl.classList.add("hidden");
    }

    renderTeamAbilities();

    // reveal / answer box
    if (activeCell.revealed) {
      revealBtn.classList.add("hidden");
      qAnswerBox.classList.remove("hidden");
      qAnswerText.textContent = "الإجابة الصحيحة: " + activeCell.correctAnswer;
      renderWinnerButtons();
    } else {
      revealBtn.classList.remove("hidden");
      qAnswerBox.classList.add("hidden");
    }
  }

  // كل فريق له صف مساعدات خاص به، يمكن لأي فريق استخدام مساعدته الخاصة على أي سؤال
  function renderTeamAbilities() {
    qTeamAbilitiesEl.innerHTML = "";
    teams.forEach((team, ti) => {
      const block = document.createElement("div");
      block.className = "team-ability-block";
      block.style.borderColor = team.color;

      const nameRow = document.createElement("div");
      nameRow.className = "team-ability-name";

      const nameSpan = document.createElement("span");
      nameSpan.textContent = team.name;
      nameRow.appendChild(nameSpan);

      if (activeCell.doubledByTeam === ti) {
        const badge = document.createElement("span");
        badge.className = "ability-active-badge";
        badge.textContent = "✖️2 مفعّلة";
        nameRow.appendChild(badge);
      }
      if (activeCell.twoGuessByTeam === ti) {
        const badge = document.createElement("span");
        badge.className = "ability-active-badge";
        badge.textContent = "2️⃣ إجابتين مفعّلة";
        nameRow.appendChild(badge);
      }

      block.appendChild(nameRow);

      const btnRow = document.createElement("div");
      btnRow.className = "abilities-row";
      ABILITIES.forEach((a) => {
        const btn = document.createElement("button");
        btn.className = "ability-btn";
        btn.textContent = a.label;
        btn.disabled = team.abilitiesUsed[a.key];
        btn.addEventListener("click", () => useAbility(ti, a.key));
        btnRow.appendChild(btn);
      });
      block.appendChild(btnRow);

      qTeamAbilitiesEl.appendChild(block);
    });
  }

  function renderWinnerButtons() {
    qWinnerButtonsEl.innerHTML = "";
    teams.forEach((team, ti) => {
      const btn = document.createElement("button");
      btn.className = "btn winner-team-btn";
      btn.style.background = team.color;
      btn.style.color = "#fff";
      btn.textContent = team.name + " ✅";
      btn.addEventListener("click", () => finalizeCell(ti));
      qWinnerButtonsEl.appendChild(btn);
    });

    const noneBtn = document.createElement("button");
    noneBtn.className = "btn btn-outline winner-team-btn";
    noneBtn.textContent = "لا أحد أجاب صح ❌";
    noneBtn.addEventListener("click", () => finalizeCell(null));
    qWinnerButtonsEl.appendChild(noneBtn);
  }

  function useAbility(teamIndex, key) {
    const team = teams[teamIndex];
    if (team.abilitiesUsed[key]) return;
    team.abilitiesUsed[key] = true;

    if (key === "twoGuesses") activeCell.twoGuessByTeam = teamIndex;
    if (key === "choices") activeCell.revealedChoices = true;
    if (key === "firstLetter") activeCell.revealedHint = true;
    if (key === "doublePoints") activeCell.doubledByTeam = teamIndex;

    renderQuestionOverlay(board[activeCell.boardIndex]);
    renderScoreboard();
  }

  revealBtn.addEventListener("click", () => {
    activeCell.revealed = true;
    renderQuestionOverlay(board[activeCell.boardIndex]);
  });

  function finalizeCell(winnerIndex) {
    const cell = board[activeCell.boardIndex];

    if (winnerIndex !== null) {
      const winner = teams[winnerIndex];
      const pts = activeCell.points * (activeCell.doubledByTeam === winnerIndex ? 2 : 1);
      winner.score += pts;
    }

    cell.used = true;
    cellsUsedCount++;
    pickerIndex = (pickerIndex + 1) % teams.length;
    activeCell = null;

    overlay.classList.add("hidden");
    renderScoreboard();
    renderBoard();

    if (cellsUsedCount >= totalCells) {
      showEndScreen();
    }
  }

  // ===== End screen =====
  function showEndScreen() {
    document.getElementById("board-screen").classList.add("hidden");
    document.getElementById("end-screen").classList.remove("hidden");

    const sorted = teams.slice().sort((a, b) => b.score - a.score);
    const topScore = sorted[0].score;
    const winners = sorted.filter((t) => t.score === topScore);

    const winnerNameEl = document.getElementById("winner-name");
    const winnerScoreEl = document.getElementById("winner-score");
    if (winners.length > 1) {
      winnerNameEl.textContent = "🏆 تعادل بين: " + winners.map((w) => w.name).join(" و ");
    } else {
      winnerNameEl.textContent = "🏆 الفريق الفائز: " + winners[0].name;
    }
    winnerScoreEl.textContent = "بمجموع " + topScore + " نقطة";

    const finalScoresEl = document.getElementById("final-scores");
    finalScoresEl.innerHTML = "";
    sorted.forEach((team, i) => {
      const row = document.createElement("div");
      row.className = "final-score-row" + (i === 0 ? " first" : "");
      row.innerHTML =
        '<span>' + (i + 1) + ". " + team.name + "</span><span>" + team.score + " نقطة</span>";
      finalScoresEl.appendChild(row);
    });
  }

  document.getElementById("restart-btn").addEventListener("click", () => {
    document.getElementById("end-screen").classList.add("hidden");
    document.getElementById("setup-screen").classList.remove("hidden");
    teamNameInputs.forEach((inp) => (inp.value = ""));
  });
})();
