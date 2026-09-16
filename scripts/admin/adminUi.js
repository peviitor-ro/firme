// Admin Panel UI Component Rendering
import { formatPhoneNumber } from "../utils.js";

const IMPORTANT_OVERVIEW_KEYS = [
  "id",
  "company",
  "denumire",
  "cui",
  "status",
  "website",
  "email",
  "phone",
  "brands",
  "logo",
  "scraper",
  "career_page",
  "location",
  "judet",
  "address",
];

const EDITABLE_FIELDS = [
  {
    key: "website",
    label: "Website",
    icon: "ri-global-line",
    placeholder: "https://exemplu.ro",
  },
  {
    key: "email",
    label: "Email",
    icon: "ri-mail-line",
    placeholder: "email@exemplu.ro",
  },
  {
    key: "phone",
    label: "Telefon",
    icon: "ri-phone-line",
    placeholder: "+40 7xx xxx xxx",
  },
  {
    key: "brands",
    label: "Branduri",
    icon: "ri-price-tag-3-line",
    placeholder: "Introduceți brand",
  },
  {
    key: "logo",
    label: "Logo URL",
    icon: "ri-image-line",
    placeholder: "https://exemplu.ro/logo.png",
  },
  {
    key: "scraper",
    label: "Scraper File",
    icon: "ri-code-line",
    placeholder: "Introduceți scraper",
  },
];

/**
 * Render field values (as links or text spans) into an .info-field DOM element
 */
export function populateInfoField(fieldElement, fieldKey, rawValue) {
  const strong = document.createElement("strong");
  strong.textContent = `${fieldKey.toUpperCase()}:`;

  const span = document.createElement("span");
  const values = Array.isArray(rawValue) ? rawValue : [rawValue];
  const validValues = values.filter(
    (v) => v !== null && v !== undefined && String(v).trim() !== "",
  );

  if (validValues.length === 0) {
    return false;
  }

  validValues.forEach((val, idx) => {
    if (idx > 0) {
      span.append(", ");
    }

    const strVal = String(val).trim();
    if (["website", "scraper", "career_page", "logo"].includes(fieldKey)) {
      const a = document.createElement("a");
      a.href = strVal.startsWith("http") ? strVal : `https://${strVal}`;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = strVal;
      span.appendChild(a);
    } else if (fieldKey === "email") {
      const a = document.createElement("a");
      a.href = `mailto:${strVal}`;
      a.textContent = strVal;
      span.appendChild(a);
    } else if (fieldKey === "phone") {
      const a = document.createElement("a");
      a.href = `tel:${strVal.replace(/[\s\(\)-]/g, "")}`;
      a.textContent = formatPhoneNumber(strVal);
      span.appendChild(a);
    } else {
      span.append(strVal);
    }
  });

  fieldElement.replaceChildren(strong, span);
  return true;
}

/**
 * Show or hide loading overlay on .card-admin-overview-section
 */
export function setOverviewLoading(
  card,
  isLoading,
  actionText = "Se actualizează datele...",
) {
  const overviewSection = card.querySelector(".card-admin-overview-section");
  if (!overviewSection) return;

  const existingOverlay = overviewSection.querySelector(
    ".overview-loading-overlay",
  );

  if (isLoading) {
    if (!existingOverlay) {
      const overlay = document.createElement("div");
      overlay.className = "overview-loading-overlay";

      const spinner = document.createElement("div");
      spinner.className = "overview-loading-spinner";

      const textBadge = document.createElement("span");
      textBadge.className = "overview-loading-text";

      const icon = document.createElement("i");
      icon.className = "ri-loader-4-line ri-spin";

      const textNode = document.createTextNode(` ${actionText}`);
      textBadge.append(icon, textNode);

      overlay.append(spinner, textBadge);
      overviewSection.appendChild(overlay);
    } else {
      const textBadge = existingOverlay.querySelector(".overview-loading-text");
      if (textBadge) {
        const icon = document.createElement("i");
        icon.className = "ri-loader-4-line ri-spin";
        textBadge.replaceChildren(
          icon,
          document.createTextNode(` ${actionText}`),
        );
      }
    }
  } else {
    if (existingOverlay) {
      existingOverlay.style.opacity = "0";
      existingOverlay.style.transition = "opacity 0.2s ease";
      setTimeout(() => {
        if (existingOverlay.parentElement) {
          existingOverlay.remove();
        }
      }, 200);
    }
  }
}

