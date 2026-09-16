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

// Extract location
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
        `https://api.peviitor.ro/v1/companies/?count=true&page=${page}&rows=${rows}`
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
          cleanCif
        )}`
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
          actualQuery
        )}&page=${page}&rows=${rows}`
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
    const errDiv = document.createElement("div");
    errDiv.className = "no-results-msg";
    const em = document.createElement("em");
    em.textContent = "Eroare la încărcare date: nu s-a putut conecta la server.";
    errDiv.appendChild(em);
    container.replaceChildren(errDiv);
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
  container.replaceChildren();

  if (companies.length === 0) {
    const noRes = document.createElement("div");
    noRes.className = "no-results-msg";
    const em = document.createElement("em");
    em.textContent = "Nicio firmă găsită.";
    noRes.appendChild(em);
    container.appendChild(noRes);
    return;
  }

  const isSearchActive = Boolean(input.value.trim());

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

    const companyId =
      company.id || company.cui || company.cif || anaf.cui || anaf.cif || "";

    const card = document.createElement("div");
    card.className = "company-card";

    const cardTop = document.createElement("div");
    cardTop.className = "company-card-top";

    const cardHeader = document.createElement("div");
    cardHeader.className = "company-card-header";

    const titleH2 = document.createElement("h2");
    titleH2.className = "company-card-title";
    titleH2.textContent = companyName;
    cardHeader.appendChild(titleH2);

    if (isSearchActive) {
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

      const statusBadge = document.createElement("span");
      statusBadge.className = `status-badge ${
        isActive ? "status-active" : "status-inactive"
      }`;

      const dot = document.createElement("span");
      dot.className = "status-dot";

      statusBadge.append(
        dot,
        document.createTextNode(` ${isActive ? "Activ" : "Inactiv"}`)
      );
      cardHeader.appendChild(statusBadge);

      const { localitate, judet } = extractLocation(company, anaf);
      const hasLocation = localitate && localitate !== "Nespecificat";
      const hasJudet = judet && judet !== "Nespecificat";

      const infoGrid = document.createElement("div");
      infoGrid.className = "company-info-grid";

      if (hasLocation) {
        const item = document.createElement("div");
        item.className = "company-info-item";
        const label = document.createElement("span");
        label.className = "info-label";
        label.textContent = "Localitate:";
        const val = document.createElement("span");
        val.className = "info-value";
        val.textContent = localitate;
        item.append(label, val);
        infoGrid.appendChild(item);
      }

      if (hasJudet) {
        const item = document.createElement("div");
        item.className = "company-info-item";
        const label = document.createElement("span");
        label.className = "info-label";
        label.textContent = "Județ:";
        const val = document.createElement("span");
        val.className = "info-value";
        val.textContent = judet;
        item.append(label, val);
        infoGrid.appendChild(item);
      }

      if (companyId) {
        const item = document.createElement("div");
        item.className = "company-info-item";
        const label = document.createElement("span");
        label.className = "info-label";
        label.textContent = "CUI / CIF:";
        const val = document.createElement("span");
        val.className = "info-value";
        val.textContent = String(companyId);
        item.append(label, val);
        infoGrid.appendChild(item);
      }

      cardTop.append(cardHeader, infoGrid);
    } else {
      cardTop.appendChild(cardHeader);
    }

    const cardBottom = document.createElement("div");
    cardBottom.className = "company-card-bottom";

    const link = document.createElement("a");
    link.className = "company-link";
    link.href = `companie.html?id=${encodeURIComponent(
      companyId
    )}&name=${encodeURIComponent(companyName)}`;

    const linkText = document.createElement("span");
    linkText.textContent = "Vezi toate informațiile";

    const arrowIcon = document.createElement("i");
    arrowIcon.className = "ri-arrow-right-line";

    link.append(linkText, arrowIcon);
    cardBottom.appendChild(link);

    card.append(cardTop, cardBottom);
    container.appendChild(card);
  });
}

// Initial filter header state
filterHeader.style.display = "none";

// Update active filters badge UI
function updateActiveFiltersUI() {
  filterContainer.replaceChildren();

  const filters = [];

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

    const textSpan = document.createElement("span");
    textSpan.textContent = filter.label;

    const btn = document.createElement("button");
    btn.setAttribute("data-id", filter.id);
    btn.title = "Elimină filtrul";

    const icon = document.createElement("i");
    icon.className = "ri-close-line";
    btn.appendChild(icon);

    span.append(textSpan, btn);
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

  const wrapper = document.createElement("div");
  wrapper.className = "pagination-wrapper";

  const prevBtn = document.createElement("button");
  prevBtn.id = "prevPage";
  prevBtn.className = "pagination-btn";
  if (currentPage === 1) prevBtn.disabled = true;
  const prevIcon = document.createElement("i");
  prevIcon.className = "ri-arrow-left-s-line";
  prevBtn.append(prevIcon, document.createTextNode(" Anterior"));

  const infoSpan = document.createElement("span");
  infoSpan.className = "pagination-info";
  const strongCur = document.createElement("strong");
  strongCur.textContent = String(currentPage);
  const strongTot = document.createElement("strong");
  strongTot.textContent = String(totalPages);
  infoSpan.append("Pagina ", strongCur, " din ", strongTot);

  const nextBtn = document.createElement("button");
  nextBtn.id = "nextPage";
  nextBtn.className = "pagination-btn";
  if (currentPage === totalPages) nextBtn.disabled = true;
  const nextIcon = document.createElement("i");
  nextIcon.className = "ri-arrow-right-s-line";
  nextBtn.append(document.createTextNode("Următor "), nextIcon);

  prevBtn.addEventListener("click", async () => {
    if (currentPage > 1) {
      currentPage--;
      await searchCompany(input.value.trim(), currentPage, rowsPerPage);
    }
  });

  nextBtn.addEventListener("click", async () => {
    if (currentPage < totalPages) {
      currentPage++;
      await searchCompany(input.value.trim(), currentPage, rowsPerPage);
    }
  });

  wrapper.append(prevBtn, infoSpan, nextBtn);
  paginationContainer.replaceChildren(wrapper);
}
