export default function Home() {
  return (
    <main style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
      <div style={{ textAlign: "center" }}>
        <h1>Social Network</h1>
        <p style={{ marginTop: "1rem" }}>
          <a href="/login" style={{ marginRight: "1rem", color: "#1877f2" }}>Login</a>
          <a href="/register" style={{ color: "#1877f2" }}>Register</a>
        </p>
      </div>
    </main>
  );
}
