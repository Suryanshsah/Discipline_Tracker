console.log("Dashboard script loaded");

const USER_ID = "testUser";

function getToday() {
  return new Date().toISOString().split("T")[0];
}

function getMonthInfo() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const days = new Date(year, d.getMonth() + 1, 0).getDate();
  return { year, month, days };
}

const addGoalBtn = document.getElementById("addGoalBtn");

if (addGoalBtn) {
  addGoalBtn.onclick = async () => {
    const title = prompt("Enter your goal");
    if (!title) return;

    await db.collection("goals").add({
      title,
      userId: USER_ID,
      isActive: true,
      createdAt: new Date()
    });

    loadAll();
  };
}

async function getTodayStatus(goalId) {
  const snap = await db
    .collection("checkins")
    .where("goalId", "==", goalId)
    .where("userId", "==", USER_ID)
    .where("date", "==", getToday())
    .limit(1)
    .get();

  return snap.empty ? null : snap.docs[0].data().status;
}

async function saveCheckin(goalId, status) {
  const today = getToday();

  const snap = await db
    .collection("checkins")
    .where("goalId", "==", goalId)
    .where("userId", "==", USER_ID)
    .where("date", "==", today)
    .get();

  if (!snap.empty) return;

  await db.collection("checkins").add({
    goalId,
    userId: USER_ID,
    date: today,
    status
  });

  loadAll();
}

async function calculateProgress(goalId) {
  const { year, month, days } = getMonthInfo();

  const snap = await db
    .collection("checkins")
    .where("goalId", "==", goalId)
    .where("userId", "==", USER_ID)
    .where("status", "==", "yes")
    .get();

  let yes = 0;
  snap.forEach(d => {
    if (d.data().date.startsWith(`${year}-${month}`)) yes++;
  });

  return Math.round((yes / days) * 100);
}

async function loadGoals() {
  const list = document.getElementById("goalsList");
  if (!list) return;

  list.innerHTML = "";

  const snap = await db
    .collection("goals")
    .where("userId", "==", USER_ID)
    .where("isActive", "==", true)
    .get();

  for (const doc of snap.docs) {
    const goalId = doc.id;
    const goal = doc.data();
    const progress = await calculateProgress(goalId);
    const status = await getTodayStatus(goalId);

    let actionHTML = `
      <div class="action-area">
        <button class="yes">✔</button>
        <button class="no">✖</button>
      </div>
    `;

    if (status === "yes") {
      actionHTML = `<div class="status-badge done">Done ✔</div>`;
    }

    if (status === "no") {
      actionHTML = `<div class="status-badge not-done">Not Done ✖</div>`;
    }

    const card = document.createElement("div");
    card.className = "goal-card";
    card.innerHTML = `
      <h4>${goal.title}</h4>
      <div class="progress-wrapper">
        <div class="progress-bar">
          <div class="progress-fill" style="width:${progress}%"></div>
        </div>
        <span class="progress-text">${progress}%</span>
      </div>
      ${actionHTML}
    `;

    list.appendChild(card);

    if (!status) {
      card.querySelector(".yes").onclick = () => saveCheckin(goalId, "yes");
      card.querySelector(".no").onclick = () => saveCheckin(goalId, "no");
    }
  }
}

async function loadGlobalCalendar() {
  const box = document.getElementById("globalCalendar");
  if (!box) return;

  box.innerHTML = "";

  const { year, month, days } = getMonthInfo();

  const goalsSnap = await db
    .collection("goals")
    .where("userId", "==", USER_ID)
    .where("isActive", "==", true)
    .get();

  const totalGoals = goalsSnap.size;
  if (!totalGoals) return;

  const checkinsSnap = await db
    .collection("checkins")
    .where("userId", "==", USER_ID)
    .get();

  const map = {};

  checkinsSnap.forEach(d => {
    const { date, status } = d.data();
    if (status === "yes" && date.startsWith(`${year}-${month}`)) {
      map[date] = (map[date] || 0) + 1;
    }
  });

  for (let i = 1; i <= days; i++) {
    const day = String(i).padStart(2, "0");
    const key = `${year}-${month}-${day}`;
    const yes = map[key] || 0;
    const percent = (yes / totalGoals) * 100;

    const el = document.createElement("div");
    el.className = "global-day";

    if (yes === 0) el.classList.add("empty");
    else if (percent >= 80) el.classList.add("g80");
    else if (percent >= 50) el.classList.add("g50");
    else if (percent >= 30) el.classList.add("g30");
    else el.classList.add("g0");

    box.appendChild(el);
  }
}

async function loadStats() {
  const { year, month, days } = getMonthInfo();

  const goalsSnap = await db
    .collection("goals")
    .where("userId", "==", USER_ID)
    .where("isActive", "==", true)
    .get();

  document.getElementById("statActiveGoals").innerText = goalsSnap.size;

  const checkinsSnap = await db
    .collection("checkins")
    .where("userId", "==", USER_ID)
    .get();

  const daySet = new Set();
  let yes = 0;

  checkinsSnap.forEach(d => {
    const data = d.data();
    if (data.status === "yes" && data.date.startsWith(`${year}-${month}`)) {
      yes++;
      daySet.add(data.date);
    }
  });

  document.getElementById("statDaysCompleted").innerText = daySet.size;

  const rate = Math.round((yes / (goalsSnap.size * days)) * 100) || 0;
  document.getElementById("statCompletionRate").innerText = `${rate}%`;

  const dates = [...daySet].sort();
  let best = 0, cur = 0;

  for (let i = 0; i < dates.length; i++) {
    if (i === 0) cur = 1;
    else {
      const diff =
        (new Date(dates[i]) - new Date(dates[i - 1])) /
        (1000 * 60 * 60 * 24);
      cur = diff === 1 ? cur + 1 : 1;
    }
    best = Math.max(best, cur);
  }

  document.getElementById("statBestStreak").innerText = best;
}

async function loadAll() {
  await loadGoals();
  await loadGlobalCalendar();
  await loadStats();
}

window.addEventListener("load", async () => {
  await loadAll();
});
