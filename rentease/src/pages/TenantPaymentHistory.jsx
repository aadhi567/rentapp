import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import TenantLayout from "../components/TenantLayout";
import {
  PaymentIcon,
  DownloadIcon,
  EyeIcon,
  RupeeIcon,
  CalendarIcon,
  CheckIcon,
  WarningIcon,
  FilterIcon,
  FileTextIcon,
  ArrowRightIcon,
} from "../components/Icons";
import { API_URL } from "../api";
import "./TenantPaymentHistory.css";

export default function TenantPaymentHistory() {
  const [payments, setPayments] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [downloadingId, setDownloadingId] = useState(null);

  const token = localStorage.getItem("access_token");

  useEffect(() => {
    fetchHistoryData();
  }, []);

  const fetchHistoryData = async () => {
    setLoading(true);
    setError("");

    try {
      // 1. Fetch payments
      const payRes = await fetch(`${API_URL}/payments/`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!payRes.ok) throw new Error("Failed to load payment history.");
      const payData = await payRes.json();
      const payList = Array.isArray(payData) ? payData : payData.results || [];
      const rentPayments = payList.filter((p) => p.payment_type === "rent");
      setPayments(rentPayments);

      // 2. Fetch transactions
      const txnRes = await fetch(`${API_URL}/transactions/`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (txnRes.ok) {
        const txnData = await txnRes.json();
        const txnList = Array.isArray(txnData) ? txnData : txnData.results || [];
        setTransactions(txnList);
      }
    } catch (err) {
      console.error("Error loading payment history:", err);
      setError("Unable to load payment history. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReceipt = async (paymentId) => {
    setDownloadingId(paymentId);
    try {
      const res = await fetch(`${API_URL}/payments/${paymentId}/receipt/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Unable to download receipt PDF.");
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
      alert(err.message || "Failed to download receipt.");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleViewReceipt = async (paymentId) => {
    setDownloadingId(paymentId);
    try {
      const res = await fetch(`${API_URL}/payments/${paymentId}/receipt/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Unable to view receipt PDF.");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (err) {
      alert(err.message || "Failed to view receipt.");
    } finally {
      setDownloadingId(null);
    }
  };

  // Metrics
  const metrics = useMemo(() => {
    let totalPaid = 0;
    let pendingVerificationCount = 0;
    let overdueCount = 0;

    payments.forEach((p) => {
      const amt = parseFloat(p.amount || 0);
      if (p.status === "paid") {
        totalPaid += amt;
      } else if (p.status === "overdue") {
        overdueCount += 1;
      }
    });

    transactions.forEach((t) => {
      if (t.status === "PENDING" && t.utr) {
        pendingVerificationCount += 1;
      }
    });

    return { totalPaid, pendingVerificationCount, overdueCount };
  }, [payments, transactions]);

  // Merged items
  const historyItems = useMemo(() => {
    return payments.map((p) => {
      // Find matching transactions for this payment
      const pTxns = transactions.filter((t) => t.payment === p.id);
      const latestTxn = pTxns.sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      )[0] || null;

      let effectiveStatus = p.status;
      if (p.status === "paid") {
        effectiveStatus = "paid";
      } else if (latestTxn?.status === "PENDING" && latestTxn?.utr) {
        effectiveStatus = "verifying";
      } else if (latestTxn?.status === "PENDING") {
        effectiveStatus = "pending_utr";
      } else if (p.status === "overdue") {
        effectiveStatus = "overdue";
      } else {
        effectiveStatus = "unpaid";
      }

      return {
        ...p,
        latestTxn,
        effectiveStatus,
      };
    });
  }, [payments, transactions]);

  // Filtered
  const filteredItems = useMemo(() => {
    return historyItems.filter((item) => {
      // Status filter
      if (statusFilter === "paid" && item.effectiveStatus !== "paid") return false;
      if (statusFilter === "verifying" && item.effectiveStatus !== "verifying") return false;
      if (statusFilter === "pending" && item.effectiveStatus === "paid") return false;
      if (statusFilter === "overdue" && item.effectiveStatus !== "overdue") return false;

      // Search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const refMatch = item.latestTxn?.transaction_reference?.toLowerCase().includes(query);
        const utrMatch = item.latestTxn?.utr?.toLowerCase().includes(query);
        const unitMatch = item.unit_number?.toLowerCase().includes(query);
        const invMatch = `inv-${String(item.id).padStart(6, "0")}`.includes(query);
        return refMatch || utrMatch || unitMatch || invMatch;
      }

      return true;
    });
  }, [historyItems, statusFilter, searchQuery]);

  return (
    <TenantLayout
      title="Payment History"
      breadcrumb="Payments"
      subtitle="Complete ledger of rent payments, UPI transactions, and receipts."
    >
      <div className="pay-history-container">
        {/* METRICS ROW */}
        <div className="pay-metrics-grid">
          <div className="pay-metric-card">
            <div className="pay-metric-header">
              <span className="pay-metric-label">TOTAL PAID TO DATE</span>
              <div className="pay-metric-icon green">
                <RupeeIcon size={18} />
              </div>
            </div>
            <strong className="pay-metric-value">
              ₹
              {metrics.totalPaid.toLocaleString("en-IN", {
                minimumFractionDigits: 2,
              })}
            </strong>
            <span className="pay-metric-sub">Directly transferred to landlord</span>
          </div>

          <div className="pay-metric-card">
            <div className="pay-metric-header">
              <span className="pay-metric-label">PENDING VERIFICATION</span>
              <div className="pay-metric-icon blue">
                <PaymentIcon size={18} />
              </div>
            </div>
            <strong className="pay-metric-value">
              {metrics.pendingVerificationCount}
            </strong>
            <span className="pay-metric-sub">Awaiting landlord confirmation</span>
          </div>

          <div className="pay-metric-card">
            <div className="pay-metric-header">
              <span className="pay-metric-label">OVERDUE RENTS</span>
              <div
                className={`pay-metric-icon ${metrics.overdueCount > 0 ? "red" : "amber"}`}
              >
                <CalendarIcon size={18} />
              </div>
            </div>
            <strong className="pay-metric-value">{metrics.overdueCount}</strong>
            <span className="pay-metric-sub">
              {metrics.overdueCount > 0 ? "Requires immediate settlement" : "No overdue dues"}
            </span>
          </div>
        </div>

        {/* CONTROLS: FILTERS & SEARCH */}
        <div className="pay-controls-bar">
          <div className="pay-filter-tabs">
            <button
              type="button"
              className={`pay-tab-btn ${statusFilter === "all" ? "active" : ""}`}
              onClick={() => setStatusFilter("all")}
            >
              All Records ({historyItems.length})
            </button>
            <button
              type="button"
              className={`pay-tab-btn ${statusFilter === "paid" ? "active" : ""}`}
              onClick={() => setStatusFilter("paid")}
            >
              Verified / Paid
            </button>
            <button
              type="button"
              className={`pay-tab-btn ${statusFilter === "verifying" ? "active" : ""}`}
              onClick={() => setStatusFilter("verifying")}
            >
              Pending Verification
            </button>
            <button
              type="button"
              className={`pay-tab-btn ${statusFilter === "pending" ? "active" : ""}`}
              onClick={() => setStatusFilter("pending")}
            >
              Unsettled
            </button>
          </div>

          <div className="pay-search-box">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by UTR, reference, or invoice..."
            />
          </div>
        </div>

        {/* ERROR BANNER */}
        {error && (
          <div className="pay-error-banner">
            <WarningIcon size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* LOADING & TABLE */}
        {loading ? (
          <div className="pay-loading-box">
            <div className="pay-spinner" />
            <p>Loading transactions...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="pay-empty-box">
            <FileTextIcon size={40} />
            <h3>No Transactions Found</h3>
            <p>
              {searchQuery || statusFilter !== "all"
                ? "No payments match your active filter."
                : "You have not made any rent payments yet."}
            </p>
          </div>
        ) : (
          <div className="pay-table-wrapper">
            <table className="pay-history-table">
              <thead>
                <tr>
                  <th>INVOICE / REF</th>
                  <th>PROPERTY & UNIT</th>
                  <th>DUE DATE</th>
                  <th>AMOUNT</th>
                  <th>METHOD</th>
                  <th>BANK UTR</th>
                  <th>STATUS</th>
                  <th style={{ textAlign: "right" }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const invNum = `INV-${String(item.id).padStart(6, "0")}`;
                  const isPaid = item.effectiveStatus === "paid";
                  const isVerifying = item.effectiveStatus === "verifying";
                  const isPendingUtr = item.effectiveStatus === "pending_utr";
                  const isOverdue = item.effectiveStatus === "overdue";

                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="pay-id-cell">
                          <span className="inv-badge">{invNum}</span>
                          {item.latestTxn?.transaction_reference && (
                            <code className="txn-ref">
                              {item.latestTxn.transaction_reference}
                            </code>
                          )}
                        </div>
                      </td>

                      <td>
                        <div className="pay-prop-cell">
                          <strong>
                            {item.unit_number ? `Unit ${item.unit_number}` : "Unit -"}
                          </strong>
                          <span>{item.building_name || "Property"}</span>
                        </div>
                      </td>

                      <td>
                        <span className="pay-date">{item.due_date || "-"}</span>
                      </td>

                      <td>
                        <span className="pay-amount-text">
                          ₹
                          {parseFloat(item.amount || 0).toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </td>

                      <td>
                        <span className="pay-method-badge">
                          {item.payment_method?.toUpperCase() || "UPI"}
                        </span>
                      </td>

                      <td>
                        {item.latestTxn?.utr ? (
                          <code className="utr-code">{item.latestTxn.utr}</code>
                        ) : (
                          <span className="utr-none">—</span>
                        )}
                      </td>

                      <td>
                        {isPaid && (
                          <span className="pay-status-pill pill-paid">
                            <CheckIcon size={12} />
                            <span>PAID ✓</span>
                          </span>
                        )}
                        {isVerifying && (
                          <span className="pay-status-pill pill-verifying">
                            <span className="status-dot" />
                            <span>VERIFICATION PENDING</span>
                          </span>
                        )}
                        {isPendingUtr && (
                          <span className="pay-status-pill pill-pending">
                            <span className="status-dot" />
                            <span>PENDING UTR</span>
                          </span>
                        )}
                        {isOverdue && (
                          <span className="pay-status-pill pill-overdue">
                            <WarningIcon size={12} />
                            <span>OVERDUE</span>
                          </span>
                        )}
                        {!isPaid && !isVerifying && !isPendingUtr && !isOverdue && (
                          <span className="pay-status-pill pill-pending">
                            <span className="status-dot" />
                            <span>PENDING</span>
                          </span>
                        )}
                      </td>

                      <td style={{ textAlign: "right" }}>
                        <div className="pay-actions-cell">
                          {isPaid ? (
                            <>
                              <button
                                type="button"
                                className="pay-btn-icon"
                                onClick={() => handleViewReceipt(item.id)}
                                disabled={downloadingId === item.id}
                                title="View Receipt PDF"
                              >
                                <EyeIcon size={15} />
                              </button>
                              <button
                                type="button"
                                className="pay-btn-receipt"
                                onClick={() => handleDownloadReceipt(item.id)}
                                disabled={downloadingId === item.id}
                                title="Download PDF Receipt"
                              >
                                <DownloadIcon size={14} />
                                <span>Receipt</span>
                              </button>
                            </>
                          ) : (
                            <Link
                              to={`/tenant/pay/${item.id}`}
                              className="pay-btn-pay-action"
                            >
                              <span>{isVerifying ? "View / UTR" : "Pay Rent"}</span>
                              <ArrowRightIcon size={13} />
                            </Link>
                          )}
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
