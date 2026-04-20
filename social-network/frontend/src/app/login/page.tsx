"use client";
import { useState, FormEvent } from "react";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api.login({ email, password });
      router.push("/feed");
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <main style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "calc(100vh - var(--navbar-h))", background: "var(--bg)" }}>
      <form onSubmit={handleSubmit} style={{
        width: 380, padding: "2.5rem", background: "var(--bg-card)",
        borderRadius: "var(--radius)", boxShadow: "var(--shadow-md)",
        border: "1px solid var(--border)",
      }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{ fontSize: 36, marginBottom: "0.5rem" }}>👋</div>
          <h2 style={{ fontSize: 22, fontWeight: 700 }}>Welcome back</h2>
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Log in to your account</p>
        </div>
        {error && <p style={{ color: "var(--danger)", marginBottom: "1rem", fontSize: 14, background: "#fff0f0", padding: "0.6rem", borderRadius: "var(--radius)" }}>{error}</p>}
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ marginBottom: "0.75rem" }} />
        <div style={{ position: "relative", marginBottom: "1.25rem" }}>
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ paddingRight: "2.5rem", width: "100%" }}
          />
          <button
            type="button"
            onClick={() => setShowPassword(v => !v)}
            title={showPassword ? "Hide password" : "Show password"}
            style={{
              position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", cursor: "pointer",
              fontSize: 18, color: "var(--text-muted)", padding: 0, lineHeight: 1,
            }}
          >
            {showPassword ? "🙈" : "👁"}
          </button>
        </div>
        <button type="submit" style={{
          display: "block", width: "100%", padding: "0.75rem",
          background: "var(--accent)", color: "#fff", border: "none",
          borderRadius: "var(--radius)", fontSize: 16, fontWeight: 600,
        }}>Log In</button>
        <p style={{ textAlign: "center", marginTop: "1.25rem", fontSize: 14, color: "var(--text-muted)" }}>
          No account? <a href="/register">Register</a>
        </p>
      </form>
    </main>
  );
}
