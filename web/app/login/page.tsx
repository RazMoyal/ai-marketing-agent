"use client";
import { useState } from "react";
import API, { setToken } from "@/lib/api";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string|undefined>();

  async function doLogin(e: any) {
    e.preventDefault();
    setError(undefined);
    try {
      const res = await API.post("/auth/login", { email, password });
      setToken(res.data.token);
      window.location.href = "/dashboard";
    } catch (e: any) {
      setError(e?.response?.data?.error || "שגיאה בהתחברות");
    }
  }

  return (
    <div className="max-w-md mx-auto mt-20 bg-neutral-900 p-6 rounded-2xl shadow">
      <h1 className="text-2xl font-bold mb-4">כניסה</h1>
      <form onSubmit={doLogin} className="space-y-3">
        <input className="w-full p-2 rounded bg-neutral-800" placeholder="אימייל" value={email} onChange={e=>setEmail(e.target.value)} />
        <input className="w-full p-2 rounded bg-neutral-800" placeholder="סיסמה" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        {error && <div className="text-red-400 text-sm">{error}</div>}
        <button className="w-full p-2 rounded bg-white text-black font-semibold">התחבר</button>
      </form>
      <div className="text-sm mt-4">
        אין חשבון? <Link className="underline" href="/register">להרשמה</Link>
      </div>
    </div>
  );
}
