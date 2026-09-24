import { useState, useEffect, useMemo } from "react";
import TenantLayout from "../components/TenantLayout";
import {
  PaymentIcon,
  DownloadIcon,
  EyeIcon,
  CalendarIcon,
  CheckIcon,
  WarningIcon,
  RupeeIcon,
} from "../components/Icons";
import "./TenantReceipts.css";
import { API_URL } from "../api";

function TenantReceipts() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [downloadingId, setDownloadingId] = useState(null);

  const token = localStorage.getItem("access_token");

  useEffect(() => {
    fetchReceipts();
  }, []);

  const fetchReceipts = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_URL}/payments/`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error("Failed to load payment records.");
      }

      const data = await res.json();
      const list = Array.isArray(data) ? data : data.results || [];
      // Receipts are only available for paid rent payments
      const paidList = list.filter(
        (p) => p.status === "paid" && p.payment_type === "rent"
      );
      setPayments(paidList);
    } catch (err) {
      console.error("Error loading receipts:", err);
      setError("Unable to load receipts. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async (paymentId) => {
    setDownloadingId(paymentId);
    try {
      const res = await fetch(`${API_URL}/payments/${paymentId}/receipt/`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Unable to generate receipt PDF.");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rent-receipt-${String(paymentId).padStart(6, "0")}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message || "Failed to download receipt PDF.");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleViewPDF = async (paymentId) => {
    setDownloadingId(paymentId);
    try {
      const res = await fetch(`${API_URL}/payments/${paymentId}/receipt/`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Unable to view receipt PDF.");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (err) {
      alert(err.message || "Failed to view receipt PDF.");
    } finally {
      setDownloadingId(null);
    }
  };

  const filteredReceipts = useMemo(() => {
    return payments.filter((p) => {
      const rcpNo = `RCP-${String(p.id).padStart(6, "0")}`.toLowerCase();
      const unitNo = p.unit_number || p.lease?.unit?.unit_number || "";
      const bldg = p.building_name || p.lease?.unit?.floor?.building?.name || "";
      const txId = (p.transaction_id || "").toLowerCase();
      const q = searchQuery.toLowerCase().trim();

      if (!q) return true;
      return (
        rcpNo.includes(q) ||
        unitNo.toLowerCase().includes(q) ||
        bldg.toLowerCase().includes(q) ||
        txId.includes(q)
      );
    });
  }, [payments, searchQuery]);

  const totalPaid = useMemo(() => {
    return payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
  }, [payments]);

  return (
    <TenantLayout
      breadcrumb="Receipts"
      title="Official Rent Receipts"
      subtitle="Download GST-compliant tax and rent payment receipts for your records."
    >
      <div className="tenant-receipts-page">
        {/* STATS */}
        <div className="tenant-rcp-stats-grid">
          <div className="tenant-stat-card success">
            <span className="tenant-stat-label">TOTAL RECEIPTS</span>
            <strong className="tenant-stat-value">{payments.length}</strong>
            <span className="tenant-stat-hint">Confirmed payments</span>
          </div>

          <div className="tenant-stat-card">
            <span className="tenant-stat-label">TOTAL RENT PAID</span>
            <strong className="tenant-stat-value">
              ₹{totalPaid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </strong>
            <span className="tenant-stat-hint">Cumulative verified receipts</span>
          </div>
        </div>

        {/* TOOLBAR */}
        <div className="tenant-rcp-toolbar">
          <div className="tenant-rcp-search">
            <input
              type="text"
              placeholder="Search by receipt #, transaction ID, or unit..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* ERROR STATE */}
        {error && (
          <div className="tenant-rcp-error-banner" role="alert">
            <WarningIcon size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* LOADING STATE */}
        {loading ? (
          <div className="tenant-rcp-loading">
            <div className="tenant-rcp-spinner" />
            <p>Loading your rent receipts...</p>
          </div>
        ) : filteredReceipts.length === 0 ? (
          /* EMPTY STATE */
          <div className="tenant-rcp-empty-card">
            <div className="tenant-empty-icon-wrap">
              <PaymentIcon size={32} />
            </div>
            <h3>No payment receipts available</h3>
            <p>
              {searchQuery
                ? "No receipts matched your search query."
                : "Payment receipts will appear here once your rent payments are marked as paid."}
            </p>
          </div>
        ) : (
          /* TABLE */
          <div className="tenant-rcp-table-wrapper">
            <table className="tenant-rcp-table">
              <thead>
                <tr>
                  <th>RECEIPT #</th>
                  <th>PAID DATE</th>
                  <th>PROPERTY & UNIT</th>
                  <th>METHOD & TXN</th>
                  <th>AMOUNT PAID</th>
                  <th>STATUS</th>
                  <th style={{ textAlign: "right" }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredReceipts.map((rcp) => {
                  const rcpNumber = `RCP-${String(rcp.id).padStart(6, "0")}`;
                  const unitDisplay =
                    rcp.unit_number || rcp.lease?.unit?.unit_number
                      ? `Unit ${rcp.unit_number || rcp.lease?.unit?.unit_number}`
                      : "Unit -";
                  const bldgDisplay =
                    rcp.building_name ||
                    rcp.lease?.unit?.floor?.building?.name ||
                    "Building";

                  return (
                    <tr key={rcp.id}>
                      <td>
                        <div className="tenant-rcp-id-cell">
                          <CheckIcon size={16} className="rcp-check-icon" />
                          <span className="rcp-num">{rcpNumber}</span>
                        </div>
                      </td>

                      <td>
                        <div className="tenant-rcp-date-cell">
                          <CalendarIcon size={14} />
                          <span>{rcp.paid_date || rcp.due_date || "-"}</span>
                        </div>
                      </td>

                      <td>
                        <div className="tenant-rcp-prop-cell">
                          <strong>{unitDisplay}</strong>
                          <span>{bldgDisplay}</span>
                        </div>
                      </td>

                      <td>
                        <div className="tenant-rcp-method-cell">
                          <span className="method-label">
                            {rcp.payment_method
                              ? rcp.payment_method.replace("_", " ").toUpperCase()
                              : "ONLINE"}
                          </span>
                          {rcp.transaction_id && (
                            <span className="txn-sub">Txn: {rcp.transaction_id}</span>
                          )}
                        </div>
                      </td>

                      <td>
                        <span className="tenant-rcp-amount">
                          ₹
                          {parseFloat(rcp.amount || 0).toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </td>

                      <td>
                        <span className="tenant-rcp-status-pill paid">
                          <span className="status-dot" />
                          PAID
                        </span>
                      </td>

                      <td style={{ textAlign: "right" }}>
                        <div className="tenant-rcp-actions-cell">
                          <button
                            type="button"
                            className="tenant-btn-view-pdf"
                            onClick={() => handleViewPDF(rcp.id)}
                            disabled={downloadingId === rcp.id}
                            title="View Receipt PDF"
                          >
                            <EyeIcon size={15} />
                            <span>View</span>
                          </button>

                          <button
                            type="button"
                            className="tenant-btn-dl-pdf"
                            onClick={() => handleDownloadPDF(rcp.id)}
                            disabled={downloadingId === rcp.id}
                            title="Download Receipt PDF"
                          >
                            <DownloadIcon size={15} />
                            <span>
                              {downloadingId === rcp.id ? "Downloading..." : "PDF"}
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

export default TenantReceipts;
