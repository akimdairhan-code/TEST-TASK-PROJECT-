const canUseStorage = () => typeof window !== "undefined";

export const saveAuth = (token: string, role: string) => {
  if (!canUseStorage()) return;
  localStorage.setItem("token", token);
  localStorage.setItem("role", role);
};

export const getRole = (): string | null => {
  if (!canUseStorage()) return null;
  return localStorage.getItem("role");
};

export const getToken = (): string | null => {
  if (!canUseStorage()) return null;
  return localStorage.getItem("token");
};

export const logout = () => {
  if (!canUseStorage()) return;
  localStorage.removeItem("token");
  localStorage.removeItem("role");
};

export const isLoggedIn = () => {
  if (!canUseStorage()) return false;
  return !!localStorage.getItem("token");
};
