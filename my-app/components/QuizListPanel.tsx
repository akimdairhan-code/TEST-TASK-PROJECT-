"use client";

import { useRouter } from "next/navigation";
import {
  type QuizListItem,
  getStatusLabel,
  handleQuizNavigate,
} from "@/lib/quizStatus";

type Props = {
  quizzes: QuizListItem[];
  emptyMessage?: string;
  showUnpublishedBadge?: boolean;
};

export default function QuizListPanel({
  quizzes,
  emptyMessage = "Пока нет доступных квизов",
  showUnpublishedBadge = false,
}: Props) {
  const router = useRouter();

  if (quizzes.length === 0) {
    return (
      <div className="card" style={{ textAlign: "center", padding: 48, color: "#888" }}>
        <p style={{ fontSize: 17 }}>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {quizzes.map((quiz) => {
        const statusInfo = getStatusLabel(quiz);
        const canRetake = quiz.status === "completed" && !quiz.one_attempt;
        return (
          <div
            key={quiz.id}
            className="card"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div>
              <h3 style={{ fontSize: 17, fontWeight: 600 }}>{quiz.title}</h3>
              <p style={{ color: "#888", marginTop: 4, fontSize: 14 }}>
                {quiz.question_count} вопросов
                {showUnpublishedBadge && quiz.is_published === false && (
                  <span style={{ marginLeft: 8, color: "#f59e0b", fontWeight: 600 }}>· черновик</span>
                )}
                {quiz.status === "completed" && (
                  <span style={{ marginLeft: 12, fontWeight: 600 }}>
                    {quiz.score} / {quiz.percent}%
                  </span>
                )}
                {quiz.one_attempt && <span style={{ marginLeft: 8, color: "#64748b" }}>· одна попытка</span>}
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => handleQuizNavigate(quiz, router)}
                style={{
                  padding: "10px 20px",
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 14,
                  color: statusInfo.color,
                  background: statusInfo.bg,
                }}
              >
                {statusInfo.label}
              </button>
              {quiz.status === "completed" && (
                <>
                  <button
                    type="button"
                    className="btn btn-gray"
                    onClick={() => router.push(`/quizzes/${quiz.id}/result`)}
                  >
                    Результат
                  </button>
                  {canRetake && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => router.push(`/quizzes/${quiz.id}`)}
                    >
                      Снова
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
