const input = document.getElementById("searchInput");
const form = document.getElementById("customForm");
const container = document.getElementById("firmDetailsContainer");
const checkboxNoWebsite = document.getElementById("noWebsite");
const checkboxHasWebsite = document.getElementById("hasWebsite");
const filterHeader = document.querySelector(".right-header");
const filterContainer = document.querySelector(".active-filters");
const clearFiltersBtn = document.getElementById("clearFilters");

let allCompanies = [];
let currentPage = 1;
let rowsPerPage = 20;
let totalPages = 1;

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Safely extract and parse JSON payload (object or array) from response
async function fetchJsonSafely(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }
  const rawText = await response.text();
  const objStart = rawText.indexOf("{");
  const arrStart = rawText.indexOf("[");

  if (arrStart !== -1 && (objStart === -1 || arrStart < objStart)) {
    const arrEnd = rawText.lastIndexOf("]");
    if (arrEnd !== -1) {
      return JSON.parse(rawText.substring(arrStart, arrEnd + 1));
    }
  }

  if (objStart !== -1) {
    const objEnd = rawText.lastIndexOf("}");
    if (objEnd !== -1) {
      return JSON.parse(rawText.substring(objStart, objEnd + 1));
    }
  }

  throw new Error("Invalid server response.");
}

// Extract locality and county from company and ANAF data
function extractLocation(company, anaf = {}) {
  let localitate =
    anaf.localitate ||
    (Array.isArray(company.location)
      ? company.location[0]
      : company.location) ||
    (Array.isArray(company.localitate)
      ? company.localitate[0]
      : company.localitate) ||
    "Nespecificat";

  let judet =
    anaf.judet ||
    (Array.isArray(company.judet) ? company.judet[0] : company.judet);

  const rawAddress =
    (Array.isArray(company.address) ? company.address[0] : company.address) ||
    (Array.isArray(company.adresa_completa)
      ? company.adresa_completa[0]
      : company.adresa_completa) ||
    anaf.adresa ||
    (Array.isArray(company.location)
      ? company.location[0]
      : company.location) ||
    "";

  if (!judet && rawAddress) {
    const matchJud = rawAddress.match(/jud\.?\s*([^,]+)/i);
    if (matchJud) {
      judet = matchJud[1].trim();
    } else {
      const parts = rawAddress
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (parts.length > 0) {
        judet = parts[parts.length - 1];
      }
    }
  }

  if (localitate && localitate.includes("MUN.")) {
    const matchMun = localitate.match(/mun\.?\s*([^,]+)/i);
    if (matchMun) {
      localitate = matchMun[1].trim();
    }
  } else if (localitate && localitate.includes("Loc.")) {
    const matchLoc = localitate.match(/loc\.?\s*([^,]+)/i);
    if (matchLoc) {
      localitate = matchLoc[1].trim();
    }
  }

  if (!judet && localitate !== "Nespecificat") {
    judet = localitate;
  }

  return {
    localitate: localitate || "Nespecificat",
    judet: judet || "Nespecificat",
  };
}

// Handle search form submission
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const searchValue = input.value.trim();
  sessionStorage.setItem("lastSearch", searchValue);
  currentPage = 1;
  await searchCompany(searchValue, currentPage, rowsPerPage);
});

// Restore saved search on page load within session
window.addEventListener("DOMContentLoaded", async () => {
  const savedSearch = sessionStorage.getItem("lastSearch") || "";
  input.value = savedSearch;
  await searchCompany(savedSearch, currentPage, rowsPerPage);
});

