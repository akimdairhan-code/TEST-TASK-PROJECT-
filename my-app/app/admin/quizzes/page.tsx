"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { adminGetQuizzes, adminDeleteQuiz, adminPublishQuiz } from "@/lib/api";
import { getRole, logout } from "@/lib/auth";

interface Quiz {
  id: string;
  title: string;
  is_published: boolean;
  question_count: number;
}

export default function AdminQuizzesPage() {
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (getRole() !== "admin") {
      router.push("/login");
      return;
    }
    loadQuizzes();
  }, []);

  const loadQuizzes = async () => {
    try {
      const res = await adminGetQuizzes();
      setQuizzes(res.data.quizzes);
    } catch {
      setError("Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить квиз?")) return;
    try {
      await adminDeleteQuiz(id);
      setQuizzes(quizzes.filter((q) => q.id !== id));
    } catch {
      alert("Ошибка удаления");
    }
  };

  const handlePublish = async (id: string, current: boolean) => {
    try {
      await adminPublishQuiz(id, !current);
      setQuizzes(quizzes.map((q) => q.id === id ? { ...q, is_published: !current } : q));
    } catch {
      alert("Ошибка");
    }
  };

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <div className="container" style={{ paddingTop: 40 }}>
      {/* Шапка */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700 }}>Мои квизы</h1>
        <div style={{ display: "flex", gap: 12 }}>
          <button className="btn btn-gray" onClick={() => router.push("/hub")}>
            Главное меню
          </button>
          <button className="btn btn-primary" onClick={() => router.push("/admin/quizzes/new")}>
            + Создать квиз
          </button>
          <button className="btn btn-gray" onClick={handleLogout}>
            Выйти
          </button>
        </div>
      </div>

      {error && <div className="error" style={{ marginBottom: 16 }}>{error}</div>}
      {loading && <p>Загрузка...</p>}

      {/* Список */}
      {!loading && quizzes.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: 60, color: "#888" }}>
          <p style={{ fontSize: 18 }}>Квизов пока нет</p>
          <p style={{ marginTop: 8 }}>Нажмите «Создать квиз» чтобы начать</p>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {quizzes.map((quiz) => (
          <div key={quiz.id} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 600 }}>{quiz.title}</h3>
              <p style={{ color: "#888", marginTop: 4, fontSize: 14 }}>
                {quiz.question_count} вопросов ·{" "}
                <span style={{ color: quiz.is_published ? "#22c55e" : "#f59e0b", fontWeight: 600 }}>
                  {quiz.is_published ? "Опубликован" : "Черновик"}
                </span>
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {quiz.is_published && (
                <button className="btn btn-success" onClick={() => router.push(`/quizzes/${quiz.id}`)}>
                  Пройти тест
                </button>
              )}
              <button
                className="btn btn-gray"
                onClick={() => router.push(`/admin/quizzes/${quiz.id}/edit`)}
              >
                Редактировать
              </button>
              <button
                className={`btn ${quiz.is_published ? "btn-gray" : "btn-success"}`}
                onClick={() => handlePublish(quiz.id, quiz.is_published)}
              >
                {quiz.is_published ? "Скрыть" : "Опубликовать"}
              </button>
              <button className="btn btn-danger" onClick={() => handleDelete(quiz.id)}>
                Удалить
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}