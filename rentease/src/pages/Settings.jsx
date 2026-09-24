import React, { useState, useEffect, useRef } from "react";
import LandlordLayout from "../components/LandlordLayout";
import { useTheme } from "../context/ThemeContext";
import { API_URL } from "../api";
import "./Settings.css";

// SVG Icons for clean, consistent styling
function UserProfileIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function BellNoticeIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function SecurityShieldIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function AppearanceIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  );
}

function EyeIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  );
}

function CheckmarkIcon({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const fileInputRef = useRef(null);

  // 1. Profile State
  const [profile, setProfile] = useState({
    fullName: "",
    email: "",
    phone: "",
    role: "Landlord",
    avatarUrl: null,
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState("");
  const [profileError, setProfileError] = useState("");

  // 2. Notification Preferences State
  const [notifications, setNotifications] = useState({
    rent_payment_received: true,
    rent_payment_pending: true,
    rent_overdue: true,
    maintenance_requests: true,
    lease_expiry: true,
    new_tenant: true,
  });
  const [notifLoading, setNotifLoading] = useState(true);
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifSuccess, setNotifSuccess] = useState("");
  const [notifError, setNotifError] = useState("");

  // 3. Security (Change Password) State
  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // Load Profile and Notification Preferences on mount
  useEffect(() => {
    fetchProfile();
    fetchNotificationPreferences();
  }, []);

  const getAuthToken = () => localStorage.getItem("access_token");

  // Fetch Landlord Profile
  const fetchProfile = async () => {
    try {
      setProfileLoading(true);
      const token = getAuthToken();
      if (!token) return;

      const res = await fetch(`${API_URL}/auth/me/`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setProfile({
          fullName: data.full_name || `${data.first_name || ""} ${data.last_name || ""}`.trim() || data.username || "",
          email: data.email || "",
          phone: data.phone || "",
          role: "Landlord",
          avatarUrl: data.avatar_url || null,
        });

        // Sync theme with backend if received
        if (data.theme && ["light", "dark", "system"].includes(data.theme)) {
          // If local storage didn't explicitly override, update theme
          if (!localStorage.getItem("rentease_theme")) {
            setTheme(data.theme);
          }
        }
      }
    } catch (err) {
      console.error("Failed to load user profile", err);
    } finally {
      setProfileLoading(false);
    }
  };

  // Fetch Notification Preferences
  const fetchNotificationPreferences = async () => {
    try {
      setNotifLoading(true);
      const token = getAuthToken();
      if (!token) return;

      const res = await fetch(`${API_URL}/notification-preferences/`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setNotifications({
          rent_payment_received: data.rent_payment_received !== false,
          rent_payment_pending: data.rent_payment_pending !== false,
          rent_overdue: data.rent_overdue !== false,
          maintenance_requests: data.maintenance_requests !== false,
          lease_expiry: data.lease_expiry !== false,
          new_tenant: data.new_tenant !== false,
        });
      }
    } catch (err) {
      console.error("Failed to load notification preferences", err);
    } finally {
      setNotifLoading(false);
    }
  };

  // Handle Avatar Image Selection
  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setProfileError("Please select a valid image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setProfileError("Image size must be less than 5MB.");
      return;
    }

    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setProfileError("");
  };

  // Handle Profile Save
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileSuccess("");
    setProfileError("");

    // Validate Full Name
    if (!profile.fullName.trim()) {
      setProfileError("Full Name cannot be empty.");
      return;
    }

    // Validate Email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!profile.email.trim() || !emailRegex.test(profile.email.trim())) {
      setProfileError("Please enter a valid email address.");
      return;
    }

    // Validate Phone Number (10 to 15 digits)
    const phoneClean = profile.phone.trim();
    if (phoneClean && !/^\+?[0-9]{10,15}$/.test(phoneClean)) {
      setProfileError("Phone number must contain 10 to 15 digits.");
      return;
    }

    try {
      setProfileSaving(true);
      const token = getAuthToken();

      const formData = new FormData();
      formData.append("full_name", profile.fullName.trim());
      formData.append("email", profile.email.trim().toLowerCase());
      formData.append("phone", phoneClean);

      if (avatarFile) {
        formData.append("avatar", avatarFile);
      }

      const res = await fetch(`${API_URL}/auth/me/`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        const errorMsg =
          data.detail ||
          (Array.isArray(data.email) ? data.email[0] : null) ||
          (Array.isArray(data.phone) ? data.phone[0] : null) ||
          "Failed to update profile. Please try again.";
        setProfileError(errorMsg);
        return;
      }

      setProfileSuccess("Profile updated successfully.");
      setAvatarFile(null);

      // Update local storage user metadata if present
      try {
        const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
        storedUser.first_name = data.first_name;
        storedUser.last_name = data.last_name;
        storedUser.email = data.email;
        localStorage.setItem("user", JSON.stringify(storedUser));
      } catch (err) {
        // Ignore JSON error
      }

      if (data.avatar_url) {
        setProfile((prev) => ({ ...prev, avatarUrl: data.avatar_url }));
        setAvatarPreview(null);
      }
    } catch (err) {
      setProfileError("An unexpected error occurred while saving profile.");
    } finally {
      setProfileSaving(false);
    }
  };

  // Handle Notification Toggle
  const handleToggleNotification = (key) => {
    setNotifications((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Handle Save Notification Preferences
  const handleSaveNotifications = async () => {
    setNotifSuccess("");
    setNotifError("");

    try {
      setNotifSaving(true);
      const token = getAuthToken();

      const res = await fetch(`${API_URL}/notification-preferences/`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(notifications),
      });

      if (!res.ok) {
        setNotifError("Failed to save notification preferences. Please try again.");
        return;
      }

      setNotifSuccess("Notification preferences saved successfully.");
    } catch (err) {
      setNotifError("An unexpected network error occurred.");
    } finally {
      setNotifSaving(false);
    }
  };

  // Handle Change Password
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordSuccess("");
    setPasswordError("");

    const { currentPassword, newPassword, confirmPassword } = passwords;

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("All password fields are required.");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New Password and Confirm New Password do not match.");
      return;
    }

    try {
      setPasswordSaving(true);
      const token = getAuthToken();

      const res = await fetch(`${API_URL}/auth/change-password/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          old_password: currentPassword,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        let msg = "Failed to update password.";
        if (data.detail) {
          msg = Array.isArray(data.detail) ? data.detail.join(" ") : data.detail;
        }
        setPasswordError(msg);
        return;
      }

      setPasswordSuccess("Password updated successfully.");
      setPasswords({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (err) {
      setPasswordError("An unexpected network error occurred while updating password.");
    } finally {
      setPasswordSaving(false);
    }
  };

  // Get Avatar Initials
  const getInitials = (name) => {
    if (!name) return "L";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  };

  return (
    <LandlordLayout
      breadcrumb="Landlord"
      title="Settings"
      subtitle="Manage your account, notifications, security, and appearance."
    >
      <div className="settings-container">
        {/* =========================================================
            1. PROFILE SETTINGS
            ========================================================= */}
        <section className="settings-card" id="profile-settings">
          <div className="settings-card-header">
            <div className="settings-card-icon">
              <UserProfileIcon size={22} />
            </div>
            <div className="settings-card-header-text">
              <h3>Profile</h3>
              <p>Manage your landlord personal information and contact details.</p>
            </div>
          </div>

          {profileSuccess && (
            <div className="settings-alert settings-alert-success">
              <CheckmarkIcon size={16} />
              <span>{profileSuccess}</span>
            </div>
          )}

          {profileError && (
            <div className="settings-alert settings-alert-error">
              <span>{profileError}</span>
            </div>
          )}

          <form onSubmit={handleSaveProfile}>
            {/* Avatar Row */}
            <div className="profile-avatar-row">
              <div className="profile-avatar-preview">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Avatar Preview" className="profile-avatar-img" />
                ) : profile.avatarUrl ? (
                  <img src={profile.avatarUrl} alt="Landlord Avatar" className="profile-avatar-img" />
                ) : (
                  <span>{getInitials(profile.fullName)}</span>
                )}
              </div>

              <div className="profile-avatar-actions">
                <p className="avatar-label">Profile Photo</p>
                <p className="avatar-help">Upload a PNG or JPG image (up to 5MB).</p>
                <div className="avatar-btn-group">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handlePhotoSelect}
                    accept="image/*"
                    style={{ display: "none" }}
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Change Photo
                  </button>
                  {(avatarPreview || profile.avatarUrl) && (
                    <button
                      type="button"
                      className="btn-text-danger"
                      onClick={() => {
                        setAvatarFile(null);
                        setAvatarPreview(null);
                        setProfile((prev) => ({ ...prev, avatarUrl: null }));
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Profile Fields */}
            <div className="settings-form-grid">
              <div className="settings-form-group">
                <label htmlFor="profile-full-name">Full Name</label>
                <input
                  id="profile-full-name"
                  type="text"
                  value={profile.fullName}
                  onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                  placeholder="e.g. John Doe"
                  required
                />
              </div>

              <div className="settings-form-group">
                <label htmlFor="profile-email">Email Address</label>
                <input
                  id="profile-email"
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  placeholder="name@example.com"
                  required
                />
              </div>

              <div className="settings-form-group">
                <label htmlFor="profile-phone">Phone Number</label>
                <input
                  id="profile-phone"
                  type="tel"
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                />
              </div>

              <div className="settings-form-group">
                <label>Role</label>
                <div className="role-badge-wrapper">
                  <span className="role-badge">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    Landlord
                  </span>
                  <span className="role-notice">(Role cannot be modified)</span>
                </div>
              </div>
            </div>

            <div className="settings-card-actions">
              <button type="submit" className="btn-primary" disabled={profileSaving || profileLoading}>
                {profileSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </section>

        {/* =========================================================
            2. NOTIFICATION PREFERENCES
            ========================================================= */}
        <section className="settings-card" id="notification-preferences">
          <div className="settings-card-header">
            <div className="settings-card-icon">
              <BellNoticeIcon size={22} />
            </div>
            <div className="settings-card-header-text">
              <h3>Notification Preferences</h3>
              <p>Choose which notifications you want to receive.</p>
            </div>
          </div>

          {notifSuccess && (
            <div className="settings-alert settings-alert-success">
              <CheckmarkIcon size={16} />
              <span>{notifSuccess}</span>
            </div>
          )}

          {notifError && (
            <div className="settings-alert settings-alert-error">
              <span>{notifError}</span>
            </div>
          )}

          <div className="notification-list">
            {/* 1. Rent Payment Received */}
            <div className="notification-item">
              <div className="notification-info">
                <h4 className="notification-title">Rent Payment Received</h4>
                <p className="notification-desc">
                  Get notified when a tenant's rent payment is successfully recorded.
                </p>
              </div>
              <label className="toggle-switch" htmlFor="toggle-rent-payment-received">
                <input
                  id="toggle-rent-payment-received"
                  type="checkbox"
                  checked={notifications.rent_payment_received}
                  onChange={() => handleToggleNotification("rent_payment_received")}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            {/* 2. Rent Payment Pending */}
            <div className="notification-item">
              <div className="notification-info">
                <h4 className="notification-title">Rent Payment Pending</h4>
                <p className="notification-desc">
                  Get notified when a rent payment requires verification.
                </p>
              </div>
              <label className="toggle-switch" htmlFor="toggle-rent-payment-pending">
                <input
                  id="toggle-rent-payment-pending"
                  type="checkbox"
                  checked={notifications.rent_payment_pending}
                  onChange={() => handleToggleNotification("rent_payment_pending")}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            {/* 3. Rent Overdue */}
            <div className="notification-item">
              <div className="notification-info">
                <h4 className="notification-title">Rent Overdue</h4>
                <p className="notification-desc">
                  Get notified when a tenant's rent becomes overdue.
                </p>
              </div>
              <label className="toggle-switch" htmlFor="toggle-rent-overdue">
                <input
                  id="toggle-rent-overdue"
                  type="checkbox"
                  checked={notifications.rent_overdue}
                  onChange={() => handleToggleNotification("rent_overdue")}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            {/* 4. Maintenance Requests */}
            <div className="notification-item">
              <div className="notification-info">
                <h4 className="notification-title">Maintenance Requests</h4>
                <p className="notification-desc">
                  Get notified when a tenant submits a maintenance request.
                </p>
              </div>
              <label className="toggle-switch" htmlFor="toggle-maintenance-requests">
                <input
                  id="toggle-maintenance-requests"
                  type="checkbox"
                  checked={notifications.maintenance_requests}
                  onChange={() => handleToggleNotification("maintenance_requests")}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            {/* 5. Lease Expiry */}
            <div className="notification-item">
              <div className="notification-info">
                <h4 className="notification-title">Lease Expiry</h4>
                <p className="notification-desc">
                  Get notified when a lease is approaching its expiry date.
                </p>
              </div>
              <label className="toggle-switch" htmlFor="toggle-lease-expiry">
                <input
                  id="toggle-lease-expiry"
                  type="checkbox"
                  checked={notifications.lease_expiry}
                  onChange={() => handleToggleNotification("lease_expiry")}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            {/* 6. New Tenant */}
            <div className="notification-item">
              <div className="notification-info">
                <h4 className="notification-title">New Tenant</h4>
                <p className="notification-desc">
                  Get notified when a new tenant is added.
                </p>
              </div>
              <label className="toggle-switch" htmlFor="toggle-new-tenant">
                <input
                  id="toggle-new-tenant"
                  type="checkbox"
                  checked={notifications.new_tenant}
                  onChange={() => handleToggleNotification("new_tenant")}
                />
                <span className="toggle-slider" />
              </label>
            </div>
          </div>

          <div className="settings-card-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={handleSaveNotifications}
              disabled={notifSaving || notifLoading}
            >
              {notifSaving ? "Saving..." : "Save Preferences"}
            </button>
          </div>
        </section>

        {/* =========================================================
            3. SECURITY SECTION
            ========================================================= */}
        <section className="settings-card" id="security-settings">
          <div className="settings-card-header">
            <div className="settings-card-icon">
              <SecurityShieldIcon size={22} />
            </div>
            <div className="settings-card-header-text">
              <h3>Security</h3>
              <p>Change your password to keep your account safe.</p>
            </div>
          </div>

          {passwordSuccess && (
            <div className="settings-alert settings-alert-success">
              <CheckmarkIcon size={16} />
              <span>{passwordSuccess}</span>
            </div>
          )}

          {passwordError && (
            <div className="settings-alert settings-alert-error">
              <span>{passwordError}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="security-form">
            <div className="settings-form-group">
              <label htmlFor="current-password">Current Password</label>
              <div className="password-input-wrapper">
                <input
                  id="current-password"
                  type={showCurrentPassword ? "text" : "password"}
                  value={passwords.currentPassword}
                  onChange={(e) =>
                    setPasswords({ ...passwords, currentPassword: e.target.value })
                  }
                  placeholder="Enter current password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  aria-label="Toggle password visibility"
                >
                  {showCurrentPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                </button>
              </div>
            </div>

            <div className="settings-form-group">
              <label htmlFor="new-password">New Password</label>
              <div className="password-input-wrapper">
                <input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  value={passwords.newPassword}
                  onChange={(e) =>
                    setPasswords({ ...passwords, newPassword: e.target.value })
                  }
                  placeholder="Enter new password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  aria-label="Toggle password visibility"
                >
                  {showNewPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                </button>
              </div>
              <p className="password-requirements">
                Password must be at least 8 characters long and cannot be overly simple.
              </p>
            </div>

            <div className="settings-form-group">
              <label htmlFor="confirm-password">Confirm New Password</label>
              <div className="password-input-wrapper">
                <input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={passwords.confirmPassword}
                  onChange={(e) =>
                    setPasswords({ ...passwords, confirmPassword: e.target.value })
                  }
                  placeholder="Confirm new password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label="Toggle password visibility"
                >
                  {showConfirmPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                </button>
              </div>
            </div>

            <div style={{ marginTop: "12px" }}>
              <button type="submit" className="btn-primary" disabled={passwordSaving}>
                {passwordSaving ? "Changing..." : "Change Password"}
              </button>
            </div>
          </form>
        </section>

        {/* =========================================================
            4. APPEARANCE / THEME
            ========================================================= */}
        <section className="settings-card" id="appearance-settings">
          <div className="settings-card-header">
            <div className="settings-card-icon">
              <AppearanceIcon size={22} />
            </div>
            <div className="settings-card-header-text">
              <h3>Appearance</h3>
              <p>Customize how RentEase looks across your dashboard and pages.</p>
            </div>
          </div>

          <div className="settings-form-group" style={{ marginBottom: "12px" }}>
            <label>Theme</label>
          </div>

          <div className="theme-options-grid">
            {/* Light Option */}
            <div
              className={`theme-option-card ${theme === "light" ? "selected" : ""}`}
              onClick={() => setTheme("light")}
              role="button"
              tabIndex={0}
            >
              {theme === "light" && (
                <div className="theme-check-badge">
                  <CheckmarkIcon size={11} />
                </div>
              )}
              <div className="theme-icon-wrapper">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              </div>
              <div className="theme-option-name">Light</div>
              <div className="theme-option-desc">Clean, crisp light theme with soft backgrounds.</div>
            </div>

            {/* Dark Option */}
            <div
              className={`theme-option-card ${theme === "dark" ? "selected" : ""}`}
              onClick={() => setTheme("dark")}
              role="button"
              tabIndex={0}
            >
              {theme === "dark" && (
                <div className="theme-check-badge">
                  <CheckmarkIcon size={11} />
                </div>
              )}
              <div className="theme-icon-wrapper">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              </div>
              <div className="theme-option-name">Dark</div>
              <div className="theme-option-desc">Sleek dark theme with deep slate surfaces.</div>
            </div>

            {/* System Option */}
            <div
              className={`theme-option-card ${theme === "system" ? "selected" : ""}`}
              onClick={() => setTheme("system")}
              role="button"
              tabIndex={0}
            >
              {theme === "system" && (
                <div className="theme-check-badge">
                  <CheckmarkIcon size={11} />
                </div>
              )}
              <div className="theme-icon-wrapper">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 2a10 10 0 0 1 0 20Z" fill="currentColor" />
                </svg>
              </div>
              <div className="theme-option-name">System</div>
              <div className="theme-option-desc">Follows your operating system preference.</div>
            </div>
          </div>
        </section>
      </div>
    </LandlordLayout>
  );
}
