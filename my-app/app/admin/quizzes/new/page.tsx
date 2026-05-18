"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminCreateQuiz } from "@/lib/api";

type QType = "choice" | "text" | "match";

interface AnswerRow {
  text: string;
  is_correct: boolean;
  order_index: number;
}

interface QuestionForm {
  text: string;
  question_type: QType;
  answers: AnswerRow[];
  correctText: string;
  matchRows: { left: string; right: string }[];
}

const emptyChoiceAnswers = (): AnswerRow[] => [
  { text: "", is_correct: true, order_index: 0 },
  { text: "", is_correct: false, order_index: 1 },
];

const emptyQuestion = (): QuestionForm => ({
  text: "",
  question_type: "choice",
  answers: emptyChoiceAnswers(),
  correctText: "",
  matchRows: [{ left: "", right: "" }],
});

export default function NewQuizPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [passThreshold, setPassThreshold] = useState(0);
  const [oneAttempt, setOneAttempt] = useState(false);
  const [showAnswers, setShowAnswers] = useState(false);
  const [questions, setQuestions] = useState<QuestionForm[]>([emptyQuestion()]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const addQuestion = () => setQuestions([...questions, emptyQuestion()]);

  const removeQuestion = (qi: number) => setQuestions(questions.filter((_, i) => i !== qi));

  const updateQuestionText = (qi: number, text: string) =>
    setQuestions(questions.map((q, i) => (i === qi ? { ...q, text } : q)));

  const setQuestionType = (qi: number, t: QType) =>
    setQuestions(
      questions.map((q, i) => {
        if (i !== qi) return q;
        if (t === "choice") return { ...q, question_type: "choice", answers: emptyChoiceAnswers() };
        if (t === "text") return { ...q, question_type: "text", answers: [], correctText: "", matchRows: [{ left: "", right: "" }] };
        return { ...q, question_type: "match", answers: [], correctText: "", matchRows: [{ left: "", right: "" }] };
      })
    );

  const addAnswer = (qi: number) =>
    setQuestions(
      questions.map((q, i) =>
        i === qi
          ? {
              ...q,
              answers: [
                ...q.answers,
                { text: "", is_correct: false, order_index: q.answers.length },
              ],
            }
          : q
      )
    );

  const removeAnswer = (qi: number, ai: number) =>
    setQuestions(
      questions.map((q, i) =>
        i === qi ? { ...q, answers: q.answers.filter((_, j) => j !== ai) } : q
      )
    );

  const updateAnswer = (qi: number, ai: number, text: string) =>
    setQuestions(
      questions.map((q, i) =>
        i === qi ? { ...q, answers: q.answers.map((a, j) => (j === ai ? { ...a, text } : a)) } : q
      )
    );

  const setCorrect = (qi: number, ai: number) =>
    setQuestions(
      questions.map((q, i) =>
        i === qi
          ? { ...q, answers: q.answers.map((a, j) => ({ ...a, is_correct: j === ai })) }
          : q
      )
    );

  const updateCorrectText = (qi: number, v: string) =>
    setQuestions(questions.map((q, i) => (i === qi ? { ...q, correctText: v } : q)));

  const addMatchRow = (qi: number) =>
    setQuestions(
      questions.map((q, i) =>
        i === qi ? { ...q, matchRows: [...q.matchRows, { left: "", right: "" }] } : q
      )
    );

  const removeMatchRow = (qi: number, ri: number) =>
    setQuestions(
      questions.map((q, i) =>
        i === qi && q.matchRows.length > 1
          ? { ...q, matchRows: q.matchRows.filter((_, j) => j !== ri) }
          : q
      )
    );

  const updateMatchRow = (qi: number, ri: number, field: "left" | "right", v: string) =>
    setQuestions(
      questions.map((q, i) =>
        i === qi
          ? {
              ...q,
              matchRows: q.matchRows.map((row, j) => (j === ri ? { ...row, [field]: v } : row)),
            }
          : q
      )
    );

  const validate = () => {
    if (!title.trim()) {
      setError("Введите название");
      return false;
    }
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text.trim()) {
        setError(`Заполните текст вопроса ${i + 1}`);
        return false;
      }
      if (q.question_type === "choice") {
        if (q.answers.length < 2) {
          setError(`Вопрос ${i + 1}: минимум 2 варианта ответа`);
          return false;
        }
        if (!q.answers.some((a) => a.is_correct === true)) {
          setError(`Вопрос ${i + 1}: отметьте правильный вариант`);
          return false;
        }
        if (q.answers.some((a) => !String(a.text ?? "").trim())) {
          setError(`Вопрос ${i + 1}: заполните все варианты`);
          return false;
        }
      }
      if (q.question_type === "text") {
        if (!q.correctText.trim()) {
          setError(`Вопрос ${i + 1}: укажите эталонный ответ`);
          return false;
        }
      }
      if (q.question_type === "match") {
        if (!q.matchRows.length) {
          setError(`Вопрос ${i + 1}: добавьте хотя бы одну пару`);
          return false;
        }
        for (let r = 0; r < q.matchRows.length; r++) {
          if (!q.matchRows[r].left.trim() || !q.matchRows[r].right.trim()) {
            setError(`Вопрос ${i + 1}: заполните левую и правую колонку в строке ${r + 1}`);
            return false;
          }
        }
      }
    }
    return true;
  };

  const buildApiQuestions = () =>
    questions.map((q, qi) => {
      if (q.question_type === "text") {
        return {
          text: q.text,
          order_index: qi,
          question_type: "text",
          answers: [
            { text: q.correctText.trim(), is_correct: true, order_index: 0 },
            { text: "", is_correct: false, order_index: 1 },
          ],
        };
      }
      if (q.question_type === "match") {
        const answers: { text: string; is_correct: boolean; order_index: number }[] = [];
        q.matchRows.forEach((row, i) => {
          answers.push({ text: row.left.trim(), is_correct: false, order_index: 2 * i });
          answers.push({ text: row.right.trim(), is_correct: false, order_index: 2 * i + 1 });
        });
        return {
          text: q.text,
          order_index: qi,
          question_type: "match",
          answers,
        };
      }
      return {
        text: q.text,
        order_index: qi,
        question_type: "choice",
        answers: q.answers.map((a, ai) => ({
          text: a.text.trim(),
          is_correct: a.is_correct === true,
          order_index: ai,
        })),
      };
    });

  const handleSave = async () => {
    setError("");
    if (!validate()) return;

    setLoading(true);
    try {
      await adminCreateQuiz({
        title: title.trim(),
        is_published: isPublished,
        pass_threshold: passThreshold,
        one_attempt: oneAttempt,
        show_answers: showAnswers,
        questions: buildApiQuestions(),
      });
      router.push("/admin/quizzes");
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? String((e as { response?: { data?: { message?: string } } }).response?.data?.message ?? "Ошибка сохранения")
          : "Ошибка сохранения";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
        <button className="btn btn-gray" onClick={() => router.push("/admin/quizzes")}>
          ← Назад
        </button>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Новый квиз</h1>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Настройки</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <input className="input" placeholder="Название квиза *" value={title} onChange={(e) => setTitle(e.target.value)} />

          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} />
              Опубликовать сразу
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={oneAttempt} onChange={(e) => setOneAttempt(e.target.checked)} />
              Одна попытка
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={showAnswers} onChange={(e) => setShowAnswers(e.target.checked)} />
              Показать ответы после
            </label>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <label style={{ whiteSpace: "nowrap" }}>Порог прохождения %:</label>
            <input
              className="input"
              type="number"
              min={0}
              max={100}
              value={passThreshold}
              onChange={(e) => setPassThreshold(Number(e.target.value))}
              style={{ width: 100 }}
            />
          </div>
        </div>
      </div>

      {questions.map((q, qi) => (
        <div key={qi} className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ fontWeight: 600 }}>Вопрос {qi + 1}</h3>
            {questions.length > 1 && (
              <button className="btn btn-danger" style={{ padding: "6px 12px" }} onClick={() => removeQuestion(qi)}>
                ✕
              </button>
            )}
          </div>

          <label style={{ display: "block", fontSize: 13, color: "#64748b", marginBottom: 6 }}>Тип вопроса</label>
          <select
            className="input"
            value={q.question_type}
            onChange={(e) => setQuestionType(qi, e.target.value as QType)}
            style={{ marginBottom: 12, maxWidth: 280 }}
          >
            <option value="choice">Выбор из вариантов</option>
            <option value="text">Свободный ввод</option>
            <option value="match">Сопоставление (пары лево → право)</option>
          </select>

          <input
            className="input"
            placeholder="Текст вопроса *"
            value={q.text}
            onChange={(e) => updateQuestionText(qi, e.target.value)}
            style={{ marginBottom: 12 }}
          />

          {q.question_type === "choice" && (
            <>
              {q.answers.map((a, ai) => (
                <div key={ai} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <input type="radio" name={`correct-${qi}`} checked={a.is_correct === true} onChange={() => setCorrect(qi, ai)} title="Правильный" />
                  <input
                    className="input"
                    placeholder={`Вариант ${ai + 1}`}
                    value={a.text ?? ""}
                    onChange={(e) => updateAnswer(qi, ai, e.target.value)}
                  />
                  {q.answers.length > 2 && (
                    <button className="btn btn-danger" style={{ padding: "6px 10px", whiteSpace: "nowrap" }} onClick={() => removeAnswer(qi, ai)}>
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button className="btn btn-gray" style={{ marginTop: 8 }} onClick={() => addAnswer(qi)}>
                + Вариант
              </button>
            </>
          )}

          {q.question_type === "text" && (
            <div>
              <label style={{ fontSize: 14, color: "#555" }}>Эталонный ответ (без учёта регистра)</label>
              <input
                className="input"
                placeholder="Правильный текст"
                value={q.correctText}
                onChange={(e) => updateCorrectText(qi, e.target.value)}
                style={{ marginTop: 6 }}
              />
            </div>
          )}

          {q.question_type === "match" && (
            <div>
              <p style={{ fontSize: 13, color: "#64748b", marginBottom: 10 }}>
                Каждая строка — пара «элемент слева» и «правильный ответ справа». Ученику слева покажут в заданном порядке, справа — все варианты из
                колонки в одном списке выбора.
              </p>
              {q.matchRows.map((row, ri) => (
                <div key={ri} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                  <input
                    className="input"
                    placeholder="Слева"
                    value={row.left}
                    onChange={(e) => updateMatchRow(qi, ri, "left", e.target.value)}
                  />
                  <span style={{ color: "#94a3b8" }}>→</span>
                  <input
                    className="input"
                    placeholder="Справа (верно для этой строки)"
                    value={row.right}
                    onChange={(e) => updateMatchRow(qi, ri, "right", e.target.value)}
                  />
                  {q.matchRows.length > 1 && (
                    <button className="btn btn-danger" style={{ padding: "6px 10px" }} onClick={() => removeMatchRow(qi, ri)}>
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button className="btn btn-gray" style={{ marginTop: 4 }} onClick={() => addMatchRow(qi)}>
                + Строка сопоставления
              </button>
            </div>
          )}
        </div>
      ))}

      <button className="btn btn-gray" style={{ marginBottom: 24, width: "100%" }} onClick={addQuestion}>
        + Добавить вопрос
      </button>

      {error && <div className="error" style={{ marginBottom: 16 }}>{error}</div>}

      <button className="btn btn-primary" style={{ width: "100%", padding: 14 }} onClick={handleSave} disabled={loading}>
        {loading ? "Сохранение..." : "Сохранить квиз"}
      </button>
    </div>
  );
}