/**
 * Render list of company editable cards into #firmDetailsContainer
 */
export function displayFirmAdminDetails(firms, callbacks = {}) {
  const container = document.getElementById("firmDetailsContainer");
  if (!container) return;
  container.replaceChildren();

  const { onUpdateField, onDeleteField, onUpdateDenumire } = callbacks;
  const isAuthenticated =
    window.authManager && window.authManager.isAuthenticated();

  firms.forEach((firm) => {
    const card = document.createElement("div");
    card.className = "firm-admin-card";

    // Top Card Header with Company Title & CIF
    const cardHeader = document.createElement("div");
    cardHeader.className = "card-admin-top-header";

    let firmName =
      (Array.isArray(firm.denumire) && firm.denumire.length > 0
        ? firm.denumire[0]
        : firm.denumire) ||
      firm.company ||
      firm.name ||
      "Companie Fără Nume";

    const titleRow = document.createElement("div");
    titleRow.className = "card-admin-header-title";

    const headerIcon = document.createElement("i");
    headerIcon.className = "ri-building-line";

    const titleH2 = document.createElement("h2");
    titleH2.textContent = firmName;

    titleRow.append(headerIcon, titleH2);

    const cuiValue = firm.id || firm.cui;
    if (cuiValue) {
      const cuiPill = document.createElement("span");
      cuiPill.className = "cif-pill";
      cuiPill.textContent = `CUI: ${cuiValue}`;
      titleRow.appendChild(cuiPill);
    }

    const profileLink = document.createElement("a");
    profileLink.className = "card-admin-view-profile-link";
    profileLink.href = `companie.html?id=${encodeURIComponent(
      cuiValue || firm.id || "",
    )}&name=${encodeURIComponent(firmName)}`;
    profileLink.rel = "noopener noreferrer";
    profileLink.title = "Vezi pagina de profil a companiei";

    const linkSpan = document.createElement("span");
    linkSpan.textContent = "Profil Companie";

    const linkIcon = document.createElement("i");
    linkIcon.className = "ri-external-link-line";

    profileLink.append(linkSpan, linkIcon);

    cardHeader.append(titleRow, profileLink);
    card.appendChild(cardHeader);

    const cardContent = document.createElement("div");
    cardContent.className = "card-admin-content";

    // CATEGORY 1: Date Curente Firmă (Overview Grid)
    const overviewSection = document.createElement("div");
    overviewSection.className =
      "card-admin-section card-admin-overview-section";

    const overviewHeader = document.createElement("div");
    overviewHeader.className = "section-header";

    const overviewIcon = document.createElement("i");
    overviewIcon.className = "ri-information-line";

    const overviewH3 = document.createElement("h3");
    overviewH3.textContent = "Date Curente Firmă";

    overviewHeader.append(overviewIcon, overviewH3);
    overviewSection.appendChild(overviewHeader);

    const overviewGrid = document.createElement("div");
    overviewGrid.className = "overview-grid";

    IMPORTANT_OVERVIEW_KEYS.forEach((key) => {
      if (
        firm.hasOwnProperty(key) &&
        firm[key] !== undefined &&
        firm[key] !== null
      ) {
        const keyLower = key.toLowerCase();
        const element = document.createElement("div");
        element.className = "info-field";
        element.setAttribute("data-field", keyLower);

        const hasContent = populateInfoField(element, keyLower, firm[key]);
        if (hasContent) {
          overviewGrid.appendChild(element);
        }
      }
    });

    overviewSection.appendChild(overviewGrid);
    cardContent.appendChild(overviewSection);

    // CATEGORY 2: Formular Editare Date (Edit Form)
    const editSection = document.createElement("div");
    editSection.className = "card-admin-section card-admin-edit-section";

    const editHeader = document.createElement("div");
    editHeader.className = "section-header";

    const editIcon = document.createElement("i");
    editIcon.className = "ri-edit-box-line";

    const editH3 = document.createElement("h3");
    editH3.textContent = "Formular Modificare / Editare Date";

    editHeader.append(editIcon, editH3);
    editSection.appendChild(editHeader);

    const formGrid = document.createElement("div");
    formGrid.className = "form-grid";

    // 1. Denumire (Company Name) Group
    const denumireGroup = document.createElement("div");
    denumireGroup.className = "input-group";

    const denumireLabel = document.createElement("label");
    const denumireIcon = document.createElement("i");
    denumireIcon.className = "ri-building-2-line";
    denumireLabel.append(
      denumireIcon,
      document.createTextNode(" Denumire Firmă"),
    );

    const denumireInput = document.createElement("input");
    denumireInput.type = "text";
    denumireInput.value = firmName;

    const denumireBtnGroup = document.createElement("div");
    denumireBtnGroup.className = "button-group";

    const denumireFlash = document.createElement("div");
    denumireFlash.className = "field-flash";

    if (isAuthenticated) {
      const updateBtn = document.createElement("button");
      updateBtn.className = "btn-update";
      const saveIcon = document.createElement("i");
      saveIcon.className = "ri-save-line";
      updateBtn.append(saveIcon, document.createTextNode(" Actualizează"));
      updateBtn.onclick = () => {
        if (onUpdateDenumire) {
          onUpdateDenumire(
            firm,
            denumireInput.value,
            denumireFlash,
            card,
            denumireInput,
          );
        }
      };
      denumireBtnGroup.appendChild(updateBtn);
    } else {
      const disabledMsg = document.createElement("span");
      disabledMsg.className = "admin-disabled-notice";
      disabledMsg.textContent = "Autentificare necesară pentru editare";
      denumireBtnGroup.appendChild(disabledMsg);
      denumireInput.disabled = true;
    }

    denumireGroup.append(
      denumireLabel,
      denumireInput,
      denumireBtnGroup,
      denumireFlash,
    );
    formGrid.appendChild(denumireGroup);

    // 2. Dynamic Editable Fields
    EDITABLE_FIELDS.forEach(
      ({ key, label: fieldLabelText, icon, placeholder }) => {
        const group = document.createElement("div");
        group.className = "input-group";

        const label = document.createElement("label");
        const fieldIcon = document.createElement("i");
        fieldIcon.className = icon || "ri-input-cursor-move";
        label.append(fieldIcon, document.createTextNode(` ${fieldLabelText}`));

        const input = document.createElement("input");
        input.type = "text";

        let initialValue = "";
        if (Array.isArray(firm[key])) {
          initialValue =
            firm[key].length > 0 ? firm[key][firm[key].length - 1] : "";
        } else {
          initialValue = firm[key] || "";
        }

        if (key === "phone") {
          input.value = formatPhoneNumber(initialValue);
          input.addEventListener("input", (e) => {
            const cursorPosition = input.selectionStart;
            const oldValue = input.value;
            const newValue = formatPhoneNumber(e.target.value);
            input.value = newValue;
            const diff = newValue.length - oldValue.length;
            input.selectionEnd = cursorPosition + diff;
          });
        } else {
          input.value = initialValue;
        }

        input.placeholder =
          placeholder || `Introduceți ${fieldLabelText.toLowerCase()}`;

        const btnGroup = document.createElement("div");
        btnGroup.className = "button-group";

        const fieldFlash = document.createElement("div");
        fieldFlash.className = "field-flash";

        const addBtn = document.createElement("button");
        addBtn.className = "btn-add";
        const addIcon = document.createElement("i");
        addIcon.className = "ri-add-line";
        addBtn.append(addIcon, document.createTextNode(" Adaugă"));
        addBtn.onclick = () => {
          if (onUpdateField) {
            onUpdateField(firm, key, input.value, fieldFlash, card, input);
          }
        };

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "btn-delete";
        const deleteIcon = document.createElement("i");
        deleteIcon.className = "ri-delete-bin-line";
        deleteBtn.append(deleteIcon, document.createTextNode(" Șterge"));
        deleteBtn.onclick = () => {
          if (onDeleteField) {
            onDeleteField(firm, key, input.value, fieldFlash, card, input);
          }
        };

        if (isAuthenticated) {
          btnGroup.append(addBtn, deleteBtn);
        } else {
          const disabledMsg = document.createElement("span");
          disabledMsg.className = "admin-disabled-notice";
          disabledMsg.textContent = "Autentificare necesară";
          btnGroup.appendChild(disabledMsg);
          input.disabled = true;
        }

        group.append(label, input, btnGroup, fieldFlash);
        formGrid.appendChild(group);
      },
    );

    editSection.appendChild(formGrid);
    cardContent.appendChild(editSection);

    card.appendChild(cardContent);
    container.appendChild(card);
  });
}
