const loader = document.getElementById("loader");
const themeToggle = document.getElementById("themeToggle");
const toastContainer = document.getElementById("toastContainer");
const searchInput = document.querySelector(".hero-search input");
const searchButton = document.querySelector(".search-btn");

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
  setTimeout(() => div.remove(), 2800);
}

function setTheme(mode) {
  document.body.classList.toggle("light", mode === "light");
  localStorage.setItem("theme", mode);
}

function handleThemeToggle() {
  const current = document.body.classList.contains("light") ? "light" : "dark";
  setTheme(current === "light" ? "dark" : "light");
}

function searchSections() {
  const query = (searchInput?.value || "").trim().toLowerCase();
  if (!query) {
    toast("Type something to search");
    return;
  }

  const sections = [...document.querySelectorAll("main .section")];
  const match = sections.find((section) => section.textContent.toLowerCase().includes(query));

  if (!match) {
    toast("No matching section found", true);
    return;
  }

  match.scrollIntoView({ behavior: "smooth", block: "start" });
  toast("Jumped to matching section");
}

(function init() {
  showLoader(false);

  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "light") setTheme("light");

  const studentToken = localStorage.getItem("studentToken");
  const allowHomeView = sessionStorage.getItem("allowHomeView") === "true";
  if (studentToken && !allowHomeView) {
    window.location.href = "./student-dashboard.html";
    return;
  }
  sessionStorage.removeItem("allowHomeView");

  if (themeToggle) {
    themeToggle.addEventListener("click", handleThemeToggle);
  }

  if (searchButton) {
    searchButton.addEventListener("click", searchSections);
  }

  if (searchInput) {
    searchInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        searchSections();
      }
    });
  }
})();
