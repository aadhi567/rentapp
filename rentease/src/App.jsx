import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import InvoiceView from "./pages/InvoiceView";
import ReceiptView from "./pages/ReceiptView";

import LandlordDashboard from "./pages/LandlordDashboard";
import Buildings from "./pages/Buildings";
import BuildingDashboard from "./pages/BuildingDashboard";
import FloorDashboard from "./pages/FloorDashboard";
import Tenants from "./pages/Tenants";
import Leases from "./pages/Leases";
import Payments from "./pages/Payments";
import Reminders from "./pages/Reminders";
import Analytics from "./pages/Analytics";
import LandlordMaintenance from "./pages/LandlordMaintenance";

import TenantLogin from "./pages/TenantLogin";
import TenantDashboard from "./pages/TenantDashboard";
import TenantInvoices from "./pages/TenantInvoices";
import TenantReceipts from "./pages/TenantReceipts";
import TenantMaintenance from "./pages/TenantMaintenance";
import TenantPaymentPage from "./pages/TenantPaymentPage";
import TenantPaymentHistory from "./pages/TenantPaymentHistory";

import InvoiceSettings from "./pages/InvoiceSettings";
import Settings from "./pages/Settings";
import LandlordLayout from "./components/LandlordLayout";
import { SettingsIcon } from "./components/Icons";

function PagePlaceholder({ title, subtitle, icon, description }) {
  return (
    <LandlordLayout
      breadcrumb="Landlord"
      title={title}
      subtitle={subtitle || `Manage your property ${title.toLowerCase()}.`}
    >
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-color)",
          borderRadius: "var(--radius-lg)",
          padding: "52px 36px",
          textAlign: "center",
          maxWidth: "640px",
          margin: "32px auto",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div
          style={{
            width: "60px",
            height: "60px",
            borderRadius: "16px",
            background: "var(--primary-light)",
            color: "var(--primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
          }}
        >
          {icon}
        </div>

        <h2
          style={{
            fontSize: "21px",
            fontWeight: 700,
            margin: "0 0 10px",
            color: "var(--text-primary)",
            letterSpacing: "-0.4px",
          }}
        >
          {title} Module
        </h2>

        <p
          style={{
            color: "var(--text-secondary)",
            fontSize: "14px",
            lineHeight: "1.6",
            margin: "0 0 28px",
          }}
        >
          {description}
        </p>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 16px",
            background: "var(--bg-page)",
            border: "1px solid var(--border-color)",
            borderRadius: "9999px",
            fontSize: "12px",
            color: "var(--text-secondary)",
            fontWeight: 600,
          }}
        >
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "var(--primary)",
              display: "inline-block",
            }}
          />
          Planned feature in upcoming release
        </div>
      </div>
    </LandlordLayout>
  );
}

function LandlordRoute({ children }) {
  const token = localStorage.getItem("access_token");
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    if (user.role === "tenant") {
      return <Navigate to="/tenant/dashboard" replace />;
    }
  } catch (e) {
    // Ignore JSON error
  }

  return children;
}

function TenantRoute({ children }) {
  const token = localStorage.getItem("access_token");
  if (!token) {
    return <Navigate to="/tenant/login" replace />;
  }

  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    if (user.role === "landlord") {
      return <Navigate to="/landlord/dashboard" replace />;
    }
  } catch (e) {
    // Ignore JSON error
  }

  return children;
}

function RootRedirect() {
  const token = localStorage.getItem("access_token");
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    if (user.role === "tenant") {
      return <Navigate to="/tenant/dashboard" replace />;
    }
  } catch (e) {
    // Ignore
  }

  return <Navigate to="/landlord/dashboard" replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Dedicated Tenant Login */}
        <Route path="/tenant/login" element={<TenantLogin />} />

        {/* Tenant Portal Routes (Protected) */}
        <Route
          path="/tenant/dashboard"
          element={
            <TenantRoute>
              <TenantDashboard />
            </TenantRoute>
          }
        />
        <Route
          path="/tenant/invoices"
          element={
            <TenantRoute>
              <TenantInvoices />
            </TenantRoute>
          }
        />
        <Route
          path="/tenant/pay/:paymentId"
          element={
            <TenantRoute>
              <TenantPaymentPage />
            </TenantRoute>
          }
        />
        <Route
          path="/tenant/payments"
          element={
            <TenantRoute>
              <TenantPaymentHistory />
            </TenantRoute>
          }
        />
        <Route
          path="/tenant/receipts"
          element={
            <TenantRoute>
              <TenantReceipts />
            </TenantRoute>
          }
        />
        <Route
          path="/tenant/maintenance"
          element={
            <TenantRoute>
              <TenantMaintenance />
            </TenantRoute>
          }
        />

        {/* Landlord Routes (Protected) */}
        <Route
          path="/landlord/dashboard"
          element={
            <LandlordRoute>
              <LandlordDashboard />
            </LandlordRoute>
          }
        />
        <Route
          path="/landlord/invoice-settings"
          element={
            <LandlordRoute>
              <InvoiceSettings />
            </LandlordRoute>
          }
        />
        <Route
          path="/landlord/buildings"
          element={
            <LandlordRoute>
              <Buildings />
            </LandlordRoute>
          }
        />
        <Route
          path="/landlord/buildings/:id"
          element={
            <LandlordRoute>
              <BuildingDashboard />
            </LandlordRoute>
          }
        />
        <Route
          path="/landlord/floors/:id"
          element={
            <LandlordRoute>
              <FloorDashboard />
            </LandlordRoute>
          }
        />
        <Route
          path="/landlord/tenants"
          element={
            <LandlordRoute>
              <Tenants />
            </LandlordRoute>
          }
        />
        <Route
          path="/landlord/leases"
          element={
            <LandlordRoute>
              <Leases />
            </LandlordRoute>
          }
        />
        <Route
          path="/landlord/payments"
          element={
            <LandlordRoute>
              <Payments />
            </LandlordRoute>
          }
        />
        <Route
          path="/landlord/invoices/:paymentId"
          element={
            <LandlordRoute>
              <InvoiceView />
            </LandlordRoute>
          }
        />
        <Route
          path="/landlord/receipts/:paymentId"
          element={
            <LandlordRoute>
              <ReceiptView />
            </LandlordRoute>
          }
        />
        <Route
          path="/landlord/maintenance"
          element={
            <LandlordRoute>
              <LandlordMaintenance />
            </LandlordRoute>
          }
        />
        <Route
          path="/landlord/analytics"
          element={
            <LandlordRoute>
              <Analytics />
            </LandlordRoute>
          }
        />
        <Route
          path="/landlord/reminders"
          element={
            <LandlordRoute>
              <Reminders />
            </LandlordRoute>
          }
        />
        <Route
          path="/landlord/settings"
          element={
            <LandlordRoute>
              <Settings />
            </LandlordRoute>
          }
        />

        {/* Aliases for quick links */}
        <Route path="/invoice/:paymentId" element={<InvoiceView />} />
        <Route path="/receipt/:paymentId" element={<ReceiptView />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;