// Admin Panel API Service
import { fetchJsonSafely } from "../utils.js";

const BASE_API_URL = "https://api.peviitor.ro/v1/firme";

const ENDPOINT_MAP = {
  website: "website",
  scraper: "scraper",
  brands: "brand",
  email: "email",
  phone: "phone",
  logo: "logo",
};

/**
 * Search companies by CUI/CIF or Name
 */
export async function searchCompanyApi(query) {
  const cleanCif = query.replace(/^ro\s*/i, "").replace(/\D/g, "");
  const isCif = /^\d{3,}$/.test(cleanCif);

  let docs = [];

  // 1. If CIF, search via v1 search/?id=
  if (isCif && cleanCif) {
    try {
      const res = await fetchJsonSafely(
        `${BASE_API_URL}/search/?id=${encodeURIComponent(cleanCif)}`
      );
      if (Array.isArray(res)) {
        docs = res;
      } else if (res && Array.isArray(res.docs)) {
        docs = res.docs;
      }
    } catch (err) {
      console.warn("Search by CIF endpoint failed, trying qsearch:", err);
    }
  }

  // 2. Query search via v1 qsearch
  if (docs.length === 0) {
    const data = await fetchJsonSafely(
      `${BASE_API_URL}/qsearch/?q=${encodeURIComponent(query)}`
    );
    if (data && Array.isArray(data.docs)) {
      docs = data.docs;
    } else if (Array.isArray(data)) {
      docs = data;
    }
  }

  return docs;
}

/**
 * Add or append field value
 */
export async function addFieldApi(firmId, field, cleanValue) {
  if (!window.authManager || !window.authManager.isAuthenticated()) {
    throw new Error("Autentificare necesară pentru modificări.");
  }

  const endpoint = ENDPOINT_MAP[field] || field;
  const paramKey = field === "brands" ? "brands" : endpoint;

  const formData = new URLSearchParams();
  formData.append("id", firmId);
  formData.append(paramKey, cleanValue);

  const response = await window.authManager.authenticatedFetch(
    `${BASE_API_URL}/${endpoint}/add/`,
    { method: "POST", body: formData }
  );

  if (!response.ok) {
    let errorMsg = `Eroare server: ${response.status}`;
    try {
      const errorData = await response.json();
      if (errorData && errorData.error) {
        errorMsg = errorData.error;
      }
    } catch (e) {}
    throw new Error(errorMsg);
  }

  return response;
}

/**
 * Delete field value
 */
export async function deleteFieldApi(firmId, field, cleanValue) {
  if (!window.authManager || !window.authManager.isAuthenticated()) {
    throw new Error("Autentificare necesară pentru modificări.");
  }

  const endpoint = ENDPOINT_MAP[field] || field;
  const paramKey = field === "brands" ? "brands" : field;
  const payload = { id: firmId, [paramKey]: cleanValue };

  // v1/firme delete scripts accept POST and read php://input.
  // Content-Type: text/plain avoids triggering browser CORS OPTIONS preflight.
  const response = await window.authManager.authenticatedFetch(
    `${BASE_API_URL}/${endpoint}/delete/`,
    {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    throw new Error(`Eroare server: ${response.status}`);
  }

  return response;
}

/**
 * Update company name (denumire)
 */
export async function updateDenumireApi(firmId, cleanName) {
  if (!window.authManager || !window.authManager.isAuthenticated()) {
    throw new Error("Autentificare necesară pentru modificări.");
  }

  const payload = JSON.stringify({
    id: String(firmId),
    company: cleanName,
  });

  const response = await window.authManager.authenticatedFetch(
    `${BASE_API_URL}/company/add/`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: payload,
    }
  );

  let result = {};
  const rawText = await response.text();
  try {
    const objStart = rawText.indexOf("{");
    const objEnd = rawText.lastIndexOf("}");
    if (objStart !== -1 && objEnd !== -1) {
      result = JSON.parse(rawText.substring(objStart, objEnd + 1));
    }
  } catch (e) {
    console.warn("Could not parse Solr update response:", e);
  }

  if (!response.ok || (result.responseHeader && result.responseHeader.status !== 0)) {
    throw new Error(
      result.error && result.error.msg
        ? result.error.msg
        : `Eroare server: ${response.status}`
    );
  }

  return result;
}
