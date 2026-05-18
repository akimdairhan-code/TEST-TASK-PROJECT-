"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { login, register } from "@/lib/api";
import { saveAuth } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError("");
    if (!email || !password) {
      setError("Заполните все поля");
      return;
    }
    setLoading(true);
    try {
      const res = isLogin
        ? await login(email, password)
        : await register(email, password, role);

      saveAuth(res.data.token, res.data.role);
      router.push(res.data.role === "admin" ? "/hub" : "/quizzes");
    } catch (e: any) {
      setError(e.response?.data?.message || "Ошибка. Проверьте данные.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="card" style={{ width: 400 }}>
        <h2 style={{ marginBottom: 24, fontSize: 24, fontWeight: 700 }}>
          {isLogin ? "Вход" : "Регистрация"}
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <input
            className="input"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="input"
            type="password"
            placeholder="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {!isLogin && (
            <select
              className="input"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="user">Пользователь</option>
              <option value="admin">Администратор</option>
            </select>
          )}

          {error && <div className="error">{error}</div>}

          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? "Загрузка..." : isLogin ? "Войти" : "Зарегистрироваться"}
          </button>

          <button
            className="btn btn-gray"
            onClick={() => { setIsLogin(!isLogin); setError(""); }}
          >
            {isLogin ? "Нет аккаунта? Зарегистрироваться" : "Уже есть аккаунт? Войти"}
          </button>
        </div>
      </div>
    </div>
  );
}