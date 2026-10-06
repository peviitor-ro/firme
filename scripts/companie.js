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
  const localitate =
    anaf.localitate ||
    (Array.isArray(company.location)
      ? company.location[0]
      : company.location) ||
    (Array.isArray(company.localitate)
      ? company.localitate[0]
      : company.localitate) ||
    "--";

  let judet =
    anaf.judet ||
    (Array.isArray(company.judet) ? company.judet[0] : company.judet);

  if (!judet) {
    const rawAddress =
      (Array.isArray(company.address)
        ? company.address[0]
        : company.address) ||
      (Array.isArray(company.adresa_completa)
        ? company.adresa_completa[0]
        : company.adresa_completa) ||
      anaf.adresa ||
      "";
    if (rawAddress) {
      const parts = rawAddress
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (parts.length > 0) {
        judet = parts[parts.length - 1];
      }
    }
  }

  if (!judet && localitate !== "--") {
    judet = localitate;
  }

  return {
    localitate: localitate || "--",
    judet: judet || "--",
  };
}

// DOM Helper builders for company details view
function createCopyButton(textToCopy, title = "Copiază") {
  const btn = document.createElement("button");
  btn.className = "copy-btn";
  btn.title = title;
  btn.setAttribute("data-copy", textToCopy);

  const copyIcon = document.createElement("i");
  copyIcon.className = "ri-file-copy-line";
  btn.appendChild(copyIcon);

  btn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(textToCopy);

      const checkIcon = document.createElement("i");
      checkIcon.className = "ri-check-line";
      checkIcon.style.color = "#10b981";
      btn.replaceChildren(checkIcon);
      btn.disabled = true;

      setTimeout(() => {
        const revertIcon = document.createElement("i");
        revertIcon.className = "ri-file-copy-line";
        btn.replaceChildren(revertIcon);
        btn.disabled = false;
      }, 1500);
    } catch (err) {
      console.error("Clipboard copy failed:", err);
    }
  });
  return btn;
}

function createCodeField(titleText, valueText, valueId = null) {
  const field = document.createElement("div");
  field.className = "code-field";

  const h4 = document.createElement("h4");
  h4.textContent = titleText;
  field.appendChild(h4);

  const p = document.createElement("p");
  if (valueId) p.id = valueId;
  p.textContent = valueText || "--";
  field.appendChild(p);

  return field;
}

function createCodeFieldWithCopy(titleText, valueText, spanId, copyTitle) {
  const field = document.createElement("div");
  field.className = "code-field";

  const h4 = document.createElement("h4");
  h4.textContent = titleText;
  field.appendChild(h4);

  const p = document.createElement("p");
  if (!valueText || valueText === "--") {
    p.textContent = "--";
    if (spanId) p.id = spanId;
  } else {
    const span = document.createElement("span");
    if (spanId) span.id = spanId;
    span.textContent = valueText;
    p.appendChild(span);

    const btn = createCopyButton(valueText, copyTitle);
    p.appendChild(btn);
  }

  field.appendChild(p);
  return field;
}

function createLinkFieldWithCopy(titleText, displayText, href, linkId, copyTitle) {
  const field = document.createElement("div");
  field.className = "code-field";

  const h4 = document.createElement("h4");
  h4.textContent = titleText;
  field.appendChild(h4);

  const p = document.createElement("p");
  if (!displayText || displayText === "--" || !href) {
    p.textContent = "--";
    if (linkId) p.id = linkId;
  } else {
    const a = document.createElement("a");
    if (linkId) a.id = linkId;
    a.href = href;
    a.textContent = displayText;
    if (!href.startsWith("mailto:") && !href.startsWith("tel:")) {
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    }
    p.appendChild(a);

    const btn = createCopyButton(displayText, copyTitle);
    p.appendChild(btn);
  }

  field.appendChild(p);
  return field;
}

function createWebsiteList(titleText, sites = [], copyTitle = "Copiază link") {
  const wrapper = document.createElement("div");
  wrapper.className = "company-website";

  const h4 = document.createElement("h4");
  h4.textContent = titleText;
  wrapper.appendChild(h4);

  if (!sites || sites.length === 0) {
    const p = document.createElement("p");
    p.textContent = "--";
    wrapper.appendChild(p);
  } else {
    sites.forEach((site) => {
      const entry = document.createElement("div");
      entry.className = "website-entry";

      const a = document.createElement("a");
      a.href = site.startsWith("http") ? site : `https://${site}`;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.className = "company-website-link";
      a.textContent = site;
      entry.appendChild(a);

      const btn = createCopyButton(site, copyTitle);
      entry.appendChild(btn);

      wrapper.appendChild(entry);
    });
  }

  return wrapper;
}

