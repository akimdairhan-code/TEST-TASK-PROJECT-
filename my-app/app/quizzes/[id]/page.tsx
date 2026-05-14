"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { getQuiz, submitQuiz } from "@/lib/api";

interface Answer { id: string; text: string; }
interface Question {
  id: string;
  text: string;
  question_type: string;
  answers: Answer[];
}

export default function QuizPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [questions, setQuestions] = useState<Question[]>([]);
  const [title, setTitle] = useState("");
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [textAnswers, setTextAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { loadQuiz(); }, []);

  const loadQuiz = async () => {
    try {
      const res = await getQuiz(id);
      setTitle(res.data.quiz.title);
      setQuestions(res.data.quiz.questions);
    } catch (e: any) {
      const msg = e.response?.data?.message || "";
      if (msg.includes("уже проходили")) {
        router.push(`/quizzes/${id}/result`);
      } else {
        setError("Ошибка загрузки квиза");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const answers = questions.map((q) => {
        if (q.question_type === "text") {
          return { question_id: q.id, answer_id: "", text_answer: textAnswers[q.id] || "" };
        }
        return { question_id: q.id, answer_id: selected[q.id] || "" };
      });
      const res = await submitQuiz(id, answers);
      localStorage.setItem("quiz_result", JSON.stringify(res.data));
      router.push(`/quizzes/${id}/result`);
    } catch (e: any) {
      const msg = e.response?.data?.message || "Ошибка отправки";
      if (msg.includes("уже проходили")) {
        router.push(`/quizzes/${id}/result`);
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div style={{ padding: 40 }}>Загрузка...</div>;
  if (error && questions.length === 0) return (
    <div style={{ padding: 40 }}>
      <div className="error">{error}</div>
      <button className="btn btn-gray" style={{ marginTop: 16 }} onClick={() => router.push("/quizzes")}>← Назад</button>
    </div>
  );

  const question = questions[current];

  const renderQuestion = (q: Question) => {
    if (q.question_type === "text") {
      return (
        <div>
          <input
            type="text"
            value={textAnswers[q.id] || ""}
            onChange={(e) => setTextAnswers({ ...textAnswers, [q.id]: e.target.value })}
            placeholder="Введите ваш ответ..."
            style={{
              width: "100%",
              padding: "14px 18px",
              border: "2px solid #e5e7eb",
              borderRadius: 10,
              fontSize: 16,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>
      );
    }

    if (q.question_type === "match") {
      const leftItems = q.answers.filter((_, i) => i % 2 === 0);
      const rightItems = q.answers.filter((_, i) => i % 2 !== 0);
      return (
        <div>
          <p style={{ color: "#888", fontSize: 14, marginBottom: 12 }}>Выберите правильное соответствие:</p>
          {leftItems.map((left, i) => (
            <div key={left.id} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <div style={{
                flex: 1, padding: "12px 16px", background: "#f3f4f6",
                borderRadius: 8, fontWeight: 600
              }}>
                {left.text}
              </div>
              <span>→</span>
              <select
                value={selected[`${q.id}_${left.id}`] || ""}
                onChange={(e) => setSelected({ ...selected, [`${q.id}_${left.id}`]: e.target.value })}
                style={{
                  flex: 1, padding: "12px 16px", border: "2px solid #e5e7eb",
                  borderRadius: 8, fontSize: 14, background: "white"
                }}
              >
                <option value="">Выберите...</option>
                {rightItems.map((right) => (
                  <option key={right.id} value={right.id}>{right.text}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      );
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {q.answers.map((answer) => {
          const isSelected = selected[q.id] === answer.id;
          return (
            <div
              key={answer.id}
              onClick={() => setSelected({ ...selected, [q.id]: answer.id })}
              style={{
                padding: "14px 18px",
                border: `2px solid ${isSelected ? "#6366f1" : "#e5e7eb"}`,
                borderRadius: 10,
                cursor: "pointer",
                background: isSelected ? "#eef2ff" : "white",
                fontWeight: isSelected ? 600 : 400,
                transition: "all 0.15s",
              }}
            >
              {answer.text}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="container" style={{ paddingTop: 40, maxWidth: 700 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <button className="btn btn-gray" onClick={() => router.push("/quizzes")}>← Назад</button>
        <span style={{ color: "#888", fontSize: 14 }}>Вопрос {current + 1} из {questions.length}</span>
      </div>

      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>{title}</h1>

      <div style={{ background: "#e5e7eb", borderRadius: 8, height: 6, marginBottom: 32 }}>
        <div style={{
          background: "#6366f1", height: 6, borderRadius: 8,
          width: `${((current + 1) / questions.length) * 100}%`,
          transition: "width 0.3s"
        }} />
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600 }}>{question.text}</h2>
          <span style={{
            fontSize: 12, padding: "4px 10px", borderRadius: 12,
            background: question.question_type === "text" ? "#fef3c7" :
              question.question_type === "match" ? "#ede9fe" : "#e0f2fe",
            color: question.question_type === "text" ? "#92400e" :
              question.question_type === "match" ? "#5b21b6" : "#0369a1",
          }}>
            {question.question_type === "text" ? "Свободный ввод" :
              question.question_type === "match" ? "Сопоставление" : "Выбор"}
          </span>
        </div>
        {renderQuestion(question)}
      </div>

      {error && <div className="error" style={{ marginTop: 16 }}>{error}</div>}

      <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
        {current > 0 && (
          <button className="btn btn-gray" style={{ flex: 1, padding: 14 }}
            onClick={() => setCurrent(current - 1)}>← Назад</button>
        )}
        {current < questions.length - 1 ? (
          <button className="btn btn-primary" style={{ flex: 1, padding: 14 }}
            onClick={() => { setError(""); setCurrent(current + 1); }}>
            Следующий →
          </button>
        ) : (
          <button className="btn btn-success" style={{ flex: 1, padding: 14 }}
            onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Отправка..." : "Завершить ✓"}
          </button>
        )}
      </div>
    </div>
  );
}