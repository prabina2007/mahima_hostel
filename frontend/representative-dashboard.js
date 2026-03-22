const API_BASE = window.APP_CONFIG?.API_BASE || "http://localhost:5000/api";

const state = {
  token: localStorage.getItem('representativeToken') || '',
  date: '',
  students: [],
  filteredStudents: []
};

const els = {
  loader: document.getElementById('loader'),
  toastContainer: document.getElementById('toastContainer'),
  repDateLabel: document.getElementById('repDateLabel'),
  downloadLunchPdfBtn: document.getElementById('downloadLunchPdfBtn'),
  downloadDinnerPdfBtn: document.getElementById('downloadDinnerPdfBtn'),
  repHomeBtn: document.getElementById('repHomeBtn'),
  repLogoutBtn: document.getElementById('repLogoutBtn'),
  totalMeals: document.getElementById('totalMeals'),
  vegMeals: document.getElementById('vegMeals'),
  nonVegMeals: document.getElementById('nonVegMeals'),
  mealsTaken: document.getElementById('mealsTaken'),
  repSearch: document.getElementById('repSearch'),
  repTableBody: document.getElementById('repTableBody')
};

function showLoader(show) {
  els.loader.classList.toggle('hidden', !show);
}

function toast(message, isError = false) {
  const div = document.createElement('div');
  div.className = 'toast';
  div.style.background = isError ? '#9b2226' : '#166b39';
  div.textContent = message;
  els.toastContainer.appendChild(div);
  setTimeout(() => div.remove(), 3200);
}

async function api(path, options = {}) {
  showLoader(true);
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(state.token ? { Authorization: `Bearer ${state.token}` } : {})
      },
      method: options.method || 'GET',
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await response.json() : null;
    if (!response.ok) throw new Error(data?.message || 'Request failed');
    return data;
  } finally {
    showLoader(false);
  }
}

function todayKey() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function statusChip(status) {
  if (status === 'HIDDEN') return '<span class="status-off">Not Visible Yet</span>';
  const cls = status === 'ON' ? 'status-on' : 'status-off';
  return `<span class="${cls}">${status}</span>`;
}

function studentMatches(student, query) {
  if (!query) return true;
  const hay = `${student.roomNumber}-${student.bed} ${student.studentName} ${student.phoneNumber || ''}`.toLowerCase();
  return hay.includes(query);
}

function renderTable() {
  const query = (els.repSearch.value || '').trim().toLowerCase();
  state.filteredStudents = state.students.filter((student) => studentMatches(student, query));
  els.repTableBody.innerHTML = '';

  if (!state.filteredStudents.length) {
    els.repTableBody.innerHTML = '<tr><td colspan="10">No students found for today.</td></tr>';
    return;
  }

  state.filteredStudents.forEach((student) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${student.roomNumber}-${student.bed}</td>
      <td>${student.studentName}</td>
      <td>${student.phoneNumber || '-'}</td>
      <td>${statusChip(student.lunchStatus)}</td>
      <td>${student.lunchType}</td>
      <td><button class="meal-btn ${student.lunchTaken ? 'marked' : ''}" type="button" data-id="${student.id}" data-meal="lunch" ${student.lunchStatus !== 'ON' ? 'disabled' : ''}>${student.lunchTaken ? 'Taken' : 'Mark Taken'}</button></td>
      <td>${statusChip(student.dinnerStatus)}</td>
      <td>${student.dinnerType}</td>
      <td><button class="meal-btn ${student.dinnerTaken ? 'marked' : ''}" type="button" data-id="${student.id}" data-meal="dinner" ${student.dinnerStatus !== 'ON' ? 'disabled' : ''}>${student.dinnerTaken ? 'Taken' : 'Mark Taken'}</button></td>
      <td>${student.totalPlannedMeals}</td>
    `;

    tr.querySelectorAll('[data-meal]').forEach((button) => {
      button.addEventListener('click', async () => {
        try {
          const studentId = button.dataset.id;
          const meal = button.dataset.meal;
          const current = state.students.find((item) => item.id === studentId);
          const takenKey = meal === 'lunch' ? 'lunchTaken' : 'dinnerTaken';
          const nextValue = !(current && current[takenKey]);
          await api(`/representative/day-status/${state.date}/${studentId}`, {
            method: 'PATCH',
            body: { meal, taken: nextValue }
          });
          toast(`${meal[0].toUpperCase() + meal.slice(1)} updated for ${current.studentName}`);
          await loadDay();
        } catch (error) {
          toast(error.message, true);
        }
      });
    });

    els.repTableBody.appendChild(tr);
  });
}

async function loadDay() {
  state.date = todayKey();
  const data = await api(`/representative/day-status?date=${encodeURIComponent(state.date)}`);
  state.students = data.students || [];
  els.repDateLabel.textContent = new Date(`${data.date}T00:00:00`).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  els.totalMeals.textContent = String(data.totalMeals || 0);
  els.vegMeals.textContent = String(data.vegMeals || 0);
  els.nonVegMeals.textContent = String(data.nonVegMeals || 0);
  els.mealsTaken.textContent = String(data.mealsTaken || 0);
  els.downloadLunchPdfBtn.disabled = !data.lunchReportReady;
  els.downloadDinnerPdfBtn.disabled = !data.dinnerReportReady;
  renderTable();
}

async function downloadPdf(meal) {
  showLoader(true);
  try {
    const response = await fetch(`${API_BASE}/representative/reports/daily?date=${encodeURIComponent(state.date)}&meal=${meal}`, {
      headers: { Authorization: `Bearer ${state.token}` }
    });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data?.message || 'Failed to download PDF');
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `representative-${meal}-status-${state.date}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  } finally {
    showLoader(false);
  }
}

function bindEvents() {
  els.downloadLunchPdfBtn.addEventListener('click', () => downloadPdf('lunch').catch((error) => toast(error.message, true)));
  els.downloadDinnerPdfBtn.addEventListener('click', () => downloadPdf('dinner').catch((error) => toast(error.message, true)));
  els.repSearch.addEventListener('input', renderTable);
  els.repHomeBtn.addEventListener('click', () => {
    sessionStorage.setItem('allowHomeView', 'true');
    window.location.href = './index.html';
  });
  els.repLogoutBtn.addEventListener('click', () => {
    localStorage.removeItem('representativeToken');
    window.location.href = './representative-login.html';
  });
}

async function init() {
  if (!state.token) {
    window.location.href = './representative-login.html';
    return;
  }

  bindEvents();

  try {
    await loadDay();
  } catch (error) {
    if (/unauthorized|invalid token|representative/i.test(error.message || '')) {
      localStorage.removeItem('representativeToken');
      window.location.href = './representative-login.html';
      return;
    }
    toast(error.message, true);
  }
}

init();
