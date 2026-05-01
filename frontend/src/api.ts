export const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
  const token = localStorage.getItem("token");
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(endpoint, { ...options, headers });
  if (res.status === 401 && !endpoint.includes("/auth/login")) {
    localStorage.removeItem("token");
    window.location.reload();
  }
  return res;
};
