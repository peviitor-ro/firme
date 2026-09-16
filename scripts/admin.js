// Admin Panel Main Controller
import { showFlash, formatPhoneNumber } from "./utils.js";
import {
  searchCompanyApi,
  addFieldApi,
  deleteFieldApi,
  updateDenumireApi,
} from "./admin/adminApi.js";
import {
  displayFirmAdminDetails,
  setOverviewLoading,
  populateInfoField,
} from "./admin/adminUi.js";

/**
 * Handle search company by name or CUI
 */
async function searchCompanyAdmin(queryValue = null) {
  const inputEl = document.getElementById("searchId");
  const query = (queryValue !== null ? queryValue : inputEl ? inputEl.value : "").trim();
  const flashArea = document.getElementById("errorMessage");
  const container = document.getElementById("firmDetailsContainer");

  if (flashArea) flashArea.replaceChildren();
  if (container) container.replaceChildren();

  if (!query) {
    showFlash(flashArea, "Introduceți denumirea companiei sau CUI/CIF.", "error");
    return;
  }

  try {
    const docs = await searchCompanyApi(query);

    if (!docs || docs.length === 0) {
      showFlash(flashArea, "Nu a fost găsită nicio firmă pentru căutarea specificată.", "error");
      return;
    }

    displayFirmAdminDetails(docs, {
      onUpdateField: handleUpdateField,
      onDeleteField: handleDeleteField,
      onUpdateDenumire: handleUpdateDenumire,
    });
  } catch (error) {
    console.error("Search failed:", error);
    showFlash(flashArea, `Căutarea a eșuat: ${error.message}`, "error");
  }
}

/**
 * Handle Add/Update field value
 */
async function handleUpdateField(firm, field, value, flashArea, card, inputEl) {
  let cleanValue = value ? value.trim() : "";

  if (!cleanValue) {
    showFlash(flashArea, `Introduceți o valoare pentru ${field}.`, "error");
    return;
  }

  if (field === "email") {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanValue)) {
      showFlash(flashArea, "Format de email invalid.", "error");
      return;
    }
  }

  if (field === "logo") {
    const urlRegex = /^https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/.*)?$/;
    if (!urlRegex.test(cleanValue)) {
      showFlash(
        flashArea,
        "URL logo invalid. Trebuie să înceapă cu http:// sau https:// (ex: https://exemplu.ro/logo.png).",
        "error"
      );
      return;
    }
  }

  if (field === "phone") {
    cleanValue = cleanValue.replace(/[\s\(\)-]/g, "");
    const phoneCleanRegex = /^\+?\d+$/;
    if (!phoneCleanRegex.test(cleanValue)) {
      showFlash(flashArea, "Numărul de telefon trebuie să condatabind doar cifre (opțional '+' la început).", "error");
      return;
    }
  }

  if (Array.isArray(firm[field]) && firm[field].includes(cleanValue)) {
    showFlash(flashArea, `Valoarea "${cleanValue}" există deja pentru ${field}.`, "error");
    return;
  }

  setOverviewLoading(card, true, `Se adaugă ${field}...`);

  try {
    await addFieldApi(firm.id, field, cleanValue);

    if (Array.isArray(firm[field])) {
      firm[field].push(cleanValue);
    } else if (firm[field]) {
      firm[field] = [firm[field], cleanValue];
    } else {
      firm[field] = [cleanValue];
    }

    let newInputValue = cleanValue;
    if (field === "phone") newInputValue = formatPhoneNumber(cleanValue);
    inputEl.value = newInputValue;

    let fieldElement = card.querySelector(`[data-field="${field}"]`);
    if (!fieldElement) {
      const overviewGrid = card.querySelector(".overview-grid");
      if (overviewGrid) {
        fieldElement = document.createElement("div");
        fieldElement.className = "info-field";
        fieldElement.setAttribute("data-field", field);
        overviewGrid.appendChild(fieldElement);
      }
    }

    if (fieldElement) {
      populateInfoField(fieldElement, field, firm[field]);
    }

    showFlash(flashArea, `${field} adăugat cu succes!`, "success");
  } catch (error) {
    console.error("Add field failed:", error);
    showFlash(flashArea, `Eroare la adăugare: ${error.message}`, "error");
  } finally {
    setOverviewLoading(card, false);
  }
}

