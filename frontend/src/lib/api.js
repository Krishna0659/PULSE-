import axios from "axios";

// Base URL for the Pulse API gateway. Configurable via env, never hardcoded
// in call sites. The gateway proxies all 6 microservices.
export const API_BASE =
  process.env.REACT_APP_API_BASE_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

// Attach JWT to every request automatically.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("pulse_token");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Normalise error messages coming back from FastAPI ({detail: "..."}).
export function apiError(err) {
  const d = err?.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d) && d.length) return d[0]?.msg || "Validation error";
  if (err?.message === "Network Error")
    return "Cannot reach the Pulse API. Is the gateway running at " + API_BASE + "?";
  return err?.message || "Something went wrong";
}

// ---- Auth ---------------------------------------------------------------
export const authApi = {
  signup: (body) => api.post("/auth/signup", body),
  signupVerify: (phone_number, otp) => api.post("/auth/signup/verify-otp", { phone_number, otp }),
  signupResend: (phone_number) => api.post("/auth/signup/resend-otp", { phone_number }),
  login: (phone_number, password) => api.post("/auth/login", { phone_number, password }),
  loginVerify: (phone_number, otp) => api.post("/auth/login/verify-otp", { phone_number, otp }),
  forgot: (phone_number) => api.post("/auth/forgot-password", { phone_number }),
  reset: (phone_number, otp, new_password) =>
    api.post("/auth/reset-password", { phone_number, otp, new_password }),
  me: () => api.get("/auth/me"),
};

// ---- Merchants ----------------------------------------------------------
export const merchantApi = {
  list: () => api.get("/merchants"),
  get: (id) => api.get(`/merchants/${id}`),
  create: (body) => api.post("/merchants", body),
};

// ---- Ingestion (upload + simulate) -------------------------------------
export const ingestApi = {
  upload: (merchantId, file, stream = false, targetSeconds = 30, onUploadProgress) => {
    const formData = new FormData();
    formData.append("merchant_id", merchantId);
    formData.append("file", file);
    if (stream) {
      formData.append("stream", "true");
      formData.append("target_seconds", targetSeconds.toString());
    }
    return api.post("/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress,
    });
  },
  simulateStart: (body) => api.post("/simulate/start", body),
  simulateStop: (merchant_id) => api.post("/simulate/stop", { merchant_id }),
  simulateStatus: (merchant_id) => api.get(`/simulate/status/${merchant_id}`),
};

// ---- Features / Anomalies / Explain ------------------------------------
export const analyticsApi = {
  features: (id, range = "30d") =>
    api.get(`/merchants/${id}/features`, { params: { range } }),
  anomalies: (id, range = "30d") =>
    api.get(`/merchants/${id}/anomalies`, { params: { range } }),
  analyze: (id, day) =>
    api.post(`/merchants/${id}/analyze`, null, { params: day ? { day } : {} }),
  alerts: (id) => api.get(`/merchants/${id}/alerts`),
  explain: (id, day) =>
    api.post(`/merchants/${id}/explain`, null, { params: { day } }),
  acknowledge: (alertId) => api.post(`/alerts/${alertId}/acknowledge`),
  dismiss: (alertId) => api.post(`/alerts/${alertId}/dismiss`),
  audit: (entityType, entityId) => api.get(`/audit/${entityType}/${entityId}`),
};

export default api;
