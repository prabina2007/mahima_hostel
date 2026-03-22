const API_BASE = window.APP_CONFIG?.API_BASE || "http://localhost:5000/api";

const els = {
  loader: document.getElementById("loader"),
  toastContainer: document.getElementById("toastContainer"),
  studentsTableBody: document.getElementById("studentsTableBody"),
  adminSearch: document.getElementById("adminSearch"),
  reportDate: document.getElementById("reportDate"),
  downloadLunchReportBtn: document.getElementById("downloadLunchReportBtn"),
  downloadDinnerReportBtn: document.getElementById("downloadDinnerReportBtn"),
  topLogoutBtn: document.getElementById("topLogoutBtn"),
  topHomeBtn: document.getElementById("topHomeBtn"),
  topRefreshBtn: document.getElementById("topRefreshBtn"),
  totalStudentsCount: document.getElementById("totalStudentsCount"),
  vegStudentsCount: document.getElementById("vegStudentsCount"),
  nonVegStudentsCount: document.getElementById("nonVegStudentsCount"),
  pendingStudentsCount: document.getElementById("pendingStudentsCount"),
  dashboardMeta: document.getElementById("dashboardMeta"),
  daySearchDate: document.getElementById("daySearchDate"),
  searchDayBtn: document.getElementById("searchDayBtn"),
  dayTotalMeals: document.getElementById("dayTotalMeals"),
  dayVegMeals: document.getElementById("dayVegMeals"),
  dayNonVegMeals: document.getElementById("dayNonVegMeals"),
  dayLunchPdfBtn: document.getElementById("dayLunchPdfBtn"),
  dayDinnerPdfBtn: document.getElementById("dayDinnerPdfBtn"),
  mealRateMonth: document.getElementById("mealRateMonth"),
  mealRateValue: document.getElementById("mealRateValue"),
  saveMealRateBtn: document.getElementById("saveMealRateBtn"),
  currentMealRateValue: document.getElementById("currentMealRateValue"),
  mealRatesTableBody: document.getElementById("mealRatesTableBody"),
  topSearchInput: document.getElementById("topSearchInput"),
  mealTargetMode: document.getElementById("mealTargetMode"),
  mealControlStudentId: document.getElementById("mealControlStudentId"),
  mealScope: document.getElementById("mealScope"),
  mealAction: document.getElementById("mealAction"),
  mealScopeMode: document.getElementById("mealScopeMode"),
  scopeDay: document.getElementById("scopeDay"),
  scopeMonth: document.getElementById("scopeMonth"),
  scopeFromMonth: document.getElementById("scopeFromMonth"),
  scopeToMonth: document.getElementById("scopeToMonth"),
  scopeFromDate: document.getElementById("scopeFromDate"),
  scopeToDate: document.getElementById("scopeToDate"),
  selectedDayInput: document.getElementById("selectedDayInput"),
  addSelectedDayBtn: document.getElementById("addSelectedDayBtn"),
  clearSelectedDaysBtn: document.getElementById("clearSelectedDaysBtn"),
  selectedDaysChips: document.getElementById("selectedDaysChips"),
  selectedStudentsInfo: document.getElementById("selectedStudentsInfo"),
  applyMealControlBtn: document.getElementById("applyMealControlBtn"),
  singleStudentField: document.getElementById("singleStudentField"),
  scopeDayField: document.getElementById("scopeDayField"),
  scopeMonthField: document.getElementById("scopeMonthField"),
  scopeFromMonthField: document.getElementById("scopeFromMonthField"),
  scopeToMonthField: document.getElementById("scopeToMonthField"),
  scopeFromDateField: document.getElementById("scopeFromDateField"),
  scopeToDateField: document.getElementById("scopeToDateField"),
  selectedDaysField: document.getElementById("selectedDaysField"),
  navLinks: [...document.querySelectorAll(".admin-nav-link")]
};

const state = {
  adminToken: localStorage.getItem("adminToken") || "",
  students: [],
  selectedStudentIds: new Set(),
  selectedDates: []
};

