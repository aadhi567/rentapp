import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import LandlordLayout from "../components/LandlordLayout";
import { PlusIcon, MailIcon } from "../components/Icons";
import "./Payments.css";


const API_URL =
  import.meta.env.VITE_API_URL || "https://rentapp-daiv.onrender.com/api";


const initialForm = {
  lease: "",
  payment_type: "rent",
  amount: "",
  due_date: "",
  paid_date: "",
  payment_method: "",
  status: "pending",
  transaction_id: "",
};


function Payments() {

  const navigate =
    useNavigate();


  const [payments, setPayments] =
    useState([]);

  const [leases, setLeases] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [showForm, setShowForm] =
    useState(false);

  const [editingPayment, setEditingPayment] =
    useState(null);

  const [deletingPayment, setDeletingPayment] =
    useState(null);

  const [form, setForm] =
    useState(initialForm);

  const [actionLoading, setActionLoading] = useState({});
  const [notice, setNotice] = useState(null);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchDate, setBatchDate] = useState(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}-01`;
  });
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchResult, setBatchResult] = useState(null);


  const token =
    localStorage.getItem(
      "access_token"
    );


  const logout = () => {

    localStorage.removeItem(
      "access_token"
    );

    localStorage.removeItem(
      "refresh_token"
    );

    localStorage.removeItem(
      "user"
    );

    navigate(
      "/login",
      {
        replace: true,
      }
    );
  };


  const authenticatedFetch =
    async (
      url,
      options = {}
    ) => {

      if (!token) {
        logout();
        return null;
      }

      return fetch(
        url,
        {
          ...options,

          headers: {
            ...(options.headers || {}),

            Authorization:
              `Bearer ${token}`,

            "Content-Type":
              "application/json",
          },
        }
      );
    };


  const loadData =
    async () => {

      setLoading(true);
      setError("");

      try {

        const [
          paymentsResponse,
          leasesResponse,
        ] = await Promise.all([
          authenticatedFetch(
            `${API_URL}/payments/`
          ),

          authenticatedFetch(
            `${API_URL}/leases/`
          ),
        ]);


        if (
          !paymentsResponse ||
          !leasesResponse
        ) {
          return;
        }


        if (
          paymentsResponse.status ===
            401 ||
          leasesResponse.status ===
            401
        ) {
          logout();
          return;
        }


        const [
          paymentsData,
          leasesData,
        ] = await Promise.all([
          paymentsResponse.json(),
          leasesResponse.json(),
        ]);


        if (
          !paymentsResponse.ok
        ) {
          throw new Error(
            paymentsData.detail ||
              "Unable to load payments."
          );
        }


        if (
          !leasesResponse.ok
        ) {
          throw new Error(
            leasesData.detail ||
              "Unable to load leases."
          );
        }


        setPayments(
          Array.isArray(
            paymentsData
          )
            ? paymentsData
            : []
        );


        setLeases(
          Array.isArray(
            leasesData
          )
            ? leasesData
            : []
        );

      } catch (
        err
      ) {

        console.error(
          "Payment loading error:",
          err
        );

        setError(
          err.message ||
            "Unable to load payments."
        );

      } finally {

        setLoading(false);
      }
    };

  const handleSendInvoice = async (paymentId) => {
    setActionLoading((prev) => ({ ...prev, [paymentId]: true }));
    setNotice(null);
    try {
      const response = await authenticatedFetch(
        `${API_URL}/payments/${paymentId}/send-invoice/`,
        { method: "POST" }
      );
      if (!response) return;
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Failed to send invoice email.");
      }
      setNotice({ type: "success", message: data.detail || "Invoice sent to tenant successfully!" });
      if (data.payment) {
        setPayments((prev) =>
          prev.map((p) => (p.id === paymentId ? data.payment : p))
        );
      }
    } catch (err) {
      setNotice({ type: "error", message: err.message || "Failed to send invoice email." });
    } finally {
      setActionLoading((prev) => ({ ...prev, [paymentId]: false }));
    }
  };

  const handleSendReceipt = async (paymentId) => {
    setActionLoading((prev) => ({ ...prev, [paymentId]: true }));
    setNotice(null);
    try {
      const response = await authenticatedFetch(
        `${API_URL}/payments/${paymentId}/send-receipt/`,
        { method: "POST" }
      );
      if (!response) return;
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Failed to send receipt email.");
      }
      setNotice({ type: "success", message: data.detail || "Payment receipt sent to tenant successfully!" });
      if (data.payment) {
        setPayments((prev) =>
          prev.map((p) => (p.id === paymentId ? data.payment : p))
        );
      }
    } catch (err) {
      setNotice({ type: "error", message: err.message || "Failed to send receipt email." });
    } finally {
      setActionLoading((prev) => ({ ...prev, [paymentId]: false }));
    }
  };

  const handleRetryEmail = async (paymentId, emailType) => {
    setActionLoading((prev) => ({ ...prev, [paymentId]: true }));
    setNotice(null);
    try {
      const response = await authenticatedFetch(
        `${API_URL}/payments/${paymentId}/retry-email/`,
        {
          method: "POST",
          body: JSON.stringify({ email_type: emailType }),
        }
      );
      if (!response) return;
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Failed to retry email delivery.");
      }
      setNotice({ type: "success", message: data.detail || "Email retried successfully!" });
      if (data.payment) {
        setPayments((prev) =>
          prev.map((p) => (p.id === paymentId ? data.payment : p))
        );
      }
    } catch (err) {
      setNotice({ type: "error", message: err.message || "Failed to retry email delivery." });
    } finally {
      setActionLoading((prev) => ({ ...prev, [paymentId]: false }));
    }
  };

  const handleGenerateMonthlyInvoices = async () => {
    setBatchLoading(true);
    setBatchResult(null);
    try {
      const response = await authenticatedFetch(
        `${API_URL}/payments/generate-monthly-invoices/`,
        {
          method: "POST",
          body: JSON.stringify({ date: batchDate, send_emails: true }),
        }
      );
      if (!response) return;
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Failed to generate monthly invoices.");
      }
      setBatchResult(data);
      await loadData();
    } catch (err) {
      setBatchResult({ error: err.message || "Failed to generate monthly invoices." });
    } finally {
      setBatchLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);


  const totals =
    useMemo(() => {

      let total = 0;
      let paid = 0;
      let pending = 0;
      let overdue = 0;

      payments.forEach(
        (
          payment
        ) => {

          const amount =
            Number(
              payment.amount ||
                0
            );

          total += amount;

          if (
            payment.status ===
            "paid"
          ) {

            paid += amount;

          } else if (
            payment.status ===
            "overdue"
          ) {

            overdue += amount;

          } else {

            pending += amount;
          }
        }
      );


      return {
        total,
        paid,
        pending,
        overdue,
      };

    }, [
      payments,
    ]);


  const formatMoney = (
    value
  ) => {

    return Number(
      value || 0
    ).toLocaleString(
      "en-IN",
      {
        maximumFractionDigits: 2,
      }
    );
  };


  const formatDate = (
    value
  ) => {

    if (!value) {
      return "-";
    }

    const parts =
      String(value).split(
        "-"
      );

    if (
      parts.length !==
      3
    ) {
      return value;
    }

    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };


  const getToday = () => {

    const date =
      new Date();

    return date
      .toISOString()
      .split("T")[0];
  };


  const openCreate =
    () => {

      setError("");

      setEditingPayment(
        null
      );

      setForm({
        ...initialForm,
        due_date:
          getToday(),
      });

      setShowForm(
        true
      );
    };


  const openEdit =
    (
      payment
    ) => {

      setError("");

      setEditingPayment(
        payment
      );

      setForm({
        lease:
          payment.lease ||
          "",
        payment_type:
          payment.payment_type ||
          "rent",
        amount:
          payment.amount ||
          "",
        due_date:
          payment.due_date ||
          "",
        paid_date:
          payment.paid_date ||
          "",
        payment_method:
          payment.payment_method ||
          "",
        status:
          payment.status ||
          "pending",
        transaction_id:
          payment.transaction_id ||
          "",
      });

      setShowForm(
        true
      );
    };


  const closeForm =
    () => {

      if (saving) {
        return;
      }

      setShowForm(
        false
      );

      setEditingPayment(
        null
      );

      setForm(
        initialForm
      );
    };


  const handleChange =
    (
      event
    ) => {

      const {
        name,
        value,
      } = event.target;


      setForm(
        (
          previous
        ) => ({
          ...previous,
          [name]:
            value,
        })
      );
    };

  const selectedLease = useMemo(() => {
    return leases.find((l) => Number(l.id) === Number(form.lease));
  }, [leases, form.lease]);

  const gstRate = useMemo(() => {
    if (!selectedLease) return 0;
    return Number(selectedLease.tenant_gst_rate || 0);
  }, [selectedLease]);

  const gstCalculations = useMemo(() => {
    const base = Number(form.amount || 0);
    const gstTotal = (base * gstRate) / 100;
    const cgst = gstTotal / 2;
    const sgst = gstTotal / 2;
    const total = base + gstTotal;
    return {
      base,
      gstRate,
      gstTotal,
      cgst,
      sgst,
      total,
    };
  }, [form.amount, gstRate]);


  const validateForm =
    () => {

      if (!form.lease) {
        return "Please select a lease.";
      }

      if (
        !form.amount ||
        Number(
          form.amount
        ) <= 0
      ) {
        return "Enter a valid payment amount.";
      }

      if (!form.due_date) {
        return "Due date is required.";
      }

      if (
        form.status ===
          "paid" &&
        !form.paid_date
      ) {
        return "Paid date is required for a paid payment.";
      }

      if (
        form.status ===
          "paid" &&
        !form.payment_method
      ) {
        return "Payment method is required for a paid payment.";
      }

      return null;
    };


  const savePayment =
    async (
      event
    ) => {

      event.preventDefault();

      setError("");


      const validationError =
        validateForm();


      if (validationError) {

        setError(
          validationError
        );

        return;
      }


      setSaving(
        true
      );


      try {

        const payload = {
          lease:
            Number(
              form.lease
            ),

          payment_type:
            form.payment_type,

          amount:
            form.amount,

          due_date:
            form.due_date,

          paid_date:
            form.paid_date ||
            null,

          payment_method:
            form.payment_method,

          status:
            form.status,

          transaction_id:
            form.transaction_id,
        };


        const url =
          editingPayment
            ? `${API_URL}/payments/${editingPayment.id}/`
            : `${API_URL}/payments/`;


        const response =
          await authenticatedFetch(
            url,
            {
              method:
                editingPayment
                  ? "PATCH"
                  : "POST",

              body:
                JSON.stringify(
                  payload
                ),
            }
          );


        if (!response) {
          return;
        }


        if (
          response.status ===
          401
        ) {
          logout();
          return;
        }


        const data =
          await response.json();


        if (
          !response.ok
        ) {

          const message =
            data.detail ||
            Object.values(
              data
            ).flat()[0] ||
            "Unable to save payment.";

          throw new Error(
            message
          );
        }


        closeForm();

        await loadData();

      } catch (
        err
      ) {

        console.error(
          err
        );

        setError(
          err.message ||
            "Unable to save payment."
        );

      } finally {

        setSaving(
          false
        );
      }
    };


  const deletePayment =
    async () => {

      if (
        !deletingPayment
      ) {
        return;
      }


      setSaving(
        true
      );

      setError("");


      try {

        const response =
          await authenticatedFetch(
            `${API_URL}/payments/${deletingPayment.id}/`,
            {
              method:
                "DELETE",
            }
          );


        if (!response) {
          return;
        }


        if (
          response.status ===
          401
        ) {
          logout();
          return;
        }


        if (
          !response.ok
        ) {

          let message =
            "Unable to delete payment.";

          try {

            const data =
              await response.json();

            message =
              data.detail ||
              message;

          } catch {
          }

          throw new Error(
            message
          );
        }


        setDeletingPayment(
          null
        );

        await loadData();

      } catch (
        err
      ) {

        setError(
          err.message ||
            "Unable to delete payment."
        );

      } finally {

        setSaving(
          false
        );
      }
    };


  const getStatusClass =
    (
      status
    ) => {

      switch (
        status
      ) {

        case "paid":
          return "paid";

        case "overdue":
          return "overdue";

        case "failed":
          return "failed";

        default:
          return "pending";
      }
    };


  const getStatusLabel =
    (
      status
    ) => {

      switch (
        status
      ) {

        case "paid":
          return "Paid";

        case "overdue":
          return "Overdue";

        case "failed":
          return "Failed";

        default:
          return "Pending";
      }
    };


  if (loading) {

    return (
      <div className="payments-loading">

        <div className="payments-spinner"></div>

        <p>
          Loading payments...
        </p>

      </div>
    );
  }


  return (
    <LandlordLayout
      breadcrumb="Rent & Payments"
      title="Rent & Payments"
      subtitle="Track rent collections, pending dues, invoices and payment history."
      actions={
        <div className="payments-header-actions-group">
          <button
            type="button"
            className="payments-generate-invoices-button"
            onClick={() => {
              setShowBatchModal(true);
              setBatchResult(null);
            }}
          >
            <MailIcon size={16} />
            <span>Generate Monthly Invoices</span>
          </button>
          <button
            className="payments-primary-button"
            onClick={openCreate}
          >
            <PlusIcon size={16} />
            <span>Record Payment</span>
          </button>
        </div>
      }
    >


      {notice && (
        <div className={`payments-notice-banner ${notice.type}`}>
          <span>{notice.message}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
          >
            ×
          </button>
        </div>
      )}

      {error && (
        <div className="payments-error">

          <span>
            {error}
          </span>

          <button
            onClick={() =>
              setError("")
            }
          >
            ×
          </button>

        </div>
      )}


      <section className="payments-summary">

        <div className="payments-summary-card">

          <span>
            TOTAL RECORDED
          </span>

          <strong>
            ₹
            {formatMoney(
              totals.total
            )}
          </strong>

        </div>


        <div className="payments-summary-card">

          <span>
            COLLECTED
          </span>

          <strong>
            ₹
            {formatMoney(
              totals.paid
            )}
          </strong>

        </div>


        <div className="payments-summary-card">

          <span>
            PENDING
          </span>

          <strong>
            ₹
            {formatMoney(
              totals.pending
            )}
          </strong>

        </div>


        <div className="payments-summary-card">

          <span>
            OVERDUE
          </span>

          <strong>
            ₹
            {formatMoney(
              totals.overdue
            )}
          </strong>

        </div>

      </section>


      {payments.length ===
      0 ? (

        <section className="payments-empty">

          <div className="payments-empty-icon">
            ₹
          </div>

          <h2>
            No payments yet
          </h2>

          <p>
            Record your first rent payment
            to start tracking collections.
          </p>

          <button
            className="payments-primary-button"
            onClick={
              openCreate
            }
          >
            + Record First Payment
          </button>

        </section>

      ) : (

        <section className="payments-table-wrapper">

          <div className="payments-table-scroll">

            <table className="payments-table">

              <thead>

                <tr>

                  <th>
                    TENANT
                  </th>

                  <th>
                    UNIT
                  </th>

                  <th>
                    TYPE
                  </th>

                  <th>
                    AMOUNT
                  </th>

                  <th>
                    DUE DATE
                  </th>

                  <th>
                    PAID DATE
                  </th>

                  <th>
                    METHOD
                  </th>

                  <th>
                    STATUS
                  </th>

                  <th>
                    EMAIL DELIVERY
                  </th>

                  <th>
                    ACTIONS
                  </th>

                </tr>

              </thead>


              <tbody>

                {payments.map(
                  (
                    payment
                  ) => (

                    <tr
                      key={
                        payment.id
                      }
                    >

                      <td>

                        <div className="payment-tenant">

                          <strong>
                            {
                              payment.tenant_name
                            }
                          </strong>

                          <span>
                            {
                              payment.tenant_email ||
                              payment.tenant_phone ||
                              ""
                            }
                          </span>

                        </div>

                      </td>


                      <td>

                        <div className="payment-unit">

                          <strong>
                            {
                              payment.unit_number
                            }
                          </strong>

                          <span>
                            {
                              payment.building_name
                            }
                          </span>

                        </div>

                      </td>


                      <td>
                        {
                          payment.payment_type_display ||
                          payment.payment_type
                        }
                      </td>


                      <td>
                        <div className="payment-amount-cell">
                          <strong className="payment-amount-val">
                            ₹{formatMoney(payment.amount)}
                          </strong>
                          {Number(payment.tenant_gst_rate || 0) > 0 ? (
                            <div
                              className="payment-gst-tag taxable"
                              title={`Base Rent: ₹${formatMoney(payment.amount)} | GST ${payment.tenant_gst_rate}% (CGST ${(Number(payment.tenant_gst_rate) / 2)}% + SGST ${(Number(payment.tenant_gst_rate) / 2)}%) | Total Payable: ₹${formatMoney(Number(payment.amount || 0) * (1 + Number(payment.tenant_gst_rate) / 100))}`}
                            >
                              +{Number(payment.tenant_gst_rate)}% GST
                              <span className="payment-gst-total">
                                (₹{formatMoney(Number(payment.amount || 0) * (1 + Number(payment.tenant_gst_rate) / 100))})
                              </span>
                            </div>
                          ) : (
                            <span className="payment-gst-tag exempt">
                              0% GST (Exempt)
                            </span>
                          )}
                        </div>
                      </td>


                      <td>
                        {
                          formatDate(
                            payment.due_date
                          )
                        }
                      </td>


                      <td>
                        {
                          formatDate(
                            payment.paid_date
                          )
                        }
                      </td>


                      <td>
                        {
                          payment.payment_method_display ||
                          payment.payment_method ||
                          "-"
                        }
                      </td>


                      <td>

                        <span
                          className={`payment-status ${getStatusClass(
                            payment.status
                          )}`}
                        >
                          {
                            getStatusLabel(
                              payment.status
                            )
                          }
                        </span>

                      </td>

                      <td>
                        <div className="payment-delivery-col">
                          {payment.payment_type === "rent" ? (
                            <>
                              <div className="delivery-badge-row">
                                <span className="delivery-type-label">Inv:</span>
                                {payment.latest_invoice_email?.status === "sent" ? (
                                  <span
                                    className="email-status-badge sent"
                                    title={`Sent to ${payment.latest_invoice_email.recipient_email} on ${new Date(payment.latest_invoice_email.sent_at || payment.latest_invoice_email.created_at).toLocaleString()}`}
                                  >
                                    ✓ Sent
                                  </span>
                                ) : payment.latest_invoice_email?.status === "failed" ? (
                                  <span
                                    className="email-status-badge failed"
                                    title={`Failed: ${payment.latest_invoice_email.error_message || "Unknown error"}`}
                                  >
                                    ⚠ Failed
                                  </span>
                                ) : payment.latest_invoice_email?.status === "pending" ? (
                                  <span className="email-status-badge pending">
                                    Sending...
                                  </span>
                                ) : (
                                  <span className="email-status-badge not-sent">
                                    Not Sent
                                  </span>
                                )}

                                {payment.latest_invoice_email?.status === "failed" && (
                                  <button
                                    type="button"
                                    className="delivery-inline-retry-btn"
                                    onClick={() => handleRetryEmail(payment.id, "invoice")}
                                    disabled={actionLoading[payment.id]}
                                    title="Retry sending invoice email"
                                  >
                                    {actionLoading[payment.id] ? "..." : "Retry"}
                                  </button>
                                )}
                              </div>

                              {payment.status === "paid" && (
                                <div className="delivery-badge-row">
                                  <span className="delivery-type-label">Rec:</span>
                                  {payment.latest_receipt_email?.status === "sent" ? (
                                    <span
                                      className="email-status-badge sent"
                                      title={`Sent to ${payment.latest_receipt_email.recipient_email} on ${new Date(payment.latest_receipt_email.sent_at || payment.latest_receipt_email.created_at).toLocaleString()}`}
                                    >
                                      ✓ Sent
                                    </span>
                                  ) : payment.latest_receipt_email?.status === "failed" ? (
                                    <span
                                      className="email-status-badge failed"
                                      title={`Failed: ${payment.latest_receipt_email.error_message || "Unknown error"}`}
                                    >
                                      ⚠ Failed
                                    </span>
                                  ) : payment.latest_receipt_email?.status === "pending" ? (
                                    <span className="email-status-badge pending">
                                      Sending...
                                    </span>
                                  ) : (
                                    <span className="email-status-badge not-sent">
                                      Not Sent
                                    </span>
                                  )}

                                  {payment.latest_receipt_email?.status === "failed" && (
                                    <button
                                      type="button"
                                      className="delivery-inline-retry-btn"
                                      onClick={() => handleRetryEmail(payment.id, "receipt")}
                                      disabled={actionLoading[payment.id]}
                                      title="Retry sending receipt email"
                                    >
                                      {actionLoading[payment.id] ? "..." : "Retry"}
                                    </button>
                                  )}
                                </div>
                              )}
                            </>
                          ) : (
                            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>-</span>
                          )}
                        </div>
                      </td>

                      <td>

                        <div className="payment-actions">
                          {payment.payment_type === "rent" &&
                            ["pending", "paid", "overdue"].includes(payment.status) && (
                              <>
                                <button
                                  type="button"
                                  className="payment-invoice-button"
                                  onClick={() =>
                                    navigate(`/landlord/invoices/${payment.id}`)
                                  }
                                >
                                  Invoice
                                </button>
                                <button
                                  type="button"
                                  className="payment-email-action-btn invoice"
                                  onClick={() => handleSendInvoice(payment.id)}
                                  disabled={actionLoading[payment.id]}
                                  title={payment.latest_invoice_email?.status === "sent" ? "Resend invoice email" : "Email invoice PDF to tenant"}
                                >
                                  {actionLoading[payment.id]
                                    ? "..."
                                    : payment.latest_invoice_email?.status === "sent"
                                    ? "Resend Inv"
                                    : "Email Inv"}
                                </button>
                              </>
                            )}

                          {payment.payment_type === "rent" &&
                            payment.status === "paid" && (
                              <>
                                <button
                                  type="button"
                                  className="payment-receipt-button"
                                  onClick={() =>
                                    navigate(`/landlord/receipts/${payment.id}`)
                                  }
                                >
                                  Receipt
                                </button>
                                <button
                                  type="button"
                                  className="payment-email-action-btn receipt"
                                  onClick={() => handleSendReceipt(payment.id)}
                                  disabled={actionLoading[payment.id]}
                                  title={payment.latest_receipt_email?.status === "sent" ? "Resend receipt email" : "Email receipt PDF to tenant"}
                                >
                                  {actionLoading[payment.id]
                                    ? "..."
                                    : payment.latest_receipt_email?.status === "sent"
                                    ? "Resend Rec"
                                    : "Email Rec"}
                                </button>
                              </>
                            )}

                          <button
                            className="payment-edit-button"
                            onClick={() =>
                              openEdit(
                                payment
                              )
                            }
                          >
                            Edit
                          </button>


                          <button
                            className="payment-delete-button"
                            onClick={() =>
                              setDeletingPayment(
                                payment
                              )
                            }
                          >
                            Delete
                          </button>

                        </div>

                      </td>

                    </tr>

                  )
                )}

              </tbody>

            </table>

          </div>

        </section>
      )}


      {/* CREATE / EDIT */}

      {showForm && (

        <div
          className="payments-modal-overlay"
          onClick={() => {

            if (!saving) {
              closeForm();
            }

          }}
        >

          <div
            className="payment-modal"
            onClick={(
              event
            ) =>
              event.stopPropagation()
            }
          >

            <div className="payment-modal-header">

              <div>

                <span>
                  {
                    editingPayment
                      ? "EDIT PAYMENT"
                      : "NEW PAYMENT"
                  }
                </span>

                <h2>
                  {
                    editingPayment
                      ? "Edit Payment"
                      : "Record Payment"
                  }
                </h2>

                <p>
                  Record rental income
                  against a lease.
                </p>

              </div>


              <button
                className="payment-modal-close"
                onClick={
                  closeForm
                }
                disabled={
                  saving
                }
              >
                ×
              </button>

            </div>


            <form
              className="payment-form"
              onSubmit={
                savePayment
              }
            >

              <div className="payment-field full">

                <label>
                  Lease
                </label>

                <select
                  name="lease"
                  value={
                    form.lease
                  }
                  onChange={
                    handleChange
                  }
                  disabled={
                    saving ||
                    Boolean(
                      editingPayment
                    )
                  }
                  required
                >

                  <option value="">
                    Select lease
                  </option>

                  {leases.map(
                    (
                      lease
                    ) => (

                      <option
                        key={
                          lease.id
                        }
                        value={
                          lease.id
                        }
                      >
                        {
                          lease.tenant_name
                        }
                        {" — "}
                        {
                          lease.unit_number
                        }
                        {" — "}
                        {
                          lease.building_name
                        }
                      </option>

                    )
                  )}

                </select>

              </div>


              <div className="payment-field">

                <label>
                  Payment Type
                </label>

                <select
                  name="payment_type"
                  value={
                    form.payment_type
                  }
                  onChange={
                    handleChange
                  }
                  disabled={
                    saving
                  }
                >

                  <option value="rent">
                    Monthly Rent
                  </option>

                  <option value="security_deposit">
                    Security Deposit
                  </option>

                  <option value="other">
                    Other
                  </option>

                </select>

              </div>


              <div className="payment-field">

                <label>
                  Amount (Base Rent in ₹)
                </label>

                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  name="amount"
                  value={
                    form.amount
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="18000"
                  disabled={
                    saving
                  }
                  required
                />

              </div>

              {form.lease && (
                <div className="payment-gst-calculator">
                  <div className="gst-calc-header">
                    <span className="gst-calc-title">GST Calculation</span>
                    <span className={`gst-calc-badge ${gstRate > 0 ? "taxable" : "exempt"}`}>
                      {gstRate > 0 ? `${gstRate}% GST Applicable` : "0% GST Exempt (Residential)"}
                    </span>
                  </div>
                  {gstRate > 0 ? (
                    <div className="gst-calc-table">
                      <div className="gst-calc-row">
                        <span>Base Rent:</span>
                        <span>₹{formatMoney(gstCalculations.base)}</span>
                      </div>
                      <div className="gst-calc-row">
                        <span>CGST ({gstRate / 2}%):</span>
                        <span>₹{formatMoney(gstCalculations.cgst)}</span>
                      </div>
                      <div className="gst-calc-row">
                        <span>SGST ({gstRate / 2}%):</span>
                        <span>₹{formatMoney(gstCalculations.sgst)}</span>
                      </div>
                      <div className="gst-calc-row gst-total-row">
                        <strong>Total Payable (with GST):</strong>
                        <strong>₹{formatMoney(gstCalculations.total)}</strong>
                      </div>
                    </div>
                  ) : (
                    <div className="gst-exempt-message">
                      Residential unit — exempt from GST (0%). Total Payable: <strong>₹{formatMoney(gstCalculations.base)}</strong>
                    </div>
                  )}
                </div>
              )}


              <div className="payment-field">

                <label>
                  Due Date
                </label>

                <input
                  type="date"
                  name="due_date"
                  value={
                    form.due_date
                  }
                  onChange={
                    handleChange
                  }
                  disabled={
                    saving
                  }
                  required
                />

              </div>


              <div className="payment-field">

                <label>
                  Status
                </label>

                <select
                  name="status"
                  value={
                    form.status
                  }
                  onChange={
                    handleChange
                  }
                  disabled={
                    saving
                  }
                >

                  <option value="pending">
                    Pending
                  </option>

                  <option value="paid">
                    Paid
                  </option>

                  <option value="overdue">
                    Overdue
                  </option>

                  <option value="failed">
                    Failed
                  </option>

                </select>

              </div>


              <div className="payment-field">

                <label>
                  Paid Date
                </label>

                <input
                  type="date"
                  name="paid_date"
                  value={
                    form.paid_date
                  }
                  onChange={
                    handleChange
                  }
                  disabled={
                    saving ||
                    form.status !==
                      "paid"
                  }
                />

              </div>


              <div className="payment-field">

                <label>
                  Payment Method
                </label>

                <select
                  name="payment_method"
                  value={
                    form.payment_method
                  }
                  onChange={
                    handleChange
                  }
                  disabled={
                    saving ||
                    form.status !==
                      "paid"
                  }
                >

                  <option value="">
                    Select method
                  </option>

                  <option value="online">
                    Online
                  </option>

                  <option value="cash">
                    Cash
                  </option>

                  <option value="bank_transfer">
                    Bank Transfer
                  </option>

                </select>

              </div>


              <div className="payment-field full">

                <label>
                  Transaction / Reference ID
                </label>

                <input
                  name="transaction_id"
                  value={
                    form.transaction_id
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="Optional reference"
                  disabled={
                    saving
                  }
                />

              </div>


              <div className="payment-form-actions full">

                <button
                  type="button"
                  className="payment-secondary-button"
                  onClick={
                    closeForm
                  }
                  disabled={
                    saving
                  }
                >
                  Cancel
                </button>


                <button
                  type="submit"
                  className="payments-primary-button"
                  disabled={
                    saving
                  }
                >
                  {saving
                    ? "Saving..."
                    : editingPayment
                    ? "Save Changes"
                    : "Record Payment"}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}


      {/* DELETE */}

      {deletingPayment && (

        <div
          className="payments-modal-overlay"
          onClick={() => {

            if (!saving) {
              setDeletingPayment(
                null
              );
            }

          }}
        >

          <div
            className="payment-delete-modal"
            onClick={(
              event
            ) =>
              event.stopPropagation()
            }
          >

            <div className="payment-delete-icon">
              ⚠️
            </div>

            <h2>
              Delete Payment?
            </h2>

            <p>
              This payment record will be
              permanently removed.
            </p>

            <div className="payment-delete-actions">

              <button
                className="payment-secondary-button"
                onClick={() =>
                  setDeletingPayment(
                    null
                  )
                }
                disabled={
                  saving
                }
              >
                Cancel
              </button>


              <button
                className="payment-delete-confirm"
                onClick={
                  deletePayment
                }
                disabled={
                  saving
                }
              >
                {
                  saving
                    ? "Deleting..."
                    : "Delete Payment"
                }
              </button>

            </div>

          </div>

        </div>
      )}

      {/* BATCH MONTHLY INVOICING MODAL */}
      {showBatchModal && (
        <div
          className="payments-modal-overlay"
          onClick={() => {
            if (!batchLoading) {
              setShowBatchModal(false);
              setBatchResult(null);
            }
          }}
        >
          <div
            className="payment-modal batch-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="payment-modal-header">
              <div>
                <span>AUTOMATED BILLING</span>
                <h2>Generate Monthly Invoices</h2>
                <p>
                  Automatically generate commercial rent invoices on the 1st of the month, attach PDFs, and email registered tenants.
                </p>
              </div>
              <button
                type="button"
                className="payment-modal-close"
                onClick={() => {
                  if (!batchLoading) {
                    setShowBatchModal(false);
                    setBatchResult(null);
                  }
                }}
              >
                ×
              </button>
            </div>

            <div className="batch-modal-body">
              <label className="batch-input-label">
                Billing Cycle Date (1st of Month):
                <input
                  type="date"
                  className="batch-date-input"
                  value={batchDate}
                  onChange={(e) => setBatchDate(e.target.value)}
                  disabled={batchLoading}
                />
              </label>

              <div className="batch-info-note">
                <strong>Automated Commercial Billing:</strong> Commercial invoices will be generated for all active commercial leases. Each tenant will receive their formal commercial tax invoice PDF via email with full GST breakdown, due date, and landlord payment instructions.
              </div>

              {batchResult && (
                <div className={`batch-result-card ${batchResult.error ? "error" : "success"}`}>
                  {batchResult.error ? (
                    <p>{batchResult.error}</p>
                  ) : (
                    <div>
                      <h4>Batch Invoicing Run Completed!</h4>
                      <div className="batch-result-stats">
                        <div className="stat-box">
                          <span className="stat-num">{batchResult.total_active_leases}</span>
                          <span className="stat-lbl">Active Leases</span>
                        </div>
                        <div className="stat-box">
                          <span className="stat-num">{batchResult.invoices_created}</span>
                          <span className="stat-lbl">Invoices Created</span>
                        </div>
                        <div className="stat-box">
                          <span className="stat-num">{batchResult.emails_sent}</span>
                          <span className="stat-lbl">Emails Sent</span>
                        </div>
                        {batchResult.emails_failed > 0 && (
                          <div className="stat-box failed">
                            <span className="stat-num">{batchResult.emails_failed}</span>
                            <span className="stat-lbl">Failed</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="payment-modal-actions batch-actions">
              <button
                type="button"
                className="payment-secondary-button"
                onClick={() => {
                  setShowBatchModal(false);
                  setBatchResult(null);
                }}
                disabled={batchLoading}
              >
                Close
              </button>
              <button
                type="button"
                className="payments-primary-button"
                onClick={handleGenerateMonthlyInvoices}
                disabled={batchLoading}
              >
                {batchLoading ? "Generating & Sending..." : "Run Invoicing Batch"}
              </button>
            </div>
          </div>
        </div>
      )}


    </LandlordLayout>
  );
}


export default Payments;