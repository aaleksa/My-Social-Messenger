"use client";
import { useState, FormEvent } from "react";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "", first_name: "", last_name: "", date_of_birth: "", nickname: "", about_me: "", avatar: "" });
  const [avatarPreview, setAvatarPreview] = useState("");
  const [error, setError] = useState("");

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await api.uploadImage(file);
      setForm((f) => ({ ...f, avatar: url }));
      setAvatarPreview(url);
    } catch (err: any) {
      setError("Image upload failed: " + err.message);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const data = await api.register(form);
      if (data?.session_id) localStorage.setItem("session_id", data.session_id);
      router.push("/feed");
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <main style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", background: "#f0f2f5" }}>
      <form onSubmit={handleSubmit} style={{ width: 420, padding: "2rem", background: "#fff", borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,.1)" }}>
        <h2 style={{ marginBottom: "1.5rem", textAlign: "center" }}>Create Account</h2>
        {error && <p style={{ color: "red", marginBottom: "1rem" }}>{error}</p>}
        <input placeholder="First Name *" value={form.first_name} onChange={set("first_name")} required style={inp} />
        <input placeholder="Last Name *" value={form.last_name} onChange={set("last_name")} required style={inp} />
        <input type="email" placeholder="Email *" value={form.email} onChange={set("email")} required style={inp} />
        <input type="password" placeholder="Password *" value={form.password} onChange={set("password")} required style={inp} />
        <label style={{ display: "block", fontSize: 13, color: "#65676b", marginBottom: 4 }}>Date of Birth *</label>
        <input type="date" value={form.date_of_birth} onChange={set("date_of_birth")} required style={{ ...inp, marginBottom: "1rem" }} />
        <label style={{ display: "block", fontSize: 13, color: "#65676b", marginBottom: 4 }}>Avatar (optional)</label>
        <input type="file" accept="image/*" onChange={handleAvatar} style={{ marginBottom: "0.75rem" }} />
        {avatarPreview && (
          <img src={avatarPreview} alt="avatar preview" style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", display: "block", marginBottom: "0.75rem" }} />
        )}
        <input placeholder="Nickname (optional)" value={form.nickname} onChange={set("nickname")} style={inp} />
        <textarea placeholder="About Me (optional)" value={form.about_me} onChange={set("about_me")} style={{ ...inp, height: 80, resize: "vertical" }} />
        <button type="submit" style={btn}>Register</button>
        <p style={{ textAlign: "center", marginTop: "1rem" }}>
          Already have an account? <a href="/login" style={{ color: "#1877f2" }}>Log In</a>
        </p>
      </form>
    </main>
  );
}

const inp: React.CSSProperties = { display: "block", marginBottom: "0.75rem" };
const btn: React.CSSProperties = { display: "block", width: "100%", padding: "0.75rem", background: "var(--success)", color: "#fff", border: "none", borderRadius: "var(--radius)", fontSize: 16, fontWeight: 600, cursor: "pointer" };
