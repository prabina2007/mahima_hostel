const API_BASE = window.APP_CONFIG?.API_BASE || "http://localhost:5000/api";

const state = {
  token: localStorage.getItem("studentToken") || "",
  user: null,
  currentMonthDate: new Date(),
  monthMeals: []
};

const els = {
  loader: document.getElementById("loader"),
  toastContainer: document.getElementById("toastContainer"),
  sidebarName: document.getElementById("sidebarName"),
  sidebarRoom: document.getElementById("sidebarRoom"),
  sidebarPref: document.getElementById("sidebarPref"),
  studentAvatar: document.getElementById("studentAvatar"),
  topbarName: document.getElementById("topbarName"),
  heroRoom: document.getElementById("heroRoom"),
  heroPreference: document.getElementById("heroPreference"),
  profileName: document.getElementById("profileName"),
  profileRoom: document.getElementById("profileRoom"),
  profileRoll: document.getElementById("profileRoll"),
  profileEmail: document.getElementById("profileEmail"),
  profilePref: document.getElementById("profilePref"),
  profileCreated: document.getElementById("profileCreated"),
  defaultPreferenceSelect: document.getElementById("defaultPreferenceSelect"),
  saveDefaultPreferenceBtn: document.getElementById("saveDefaultPreferenceBtn"),
  totalMeals: document.getElementById("totalMeals"),
  vegMeals: document.getElementById("vegMeals"),
  nonVegMeals: document.getElementById("nonVegMeals"),
  monthMeals: document.getElementById("monthMeals"),
  totalBill: document.getElementById("totalBill"),
  currentMonthRateLabel: document.getElementById("currentMonthRateLabel"),
  viewBillDetailsBtn: document.getElementById("viewBillDetailsBtn"),
  billDetailsModal: document.getElementById("billDetailsModal"),
  closeBillDetailsBtn: document.getElementById("closeBillDetailsBtn"),
  billDetailsList: document.getElementById("billDetailsList"),
  billModalTotal: document.getElementById("billModalTotal"),
  monthLabel: document.getElementById("monthLabel"),
  calendarGrid: document.getElementById("calendarGrid"),
  monthPreferenceSelect: document.getElementById("monthPreferenceSelect"),
  applyMonthPreferenceBtn: document.getElementById("applyMonthPreferenceBtn"),
  todayLunchStatus: document.getElementById("todayLunchStatus"),
  todayDinnerStatus: document.getElementById("todayDinnerStatus"),
  todayLunchEnabled: document.getElementById("todayLunchEnabled"),
  todayDinnerEnabled: document.getElementById("todayDinnerEnabled"),
  todayLunchType: document.getElementById("todayLunchType"),
  todayDinnerType: document.getElementById("todayDinnerType"),
  saveLunchBtn: document.getElementById("saveLunchBtn"),
  saveDinnerBtn: document.getElementById("saveDinnerBtn"),
  todayResetBtn: document.getElementById("todayResetBtn"),
  prevMonthBtn: document.getElementById("prevMonthBtn"),
  nextMonthBtn: document.getElementById("nextMonthBtn"),
  homeBtn: document.getElementById("homeBtn"),
  topLogoutBtn: document.getElementById("topLogoutBtn"),
  topRefreshBtn: document.getElementById("topRefreshBtn"),
  refreshProfileBtn: document.getElementById("refreshProfileBtn"),
  jumpTodayBtn: document.getElementById("jumpTodayBtn"),
  topSearchInput: document.getElementById("topSearchInput"),
  navLinks: Array.from(document.querySelectorAll(".nav-link"))
};

function showLoader(show) {
  els.loader.classList.toggle("hidden", !show);
}

function toast(message, isError = false) {
  const div = document.createElement("div");
  div.className = "toast";
  div.style.background = isError ? "#a83d3d" : "#1f2f22";
  div.textContent = message;
  els.toastContainer.appendChild(div);
  setTimeout(() => div.remove(), 3200);
}

