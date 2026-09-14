import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeftIcon, DownloadIcon, MailIcon } from "../components/Icons";
import "./ReceiptView.css";

import { API_URL } from "../api";

function ReceiptView() {
  const { paymentId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");
  const [payment, setPayment] = useState(null);
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
      const [receiptResp, paymentResp] = await Promise.all([
        fetch(`${API_URL}/payments/${paymentId}/receipt/`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/payments/${paymentId}/`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (receiptResp.status === 401 || paymentResp.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("user");
        navigate("/login", { replace: true });
        return;
      }

      if (!receiptResp.ok) {
        let message = "Unable to load payment receipt.";
        try {
          const data = await receiptResp.json();
          message = data.detail || Object.values(data).flat()[0] || message;
        } catch {
          // Keep default message
        }
        throw new Error(message);
      }

      const blob = await receiptResp.blob();
      const objectUrl = URL.createObjectURL(blob);
      setPdfUrl(objectUrl);

      if (paymentResp.ok) {
        const paymentData = await paymentResp.json();
        setPayment(paymentData);
      }
    } catch (err) {
      console.error("Receipt load error:", err);
      setError(err.message || "Unable to load payment receipt.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [paymentId]);

  const downloadReceipt = async () => {
    const token = localStorage.getItem("access_token");

    if (!token || !pdfUrl) {
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/payments/${paymentId}/receipt/`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Unable to download receipt.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `rent-receipt-${paymentId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || "Unable to download receipt.");
    }
  };

  const handleSendReceipt = async () => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    setEmailSending(true);
    setEmailNotice(null);

    try {
      const response = await fetch(`${API_URL}/payments/${paymentId}/send-receipt/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Failed to email receipt.");
      }

      setEmailNotice({
        type: "success",
        message: data.detail || "Receipt emailed to tenant successfully!",
      });

      if (data.payment) {
        setPayment(data.payment);
      }
    } catch (err) {
      setEmailNotice({
        type: "error",
        message: err.message || "Failed to email receipt.",
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
        body: JSON.stringify({ email_type: "receipt" }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Retry failed.");
      }

      setEmailNotice({
        type: "success",
        message: data.detail || "Receipt email retried successfully!",
      });

      if (data.payment) {
        setPayment(data.payment);
      }
    } catch (err) {
      setEmailNotice({
        type: "error",
        message: err.message || "Receipt retry failed.",
      });
    } finally {
      setEmailSending(false);
    }
  };

  const emailLog = payment?.latest_receipt_email;

  return (
    <div className="receipt-view-page">
      <div className="receipt-view-header">
        <div className="receipt-header-left">
          <button
            type="button"
            className="receipt-back-button"
            onClick={() => navigate(-1)}
          >
            <ArrowLeftIcon size={16} />
            <span>Back</span>
          </button>
          <div className="receipt-title-group">
            <span className="receipt-badge">RECEIPT #{String(paymentId).padStart(5, "0")}</span>
            <h1>Rent Payment Receipt</h1>
            <p className="receipt-subtitle">Official acknowledgement of paid commercial rent transaction.</p>
          </div>
        </div>

        <div className="receipt-header-actions">
          <button
            type="button"
            className="receipt-email-button"
            onClick={handleSendReceipt}
            disabled={emailSending}
          >
            <MailIcon size={16} />
            <span>
              {emailSending
                ? "Sending..."
                : emailLog && emailLog.status === "sent"
                ? "Resend Receipt Email"
                : "Email Receipt to Tenant"}
            </span>
          </button>

          {pdfUrl && (
            <button
              type="button"
              className="receipt-download-button"
              onClick={downloadReceipt}
            >
              <DownloadIcon size={16} />
              <span>Download Receipt</span>
            </button>
          )}
        </div>
      </div>

      {emailNotice && (
        <div className={`receipt-email-notice ${emailNotice.type}`}>
          <span>{emailNotice.message}</span>
          <button
            type="button"
            className="receipt-notice-dismiss"
            onClick={() => setEmailNotice(null)}
          >
            ×
          </button>
        </div>
      )}

      {/* Email Delivery Status Banner */}
      {payment && (
        <div className="receipt-delivery-banner">
          <div className="delivery-banner-content">
            {emailLog?.status === "sent" ? (
              <div className="delivery-status-indicator sent">
                <span className="status-dot green" />
                <span className="status-title">Receipt Delivered</span>
                <span className="status-detail">
                  Emailed to <strong>{emailLog.recipient_email}</strong> on{" "}
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
        <div className="receipt-view-state">
          <div className="receipt-spinner" />
          <p>Generating payment receipt preview...</p>
        </div>
      )}

      {error && !loading && (
        <div className="receipt-view-error">
          <div className="receipt-error-badge">Error</div>
          <h3>Unable to open receipt</h3>
          <p>{error}</p>
          <button
            type="button"
            className="receipt-back-btn-action"
            onClick={() => navigate(-1)}
          >
            Go Back
          </button>
        </div>
      )}

      {!loading && pdfUrl && (
        <div className="receipt-pdf-container">
          <iframe
            title="Payment Receipt"
            src={pdfUrl}
            className="receipt-pdf-frame"
          />
        </div>
      )}
    </div>
  );
}

export default ReceiptView;
