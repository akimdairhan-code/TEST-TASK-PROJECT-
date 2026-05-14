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
      setQuizzes(res.data.quizzes);
    } catch {
      setError("Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  const getStatusLabel = (quiz: Quiz) => {
    if (quiz.status === "completed") {
      return quiz.passed
        ? { label: "✓ Пройден", color: "#16a34a", bg: "#dcfce7" }
        : { label: "✗ Не пройден", color: "#dc2626", bg: "#fee2e2" };
    }
    return { label: "Пройти →", color: "#6366f1", bg: "#eef2ff" };
  };

  const handleQuizClick = (quiz: Quiz) => {
    if (quiz.status === "completed" && quiz.one_attempt) {
      router.push(`/quizzes/${quiz.id}/result`);
    } else {
      router.push(`/quizzes/${quiz.id}`);
    }
  };

  return (
    <div className="container" style={{ paddingTop: 40 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700 }}>Доступные квизы</h1>
        <button className="btn btn-gray" onClick={() => { logout(); router.push("/login"); }}>Выйти</button>
      </div>

      {error && <div className="error" style={{ marginBottom: 16 }}>{error}</div>}
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
            <div key={quiz.id} className="card"
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 600 }}>{quiz.title}</h3>
                <p style={{ color: "#888", marginTop: 4, fontSize: 14 }}>
                  {quiz.question_count} вопросов
                  {quiz.status === "completed" && (
                    <span style={{ marginLeft: 12, fontWeight: 600 }}>
                      {quiz.score} / {quiz.percent}%
                    </span>
                  )}
                </p>
              </div>
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
            </div>
          );
        })}
      </div>
    </div>
  );
}