import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeftIcon, DownloadIcon, MailIcon } from "../components/Icons";
import "./InvoiceView.css";

const API_URL = import.meta.env.VITE_API_URL || "https://rentapp-daiv.onrender.com/api";

function InvoiceView() {
  const navigate = useNavigate();
  const { paymentId } = useParams();

  const [pdfUrl, setPdfUrl] = useState("");
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailNotice, setEmailNotice] = useState(null);

  const loadData = async () => {
    const token = localStorage.getItem("access_token");

    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    setLoading(true);
    setError("");

    try {
      const [invoiceResp, paymentResp] = await Promise.all([
        fetch(`${API_URL}/payments/${paymentId}/invoice/`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/payments/${paymentId}/`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (invoiceResp.status === 401 || paymentResp.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        navigate("/login", { replace: true });
        return;
      }

      if (!invoiceResp.ok) {
        let message = "Unable to load invoice.";
        try {
          const data = await invoiceResp.json();
          message = data.detail || Object.values(data).flat()[0] || message;
        } catch {
          // Keep default
        }
        throw new Error(message);
      }

      const blob = await invoiceResp.blob();
      const objectUrl = URL.createObjectURL(blob);
      setPdfUrl(objectUrl);

      if (paymentResp.ok) {
        const paymentData = await paymentResp.json();
        setPayment(paymentData);
      }
    } catch (err) {
      setError(err.message || "Unable to load invoice.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [paymentId]);

  const downloadInvoice = () => {
    if (!pdfUrl) return;

    const link = document.createElement("a");
    link.href = pdfUrl;
    link.download = `rent-invoice-${String(paymentId).padStart(6, "0")}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleSendInvoice = async () => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    setEmailSending(true);
    setEmailNotice(null);

    try {
      const response = await fetch(`${API_URL}/payments/${paymentId}/send-invoice/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Failed to send invoice email.");
      }

      setEmailNotice({
        type: "success",
        message: data.detail || "Invoice sent to tenant successfully!",
      });

      if (data.payment) {
        setPayment(data.payment);
      }
    } catch (err) {
      setEmailNotice({
        type: "error",
        message: err.message || "Failed to send invoice email.",
      });
    } finally {
      setEmailSending(false);
    }
  };

  const handleRetryEmail = async () => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    setEmailSending(true);
    setEmailNotice(null);

    try {
      const response = await fetch(`${API_URL}/payments/${paymentId}/retry-email/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email_type: "invoice" }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Retry failed.");
      }

      setEmailNotice({
        type: "success",
        message: data.detail || "Email delivery retried successfully!",
      });

      if (data.payment) {
        setPayment(data.payment);
      }
    } catch (err) {
      setEmailNotice({
        type: "error",
        message: err.message || "Email retry failed.",
      });
    } finally {
      setEmailSending(false);
    }
  };

  const emailLog = payment?.latest_invoice_email;

  return (
    <div className="invoice-view-page">
      <div className="invoice-view-header">
        <div className="invoice-header-left">
          <button
            className="invoice-back-button"
            onClick={() => navigate(-1)}
          >
            <ArrowLeftIcon size={16} />
            <span>Back to Payments</span>
          </button>
          <div className="invoice-title-group">
            <span className="invoice-badge">INVOICE #{String(paymentId).padStart(5, "0")}</span>
            <h1>Rent Invoice Document</h1>
            <p className="invoice-subtitle">
              Generated commercial rent invoice preview with branding, GST tax breakdown, and payment instructions.
            </p>
          </div>
        </div>

        <div className="invoice-header-actions">
          <button
            type="button"
            className="invoice-email-button"
            onClick={handleSendInvoice}
            disabled={emailSending}
          >
            <MailIcon size={16} />
            <span>
              {emailSending
                ? "Sending..."
                : emailLog && emailLog.status === "sent"
                ? "Resend Invoice Email"
                : "Email Invoice to Tenant"}
            </span>
          </button>

          {pdfUrl && (
            <button
              className="invoice-download-button"
              onClick={downloadInvoice}
            >
              <DownloadIcon size={16} />
              <span>Download PDF</span>
            </button>
          )}
        </div>
      </div>

      {emailNotice && (
        <div className={`invoice-email-notice ${emailNotice.type}`}>
          <span>{emailNotice.message}</span>
          <button
            type="button"
            className="invoice-notice-dismiss"
            onClick={() => setEmailNotice(null)}
          >
            ×
          </button>
        </div>
      )}

      {/* Email Delivery Status Banner */}
      {payment && (
        <div className="invoice-delivery-banner">
          <div className="delivery-banner-content">
            {emailLog?.status === "sent" ? (
              <div className="delivery-status-indicator sent">
                <span className="status-dot green" />
                <span className="status-title">Email Delivered</span>
                <span className="status-detail">
                  Sent to <strong>{emailLog.recipient_email}</strong> on{" "}
                  {new Date(emailLog.sent_at || emailLog.created_at).toLocaleString()}
                </span>
              </div>
            ) : emailLog?.status === "failed" ? (
              <div className="delivery-status-indicator failed">
                <span className="status-dot red" />
                <span className="status-title">Delivery Failed</span>
                <span className="status-detail">
                  Failed sending to <strong>{emailLog.recipient_email}</strong>: {emailLog.error_message || "Unknown error"} (Retried {emailLog.retry_count} times)
                </span>
                <button
                  type="button"
                  className="delivery-retry-btn"
                  onClick={handleRetryEmail}
                  disabled={emailSending}
                >
                  Retry Send
                </button>
              </div>
            ) : (
              <div className="delivery-status-indicator pending">
                <span className="status-dot gray" />
                <span className="status-title">Not Emailed Yet</span>
                <span className="status-detail">
                  Tenant email: <strong>{payment.tenant_email || "No email registered"}</strong>
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {loading && (
        <div className="invoice-state">
          <div className="invoice-spinner" />
          <p>Generating document preview...</p>
        </div>
      )}

      {!loading && error && (
        <div className="invoice-error">
          <div className="invoice-error-badge">Error</div>
          <h3>Unable to display invoice</h3>
          <p>{error}</p>
          <button
            type="button"
            className="invoice-back-btn-action"
            onClick={() => navigate(-1)}
          >
            Go Back
          </button>
        </div>
      )}

      {!loading && pdfUrl && (
        <div className="invoice-pdf-container">
          <iframe
            title="Rent invoice"
            src={pdfUrl}
            className="invoice-pdf-frame"
          />
        </div>
      )}
    </div>
  );
}

export default InvoiceView;
