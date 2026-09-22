import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  BellIcon as Bell,
  SendIcon as Send,
  WhatsAppIcon as MessageSquare,
  MailIcon as Mail,
  ClockIcon as Clock,
  WarningIcon as AlertTriangle,
  CheckIcon as CheckCircle2,
  CalendarIcon as Calendar,
  BuildingIcon as Building2,
  UserIcon as User,
  SearchIcon as Search,
  RefreshIcon as RefreshCw,
  CopyIcon as Copy,
  PlusIcon as Plus,
  CloseIcon as X,
  FileTextIcon as FileText,
  SmartphoneIcon as Smartphone,
  CheckIcon as Check,
  RefreshIcon as RotateCcw,
  SlidersIcon as Sliders,
  HistoryIcon as History,
  CheckIcon as ShieldCheck,
} from "../components/Icons";

import LandlordLayout from "../components/LandlordLayout";
import { API_URL } from "../api";
import "./Reminders.css";

export default function Reminders() {
  const navigate = useNavigate();
  const token = localStorage.getItem("access_token");

  // Primary Data State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payments, setPayments] = useState([]);
  const [leases, setLeases] = useState([]);
  const [leaseReminders, setLeaseReminders] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [emailLogs, setEmailLogs] = useState([]);

  // Active Tab
  const [activeTab, setActiveTab] = useState("rent"); // 'rent' | 'leases' | 'rules' | 'logs'

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // 'all' | 'overdue' | 'duesoon' | 'pending' | 'paid'
  const [buildingFilter, setBuildingFilter] = useState("all");
  const [unitTypeFilter, setUnitTypeFilter] = useState("all"); // 'all' | 'residential' | 'commercial'

  // Action states
  const [actionLoading, setActionLoading] = useState({});
  const [toast, setToast] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  // Quick Reminder Modal
  const [quickModalOpen, setQuickModalOpen] = useState(false);
  const [quickTargetPayment, setQuickTargetPayment] = useState(null);
  const [quickChannel, setQuickChannel] = useState("whatsapp"); // 'whatsapp' | 'email'
  const [quickCustomNote, setQuickCustomNote] = useState("");

  // Add Lease Reminder Schedule Modal
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleTargetLease, setScheduleTargetLease] = useState(null);
  const [scheduleDays, setScheduleDays] = useState("30");

  // Automation Rules State (saved in localStorage for persistence)
  const [rules, setRules] = useState(() => {
    try {
      const saved = localStorage.getItem("rentease_reminder_rules");
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return {
      preDue: { enabled: true, days: 3 },
      dueDate: { enabled: true, time: "09:00" },
      overdue: { enabled: true, days: 3 },
      leaseExpiry: { enabled: true, days: 30 },
      paymentReceipt: { enabled: true },
    };
  });

  // Template preview type in rules tab
  const [previewTemplateType, setPreviewTemplateType] = useState("rent_due");
  const [customTemplateText, setCustomTemplateText] = useState(
    "Hello {tenant_name},\n\nThis is a friendly reminder that rent of ₹{amount} for Unit {unit_name} at {building_name} is due on {due_date}.\n\nPlease make payment via UPI or bank transfer at your convenience.\n\nThank you,\n{landlord_name}"
  );

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4000);
  };

  const authenticatedFetch = useCallback(
    async (url, options = {}) => {
      const currentToken = localStorage.getItem("access_token");
      if (!currentToken) {
        navigate("/login", { replace: true });
        return null;
      }
      return fetch(url, {
        ...options,
        headers: {
          ...(options.headers || {}),
          Authorization: `Bearer ${currentToken}`,
          "Content-Type": "application/json",
        },
      });
    },
    [navigate]
  );

  // Fetch all module data
  const fetchData = useCallback(
    async (isSilent = false) => {
      if (!isSilent) setRefreshing(true);
      try {
        const results = await Promise.allSettled([
          authenticatedFetch(`${API_URL}/payments/`),
          authenticatedFetch(`${API_URL}/leases/`),
          authenticatedFetch(`${API_URL}/lease-reminders/`),
          authenticatedFetch(`${API_URL}/buildings/`),
          authenticatedFetch(`${API_URL}/billing-emails/`),
        ]);

        const [payRes, leaseRes, reminderRes, bldRes, logsRes] = results.map(
          (r) => (r.status === "fulfilled" ? r.value : null)
        );

        if (payRes && payRes.ok) {
          const data = await payRes.json();
          setPayments(Array.isArray(data) ? data : data.results || []);
        }
        if (leaseRes && leaseRes.ok) {
          const data = await leaseRes.json();
          setLeases(Array.isArray(data) ? data : data.results || []);
        }
        if (reminderRes && reminderRes.ok) {
          const data = await reminderRes.json();
          setLeaseReminders(Array.isArray(data) ? data : data.results || []);
        }
        if (bldRes && bldRes.ok) {
          const data = await bldRes.json();
          setBuildings(Array.isArray(data) ? data : data.results || []);
        }
        if (logsRes && logsRes.ok) {
          const data = await logsRes.json();
          setEmailLogs(Array.isArray(data) ? data : data.results || []);
        }
      } catch (err) {
        console.error("Failed to load reminders data:", err);
        showToast("Error loading reminders data. Please try again.", "error");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [authenticatedFetch]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Save rules to localStorage
  const handleToggleRule = (key) => {
    setRules((prev) => {
      const updated = {
        ...prev,
        [key]: { ...prev[key], enabled: !prev[key].enabled },
      };
      localStorage.setItem("rentease_reminder_rules", JSON.stringify(updated));
      return updated;
    });
    showToast("Automation settings updated.", "success");
  };

  // Helper date calculators
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const getDaysDiff = (dateStr) => {
    if (!dateStr) return 0;
    const parts = String(dateStr).split("-");
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const target = new Date(year, month, day);
      const diffTime = target - today;
      return Math.round(diffTime / (1000 * 60 * 60 * 24));
    }
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);
    const diffTime = target - today;
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  };

  // Calculate KPIs
  const kpis = useMemo(() => {
    let overdueCount = 0;
    let overdueAmount = 0;
    let dueSoonCount = 0;
    let dueSoonAmount = 0;

    payments.forEach((p) => {
      const isUnpaid = p.status === "pending" || p.status === "overdue";
      if (isUnpaid) {
        const days = getDaysDiff(p.due_date);
        const amount = Number(p.amount || 0);
        if (p.status === "overdue" || days < 0) {
          overdueCount += 1;
          overdueAmount += amount;
        } else if (days <= 7) {
          dueSoonCount += 1;
          dueSoonAmount += amount;
        }
      }
    });

    const expiringLeases = leases.filter((l) => {
      if (l.status !== "active" || !l.end_date) return false;
      const days = getDaysDiff(l.end_date);
      return days >= 0 && days <= 60;
    }).length;

    // Dispatched this month
    const thisMonth = new Date().getMonth();
    const thisYear = new Date().getFullYear();
    const sentThisMonth = emailLogs.filter((log) => {
      if (log.status !== "sent" || !log.created_at) return false;
      const logDate = new Date(log.created_at);
      return logDate.getMonth() === thisMonth && logDate.getFullYear() === thisYear;
    }).length;

    return {
      overdueCount,
      overdueAmount,
      dueSoonCount,
      dueSoonAmount,
      expiringLeases,
      sentThisMonth,
    };
  }, [payments, leases, emailLogs, today]);

  // Filtered Payments List
  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      // Status filter
      const days = getDaysDiff(p.due_date);
      const isOverdue = p.status === "overdue" || (p.status === "pending" && days < 0);
      const isDueSoon = p.status === "pending" && days >= 0 && days <= 7;
      const isPending = p.status === "pending" || p.status === "overdue";
      const isPaid = p.status === "paid";

      if (statusFilter === "overdue" && !isOverdue) return false;
      if (statusFilter === "duesoon" && !isDueSoon) return false;
      if (statusFilter === "pending" && !isPending) return false;
      if (statusFilter === "paid" && !isPaid) return false;

      // Building filter
      if (buildingFilter !== "all") {
        const bId = p.building_id || p.lease?.unit?.floor?.building?.id;
        if (String(bId) !== String(buildingFilter)) return false;
      }

      // Unit type filter
      if (unitTypeFilter !== "all") {
        const uType = p.unit_type || p.lease?.unit?.unit_type;
        if (uType !== unitTypeFilter) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const tenantName = (p.tenant_name || "").toLowerCase();
        const unitName = (p.unit_name || p.unit_number || "").toLowerCase();
        const bldName = (p.building_name || "").toLowerCase();
        const phone = (p.tenant_phone || "").toLowerCase();
        const idStr = String(p.id);
        return (
          tenantName.includes(q) ||
          unitName.includes(q) ||
          bldName.includes(q) ||
          phone.includes(q) ||
          idStr.includes(q)
        );
      }

      return true;
    });
  }, [payments, statusFilter, buildingFilter, unitTypeFilter, searchQuery, today]);

  // Filtered Leases List for Lease Expiring tab
  const filteredLeases = useMemo(() => {
    return leases
      .filter((l) => l.status === "active" && l.end_date)
      .map((l) => {
        const days = getDaysDiff(l.end_date);
        return { ...l, days_remaining: days };
      })
      .sort((a, b) => a.days_remaining - b.days_remaining);
  }, [leases, today]);

  // Format INR Money
  const formatMoney = (val) => {
    return Number(val || 0).toLocaleString("en-IN", {
      maximumFractionDigits: 2,
    });
  };

  // Generate WhatsApp Direct Link
  const getWhatsAppLink = (phone, text) => {
    if (!phone) return null;
    let cleanPhone = String(phone).replace(/\D/g, "");
    if (cleanPhone.length === 11 && cleanPhone.startsWith("0")) {
      cleanPhone = cleanPhone.slice(1);
    }
    const formattedPhone =
      cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    if (formattedPhone.length < 10) return null;
    return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(text)}`;
  };

  // Create Standard Reminder Text
  const buildRentReminderText = (payment) => {
    const tenantName = payment.tenant_name || "Valued Tenant";
    const unitName = payment.unit_name || `Unit ${payment.unit_number || ""}`;
    const bldName = payment.building_name || "RentEase Property";
    const amount = formatMoney(payment.amount);
    const dueDate = payment.due_date;
    const days = getDaysDiff(payment.due_date);

    if (days < 0) {
      return `Dear ${tenantName}, this is an urgent reminder that your rent of ₹${amount} for ${unitName} at ${bldName} was due on ${dueDate} (overdue by ${Math.abs(
        days
      )} days). Please settle the payment at your earliest convenience to avoid penalties. Thank you!`;
    }
    if (days === 0) {
      return `Dear ${tenantName}, this is a reminder that your rent of ₹${amount} for ${unitName} at ${bldName} is due TODAY (${dueDate}). Please complete the transfer at your convenience. Thank you!`;
    }
    return `Dear ${tenantName}, this is a friendly reminder that your upcoming rent of ₹${amount} for ${unitName} at ${bldName} is due on ${dueDate}. Thank you!`;
  };

  const buildLeaseRenewalText = (lease) => {
    const tenantName = lease.tenant_name || "Valued Tenant";
    const unitName = lease.unit_name || `Unit ${lease.unit?.unit_number || ""}`;
    const endDate = lease.end_date;
    const days = lease.days_remaining;

    return `Dear ${tenantName}, this is a notice regarding your lease agreement for ${unitName} which is scheduled to expire on ${endDate} (${days} days remaining). Please let us know if you wish to renew your lease. Thank you!`;
  };

  // Copy Reminder Message
  const handleCopyReminder = (payment) => {
    const text = buildRentReminderText(payment);
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(payment.id);
      showToast("Reminder message copied to clipboard!", "success");
      setTimeout(() => setCopiedId(null), 2500);
    });
  };

  // Send Email Reminder API Call
  const handleSendEmailReminder = async (payment, customNote = "") => {
    const actionKey = `email_${payment.id}`;
    setActionLoading((prev) => ({ ...prev, [actionKey]: true }));
    try {
      const res = await authenticatedFetch(
        `${API_URL}/payments/${payment.id}/send-reminder/`,
        {
          method: "POST",
          body: JSON.stringify({ custom_note: customNote }),
        }
      );
      if (!res) return;
      const data = await res.json();
      if (res.ok) {
        showToast(
          `Reminder email dispatched to ${payment.tenant_name || "tenant"}!`,
          "success"
        );
        fetchData(true);
      } else {
        showToast(data.detail || "Failed to send reminder email.", "error");
      }
    } catch (err) {
      console.error("Reminder email failed:", err);
      showToast("Network error while sending reminder email.", "error");
    } finally {
      setActionLoading((prev) => ({ ...prev, [actionKey]: false }));
      setQuickModalOpen(false);
    }
  };

  // Broadcast Overdue Reminders
  const handleBroadcastOverdue = async () => {
    if (
      !window.confirm(
        `Are you sure you want to send email reminders to all ${kpis.overdueCount} overdue tenants?`
      )
    ) {
      return;
    }

    setActionLoading((prev) => ({ ...prev, broadcast: true }));
    try {
      const res = await authenticatedFetch(
        `${API_URL}/payments/broadcast-reminders/`,
        {
          method: "POST",
          body: JSON.stringify({ only_overdue: true }),
        }
      );
      if (!res) return;
      const data = await res.json();
      if (res.ok) {
        showToast(
          `Broadcast complete! Sent: ${data.succeeded || 0}, Failed: ${
            data.failed || 0
          }`,
          "success"
        );
        fetchData(true);
      } else {
        showToast(data.detail || "Failed to broadcast reminders.", "error");
      }
    } catch (err) {
      console.error("Broadcast failed:", err);
      showToast("Network error while broadcasting reminders.", "error");
    } finally {
      setActionLoading((prev) => ({ ...prev, broadcast: false }));
    }
  };

  // Send Lease Renewal Notice API Call
  const handleSendLeaseRenewal = async (lease, customNote = "") => {
    const actionKey = `lease_${lease.id}`;
    setActionLoading((prev) => ({ ...prev, [actionKey]: true }));
    try {
      const res = await authenticatedFetch(
        `${API_URL}/leases/${lease.id}/send-renewal-notice/`,
        {
          method: "POST",
          body: JSON.stringify({ custom_note: customNote }),
        }
      );
      if (!res) return;
      const data = await res.json();
      if (res.ok) {
        showToast(
          `Lease renewal notice sent to ${lease.tenant_name || "tenant"}!`,
          "success"
        );
        fetchData(true);
      } else {
        showToast(data.detail || "Failed to send lease renewal notice.", "error");
      }
    } catch (err) {
      console.error("Renewal notice failed:", err);
      showToast("Network error sending renewal notice.", "error");
    } finally {
      setActionLoading((prev) => ({ ...prev, [actionKey]: false }));
    }
  };

  // Add Lease Reminder Schedule API Call
  const handleCreateLeaseReminder = async (e) => {
    e.preventDefault();
    if (!scheduleTargetLease || !scheduleDays) return;

    setActionLoading((prev) => ({ ...prev, createSchedule: true }));
    try {
      const res = await authenticatedFetch(`${API_URL}/lease-reminders/`, {
        method: "POST",
        body: JSON.stringify({
          lease: scheduleTargetLease.id,
          days_before: Number(scheduleDays),
          enabled: true,
        }),
      });
      if (!res) return;
      const data = await res.json();
      if (res.ok) {
        showToast(
          `Reminder set for ${scheduleDays} days before expiry!`,
          "success"
        );
        setScheduleModalOpen(false);
        fetchData(true);
      } else {
        showToast(
          data.days_before?.[0] || data.detail || "Failed to add reminder schedule.",
          "error"
        );
      }
    } catch (err) {
      console.error("Add reminder failed:", err);
      showToast("Network error adding reminder schedule.", "error");
    } finally {
      setActionLoading((prev) => ({ ...prev, createSchedule: false }));
    }
  };

  // Retry Failed Email Log API Call
  const handleRetryEmail = async (logId) => {
    const actionKey = `retry_${logId}`;
    setActionLoading((prev) => ({ ...prev, [actionKey]: true }));
    try {
      const res = await authenticatedFetch(
        `${API_URL}/billing-emails/${logId}/retry/`,
        {
          method: "POST",
        }
      );
      if (!res) return;
      const data = await res.json();
      if (res.ok) {
        showToast("Email retried successfully!", "success");
        fetchData(true);
      } else {
        showToast(data.detail || "Retry failed.", "error");
      }
    } catch (err) {
      console.error("Retry failed:", err);
      showToast("Network error during retry.", "error");
    } finally {
      setActionLoading((prev) => ({ ...prev, [actionKey]: false }));
    }
  };

  if (loading) {
    return (
      <LandlordLayout
        title="Automated Reminders"
        subtitle="Manage automated rent payment notices, overdue alerts, WhatsApp messaging, and lease renewal schedules."
        breadcrumb="RentEase / Landlord / Reminders"
      >
        <div className="reminders-loading-container">
          <div className="reminders-spinner"></div>
          <h3>Loading Reminders Dashboard...</h3>
          <p>Fetching rent schedules, lease expiries, and delivery records.</p>
        </div>
      </LandlordLayout>
    );
  }

  return (
    <LandlordLayout
      title="Automated Reminders"
      subtitle="Manage automated rent payment notices, overdue alerts, WhatsApp messaging, and lease renewal schedules."
      breadcrumb="RentEase / Landlord / Reminders"
      badgeCounts={{ reminders: kpis.overdueCount }}
    >
      <div className="reminders-page">
        {/* --- Top Header & Action Bar --- */}
        <div className="reminders-header-bar">
          <div className="reminders-title-group">
            <h1>
              <Bell size={24} className="text-primary" />
              Automated Reminders & Alerts
            </h1>
            <p>
              Deliver frictionless payment nudges and proactive lease renewal
              alerts via Email and WhatsApp.
            </p>
          </div>

          <div className="reminders-actions">
            <button
              className="btn-secondary-action"
              onClick={() => fetchData()}
              disabled={refreshing}
            >
              <RefreshCw size={15} className={refreshing ? "spin" : ""} />
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>

            {kpis.overdueCount > 0 && (
              <button
                className="btn-broadcast-danger"
                onClick={handleBroadcastOverdue}
                disabled={actionLoading.broadcast}
              >
                <AlertTriangle size={15} />
                {actionLoading.broadcast
                  ? "Broadcasting..."
                  : `Remind All Overdue (${kpis.overdueCount})`}
              </button>
            )}

            <button
              className="btn-primary-action"
              onClick={() => {
                setQuickTargetPayment(
                  payments.find((p) => p.status === "pending" || p.status === "overdue") || null
                );
                setQuickModalOpen(true);
              }}
            >
              <Send size={15} />
              Quick Reminder
            </button>
          </div>
        </div>

        {/* --- KPI Summary Cards --- */}
        <div className="reminders-stats-grid">
          <div className="stat-card stat-overdue">
            <div className="stat-info">
              <span className="stat-label">Overdue Rent Alerts</span>
              <span className="stat-value">{kpis.overdueCount}</span>
              <span className="stat-subtext">
                ₹{formatMoney(kpis.overdueAmount)} pending collection
              </span>
            </div>
            <div className="stat-icon-wrap">
              <AlertTriangle size={22} />
            </div>
          </div>

          <div className="stat-card stat-duesoon">
            <div className="stat-info">
              <span className="stat-label">Due Within 7 Days</span>
              <span className="stat-value">{kpis.dueSoonCount}</span>
              <span className="stat-subtext">
                ₹{formatMoney(kpis.dueSoonAmount)} upcoming rent
              </span>
            </div>
            <div className="stat-icon-wrap">
              <Clock size={22} />
            </div>
          </div>

          <div className="stat-card stat-leases">
            <div className="stat-info">
              <span className="stat-label">Expiring Leases (60d)</span>
              <span className="stat-value">{kpis.expiringLeases}</span>
              <span className="stat-subtext">Require renewal notice</span>
            </div>
            <div className="stat-icon-wrap">
              <Calendar size={22} />
            </div>
          </div>

          <div className="stat-card stat-sent">
            <div className="stat-info">
              <span className="stat-label">Sent This Month</span>
              <span className="stat-value">{kpis.sentThisMonth}</span>
              <span className="stat-subtext">Total notices delivered</span>
            </div>
            <div className="stat-icon-wrap">
              <CheckCircle2 size={22} />
            </div>
          </div>
        </div>

        {/* --- Main Tabs & Content Card --- */}
        <div className="reminders-tabs-card">
          {/* Navigation Bar */}
          <div className="reminders-tab-nav">
            <button
              className={`tab-nav-btn ${activeTab === "rent" ? "active" : ""}`}
              onClick={() => setActiveTab("rent")}
            >
              <Bell size={16} />
              Rent Payment Reminders
              {kpis.overdueCount > 0 && (
                <span className="tab-badge badge-danger">
                  {kpis.overdueCount} Overdue
                </span>
              )}
            </button>

            <button
              className={`tab-nav-btn ${activeTab === "leases" ? "active" : ""}`}
              onClick={() => setActiveTab("leases")}
            >
              <Calendar size={16} />
              Lease Expiry Schedules
              {kpis.expiringLeases > 0 && (
                <span className="tab-badge">{kpis.expiringLeases}</span>
              )}
            </button>

            <button
              className={`tab-nav-btn ${activeTab === "rules" ? "active" : ""}`}
              onClick={() => setActiveTab("rules")}
            >
              <Sliders size={16} />
              Automation Rules & Templates
            </button>

            <button
              className={`tab-nav-btn ${activeTab === "logs" ? "active" : ""}`}
              onClick={() => setActiveTab("logs")}
            >
              <History size={16} />
              Dispatch History & Logs
              <span className="tab-badge">{emailLogs.length}</span>
            </button>
          </div>

          {/* ================================================================
              TAB 1: RENT PAYMENT REMINDERS
              ================================================================ */}
          {activeTab === "rent" && (
            <div>
              {/* Filter Toolbar */}
              <div className="reminders-filter-toolbar">
                <div className="filter-left-group">
                  <div className="reminders-search-box">
                    <Search size={16} />
                    <input
                      type="text"
                      placeholder="Search tenant, unit, phone, building..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  <select
                    className="filter-select"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="all">All Payment Statuses</option>
                    <option value="overdue">Overdue Only ({kpis.overdueCount})</option>
                    <option value="duesoon">Due Soon (Next 7 Days)</option>
                    <option value="pending">All Pending</option>
                    <option value="paid">Paid</option>
                  </select>

                  <select
                    className="filter-select"
                    value={buildingFilter}
                    onChange={(e) => setBuildingFilter(e.target.value)}
                  >
                    <option value="all">All Properties</option>
                    {buildings.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>

                  <select
                    className="filter-select"
                    value={unitTypeFilter}
                    onChange={(e) => setUnitTypeFilter(e.target.value)}
                  >
                    <option value="all">All Unit Types</option>
                    <option value="residential">Residential</option>
                    <option value="commercial">Commercial</option>
                  </select>
                </div>

                <div className="filter-summary-text">
                  Showing {filteredPayments.length} of {payments.length} records
                </div>
              </div>

              {/* Data Table */}
              <div className="table-container">
                {filteredPayments.length === 0 ? (
                  <div className="empty-reminders-card">
                    <div className="empty-icon-circle">
                      <CheckCircle2 size={30} />
                    </div>
                    <h3>No pending reminders found</h3>
                    <p>
                      {statusFilter === "overdue"
                        ? "Great news! None of your tenants currently have overdue rent."
                        : "No payments match your active filter criteria."}
                    </p>
                  </div>
                ) : (
                  <table className="reminders-table">
                    <thead>
                      <tr>
                        <th>Tenant & Unit</th>
                        <th>Building / Property</th>
                        <th>Amount Due</th>
                        <th>Due Date & Status</th>
                        <th style={{ textAlign: "right" }}>Reminder Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPayments.map((payment) => {
                        const days = getDaysDiff(payment.due_date);
                        const isOverdue = payment.status === "overdue" || (payment.status === "pending" && days < 0);
                        const isDueToday = (payment.status === "pending" || payment.status === "overdue") && days === 0;
                        const isDueSoon = payment.status === "pending" && days > 0 && days <= 7;
                        const isPaid = payment.status === "paid";
                        const reminderText = buildRentReminderText(payment);
                        const waLink = getWhatsAppLink(payment.tenant_phone, reminderText);

                        return (
                          <tr key={payment.id}>
                            {/* Tenant Info */}
                            <td>
                              <div className="tenant-cell-group">
                                <div className="tenant-avatar-circle">
                                  {(payment.tenant_name || "T")[0].toUpperCase()}
                                </div>
                                <div className="tenant-details-col">
                                  <div className="tenant-primary-name">
                                    {payment.tenant_name || "Unnamed Tenant"}
                                    <span className="unit-tag-pill">
                                      {payment.unit_name || `Unit ${payment.unit_number || ""}`}
                                    </span>
                                  </div>
                                  <div className="tenant-contact-row">
                                    {payment.tenant_phone ? (
                                      <a
                                        href={`tel:${payment.tenant_phone}`}
                                        className="contact-link"
                                      >
                                        <Smartphone size={12} />
                                        {payment.tenant_phone}
                                      </a>
                                    ) : (
                                      <span>No phone</span>
                                    )}
                                    {payment.tenant_email && (
                                      <a
                                        href={`mailto:${payment.tenant_email}`}
                                        className="contact-link"
                                      >
                                        <Mail size={12} />
                                        {payment.tenant_email}
                                      </a>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Property */}
                            <td>
                              <div style={{ fontWeight: 600, color: "var(--text-main)" }}>
                                {payment.building_name || "N/A"}
                              </div>
                              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                                {payment.unit_type === "commercial"
                                  ? "Commercial"
                                  : "Residential"}{" "}
                                {payment.floor_number !== undefined
                                  ? `• Floor ${payment.floor_number}`
                                  : ""}
                              </div>
                            </td>

                            {/* Amount Due */}
                            <td>
                              <div
                                style={{
                                  fontSize: "15px",
                                  fontWeight: 800,
                                  color: "var(--text-main)",
                                }}
                              >
                                ₹{formatMoney(payment.amount)}
                              </div>
                              <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                                {payment.payment_type_display || "Rent"}
                              </div>
                            </td>

                            {/* Due Date & Status */}
                            <td>
                              <div style={{ fontSize: "13px", fontWeight: 600 }}>
                                {payment.due_date}
                              </div>
                              <div style={{ marginTop: "4px" }}>
                                {isPaid ? (
                                  <span className="badge-status badge-paid">
                                    <Check size={12} /> Paid
                                  </span>
                                ) : isOverdue ? (
                                  <span className="badge-status badge-overdue">
                                    <AlertTriangle size={12} /> Overdue by {Math.abs(days)}d
                                  </span>
                                ) : isDueToday ? (
                                  <span className="badge-status badge-duetoday">
                                    <Clock size={12} /> Due Today
                                  </span>
                                ) : isDueSoon ? (
                                  <span className="badge-status badge-duesoon">
                                    <Clock size={12} /> Due in {days}d
                                  </span>
                                ) : (
                                  <span className="badge-status badge-duesoon">
                                    Upcoming ({days}d)
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Actions */}
                            <td style={{ textAlign: "right" }}>
                              <div
                                className="row-actions-group"
                                style={{ justifyContent: "flex-end" }}
                              >
                                {/* WhatsApp Direct Button */}
                                {waLink ? (
                                  <a
                                    href={waLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn-action-whatsapp"
                                    title="Send WhatsApp reminder"
                                  >
                                    <MessageSquare size={13} />
                                    WhatsApp
                                  </a>
                                ) : (
                                  <button
                                    className="btn-action-whatsapp"
                                    disabled
                                    title="No phone number available"
                                    style={{ opacity: 0.5, cursor: "not-allowed" }}
                                  >
                                    <MessageSquare size={13} />
                                    WhatsApp
                                  </button>
                                )}

                                {/* Email Reminder Button */}
                                <button
                                  className="btn-action-email"
                                  onClick={() => handleSendEmailReminder(payment)}
                                  disabled={actionLoading[`email_${payment.id}`]}
                                  title="Send Email reminder"
                                >
                                  <Mail size={13} />
                                  {actionLoading[`email_${payment.id}`]
                                    ? "Sending..."
                                    : "Email"}
                                </button>

                                {/* Copy Message Button */}
                                <button
                                  className="btn-action-icon"
                                  onClick={() => handleCopyReminder(payment)}
                                  title="Copy formatted reminder text"
                                >
                                  {copiedId === payment.id ? (
                                    <Check size={14} style={{ color: "var(--success)" }} />
                                  ) : (
                                    <Copy size={14} />
                                  )}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* ================================================================
              TAB 2: LEASE EXPIRY & RENEWAL SCHEDULES
              ================================================================ */}
          {activeTab === "leases" && (
            <div>
              <div className="reminders-filter-toolbar">
                <div className="filter-left-group">
                  <div className="filter-summary-text">
                    Tracking {filteredLeases.length} active leases nearing expiration.
                  </div>
                </div>
              </div>

              <div className="table-container">
                {filteredLeases.length === 0 ? (
                  <div className="empty-reminders-card">
                    <div className="empty-icon-circle">
                      <CheckCircle2 size={30} />
                    </div>
                    <h3>No expiring leases</h3>
                    <p>All active leases have comfortable remaining durations.</p>
                  </div>
                ) : (
                  <table className="reminders-table">
                    <thead>
                      <tr>
                        <th>Tenant & Lease</th>
                        <th>Property & Unit</th>
                        <th>Expiry Date & Timeline</th>
                        <th>Configured Reminder Triggers</th>
                        <th style={{ textAlign: "right" }}>Renewal Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLeases.map((lease) => {
                        const days = lease.days_remaining;
                        const isCritical = days <= 15;
                        const isWarning = days <= 30;
                        const waLink = getWhatsAppLink(
                          lease.tenant_phone,
                          buildLeaseRenewalText(lease)
                        );

                        // Find reminders configured for this lease
                        const leaseRemindersList = leaseReminders.filter(
                          (r) => r.lease === lease.id
                        );

                        return (
                          <tr key={lease.id}>
                            <td>
                              <div className="tenant-cell-group">
                                <div
                                  className="tenant-avatar-circle"
                                  style={{ background: "linear-gradient(135deg, #8b5cf6, #6d28d9)" }}
                                >
                                  {(lease.tenant_name || "T")[0].toUpperCase()}
                                </div>
                                <div className="tenant-details-col">
                                  <div className="tenant-primary-name">
                                    {lease.tenant_name || "Tenant"}
                                  </div>
                                  <div className="tenant-contact-row">
                                    <span>Rent: ₹{formatMoney(lease.monthly_rent)}/mo</span>
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td>
                              <div style={{ fontWeight: 600, color: "var(--text-main)" }}>
                                {lease.building_name || "N/A"}
                              </div>
                              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                                {lease.unit_name || `Unit ${lease.unit?.unit_number || ""}`}
                              </div>
                            </td>

                            <td>
                              <div style={{ fontWeight: 600, fontSize: "13.5px" }}>
                                {lease.end_date}
                              </div>
                              <div style={{ marginTop: "4px" }}>
                                <span
                                  className={`badge-status ${
                                    isCritical
                                      ? "badge-overdue"
                                      : isWarning
                                      ? "badge-duetoday"
                                      : "badge-duesoon"
                                  }`}
                                >
                                  <Clock size={12} />
                                  {days <= 0 ? "Expired" : `Expires in ${days} days`}
                                </span>
                              </div>
                            </td>

                            <td>
                              <div className="lease-reminder-chips">
                                {leaseRemindersList.length > 0 ? (
                                  leaseRemindersList.map((r) => (
                                    <span
                                      key={r.id}
                                      className={`reminder-chip ${
                                        r.sent ? "chip-sent" : ""
                                      }`}
                                    >
                                      {r.sent ? <Check size={10} /> : <Clock size={10} />}
                                      {r.days_before}d before
                                    </span>
                                  ))
                                ) : (
                                  <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                                    Default 30d rule active
                                  </span>
                                )}

                                <button
                                  className="btn-action-icon"
                                  onClick={() => {
                                    setScheduleTargetLease(lease);
                                    setScheduleModalOpen(true);
                                  }}
                                  title="Add custom reminder offset"
                                  style={{ width: "26px", height: "26px" }}
                                >
                                  <Plus size={12} />
                                </button>
                              </div>
                            </td>

                            <td style={{ textAlign: "right" }}>
                              <div
                                className="row-actions-group"
                                style={{ justifyContent: "flex-end" }}
                              >
                                {waLink && (
                                  <a
                                    href={waLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn-action-whatsapp"
                                    title="Send WhatsApp renewal alert"
                                  >
                                    <MessageSquare size={13} />
                                    WhatsApp
                                  </a>
                                )}

                                <button
                                  className="btn-action-email"
                                  onClick={() => handleSendLeaseRenewal(lease)}
                                  disabled={actionLoading[`lease_${lease.id}`]}
                                  title="Send Lease Renewal Notice Email"
                                >
                                  <Mail size={13} />
                                  {actionLoading[`lease_${lease.id}`]
                                    ? "Sending..."
                                    : "Send Notice"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* ================================================================
              TAB 3: AUTOMATION RULES & SETTINGS
              ================================================================ */}
          {activeTab === "rules" && (
            <div className="rules-tab-content">
              {/* Rules Cards Grid */}
              <div className="rules-grid">
                {/* Rule 1: Pre-Due Reminder */}
                <div className="rule-card rule-blue">
                  <div className="rule-header">
                    <div className="rule-title-group">
                      <div className="rule-icon">
                        <Clock size={20} />
                      </div>
                      <div className="rule-title-text">
                        <h3>Upcoming Rent Notice</h3>
                        <p>3 days before due date</p>
                      </div>
                    </div>

                    <label className="switch-toggle">
                      <input
                        type="checkbox"
                        checked={rules.preDue.enabled}
                        onChange={() => handleToggleRule("preDue")}
                      />
                      <span className="slider-toggle"></span>
                    </label>
                  </div>

                  <div className="rule-details-box">
                    <div>
                      <strong>Action:</strong> Dispatches a gentle rent reminder email
                      with invoice breakdown and payment details.
                    </div>
                    <div className="rule-channel-pills">
                      <span className="channel-pill email">Email (Active)</span>
                      <span className="channel-pill whatsapp">WhatsApp (Direct)</span>
                    </div>
                  </div>
                </div>

                {/* Rule 2: Due Date Reminder */}
                <div className="rule-card rule-amber">
                  <div className="rule-header">
                    <div className="rule-title-group">
                      <div className="rule-icon">
                        <Bell size={20} />
                      </div>
                      <div className="rule-title-text">
                        <h3>Rent Due Today Alert</h3>
                        <p>Morning of the rent due date</p>
                      </div>
                    </div>

                    <label className="switch-toggle">
                      <input
                        type="checkbox"
                        checked={rules.dueDate.enabled}
                        onChange={() => handleToggleRule("dueDate")}
                      />
                      <span className="slider-toggle"></span>
                    </label>
                  </div>

                  <div className="rule-details-box">
                    <div>
                      <strong>Action:</strong> Notifies tenant that rent is due today
                      along with one-click UPI QR code.
                    </div>
                    <div className="rule-channel-pills">
                      <span className="channel-pill email">Email</span>
                      <span className="channel-pill whatsapp">WhatsApp</span>
                    </div>
                  </div>
                </div>

                {/* Rule 3: Overdue Notice */}
                <div className="rule-card rule-red">
                  <div className="rule-header">
                    <div className="rule-title-group">
                      <div className="rule-icon">
                        <AlertTriangle size={20} />
                      </div>
                      <div className="rule-title-text">
                        <h3>Overdue / Grace Period Notice</h3>
                        <p>3 days post-due date</p>
                      </div>
                    </div>

                    <label className="switch-toggle">
                      <input
                        type="checkbox"
                        checked={rules.overdue.enabled}
                        onChange={() => handleToggleRule("overdue")}
                      />
                      <span className="slider-toggle"></span>
                    </label>
                  </div>

                  <div className="rule-details-box">
                    <div>
                      <strong>Action:</strong> Sends urgent overdue notice if payment
                      remains pending past grace period.
                    </div>
                    <div className="rule-channel-pills">
                      <span className="channel-pill email">High Priority Email</span>
                      <span className="channel-pill whatsapp">Direct WhatsApp</span>
                    </div>
                  </div>
                </div>

                {/* Rule 4: Lease Renewal */}
                <div className="rule-card rule-purple">
                  <div className="rule-header">
                    <div className="rule-title-group">
                      <div className="rule-icon">
                        <Calendar size={20} />
                      </div>
                      <div className="rule-title-text">
                        <h3>Lease Expiry Notification</h3>
                        <p>30 & 60 days before expiration</p>
                      </div>
                    </div>

                    <label className="switch-toggle">
                      <input
                        type="checkbox"
                        checked={rules.leaseExpiry.enabled}
                        onChange={() => handleToggleRule("leaseExpiry")}
                      />
                      <span className="slider-toggle"></span>
                    </label>
                  </div>

                  <div className="rule-details-box">
                    <div>
                      <strong>Action:</strong> Informs tenants of upcoming lease
                      termination and invites lease renewal terms.
                    </div>
                    <div className="rule-channel-pills">
                      <span className="channel-pill email">Email</span>
                      <span className="channel-pill whatsapp">WhatsApp</span>
                    </div>
                  </div>
                </div>

                {/* Rule 5: Payment Receipt */}
                <div className="rule-card rule-green">
                  <div className="rule-header">
                    <div className="rule-title-group">
                      <div className="rule-icon">
                        <ShieldCheck size={20} />
                      </div>
                      <div className="rule-title-text">
                        <h3>Instant Payment Receipt</h3>
                        <p>Upon payment marked as paid</p>
                      </div>
                    </div>

                    <label className="switch-toggle">
                      <input
                        type="checkbox"
                        checked={rules.paymentReceipt.enabled}
                        onChange={() => handleToggleRule("paymentReceipt")}
                      />
                      <span className="slider-toggle"></span>
                    </label>
                  </div>

                  <div className="rule-details-box">
                    <div>
                      <strong>Action:</strong> Automatically generates and emails official
                      GST payment receipt PDF to tenant.
                    </div>
                    <div className="rule-channel-pills">
                      <span className="channel-pill email">Instant Email Receipt</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Template Customizer & Live Phone Mockup */}
              <div className="template-preview-card">
                <div className="template-editor-col">
                  <h4>
                    <FileText size={16} />
                    Customize WhatsApp & SMS Template
                  </h4>
                  <div style={{ marginBottom: "12px", display: "flex", gap: "8px" }}>
                    <button
                      className={`btn-secondary-action ${
                        previewTemplateType === "rent_due" ? "active" : ""
                      }`}
                      onClick={() => {
                        setPreviewTemplateType("rent_due");
                        setCustomTemplateText(
                          "Hello {tenant_name},\n\nThis is a friendly reminder that rent of ₹{amount} for Unit {unit_name} at {building_name} is due on {due_date}.\n\nPlease make payment via UPI or bank transfer at your convenience.\n\nThank you,\n{landlord_name}"
                        );
                      }}
                    >
                      Rent Due
                    </button>
                    <button
                      className={`btn-secondary-action ${
                        previewTemplateType === "overdue" ? "active" : ""
                      }`}
                      onClick={() => {
                        setPreviewTemplateType("overdue");
                        setCustomTemplateText(
                          "Urgent Notice: Dear {tenant_name}, your rent payment of ₹{amount} for Unit {unit_name} was due on {due_date} and is now {days_overdue} days overdue.\n\nPlease clear the balance immediately to avoid disruption.\n\nUPI: {upi_id}\nThank you, {landlord_name}"
                        );
                      }}
                    >
                      Overdue Notice
                    </button>
                    <button
                      className={`btn-secondary-action ${
                        previewTemplateType === "renewal" ? "active" : ""
                      }`}
                      onClick={() => {
                        setPreviewTemplateType("renewal");
                        setCustomTemplateText(
                          "Dear {tenant_name}, your lease for Unit {unit_name} is scheduled to end on {end_date}.\n\nIf you would like to renew your tenancy, please contact us soon.\n\nBest regards,\n{landlord_name}"
                        );
                      }}
                    >
                      Lease Renewal
                    </button>
                  </div>

                  <textarea
                    className="template-textarea"
                    value={customTemplateText}
                    onChange={(e) => setCustomTemplateText(e.target.value)}
                  />

                  <div className="template-tags-row">
                    <span className="template-tag-chip">{"{tenant_name}"}</span>
                    <span className="template-tag-chip">{"{unit_name}"}</span>
                    <span className="template-tag-chip">{"{building_name}"}</span>
                    <span className="template-tag-chip">{"{amount}"}</span>
                    <span className="template-tag-chip">{"{due_date}"}</span>
                    <span className="template-tag-chip">{"{upi_id}"}</span>
                  </div>
                </div>

                <div className="template-mockup-col">
                  <h4>
                    <Smartphone size={16} />
                    Live WhatsApp Preview
                  </h4>
                  <div className="phone-mockup-frame">
                    <div className="phone-mockup-header">
                      <div className="mockup-avatar">R</div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "13px" }}>
                          RentEase Property Manager
                        </div>
                        <div style={{ fontSize: "11px", color: "#16a34a" }}>
                          Official Notification
                        </div>
                      </div>
                    </div>

                    <div className="phone-chat-bubble">
                      {customTemplateText
                        .replace("{tenant_name}", "John Doe")
                        .replace("{unit_name}", "Unit 204")
                        .replace("{building_name}", "Green Valley")
                        .replace("{amount}", "18,000")
                        .replace("{due_date}", "05 Oct 2026")
                        .replace("{days_overdue}", "4")
                        .replace("{end_date}", "31 Dec 2026")
                        .replace("{upi_id}", "landlord@okhdfcbank")
                        .replace("{landlord_name}", "Aadhithan B")}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================
              TAB 4: DISPATCH HISTORY & AUDIT LOGS
              ================================================================ */}
          {activeTab === "logs" && (
            <div>
              <div className="reminders-filter-toolbar">
                <div className="filter-left-group">
                  <div className="filter-summary-text">
                    Audit log of all automated billing emails and rent reminders dispatched.
                  </div>
                </div>
                <button
                  className="btn-secondary-action"
                  onClick={() => fetchData()}
                  disabled={refreshing}
                >
                  <RefreshCw size={13} className={refreshing ? "spin" : ""} />
                  Refresh Logs
                </button>
              </div>

              <div className="table-container">
                {emailLogs.length === 0 ? (
                  <div className="empty-reminders-card">
                    <div className="empty-icon-circle">
                      <History size={30} />
                    </div>
                    <h3>No communications sent yet</h3>
                    <p>
                      Dispatched payment reminders, commercial invoices, and receipts will
                      appear here with delivery status.
                    </p>
                  </div>
                ) : (
                  <table className="reminders-table">
                    <thead>
                      <tr>
                        <th>Date & Time</th>
                        <th>Type & Subject</th>
                        <th>Recipient</th>
                        <th>Status</th>
                        <th>Error Details</th>
                        <th style={{ textAlign: "right" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {emailLogs.map((log) => {
                        const isFailed = log.status === "failed";
                        const dateStr = log.created_at
                          ? new Date(log.created_at).toLocaleString()
                          : "N/A";

                        return (
                          <tr key={log.id}>
                            <td style={{ whiteSpace: "nowrap", fontSize: "12.5px" }}>
                              {dateStr}
                            </td>

                            <td>
                              <div style={{ fontWeight: 700, color: "var(--text-main)" }}>
                                {log.email_type_display || log.email_type}
                              </div>
                              <div
                                style={{
                                  fontSize: "12px",
                                  color: "var(--text-muted)",
                                  maxWidth: "300px",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {log.subject}
                              </div>
                            </td>

                            <td>
                              <span style={{ fontSize: "13px", fontWeight: 600 }}>
                                {log.recipient_email}
                              </span>
                            </td>

                            <td>
                              <span
                                className={`badge-status ${
                                  isFailed ? "badge-failed" : "badge-sent"
                                }`}
                              >
                                {isFailed ? (
                                  <AlertTriangle size={12} />
                                ) : (
                                  <Check size={12} />
                                )}
                                {log.status_display || log.status}
                              </span>
                            </td>

                            <td style={{ maxWidth: "260px" }}>
                              {log.error_message ? (
                                <span
                                  style={{
                                    fontSize: "12px",
                                    color: "var(--danger)",
                                    display: "block",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                  title={log.error_message}
                                >
                                  {log.error_message}
                                </span>
                              ) : (
                                <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                                  —
                                </span>
                              )}
                            </td>

                            <td style={{ textAlign: "right" }}>
                              {isFailed && (
                                <button
                                  className="btn-secondary-action"
                                  onClick={() => handleRetryEmail(log.id)}
                                  disabled={actionLoading[`retry_${log.id}`]}
                                  style={{ padding: "5px 10px", fontSize: "12px" }}
                                >
                                  <RotateCcw size={12} />
                                  {actionLoading[`retry_${log.id}`]
                                    ? "Retrying..."
                                    : "Retry"}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ================================================================
            QUICK REMINDER MODAL
            ================================================================ */}
        {quickModalOpen && (
          <div className="reminders-modal-backdrop" onClick={() => setQuickModalOpen(false)}>
            <div
              className="reminders-modal-card"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="reminders-modal-header">
                <h2>Send Quick Rent Reminder</h2>
                <button
                  className="btn-close-modal"
                  onClick={() => setQuickModalOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="reminders-modal-body">
                <div className="form-group-field">
                  <label>Select Pending Payment / Tenant</label>
                  {payments.filter((p) => p.status === "pending" || p.status === "overdue").length === 0 ? (
                    <p style={{ color: "var(--text-muted)", fontSize: "13px", padding: "8px 0", margin: 0 }}>
                      No pending or overdue payments found. All tenants are up to date!
                    </p>
                  ) : (
                    <select
                      value={quickTargetPayment?.id || ""}
                      onChange={(e) => {
                        const found = payments.find(
                          (p) => String(p.id) === e.target.value
                        );
                        setQuickTargetPayment(found || null);
                      }}
                    >
                      {payments
                        .filter((p) => p.status === "pending" || p.status === "overdue")
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.tenant_name || "Tenant"} —{" "}
                            {p.unit_name || `Unit ${p.unit_number}`} (₹
                            {formatMoney(p.amount)} due {p.due_date})
                          </option>
                        ))}
                    </select>
                  )}
                </div>

                <div className="form-group-field">
                  <label>Reminder Channel</label>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button
                      type="button"
                      className={`btn-secondary-action ${
                        quickChannel === "whatsapp" ? "active" : ""
                      }`}
                      style={{ flex: 1, justifyContent: "center" }}
                      onClick={() => setQuickChannel("whatsapp")}
                    >
                      <MessageSquare size={16} style={{ color: "#25D366" }} />
                      WhatsApp (Instant)
                    </button>
                    <button
                      type="button"
                      className={`btn-secondary-action ${
                        quickChannel === "email" ? "active" : ""
                      }`}
                      style={{ flex: 1, justifyContent: "center" }}
                      onClick={() => setQuickChannel("email")}
                    >
                      <Mail size={16} style={{ color: "var(--primary)" }} />
                      Email (Branded)
                    </button>
                  </div>
                </div>

                <div className="form-group-field">
                  <label>Custom Note (Optional)</label>
                  <textarea
                    rows="3"
                    placeholder="e.g. Please clear this before Friday to avoid late penalty."
                    value={quickCustomNote}
                    onChange={(e) => setQuickCustomNote(e.target.value)}
                  />
                </div>

                {quickTargetPayment && (
                  <div
                    style={{
                      background: "var(--bg-page)",
                      padding: "12px",
                      borderRadius: "var(--radius-md)",
                      fontSize: "12.5px",
                    }}
                  >
                    <strong>Message Preview:</strong>
                    <div style={{ marginTop: "6px", color: "var(--text-secondary)", whiteSpace: "pre-wrap" }}>
                      {buildRentReminderText(quickTargetPayment)}
                      {quickCustomNote ? `\n\nNote: ${quickCustomNote}` : ""}
                    </div>
                  </div>
                )}
              </div>

              <div className="reminders-modal-footer">
                <button
                  type="button"
                  className="btn-secondary-action"
                  onClick={() => setQuickModalOpen(false)}
                >
                  Cancel
                </button>

                {quickChannel === "whatsapp" ? (
                  <a
                    href={
                      quickTargetPayment
                        ? getWhatsAppLink(
                            quickTargetPayment.tenant_phone,
                            `${buildRentReminderText(quickTargetPayment)}${
                              quickCustomNote ? `\n\nNote: ${quickCustomNote}` : ""
                            }`
                          ) || "#"
                        : "#"
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-action-whatsapp"
                    style={{ padding: "9px 18px", fontSize: "13px" }}
                    onClick={() => setQuickModalOpen(false)}
                  >
                    <MessageSquare size={16} />
                    Open in WhatsApp
                  </a>
                ) : (
                  <button
                    type="button"
                    className="btn-primary-action"
                    disabled={!quickTargetPayment || actionLoading[`email_${quickTargetPayment?.id}`]}
                    onClick={() =>
                      quickTargetPayment &&
                      handleSendEmailReminder(quickTargetPayment, quickCustomNote)
                    }
                  >
                    <Mail size={16} />
                    {actionLoading[`email_${quickTargetPayment?.id}`]
                      ? "Sending..."
                      : "Send Email Reminder"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================================================================
            ADD LEASE REMINDER SCHEDULE MODAL
            ================================================================ */}
        {scheduleModalOpen && scheduleTargetLease && (
          <div
            className="reminders-modal-backdrop"
            onClick={() => setScheduleModalOpen(false)}
          >
            <div
              className="reminders-modal-card"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="reminders-modal-header">
                <h2>Add Expiry Reminder Schedule</h2>
                <button
                  className="btn-close-modal"
                  onClick={() => setScheduleModalOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateLeaseReminder}>
                <div className="reminders-modal-body">
                  <div className="form-group-field">
                    <label>Lease</label>
                    <input
                      type="text"
                      disabled
                      value={`${scheduleTargetLease.tenant_name || "Tenant"} — ${
                        scheduleTargetLease.unit_name || "Unit"
                      } (Ends ${scheduleTargetLease.end_date})`}
                    />
                  </div>

                  <div className="form-group-field">
                    <label>Days Before Expiry</label>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={scheduleDays}
                      onChange={(e) => setScheduleDays(e.target.value)}
                      placeholder="e.g. 45"
                      required
                    />
                    <small style={{ color: "var(--text-muted)", fontSize: "11.5px" }}>
                      We will notify you and the tenant when the lease is this many days
                      away from expiration.
                    </small>
                  </div>
                </div>

                <div className="reminders-modal-footer">
                  <button
                    type="button"
                    className="btn-secondary-action"
                    onClick={() => setScheduleModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary-action"
                    disabled={actionLoading.createSchedule}
                  >
                    <Plus size={15} />
                    {actionLoading.createSchedule
                      ? "Saving..."
                      : "Add Reminder Schedule"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Toast Alert */}
        {toast && (
          <div className={`reminders-toast toast-${toast.type}`}>
            {toast.type === "success" ? (
              <CheckCircle2 size={18} />
            ) : (
              <AlertTriangle size={18} />
            )}
            {toast.message}
          </div>
        )}
      </div>
    </LandlordLayout>
  );
}
