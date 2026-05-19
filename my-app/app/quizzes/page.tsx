"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getQuizzes } from "@/lib/api";
import { getRole, logout } from "@/lib/auth";
import {
  type QuizListItem,
  clearDraftIfCompleted,
  getStatusLabel,
  handleQuizNavigate,
} from "@/lib/quizStatus";

export default function QuizzesPage() {
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<QuizListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadQuizzes();
  }, []);

  const loadQuizzes = async () => {
    try {
      const res = await getQuizzes();
      const list = res.data.quizzes as QuizListItem[];
      list.forEach(clearDraftIfCompleted);
      setQuizzes(list);
    } catch {
      setError("Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ paddingTop: 40 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700 }}>Доступные квизы</h1>
        <div style={{ display: "flex", gap: 8 }}>
          {getRole() === "admin" && (
            <button className="btn btn-gray" onClick={() => router.push("/hub")}>
              Главное меню
            </button>
          )}
          {getRole() === "admin" && (
            <button className="btn btn-gray" onClick={() => router.push("/admin/quizzes")}>
              Админка
            </button>
          )}
          <button
            className="btn btn-gray"
            onClick={() => {
              logout();
              router.push("/login");
            }}
          >
            Выйти
          </button>
        </div>
      </div>

      {error && (
        <div className="error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}
      {loading && <p>Загрузка...</p>}

      {!loading && quizzes.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: 60, color: "#888" }}>
          <p style={{ fontSize: 18 }}>Пока нет доступных квизов</p>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
                <h3 style={{ fontSize: 18, fontWeight: 600 }}>{quiz.title}</h3>
                <p style={{ color: "#888", marginTop: 4, fontSize: 14 }}>
                  {quiz.question_count} вопросов
                  {getRole() === "admin" && quiz.is_published === false && (
                    <span style={{ marginLeft: 8, color: "#f59e0b", fontWeight: 600 }}>· черновик</span>
                  )}
                  {quiz.status === "completed" && (
                    <span style={{ marginLeft: 12, fontWeight: 600 }}>
                      {quiz.percent}% ({quiz.score}/{quiz.question_count})
                    </span>
                  )}
                  {quiz.one_attempt && (
                    <span style={{ marginLeft: 8, color: "#64748b" }}>· одна попытка</span>
                  )}
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
    </div>
  );
}
