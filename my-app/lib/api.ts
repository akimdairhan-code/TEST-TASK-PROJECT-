import axios from "axios";

const BASE_URL = "http://127.0.0.1:4000";

const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export type MatchPair = { left_answer_id: string; right_answer_id: string };

export type SubmitAnswerPayload = {
  question_id: string;
  answer_id?: string;
  text_answer?: string;
  match_pairs?: MatchPair[];
};

// ===== AUTH =====
export const register = (email: string, password: string, role: string) =>
  api.post("/auth/register", { email, password, role });

export const login = (email: string, password: string) =>
  api.post("/auth/login", { email, password });

// ===== ADMIN =====
export const adminGetQuizzes = () => api.get("/admin/quizzes");
export const adminGetQuiz = (id: string) => api.get(`/admin/quizzes/${id}`);
export const adminCreateQuiz = (data: unknown) => api.post("/admin/quizzes", data);
export const adminUpdateQuiz = (id: string, data: unknown) => api.put(`/admin/quizzes/${id}`, data);
export const adminDeleteQuiz = (id: string) => api.delete(`/admin/quizzes/${id}`);
export const adminPublishQuiz = (id: string, isPublished: boolean) =>
  api.patch(`/admin/quizzes/${id}/publish`, { is_published: isPublished });

// ===== USER =====
export const getQuizzes = () => api.get("/quizzes");
export const getQuiz = (id: string) => api.get(`/quizzes/${id}`);
export const getQuizResult = (id: string) => api.get(`/quizzes/${id}/result`);
export const submitQuiz = (id: string, answers: SubmitAnswerPayload[]) =>
  api.post(`/quizzes/${id}/submit`, { answers });
