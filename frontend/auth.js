const API_BASE = window.APP_CONFIG?.API_BASE || "http://localhost:5000/api";

const loader = document.getElementById("loader");
const loaderText = loader?.querySelector("p");
const toastContainer = document.getElementById("toastContainer");

const LOGIN_RETRY_ATTEMPTS = 2;
const LOGIN_REQUEST_TIMEOUT = 20000;

function showLoader(show, message = "Loading...") {
  if (!loader) return;
  loader.classList.toggle("hidden", !show);
  if (show && loaderText) loaderText.textContent = message;
}

function toast(message, isError = false) {
  if (!toastContainer) return;
  const div = document.createElement("div");
  div.className = "toast";
  div.style.background = isError ? "#9b2226" : "#111827";
  div.textContent = message;
  toastContainer.appendChild(div);
  setTimeout(() => div.remove(), 3200);
}

function normalizeApiError(error, fallback = "Request failed") {
  const raw = String(error?.message || fallback).trim();
  if (/Failed to fetch|Load failed|NetworkError|network request failed/i.test(raw)) {
    return "Server is waking up. Please wait a moment and try again.";
  }
  if (/AbortError|timed out|timeout/i.test(raw)) {
    return "Server took too long to respond. Please try again in a few seconds.";
  }
  return raw || fallback;
}

async function api(path, options = {}) {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs || 15000;
  const timeout = setTimeout(() => controller.abort(new Error("Request timed out")), timeoutMs);

  showLoader(true, options.loaderMessage || "Loading...");
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
      },
      method: options.method || "GET",
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal
    });
    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json") ? await response.json() : null;
    if (!response.ok) throw new Error(data?.message || "Request failed");
    return data;
  } catch (error) {
    throw new Error(normalizeApiError(error));
  } finally {
    clearTimeout(timeout);
    showLoader(false);
  }
}

function isRetryableLoginError(message) {
  return /waking up|too long to respond|failed to fetch|network/i.test(String(message || ""));
}

async function loginWithRetry(path, body) {
  let lastError;

  for (let attempt = 1; attempt <= LOGIN_RETRY_ATTEMPTS; attempt += 1) {
    const isRetry = attempt > 1;

    try {
      return await api(path, {
        method: "POST",
        body,
        timeoutMs: LOGIN_REQUEST_TIMEOUT,
        loaderMessage: isRetry
          ? "Server is waking up. Retrying login..."
          : "Connecting to server..."
      });
    } catch (error) {
      lastError = error;
      if (!isRetryableLoginError(error.message) || attempt == LOGIN_RETRY_ATTEMPTS) {
        break;
      }
      toast("Server is waking up. Retrying login...", false);
      await new Promise((resolve) => setTimeout(resolve, 2500));
    }
  }

  throw lastError || new Error("Login failed");
}

async function handleStudentLogin(form) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const body = Object.fromEntries(new FormData(form).entries());
      const data = await loginWithRetry("/auth/login", body);
      localStorage.setItem("studentToken", data.token);
      toast("Login successful");
      window.location.href = "./student-dashboard.html";
    } catch (error) {
      toast(error.message, true);
    }
  });
}

async function handleSignup(form) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const body = Object.fromEntries(new FormData(form).entries());
      const data = await api("/auth/signup", {
        method: "POST",
        body,
        timeoutMs: 20000,
        loaderMessage: "Creating your hostel account..."
      });
      toast(data.message || "Signup submitted successfully");
      setTimeout(() => {
        window.location.href = "./signin.html";
      }, 900);
    } catch (error) {
      toast(error.message, true);
    }
  });
}

async function handleAdminLogin(form) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const body = Object.fromEntries(new FormData(form).entries());
      const data = await loginWithRetry("/auth/admin-login", body);
      localStorage.removeItem("studentToken");
      localStorage.setItem("adminToken", data.token);
      sessionStorage.removeItem("allowHomeView");
      toast("Admin login successful");
      window.location.href = "./admin-dashboard.html";
    } catch (error) {
      toast(error.message, true);
    }
  });
}

async function handleRepresentativeLogin(form) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const body = Object.fromEntries(new FormData(form).entries());
      const data = await loginWithRetry("/auth/representative-login", body);
      localStorage.removeItem("studentToken");
      localStorage.removeItem("adminToken");
      localStorage.setItem("representativeToken", data.token);
      sessionStorage.removeItem("allowHomeView");
      toast("Representative login successful");
      window.location.href = "./representative-dashboard.html";
    } catch (error) {
      toast(error.message, true);
    }
  });
}

const studentLoginForm = document.getElementById("studentLoginForm");
const signupForm = document.getElementById("signupForm");
const adminLoginForm = document.getElementById("adminLoginForm");
const representativeLoginForm = document.getElementById("representativeLoginForm");

if (studentLoginForm) handleStudentLogin(studentLoginForm);
if (signupForm) handleSignup(signupForm);
if (adminLoginForm) handleAdminLogin(adminLoginForm);
if (representativeLoginForm) handleRepresentativeLogin(representativeLoginForm);
