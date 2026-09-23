import { useState } from "react";
import { supabase } from "./supabase";
import "./Login.css";

function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(event) {
    event.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Please enter email and password.");
      return;
    }

    setLoading(true);

    const { data, error: loginError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (loginError) {
      setError(loginError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      onLogin(data.user);
    }

    setLoading(false);
  }

  return (
    <div className="login-page">
      <div className="login-box">
        <div className="login-logo">B</div>

        <h1>Big Collection BD</h1>
        <p>Admin Panel</p>

        <form onSubmit={handleLogin}>
          <label>Email</label>

          <input
            type="email"
            placeholder="Enter admin email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

          <label>Password</label>

          <input
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />

          {error && (
            <div className="login-error">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
