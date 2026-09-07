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

    const htmlContent = `
       <div class="company-heading f-col separator">
         <h2 id="company-name">${escapeHtml(companyName)}</h2>
         <a href="index.html" id="backButton">Înapoi la rezultate</a>
       </div>

       <div class="company-status f-row separator">
         <p>Stare firmă: <span class="${
           isActive ? "green" : "red"
         }">${isActive ? "Funcționare / Activ" : "Inactivă"}</span></p>
       </div>

       <div class="company-details f-col">
         <div class="company-details-heading">
           <h3>Informații generale</h3>
           <p id="company-summary">
             Codul fiscal al firmei <span id="company-name-inline">${escapeHtml(
               companyName
             )}</span> este <span id="company-cui-inline">${escapeHtml(
      String(cui)
    )}</span>.
           </p>
         </div>

         <div class="company-details-data separator">
           <div class="code-field">
             <h4>CUI / CIF:</h4>
             <p>
               <span id="company-cui">${escapeHtml(String(cui))}</span>
               <button class="copy-btn" data-copy="${escapeHtml(
                 String(cui)
               )}" title="Copiază CUI">📋</button>
             </p>
           </div>

           <div class="code-field">
             <h4>Cod Stare / Status:</h4>
             <p id="company-cod-stare">${escapeHtml(String(codStareFormat))}</p>
           </div>

           <div class="code-field">
             <h4>Reg. Comerțului:</h4>
             <p>
               <span id="company-reg">${escapeHtml(String(regComert))}</span>
               <button class="copy-btn" data-copy="${escapeHtml(
                 String(regComert)
               )}" title="Copiază cod">📋</button>
             </p>
           </div>

           <div class="code-field">
             <h4>EUID:</h4>
             <p>
               <span id="company-euid">${escapeHtml(String(euid))}</span>
               <button class="copy-btn" data-copy="${escapeHtml(
                 String(euid)
               )}" title="Copiază EUID">📋</button>
             </p>
           </div>

           <div class="code-field">
             <h4>Brand:</h4>
             <p id="company-brand">${escapeHtml(String(brands))}</p>
           </div>
         </div>
         
         <div class="company-details-heading"> 
           <h3>Date de contact & Adresă</h3>
           <p id="company-address">${escapeHtml(String(adresa))}</p>
         </div>
         <div class="company-details-data separator"> 
           <div class="code-field">
             <h4>Județ:</h4>
             <p id="company-judet">${escapeHtml(String(judet))}</p>
           </div>

           <div class="code-field">
             <h4>Localitate:</h4>
             <p id="company-localitate">${escapeHtml(String(localitate))}</p>
           </div>

           <div class="code-field">
              <h4>Email:</h4>
              ${
                email === "--"
                  ? `<p id="company-email">--</p>`
                  : `
                    <p>
                      <a href="mailto:${escapeHtml(email)}" id="company-email">${escapeHtml(email)}</a>
                      <button class="copy-btn" data-copy="${escapeHtml(
                        email
                      )}" title="Copiază email">📋</button>
                    </p>
                    `
              }
            </div>

            <div class="code-field">
             <h4>Telefon:</h4>
             <p id="company-phone">${escapeHtml(String(phone))}</p>
           </div>
           
           <div class="company-website">
             <h4>Website:</h4>
             ${
               website.length > 0
                 ? website
                     .map(
                       (site) => `
                         <div class="website-entry">
                           <a href="${escapeHtml(
                             site
                           )}" target="_blank" rel="noopener noreferrer" class="company-website-link">${escapeHtml(
                         site
                       )}</a>
                           <button class="copy-btn" data-copy="${escapeHtml(
                             site
                           )}" title="Copiază link">📋</button>
                         </div>
                       `
                     )
                     .join("")
                 : "<p>--</p>"
             }
           </div>

           ${
             career.length > 0
               ? `
               <div class="company-website">
                 <h4>Cariere / Jobs:</h4>
                 ${career
                   .map(
                     (site) => `
                       <div class="website-entry">
                         <a href="${escapeHtml(
                           site
                         )}" target="_blank" rel="noopener noreferrer" class="company-website-link">${escapeHtml(
                       site
                     )}</a>
                         <button class="copy-btn" data-copy="${escapeHtml(
                           site
                         )}" title="Copiază link cariere">📋</button>
                       </div>
                     `
                   )
                   .join("")}
               </div>
               `
               : ""
           }
         </div>

         <div class="company-details-heading"> 
           <h3>Alte informații</h3>
         </div>
         <div class="company-details-data"> 
           <div class="code-field">
             <h4>Link scraper:</h4>
              ${
                scraper === "--"
                  ? `<p id="company-scraper">--</p>`
                  : `
                    <p>
                      <a href="${
                        scraper.startsWith("http")
                          ? escapeHtml(scraper)
                          : `https://github.com/peviitor-scrapers/${escapeHtml(
                              scraper
                            )}`
                      }" target="_blank" rel="noopener noreferrer" id="company-scraper">${escapeHtml(
                      scraper
                    )}</a>
                      <button class="copy-btn" data-copy="${escapeHtml(
                        scraper
                      )}" title="Copiază scraper">📋</button>
                    </p>
                    `
              }
           </div>
           <div class="code-field">
             <h4>Link logo:</h4>
              ${
                logo === "--"
                  ? `<p id="company-logo">--</p>`
                  : `
                    <p>
                      <a href="${escapeHtml(
                        logo
                      )}" target="_blank" rel="noopener noreferrer" id="company-logo">${escapeHtml(
                      logo
                    )}</a>
                      <button class="copy-btn" data-copy="${escapeHtml(
                        logo
                      )}" title="Copiază logo">📋</button>
                    </p>
                    `
              }
           </div>
         </div>
       </div>
    `;

    document.getElementById("company-card").innerHTML = htmlContent;

    // Attach copy to clipboard event listeners
    document.querySelectorAll(".copy-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const text = btn.getAttribute("data-copy");
        try {
          await navigator.clipboard.writeText(text);

          const original = btn.innerHTML;
          btn.innerHTML = "✅";
          btn.disabled = true;
          setTimeout(() => {
            btn.innerHTML = original;
            btn.disabled = false;
          }, 1500);
        } catch (err) {
          console.error("Clipboard copy failed:", err);
        }
      });
    });
  } catch (error) {
    console.error("Failed to load company details:", error);
    document.getElementById("company-card").innerText =
      "Eroare la încărcarea companiei.";
  }
}

loadCompanyDetails();
