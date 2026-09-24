import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  DashboardIcon,
  BuildingIcon,
  TenantIcon,
  LeaseIcon,
  PaymentIcon,
  MaintenanceIcon,
  AnalyticsIcon,
  ReminderIcon,
  SettingsIcon,
  LogoutIcon,
  BellIcon,
  MenuIcon,
  CloseIcon,
  HomeIcon,
} from "./Icons";
import "./LandlordLayout.css";

export default function LandlordLayout({
  children,
  title,
  subtitle,
  breadcrumb,
  actions,
  badgeCounts = {},
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (err) {
        console.error("Failed to parse user:", err);
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  };

  const navItems = [
    {
      id: "dashboard",
      label: "Dashboard",
      path: "/landlord/dashboard",
      icon: <DashboardIcon size={19} />,
      matches: (p) => p === "/landlord/dashboard",
    },
    {
      id: "buildings",
      label: "Buildings",
      path: "/landlord/buildings",
      icon: <BuildingIcon size={19} />,
      matches: (p) =>
        p.startsWith("/landlord/buildings") || p.startsWith("/landlord/floors"),
    },
    {
      id: "tenants",
      label: "Tenants",
      path: "/landlord/tenants",
      icon: <TenantIcon size={19} />,
      matches: (p) => p.startsWith("/landlord/tenants"),
    },
    {
      id: "leases",
      label: "Agreements",
      path: "/landlord/leases",
      icon: <LeaseIcon size={19} />,
      matches: (p) => p.startsWith("/landlord/leases"),
    },
    {
      id: "payments",
      label: "Rent & Payments",
      path: "/landlord/payments",
      icon: <PaymentIcon size={19} />,
      matches: (p) =>
        p.startsWith("/landlord/payments") ||
        p.startsWith("/landlord/invoices") ||
        p.startsWith("/landlord/receipts"),
      badge: badgeCounts.payments,
    },
    {
      id: "maintenance",
      label: "Maintenance",
      path: "/landlord/maintenance",
      icon: <MaintenanceIcon size={19} />,
      matches: (p) => p.startsWith("/landlord/maintenance"),
      badge: badgeCounts.maintenance,
    },
    {
      id: "analytics",
      label: "Analytics",
      path: "/landlord/analytics",
      icon: <AnalyticsIcon size={19} />,
      matches: (p) => p.startsWith("/landlord/analytics"),
    },
    {
      id: "reminders",
      label: "Reminders",
      path: "/landlord/reminders",
      icon: <ReminderIcon size={19} />,
      matches: (p) => p.startsWith("/landlord/reminders"),
      badge: badgeCounts.reminders,
    },
  ];

  const secondaryNavItems = [
    {
      id: "settings",
      label: "Settings",
      path: "/landlord/settings",
      icon: <SettingsIcon size={18} />,
      matches: (p) => p === "/landlord/settings",
    },
  ];

  const currentPath = location.pathname;

  return (
    <div className="layout-root">
      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="layout-mobile-backdrop"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside className={`layout-sidebar ${mobileOpen ? "open" : ""}`}>
        {/* Brand */}
        <div className="layout-brand">
          <div className="layout-brand-badge">
            <HomeIcon size={22} />
          </div>
          <div className="layout-brand-text">
            <h2>RentEase</h2>
            <span>Property Manager</span>
          </div>
          <button
            className="layout-sidebar-close"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        {/* Primary Navigation */}
        <div className="layout-nav-section-title">MAIN MENU</div>
        <nav className="layout-nav">
          {navItems.map((item) => {
            const isActive = item.matches(currentPath);
            return (
              <button
                key={item.id}
                className={`layout-nav-btn ${isActive ? "active" : ""}`}
                onClick={() => {
                  navigate(item.path);
                  setMobileOpen(false);
                }}
              >
                <span className="layout-nav-icon">{item.icon}</span>
                <span className="layout-nav-label">{item.label}</span>
                {item.badge != null && item.badge > 0 && (
                  <span className="layout-nav-badge">{item.badge}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Navigation */}
        <div className="layout-sidebar-bottom">
          <div className="layout-nav-section-title">PREFERENCES</div>
          {secondaryNavItems.map((item) => {
            const isActive = item.matches(currentPath);
            return (
              <button
                key={item.id}
                className={`layout-nav-btn ${isActive ? "active" : ""}`}
                onClick={() => {
                  navigate(item.path);
                  setMobileOpen(false);
                }}
              >
                <span className="layout-nav-icon">{item.icon}</span>
                <span className="layout-nav-label">{item.label}</span>
              </button>
            );
          })}

          <button
            className="layout-nav-btn layout-logout-btn"
            onClick={handleLogout}
          >
            <span className="layout-nav-icon">
              <LogoutIcon size={18} />
            </span>
            <span className="layout-nav-label">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="layout-main-wrap">
        {/* TOPBAR */}
        <header className="layout-topbar">
          <div className="layout-topbar-left">
            <button
              className="layout-menu-toggle"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <MenuIcon size={22} />
            </button>

            <div className="layout-breadcrumbs">
              <span className="layout-crumb-root">RentEase</span>
              <span className="layout-crumb-sep">/</span>
              <span className="layout-crumb-current">
                {breadcrumb || title || "Dashboard"}
              </span>
            </div>
          </div>

          <div className="layout-topbar-right">
            <button
              className="layout-icon-button"
              title="Reminders & Alerts"
              onClick={() => navigate("/landlord/reminders")}
            >
              <BellIcon size={19} />
              {badgeCounts.reminders > 0 && (
                <span className="layout-bell-dot" />
              )}
            </button>

            <div className="layout-profile-pill">
              <div className="layout-avatar">
                {user?.username?.charAt(0)?.toUpperCase() || "L"}
              </div>
              <div className="layout-profile-meta">
                <span className="layout-user-name">
                  {user?.first_name
                    ? `${user.first_name} ${user.last_name || ""}`.trim()
                    : user?.username || "Landlord"}
                </span>
                <span className="layout-user-role">Landlord</span>
              </div>
            </div>
          </div>
        </header>

        {/* PAGE HEADER (if title provided) */}
        {(title || actions) && (
          <section className="layout-page-header">
            <div className="layout-page-header-text">
              {title && <h1 className="layout-page-title">{title}</h1>}
              {subtitle && <p className="layout-page-subtitle">{subtitle}</p>}
            </div>
            {actions && <div className="layout-page-actions">{actions}</div>}
          </section>
        )}

        {/* CONTENT */}
        <main className="layout-content">{children}</main>
      </div>
    </div>
  );
}
