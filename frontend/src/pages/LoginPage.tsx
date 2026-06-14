import { FormEvent, useState } from "react";
import ThemeToggle from "../components/ThemeToggle";
import { useAuth } from "../lib/auth";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("teacher@secsa.local");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-page-toolbar">
        <ThemeToggle />
      </div>
      <form className="card login-card form-grid" onSubmit={handleSubmit}>
        <img className="login-logo" src="/secsa.png" alt="SECSA" />
        <h1>Ready for the Challenge?</h1>
        <p className="muted login-subtext">Sign in to access the SECSA Comprehensive Examination Platform.</p>
        <label>
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        </label>
        <label>
          Password
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
