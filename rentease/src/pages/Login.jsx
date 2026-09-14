import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  HomeIcon,
  EyeIcon,
  EyeOffIcon,
  WarningIcon,
  GoogleIcon,
} from "../components/Icons";
import "./Login.css";

import { API_URL } from "../api";
const GOOGLE_ACCOUNTS_STORAGE_KEY = "rentease_person_google_accounts";

const getSavedGoogleAccounts = () => {
  try {
    const raw = localStorage.getItem(GOOGLE_ACCOUNTS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter((item) => typeof item === "string" && item.includes("@"));
      }
    }
  } catch (e) {
    console.error("Error reading saved google accounts:", e);
  }
  return [];
};

const saveGoogleAccounts = (accounts) => {
  try {
    localStorage.setItem(GOOGLE_ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
  } catch (e) {
    console.error("Error saving google accounts:", e);
  }
};

function Login() {
  const navigate = useNavigate();

  // Username/Email and Password fields
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Google Modal state - ONLY for the person trying to log in
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [myAccounts, setMyAccounts] = useState([]);
  const [customGoogleEmail, setCustomGoogleEmail] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Load saved accounts for this person/browser on mount
  useEffect(() => {
    const saved = getSavedGoogleAccounts();
    setMyAccounts(saved);
  }, []);

  // Standard Username / Email + Password Login
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
            (loginData.username && loginData.username[0]) ||
            (loginData.password && loginData.password[0]) ||
            "Invalid username/email or password."
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

      // Remember this user's email in their device Google accounts
      if (userData.email && userData.email.includes("@")) {
        const currentSaved = getSavedGoogleAccounts();
        if (!currentSaved.includes(userData.email)) {
          const updated = [userData.email, ...currentSaved];
          saveGoogleAccounts(updated);
          setMyAccounts(updated);
        }
      }

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
      setError(err.message || "Unable to sign in. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  // Google Sign-In Handler
  const handleGoogleSignIn = async (googleEmail, googleName = "") => {
    setError("");
    const emailToUse = (googleEmail || "").trim();
    if (!emailToUse || !emailToUse.includes("@")) {
      setError("Please enter a valid Google email address.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/google/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: emailToUse,
          name: googleName || emailToUse.split("@")[0],
          role: "landlord",
        }),
      });

      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error("Invalid response from Google authentication server.");
      }

      if (!response.ok) {
        throw new Error(data.detail || "Google Sign-In failed.");
      }

      // Save into this person's saved accounts on this device
      const currentSaved = getSavedGoogleAccounts();
      if (!currentSaved.includes(emailToUse)) {
        const updated = [emailToUse, ...currentSaved];
        saveGoogleAccounts(updated);
        setMyAccounts(updated);
      }

      localStorage.setItem("access_token", data.access);
      localStorage.setItem("refresh_token", data.refresh);

      const meResp = await fetch(`${API_URL}/auth/me/`, {
        headers: { Authorization: `Bearer ${data.access}` },
      });
      const meData = await meResp.json();
      localStorage.setItem("user", JSON.stringify(meData));

      setShowGoogleModal(false);

      if (meData.role === "landlord") {
        navigate("/landlord/dashboard", { replace: true });
      } else {
        navigate("/tenant/dashboard", { replace: true });
      }
    } catch (err) {
      console.error("Google login error:", err);
      setError(err.message || "Failed to sign in with Google.");
    } finally {
      setLoading(false);
    }
  };

  // Open modal showing ONLY the person's email accounts
  const handleGoogleBtnClick = async () => {
    setError("");
    const trimmed = username.trim();

    let accounts = getSavedGoogleAccounts();

    // If user has typed a username or email in the field:
    if (trimmed) {
      if (trimmed.includes("@")) {
        // Direct email typed
        if (!accounts.includes(trimmed)) {
          accounts = [trimmed, ...accounts];
          saveGoogleAccounts(accounts);
        }
      } else {
        // Username typed (like "AADHITHAN") -> check if we can resolve its email
        try {
          const resp = await fetch(`${API_URL}/auth/check-email/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: trimmed }),
          });
          if (resp.ok) {
            const data = await resp.json();
            if (data.exists && data.email && data.email.includes("@")) {
              if (!accounts.includes(data.email)) {
                accounts = [data.email, ...accounts];
                saveGoogleAccounts(accounts);
              }
            }
          }
        } catch (e) {
          console.error("Error looking up user email:", e);
        }
      }
    }

    // If accounts list is still empty, check if last logged in user has an email
    if (accounts.length === 0) {
      try {
        const storedUser = JSON.parse(localStorage.getItem("user") || "null");
        if (storedUser && storedUser.email && storedUser.email.includes("@")) {
          accounts = [storedUser.email];
          saveGoogleAccounts(accounts);
        } else {
          // Default to current landlord's email on this machine
          accounts = ["aadhithanboss@gmail.com"];
          saveGoogleAccounts(accounts);
        }
      } catch {
        accounts = ["aadhithanboss@gmail.com"];
        saveGoogleAccounts(accounts);
      }
    }

    setMyAccounts(accounts);
    setShowGoogleModal(true);
  };

  // Remove an account from this device
  const handleRemoveAccount = (e, emailToRemove) => {
    e.stopPropagation();
    const updated = myAccounts.filter((acc) => acc !== emailToRemove);
    setMyAccounts(updated);
    saveGoogleAccounts(updated);
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
              <label htmlFor="username">Username or Email</label>
              <input
                id="username"
                name="username"
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Enter your username or email"
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

          {/* DIVIDER */}
          <div className="login-divider">
            <span>or</span>
          </div>

          {/* GOOGLE SIGN IN BUTTON */}
          <button
            type="button"
            className="google-signin-btn"
            onClick={handleGoogleBtnClick}
            disabled={loading}
          >
            <GoogleIcon size={18} />
            <span>Sign in with Google</span>
          </button>

          {/* FOOTER */}
          <div className="login-footer">
            <span>Don't have an account?</span>
            <Link to="/signup" className="login-signup-link">
              Create an account
            </Link>
          </div>
        </div>
      </div>

      {/* GOOGLE ACCOUNT CHOOSER MODAL (ONLY THIS PERSON'S ACCOUNTS) */}
      {showGoogleModal && (
        <div className="google-modal-backdrop" onClick={() => setShowGoogleModal(false)}>
          <div className="google-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="google-modal-header">
              <GoogleIcon size={26} />
              <h2>Sign in with Google</h2>
              <p>Choose an account to continue to RentEase</p>
            </div>

            <div className="google-account-list">
              {myAccounts.length === 0 ? (
                <div style={{ textAlign: "center", padding: "16px", color: "#64748b", fontSize: "13px" }}>
                  No Google accounts on this browser yet. Enter your email below.
                </div>
              ) : (
                myAccounts.map((accEmail, index) => {
                  const initial = (accEmail || "G")[0].toUpperCase();
                  const colors = [
                    "#0056d2",
                    "#7c3aed",
                    "#059669",
                    "#d97706",
                    "#dc2626",
                    "#0284c7",
                  ];
                  const avatarColor = colors[index % colors.length];

                  return (
                    <div
                      key={accEmail}
                      className="google-account-item"
                      onClick={() => handleGoogleSignIn(accEmail)}
                    >
                      <div
                        className="google-avatar"
                        style={{ backgroundColor: avatarColor }}
                      >
                        {initial}
                      </div>
                      <div className="google-account-info">
                        <strong className="google-account-email">{accEmail}</strong>
                        <span className="google-account-hint">Signed in on this browser</span>
                      </div>
                      {myAccounts.length > 1 && (
                        <button
                          type="button"
                          className="google-remove-account-btn"
                          title="Remove from this browser"
                          onClick={(e) => handleRemoveAccount(e, accEmail)}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="google-custom-input-section">
              <label htmlFor="custom_google_email">Or enter another Google account:</label>
              <div className="google-custom-row">
                <input
                  id="custom_google_email"
                  type="email"
                  value={customGoogleEmail}
                  onChange={(e) => setCustomGoogleEmail(e.target.value)}
                  placeholder="yourname@gmail.com"
                  disabled={loading}
                />
                <button
                  type="button"
                  className="google-submit-custom-btn"
                  onClick={() => {
                    if (customGoogleEmail.trim()) {
                      handleGoogleSignIn(customGoogleEmail);
                    }
                  }}
                  disabled={!customGoogleEmail.trim() || loading}
                >
                  Sign In
                </button>
              </div>
            </div>

            <div className="google-modal-actions">
              <button
                type="button"
                className="google-modal-cancel"
                onClick={() => setShowGoogleModal(false)}
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Login;