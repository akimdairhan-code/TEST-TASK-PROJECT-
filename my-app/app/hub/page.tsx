"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getRole, isLoggedIn, logout } from "@/lib/auth";

export default function HubPage() {
  const router = useRouter();

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
      return;
    }
    if (getRole() !== "admin") {
      router.replace("/quizzes");
    }
  }, [router]);

  return (
    <div className="container" style={{ paddingTop: 48, maxWidth: 520 }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 8 }}>Главное меню</h1>
      <p style={{ color: "#64748b", marginBottom: 28 }}>Выберите раздел</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <button className="btn btn-primary" style={{ padding: 16, fontSize: 16 }} onClick={() => router.push("/admin/quizzes")}>
          Управление квизами
        </button>
        <button className="btn btn-success" style={{ padding: 16, fontSize: 16 }} onClick={() => router.push("/quizzes")}>
          Пройти квизы (как пользователь)
        </button>
        <button
          className="btn btn-gray"
          style={{ padding: 14 }}
          onClick={() => {
            logout();
            router.push("/login");
          }}
        >
          Выйти
        </button>
      </div>
    </div>
  );
}
