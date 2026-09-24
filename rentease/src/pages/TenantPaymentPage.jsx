import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import TenantLayout from "../components/TenantLayout";
import {
  RupeeIcon,
  CalendarIcon,
  BuildingIcon,
  CheckIcon,
  WarningIcon,
  DownloadIcon,
  ArrowRightIcon,
  FileTextIcon,
} from "../components/Icons";
import { generateUpiQrSvg } from "../utils/upiQr";
import { API_URL } from "../api";
import "./TenantPaymentPage.css";

export default function TenantPaymentPage() {
  const { paymentId } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem("access_token");

  // State
  const [invoice, setInvoice] = useState(null);
  const [transaction, setTransaction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initiating, setInitiating] = useState(false);
  const [submittingUtr, setSubmittingUtr] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Confirmation modal / state
  const [confirmed, setConfirmed] = useState(false);

  // UTR input
  const [utrInput, setUtrInput] = useState("");
  const [utrError, setUtrError] = useState("");

  // QR Code SVG
  const [qrSvg, setQrSvg] = useState("");
  const [copiedUpi, setCopiedUpi] = useState(false);

  // Detect mobile device
  const isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent || ""
  );

  // Fetch invoice details & existing transactions
  const loadInvoiceData = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError("");

      try {
        const res = await fetch(`${API_URL}/payments/${paymentId}/`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          throw new Error("Unable to load invoice information.");
        }

        const data = await res.json();
        setInvoice(data);

        // Fetch any existing transactions for this payment
        const txnRes = await fetch(`${API_URL}/transactions/?payment=${paymentId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (txnRes.ok) {
          const txnData = await txnRes.json();
          const txns = Array.isArray(txnData) ? txnData : txnData.results || [];
          if (txns.length > 0) {
            // Sort by latest created
            const sorted = txns.sort(
              (a, b) => new Date(b.created_at) - new Date(a.created_at)
            );
            const latest = sorted[0];
            setTransaction(latest);

            if (latest.utr) {
              setUtrInput(latest.utr);
            }

            // If transaction has upi_uri and is pending, render QR
            if (latest.upi_uri && latest.status === "PENDING") {
              const svg = await generateUpiQrSvg(latest.upi_uri, { width: 220 });
              setQrSvg(svg);
            }
          }
        }
      } catch (err) {
        console.error("Error loading payment data:", err);
        setError(err.message || "Failed to load payment details.");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [paymentId, token]
  );

  useEffect(() => {
    loadInvoiceData();
  }, [loadInvoiceData]);

  // Periodic polling if transaction is PENDING
  useEffect(() => {
    if (!transaction || transaction.status !== "PENDING" || invoice?.status === "paid") {
      return;
    }

    const interval = setInterval(() => {
      loadInvoiceData(true);
    }, 10000); // Poll every 10 seconds

    return () => clearInterval(interval);
  }, [transaction, invoice?.status, loadInvoiceData]);

  // Handler: Initiate Payment Flow
  const handleInitiatePayment = async () => {
    setInitiating(true);
    setError("");
    setSuccessMsg("");

    try {
      const res = await fetch(`${API_URL}/transactions/initiate/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ payment: Number(paymentId) }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Unable to initiate payment transaction.");
      }

      setTransaction(data);
      if (data.upi_uri) {
        const svg = await generateUpiQrSvg(data.upi_uri, { width: 220 });
        setQrSvg(svg);
      }

      setSuccessMsg("UPI payment initiated! Choose your payment method below.");
    } catch (err) {
      setError(err.message || "Payment initiation failed.");
    } finally {
      setInitiating(false);
    }
  };

  // Handler: Submit UTR
  const handleSubmitUtr = async (e) => {
    e.preventDefault();
    setUtrError("");
    setError("");
    setSuccessMsg("");

    const cleanedUtr = utrInput.trim();
    if (!cleanedUtr) {
      setUtrError("Please enter your UPI reference number / UTR.");
      return;
    }
    if (cleanedUtr.length < 6 || cleanedUtr.length > 40) {
      setUtrError("UTR must be between 6 and 40 characters long.");
      return;
    }

    if (!transaction?.id) {
      setError("No active payment transaction found to attach UTR.");
      return;
    }

    setSubmittingUtr(true);
    try {
      const res = await fetch(`${API_URL}/transactions/${transaction.id}/submit_utr/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ utr: cleanedUtr }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to submit UTR.");
      }

      setTransaction(data);
      setSuccessMsg("UTR submitted successfully! Your landlord will verify the transaction.");
    } catch (err) {
      setError(err.message || "Failed to submit UTR.");
    } finally {
      setSubmittingUtr(false);
    }
  };

  // Handler: Cancel Transaction
  const handleCancelTransaction = async () => {
    if (!transaction?.id) return;
    if (!window.confirm("Are you sure you want to cancel this payment attempt?")) return;

    setCancelling(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/transactions/${transaction.id}/cancel/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Unable to cancel transaction.");
      }

      setTransaction(data);
      setQrSvg("");
      setSuccessMsg("Payment transaction cancelled.");
    } catch (err) {
      setError(err.message || "Failed to cancel transaction.");
    } finally {
      setCancelling(false);
    }
  };

  // Handler: Copy Landlord UPI ID
  const handleCopyUpi = (upiId) => {
    if (!upiId) return;
    navigator.clipboard.writeText(upiId);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  // Handler: Download PDF Receipt
  const handleDownloadReceipt = async () => {
    try {
      const res = await fetch(`${API_URL}/payments/${paymentId}/receipt/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Could not download receipt PDF.");

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
    }
  };

  if (loading) {
    return (
      <TenantLayout title="Rent Payment" breadcrumb="Pay Rent">
        <div className="upi-pay-loading-box">
          <div className="upi-pay-spinner" />
          <p>Loading rent invoice details...</p>
        </div>
      </TenantLayout>
    );
  }

  if (error && !invoice) {
    return (
      <TenantLayout title="Rent Payment" breadcrumb="Pay Rent">
        <div className="upi-pay-error-box">
          <WarningIcon size={32} />
          <h2>Invoice Not Found</h2>
          <p>{error}</p>
          <Link to="/tenant/invoices" className="upi-btn-back">
            Return to Invoices
          </Link>
        </div>
      </TenantLayout>
    );
  }

  const isAlreadyPaid = invoice?.status === "paid" || transaction?.status === "SUCCESS";
  const isPending = transaction?.status === "PENDING" && !isAlreadyPaid;
  const isCancelled = transaction?.status === "CANCELLED";
  const hasUtr = Boolean(transaction?.utr);

  const amountDisplay = parseFloat(invoice?.amount || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
  });

  return (
    <TenantLayout
      title="Rent Payment"
      breadcrumb="Pay Rent"
      subtitle="Direct peer-to-peer UPI transfer to your landlord."
    >
      <div className="upi-payment-container">
        {/* TOP ALERT BANNERS */}
        {error && (
          <div className="upi-alert upi-alert-danger">
            <WarningIcon size={18} />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="upi-alert upi-alert-success">
            <CheckIcon size={18} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* ALREADY PAID STATE */}
        {isAlreadyPaid && (
          <div className="upi-paid-success-card">
            <div className="upi-success-badge">
              <CheckIcon size={36} />
            </div>
            <h2>Payment Successful ✓</h2>
            <p className="upi-success-sub">
              Your rent of <strong>₹{amountDisplay}</strong> has been verified and marked as
              PAID.
            </p>

            <div className="upi-receipt-summary">
              <div className="summary-row">
                <span>Invoice #</span>
                <strong>INV-{String(invoice.id).padStart(6, "0")}</strong>
              </div>
              <div className="summary-row">
                <span>Property</span>
                <strong>
                  {invoice.unit_number ? `Unit ${invoice.unit_number}` : ""} (
                  {invoice.building_name || "Building"})
                </strong>
              </div>
              {transaction?.transaction_reference && (
                <div className="summary-row">
                  <span>Transaction Reference</span>
                  <code>{transaction.transaction_reference}</code>
                </div>
              )}
              {transaction?.utr && (
                <div className="summary-row">
                  <span>Bank UTR / Ref</span>
                  <code>{transaction.utr}</code>
                </div>
              )}
              <div className="summary-row">
                <span>Payment Method</span>
                <strong>UPI</strong>
              </div>
              <div className="summary-row">
                <span>Status</span>
                <span className="upi-pill-paid">PAID ✓</span>
              </div>
            </div>

            <div className="upi-success-actions">
              <button
                type="button"
                className="upi-btn-download-receipt"
                onClick={handleDownloadReceipt}
              >
                <DownloadIcon size={16} />
                <span>Download Official Receipt (PDF)</span>
              </button>
              <Link to="/tenant/payments" className="upi-btn-secondary">
                View Payment History
              </Link>
            </div>
          </div>
        )}

        {/* UNPAID / ACTIVE PAYMENT FLOW */}
        {!isAlreadyPaid && (
          <div className="upi-flow-grid">
            {/* LEFT COLUMN: INVOICE & LANDLORD SUMMARY */}
            <div className="upi-summary-card">
              <div className="upi-card-header">
                <h3>Rent Invoice Summary</h3>
                <span
                  className={`upi-status-pill ${
                    invoice.status === "overdue" ? "overdue" : "pending"
                  }`}
                >
                  {invoice.status ? invoice.status.toUpperCase() : "PENDING"}
                </span>
              </div>

              <div className="upi-amount-block">
                <span className="upi-amount-label">Payable Amount</span>
                <div className="upi-amount-val">
                  <span className="symbol">₹</span>
                  <span>{amountDisplay}</span>
                </div>
                <span className="upi-amount-fixed-hint">
                  Fixed monthly rent — securely verified
                </span>
              </div>

              <div className="upi-details-list">
                <div className="upi-detail-item">
                  <span className="label">Property / Unit</span>
                  <strong className="value">
                    {invoice.unit_number ? `Unit ${invoice.unit_number}, ` : ""}
                    {invoice.building_name}
                  </strong>
                </div>

                <div className="upi-detail-item">
                  <span className="label">Landlord Name</span>
                  <strong className="value">
                    {transaction?.landlord_name || "Authorized Landlord"}
                  </strong>
                </div>

                <div className="upi-detail-item">
                  <span className="label">Due Date</span>
                  <strong className="value">{invoice.due_date || "End of Month"}</strong>
                </div>

                {transaction?.upi_id && (
                  <div className="upi-detail-item">
                    <span className="label">Landlord UPI ID</span>
                    <div className="upi-id-copy-row">
                      <code>{transaction.upi_id}</code>
                      <button
                        type="button"
                        className="upi-btn-copy"
                        onClick={() => handleCopyUpi(transaction.upi_id)}
                        title="Copy UPI ID"
                      >
                        {copiedUpi ? "Copied!" : "Copy"}
                      </button>
                    </div>
                  </div>
                )}

                {transaction?.transaction_reference && (
                  <div className="upi-detail-item">
                    <span className="label">Internal Reference</span>
                    <code>{transaction.transaction_reference}</code>
                  </div>
                )}
              </div>

              {/* SECURITY ASSURANCE BOX */}
              <div className="upi-assurance-box">
                <div className="assurance-icon">🔒</div>
                <div className="assurance-text">
                  <strong>Direct Peer-to-Peer Transfer</strong>
                  <p>
                    Your rent is sent directly to your landlord's registered UPI ID. RentEase
                    never holds your money or asks for your banking credentials or UPI PIN.
                  </p>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: ACTION & PAYMENT INTERFACE */}
            <div className="upi-action-card">
              {/* STAGE 1: BEFORE PAYMENT INITIATION */}
              {!transaction || isCancelled ? (
                <div className="upi-initiate-step">
                  <div className="upi-step-icon">
                    <RupeeIcon size={32} />
                  </div>
                  <h3>Ready to Pay Rent</h3>
                  <p className="upi-step-desc">
                    Clicking below will prepare your unique UPI transaction and open real UPI
                    payment options for mobile or desktop.
                  </p>

                  <div className="upi-confirmation-banner">
                    <CheckIcon size={16} />
                    <span>
                      Confirmation: You are paying <strong>₹{amountDisplay}</strong> directly
                      to your landlord.
                    </span>
                  </div>

                  <button
                    type="button"
                    className="upi-btn-primary"
                    onClick={handleInitiatePayment}
                    disabled={initiating}
                  >
                    {initiating ? "Preparing UPI Transaction..." : "PAY RENT NOW"}
                  </button>
                </div>
              ) : (
                /* STAGE 2: PAYMENT INITIATED / PENDING */
                <div className="upi-active-step">
                  {/* STATUS TRACKER BAR */}
                  <div className="upi-status-tracker">
                    <div className="tracker-step completed">
                      <div className="circle">1</div>
                      <span>Initiated</span>
                    </div>
                    <div className="tracker-line completed" />
                    <div className={`tracker-step ${hasUtr ? "completed" : "active"}`}>
                      <div className="circle">2</div>
                      <span>Authorize UPI</span>
                    </div>
                    <div className="tracker-line" />
                    <div className="tracker-step">
                      <div className="circle">3</div>
                      <span>Landlord Verification</span>
                    </div>
                  </div>

                  {/* MOBILE EXPERIENCE: DEEP LINK */}
                  {isMobile ? (
                    <div className="upi-mobile-block">
                      <h4>Pay on this Device</h4>
                      <p>
                        Tap below to open your preferred UPI application (Google Pay, PhonePe,
                        Paytm, BHIM, CRED).
                      </p>

                      <a
                        href={transaction.upi_uri}
                        className="upi-btn-intent"
                        target="_self"
                      >
                        <span className="app-logos">⚡</span>
                        <span>PAY WITH UPI APP</span>
                      </a>

                      <p className="upi-intent-note">
                        Opening the UPI app does not finalize payment. Return to this screen
                        and enter your 12-digit UTR below.
                      </p>
                    </div>
                  ) : (
                    /* DESKTOP EXPERIENCE: DYNAMIC QR CODE */
                    <div className="upi-desktop-qr-block">
                      <h4>Scan with Any UPI App</h4>
                      <p className="qr-sub">
                        Open Google Pay, PhonePe, Paytm, or BHIM on your phone and scan:
                      </p>

                      <div className="upi-qr-frame">
                        {qrSvg ? (
                          <div
                            className="upi-qr-image"
                            dangerouslySetInnerHTML={{ __html: qrSvg }}
                          />
                        ) : (
                          <div className="upi-qr-loading">Generating QR...</div>
                        )}
                        <span className="qr-caption">Scan to pay ₹{amountDisplay}</span>
                      </div>

                      <div className="upi-supported-apps">
                        <span>Supported:</span>
                        <span className="app-tag">Google Pay</span>
                        <span className="app-tag">PhonePe</span>
                        <span className="app-tag">Paytm</span>
                        <span className="app-tag">BHIM</span>
                        <span className="app-tag">Any UPI App</span>
                      </div>
                    </div>
                  )}

                  {/* UTR SUBMISSION FORM */}
                  <div className="upi-utr-section">
                    <div className="utr-section-header">
                      <h4>Enter UPI Reference / UTR Number</h4>
                      <span
                        className={`upi-pill-status ${
                          hasUtr ? "status-verifying" : "status-pending"
                        }`}
                      >
                        {hasUtr ? "VERIFICATION PENDING" : "PENDING UTR"}
                      </span>
                    </div>

                    <p className="utr-help-text">
                      After completing the payment in your UPI app, find the 12-digit
                      <strong> UPI Transaction ID / UTR</strong> in your payment details and
                      enter it here so your landlord can verify the bank credit.
                    </p>

                    <form onSubmit={handleSubmitUtr} className="upi-utr-form">
                      <div className="utr-input-group">
                        <input
                          type="text"
                          value={utrInput}
                          onChange={(e) => {
                            setUtrInput(e.target.value);
                            setUtrError("");
                          }}
                          placeholder="e.g. 326712345678"
                          className={`utr-input ${utrError ? "error" : ""}`}
                          disabled={submittingUtr}
                        />
                        <button
                          type="submit"
                          className="upi-btn-submit-utr"
                          disabled={submittingUtr}
                        >
                          {submittingUtr
                            ? "Saving..."
                            : hasUtr
                            ? "Update UTR"
                            : "Submit UTR"}
                        </button>
                      </div>

                      {utrError && <span className="utr-error-msg">{utrError}</span>}
                    </form>

                    {hasUtr && (
                      <div className="utr-submitted-notice">
                        <CheckIcon size={16} />
                        <span>
                          UTR <code>{transaction.utr}</code> submitted. Awaiting landlord
                          verification against their bank account.
                        </span>
                      </div>
                    )}
                  </div>

                  {/* BOTTOM ACTIONS / STATUS REFRESH */}
                  <div className="upi-step-footer">
                    <button
                      type="button"
                      className="upi-btn-refresh-status"
                      onClick={() => {
                        setCheckingStatus(true);
                        loadInvoiceData(true).finally(() => setCheckingStatus(false));
                      }}
                      disabled={checkingStatus}
                    >
                      {checkingStatus ? "Checking..." : "Check Status"}
                    </button>

                    <button
                      type="button"
                      className="upi-btn-cancel-txn"
                      onClick={handleCancelTransaction}
                      disabled={cancelling}
                    >
                      {cancelling ? "Cancelling..." : "Cancel Attempt"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </TenantLayout>
  );
}
