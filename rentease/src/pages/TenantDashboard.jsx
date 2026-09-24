import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import TenantLayout from "../components/TenantLayout";
import {
  HomeIcon,
  BuildingIcon,
  LeaseIcon,
  PaymentIcon,
  MaintenanceIcon,
  RupeeIcon,
  CalendarIcon,
  DownloadIcon,
  EyeIcon,
  PlusIcon,
  CheckIcon,
  WarningIcon,
  FileTextIcon,
  KeyIcon,
  UserIcon,
  WrenchIcon,
} from "../components/Icons";
import "./TenantDashboard.css";
import { API_URL } from "../api";

function TenantDashboard() {
  const navigate = useNavigate();
  const token = localStorage.getItem("access_token");
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const [leases, setLeases] = useState([]);
  const [payments, setPayments] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [tenantProfile, setTenantProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError("");

    try {
      const headers = { Authorization: `Bearer ${token}` };

      const [leasesRes, paymentsRes, maintRes, tenantsRes] = await Promise.all([
        fetch(`${API_URL}/leases/`, { headers }),
        fetch(`${API_URL}/payments/`, { headers }),
        fetch(`${API_URL}/maintenance/`, { headers }),
        fetch(`${API_URL}/tenants/`, { headers }),
      ]);

      if (leasesRes.status === 401 || paymentsRes.status === 401) {
        localStorage.removeItem("access_token");
        navigate("/tenant/login", { replace: true });
        return;
      }

      const [leasesData, paymentsData, maintData, tenantsData] =
        await Promise.all([
          leasesRes.ok ? leasesRes.json() : [],
          paymentsRes.ok ? paymentsRes.json() : [],
          maintRes.ok ? maintRes.json() : [],
          tenantsRes.ok ? tenantsRes.json() : [],
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
      const tenantItems = Array.isArray(tenantsData)
        ? tenantsData
        : tenantsData.results || [];

      setLeases(leaseItems);
      setPayments(paymentItems);
      setComplaints(maintItems);

      if (tenantItems.length > 0) {
        setTenantProfile(tenantItems[0]);
      }
    } catch (err) {
      console.error("Error loading tenant dashboard:", err);
      setError("Unable to load tenant information. Please refresh.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadInvoice = async (paymentId) => {
    setDownloadingId(paymentId);
    try {
      const res = await fetch(`${API_URL}/payments/${paymentId}/invoice/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Could not download invoice PDF.");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rent-invoice-${String(paymentId).padStart(6, "0")}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message || "Failed to download invoice.");
    } finally {
      setDownloadingId(null);
    }
  };

  const activeLease = useMemo(() => {
    return leases.find((l) => l.status === "active") || leases[0] || null;
  }, [leases]);

  const nextDuePayment = useMemo(() => {
    return (
      payments
        .filter((p) => p.status === "pending" || p.status === "overdue")
        .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))[0] || null
    );
  }, [payments]);

  const totalPaidRent = useMemo(() => {
    return payments
      .filter((p) => p.status === "paid")
      .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
  }, [payments]);

  const openComplaintsCount = useMemo(() => {
    return complaints.filter(
      (c) => c.status === "open" || c.status === "in_progress" || c.status === "pending"
    ).length;
  }, [complaints]);

  const recentInvoices = useMemo(() => {
    return payments
      .filter((p) => p.payment_type === "rent")
      .slice(0, 4);
  }, [payments]);

  const recentComplaints = useMemo(() => {
    return complaints.slice(0, 3);
  }, [complaints]);

  const tenantName = tenantProfile
    ? tenantProfile.full_name
    : user.first_name
    ? `${user.first_name} ${user.last_name || ""}`.trim()
    : user.username || "Tenant";

  return (
    <TenantLayout
      breadcrumb="Dashboard"
      title="Tenant Overview"
      subtitle={`Welcome to your RentEase portal, ${tenantName}.`}
    >
      <div className="tenant-dash-container">
        {error && (
          <div className="tenant-dash-error-banner" role="alert">
            <WarningIcon size={18} />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="tenant-dash-loading">
            <div className="tenant-dash-spinner" />
            <p>Loading your rental dashboard...</p>
          </div>
        ) : (
          <>
            {/* HERO CARD */}
            <div className="tenant-hero-card">
              <div className="hero-content">
                <span className="hero-greeting">WELCOME BACK</span>
                <h2 className="hero-tenant-name">{tenantName}</h2>
                {activeLease ? (
                  <p className="hero-unit-text">
                    <BuildingIcon size={16} />
                    <span>
                      Unit {activeLease.unit_number || activeLease.unit_name} &bull;{" "}
                      {activeLease.building_name} (Floor {activeLease.floor_number})
                    </span>
                  </p>
                ) : (
                  <p className="hero-unit-text">
                    <span>No active lease currently assigned to your account.</span>
                  </p>
                )}
              </div>

              <div className="hero-actions">
                <Link to="/tenant/invoices" className="btn-hero-invoices">
                  <FileTextIcon size={16} />
                  <span>View Invoices</span>
                </Link>
                <Link to="/tenant/maintenance" className="btn-hero-complaint">
                  <PlusIcon size={16} />
                  <span>New Complaint</span>
                </Link>
              </div>
            </div>

            {/* METRICS GRID */}
            <div className="tenant-metrics-grid">
              {/* MONTHLY RENT */}
              <div className="tenant-metric-card">
                <div className="metric-header">
                  <span className="metric-title">MONTHLY RENT</span>
                  <div className="metric-icon-wrap blue">
                    <RupeeIcon size={18} />
                  </div>
                </div>
                <div className="metric-body">
                  <strong className="metric-val">
                    ₹
                    {activeLease
                      ? parseFloat(activeLease.monthly_rent || 0).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })
                      : "0.00"}
                  </strong>
                  <span className="metric-sub">
                    {activeLease?.lease_type_display || "Monthly Lease"}
                  </span>
                </div>
              </div>

              {/* NEXT PAYMENT STATUS */}
              <div className="tenant-metric-card">
                <div className="metric-header">
                  <span className="metric-title">NEXT RENT PAYMENT</span>
                  <div
                    className={`metric-icon-wrap ${
                      nextDuePayment?.status === "overdue"
                        ? "red"
                        : nextDuePayment
                        ? "amber"
                        : "green"
                    }`}
                  >
                    <CalendarIcon size={18} />
                  </div>
                </div>
                <div className="metric-body">
                  {nextDuePayment ? (
                    <>
                      <strong className="metric-val">
                        ₹
                        {parseFloat(nextDuePayment.amount || 0).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </strong>
                      <span className="metric-sub">
                        Due: {nextDuePayment.due_date} ({nextDuePayment.status.toUpperCase()})
                      </span>
                      <Link
                        to={`/tenant/pay/${nextDuePayment.id}`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          marginTop: "8px",
                          fontSize: "12px",
                          fontWeight: 700,
                          color: "#16a34a",
                          textDecoration: "none",
                        }}
                      >
                        <span>Pay via UPI →</span>
                      </Link>
                    </>
                  ) : (
                    <>
                      <strong className="metric-val green-text">All Settled</strong>
                      <span className="metric-sub">No pending rent dues</span>
                    </>
                  )}
                </div>
              </div>

              {/* ACTIVE MAINTENANCE */}
              <div className="tenant-metric-card">
                <div className="metric-header">
                  <span className="metric-title">OPEN REPAIR TICKETS</span>
                  <div className="metric-icon-wrap amber">
                    <WrenchIcon size={18} />
                  </div>
                </div>
                <div className="metric-body">
                  <strong className="metric-val">{openComplaintsCount}</strong>
                  <span className="metric-sub">
                    {openComplaintsCount === 1 ? "1 active ticket" : `${openComplaintsCount} active tickets`}
                  </span>
                </div>
              </div>

              {/* TOTAL PAID */}
              <div className="tenant-metric-card">
                <div className="metric-header">
                  <span className="metric-title">TOTAL RENT PAID</span>
                  <div className="metric-icon-wrap green">
                    <CheckIcon size={18} />
                  </div>
                </div>
                <div className="metric-body">
                  <strong className="metric-val">
                    ₹
                    {totalPaidRent.toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                    })}
                  </strong>
                  <span className="metric-sub">
                    {payments.filter((p) => p.status === "paid").length} confirmed payments
                  </span>
                </div>
              </div>
            </div>

            {/* TWO-COLUMN DETAILS SECTION */}
            <div className="tenant-dash-sections">
              {/* LEFT / MAIN COLUMN */}
              <div className="tenant-dash-left">
                {/* ACTIVE LEASE DETAILS */}
                {activeLease ? (
                  <div className="tenant-card">
                    <div className="tenant-card-header">
                      <div className="header-title-wrap">
                        <LeaseIcon size={18} className="icon-accent" />
                        <h3>Active Lease Agreement</h3>
                      </div>
                      <span className="lease-status-pill active">
                        {activeLease.status ? activeLease.status.toUpperCase() : "ACTIVE"}
                      </span>
                    </div>

                    <div className="tenant-lease-meta-grid">
                      <div className="meta-item">
                        <span className="meta-label">Building</span>
                        <strong className="meta-val">{activeLease.building_name}</strong>
                      </div>
                      <div className="meta-item">
                        <span className="meta-label">Unit</span>
                        <strong className="meta-val">
                          {activeLease.unit_number || activeLease.unit_name} ({activeLease.unit_type_display})
                        </strong>
                      </div>
                      <div className="meta-item">
                        <span className="meta-label">Lease Duration</span>
                        <strong className="meta-val">
                          {activeLease.start_date} &rarr; {activeLease.end_date}
                        </strong>
                      </div>
                      <div className="meta-item">
                        <span className="meta-label">Security Deposit</span>
                        <strong className="meta-val">
                          ₹
                          {parseFloat(activeLease.security_deposit || 0).toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                          })}
                        </strong>
                      </div>
                    </div>

                    {activeLease.agreement_file_url && (
                      <div className="tenant-lease-download-row">
                        <a
                          href={activeLease.agreement_file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-lease-agreement"
                        >
                          <DownloadIcon size={15} />
                          <span>Download Signed Lease Agreement</span>
                        </a>
                      </div>
                    )}
                  </div>
                ) : null}

                {/* RECENT INVOICES */}
                <div className="tenant-card">
                  <div className="tenant-card-header">
                    <div className="header-title-wrap">
                      <FileTextIcon size={18} className="icon-accent" />
                      <h3>Recent Invoices</h3>
                    </div>
                    <Link to="/tenant/invoices" className="card-link-more">
                      View All &rarr;
                    </Link>
                  </div>

                  {recentInvoices.length === 0 ? (
                    <div className="card-empty-state">
                      <p>No invoices generated yet.</p>
                    </div>
                  ) : (
                    <div className="tenant-mini-invoices-list">
                      {recentInvoices.map((inv) => {
                        const invNo = `INV-${String(inv.id).padStart(6, "0")}`;
                        const isPaid = inv.status === "paid";
                        return (
                          <div key={inv.id} className="mini-invoice-row">
                            <div className="inv-left">
                              <span className="inv-tag">{invNo}</span>
                              <span className="inv-due">Due: {inv.due_date}</span>
                            </div>

                            <div className="inv-center">
                              <strong>
                                ₹
                                {parseFloat(inv.amount || 0).toLocaleString("en-IN", {
                                  minimumFractionDigits: 2,
                                })}
                              </strong>
                            </div>

                            <div className="inv-right">
                              <span
                                className={`mini-status-pill ${
                                  isPaid ? "paid" : "pending"
                                }`}
                              >
                                {inv.status ? inv.status.toUpperCase() : "PENDING"}
                              </span>
                              <button
                                type="button"
                                className="btn-mini-pdf"
                                onClick={() => handleDownloadInvoice(inv.id)}
                                disabled={downloadingId === inv.id}
                                title="Download PDF"
                              >
                                <DownloadIcon size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* RECENT MAINTENANCE TICKETS */}
                <div className="tenant-card">
                  <div className="tenant-card-header">
                    <div className="header-title-wrap">
                      <MaintenanceIcon size={18} className="icon-accent" />
                      <h3>Recent Maintenance Complaints</h3>
                    </div>
                    <Link to="/tenant/maintenance" className="card-link-more">
                      View All &rarr;
                    </Link>
                  </div>

                  {recentComplaints.length === 0 ? (
                    <div className="card-empty-state">
                      <p>No complaints submitted yet.</p>
                    </div>
                  ) : (
                    <div className="tenant-mini-complaints-list">
                      {recentComplaints.map((c) => {
                        const isResolved = c.status === "resolved" || c.status === "closed";
                        return (
                          <div key={c.id} className="mini-complaint-item">
                            <div className="complaint-top">
                              <span className="mini-complaint-title">{c.title}</span>
                              <span
                                className={`mini-status-pill ${
                                  isResolved ? "resolved" : "open"
                                }`}
                              >
                                {c.status ? c.status.replace("_", " ").toUpperCase() : "OPEN"}
                              </span>
                            </div>
                            <p className="mini-complaint-desc">{c.description}</p>
                            {c.landlord_response && (
                              <div className="mini-complaint-resp">
                                <strong>Landlord reply:</strong> {c.landlord_response}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT / SECONDARY COLUMN */}
              <div className="tenant-dash-right">
                {/* PROFILE INFORMATION CARD */}
                <div className="tenant-card">
                  <div className="tenant-card-header">
                    <div className="header-title-wrap">
                      <UserIcon size={18} className="icon-accent" />
                      <h3>Tenant Profile</h3>
                    </div>
                  </div>

                  <div className="profile-details-list">
                    <div className="profile-row">
                      <span className="profile-label">Full Name</span>
                      <strong className="profile-val">{tenantName}</strong>
                    </div>

                    <div className="profile-row">
                      <span className="profile-label">Email Address</span>
                      <span className="profile-val">
                        {tenantProfile?.email || user.email || "-"}
                      </span>
                    </div>

                    <div className="profile-row">
                      <span className="profile-label">Phone Number</span>
                      <span className="profile-val">
                        {tenantProfile?.phone || "-"}
                      </span>
                    </div>

                    <div className="profile-row">
                      <span className="profile-label">Emergency Contact</span>
                      <span className="profile-val">
                        {tenantProfile?.emergency_contact || "-"}
                        {tenantProfile?.emergency_phone
                          ? ` (${tenantProfile.emergency_phone})`
                          : ""}
                      </span>
                    </div>

                    {tenantProfile?.shop_name && (
                      <>
                        <div className="profile-row">
                          <span className="profile-label">Business / Shop</span>
                          <strong className="profile-val">
                            {tenantProfile.shop_name}
                          </strong>
                        </div>
                        <div className="profile-row">
                          <span className="profile-label">GST Number</span>
                          <span className="profile-val">
                            {tenantProfile.gst_number || "None"}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* QUICK ASSISTANCE CARD */}
                <div className="tenant-card support-card">
                  <h4>Need Assistance?</h4>
                  <p>
                    For emergency repairs, maintenance issues, or questions regarding your rent invoice, please submit a maintenance ticket or contact your property management office.
                  </p>
                  <div className="support-actions">
                    <Link to="/tenant/maintenance" className="btn-support-ticket">
                      <WrenchIcon size={15} />
                      <span>Create Support Ticket</span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </TenantLayout>
  );
}

export default TenantDashboard;