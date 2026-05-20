import Client, { Local } from "./client";

const client = new Client(Local, {
  auth: () => (typeof window !== "undefined" ? localStorage.getItem("token") : null),
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
  client.auth.Register({ email, password, role });

export const login = (email: string, password: string) =>
  client.auth.Login({ email, password });

// ===== ADMIN =====
export const adminGetQuizzes = () => client.quiz.AdminListQuizzes();
export const adminGetQuiz = (id: string) => client.quiz.AdminGetQuiz(id);
export const adminCreateQuiz = (data: unknown) => client.quiz.AdminCreateQuiz(data as any);
export const adminUpdateQuiz = (id: string, data: unknown) => client.quiz.AdminUpdateQuiz(id, data as any);
export const adminDeleteQuiz = (id: string) => client.quiz.AdminDeleteQuiz(id);
export const adminPublishQuiz = (id: string, isPublished: boolean) =>
  client.quiz.AdminPublishQuiz(id, { is_published: isPublished });

// ===== USER =====
export const getQuizzes = () => client.quiz.ListQuizzes();
export const getQuiz = (id: string) => client.quiz.GetQuiz(id);
export const getQuizResult = (id: string) => client.quiz.GetQuizResult(id);
export const submitQuiz = (id: string, answers: SubmitAnswerPayload[]) =>
  client.quiz.SubmitQuiz(id, { answers });