/**
 * Handle Delete field value
 */
async function handleDeleteField(firm, field, value, flashArea, card, inputEl) {
  let cleanValue = value ? value.trim() : "";
  if (field === "phone") {
    cleanValue = cleanValue.replace(/[\s\(\)-]/g, "");
  }

  if (!cleanValue) {
    showFlash(flashArea, `Nu există o valoare pentru ${field} care să fie ștearsă.`, "error");
    return;
  }

  setOverviewLoading(card, true, `Se șterge ${field}...`);

  try {
    await deleteFieldApi(firm.id, field, cleanValue);

    if (Array.isArray(firm[field])) {
      firm[field] = firm[field].filter((item) => item !== cleanValue);
      if (firm[field].length === 0) firm[field] = null;
    } else {
      firm[field] = null;
    }

    let newInputValue =
      Array.isArray(firm[field]) && firm[field].length > 0
        ? firm[field][firm[field].length - 1]
        : "";

    if (field === "phone") newInputValue = formatPhoneNumber(newInputValue);
    inputEl.value = newInputValue;

    const fieldElement = card.querySelector(`[data-field="${field}"]`);
    if (fieldElement) {
      const hasContent = populateInfoField(fieldElement, field, firm[field]);
      if (!hasContent) {
        // Remove empty info-field card from .overview-grid so no empty card remains
        fieldElement.remove();
      }
    }

    showFlash(flashArea, `${field} șters cu succes!`, "success");
  } catch (error) {
    console.error("Delete field failed:", error);
    showFlash(flashArea, `Eroare la ștergere: ${error.message}`, "error");
  } finally {
    setOverviewLoading(card, false);
  }
}

/**
 * Handle Update company name (denumire)
 */
async function handleUpdateDenumire(firm, newValue, flashArea, card, inputEl) {
  const cleanName = newValue ? newValue.trim() : "";
  if (!cleanName) {
    showFlash(flashArea, "Denumirea companiei nu poate fi goală.", "error");
    return;
  }

  setOverviewLoading(card, true, "Se actualizează denumirea...");

  try {
    await updateDenumireApi(firm.id, cleanName);

    firm.denumire = [cleanName];
    firm.company = cleanName;

    const fieldElement =
      card.querySelector('[data-field="denumire"]') ||
      card.querySelector('[data-field="company"]');
    if (fieldElement) {
      const strong = document.createElement("strong");
      strong.textContent = "DENUMIRE:";
      const span = document.createElement("span");
      span.textContent = cleanName;
      fieldElement.replaceChildren(strong, span);
    }

    const headerTitle = card.querySelector(".card-admin-header-title h2");
    if (headerTitle) {
      headerTitle.textContent = cleanName;
    }

    const profileLink = card.querySelector(".card-admin-view-profile-link");
    if (profileLink) {
      const cuiVal = firm.id || firm.cui || "";
      profileLink.href = `companie.html?id=${encodeURIComponent(
        cuiVal
      )}&name=${encodeURIComponent(cleanName)}`;
    }

    showFlash(flashArea, "Denumire actualizată cu succes!", "success");
  } catch (error) {
    console.error("Update denumire failed:", error);
    showFlash(flashArea, `Eroare la actualizare denumire: ${error.message}`, "error");
  } finally {
    setOverviewLoading(card, false);
  }
}

// Initialise event listeners and check URL parameters on load
document.addEventListener("DOMContentLoaded", () => {
  const searchForm = document.querySelector(".search-admin-form");
  if (searchForm) {
    searchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      searchCompanyAdmin();
    });
  }

  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const name = params.get("name");
  const query = id || name;

  if (query) {
    const inputEl = document.getElementById("searchId");
    if (inputEl) inputEl.value = query;
    searchCompanyAdmin(query);
  }
});
