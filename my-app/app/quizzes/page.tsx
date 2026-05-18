"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getQuizzes } from "@/lib/api";
import { getRole, logout } from "@/lib/auth";

interface Quiz {
  id: string;
  title: string;
  question_count: number;
  one_attempt: boolean;
  status: string;
  score: number;
  percent: number;
  passed: boolean;
}

function draftKey(quizId: string) {
  return `quiz_draft_${quizId}`;
}

function hasLocalDraft(quizId: string) {
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

export default function QuizzesPage() {
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadQuizzes();
  }, []);

  const loadQuizzes = async () => {
    try {
      const res = await getQuizzes();
      const list = res.data.quizzes as Quiz[];
      setQuizzes(list);
      for (const q of list) {
        if (q.status === "completed" && hasLocalDraft(q.id)) {
          try {
            localStorage.removeItem(draftKey(q.id));
          } catch {
            /* ignore */
          }
        }
      }
    } catch {
      setError("Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  const getStatusLabel = (quiz: Quiz) => {
    if (quiz.status === "completed") {
      return quiz.passed
        ? { label: "✓ Завершён (пройден)", color: "#16a34a", bg: "#dcfce7" }
        : { label: "✓ Завершён (не пройден)", color: "#dc2626", bg: "#fee2e2" };
    }
    if (hasLocalDraft(quiz.id)) {
      return { label: "▶ Продолжить", color: "#ca8a04", bg: "#fef9c3" };
    }
    return { label: "Пройти →", color: "#6366f1", bg: "#eef2ff" };
  };

  const handleQuizClick = (quiz: Quiz) => {
    if (quiz.status === "completed" && quiz.one_attempt) {
      router.push(`/quizzes/${quiz.id}/result`);
      return;
    }
    router.push(`/quizzes/${quiz.id}`);
  };

  return (
    <div className="container" style={{ paddingTop: 40 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700 }}>Доступные квизы</h1>
        <div style={{ display: "flex", gap: 8 }}>
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
          return (
            <div
              key={quiz.id}
              className="card"
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}
            >
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 600 }}>{quiz.title}</h3>
                <p style={{ color: "#888", marginTop: 4, fontSize: 14 }}>
                  {quiz.question_count} вопросов
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
                  onClick={() => handleQuizClick(quiz)}
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
                    <button className="btn btn-gray" onClick={() => router.push(`/quizzes/${quiz.id}/result`)}>
                      Результат
                    </button>
                    {!quiz.one_attempt && (
                      <button className="btn btn-primary" onClick={() => router.push(`/quizzes/${quiz.id}`)}>
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
