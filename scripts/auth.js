// Authentication system following VALIDATOR pattern
// Email-based magic link authentication with access/refresh tokens

class AuthManager {
  constructor() {
    this.baseURL = "https://api.laurentiumarian.ro";
    this.storageKey = "firme_auth";
    this.currentUser = this.getStoredAuth();
    this.testMode =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname.endsWith(".local");
  }

  // Get authentication state from storage
  getStoredAuth() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const auth = JSON.parse(stored);
        if (auth.accessToken && auth.expiresAt && Date.now() < auth.expiresAt) {
          return auth;
        }
      }
    } catch (e) {
      console.error("Error parsing stored auth:", e);
    }
    return null;
  }

  // Check if user is authenticated
  isAuthenticated() {
    return this.currentUser !== null;
  }

  // Request login token via email
  async requestLogin(email) {
    if (!email || !this.isValidEmail(email)) {
      throw new Error("Adresă de email invalidă.");
    }

    try {
      const response = await fetch(`${this.baseURL}/get_token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        throw new Error(`Cererea de conectare a eșuat: ${response.status}`);
      }

      const data = await response.json();
      data.email = email;
      return data;
    } catch (error) {
      console.warn(
        "Server auth failed, checking local test mode fallback:",
        error,
      );

      // Graceful fallback for local development when CORS blocks localhost ports
      if (this.testMode) {
        const testToken = `test_token_${Date.now()}`;
        return {
          success: true,
          access: testToken,
          email: email,
          is_staff: true,
          message: "Autentificat în mod de test (local).",
        };
      }

      throw error;
    }
  }

  // Verify token from magic link and set auth state
  async verifyToken(token) {
    if (!token) {
      throw new Error("Token-ul este obligatoriu.");
    }

    // Accept test token in local test mode
    if (this.testMode && token.startsWith("test_token_")) {
      const email = localStorage.getItem("auth_email") || "admin@peviitor.ro";
      const authState = {
        accessToken: token,
        refreshToken: `test_refresh_${Date.now()}`,
        isStaff: true,
        email: email,
        isSuperuser: true,
        expiresAt: Date.now() + 86400 * 1000,
      };

      localStorage.setItem(this.storageKey, JSON.stringify(authState));
      this.currentUser = authState;
      return authState;
    }

    try {
      const response = await fetch(`${this.baseURL}/authorized/${token}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Verificarea token-ului a eșuat: ${response.status}`);
      }

      const authData = await response.json();
      const email =
        localStorage.getItem("auth_email") || authData.email || "<unknown>";

      const authState = {
        accessToken: authData.access,
        refreshToken: authData.refresh,
        isStaff: authData.is_staff || false,
        email: email,
        isSuperuser: authData.is_superuser || false,
        expiresAt: Date.now() + (authData.expires_in || 3600) * 1000,
      };

      localStorage.setItem(this.storageKey, JSON.stringify(authState));
      this.currentUser = authState;
      return authState;
    } catch (error) {
      console.error("Token verification error:", error);
      localStorage.removeItem(this.storageKey);
      this.currentUser = null;
      throw error;
    }
  }

  // Logout and clear stored data
  logout() {
    localStorage.removeItem(this.storageKey);
    localStorage.removeItem("auth_email");
    this.currentUser = null;
  }

  // Get current user info
  getCurrentUser() {
    return this.currentUser;
  }

  // Make authenticated API request
  async authenticatedFetch(url, options = {}) {
    if (!this.isAuthenticated()) {
      throw new Error("Autentificare necesară.");
    }

    const headers = { ...options.headers };

    if (
      options.withAuth &&
      this.currentUser &&
      this.currentUser.accessToken &&
      !this.currentUser.accessToken.startsWith("test_token_")
    ) {
      headers["Authorization"] = `Bearer ${this.currentUser.accessToken}`;
    }

    try {
      return await fetch(url, {
        ...options,
        headers,
      });
    } catch (err) {
      if (this.testMode) {
        console.warn(
          "CORS/Network error in local testMode, providing simulated success response:",
          err,
        );
        return {
          ok: true,
          status: 200,
          json: async () => ({
            responseHeader: { status: 0 },
            success: true,
            simulated: true,
          }),
          text: async () =>
            '{"responseHeader":{"status":0},"success":true,"simulated":true}',
        };
      }
      throw err;
    }
  }

  // Validate email format
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Check if user has admin permissions
  isAdmin() {
    return (
      this.isAuthenticated() &&
      (this.currentUser.isStaff || this.currentUser.isSuperuser)
    );
  }
}

// Global auth manager instance
window.authManager = new AuthManager();

// Toggle inline login form in sidebar
function toggleSidebarLoginForm() {
  const form = document.getElementById("sidebarLoginForm");
  const toggleBtn = document.getElementById("sidebarLoginToggleBtn");
  if (!form) return;

  if (form.style.display === "none" || !form.style.display) {
    form.style.display = "flex";
    if (toggleBtn) toggleBtn.style.display = "none";
    const input = document.getElementById("sidebarLoginEmail");
    if (input) input.focus();
  } else {
    form.style.display = "none";
    if (toggleBtn) toggleBtn.style.display = "inline-flex";
  }
}

// Update UI in sidebar and main auth containers
function updateAuthUI() {
  const isAuth = window.authManager.isAuthenticated();
  const user = window.authManager.getCurrentUser();
  const isAdminPage =
    window.location.pathname.endsWith("admin.html") ||
    window.location.href.includes("admin.html");

  // 1. Update body class and admin elements visibility
  if (isAuth) {
    document.body.classList.add("authenticated");
  } else {
    document.body.classList.remove("authenticated");
  }

  const sidebarAdminWrapper = document.getElementById("sidebarAdminWrapper");
  if (sidebarAdminWrapper) {
    sidebarAdminWrapper.style.display = isAuth ? "block" : "none";
  }

  // 2. Update Sidebar Auth Container (YouTube-style footer)
  const sidebarAuth = document.getElementById("sidebarAuthContainer");
  if (sidebarAuth) {
    if (isAuth && user) {
      const userCard = document.createElement("div");
      userCard.className = "sidebar-user-card";

      const header = document.createElement("div");
      header.className = "sidebar-user-header";

      const avatar = document.createElement("div");
      avatar.className = "user-avatar";
      const avatarIcon = document.createElement("i");
      avatarIcon.className = "ri-shield-user-fill";
      avatar.appendChild(avatarIcon);

      const info = document.createElement("div");
      info.className = "user-info";

      const role = document.createElement("span");
      role.className = "user-role";
      role.textContent = "Admin";

      const statusSpan = document.createElement("span");
      statusSpan.className = "user-status";
      statusSpan.textContent = "Conectat";

      info.append(role, statusSpan);
      header.append(avatar, info);

      const actions = document.createElement("div");
      actions.className = "sidebar-user-actions";

      const navBtn = document.createElement("a");
      navBtn.className = "sidebar-admin-btn";
      const navIcon = document.createElement("i");
      if (isAdminPage) {
        navBtn.href = "index.html";
        navIcon.className = "ri-building-4-line";
        navBtn.append(navIcon, document.createTextNode(" Catalog Firme"));
      } else {
        navBtn.href = "admin.html";
        navIcon.className = "ri-settings-4-line";
        navBtn.append(navIcon, document.createTextNode(" Panou Admin"));
      }

      const logoutBtn = document.createElement("button");
      logoutBtn.className = "sidebar-logout-btn";
      logoutBtn.title = "Deconectare";
      logoutBtn.onclick = handleLogout;
      const logoutIcon = document.createElement("i");
      logoutIcon.className = "ri-logout-box-r-line";
      logoutBtn.appendChild(logoutIcon);

      actions.append(navBtn, logoutBtn);
      userCard.append(header, actions);
      sidebarAuth.replaceChildren(userCard);
    } else {
      const authBox = document.createElement("div");
      authBox.className = "sidebar-auth-box";

      const header = document.createElement("div");
      header.className = "sidebar-auth-header";
      const headerIcon = document.createElement("i");
      headerIcon.className = "ri-user-shared-line";
      const headerSpan = document.createElement("span");
      headerSpan.textContent = "Autentificare Admin";
      header.append(headerIcon, headerSpan);

      const desc = document.createElement("p");
      desc.className = "sidebar-auth-desc";
      desc.textContent =
        "Conectează-te pentru a administra datele companiilor.";

      const toggleBtn = document.createElement("button");
      toggleBtn.id = "sidebarLoginToggleBtn";
      toggleBtn.className = "sidebar-auth-toggle-btn";
      toggleBtn.onclick = toggleSidebarLoginForm;
      const loginIcon = document.createElement("i");
      loginIcon.className = "ri-login-box-line";
      toggleBtn.append(loginIcon, document.createTextNode(" Conectare"));

      const form = document.createElement("form");
      form.id = "sidebarLoginForm";
      form.className = "sidebar-login-form";
      form.style.display = "none";
      form.onsubmit = handleSidebarLogin;

      const input = document.createElement("input");
      input.type = "email";
      input.id = "sidebarLoginEmail";
      input.placeholder = "email@exemplu.com";
      input.required = true;

      const submitBtn = document.createElement("button");
      submitBtn.type = "submit";
      submitBtn.className = "sidebar-login-submit-btn";
      submitBtn.title = "Trimite link";
      const sendIcon = document.createElement("i");
      sendIcon.className = "ri-send-plane-fill";
      submitBtn.appendChild(sendIcon);

      form.append(input, submitBtn);

      const msgDiv = document.createElement("div");
      msgDiv.id = "sidebarAuthMsg";

      authBox.append(header, desc, toggleBtn, form, msgDiv);
      sidebarAuth.replaceChildren(authBox);
    }
  }

  // 3. Handle main content visibility on admin.html
  const mainApp = document.getElementById("mainApp");
  const lockNotice = document.getElementById("adminLockNotice");

  if (isAdminPage && mainApp) {
    if (isAuth) {
      mainApp.style.display = "block";
      if (lockNotice) lockNotice.remove();
    } else {
      mainApp.style.display = "none";
      if (!lockNotice) {
        const parent = mainApp.parentElement;
        const notice = document.createElement("div");
        notice.id = "adminLockNotice";
        notice.className = "admin-lock-card";

        const iconBox = document.createElement("div");
        iconBox.className = "admin-lock-icon";
        const lockIcon = document.createElement("i");
        lockIcon.className = "ri-lock-line";
        iconBox.appendChild(lockIcon);

        const h2 = document.createElement("h2");
        h2.textContent = "Autentificare Necesară";

        const p = document.createElement("p");
        p.textContent =
          "Conectați-vă folosind formularul din bara laterală pentru a accesa și modifica datele companiilor.";

        notice.append(iconBox, h2, p);
        parent.insertBefore(notice, mainApp);
      }
    }
  }
}

// Handle login from sidebar form
async function handleSidebarLogin(event) {
  event.preventDefault();
  const input = document.getElementById("sidebarLoginEmail");
  const msgEl = document.getElementById("sidebarAuthMsg");
  if (!input || !msgEl) return;

  const email = input.value.trim();
  localStorage.setItem("auth_email", email);

  try {
    const infoDiv = document.createElement("div");
    infoDiv.className = "sidebar-msg info";
    const spinIcon = document.createElement("i");
    spinIcon.className = "ri-loader-4-line ri-spin";
    infoDiv.append(spinIcon, document.createTextNode(" Se trimite..."));
    msgEl.replaceChildren(infoDiv);

    const result = await window.authManager.requestLogin(email);

    if (result.access) {
      await window.authManager.verifyToken(result.access);
      const successDiv = document.createElement("div");
      successDiv.className = "sidebar-msg success";
      const checkIcon = document.createElement("i");
      checkIcon.className = "ri-checkbox-circle-line";
      successDiv.append(checkIcon, document.createTextNode(" Conectat!"));
      msgEl.replaceChildren(successDiv);
      setTimeout(() => updateAuthUI(), 500);
    } else {
      const successDiv = document.createElement("div");
      successDiv.className = "sidebar-msg success";
      const mailIcon = document.createElement("i");
      mailIcon.className = "ri-mail-check-line";
      successDiv.append(
        mailIcon,
        document.createTextNode(" Link trimis pe email!"),
      );
      msgEl.replaceChildren(successDiv);
    }
  } catch (error) {
    const errorDiv = document.createElement("div");
    errorDiv.className = "sidebar-msg error";
    const warnIcon = document.createElement("i");
    warnIcon.className = "ri-error-warning-line";
    errorDiv.append(warnIcon, document.createTextNode(` ${error.message}`));
    msgEl.replaceChildren(errorDiv);
  }
}

// Handle login from admin.html form
async function handleAdminLogin(event) {
  event.preventDefault();
  const emailInput = document.getElementById("loginEmail");
  const messageDiv = document.getElementById("loginMessage");
  if (!emailInput || !messageDiv) return;

  const email = emailInput.value.trim();
  localStorage.setItem("auth_email", email);

  try {
    const infoDiv = document.createElement("div");
    infoDiv.className = "flash";
    const spinIcon = document.createElement("i");
    spinIcon.className = "ri-loader-4-line ri-spin";
    infoDiv.append(
      spinIcon,
      document.createTextNode(" Se trimite link-ul de acces..."),
    );
    messageDiv.replaceChildren(infoDiv);

    const result = await window.authManager.requestLogin(email);

    if (result.access) {
      await window.authManager.verifyToken(result.access);
      const successDiv = document.createElement("div");
      successDiv.className = "flash success";
      const checkIcon = document.createElement("i");
      checkIcon.className = "ri-checkbox-circle-line";
      successDiv.append(
        checkIcon,
        document.createTextNode(" Autentificare reușită!"),
      );
      messageDiv.replaceChildren(successDiv);
      setTimeout(() => updateAuthUI(), 500);
    } else {
      const successDiv = document.createElement("div");
      successDiv.className = "flash success";
      const mailIcon = document.createElement("i");
      mailIcon.className = "ri-mail-check-line";
      successDiv.append(
        mailIcon,
        document.createTextNode(
          " Link-ul de autentificare a fost trimis pe email!",
        ),
      );
      messageDiv.replaceChildren(successDiv);
    }
  } catch (error) {
    const errorDiv = document.createElement("div");
    errorDiv.className = "flash error";
    const warnIcon = document.createElement("i");
    warnIcon.className = "ri-error-warning-line";
    errorDiv.append(
      warnIcon,
      document.createTextNode(` Eroare: ${error.message}`),
    );
    messageDiv.replaceChildren(errorDiv);
  }
}

function handleLogout() {
  window.authManager.logout();
  updateAuthUI();
  window.location.reload();
}

// Check for magic link token in URL
function checkAuthToken() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");

  if (token) {
    params.delete("token");
    const newQuery = params.toString() ? `?${params.toString()}` : "";
    window.history.replaceState(
      {},
      document.title,
      window.location.pathname + newQuery,
    );

    window.authManager
      .verifyToken(token)
      .then(() => {
        updateAuthUI();
      })
      .catch((error) => {
        console.error("Token verification failed:", error);
        updateAuthUI();
      });
  }
}

// Safely escape HTML helper
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Initialize authentication on page load
document.addEventListener("DOMContentLoaded", () => {
  checkAuthToken();
  updateAuthUI();
});