// Search companies with a single API call per page/search
async function searchCompany(query = "", page = 1, rows = 20) {
  try {
    const actualQuery = query.trim();
    const cleanCif = actualQuery.replace(/^ro\s*/i, "").replace(/\D/g, "");
    const isCifQuery = /^(ro)?\s*\d{3,}$/i.test(actualQuery);

    let docs = [];
    let totalPagesCount = 1;

    // 1. Single call to list all 16000+ companies when query is empty
    if (!actualQuery) {
      const data = await fetchJsonSafely(
        `https://api.peviitor.ro/v1/companies/?count=true&page=${page}&rows=${rows}`,
      );

      if (data && Array.isArray(data.companies)) {
        docs = data.companies.map((c) => ({
          id: c.id,
          company: c.name,
          status: "activ",
        }));
        const total = data.total || docs.length;
        totalPagesCount = Math.ceil(total / rows) || 1;
      }
    }
    // 2. Single call for CIF lookup
    else if (isCifQuery && cleanCif) {
      const res = await fetchJsonSafely(
        `https://api.peviitor.ro/v1/firme/search/?id=${encodeURIComponent(
          cleanCif,
        )}`,
      );
      if (Array.isArray(res)) {
        docs = res;
        totalPagesCount = 1;
      }
    }
    // 3. Single call for text search
    else {
      const data = await fetchJsonSafely(
        `https://api.peviitor.ro/v1/firme/qsearch/?q=${encodeURIComponent(
          actualQuery,
        )}&page=${page}&rows=${rows}`,
      );

      if (data && data.docs && Array.isArray(data.docs)) {
        docs = data.docs;
        totalPagesCount = data.pagination?.total_pages || 1;
      }
    }

    totalPages = totalPagesCount;

    allCompanies = docs.sort((a, b) => {
      const nameA =
        a.company ||
        a.name ||
        (Array.isArray(a.denumire) && a.denumire[0] ? a.denumire[0] : "") ||
        a.brand ||
        "";
      const nameB =
        b.company ||
        b.name ||
        (Array.isArray(b.denumire) && b.denumire[0] ? b.denumire[0] : "") ||
        b.brand ||
        "";
      return nameA.localeCompare(nameB);
    });

    renderCompanies(applyFilters(allCompanies));
    updatePaginationControls();
  } catch (error) {
    console.error("Search failed:", error);
    container.innerHTML =
      "<em>Eroare la încărcare date: nu s-a putut conecta la server.</em>";
  }
}

// Exclusive filter listeners
checkboxNoWebsite.addEventListener("change", () => {
  if (checkboxNoWebsite.checked) checkboxHasWebsite.checked = false;
  renderCompanies(applyFilters(allCompanies));
  updateActiveFiltersUI();
});

checkboxHasWebsite.addEventListener("change", () => {
  if (checkboxHasWebsite.checked) checkboxNoWebsite.checked = false;
  renderCompanies(applyFilters(allCompanies));
  updateActiveFiltersUI();
});

// Apply website filters
function applyFilters(companies) {
  if (checkboxNoWebsite.checked) {
    return companies.filter((company) => {
      const website = Array.isArray(company.website)
        ? company.website[0]
        : company.website;
      return !website || String(website).trim() === "";
    });
  }
  if (checkboxHasWebsite.checked) {
    return companies.filter((company) => {
      const website = Array.isArray(company.website)
        ? company.website[0]
        : company.website;
      return website && String(website).trim().length > 0;
    });
  }
  return companies;
}

// Render company list cards
function renderCompanies(companies) {
  container.innerHTML = "";

  if (companies.length === 0) {
    container.innerHTML = "<em>Nicio firmă găsită.</em>";
    return;
  }

  companies.forEach((company) => {
    let anaf = {};
    if (
      company.anafData &&
      Array.isArray(company.anafData) &&
      company.anafData.length > 0
    ) {
      try {
        anaf =
          typeof company.anafData[0] === "string"
            ? JSON.parse(company.anafData[0])
            : company.anafData[0];
      } catch (e) {}
    }

    const companyName =
      company.company ||
      company.name ||
      (Array.isArray(company.denumire)
        ? company.denumire[0]
        : company.denumire) ||
      company.brand ||
      anaf.company ||
      anaf.denumire ||
      "Fără denumire";

    const status = (
      company.status ||
      anaf.statusImpozit ||
      (company.cod_stare
        ? Array.isArray(company.cod_stare) && company.cod_stare.includes(1048)
          ? "activ"
          : "inactiv"
        : "") ||
      "activ"
    ).toLowerCase();

    const isActive =
      status === "activ" ||
      status === "in functiune" ||
      (Array.isArray(company.cod_stare) && company.cod_stare.includes(1048));

    const { localitate, judet } = extractLocation(company, anaf);

    const codStare = company.cod_stare || [];
    const codStareFormatat =
      Array.isArray(codStare) && codStare.length > 0
        ? codStare.join(", ")
        : status
          ? status.charAt(0).toUpperCase() + status.slice(1)
          : "Nespecificat";

    const companyId =
      company.id || company.cui || company.cif || anaf.cui || anaf.cif || "";

    container.innerHTML += `
      <div class="company-details f-col">
        <ul>
          <li class="${isActive ? "valid" : "invalid"}">
            <h2>${escapeHtml(companyName)}</h2>
          </li>
        </ul>
        <div class="f-row company-address">
          <div class="f-col company-col">
            <h4>Localitate:</h4>
            <p>${escapeHtml(localitate)}</p>
          </div>
          <div class="f-col company-col">
            <h4>Județ:</h4>
            <p>${escapeHtml(judet)}</p>
          </div>
          <div class="f-col company-col">
            <h4>Status:</h4>
            <p>${escapeHtml(codStareFormatat)}</p>
          </div>
        </div>
        <a href="companie.html?id=${encodeURIComponent(
          companyId,
        )}&name=${encodeURIComponent(companyName)}" class="hover-anim company-link">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="32"
            height="32"
            viewBox="0 0 32 32"
            class="search-icon"
            focusable="false"
            role="img"
            aria-hidden="true"
            style="
              position: absolute;
              top: 50%;
              left: 9px;
              transform: translateY(-50%);
            "
          >
            <path
              class="euiIcon__fillSecondary"
              d="M11.63 8h7.38v2h-7.38z"
            ></path>
            <path d="M7 8h3.19v2H7z"></path>
            <path class="euiIcon__fillSecondary" d="M7 16h7.38v2H7z"></path>
            <path d="M15.81 16H19v2h-3.19zM7 12h9v2H7z"></path>
            <path
              d="M13 0C5.82 0 0 5.82 0 13s5.82 13 13 13 13-5.82 13-13A13 13 0 0013 0zm0 24C6.925 24 2 19.075 2 13S6.925 2 13 2s11 4.925 11 11-4.925 11-11 11zM22.581 23.993l1.414-1.414 7.708 7.708-1.414 1.414z"
            ></path>
          </svg>
          Vezi toate informațiile
        </a>
      </div>
    `;
  });
}

