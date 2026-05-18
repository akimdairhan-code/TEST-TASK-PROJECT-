"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getRole, isLoggedIn } from "@/lib/auth";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push("/login");
      return;
    }
    const role = getRole();
    if (role === "admin") {
      router.replace("/hub");
    } else {
      router.replace("/quizzes");
    }
  }, [router]);

  return <div style={{ padding: 40 }}>Загрузка...</div>;
}