async function api(path, options = {}) {
  showLoader(true);
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...(state.token ? { Authorization: `Bearer ${state.token}` } : {})
      },
      method: options.method || "GET",
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json") ? await response.json() : null;
    if (!response.ok) throw new Error(data?.message || "Request failed");
    return data;
  } finally {
    showLoader(false);
  }
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function formatMonth(date) {
  return date.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function formatCurrency(value) {
  return `Rs ${Number(value || 0).toFixed(2)}`;
}

function formatMonthKey(monthKeyValue) {
  const parts = String(monthKeyValue || "").split("-");
  if (parts.length !== 2) return monthKeyValue || "-";
  const date = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
  return date.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function openBillModal() {
  if (!els.billDetailsModal) return;
  els.billDetailsModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeBillModal() {
  if (!els.billDetailsModal) return;
  els.billDetailsModal.classList.add("hidden");
  document.body.style.overflow = "";
}

function renderBillBreakdown() {
  if (!els.billDetailsList || !els.billModalTotal) return;
  els.billModalTotal.textContent = formatCurrency(
    state.billBreakdown.reduce((sum, item) => sum + Number(item.bill || 0), 0)
  );
  els.billDetailsList.innerHTML = "";

  if (!state.billBreakdown.length) {
    const empty = document.createElement("div");
    empty.className = "bill-empty-state";
    empty.textContent = "No billed meals available yet for this student account.";
    els.billDetailsList.appendChild(empty);
    return;
  }

  state.billBreakdown.forEach((item) => {
    const row = document.createElement("article");
    row.className = "bill-detail-row";
    row.innerHTML = `
      <div>
        <span>Month</span>
        <strong>${formatMonthKey(item.monthKey)}</strong>
      </div>
      <div>
        <span>Meals</span>
        <strong>${Number(item.meals || 0)}</strong>
      </div>
      <div>
        <span>Rate</span>
        <strong>${formatCurrency(item.rate)}</strong>
      </div>
      <div>
        <span>Bill</span>
        <strong>${formatCurrency(item.bill)}</strong>
      </div>
    `;
    els.billDetailsList.appendChild(row);
  });
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function monthKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function getCompletedMonthEndKey(viewDate) {
  const now = new Date();
  const viewedMonthKey = monthKey(viewDate);
  const currentMonthKey = monthKey(now);

  if (viewedMonthKey < currentMonthKey) {
    return `${viewDate.getFullYear()}-${pad(viewDate.getMonth() + 1)}-${pad(
      new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate()
    )}`;
  }

  if (viewedMonthKey > currentMonthKey) {
    return "";
  }

  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  return `${yesterday.getFullYear()}-${pad(yesterday.getMonth() + 1)}-${pad(yesterday.getDate())}`;
}

function applyProfile(user) {
  const initials = user.studentName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  els.sidebarName.textContent = user.studentName;
  els.sidebarRoom.textContent = `Room ${user.roomNumber}-${user.bed}`;
  els.sidebarPref.textContent = user.defaultPreference;
  els.studentAvatar.textContent = initials || "S";
  els.topbarName.textContent = user.studentName.split(" ")[0] || "Student";
  if (els.heroRoom) els.heroRoom.textContent = `${user.roomNumber}-${user.bed}`;
  if (els.heroPreference) els.heroPreference.textContent = user.defaultPreference;
  els.profileName.textContent = user.studentName;
  els.profileRoom.textContent = `${user.roomNumber}-${user.bed}`;
  els.profileRoll.textContent = user.rollNumber;
  els.profileEmail.textContent = user.email;
  els.profilePref.textContent = user.defaultPreference;
  els.profileCreated.textContent = formatDate(user.createdAt);
  if (els.defaultPreferenceSelect) {
    els.defaultPreferenceSelect.value = user.defaultPreference || "veg";
  }
}

function updateTodayControls(day) {
  els.todayLunchEnabled.checked = !!day.lunch.enabled;
  els.todayLunchType.value = day.lunch.type;
  els.todayDinnerEnabled.checked = !!day.dinner.enabled;
  els.todayDinnerType.value = day.dinner.type;

  els.todayLunchStatus.textContent = day.canToggleLunch ? "Open now" : "Locked";
  els.todayLunchStatus.classList.toggle("locked", !day.canToggleLunch);
  els.todayDinnerStatus.textContent = day.canToggleDinner ? "Open now" : "Locked";
  els.todayDinnerStatus.classList.toggle("locked", !day.canToggleDinner);

  els.todayLunchEnabled.disabled = !day.canToggleLunch;
  els.todayLunchType.disabled = !day.canToggleLunch;
  els.saveLunchBtn.disabled = !day.canToggleLunch;
  els.todayDinnerEnabled.disabled = !day.canToggleDinner;
  els.todayDinnerType.disabled = !day.canToggleDinner;
  els.saveDinnerBtn.disabled = !day.canToggleDinner;
}

function updateMonthStats(meals) {
  const completedEndKey = getCompletedMonthEndKey(state.currentMonthDate);
  const count = meals.reduce((sum, day) => {
    if (!completedEndKey || day.date > completedEndKey) return sum;
    return sum + (day.count || 0);
  }, 0);
  els.monthMeals.textContent = String(count);
}

function syncMonthPreferenceSelect(meals) {
  if (!els.monthPreferenceSelect || !Array.isArray(meals) || meals.length === 0) return;
  const firstUsableDay = meals.find((day) => day.count >= 0 && day.lunch && day.dinner);
  if (!firstUsableDay) return;

  const lunchType = firstUsableDay.lunch.type;
  const dinnerType = firstUsableDay.dinner.type;
  els.monthPreferenceSelect.value = lunchType === "non-veg" || dinnerType === "non-veg" ? "non-veg" : "veg";
}

async function loadProfile() {
  const data = await api("/auth/me");
  state.user = data.user;
  applyProfile(data.user);
  if (els.monthPreferenceSelect) {
    els.monthPreferenceSelect.value = data.user.defaultPreference || "veg";
  }
}

async function loadStats() {
  const stats = await api("/meals/stats/summary");
  els.totalMeals.textContent = String(stats.totalMeals);
  els.vegMeals.textContent = String(stats.vegMeals);
  els.nonVegMeals.textContent = String(stats.nonVegMeals);
  state.billBreakdown = Array.isArray(stats.billBreakdown) ? stats.billBreakdown : [];
  if (els.totalBill) {
    els.totalBill.textContent = formatCurrency(stats.totalBill || 0);
  }
  if (els.currentMonthRateLabel) {
    els.currentMonthRateLabel.textContent = `Current month rate: ${formatCurrency(stats.currentMonthRate || 0)}/meal`;
  }
  renderBillBreakdown();
}

async function loadTodayControls() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const data = await api(`/meals/month?year=${year}&month=${month}`);
  const today = data.meals.find((day) => day.date === todayKey());
  if (!today) {
    throw new Error("Could not load today's meal controls");
  }
  updateTodayControls(today);
}

function buildDayCard(day) {
  const article = document.createElement("article");
  article.className = "calendar-day";

  const lunchId = `lunch-${day.date}`;
  const dinnerId = `dinner-${day.date}`;
  const dayNumber = Number(day.date.slice(-2));

  article.innerHTML = `
    <div class="calendar-day-header">
      <strong class="calendar-day-number">${dayNumber}</strong>
      <span class="calendar-count">${day.count} meals</span>
    </div>
    <div class="calendar-meal-row">
      <label for="${lunchId}">
        Lunch
        <select id="${lunchId}">
          <option value="veg">Veg</option>
          <option value="non-veg">Non-Veg</option>
        </select>
      </label>
      <input class="meal-toggle" data-meal="lunch" type="checkbox" ${day.lunch.enabled ? "checked" : ""} />
    </div>
    <div class="calendar-meal-row">
      <label for="${dinnerId}">
        Dinner
        <select id="${dinnerId}">
          <option value="veg">Veg</option>
          <option value="non-veg">Non-Veg</option>
        </select>
      </label>
      <input class="meal-toggle" data-meal="dinner" type="checkbox" ${day.dinner.enabled ? "checked" : ""} />
    </div>
    <div class="calendar-actions">
      <span class="day-note">${day.canToggleLunch || day.canToggleDinner ? "Editable by cutoff time" : "Locked for editing"}</span>
      <button class="save-day-btn">Save</button>
    </div>
  `;

  const lunchSelect = article.querySelector(`#${CSS.escape(lunchId)}`);
  const dinnerSelect = article.querySelector(`#${CSS.escape(dinnerId)}`);
  const lunchToggle = article.querySelector('[data-meal="lunch"]');
  const dinnerToggle = article.querySelector('[data-meal="dinner"]');
  const saveBtn = article.querySelector(".save-day-btn");

  lunchSelect.value = day.lunch.type;
  dinnerSelect.value = day.dinner.type;

  if (!day.canToggleLunch) {
    lunchSelect.disabled = true;
    lunchToggle.disabled = true;
  }

  if (!day.canToggleDinner) {
    dinnerSelect.disabled = true;
    dinnerToggle.disabled = true;
  }

  if (!day.canToggleLunch && !day.canToggleDinner) {
    saveBtn.disabled = true;
    saveBtn.style.opacity = "0.55";
  }

  saveBtn.addEventListener("click", async () => {
    try {
      const body = {};
      if (day.canToggleLunch) {
        body.lunchEnabled = lunchToggle.checked;
        body.lunchType = lunchSelect.value;
      }
      if (day.canToggleDinner) {
        body.dinnerEnabled = dinnerToggle.checked;
        body.dinnerType = dinnerSelect.value;
      }
      await api(`/meals/${day.date}`, { method: "PATCH", body });
      toast(`Saved meals for ${day.date}`);
      await loadDashboardData();
    } catch (error) {
      toast(error.message, true);
    }
  });

  return article;
}

async function loadMonth() {
  const year = state.currentMonthDate.getFullYear();
  const month = state.currentMonthDate.getMonth() + 1;
  els.monthLabel.textContent = formatMonth(state.currentMonthDate);
  const data = await api(`/meals/month?year=${year}&month=${month}`);
  state.monthMeals = data.meals;
  els.calendarGrid.innerHTML = "";
  data.meals.forEach((day) => {
    els.calendarGrid.appendChild(buildDayCard(day));
  });
  syncMonthPreferenceSelect(data.meals);
  updateMonthStats(data.meals);
}

async function loadDashboardData() {
  await loadProfile();

  const results = await Promise.allSettled([loadStats(), loadMonth(), loadTodayControls()]);
  const failed = results
    .filter((result) => result.status === "rejected")
    .map((result) => result.reason?.message || "Request failed");

  if (failed.length) {
    toast(failed[0], true);
  }
}

async function saveTodayMeal(mealType) {
  const body =
    mealType === "lunch"
      ? {
          lunchEnabled: els.todayLunchEnabled.checked,
          lunchType: els.todayLunchType.value
        }
      : {
          dinnerEnabled: els.todayDinnerEnabled.checked,
          dinnerType: els.todayDinnerType.value
        };
  await api(`/meals/${todayKey()}`, { method: "PATCH", body });
  toast(`${mealType === "lunch" ? "Lunch" : "Dinner"} updated`);
  await loadDashboardData();
}

async function applyMonthPreference() {
  const body = {
    year: state.currentMonthDate.getFullYear(),
    month: state.currentMonthDate.getMonth() + 1,
    preference: els.monthPreferenceSelect.value
  };
  const data = await api("/meals/month/preference", { method: "POST", body });
  toast(`Updated ${data.updatedDays} days in the selected month to ${body.preference}`);
  await loadDashboardData();
}

async function saveDefaultPreference() {
  const preference = els.defaultPreferenceSelect?.value;
  if (!preference) throw new Error("Select a default preference first");

  const data = await api("/meals/default-preference", {
    method: "POST",
    body: { preference }
  });
  toast(data.message || "Default preference updated");
  await loadDashboardData();
}

function setActiveNav() {
  const sections = els.navLinks
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

  const onScroll = () => {
    let currentId = "#overview";
    sections.forEach((section) => {
      const rect = section.getBoundingClientRect();
      if (rect.top <= 140) currentId = `#${section.id}`;
    });
    els.navLinks.forEach((link) => link.classList.toggle("active", link.getAttribute("href") === currentId));
  };

  window.addEventListener("scroll", onScroll);
  onScroll();
}

function searchDashboardSections() {
  const query = (els.topSearchInput?.value || "").trim().toLowerCase();
  if (!query) {
    toast("Type something to search");
    return;
  }

  const sections = ["overview", "profile", "quickControls", "summary", "mealCalendar", "footerSection"]
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  const match = sections.find((section) => section.textContent.toLowerCase().includes(query));
  if (!match) {
    toast("No matching section found", true);
    return;
  }

  match.scrollIntoView({ behavior: "smooth", block: "start" });
  toast("Jumped to matching section");
}

function bindEvents() {
  const handleLogout = () => {
    localStorage.removeItem("studentToken");
    window.location.href = "./signin.html";
  };

  if (els.topLogoutBtn) {
    els.topLogoutBtn.addEventListener("click", handleLogout);
  }

  if (els.topRefreshBtn) {
    els.topRefreshBtn.addEventListener("click", () => {
      loadDashboardData().then(() => toast("Dashboard refreshed")).catch((error) => toast(error.message, true));
    });
  }

  if (els.refreshProfileBtn) {
    els.refreshProfileBtn.addEventListener("click", () => {
      loadProfile().then(() => toast("Profile refreshed")).catch((error) => toast(error.message, true));
    });
  }

  if (els.jumpTodayBtn) {
    els.jumpTodayBtn.addEventListener("click", () => {
      document.getElementById("quickControls").scrollIntoView({ behavior: "smooth" });
    });
  }

  if (els.homeBtn) {
    els.homeBtn.addEventListener("click", () => {
      sessionStorage.setItem("allowHomeView", "true");
      window.location.href = "./index.html";
    });
  }

  if (els.topSearchInput) {
    els.topSearchInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        searchDashboardSections();
      }
    });
  }

  if (els.saveDefaultPreferenceBtn) {
    els.saveDefaultPreferenceBtn.addEventListener("click", () => {
      saveDefaultPreference().catch((error) => toast(error.message, true));
    });
  }

  els.saveLunchBtn.addEventListener("click", () => {
    saveTodayMeal("lunch").catch((error) => toast(error.message, true));
  });

  els.saveDinnerBtn.addEventListener("click", () => {
    saveTodayMeal("dinner").catch((error) => toast(error.message, true));
  });

  els.todayResetBtn.addEventListener("click", () => {
    els.todayLunchEnabled.checked = true;
    els.todayLunchType.value = state.user?.defaultPreference || "veg";
    els.todayDinnerEnabled.checked = true;
    els.todayDinnerType.value = state.user?.defaultPreference || "veg";
    toast("Reset today controls to default. Save lunch and dinner to apply.");
  });

  els.prevMonthBtn.addEventListener("click", () => {
    state.currentMonthDate = new Date(state.currentMonthDate.getFullYear(), state.currentMonthDate.getMonth() - 1, 1);
    loadMonth().catch((error) => toast(error.message, true));
  });

  els.nextMonthBtn.addEventListener("click", () => {
    state.currentMonthDate = new Date(state.currentMonthDate.getFullYear(), state.currentMonthDate.getMonth() + 1, 1);
    loadMonth().catch((error) => toast(error.message, true));
  });

  els.applyMonthPreferenceBtn.addEventListener("click", () => {
    applyMonthPreference().catch((error) => toast(error.message, true));
  });
}

async function init() {
  if (!state.token) {
    window.location.href = "./signin.html";
    return;
  }

  try {
    bindEvents();
    setActiveNav();
    await loadDashboardData();
  } catch (error) {
    const message = error.message || "Session expired";
    if (/unauthorized|invalid token|session expired|user not found|admin approval|requires admin approval|pending|rejected/i.test(message)) {
      localStorage.removeItem("studentToken");
      toast(message, true);
      setTimeout(() => {
        window.location.href = "./signin.html";
      }, 1200);
      return;
    }

    toast(message, true);
  }
}

init();