// Initial filter header state
filterHeader.style.display = "none";

// Update active filters badge UI
function updateActiveFiltersUI() {
  filterContainer.innerHTML = "";

  let filters = [];

  if (checkboxHasWebsite.checked) {
    filters.push({
      label: "Firme cu Website",
      id: "hasWebsite",
    });
  }

  if (checkboxNoWebsite.checked) {
    filters.push({
      label: "Firme fără Website",
      id: "noWebsite",
    });
  }

  filters.forEach((filter) => {
    const span = document.createElement("span");
    span.classList.add("active-filter");
    span.innerHTML = `
      ${filter.label}
      <button data-id="${filter.id}">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="currentColor" viewBox="0 0 24 24">
          <path d="M18.3 5.71a1 1 0 0 0-1.42 0L12 10.59 7.12 5.7a1 1 0 0 0-1.41 1.42L10.59 12l-4.88 4.88a1 1 0 1 0 1.41 1.41L12 13.41l4.88 4.88a1 1 0 0 0 1.42-1.41L13.41 12l4.88-4.88a1 1 0 0 0 0-1.41z"/>
        </svg>
      </button>
    `;
    filterContainer.appendChild(span);
  });

  filterHeader.style.display = filters.length > 0 ? "flex" : "none";
}

// Remove filter badge click listener
filterContainer.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (btn) {
    const id = btn.getAttribute("data-id");
    if (id === "hasWebsite") checkboxHasWebsite.checked = false;
    if (id === "noWebsite") checkboxNoWebsite.checked = false;
    renderCompanies(applyFilters(allCompanies));
    updateActiveFiltersUI();
  }
});

// Clear all active filters
clearFiltersBtn.addEventListener("click", () => {
  checkboxHasWebsite.checked = false;
  checkboxNoWebsite.checked = false;
  updateActiveFiltersUI();
  renderCompanies(applyFilters(allCompanies));
});

// Update pagination controls UI
function updatePaginationControls() {
  let paginationContainer = document.getElementById("paginationContainer");
  if (!paginationContainer) {
    paginationContainer = document.createElement("div");
    paginationContainer.id = "paginationContainer";
    container.insertAdjacentElement("afterend", paginationContainer);
  }

  paginationContainer.innerHTML = `
    <div style="margin-top: 20px; text-align: center;">
      <button id="prevPage" ${
        currentPage === 1 ? "disabled" : ""
      }>Previous</button>
      <span>Page ${currentPage} of ${totalPages}</span>
      <button id="nextPage" ${
        currentPage === totalPages ? "disabled" : ""
      }>Next</button>
    </div>
  `;

  const prevButton = document.getElementById("prevPage");
  const nextButton = document.getElementById("nextPage");

  if (prevButton) {
    prevButton.addEventListener("click", async () => {
      if (currentPage > 1) {
        currentPage--;
        await searchCompany(input.value.trim(), currentPage, rowsPerPage);
      }
    });
  }

  if (nextButton) {
    nextButton.addEventListener("click", async () => {
      if (currentPage < totalPages) {
        currentPage++;
        await searchCompany(input.value.trim(), currentPage, rowsPerPage);
      }
    });
  }
}
