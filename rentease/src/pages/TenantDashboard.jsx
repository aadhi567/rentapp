import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  HomeIcon,
  BuildingIcon,
  LeaseIcon,
  PaymentIcon,
  MaintenanceIcon,
  RupeeIcon,
  CalendarIcon,
  DownloadIcon,
  PlusIcon,
  CloseIcon,
  CheckIcon,
  WarningIcon,
  LogoutIcon,
  UserIcon,
} from "../components/Icons";
import "./TenantDashboard.css";

const API_URL = import.meta.env.VITE_API_URL || "https://rentapp-daiv.onrender.com/api";

function TenantDashboard() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const token = localStorage.getItem("access_token");

  const [leases, setLeases] = useState([]);
  const [payments, setPayments] = useState([]);
  const [maintenanceList, setMaintenanceList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Maintenance Request Modal State
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [newRequest, setNewRequest] = useState({
    unit: "",
    title: "",
    description: "",
    priority: "medium",
  });
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [requestSuccess, setRequestSuccess] = useState("");

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  };

  useEffect(() => {
    if (!token) {
      handleLogout();
      return;
    }
    fetchTenantData();
  }, [token]);

  const fetchTenantData = async () => {
    setLoading(true);
    setError("");

    try {
      const headers = { Authorization: `Bearer ${token}` };

      // Fetch leases, payments, maintenance concurrently
      const [leasesRes, paymentsRes, maintRes] = await Promise.all([
        fetch(`${API_URL}/leases/`, { headers }),
        fetch(`${API_URL}/payments/`, { headers }),
        fetch(`${API_URL}/maintenance/`, { headers }),
      ]);

      if (leasesRes.status === 401 || paymentsRes.status === 401) {
        handleLogout();
        return;
      }

      const [leasesData, paymentsData, maintData] = await Promise.all([
        leasesRes.ok ? leasesRes.json() : [],
        paymentsRes.ok ? paymentsRes.json() : [],
        maintRes.ok ? maintRes.json() : [],
      ]);

      const leaseItems = Array.isArray(leasesData)
        ? leasesData
        : leasesData.results || [];
      const paymentItems = Array.isArray(paymentsData)
        ? paymentsData
        : paymentsData.results || [];
      const maintItems = Array.isArray(maintData)
        ? maintData
        : maintData.results || [];

      setLeases(leaseItems);
      setPayments(paymentItems);
      setMaintenanceList(maintItems);

      // Pre-select unit for maintenance modal if tenant has an active lease
      const active = leaseItems.find((l) => l.status === "active") || leaseItems[0];
      if (active) {
        setNewRequest((prev) => ({ ...prev, unit: active.unit }));
      }
    } catch (err) {
      console.error("Error loading tenant dashboard:", err);
      setError("Unable to load tenant information. Please refresh.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRequest = async (e) => {
    e.preventDefault();
    if (!newRequest.unit || !newRequest.title.trim()) {
      setRequestError("Please select a unit and enter a request title.");
      return;
    }

    setSubmittingRequest(true);
    setRequestError("");
    setRequestSuccess("");

    try {
      const res = await fetch(`${API_URL}/maintenance/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newRequest),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.detail || Object.values(data).flat()[0] || "Failed to submit request."
        );
      }

      setRequestSuccess("Maintenance request submitted successfully!");
      setMaintenanceList((prev) => [data, ...prev]);
      setTimeout(() => {
        setShowMaintenanceModal(false);
        setRequestSuccess("");
        setNewRequest((prev) => ({
          ...prev,
          title: "",
          description: "",
          priority: "medium",
        }));
      }, 1200);
    } catch (err) {
      setRequestError(err.message || "Error submitting maintenance request.");
    } finally {
      setSubmittingRequest(false);
    }
  };

  const activeLease = leases.find((l) => l.status === "active") || leases[0];

  const pendingPayments = payments.filter((p) => p.status !== "paid");
  const paidPayments = payments.filter((p) => p.status === "paid");

  return (
    <div className="tenant-portal">
      {/* Top Navbar */}
      <header className="tenant-header">
        <div className="tenant-header-inner">
          <div className="tenant-brand">
            <div className="tenant-logo-icon">
              <HomeIcon size={20} />
            </div>
            <div className="tenant-brand-text">
              <span className="tenant-logo-title">RentEase</span>
              <span className="tenant-portal-pill">Tenant Portal</span>
            </div>
          </div>

          <div className="tenant-header-user">
            <div className="tenant-avatar-badge">
              <UserIcon size={16} />
              <span className="tenant-name">{user?.username || "Tenant"}</span>
            </div>
            <button
              type="button"
              className="tenant-logout-button"
              onClick={handleLogout}
              title="Sign Out"
            >
              <LogoutIcon size={16} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="tenant-main">
        {/* Welcome Hero */}
        <section className="tenant-welcome-banner">
          <div className="tenant-welcome-content">
            <h1>Welcome back, {user?.username}!</h1>
            <p>
              Manage your leased property, download official invoices, and submit maintenance tickets.
            </p>
          </div>
          <button
            type="button"
            className="tenant-action-btn primary"
            onClick={() => setShowMaintenanceModal(true)}
          >
            <PlusIcon size={16} />
            <span>Request Maintenance</span>
          </button>
        </section>

        {error && (
          <div className="tenant-alert error">
            <WarningIcon size={18} />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="tenant-loading-box">
            <div className="tenant-spinner" />
            <p>Fetching your account and lease details...</p>
          </div>
        ) : (
          <div className="tenant-layout-grid">
            {/* Left Column: Lease & Maintenance */}
            <div className="tenant-grid-col primary-col">
              {/* Active Lease Card */}
              <section className="tenant-card">
                <div className="tenant-card-header">
                  <div className="tenant-card-title-group">
                    <BuildingIcon size={18} className="card-icon" />
                    <h2>Rented Property & Lease</h2>
                  </div>
                  {activeLease && (
                    <span
                      className={`tenant-status-tag ${
                        activeLease.status === "active" ? "active" : "pending"
                      }`}
                    >
                      {activeLease.status?.toUpperCase() || "ACTIVE"}
                    </span>
                  )}
                </div>

                {activeLease ? (
                  <div className="tenant-lease-details">
                    <div className="tenant-unit-hero">
                      <div>
                        <h3>
                          {activeLease.building_name} &bull; Unit {activeLease.unit_number || activeLease.unit_name}
                        </h3>
                        <p className="tenant-unit-sub">
                          Floor {activeLease.floor_number ?? "N/A"} &bull; {activeLease.unit_type_display || activeLease.unit_type || "Residential"}
                        </p>
                      </div>
                      <div className="tenant-rent-badge">
                        <span className="rent-amount">
                          ₹{Number(activeLease.monthly_rent || 0).toLocaleString("en-IN")}
                        </span>
                        <span className="rent-freq">/ month</span>
                      </div>
                    </div>

                    <div className="tenant-metrics-row">
                      <div className="tenant-metric-box">
                        <span className="metric-label">Security Deposit</span>
                        <strong className="metric-val">
                          ₹{Number(activeLease.security_deposit || 0).toLocaleString("en-IN")}
                        </strong>
                      </div>
                      <div className="tenant-metric-box">
                        <span className="metric-label">Lease Duration</span>
                        <strong className="metric-val">
                          {activeLease.start_date} to {activeLease.end_date || "Ongoing"}
                        </strong>
                      </div>
                      <div className="tenant-metric-box">
                        <span className="metric-label">Payment Day</span>
                        <strong className="metric-val">
                          {activeLease.rent_payment_day
                            ? `Day ${activeLease.rent_payment_day} of month`
                            : "1st of month"}
                        </strong>
                      </div>
                    </div>

                    {activeLease.agreement_file_url && (
                      <div className="tenant-agreement-action">
                        <a
                          href={activeLease.agreement_file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="tenant-doc-btn"
                        >
                          <DownloadIcon size={16} />
                          <span>View Signed Agreement Document</span>
                        </a>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="tenant-empty-state">
                    <LeaseIcon size={36} />
                    <p>No active lease assigned yet.</p>
                    <small>Contact your property manager to link your lease.</small>
                  </div>
                )}
              </section>

              {/* Maintenance Requests Section */}
              <section className="tenant-card">
                <div className="tenant-card-header">
                  <div className="tenant-card-title-group">
                    <MaintenanceIcon size={18} className="card-icon" />
                    <h2>Maintenance Requests</h2>
                  </div>
                  <button
                    type="button"
                    className="tenant-btn-sm"
                    onClick={() => setShowMaintenanceModal(true)}
                  >
                    <PlusIcon size={14} />
                    <span>New Ticket</span>
                  </button>
                </div>

                {maintenanceList.length > 0 ? (
                  <div className="tenant-maint-list">
                    {maintenanceList.map((req) => (
                      <div key={req.id} className="tenant-maint-item">
                        <div className="tenant-maint-left">
                          <div className="tenant-maint-title-row">
                            <h4>{req.title}</h4>
                            <span
                              className={`tenant-prio-tag ${req.priority || "medium"}`}
                            >
                              {req.priority?.toUpperCase()}
                            </span>
                          </div>
                          <p className="tenant-maint-desc">{req.description}</p>
                          <span className="tenant-maint-meta">
                            Unit {req.unit_number || req.unit_name || activeLease?.unit_number} &bull;{" "}
                            {new Date(req.created_at).toLocaleDateString("en-IN", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                        <div className="tenant-maint-right">
                          <span
                            className={`tenant-status-tag ${
                              req.status === "resolved"
                                ? "active"
                                : req.status === "in_progress"
                                ? "pending"
                                : "overdue"
                            }`}
                          >
                            {req.status?.replace("_", " ").toUpperCase() || "PENDING"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="tenant-empty-state">
                    <MaintenanceIcon size={36} />
                    <p>No maintenance requests logged.</p>
                    <small>Everything running smoothly in your unit!</small>
                  </div>
                )}
              </section>
            </div>

            {/* Right Column: Payments & Invoices */}
            <div className="tenant-grid-col side-col">
              <section className="tenant-card">
                <div className="tenant-card-header">
                  <div className="tenant-card-title-group">
                    <PaymentIcon size={18} className="card-icon" />
                    <h2>Rent Payments</h2>
                  </div>
                  <span className="tenant-count-badge">{payments.length} Records</span>
                </div>

                {payments.length > 0 ? (
                  <div className="tenant-payments-list">
                    {payments.map((p) => (
                      <div key={p.id} className="tenant-payment-item">
                        <div className="tenant-payment-details">
                          <div className="tenant-payment-top">
                            <span className="payment-inv-no">
                              {p.invoice_number || `INV-${String(p.id).padStart(5, "0")}`}
                            </span>
                            <span
                              className={`tenant-status-tag ${
                                p.status === "paid"
                                  ? "active"
                                  : p.status === "pending"
                                  ? "pending"
                                  : "overdue"
                              }`}
                            >
                              {p.status?.toUpperCase() || "PENDING"}
                            </span>
                          </div>
                          <div className="tenant-payment-val">
                            <RupeeIcon size={16} />
                            <span>{Number(p.amount || 0).toLocaleString("en-IN")}</span>
                          </div>
                          <span className="tenant-payment-date">
                            Due: {p.due_date} {p.paid_date ? `| Paid: ${p.paid_date}` : ""}
                          </span>
                        </div>

                        <div className="tenant-payment-actions">
                          <button
                            type="button"
                            className="tenant-btn-link"
                            onClick={() => navigate(`/invoice/${p.id}`)}
                            title="View Rent Invoice"
                          >
                            Invoice
                          </button>
                          {p.status === "paid" && (
                            <button
                              type="button"
                              className="tenant-btn-link receipt"
                              onClick={() => navigate(`/receipt/${p.id}`)}
                              title="View Payment Receipt"
                            >
                              Receipt
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="tenant-empty-state">
                    <PaymentIcon size={36} />
                    <p>No payment statements yet.</p>
                    <small>Payment entries will appear when generated by your landlord.</small>
                  </div>
                )}
              </section>
            </div>
          </div>
        )}
      </main>

      {/* Maintenance Ticket Modal */}
      {showMaintenanceModal && (
        <div className="tenant-modal-overlay" onClick={() => setShowMaintenanceModal(false)}>
          <div className="tenant-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="tenant-modal-header">
              <div className="modal-title-group">
                <h3>Submit Maintenance Request</h3>
                <p>Report an issue with plumbing, electrical, or general repairs.</p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowMaintenanceModal(false)}
              >
                <CloseIcon size={18} />
              </button>
            </div>

            {requestError && (
              <div className="tenant-alert error in-modal">
                <WarningIcon size={16} />
                <span>{requestError}</span>
              </div>
            )}

            {requestSuccess && (
              <div className="tenant-alert success in-modal">
                <CheckIcon size={16} />
                <span>{requestSuccess}</span>
              </div>
            )}

            <form onSubmit={handleCreateRequest} className="tenant-modal-form">
              <div className="form-group">
                <label>Unit / Property</label>
                <select
                  value={newRequest.unit}
                  onChange={(e) =>
                    setNewRequest((prev) => ({ ...prev, unit: e.target.value }))
                  }
                  required
                >
                  <option value="">Select your rented unit</option>
                  {leases.map((l) => (
                    <option key={l.id} value={l.unit}>
                      {l.building_name} - Unit {l.unit_number || l.unit_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Priority Level</label>
                <select
                  value={newRequest.priority}
                  onChange={(e) =>
                    setNewRequest((prev) => ({ ...prev, priority: e.target.value }))
                  }
                >
                  <option value="low">Low - Minor cosmetic or non-urgent</option>
                  <option value="medium">Medium - Normal repair needed</option>
                  <option value="high">High - Needs prompt attention</option>
                  <option value="urgent">Urgent - Water leak, power outage, safety</option>
                </select>
              </div>

              <div className="form-group">
                <label>Issue Summary</label>
                <input
                  type="text"
                  placeholder="e.g. Kitchen sink faucet leaking"
                  value={newRequest.title}
                  onChange={(e) =>
                    setNewRequest((prev) => ({ ...prev, title: e.target.value }))
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label>Detailed Description</label>
                <textarea
                  rows="4"
                  placeholder="Describe the issue, location in the unit, and best time for inspection..."
                  value={newRequest.description}
                  onChange={(e) =>
                    setNewRequest((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="tenant-modal-actions">
                <button
                  type="button"
                  className="tenant-btn-cancel"
                  onClick={() => setShowMaintenanceModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="tenant-btn-submit"
                  disabled={submittingRequest}
                >
                  {submittingRequest ? "Submitting..." : "Submit Ticket"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default TenantDashboard;