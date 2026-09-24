import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  HomeIcon,
  EyeIcon,
  EyeOffIcon,
  WarningIcon,
  LockIcon,
} from "../components/Icons";
import "./TenantLogin.css";
import { API_URL } from "../api";

function TenantLogin() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleTenantLogin = async (e) => {
    e.preventDefault();
    setError("");

    const trimmedIdentifier = username.trim();
    if (!trimmedIdentifier) {
      setError("Please enter your tenant email or username.");
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/tenant-login/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: trimmedIdentifier,
          password,
        }),
      });

      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error("Invalid response received from the authentication server.");
      }

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error(
            data.detail ||
              "Access restricted to tenant accounts only. Landlords must sign in at the landlord portal."
          );
        }
        throw new Error(
          data.detail ||
            data.message ||
            (data.username && data.username[0]) ||
            (data.password && data.password[0]) ||
            "Invalid email/username or password. Please verify your credentials."
        );
      }

      const accessToken = data.access;
      const refreshToken = data.refresh;
      const userData = data.user;

      if (!accessToken || !refreshToken) {
        throw new Error("Sign-in succeeded, but no authentication tokens were returned.");
      }

      // Security verification: Role must be tenant
      if (userData?.role !== "tenant") {
        throw new Error(
          "Access denied: This login page is for tenants only. Landlords must sign in at the Landlord Portal."
        );
      }

      // Store tokens and user profile in standard application format
      localStorage.setItem("access_token", accessToken);
      localStorage.setItem("refresh_token", refreshToken);
      localStorage.setItem("user", JSON.stringify(userData));

      // Successfully authenticated tenant -> navigate to tenant dashboard
      navigate("/tenant/dashboard", { replace: true });
    } catch (err) {
      console.error("Tenant sign-in error:", err);
      setError(err.message || "Failed to sign in. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tenant-login-page">
      <div className="tenant-login-container">
        <div className="tenant-login-card">
          {/* BRAND */}
          <div className="tenant-login-brand">
            <div className="tenant-login-icon">
              <HomeIcon size={24} />
            </div>
            <div className="tenant-login-brand-meta">
              <h2>RentEase</h2>
              <span className="tenant-portal-badge">Tenant Portal</span>
            </div>
          </div>

          {/* HEADER */}
          <div className="tenant-login-header">
            <h1>Tenant Sign In</h1>
            <p className="tenant-login-subtitle">
              Access your rental agreement, monthly rent receipts, invoices, and maintenance tickets.
            </p>
          </div>

          {/* ERROR ALERT */}
          {error && (
            <div className="tenant-login-error-alert" role="alert">
              <WarningIcon size={18} />
              <span>{error}</span>
            </div>
          )}

          {/* LOGIN FORM */}
          <form onSubmit={handleTenantLogin} className="tenant-login-form">
            <div className="tenant-login-field">
              <label htmlFor="tenant_username">Tenant Email or Username</label>
              <input
                id="tenant_username"
                name="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your registered email or username"
                autoComplete="username"
                disabled={loading}
                required
              />
            </div>

            <div className="tenant-login-field">
              <div className="tenant-label-row">
                <label htmlFor="tenant_password">Password</label>
              </div>
              <div className="tenant-password-input-wrap">
                <input
                  id="tenant_password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  className="tenant-pw-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex="-1"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                </button>
              </div>
              <div className="tenant-first-login-hint">
                <LockIcon size={13} />
                <span>First time logging in? Use the temporary password sent by your landlord.</span>
              </div>
            </div>

            <button
              type="submit"
              className="tenant-login-submit-btn"
              disabled={loading}
            >
              {loading ? (
                <span className="tenant-btn-loading-state">
                  <span className="tenant-btn-spinner" /> Signing in...
                </span>
              ) : (
                "Sign In to Tenant Portal"
              )}
            </button>
          </form>

          {/* PORTAL SWITCH / FOOTER */}
          <div className="tenant-login-footer">
            <div className="tenant-landlord-switch">
              <span>Are you a property manager or landlord?</span>
              <Link to="/login" className="tenant-switch-link">
                Sign in to Landlord Portal &rarr;
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TenantLogin;
