import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import {
  DashboardIcon,
  PaymentIcon,
  MaintenanceIcon,
  FileTextIcon,
  LogoutIcon,
  LockIcon,
  KeyIcon,
  UserIcon,
  MenuIcon,
  CloseIcon,
  HomeIcon,
  CheckIcon,
  WarningIcon,
  EyeIcon,
  EyeOffIcon,
} from "./Icons";
import "./TenantLayout.css";
import { API_URL } from "../api";

export default function TenantLayout({
  children,
  title,
  subtitle,
  breadcrumb = "Tenant Portal",
  actions,
  badgeCounts = {},
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  // Change password form state
  const [pwForm, setPwForm] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showOldPw, setShowOldPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    const rawUser = localStorage.getItem("user");

    if (!token) {
      navigate("/tenant/login", { replace: true });
      return;
    }

    if (rawUser) {
      try {
        const parsed = JSON.parse(rawUser);
        if (parsed.role === "landlord") {
          navigate("/landlord/dashboard", { replace: true });
          return;
        }
        setUser(parsed);
      } catch (err) {
        console.error("Failed to parse user:", err);
      }
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
    navigate("/tenant/login", { replace: true });
  };

  const navItems = [
    {
      id: "dashboard",
      label: "Dashboard",
      path: "/tenant/dashboard",
      icon: <DashboardIcon size={19} />,
      matches: (p) => p === "/tenant/dashboard",
    },
    {
      id: "invoices",
      label: "My Invoices",
      path: "/tenant/invoices",
      icon: <FileTextIcon size={19} />,
      matches: (p) => p.startsWith("/tenant/invoices"),
      badge: badgeCounts.invoices,
    },
    {
      id: "payments",
      label: "Payment History",
      path: "/tenant/payments",
      icon: <PaymentIcon size={19} />,
      matches: (p) => p.startsWith("/tenant/payments") || p.startsWith("/tenant/pay"),
      badge: badgeCounts.payments,
    },
    {
      id: "receipts",
      label: "Rent Receipts",
      path: "/tenant/receipts",
      icon: <FileTextIcon size={19} />,
      matches: (p) => p.startsWith("/tenant/receipts"),
      badge: badgeCounts.receipts,
    },
    {
      id: "maintenance",
      label: "Maintenance",
      path: "/tenant/maintenance",
      icon: <MaintenanceIcon size={19} />,
      matches: (p) => p.startsWith("/tenant/maintenance"),
      badge: badgeCounts.maintenance,
    },
  ];

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPwError("");
    setPwSuccess("");

    if (!pwForm.newPassword) {
      setPwError("Please enter a new password.");
      return;
    }
    if (pwForm.newPassword.length < 8) {
      setPwError("New password must be at least 8 characters long.");
      return;
    }
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwError("New passwords do not match.");
      return;
    }

    setPwLoading(true);
    const token = localStorage.getItem("access_token");

    try {
      const res = await fetch(`${API_URL}/auth/change-password/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          old_password: pwForm.oldPassword,
          new_password: pwForm.newPassword,
          confirm_password: pwForm.confirmPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        const msg = Array.isArray(data.detail) ? data.detail.join(" ") : data.detail;
        throw new Error(msg || "Failed to update password.");
      }

      setPwSuccess("Password updated successfully!");
      if (user) {
        const updatedUser = { ...user, must_change_password: false };
        localStorage.setItem("user", JSON.stringify(updatedUser));
        setUser(updatedUser);
      }

      setTimeout(() => {
        setShowPasswordModal(false);
        setPwForm({ oldPassword: "", newPassword: "", confirmPassword: "" });
        setPwSuccess("");
      }, 1500);
    } catch (err) {
      setPwError(err.message || "Failed to change password.");
    } finally {
      setPwLoading(false);
    }
  };

  const displayName = user
    ? (user.first_name ? `${user.first_name} ${user.last_name || ""}`.trim() : user.username)
    : "Tenant";

  const initial = displayName ? displayName[0].toUpperCase() : "T";
  const forcePasswordChange = user && user.must_change_password;

  return (
    <div className="tenant-layout">
      {/* MOBILE HEADER */}
      <header className="tenant-mobile-header">
        <button
          type="button"
          className="tenant-mobile-menu-btn"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle navigation"
        >
          {mobileOpen ? <CloseIcon size={22} /> : <MenuIcon size={22} />}
        </button>

        <div className="tenant-mobile-brand">
          <div className="tenant-brand-icon">
            <HomeIcon size={18} />
          </div>
          <span className="tenant-brand-text">RentEase</span>
          <span className="tenant-brand-tag">Tenant</span>
        </div>

        <button
          type="button"
          className="tenant-avatar-circle sm"
          onClick={() => setShowPasswordModal(true)}
          title="Account Security"
        >
          {initial}
        </button>
      </header>

      {/* SIDEBAR NAVIGATION */}
      <aside className={`tenant-sidebar ${mobileOpen ? "open" : ""}`}>
        <div className="tenant-sidebar-header">
          <div className="tenant-brand">
            <div className="tenant-brand-icon">
              <HomeIcon size={22} />
            </div>
            <div>
              <h2 className="tenant-brand-name">RentEase</h2>
              <span className="tenant-portal-subtitle">Tenant Portal</span>
            </div>
          </div>
        </div>

        <nav className="tenant-nav">
          <div className="tenant-nav-section-title">Navigation</div>
          {navItems.map((item) => {
            const active = item.matches(location.pathname);
            return (
              <Link
                key={item.id}
                to={item.path}
                className={`tenant-nav-item ${active ? "active" : ""}`}
                onClick={() => setMobileOpen(false)}
              >
                <span className="tenant-nav-icon">{item.icon}</span>
                <span className="tenant-nav-label">{item.label}</span>
                {item.badge > 0 && (
                  <span className="tenant-nav-badge">{item.badge}</span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="tenant-sidebar-footer">
          <div className="tenant-user-card">
            <div className="tenant-avatar-circle">{initial}</div>
            <div className="tenant-user-details">
              <span className="tenant-user-name" title={displayName}>
                {displayName}
              </span>
              <span className="tenant-role-tag">Tenant Account</span>
            </div>
          </div>

          <div className="tenant-footer-actions">
            <button
              type="button"
              className="tenant-btn-security"
              onClick={() => {
                setMobileOpen(false);
                setShowPasswordModal(true);
              }}
              title="Change Password"
            >
              <KeyIcon size={16} />
              <span>Password</span>
            </button>

            <button
              type="button"
              className="tenant-btn-logout"
              onClick={handleLogout}
              title="Sign Out"
            >
              <LogoutIcon size={16} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* MOBILE BACKDROP */}
      {mobileOpen && (
        <div
          className="tenant-mobile-backdrop"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* MAIN CONTENT AREA */}
      <main className="tenant-main">
        {/* FORCE PASSWORD CHANGE BANNER */}
        {forcePasswordChange && (
          <div className="tenant-must-change-banner">
            <WarningIcon size={20} />
            <div className="tenant-banner-text">
              <strong>Initial Password Setup Required:</strong> Your account is currently using a temporary password. Please set a secure personal password.
            </div>
            <button
              type="button"
              className="tenant-banner-action-btn"
              onClick={() => setShowPasswordModal(true)}
            >
              Change Password Now
            </button>
          </div>
        )}

        {/* TOP BAR / PAGE HEADER */}
        {(title || breadcrumb) && (
          <div className="tenant-page-header">
            <div className="tenant-header-info">
              {breadcrumb && (
                <div className="tenant-breadcrumb">
                  <span>RentEase</span>
                  <span className="sep">/</span>
                  <span className="current">{breadcrumb}</span>
                </div>
              )}
              {title && <h1 className="tenant-page-title">{title}</h1>}
              {subtitle && <p className="tenant-page-subtitle">{subtitle}</p>}
            </div>

            {actions && <div className="tenant-header-actions">{actions}</div>}
          </div>
        )}

        <div className="tenant-content-body">{children}</div>
      </main>

      {/* CHANGE PASSWORD MODAL */}
      {(showPasswordModal || forcePasswordChange) && (
        <div
          className="tenant-modal-backdrop"
          onClick={() => {
            if (!forcePasswordChange) setShowPasswordModal(false);
          }}
        >
          <div
            className="tenant-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="tenant-modal-header">
              <div className="tenant-modal-icon-wrap">
                <LockIcon size={22} />
              </div>
              <div>
                <h2>{forcePasswordChange ? "Set New Password" : "Change Password"}</h2>
                <p>
                  {forcePasswordChange
                    ? "Welcome to RentEase! Please choose a new permanent password."
                    : "Update your portal sign-in password."}
                </p>
              </div>
              {!forcePasswordChange && (
                <button
                  type="button"
                  className="tenant-modal-close"
                  onClick={() => setShowPasswordModal(false)}
                >
                  <CloseIcon size={18} />
                </button>
              )}
            </div>

            {pwError && (
              <div className="tenant-alert-error">
                <WarningIcon size={16} />
                <span>{pwError}</span>
              </div>
            )}

            {pwSuccess && (
              <div className="tenant-alert-success">
                <CheckIcon size={16} />
                <span>{pwSuccess}</span>
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="tenant-modal-form">
              {!forcePasswordChange && (
                <div className="tenant-form-group">
                  <label htmlFor="old_pw">Current Password</label>
                  <div className="tenant-pw-input-wrapper">
                    <input
                      id="old_pw"
                      type={showOldPw ? "text" : "password"}
                      value={pwForm.oldPassword}
                      onChange={(e) =>
                        setPwForm({ ...pwForm, oldPassword: e.target.value })
                      }
                      placeholder="Enter current password"
                      required={!forcePasswordChange}
                      disabled={pwLoading}
                    />
                    <button
                      type="button"
                      className="tenant-pw-toggle"
                      onClick={() => setShowOldPw(!showOldPw)}
                      tabIndex="-1"
                    >
                      {showOldPw ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                    </button>
                  </div>
                </div>
              )}

              <div className="tenant-form-group">
                <label htmlFor="new_pw">New Password</label>
                <div className="tenant-pw-input-wrapper">
                  <input
                    id="new_pw"
                    type={showNewPw ? "text" : "password"}
                    value={pwForm.newPassword}
                    onChange={(e) =>
                      setPwForm({ ...pwForm, newPassword: e.target.value })
                    }
                    placeholder="Minimum 8 characters"
                    minLength={8}
                    required
                    disabled={pwLoading}
                  />
                  <button
                    type="button"
                    className="tenant-pw-toggle"
                    onClick={() => setShowNewPw(!showNewPw)}
                    tabIndex="-1"
                  >
                    {showNewPw ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                  </button>
                </div>
              </div>

              <div className="tenant-form-group">
                <label htmlFor="confirm_pw">Confirm New Password</label>
                <input
                  id="confirm_pw"
                  type={showNewPw ? "text" : "password"}
                  value={pwForm.confirmPassword}
                  onChange={(e) =>
                    setPwForm({ ...pwForm, confirmPassword: e.target.value })
                  }
                  placeholder="Re-enter new password"
                  minLength={8}
                  required
                  disabled={pwLoading}
                />
              </div>

              <div className="tenant-modal-actions">
                {!forcePasswordChange && (
                  <button
                    type="button"
                    className="tenant-btn-cancel"
                    onClick={() => setShowPasswordModal(false)}
                    disabled={pwLoading}
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  className="tenant-btn-submit"
                  disabled={pwLoading}
                >
                  {pwLoading ? "Updating..." : "Save New Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
