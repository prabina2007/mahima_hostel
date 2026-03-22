const API_BASE = window.APP_CONFIG?.API_BASE || "http://localhost:5000/api";

const loader = document.getElementById("loader");
const toastContainer = document.getElementById("toastContainer");

function showLoader(show) {
  if (loader) loader.classList.toggle("hidden", !show);
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

async function handleStudentLogin(form) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const body = Object.fromEntries(new FormData(form).entries());
      const data = await api("/auth/login", { method: "POST", body });
      localStorage.setItem("studentToken", data.token);
      toast("Login successful");
      window.location.href = "./student-dashboard.html";
    } catch (error) {
      toast(error.message, true);
    }
  });
}

async function handleSignup(form) {
  const requestOtpBtn = document.getElementById("requestOtpBtn");
  if (requestOtpBtn) {
    requestOtpBtn.addEventListener("click", async () => {
      try {
        const email = form.elements.email.value.trim();
        if (!email) {
          toast("Enter email first", true);
          return;
        }
        await api("/auth/request-otp", { method: "POST", body: { email } });
        toast("OTP sent to your email");
      } catch (error) {
        toast(error.message, true);
      }
    });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const body = Object.fromEntries(new FormData(form).entries());
      const data = await api("/auth/signup", { method: "POST", body });
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
      const data = await api("/auth/admin-login", { method: "POST", body });
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
      const data = await api("/auth/representative-login", { method: "POST", body });
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