function showLoader(show) {
  if (els.loader) els.loader.classList.toggle("hidden", !show);
}

function toast(message, isError = false) {
  if (!els.toastContainer) return;
  const div = document.createElement("div");
  div.className = "toast";
  div.style.background = isError ? "#9b2226" : "#1f2f22";
  div.textContent = message;
  els.toastContainer.appendChild(div);
  setTimeout(() => div.remove(), 3000);
}

async function api(path, options = {}) {
  showLoader(true);
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
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

function goHome() {
  window.location.href = "./index.html";
}

function syncSearchInputs(value) {
  if (els.adminSearch && els.adminSearch.value !== value) {
    els.adminSearch.value = value;
  }
  if (els.topSearchInput && els.topSearchInput.value !== value) {
    els.topSearchInput.value = value;
  }
}

function logoutAdmin() {
  localStorage.removeItem("adminToken");
  state.adminToken = "";
  toast("Admin logged out");
  setTimeout(() => {
    window.location.href = "./admin-login.html";
  }, 250);
}

function renderStats(students) {
  const approvedStudents = students.filter((student) => student.approvalStatus === "approved");
  const pendingCount = students.filter((student) => (student.approvalStatus || "pending") === "pending").length;
  const vegCount = approvedStudents.filter((student) => student.defaultPreference === "veg").length;
  const nonVegCount = approvedStudents.filter((student) => student.defaultPreference === "non-veg").length;

  els.totalStudentsCount.textContent = students.length;
  els.vegStudentsCount.textContent = vegCount;
  if (els.pendingStudentsCount) els.pendingStudentsCount.textContent = pendingCount;
  els.nonVegStudentsCount.textContent = nonVegCount;
}

function updateSelectedStudentsInfo() {
  if (els.selectedStudentsInfo) {
    els.selectedStudentsInfo.textContent = `Selected students: ${state.selectedStudentIds.size}`;
  }
}

function renderSelectedDaysChips() {
  if (!els.selectedDaysChips) return;
  els.selectedDaysChips.innerHTML = "";

  state.selectedDates.forEach((date) => {
    const chip = document.createElement("span");
    chip.className = "selected-day-chip";
    chip.innerHTML = `${date}<button type="button" data-date="${date}">x</button>`;
    chip.querySelector("button").addEventListener("click", () => {
      state.selectedDates = state.selectedDates.filter((value) => value !== date);
      renderSelectedDaysChips();
    });
    els.selectedDaysChips.appendChild(chip);
  });
}

function populateStudentSelect(students) {
  if (!els.mealControlStudentId) return;

  const approvedStudents = students.filter((student) => student.approvalStatus === "approved");
  const currentValue = els.mealControlStudentId.value;
  els.mealControlStudentId.innerHTML = '<option value="">Select student</option>';

  approvedStudents.forEach((student) => {
    const option = document.createElement("option");
    option.value = student.id;
    option.textContent = `${student.roomNumber}-${student.bed} | ${student.studentName}`;
    els.mealControlStudentId.appendChild(option);
  });

  els.mealControlStudentId.value = approvedStudents.some((student) => student.id === currentValue) ? currentValue : "";
}

function updateMealControlFields() {
  const targetMode = els.mealTargetMode?.value || "all";
  const scopeMode = els.mealScopeMode?.value || "day";
  const action = els.mealAction?.value || "off";
  const needsDateScope = action !== "permanent_on" && action !== "permanent_off";

  els.singleStudentField?.classList.toggle("hidden", targetMode !== "single");
  els.mealScopeMode?.closest(".field-stack")?.classList.toggle("hidden", !needsDateScope);
  els.scopeDayField?.classList.toggle("hidden", !needsDateScope || scopeMode !== "day");
  els.scopeMonthField?.classList.toggle("hidden", !needsDateScope || scopeMode !== "month");
  els.scopeFromMonthField?.classList.toggle("hidden", !needsDateScope || scopeMode !== "month_range");
  els.scopeToMonthField?.classList.toggle("hidden", !needsDateScope || scopeMode !== "month_range");
  els.scopeFromDateField?.classList.toggle("hidden", !needsDateScope || scopeMode !== "date_range");
  els.scopeToDateField?.classList.toggle("hidden", !needsDateScope || scopeMode !== "date_range");
  els.selectedDaysField?.classList.toggle("hidden", !needsDateScope || scopeMode !== "selected_days");
  updateSelectedStudentsInfo();
}

function formatStatusLabel(status) {
  const value = String(status || "pending").toLowerCase();
  if (value === "approved") return "Approved";
  if (value === "rejected") return "Rejected";
  return "Pending";
}

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getLocalMonthKey(date = new Date()) {
  return getLocalDateKey(date).slice(0, 7);
}

function formatCurrency(value) {
  return `Rs ${Number(value || 0).toFixed(2)}`;
}

function formatPhoneNumber(value) {
  const normalized = String(value || "").trim();
  if (!normalized || normalized.toLowerCase() === "undefined" || normalized.toLowerCase() === "null") {
    return "Not provided";
  }
  return normalized;
}

async function loadMealRate() {
  if (!els.mealRateMonth || !els.currentMealRateValue || !els.mealRateValue) return;
  const month = els.mealRateMonth.value || getLocalMonthKey();
  const result = await api(`/admin/meal-rate?month=${encodeURIComponent(month)}`, {
    token: state.adminToken
  });
  els.currentMealRateValue.textContent = formatCurrency(result.rate);
  els.mealRateValue.value = Number(result.rate || 0) ? String(result.rate) : "";
}

async function loadMealRatesList() {
  if (!els.mealRatesTableBody) return;

  try {
    const result = await api('/admin/meal-rates', {
      token: state.adminToken
    });
    const rates = Array.isArray(result.rates) ? result.rates : [];
    els.mealRatesTableBody.innerHTML = '';

    if (!rates.length) {
      els.mealRatesTableBody.innerHTML = '<tr><td colspan="3">No meal rates saved yet</td></tr>';
      return;
    }

    rates.forEach((item) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${item.monthKey}</td>
        <td>${formatCurrency(item.rate)}</td>
        <td><button class="row-action-btn delete-btn" type="button" data-reset-month="${item.monthKey}">Reset</button></td>
      `;

      tr.querySelector('[data-reset-month]')?.addEventListener('click', async () => {
        const confirmed = window.confirm(`Reset meal rate for ${item.monthKey}?`);
        if (!confirmed) return;
        try {
          await resetMealRate(item.monthKey);
        } catch (error) {
          toast(error.message, true);
        }
      });

      els.mealRatesTableBody.appendChild(tr);
    });
  } catch (error) {
    if (/not found/i.test(error.message || '')) {
      els.mealRatesTableBody.innerHTML = '<tr><td colspan="3">Saved-rates list will appear after backend restart</td></tr>';
      return;
    }
    throw error;
  }
}

async function resetMealRate(monthKey) {
  await api(`/admin/meal-rate/${encodeURIComponent(monthKey)}`, {
    method: 'DELETE',
    token: state.adminToken
  });
  toast(`Meal rate reset for ${monthKey}`);

  if (els.mealRateMonth?.value === monthKey) {
    els.mealRateValue.value = '';
    els.currentMealRateValue.textContent = formatCurrency(0);
  }

  await Promise.all([loadMealRate(), loadMealRatesList()]);
}

async function saveMealRate() {
  const month = els.mealRateMonth?.value || "";
  const rate = Number(els.mealRateValue?.value || 0);
  if (!month) {
    toast("Select a month first", true);
    return;
  }
  await api("/admin/meal-rate", {
    method: "PUT",
    token: state.adminToken,
    body: { month, rate }
  });
  toast("Meal rate saved");
  await Promise.all([loadMealRate(), loadMealRatesList()]);
}

function compareRoomBed(a, b) {
  const roomA = Number.parseInt(a.roomNumber, 10);
  const roomB = Number.parseInt(b.roomNumber, 10);
  const normalizedRoomA = Number.isNaN(roomA) ? String(a.roomNumber) : roomA;
  const normalizedRoomB = Number.isNaN(roomB) ? String(b.roomNumber) : roomB;

  if (normalizedRoomA < normalizedRoomB) return -1;
  if (normalizedRoomA > normalizedRoomB) return 1;

  const bedA = String(a.bed || "").toUpperCase();
  const bedB = String(b.bed || "").toUpperCase();
  if (bedA < bedB) return -1;
  if (bedA > bedB) return 1;

  return String(a.studentName || "").localeCompare(String(b.studentName || ""), "en", {
    sensitivity: "base"
  });
}

async function loadStudents() {
  const search = (els.adminSearch?.value || "").trim();
  const result = await api(`/admin/students?search=${encodeURIComponent(search)}`, {
    token: state.adminToken
  });

  const students = (result.students || []).slice().sort(compareRoomBed);
  state.students = students;
  const approvedIds = new Set(students.filter((student) => student.approvalStatus === "approved").map((student) => student.id));
  state.selectedStudentIds = new Set([...state.selectedStudentIds].filter((id) => approvedIds.has(id)));
  els.studentsTableBody.innerHTML = "";
  renderStats(students);
  populateStudentSelect(students);
  updateSelectedStudentsInfo();

  students.forEach((student) => {
    const tr = document.createElement("tr");
    const isSelected = state.selectedStudentIds.has(student.id);
    tr.innerHTML = `
      <td><input class="row-selector" type="checkbox" data-select-id="${student.id}" ${isSelected ? "checked" : ""} ${student.approvalStatus !== "approved" ? "disabled" : ""} /></td>
      <td>${student.studentName}</td>
      <td>${formatPhoneNumber(student.phoneNumber)}</td>
      <td>${student.roomNumber}-${student.bed}</td>
      <td>${student.rollNumber}</td>
      <td>${student.defaultPreference}</td>
      <td><span class="status-chip status-${student.approvalStatus || "pending"}">${formatStatusLabel(student.approvalStatus)}</span></td>
      <td>${student.approvalStatus === "approved" ? (student.completedMeals ?? student.totalMeals ?? 0) : 0}</td>
      <td>${student.approvalStatus === "approved" ? (student.todayPlannedMeals ?? 0) : 0}</td>
      <td>
        <div class="table-action-group">
          <button class="row-action-btn approve-btn" data-action="approve" data-id="${student.id}" type="button" ${student.approvalStatus === "approved" ? "disabled" : ""}>Approve</button>
          <button class="row-action-btn reject-btn" data-action="reject" data-id="${student.id}" type="button" ${student.approvalStatus === "rejected" ? "disabled" : ""}>Reject</button>
          <button class="row-action-btn delete-btn" data-action="delete" data-id="${student.id}" type="button">Delete</button>
        </div>
      </td>
    `;

    const selector = tr.querySelector("[data-select-id]");
    if (selector) {
      selector.addEventListener("change", () => {
        if (selector.checked) state.selectedStudentIds.add(student.id);
        else state.selectedStudentIds.delete(student.id);
        updateSelectedStudentsInfo();
      });
    }

    tr.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", async () => {
        const action = button.dataset.action;
        try {
          if (action === "approve") {
            await api(`/admin/students/${student.id}/approve`, {
              method: "PATCH",
              token: state.adminToken
            });
            toast("Student approved");
          } else if (action === "reject") {
            await api(`/admin/students/${student.id}/reject`, {
              method: "PATCH",
              token: state.adminToken
            });
            toast("Student rejected");
          } else if (action === "delete") {
            if (!confirm(`Delete ${student.studentName}?`)) return;
            await api(`/admin/students/${student.id}`, {
              method: "DELETE",
              token: state.adminToken
            });
            toast("Student deleted");
          }
          await loadStudents();
        } catch (error) {
          toast(error.message, true);
        }
      });
    });
    els.studentsTableBody.appendChild(tr);
  });
}

function setActiveNavLink() {
  const sections = els.navLinks
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

  const current = sections.find((section) => {
    const rect = section.getBoundingClientRect();
    return rect.top <= 180 && rect.bottom >= 180;
  });

  els.navLinks.forEach((link) => {
    const target = link.getAttribute("href");
    link.classList.toggle("active", current ? `#${current.id}` === target : target === "#overview");
  });
}

async function downloadReport(meal, dateOverride) {
  showLoader(true);
  try {
    const date = dateOverride || els.reportDate.value || getLocalDateKey();
    const response = await fetch(`${API_BASE}/admin/reports/daily?meal=${meal}&date=${date}`, {
      headers: {
        Authorization: `Bearer ${state.adminToken}`
      }
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || "Failed to download PDF");
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${meal}-report-${date}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    toast(`${meal[0].toUpperCase() + meal.slice(1)} report downloaded`);
  } catch (error) {
    toast(error.message, true);
  } finally {
    showLoader(false);
  }
}

async function applyMealControl() {
  const targetMode = els.mealTargetMode?.value || "all";
  const scopeMode = els.mealScopeMode?.value || "day";
  const action = els.mealAction?.value || "off";
  const needsDateScope = action !== "permanent_on" && action !== "permanent_off";

  const body = {
    targetMode,
    mealScope: els.mealScope?.value || "both",
    action
  };

  if (needsDateScope) {
    body.scopeMode = scopeMode;
  }

  if (targetMode === "single") {
    if (!els.mealControlStudentId?.value) throw new Error("Select one student first");
    body.userId = els.mealControlStudentId.value;
  }

  if (targetMode === "selected") {
    body.userIds = [...state.selectedStudentIds];
    if (!body.userIds.length) throw new Error("Select at least one approved student from the table");
  }

  if (needsDateScope) {
    if (scopeMode === "day") {
      if (!els.scopeDay?.value) throw new Error("Select a day");
      body.date = els.scopeDay.value;
    } else if (scopeMode === "month") {
      if (!els.scopeMonth?.value) throw new Error("Select a month");
      body.month = els.scopeMonth.value;
    } else if (scopeMode === "month_range") {
      if (!els.scopeFromMonth?.value || !els.scopeToMonth?.value) throw new Error("Select both months");
      body.fromMonth = els.scopeFromMonth.value;
      body.toMonth = els.scopeToMonth.value;
    } else if (scopeMode === "date_range") {
      if (!els.scopeFromDate?.value || !els.scopeToDate?.value) throw new Error("Select both dates");
      body.fromDate = els.scopeFromDate.value;
      body.toDate = els.scopeToDate.value;
    } else if (scopeMode === "selected_days") {
      if (!state.selectedDates.length) throw new Error("Add at least one selected day");
      body.dates = state.selectedDates.slice();
    }
  }

  const result = await api("/admin/meals/bulk-update", {
    method: "POST",
    token: state.adminToken,
    body
  });

  const actionLabel =
    action === "permanent_off"
      ? "Permanent OFF lock applied"
      : action === "permanent_on"
        ? "Permanent OFF removed and meals restored"
        : `${result.updatedMeals} meal updates applied across ${result.updatedStudents} students`;
  toast(actionLabel);
  await Promise.all([loadStudents(), loadDaySummary()]);
}

async function loadDaySummary() {
  const date = els.daySearchDate?.value || getLocalDateKey();
  const result = await api(`/admin/day-summary?date=${encodeURIComponent(date)}`, {
    token: state.adminToken
  });

  if (els.daySearchDate && els.daySearchDate.value !== result.date) {
    els.daySearchDate.value = result.date;
  }

  if (els.reportDate && els.reportDate.value !== result.date) {
    els.reportDate.value = result.date;
  }

  els.dayTotalMeals.textContent = String(result.totalMeals);
  els.dayVegMeals.textContent = String(result.vegMeals);
  els.dayNonVegMeals.textContent = String(result.nonVegMeals);
  els.dayLunchPdfBtn.disabled = !result.lunchReportReady;
  els.dayDinnerPdfBtn.disabled = !result.dinnerReportReady;
}

(function init() {
  if (!state.adminToken) {
    window.location.href = "./admin-login.html";
    return;
  }

  const today = getLocalDateKey();
  if (els.reportDate) els.reportDate.value = today;
  if (els.daySearchDate) els.daySearchDate.value = today;
  if (els.dashboardMeta) {
    els.dashboardMeta.textContent = `${new Date().toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    })} · Live hostel operations`;
  }

  els.topRefreshBtn?.addEventListener("click", () => {
    Promise.all([loadStudents(), loadDaySummary(), loadMealRate(), loadMealRatesList()]).catch((error) => toast(error.message, true));
  });
  els.adminSearch?.addEventListener("input", () => {
    syncSearchInputs(els.adminSearch.value);
    loadStudents().catch((error) => toast(error.message, true));
  });
  els.topSearchInput?.addEventListener("input", () => {
    syncSearchInputs(els.topSearchInput.value);
    loadStudents().catch((error) => toast(error.message, true));
  });
  els.downloadLunchReportBtn?.addEventListener("click", () => downloadReport("lunch"));
  els.downloadDinnerReportBtn?.addEventListener("click", () => downloadReport("dinner"));
  els.dayLunchPdfBtn?.addEventListener("click", () => downloadReport("lunch", els.daySearchDate?.value));
  els.dayDinnerPdfBtn?.addEventListener("click", () => downloadReport("dinner", els.daySearchDate?.value));
  els.searchDayBtn?.addEventListener("click", () => {
    loadDaySummary().catch((error) => toast(error.message, true));
  });
  els.topLogoutBtn?.addEventListener("click", logoutAdmin);
  els.topHomeBtn?.addEventListener("click", goHome);
  els.mealTargetMode?.addEventListener("change", updateMealControlFields);
  els.mealScopeMode?.addEventListener("change", updateMealControlFields);
  els.mealAction?.addEventListener("change", updateMealControlFields);
  els.mealRateMonth?.addEventListener("change", () => {
    loadMealRate().catch((error) => toast(error.message, true));
  });
  els.saveMealRateBtn?.addEventListener("click", () => {
    saveMealRate().catch((error) => toast(error.message, true));
  });
  els.addSelectedDayBtn?.addEventListener("click", () => {
    const value = els.selectedDayInput?.value;
    if (!value) {
      toast("Choose a day first", true);
      return;
    }
    if (!state.selectedDates.includes(value)) {
      state.selectedDates.push(value);
      state.selectedDates.sort();
      renderSelectedDaysChips();
    }
    els.selectedDayInput.value = "";
  });
  els.clearSelectedDaysBtn?.addEventListener("click", () => {
    state.selectedDates = [];
    renderSelectedDaysChips();
  });
  els.applyMealControlBtn?.addEventListener("click", () => {
    applyMealControl().catch((error) => toast(error.message, true));
  });
  window.addEventListener("scroll", setActiveNavLink);

  if (els.scopeDay) els.scopeDay.value = today;
  if (els.scopeFromDate) els.scopeFromDate.value = today;
  if (els.scopeToDate) els.scopeToDate.value = today;
  const currentMonth = today.slice(0, 7);
  if (els.scopeMonth) els.scopeMonth.value = currentMonth;
  if (els.scopeFromMonth) els.scopeFromMonth.value = currentMonth;
  if (els.scopeToMonth) els.scopeToMonth.value = currentMonth;
  updateMealControlFields();
  renderSelectedDaysChips();

  Promise.all([loadStudents(), loadDaySummary(), loadMealRate(), loadMealRatesList()]).catch((error) => {
    const message = error?.message || "Failed to load admin dashboard";
    if (/unauthorized|forbidden|invalid token|jwt|not authorized|token/i.test(message)) {
      localStorage.removeItem("adminToken");
      toast(message, true);
      setTimeout(() => {
        window.location.href = "./admin-login.html";
      }, 500);
      return;
    }

    toast(message, true);
  });
  setActiveNavLink();
})();
















