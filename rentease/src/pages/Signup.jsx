import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  HomeIcon,
  BuildingIcon,
  TenantIcon,
  WarningIcon,
  CheckIcon,
  EyeIcon,
  EyeOffIcon,
} from "../components/Icons";
import "./Signup.css";

import { API_URL } from "../api";

function Signup() {
  const navigate = useNavigate();

  const [role, setRole] = useState("landlord");

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    username: "",
    email: "",
    phone: "",
    password: "",
    confirm_password: "",
    emergency_contact: "",
    emergency_phone: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleRoleChange = (newRole) => {
    setRole(newRole);
    setError("");
    setSuccess("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (form.password !== form.confirm_password) {
      setError("Passwords do not match.");
      return;
    }

    if (form.password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/register/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          username: form.username.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          password: form.password,
          confirm_password: form.confirm_password,
          role,
          emergency_contact:
            role === "tenant" ? form.emergency_contact.trim() : "",
          emergency_phone:
            role === "tenant" ? form.emergency_phone.trim() : "",
        }),
      });

      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error("The server returned an invalid response.");
      }

      if (!response.ok) {
        let message = "Unable to create account.";
        if (data.detail) {
          message = data.detail;
        } else {
          const errors = Object.values(data).flat();
          if (errors.length > 0) {
            message = errors[0];
          }
        }
        throw new Error(message);
      }

      setSuccess("Account created successfully! Redirecting to login...");
      setTimeout(() => {
        navigate("/login", { replace: true });
      }, 1200);
    } catch (err) {
      console.error("Signup error:", err);
      setError(err.message || "Unable to connect to the RentEase server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-page">
      <div className="signup-container">
        <div className="signup-card">
          {/* BRAND */}
          <div className="signup-brand">
            <div className="signup-brand-icon">
              <HomeIcon size={24} />
            </div>
            <div className="signup-brand-text">
              <h2>RentEase</h2>
              <span>Property Management</span>
            </div>
          </div>

          {/* HEADER */}
          <div className="signup-header">
            <h1>Create your account</h1>
            <p className="signup-subtitle">
              Choose your role to get started with RentEase.
            </p>
          </div>

          {/* ROLE SELECTOR */}
          <div className="role-switch-wrapper">
            <div className="role-switch">
              <button
                type="button"
                className={`role-button ${role === "landlord" ? "active" : ""}`}
                onClick={() => handleRoleChange("landlord")}
                disabled={loading}
              >
                <span className="role-icon">
                  <BuildingIcon size={20} />
                </span>
                <span className="role-text">
                  <strong>Landlord</strong>
                  <small>Manage properties & leases</small>
                </span>
              </button>

              <button
                type="button"
                className={`role-button ${role === "tenant" ? "active" : ""}`}
                onClick={() => handleRoleChange("tenant")}
                disabled={loading}
              >
                <span className="role-icon">
                  <TenantIcon size={20} />
                </span>
                <span className="role-text">
                  <strong>Tenant</strong>
                  <small>Pay rent & view leases</small>
                </span>
              </button>
            </div>
          </div>

          {/* FORM */}
          <form onSubmit={handleSubmit} className="signup-form">
            {/* NAME */}
            <div className="form-row">
              <div className="signup-field">
                <label htmlFor="first_name">First Name</label>
                <input
                  id="first_name"
                  name="first_name"
                  type="text"
                  value={form.first_name}
                  onChange={handleChange}
                  placeholder="e.g. John"
                  autoComplete="given-name"
                  disabled={loading}
                  required
                />
              </div>

              <div className="signup-field">
                <label htmlFor="last_name">Last Name</label>
                <input
                  id="last_name"
                  name="last_name"
                  type="text"
                  value={form.last_name}
                  onChange={handleChange}
                  placeholder="e.g. Doe"
                  autoComplete="family-name"
                  disabled={loading}
                  required
                />
              </div>
            </div>

            {/* EMAIL & PHONE */}
            <div className="form-row">
              <div className="signup-field">
                <label htmlFor="email">Email Address</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  autoComplete="email"
                  disabled={loading}
                  required
                />
              </div>

              <div className="signup-field">
                <label htmlFor="phone">Phone Number</label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="e.g. 9876543210"
                  autoComplete="tel"
                  disabled={loading}
                />
              </div>
            </div>

            {/* USERNAME */}
            <div className="signup-field">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                name="username"
                type="text"
                value={form.username}
                onChange={handleChange}
                placeholder="Choose a unique username"
                autoComplete="username"
                disabled={loading}
                required
              />
            </div>

            {/* PASSWORD */}
            <div className="form-row">
              <div className="signup-field">
                <label htmlFor="password">Password</label>
                <div className="password-input-wrapper">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={handleChange}
                    placeholder="Min. 8 characters"
                    autoComplete="new-password"
                    minLength="8"
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

              <div className="signup-field">
                <label htmlFor="confirm_password">Confirm Password</label>
                <input
                  id="confirm_password"
                  name="confirm_password"
                  type={showPassword ? "text" : "password"}
                  value={form.confirm_password}
                  onChange={handleChange}
                  placeholder="Re-enter password"
                  autoComplete="new-password"
                  disabled={loading}
                  required
                />
              </div>
            </div>

            {/* TENANT EXTRA */}
            {role === "tenant" && (
              <div className="tenant-extra-section">
                <div className="tenant-extra-title">
                  <span>Emergency Contact Details</span>
                  <small>(Optional)</small>
                </div>

                <div className="form-row">
                  <div className="signup-field">
                    <label htmlFor="emergency_contact">Contact Name</label>
                    <input
                      id="emergency_contact"
                      name="emergency_contact"
                      type="text"
                      value={form.emergency_contact}
                      onChange={handleChange}
                      placeholder="Emergency contact person"
                      disabled={loading}
                    />
                  </div>

                  <div className="signup-field">
                    <label htmlFor="emergency_phone">Contact Phone</label>
                    <input
                      id="emergency_phone"
                      name="emergency_phone"
                      type="tel"
                      value={form.emergency_phone}
                      onChange={handleChange}
                      placeholder="Emergency phone number"
                      disabled={loading}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ERROR */}
            {error && (
              <div className="signup-error" role="alert">
                <WarningIcon size={18} />
                <span>{error}</span>
              </div>
            )}

            {/* SUCCESS */}
            {success && (
              <div className="signup-success" role="status">
                <CheckIcon size={18} />
                <span>{success}</span>
              </div>
            )}

            {/* SUBMIT */}
            <button type="submit" className="signup-submit" disabled={loading}>
              {loading ? (
                <span className="btn-loading-content">
                  <span className="btn-spinner" /> Creating account...
                </span>
              ) : (
                `Create ${role === "landlord" ? "Landlord" : "Tenant"} Account`
              )}
            </button>
          </form>

          {/* FOOTER */}
          <div className="signup-footer">
            <span>Already have an account?</span>
            <Link to="/login" className="signup-login-link">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Signup;