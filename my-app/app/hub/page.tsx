"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getQuizzes } from "@/lib/api";
import { getRole, isLoggedIn, logout } from "@/lib/auth";
import QuizListPanel from "@/components/QuizListPanel";
import { type QuizListItem, clearDraftIfCompleted } from "@/lib/quizStatus";

export default function HubPage() {
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<QuizListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
      return;
    }
    if (getRole() !== "admin") {
      router.replace("/quizzes");
      return;
    }
    loadQuizzes();
  }, [router]);

  const loadQuizzes = async () => {
    try {
      const res = await getQuizzes();
      const list = res.data.quizzes as QuizListItem[];
      list.forEach(clearDraftIfCompleted);
      setQuizzes(list);
    } catch {
      setError("Не удалось загрузить квизы");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion className="container" style={{ paddingTop: 48, maxWidth: 720 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 6 }}>Главное меню</h1>
          <p style={{ color: "#64748b" }}>Статусы квизов и быстрые действия</p>
        </div>
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

      <div style={{ display: "flex", gap: 10, marginBottom: 28, flexWrap: "wrap" }}>
        <button className="btn btn-primary" onClick={() => router.push("/admin/quizzes")}>
          Управление квизами
        </button>
        <button className="btn btn-gray" onClick={() => router.push("/admin/quizzes/new")}>
          + Создать квиз
        </button>
      </motion>

      {error && (
        <div className="error" style={{ marginBottom: 16 }}>
          {error}
        </motion>
      )}

      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Мои квизы — пройти или продолжить</h2>
      {loading && <p style={{ color: "#888" }}>Загрузка...</p>}
      {!loading && (
        <QuizListPanel
          quizzes={quizzes}
          showUnpublishedBadge
          emptyMessage="Создайте квиз в разделе управления"
        />
      )}
    </motion>
  );
}