// Load and render company details
async function loadCompanyDetails() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const name = params.get("name");

  if (!id && !name) {
    document.getElementById("company-card").innerText =
      "ID-ul sau numele companiei lipsește din URL.";
    return;
  }

  try {
    let company = null;
    const cleanId = id ? id.replace(/^ro\s*/i, "").replace(/\D/g, "") : "";

    // Search by ID via search/?id=
    if (cleanId) {
      try {
        const searchResults = await fetchJsonSafely(
          `https://api.peviitor.ro/v1/firme/search/?id=${encodeURIComponent(cleanId)}`
        );
        if (Array.isArray(searchResults) && searchResults.length > 0) {
          company = searchResults[0];
        }
      } catch (err) {
        console.warn("Search by ID endpoint failed:", err);
      }
    }

    // Search by CIF via company/?cif=
    if (!company && cleanId) {
      try {
        const compData = await fetchJsonSafely(
          `https://api.peviitor.ro/v1/firme/company/?cif=${encodeURIComponent(cleanId)}`
        );
        if (compData && compData.data && Array.isArray(compData.data) && compData.data.length > 0) {
          company = compData.data[0];
        }
      } catch (err) {
        console.warn("Search by CIF endpoint failed:", err);
      }
    }

    // Search by name or query via qsearch
    const query = name || id;
    if (!company && query) {
      try {
        const qData = await fetchJsonSafely(
          `https://api.peviitor.ro/v1/firme/qsearch/?q=${encodeURIComponent(query)}`
        );
        if (qData && qData.docs && Array.isArray(qData.docs) && qData.docs.length > 0) {
          const match =
            qData.docs.find(
              (c) =>
                (cleanId && String(c.id).trim() === String(cleanId).trim()) ||
                (name &&
                  c.company &&
                  c.company.trim().toLowerCase() === name.trim().toLowerCase())
            ) || qData.docs[0];

          if (match) {
            company = match;
          }
        }
      } catch (err) {
        console.warn("Query search failed:", err);
      }
    }

    if (!company) {
      document.getElementById("company-card").innerText =
        "Compania nu a fost găsită.";
      return;
    }

    // Parse nested ANAF data if available
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
      (Array.isArray(company.denumire) ? company.denumire[0] : company.denumire) ||
      company.brand ||
      anaf.company ||
      anaf.denumire ||
      "--";

    const cui = company.cui || company.cif || company.id || anaf.cui || anaf.cif || "--";
    const status = company.status || anaf.statusImpozit || "--";
    const isActive =
      status.toLowerCase() === "activ" ||
      status.toLowerCase() === "in functiune" ||
      (Array.isArray(company.cod_stare) && company.cod_stare.includes(1048));

    const codStare = company.cod_stare || [];
    const codStareFormat =
      Array.isArray(codStare) && codStare.length > 0
        ? codStare.join(" ")
        : status || "--";

    const regComert =
      company.cod_inmatriculare ||
      company.reg_comert ||
      anaf.cod_inmatriculare ||
      "--";

    const euid = company.euid || anaf.euid || "--";

    const adresa =
      (Array.isArray(company.address) ? company.address[0] : company.address) ||
      (Array.isArray(company.adresa_completa)
        ? company.adresa_completa[0]
        : company.adresa_completa) ||
      anaf.adresa ||
      "--";

    const { localitate, judet } = extractLocation(company, anaf);

    const brands =
      (Array.isArray(company.brand) ? company.brand[0] : company.brand) ||
      (Array.isArray(company.brands) ? company.brands[0] : company.brands) ||
      anaf.brand ||
      "--";

    const email =
      (Array.isArray(company.email) ? company.email[0] : company.email) ||
      anaf.email ||
      "--";

    const phone =
      (Array.isArray(company.phone) ? company.phone[0] : company.phone) ||
      (Array.isArray(company.telefon) ? company.telefon[0] : company.telefon) ||
      anaf.phone ||
      "--";

    const logo =
      (Array.isArray(company.logo) ? company.logo[0] : company.logo) ||
      "--";

    const scraper =
      company.scraperFile ||
      (Array.isArray(company.scraper) ? company.scraper[0] : company.scraper) ||
      "--";

    let website = [];
    if (Array.isArray(company.website)) {
      website = company.website.filter(Boolean);
    } else if (company.website) {
      website = [company.website];
    } else if (anaf.website) {
      website = [anaf.website];
    }

    let career = [];
    if (Array.isArray(company.career)) {
      career = company.career.filter(Boolean);
    } else if (company.career) {
      career = [company.career];
    }

    // Build company profile DOM elements using createElement and append
    const cardContainer = document.getElementById("company-card");

    // 1. Company Heading & Status
    const heading = document.createElement("div");
    heading.className = "company-heading f-row separator";

    const h2 = document.createElement("h2");
    h2.id = "company-name";
    h2.textContent = companyName;

    const statusDiv = document.createElement("div");
    statusDiv.className = "company-status";

    const statusP = document.createElement("p");
    statusP.textContent = "Stare firmă: ";

    const statusSpan = document.createElement("span");
    statusSpan.className = isActive ? "green" : "red";
    statusSpan.textContent = isActive ? "Funcționare / Activ" : "Inactivă";

    statusP.appendChild(statusSpan);
    statusDiv.appendChild(statusP);
    heading.append(h2, statusDiv);

    // 2. Company Details Container
    const details = document.createElement("div");
    details.className = "company-details f-col";

    // Section 1: Informații generale
    const generalHeading = document.createElement("div");
    generalHeading.className = "company-details-heading";

    const generalH3 = document.createElement("h3");
    generalH3.textContent = "Informații generale";

    const summaryP = document.createElement("p");
    summaryP.id = "company-summary";
    summaryP.append("Codul fiscal al firmei ");

    const nameSpan = document.createElement("span");
    nameSpan.id = "company-name-inline";
    nameSpan.textContent = companyName;
    summaryP.appendChild(nameSpan);

    summaryP.append(" este ");

    const cuiSpan = document.createElement("span");
    cuiSpan.id = "company-cui-inline";
    cuiSpan.textContent = String(cui);
    summaryP.appendChild(cuiSpan);

    summaryP.append(".");
    generalHeading.append(generalH3, summaryP);

    const generalData = document.createElement("div");
    generalData.className = "company-details-data separator";
    generalData.append(
      createCodeFieldWithCopy("CUI / CIF:", String(cui), "company-cui", "Copiază CUI"),
      createCodeField("Cod Stare / Status:", String(codStareFormat), "company-cod-stare"),
      createCodeFieldWithCopy("Reg. Comerțului:", String(regComert), "company-reg", "Copiază cod"),
      createCodeFieldWithCopy("EUID:", String(euid), "company-euid", "Copiază EUID"),
      createCodeField("Brand:", String(brands), "company-brand")
    );

    // Section 2: Date de contact & Adresă
    const contactHeading = document.createElement("div");
    contactHeading.className = "company-details-heading";

    const contactH3 = document.createElement("h3");
    contactH3.textContent = "Date de contact & Adresă";

    const addressP = document.createElement("p");
    addressP.id = "company-address";
    addressP.textContent = String(adresa);
    contactHeading.append(contactH3, addressP);

    const contactData = document.createElement("div");
    contactData.className = "company-details-data separator";
    contactData.append(
      createCodeField("Județ:", String(judet), "company-judet"),
      createCodeField("Localitate:", String(localitate), "company-localitate"),
      createLinkFieldWithCopy(
        "Email:",
        email,
        email !== "--" ? `mailto:${email}` : null,
        "company-email",
        "Copiază email"
      ),
      createCodeField("Telefon:", String(phone), "company-phone"),
      createWebsiteList("Website:", website, "Copiază link")
    );

    if (career.length > 0) {
      contactData.appendChild(
        createWebsiteList("Cariere / Jobs:", career, "Copiază link cariere")
      );
    }

    // Section 3: Alte informații
    const otherHeading = document.createElement("div");
    otherHeading.className = "company-details-heading";

    const otherH3 = document.createElement("h3");
    otherH3.textContent = "Alte informații";
    otherHeading.appendChild(otherH3);

    const otherData = document.createElement("div");
    otherData.className = "company-details-data other-info-data";

    const scraperHref =
      scraper !== "--"
        ? scraper.startsWith("http")
          ? scraper
          : `https://github.com/peviitor-scrapers/${scraper}`
        : null;

    otherData.append(
      createLinkFieldWithCopy(
        "Link scraper:",
        scraper,
        scraperHref,
        "company-scraper",
        "Copiază scraper"
      ),
      createLinkFieldWithCopy(
        "Link logo:",
        logo,
        logo !== "--" ? logo : null,
        "company-logo",
        "Copiază logo"
      )
    );

    details.append(
      generalHeading,
      generalData,
      contactHeading,
      contactData,
      otherHeading,
      otherData
    );

    cardContainer.replaceChildren(heading, details);

    const sidebarAdminEditLink = document.getElementById("sidebarAdminEditLink");
    if (sidebarAdminEditLink) {
      sidebarAdminEditLink.href = `admin.html?id=${encodeURIComponent(
        cui !== "--" ? cui : cleanId
      )}&name=${encodeURIComponent(companyName)}`;
    }
  } catch (error) {
    console.error("Failed to load company details:", error);
    document.getElementById("company-card").innerText =
      "Eroare la încărcarea companiei.";
  }
}

loadCompanyDetails();
