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

import TenantDashboard from "./pages/TenantDashboard";
import InvoiceSettings from "./pages/InvoiceSettings";
import LandlordLayout from "./components/LandlordLayout";
import {
  MaintenanceIcon,
  AnalyticsIcon,
  ReminderIcon,
  SettingsIcon,
} from "./components/Icons";

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

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Landlord Routes */}
        <Route path="/landlord/dashboard" element={<LandlordDashboard />} />
        <Route path="/landlord/invoice-settings" element={<InvoiceSettings />} />
        <Route path="/landlord/buildings" element={<Buildings />} />
        <Route path="/landlord/buildings/:id" element={<BuildingDashboard />} />
        <Route path="/landlord/floors/:id" element={<FloorDashboard />} />
        <Route path="/landlord/tenants" element={<Tenants />} />
        <Route path="/landlord/leases" element={<Leases />} />
        <Route path="/landlord/payments" element={<Payments />} />
        <Route path="/landlord/invoices/:paymentId" element={<InvoiceView />} />
        <Route path="/landlord/receipts/:paymentId" element={<ReceiptView />} />

        {/* Aliases for quick links */}
        <Route path="/invoice/:paymentId" element={<InvoiceView />} />
        <Route path="/receipt/:paymentId" element={<ReceiptView />} />

        <Route
          path="/landlord/maintenance"
          element={
            <PagePlaceholder
              title="Maintenance Management"
              icon={<MaintenanceIcon size={30} />}
              description="Review tenant repair requests, dispatch service technicians, and schedule routine preventive maintenance across all properties."
            />
          }
        />

        <Route
          path="/landlord/analytics"
          element={
            <PagePlaceholder
              title="Property Analytics"
              icon={<AnalyticsIcon size={30} />}
              description="Interactive yield graphs, occupancy timeline trends, vacancy loss reports, and multi-building revenue benchmarks."
            />
          }
        />

        <Route
          path="/landlord/reminders"
          element={
            <PagePlaceholder
              title="Automated Reminders"
              icon={<ReminderIcon size={30} />}
              description="Automated WhatsApp, SMS, and email payment reminders, grace period notices, and upcoming lease renewal alerts."
            />
          }
        />

        <Route
          path="/landlord/settings"
          element={
            <PagePlaceholder
              title="System Settings"
              icon={<SettingsIcon size={30} />}
              description="Manage organization preferences, team member roles, security settings, and third-party accounting integrations."
            />
          }
        />

        {/* Tenant Portal */}
        <Route path="/tenant/dashboard" element={<TenantDashboard />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;