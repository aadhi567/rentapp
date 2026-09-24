import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import TenantLayout from "../components/TenantLayout";
import {
  FileTextIcon,
  DownloadIcon,
  EyeIcon,
  RupeeIcon,
  CalendarIcon,
  BuildingIcon,
  WarningIcon,
  CheckIcon,
  FilterIcon,
} from "../components/Icons";
import "./TenantInvoices.css";
import { API_URL } from "../api";

function TenantInvoices() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [downloadingId, setDownloadingId] = useState(null);

  const token = localStorage.getItem("access_token");

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_URL}/payments/`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error("Unable to fetch invoices from the server.");
      }

      const data = await res.json();
      const list = Array.isArray(data) ? data : data.results || [];
      // Invoices are rent payments
      const rentInvoices = list.filter((p) => p.payment_type === "rent");
      setPayments(rentInvoices);
    } catch (err) {
      console.error("Error loading tenant invoices:", err);
      setError("Failed to load invoices. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async (paymentId, filename = null) => {
    setDownloadingId(paymentId);
    try {
      const res = await fetch(`${API_URL}/payments/${paymentId}/invoice/`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Unable to generate invoice PDF.");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || `rent-invoice-${String(paymentId).padStart(6, "0")}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message || "Failed to download invoice PDF.");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleViewPDF = async (paymentId) => {
    setDownloadingId(paymentId);
    try {
      const res = await fetch(`${API_URL}/payments/${paymentId}/invoice/`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Unable to view invoice PDF.");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (err) {
      alert(err.message || "Failed to view invoice PDF.");
    } finally {
      setDownloadingId(null);
    }
  };

  const filteredInvoices = useMemo(() => {
    return payments.filter((p) => {
      const matchesStatus =
        filterStatus === "all" || p.status.toLowerCase() === filterStatus.toLowerCase();

      const invNo = `INV-${String(p.id).padStart(6, "0")}`.toLowerCase();
      const unitNo = p.unit_number || p.lease?.unit?.unit_number || "";
      const bldg = p.building_name || p.lease?.unit?.floor?.building?.name || "";
      const q = searchQuery.toLowerCase().trim();

      const matchesSearch =
        !q ||
        invNo.includes(q) ||
        unitNo.toLowerCase().includes(q) ||
        bldg.toLowerCase().includes(q);

      return matchesStatus && matchesSearch;
    });
  }, [payments, filterStatus, searchQuery]);

  const stats = useMemo(() => {
    const total = payments.length;
    const paid = payments.filter((p) => p.status === "paid").length;
    const pending = payments.filter(
      (p) => p.status === "pending" || p.status === "overdue"
    ).length;
    const totalAmount = payments.reduce(
      (sum, p) => sum + parseFloat(p.amount || 0),
      0
    );
    return { total, paid, pending, totalAmount };
  }, [payments]);

  return (
    <TenantLayout
      breadcrumb="Invoices"
      title="My Rental Invoices"
      subtitle="Review and download official monthly rent invoices for your active leases."
    >
      <div className="tenant-invoices-page">
        {/* STATS SUMMARY */}
        <div className="tenant-inv-stats-grid">
          <div className="tenant-stat-card">
            <span className="tenant-stat-label">TOTAL INVOICES</span>
            <strong className="tenant-stat-value">{stats.total}</strong>
            <span className="tenant-stat-hint">All billed periods</span>
          </div>

          <div className="tenant-stat-card warning">
            <span className="tenant-stat-label">PENDING INVOICES</span>
            <strong className="tenant-stat-value">{stats.pending}</strong>
            <span className="tenant-stat-hint">Awaiting payment</span>
          </div>

          <div className="tenant-stat-card success">
            <span className="tenant-stat-label">PAID INVOICES</span>
            <strong className="tenant-stat-value">{stats.paid}</strong>
            <span className="tenant-stat-hint">Successfully settled</span>
          </div>

          <div className="tenant-stat-card">
            <span className="tenant-stat-label">TOTAL BILLED</span>
            <strong className="tenant-stat-value">
              ₹{stats.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </strong>
            <span className="tenant-stat-hint">Cumulative rent total</span>
          </div>
        </div>

        {/* TOOLBAR */}
        <div className="tenant-inv-toolbar">
          <div className="tenant-inv-search">
            <input
              type="text"
              placeholder="Search by invoice #, unit, or building..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="tenant-inv-filters">
            <div className="tenant-filter-pills">
              <button
                type="button"
                className={`tenant-pill-btn ${filterStatus === "all" ? "active" : ""}`}
                onClick={() => setFilterStatus("all")}
              >
                All
              </button>
              <button
                type="button"
                className={`tenant-pill-btn ${filterStatus === "pending" ? "active" : ""}`}
                onClick={() => setFilterStatus("pending")}
              >
                Pending
              </button>
              <button
                type="button"
                className={`tenant-pill-btn ${filterStatus === "paid" ? "active" : ""}`}
                onClick={() => setFilterStatus("paid")}
              >
                Paid
              </button>
              <button
                type="button"
                className={`tenant-pill-btn ${filterStatus === "overdue" ? "active" : ""}`}
                onClick={() => setFilterStatus("overdue")}
              >
                Overdue
              </button>
            </div>
          </div>
        </div>

        {/* ERROR STATE */}
        {error && (
          <div className="tenant-inv-error-banner" role="alert">
            <WarningIcon size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* LOADING STATE */}
        {loading ? (
          <div className="tenant-inv-loading">
            <div className="tenant-inv-spinner" />
            <p>Loading your rental invoices...</p>
          </div>
        ) : filteredInvoices.length === 0 ? (
          /* EMPTY STATE */
          <div className="tenant-inv-empty-card">
            <div className="tenant-empty-icon-wrap">
              <FileTextIcon size={32} />
            </div>
            <h3>No invoices found</h3>
            <p>
              {searchQuery || filterStatus !== "all"
                ? "No invoices match your selected search or filter criteria."
                : "You do not have any invoices generated yet."}
            </p>
          </div>
        ) : (
          /* INVOICES TABLE */
          <div className="tenant-inv-table-wrapper">
            <table className="tenant-inv-table">
              <thead>
                <tr>
                  <th>INVOICE #</th>
                  <th>PROPERTY & UNIT</th>
                  <th>DUE DATE</th>
                  <th>AMOUNT</th>
                  <th>STATUS</th>
                  <th style={{ textAlign: "right" }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((inv) => {
                  const invNumber = `INV-${String(inv.id).padStart(6, "0")}`;
                  const isPaid = inv.status === "paid";
                  const isOverdue = inv.status === "overdue";
                  const unitDisplay =
                    inv.unit_number || inv.lease?.unit?.unit_number
                      ? `Unit ${inv.unit_number || inv.lease?.unit?.unit_number}`
                      : "Unit -";
                  const bldgDisplay =
                    inv.building_name ||
                    inv.lease?.unit?.floor?.building?.name ||
                    "Building";

                  return (
                    <tr key={inv.id}>
                      <td>
                        <div className="tenant-inv-id-cell">
                          <FileTextIcon size={16} className="inv-icon" />
                          <span className="inv-num">{invNumber}</span>
                        </div>
                      </td>

                      <td>
                        <div className="tenant-inv-prop-cell">
                          <strong>{unitDisplay}</strong>
                          <span>{bldgDisplay}</span>
                        </div>
                      </td>

                      <td>
                        <div className="tenant-inv-date-cell">
                          <CalendarIcon size={14} />
                          <span>{inv.due_date || "-"}</span>
                        </div>
                      </td>

                      <td>
                        <span className="tenant-inv-amount">
                          ₹{parseFloat(inv.amount || 0).toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`tenant-inv-status-pill ${
                            isPaid ? "paid" : isOverdue ? "overdue" : "pending"
                          }`}
                        >
                          <span className="status-dot" />
                          {inv.status ? inv.status.toUpperCase() : "PENDING"}
                        </span>
                      </td>

                      <td style={{ textAlign: "right" }}>
                        <div className="tenant-inv-actions-cell">
                          {!isPaid && (
                            <Link
                              to={`/tenant/pay/${inv.id}`}
                              className="tenant-btn-pay-rent"
                              title="Pay Rent via UPI"
                            >
                              <span>Pay Rent</span>
                            </Link>
                          )}

                          <button
                            type="button"
                            className="tenant-btn-view-pdf"
                            onClick={() => handleViewPDF(inv.id)}
                            disabled={downloadingId === inv.id}
                            title="View Invoice PDF"
                          >
                            <EyeIcon size={15} />
                            <span>View</span>
                          </button>

                          <button
                            type="button"
                            className="tenant-btn-dl-pdf"
                            onClick={() => handleDownloadPDF(inv.id)}
                            disabled={downloadingId === inv.id}
                            title="Download Invoice PDF"
                          >
                            <DownloadIcon size={15} />
                            <span>
                              {downloadingId === inv.id ? "Downloading..." : "PDF"}
                            </span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </TenantLayout>
  );
}

export default TenantInvoices;
