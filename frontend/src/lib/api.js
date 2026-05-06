import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const TOKEN_KEY = "sgp_access_token";

export function getToken() { return localStorage.getItem(TOKEN_KEY); }
export function setToken(t) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const t = getToken();
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && !err.config?._silent) {
      // token invalid -> clear
      setToken(null);
    }
    return Promise.reject(err);
  }
);

export default api;

export function formatApiErrorDetail(detail) {
  if (detail == null) return "Une erreur est survenue.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).filter(Boolean).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export function formatXOF(amount) {
  if (amount == null || isNaN(amount)) return "0 FCFA";
  return new Intl.NumberFormat("fr-FR").format(Math.round(amount)) + " FCFA";
}
