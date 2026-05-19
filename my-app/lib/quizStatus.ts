export interface QuizListItem {
  id: string;
  title: string;
  question_count: number;
  one_attempt: boolean;
  is_published?: boolean;
  status: string;
  score: number;
  percent: number;
  passed: boolean;
}

export function draftKey(quizId: string) {
  return `quiz_draft_${quizId}`;
}

export function hasLocalDraft(quizId: string) {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(draftKey(quizId));
    if (!raw) return false;
    const d = JSON.parse(raw) as { current?: number };
    return typeof d.current === "number";
  } catch {
    return false;
  }
}

export function clearDraftIfCompleted(quiz: QuizListItem) {
  if (quiz.status === "completed" && hasLocalDraft(quiz.id)) {
    try {
      localStorage.removeItem(draftKey(quiz.id));
    } catch {
      /* ignore */
    }
  }
}

export function getStatusLabel(quiz: QuizListItem) {
  if (quiz.status === "completed") {
    if (quiz.one_attempt) {
      return { label: "Результат", color: "#475569", bg: "#f1f5f9" };
    }
    return quiz.passed
      ? { label: "✅ Завершён (пройден)", color: "#16a34a", bg: "#dcfce7" }
      : { label: "❌ Завершён (не пройден)", color: "#dc2626", bg: "#fee2e2" };
  }
  if (hasLocalDraft(quiz.id)) {
    return { label: "▶ Продолжить", color: "#ca8a04", bg: "#fef9c3" };
  }
  return { label: "Пройти →", color: "#6366f1", bg: "#eef2ff" };
}

export function handleQuizNavigate(
  quiz: QuizListItem,
  router: { push: (path: string) => void }
) {
  if (quiz.status === "completed" && quiz.one_attempt) {
    router.push(`/quizzes/${quiz.id}/result`);
    return;
  }
  router.push(`/quizzes/${quiz.id}`);
}
