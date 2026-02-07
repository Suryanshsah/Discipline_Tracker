console.log("Dashboard loaded");

const USER_ID = "testUser";


function getToday() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getYesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getDaysInCurrentMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}

async function loadStreak() {
  const el = document.getElementById("currentStreak");
  if (!el) return;

  const doc = await db.collection("users").doc(USER_ID).get();
  el.innerText = `${doc.exists ? doc.data().streak || 0 : 0} 🔥`;
}

async function getTodayStatus(goalId) {
  const today = getToday();

  const snap = await db
    .collection("checkins")
    .where("goalId", "==", goalId)
    .where("userId", "==", USER_ID)
    .where("date", "==", today)
    .limit(1)
    .get();

  if (snap.empty) return null;
  return snap.docs[0].data().status;
}

document.getElementById("addGoalBtn")?.addEventListener("click", async () => {
  const title = prompt("Enter your goal");
  if (!title) return;

  await db.collection("goals").add({
    title,
    userId: USER_ID,
    startDate: new Date(),
    isActive: true
  });

  loadGoals();
});

async function renderCalendar(goalId, container) {
  container.innerHTML = "";

  const daysInMonth = getDaysInCurrentMonth();
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");

  const snap = await db
    .collection("checkins")
    .where("goalId", "==", goalId)
    .where("userId", "==", USER_ID)
    .get();

  const map = {};
  snap.forEach(doc => {
    const { date, status } = doc.data();
    map[date] = status;
  });

  for (let day = 1; day <= daysInMonth; day++) {
    const d = String(day).padStart(2, "0");
    const key = `${year}-${month}-${d}`;

    const box = document.createElement("div");
    box.className = "day-box";

    if (map[key] === "yes") box.classList.add("yes");
    if (map[key] === "no") box.classList.add("no");

    box.innerHTML = `<span>${day}</span>`;
    container.appendChild(box);
  }
}

async function loadGoals() {
  const list = document.getElementById("goalsList");
  const countEl = document.getElementById("activeGoals");
  list.innerHTML = "";

  let count = 0;

  const snap = await db
    .collection("goals")
    .where("userId", "==", USER_ID)
    .where("isActive", "==", true)
    .get();

  for (const doc of snap.docs) {
    count++;
    const goalId = doc.id;
    const goal = doc.data();

    const card = document.createElement("div");
    card.className = "goal-card";

    card.innerHTML = `
      <div class="goal-header">
        <h4>${goal.title}</h4>
      </div>
      <div class="actions">
        <button class="yes">✔</button>
        <button class="no">✖</button>
      </div>
      <div class="calendar hidden"></div>
    `;

    const yesBtn = card.querySelector(".yes");
    const noBtn = card.querySelector(".no");
    const calendar = card.querySelector(".calendar");
    const header = card.querySelector(".goal-header");

    yesBtn.onclick = () => saveCheckin(goalId, "yes", yesBtn, noBtn);
    noBtn.onclick = () => saveCheckin(goalId, "no", yesBtn, noBtn);

    const todayStatus = await getTodayStatus(goalId);
    if (todayStatus) {
      yesBtn.disabled = true;
      noBtn.disabled = true;

      if (todayStatus === "yes") {
        yesBtn.innerText = "Done ✔";
        noBtn.innerText = "—";
      } else {
        noBtn.innerText = "Not Done ✖";
        yesBtn.innerText = "—";
      }
    }

    header.onclick = async () => {
      calendar.classList.toggle("hidden");
      if (!calendar.classList.contains("hidden")) {
        await renderCalendar(goalId, calendar);
      }
    };

    list.appendChild(card);
  }

  countEl.innerText = count;
}

async function saveCheckin(goalId, status, yesBtn, noBtn) {
  const today = getToday();
  const yesterday = getYesterday();

  yesBtn.disabled = true;
  noBtn.disabled = true;

  try {
    await db.collection("checkins").add({
      goalId,
      userId: USER_ID,
      date: today,
      status
    });

    const userRef = db.collection("users").doc(USER_ID);
    const userDoc = await userRef.get();

    let streak = userDoc.exists ? userDoc.data().streak || 0 : 0;
    let lastDate = userDoc.exists ? userDoc.data().lastCheckinDate || "" : "";

    const yesTodaySnap = await db
      .collection("checkins")
      .where("userId", "==", USER_ID)
      .where("date", "==", today)
      .where("status", "==", "yes")
      .get();

    const hasAnyYesToday = !yesTodaySnap.empty;

    if (hasAnyYesToday) {
      if (lastDate === today) {
  
      } else if (lastDate === yesterday) {
        streak += 1;
      } else {
        streak = 1;
      }
    } else {
      streak = 0;
    }

    await userRef.set(
      {
        streak,
        lastCheckinDate: today
      },
      { merge: true }
    );

    document.getElementById("currentStreak").innerText = `${streak} 🔥`;

    if (status === "yes") {
      yesBtn.innerText = "Done ✔";
      noBtn.innerText = "—";
    } else {
      noBtn.innerText = "Not Done ✖";
      yesBtn.innerText = "—";
    }

  } catch (err) {
    console.error(err);
    yesBtn.disabled = false;
    noBtn.disabled = false;
  }
}

loadGoals();
loadStreak();
const startBtn = document.getElementById("startBtn");

if (startBtn) {
  startBtn.addEventListener("click", () => {
    window.location.href = "dashboard.html";
  });
}

