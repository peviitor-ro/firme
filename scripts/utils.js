// Shared Utility Functions for Firme-Ro

/**
 * Safely escape HTML characters to prevent XSS
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Format Romanian phone numbers with proper spacing
 */
export function formatPhoneNumber(value) {
  if (!value) return "";
  let cleaned = String(value).replace(/[\s\(\)-]/g, "");

  const hasPlus = cleaned.startsWith("+");
  if (hasPlus) {
    cleaned = "+" + cleaned.slice(1).replace(/\D/g, "");
  } else {
    cleaned = cleaned.replace(/\D/g, "");
  }

  if (cleaned.length <= 3) {
    return cleaned;
  }

  const numDigits = hasPlus ? cleaned.slice(1) : cleaned;
  let formattedDigits = "";
  for (let i = 0; i < numDigits.length; i++) {
    formattedDigits += numDigits[i];
    if ((i + 1) % 3 === 0 && i !== numDigits.length - 1) {
      formattedDigits += " ";
    }
  }

  return hasPlus ? "+" + formattedDigits : formattedDigits;
}

/**
 * Generate clickable links for websites, emails, phone numbers, etc.
 */
export function createLink(key, value) {
  if (!value) return "-";

  let cleanValue = String(value).trim();
  if (key === "phone") {
    cleanValue = cleanValue.replace(/[\s\(\)-]/g, "");
  }

  let href = "";
  let target = "";
  let displayValue = value;

  switch (key) {
    case "website":
    case "scraper":
    case "career_page":
    case "logo":
      href = cleanValue.startsWith("http") ? cleanValue : `https://${cleanValue}`;
      target = "_blank";
      break;
    case "email":
      href = `mailto:${cleanValue}`;
      break;
    case "phone":
      href = `tel:${cleanValue}`;
      displayValue = formatPhoneNumber(value);
      break;
    default:
      return escapeHtml(value);
  }

  return `<a href="${href}"${target ? ` target="${target}" rel="noopener noreferrer"` : ""}>${escapeHtml(displayValue)}</a>`;
}

/**
 * Display inline flash status messages (success, error, info)
 */
export function showFlash(container, message, type = "success") {
  if (!container) return;
  container.replaceChildren();

  const msg = document.createElement("div");
  msg.className = `flash ${type}`;

  const iconClass =
    type === "success"
      ? "ri-checkbox-circle-line"
      : type === "error"
      ? "ri-error-warning-line"
      : "ri-information-line";

  const icon = document.createElement("i");
  icon.className = iconClass;

  const textSpan = document.createElement("span");
  textSpan.textContent = message;

  msg.append(icon, textSpan);
  container.appendChild(msg);

  setTimeout(() => {
    if (msg.parentElement) {
      msg.remove();
    }
  }, 4000);
}

/**
 * Safely extract and parse JSON payload from response text (ignoring PHP deprecation/warning notices)
 */
export async function fetchJsonSafely(url, options = {}) {
  const response = await fetch(url, options);
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

  throw new Error("Răspuns invalid primit de la server.");
}
