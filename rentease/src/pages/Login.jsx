import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { HomeIcon, EyeIcon, EyeOffIcon, WarningIcon } from "../components/Icons";
import "./Login.css";

const API_URL = import.meta.env.VITE_API_URL || "https://rentapp-daiv.onrender.com/api";

function Login() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (event) => {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const loginResponse = await fetch(`${API_URL}/auth/login/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      let loginData;
      try {
        loginData = await loginResponse.json();
      } catch {
        throw new Error("The server returned an invalid response.");
      }

      if (!loginResponse.ok) {
        throw new Error(
          loginData.detail ||
            loginData.message ||
            "Invalid username or password."
        );
      }

      const accessToken = loginData.access;
      const refreshToken = loginData.refresh;

      if (!accessToken || !refreshToken) {
        throw new Error(
          "Login succeeded, but the server did not return authentication tokens."
        );
      }

      localStorage.setItem("access_token", accessToken);
      localStorage.setItem("refresh_token", refreshToken);

      // Get current user profile
      const userResponse = await fetch(`${API_URL}/auth/me/`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      let userData;
      try {
        userData = await userResponse.json();
      } catch {
        throw new Error("Unable to read account information from the server.");
      }

      if (!userResponse.ok) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        throw new Error(
          userData.detail || "Unable to retrieve account information."
        );
      }

      localStorage.setItem("user", JSON.stringify(userData));

      if (userData.role === "landlord") {
        navigate("/landlord/dashboard", { replace: true });
        return;
      }

      if (userData.role === "tenant") {
        navigate("/tenant/dashboard", { replace: true });
        return;
      }

      throw new Error("Your account does not have a valid RentEase role.");
    } catch (err) {
      console.error("Login error:", err);
      setError(err.message || "Unable to connect to the RentEase server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-card">
          {/* BRAND */}
          <div className="login-brand">
            <div className="login-brand-icon">
              <HomeIcon size={24} />
            </div>
            <div className="login-brand-text">
              <h2>RentEase</h2>
              <span>Property Management</span>
            </div>
          </div>

          {/* HEADER */}
          <div className="login-header">
            <h1>Welcome back</h1>
            <p className="login-subtitle">
              Sign in to manage your rental properties, leases and payments.
            </p>
          </div>

          {/* ERROR ALERT */}
          {error && (
            <div className="login-error" role="alert">
              <WarningIcon size={18} />
              <span>{error}</span>
            </div>
          )}

          {/* LOGIN FORM */}
          <form onSubmit={handleLogin} className="login-form">
            <div className="login-field">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                name="username"
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Enter your username"
                autoComplete="username"
                disabled={loading}
                required
              />
            </div>

            <div className="login-field">
              <div className="login-label-row">
                <label htmlFor="password">Password</label>
              </div>
              <div className="password-input-wrapper">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex="-1"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                </button>
              </div>
            </div>

            <button type="submit" className="login-submit" disabled={loading}>
              {loading ? (
                <span className="btn-loading-content">
                  <span className="btn-spinner" /> Signing in...
                </span>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          {/* FOOTER */}
          <div className="login-footer">
            <span>Don't have an account?</span>
            <Link to="/signup" className="login-signup-link">
              Create an account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;