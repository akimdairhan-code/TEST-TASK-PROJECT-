"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { getQuizResult } from "@/lib/api";
import { getRole } from "@/lib/auth";

interface Detail {
  question_text: string;
  your_answer: string;
  correct_answer: string;
  is_correct: boolean;
}

interface Result {
  quiz_id?: string;
  score: number;
  total: number;
  percent: number;
  passed: boolean;
  show_answers: boolean;
  details: Detail[];
}

function resultStorageKey(quizId: string) {
  return `quiz_result_${quizId}`;
}

function readStoredResult(quizId: string): Result | null {
  try {
    const keyed = localStorage.getItem(resultStorageKey(quizId));
    if (keyed) {
      const p = JSON.parse(keyed) as Result;
      if (!p.quiz_id || p.quiz_id === quizId) return p;
    }
    const legacy = localStorage.getItem("quiz_result");
    if (legacy) {
      const p = JSON.parse(legacy) as Result;
      if (p.quiz_id === quizId) return p;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export default function ResultPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [result, setResult] = useState<Result | null>(null);
  const [fetchError, setFetchError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setFetchError("");

    const cached = readStoredResult(id);
    if (cached) setResult(cached);

    getQuizResult(id)
      .then((res) => {
        if (cancelled) return;
        // Всегда подменяем кэш ответом с сервера (после правок квиза / старый localStorage давали пустой «Ваш ответ»).
        setResult(res.data as Result);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (cached) return;
        const msg =
          e && typeof e === "object" && "response" in e
            ? String(
                (e as { response?: { data?: { message?: string; code?: string } } }).response?.data?.message ??
                  (e as { response?: { data?: { code?: string } } }).response?.data?.code ??
                  ""
              )
            : "";
        setFetchError(msg || "Не удалось загрузить результат с сервера.");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleBack = () => {
    localStorage.removeItem(resultStorageKey(id));
    try {
      const legacy = localStorage.getItem("quiz_result");
      if (legacy) {
        const p = JSON.parse(legacy) as Result;
        if (p.quiz_id === id) localStorage.removeItem("quiz_result");
      }
    } catch {
      /* ignore */
    }
    const role = getRole();
    if (role === "admin") {
      router.push("/hub");
    } else {
      router.push("/quizzes");
    }
  };

  if (fetchError) {
    return (
      <div className="container" style={{ paddingTop: 40, maxWidth: 700 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 24 }}>Результат</h1>
        <div className="error" style={{ marginBottom: 16 }}>
          {fetchError}
        </div>
        <button className="btn btn-primary" style={{ width: "100%", padding: 14 }} onClick={() => router.push("/quizzes")}>
          ← К списку квизов
        </button>
      </div>
    );
  }

  if (!result) return <div style={{ padding: 40, textAlign: "center" }}>Загрузка...</div>;

  return (
    <div className="container" style={{ paddingTop: 40, maxWidth: 700 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 24 }}>Результат</h1>

      <div className="card" style={{ textAlign: "center", marginBottom: 24, padding: 40 }}>
        <div style={{ fontSize: 64, marginBottom: 8 }}>
          {result.percent >= 80 ? "🎉" : result.percent >= 50 ? "👍" : "😔"}
        </div>
        <h2 style={{ fontSize: 32, fontWeight: 700, color: "#6366f1" }}>{result.percent}%</h2>
        <p style={{ fontSize: 18, marginTop: 8, color: "#555" }}>
          Правильных ответов: <strong>{result.score}</strong> из <strong>{result.total}</strong>
        </p>
        <div
          style={{
            marginTop: 16,
            display: "inline-block",
            padding: "8px 20px",
            borderRadius: 20,
            background: result.passed ? "#dcfce7" : "#fee2e2",
            color: result.passed ? "#16a34a" : "#dc2626",
            fontWeight: 700,
            fontSize: 16,
          }}
        >
          {result.passed ? "✓ Тест пройден!" : "✗ Тест не пройден"}
        </div>
      </div>

      {result.show_answers && result.details && result.details.length > 0 && (
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Разбор ответов</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {result.details.map((d, i) => (
              <div
                key={i}
                className="card"
                style={{
                  borderLeft: `4px solid ${d.is_correct ? "#22c55e" : "#ef4444"}`,
                }}
              >
                <p style={{ fontWeight: 600, marginBottom: 8 }}>{d.question_text}</p>
                <p style={{ fontSize: 14, color: d.is_correct ? "#16a34a" : "#dc2626" }}>Ваш ответ: {d.your_answer}</p>
                {!d.is_correct && (
                  <p style={{ fontSize: 14, color: "#16a34a", marginTop: 4 }}>
                    Правильный: {d.correct_answer}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <button className="btn btn-primary" style={{ width: "100%", padding: 14, marginTop: 24 }} onClick={handleBack}>
        ← Назад
      </button>
    </div>
  );
}
