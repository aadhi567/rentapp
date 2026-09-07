import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import LandlordLayout from "../components/LandlordLayout";
import {
  TenantIcon,
  BuildingIcon,
  LayersIcon,
  SearchIcon,
  PhoneIcon,
  MailIcon,
  RupeeIcon,
  CheckIcon,
  WarningIcon,
  CloseIcon,
  CalendarIcon,
  EyeIcon,
  PlusIcon,
  FileTextIcon,
} from "../components/Icons";
import "./Tenants.css";

const API_URL = "http://127.0.0.1:8000/api";

const EMPTY_PAYMENT_FORM = {
  amount: "",
  due_date: "",
  paid_date: "",
  payment_method: "online",
  transaction_id: "",
};

function Tenants() {
  const navigate = useNavigate();

  const [tenants, setTenants] = useState([]);
  const [leases, setLeases] = useState([]);
  const [payments, setPayments] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Filters & View Mode
  const [searchQuery, setSearchQuery] = useState("");
  const [filterBuilding, setFilterBuilding] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [viewMode, setViewMode] = useState("cards"); // "cards" | "table"

  // Modals
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentForm, setPaymentForm] = useState(EMPTY_PAYMENT_FORM);

  const token = localStorage.getItem("access_token");

  const logout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  };

  const authenticatedFetch = async (url, options = {}) => {
    if (!token) {
      logout();
      return null;
    }
    const isFormData = options.body instanceof FormData;
    return fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
      },
    });
  };

  const readResponse = async (response) => {
    const text = await response.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      throw new Error("Server returned an invalid response.");
    }
  };

  const loadData = async () => {
    if (!token) {
      logout();
      return;
    }
    setLoading(true);
    setError("");

    try {
      const [tenantsResponse, leasesResponse, paymentsResponse] =
        await Promise.all([
          authenticatedFetch(`${API_URL}/tenants/`),
          authenticatedFetch(`${API_URL}/leases/`),
          authenticatedFetch(`${API_URL}/payments/`),
        ]);

      if (
        tenantsResponse?.status === 401 ||
        leasesResponse?.status === 401 ||
        paymentsResponse?.status === 401
      ) {
        logout();
        return;
      }

      const [tenantsData, leasesData, paymentsData] = await Promise.all([
        readResponse(tenantsResponse),
        readResponse(leasesResponse),
        readResponse(paymentsResponse),
      ]);

      if (!tenantsResponse.ok) {
        throw new Error(tenantsData.detail || "Unable to load tenants.");
      }
      if (!leasesResponse.ok) {
        throw new Error(leasesData.detail || "Unable to load leases.");
      }
      if (!paymentsResponse.ok) {
        throw new Error(paymentsData.detail || "Unable to load payments.");
      }

      setTenants(Array.isArray(tenantsData) ? tenantsData : tenantsData.results || []);
      setLeases(Array.isArray(leasesData) ? leasesData : leasesData.results || []);
      setPayments(Array.isArray(paymentsData) ? paymentsData : paymentsData.results || []);
    } catch (err) {
      setError(err.message || "Failed to load tenants directory.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getTenantLeases = (tenantId) => {
    return leases.filter(
      (lease) => Number(lease.tenant) === Number(tenantId)
    );
  };

  const getTenantPayments = (tenantId) => {
    const tenantLeaseIds = getTenantLeases(tenantId).map((lease) =>
      Number(lease.id)
    );
    return payments
      .filter((payment) => tenantLeaseIds.includes(Number(payment.lease)))
      .sort((a, b) => new Date(b.due_date || b.paid_date) - new Date(a.due_date || a.paid_date));
  };

  const formatDateForInput = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const formatMoney = (value) => {
    return Number(value || 0).toLocaleString("en-IN", {
      maximumFractionDigits: 2,
    });
  };

  const formatDate = (value) => {
    if (!value) return "-";
    const parts = String(value).split("-");
    if (parts.length !== 3) return value;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  // For any date in Month M, the rental period being paid for is Month M - 1 (the preceding calendar month: 1st to last day)
  const getBillingPeriodForDate = (dateOrString, leaseStart = null) => {
    if (!dateOrString) return null;
    const d = dateOrString instanceof Date ? dateOrString : new Date(`${dateOrString}T00:00:00`);
    if (isNaN(d.getTime())) return null;

    let year = d.getFullYear();
    let month = d.getMonth(); // 0-indexed month of payment/action (e.g. 8 for Sept)

    // Rent paid/due in month M is for month M - 1 (e.g. August)
    let billingMonth = month - 1;
    let billingYear = year;
    if (billingMonth < 0) {
      billingMonth = 11;
      billingYear -= 1;
    }

    if (leaseStart) {
      const ls = leaseStart instanceof Date ? leaseStart : new Date(`${leaseStart}T00:00:00`);
      const lsYear = ls.getFullYear();
      const lsMonth = ls.getMonth();
      if (
        billingYear < lsYear ||
        (billingYear === lsYear && billingMonth < lsMonth)
      ) {
        billingYear = lsYear;
        billingMonth = lsMonth;
      }
    }

    const start = new Date(billingYear, billingMonth, 1, 0, 0, 0, 0);
    const end = new Date(billingYear, billingMonth + 1, 0, 23, 59, 59, 999);
    return { start, end };
  };

  const getCurrentBillingPeriod = (lease) => {
    if (!lease || !lease.start_date || !lease.end_date) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const leaseStart = new Date(`${lease.start_date}T00:00:00`);
    const leaseEnd = new Date(`${lease.end_date}T23:59:59`);

    if (today > leaseEnd) return null;

    // Use current month if today is within or after lease start;
    // otherwise use the lease start's month (for advance payments)
    const targetDate = today < leaseStart ? leaseStart : today;
    return getBillingPeriodForDate(targetDate, lease.start_date);
  };

  const formatPeriodRange = (startDate, endDate) => {
    if (!startDate || !endDate) return "-";
    const d1 = startDate instanceof Date ? startDate : new Date(startDate);
    const d2 = endDate instanceof Date ? endDate : new Date(endDate);
    const pad = (n) => String(n).padStart(2, "0");
    const formatted1 = `${pad(d1.getDate())}/${pad(d1.getMonth() + 1)}/${d1.getFullYear()}`;
    const formatted2 = `${pad(d2.getDate())}/${pad(d2.getMonth() + 1)}/${d2.getFullYear()}`;
    return `${formatted1} to ${formatted2}`;
  };

  const getCurrentRentStatus = (lease) => {
    if (!lease) {
      return {
        status: "pending",
        label: "PENDING",
        amount: 0,
        dueDate: null,
        paidDate: null,
        billingStart: null,
        billingEnd: null,
      };
    }

    const billingPeriod = getCurrentBillingPeriod(lease);
    if (!billingPeriod) {
      return {
        status: "pending",
        label: "PENDING",
        amount: Number(lease.monthly_rent || 0),
        dueDate: lease.end_date || null,
        paidDate: null,
        billingStart: null,
        billingEnd: null,
      };
    }

    const leasePayments = payments.filter(
      (p) =>
        Number(p.lease) === Number(lease.id) &&
        (!p.payment_type || p.payment_type === "rent")
    );

    const currentPayments = leasePayments.filter((p) => {
      const refDateStr = p.paid_date || p.due_date;
      if (!refDateStr) return false;
      const pPeriod = getBillingPeriodForDate(refDateStr, lease.start_date);
      if (
        pPeriod &&
        pPeriod.start.getFullYear() === billingPeriod.start.getFullYear() &&
        pPeriod.start.getMonth() === billingPeriod.start.getMonth()
      ) {
        return true;
      }
      // Also match if paid/due date falls within or adjacent to payment month
      const d = new Date(`${refDateStr}T00:00:00`);
      const refYear = d.getFullYear();
      const refMonth = d.getMonth();
      const bYear = billingPeriod.start.getFullYear();
      const bMonth = billingPeriod.start.getMonth();
      const nextMonth = bMonth === 11 ? 0 : bMonth + 1;
      const nextYear = bMonth === 11 ? bYear + 1 : bYear;
      return (refYear === nextYear && refMonth === nextMonth) || (refYear === bYear && refMonth === bMonth);
    });

    const paidPayment = currentPayments
      .filter((p) => p.status === "paid")
      .sort(
        (a, b) =>
          new Date(b.paid_date || b.due_date) -
          new Date(a.paid_date || a.due_date)
      )[0];

    if (paidPayment) {
      return {
        status: "paid",
        label: "PAID",
        amount: Number(paidPayment.amount || lease.monthly_rent || 0),
        dueDate: paidPayment.due_date || formatDateForInput(billingPeriod.start),
        paidDate: paidPayment.paid_date || null,
        billingStart: billingPeriod.start,
        billingEnd: billingPeriod.end,
      };
    }

    const pendingPayment = currentPayments
      .filter((p) => p.status !== "paid")
      .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))[0];

    return {
      status: "pending",
      label: "PENDING",
      amount: Number(pendingPayment?.amount || lease.monthly_rent || 0),
      dueDate: pendingPayment?.due_date || formatDateForInput(billingPeriod.start),
      paidDate: null,
      billingStart: billingPeriod.start,
      billingEnd: billingPeriod.end,
    };
  };

  const getCurrentPeriodLabel = (rentStatus) => {
    if (!rentStatus?.billingStart) return "Rent";
    return new Intl.DateTimeFormat("en-IN", {
      month: "short",
      year: "numeric",
    }).format(rentStatus.billingStart);
  };

  const getTenantCurrentRent = (tenant) => {
    const tenantLeases = getTenantLeases(tenant.id);
    const activeLease = tenantLeases.find((l) => l.status === "active");
    return {
      lease: activeLease,
      rentStatus: getCurrentRentStatus(activeLease),
    };
  };

  // Grouped by Building and Floor
  const groupedTenants = useMemo(() => {
    const buildingMap = new Map();
    const tenantsWithoutAgreement = [];

    tenants.forEach((tenant) => {
      const { lease, rentStatus } = getTenantCurrentRent(tenant);

      if (!lease) {
        tenantsWithoutAgreement.push({ tenant, lease: null, rentStatus });
        return;
      }

      const buildingId = Number(lease.building_id);
      const buildingName = lease.building_name || "Building";
      const floorNumber = lease.floor_number ?? "—";

      if (!buildingMap.has(buildingId)) {
        buildingMap.set(buildingId, {
          id: buildingId,
          name: buildingName,
          floors: new Map(),
        });
      }

      const building = buildingMap.get(buildingId);
      const floorKey = String(floorNumber);

      if (!building.floors.has(floorKey)) {
        building.floors.set(floorKey, {
          number: floorNumber,
          tenants: [],
        });
      }

      building.floors.get(floorKey).tenants.push({ tenant, lease, rentStatus });
    });

    const buildings = Array.from(buildingMap.values())
      .map((b) => {
        const floors = Array.from(b.floors.values())
          .sort((a, b) => Number(a.number) - Number(b.number))
          .map((f) => ({
            ...f,
            tenants: f.tenants.sort((a, b) =>
              String(a.lease?.unit_number || "").localeCompare(
                String(b.lease?.unit_number || "")
              )
            ),
          }));
        return { ...b, floors };
      })
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));

    return { buildings, tenantsWithoutAgreement };
  }, [tenants, leases, payments]);

  // Flattened & Filtered Tenants
  const filteredTenantsList = useMemo(() => {
    return tenants
      .map((tenant) => {
        const { lease, rentStatus } = getTenantCurrentRent(tenant);
        return { tenant, lease, rentStatus };
      })
      .filter(({ tenant, lease, rentStatus }) => {
        // Search filter
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase();
          const matchName = tenant.full_name?.toLowerCase().includes(query);
          const matchPhone = tenant.phone?.toLowerCase().includes(query);
          const matchEmail = tenant.email?.toLowerCase().includes(query);
          const matchUnit = lease?.unit_number?.toLowerCase().includes(query);
          const matchBuilding = lease?.building_name?.toLowerCase().includes(query);
          if (!matchName && !matchPhone && !matchEmail && !matchUnit && !matchBuilding) {
            return false;
          }
        }

        // Building filter
        if (filterBuilding !== "all") {
          if (!lease || String(lease.building_id) !== String(filterBuilding)) {
            return false;
          }
        }

        // Status filter
        if (filterStatus !== "all") {
          if (rentStatus.status !== filterStatus) {
            return false;
          }
        }

        return true;
      });
  }, [tenants, leases, payments, searchQuery, filterBuilding, filterStatus]);

  // Selected Tenant for Details modal
  const selectedLeases = useMemo(() => {
    if (!selectedTenant) return [];
    return getTenantLeases(selectedTenant.id);
  }, [selectedTenant, leases]);

  const selectedPayments = useMemo(() => {
    if (!selectedTenant) return [];
    return getTenantPayments(selectedTenant.id);
  }, [selectedTenant, leases, payments]);

  const activeLease = useMemo(() => {
    return selectedLeases.find((l) => l.status === "active");
  }, [selectedLeases]);

  const currentRentStatus = useMemo(() => {
    return getCurrentRentStatus(activeLease);
  }, [activeLease, payments]);

  // Counts for top cards
  const currentMonthPaidCount = useMemo(() => {
    return tenants.filter((tenant) => {
      const { lease, rentStatus } = getTenantCurrentRent(tenant);
      return lease && rentStatus.status === "paid";
    }).length;
  }, [tenants, leases, payments]);

  const currentMonthPendingCount = useMemo(() => {
    return tenants.filter((tenant) => {
      const { lease, rentStatus } = getTenantCurrentRent(tenant);
      return lease && rentStatus.status === "pending";
    }).length;
  }, [tenants, leases, payments]);

  // Modal handlers
  const openTenant = (tenant) => {
    setError("");
    setSelectedTenant(tenant);
    setShowDetails(true);
  };

  const closeDetails = () => {
    if (saving) return;
    setShowDetails(false);
    setShowPaymentForm(false);
    setSelectedTenant(null);
    setPaymentForm(EMPTY_PAYMENT_FORM);
    setError("");
  };

  const openPaymentForm = (tenantOverride, leaseOverride) => {
    const targetTenant = tenantOverride || selectedTenant;
    const targetLease = leaseOverride || activeLease;

    if (!targetLease) {
      setError("This tenant does not have an active rental or lease.");
      return;
    }

    const rentStatus = getCurrentRentStatus(targetLease);
    if (rentStatus.status === "paid") {
      setError("The current rental/lease period is already marked as paid.");
      return;
    }

    if (tenantOverride) {
      setSelectedTenant(tenantOverride);
    }

    const today = new Date();
    const todayString = formatDateForInput(today);
    const dueString = rentStatus.dueDate || todayString;

    setPaymentForm({
      amount: String(rentStatus.amount || targetLease.monthly_rent || ""),
      due_date: dueString,
      paid_date: todayString,
      payment_method: "online",
      transaction_id: "",
    });

    setShowPaymentForm(true);
    setError("");
  };

  const closePaymentForm = () => {
    if (saving) return;
    setShowPaymentForm(false);
    setPaymentForm(EMPTY_PAYMENT_FORM);
  };

  const handlePaymentChange = (event) => {
    const { name, value } = event.target;
    setPaymentForm((prev) => ({ ...prev, [name]: value }));
  };

  const savePayment = async (event) => {
    event.preventDefault();
    setError("");

    const targetLease = activeLease || selectedLeases[0];

    if (!targetLease) {
      setError("No active rental or lease was found.");
      return;
    }

    if (!paymentForm.amount || Number(paymentForm.amount) <= 0) {
      setError("Enter a valid payment amount.");
      return;
    }
    if (!paymentForm.due_date) {
      setError("Due date is required.");
      return;
    }
    if (!paymentForm.paid_date) {
      setError("Paid date is required.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        lease: Number(targetLease.id),
        payment_type: "rent",
        amount: paymentForm.amount,
        due_date: paymentForm.due_date,
        paid_date: paymentForm.paid_date,
        payment_method: paymentForm.payment_method,
        status: "paid",
        transaction_id: paymentForm.transaction_id,
      };

      const response = await authenticatedFetch(`${API_URL}/payments/`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!response) return;

      const data = await readResponse(response);
      if (!response.ok) {
        throw new Error(data.detail || Object.values(data).flat()[0] || "Unable to record payment.");
      }

      await loadData();
      closePaymentForm();
    } catch (err) {
      setError(err.message || "Unable to save payment.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <LandlordLayout
      breadcrumb="Tenants"
      title="Tenants Directory"
      subtitle="View and manage tenants by building and floor, track monthly rents, and record payments."
    >
      {error && (
        <div className="tenants-error-banner">
          <WarningIcon size={18} />
          <span>{error}</span>
          <button type="button" onClick={() => setError("")} aria-label="Dismiss error">
            <CloseIcon size={16} />
          </button>
        </div>
      )}

      {/* TOP KPI CARDS */}
      <section className="tenants-summary-grid">
        <div className="tenant-stat-card">
          <div className="stat-icon-box total">
            <TenantIcon size={22} />
          </div>
          <div className="stat-content">
            <span className="stat-label">TOTAL TENANTS</span>
            <strong className="stat-number">{tenants.length}</strong>
          </div>
        </div>

        <div className="tenant-stat-card">
          <div className="stat-icon-box paid">
            <CheckIcon size={22} />
          </div>
          <div className="stat-content">
            <span className="stat-label">RENT PAID (THIS MONTH)</span>
            <strong className="stat-number">{currentMonthPaidCount}</strong>
          </div>
        </div>

        <div className="tenant-stat-card">
          <div className="stat-icon-box pending">
            <RupeeIcon size={22} />
          </div>
          <div className="stat-content">
            <span className="stat-label">RENT PENDING</span>
            <strong className="stat-number">{currentMonthPendingCount}</strong>
          </div>
        </div>

        <div className="tenant-stat-card">
          <div className="stat-icon-box active-agreements">
            <FileTextIcon size={22} />
          </div>
          <div className="stat-content">
            <span className="stat-label">ACTIVE LEASES</span>
            <strong className="stat-number">
              {tenants.filter((t) => t.active_lease).length}
            </strong>
          </div>
        </div>
      </section>

      {/* FILTER & CONTROLS TOOLBAR */}
      <section className="tenants-toolbar-card">
        <div className="search-box">
          <SearchIcon size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search by name, phone, unit number, or building..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="clear-search-btn"
              onClick={() => setSearchQuery("")}
            >
              <CloseIcon size={14} />
            </button>
          )}
        </div>

        <div className="filter-controls">
          <select
            value={filterBuilding}
            onChange={(e) => setFilterBuilding(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Buildings</option>
            {groupedTenants.buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Payment Statuses</option>
            <option value="paid">Rent Paid</option>
            <option value="pending">Rent Pending</option>
          </select>

          <div className="view-mode-toggle">
            <button
              type="button"
              className={`toggle-btn ${viewMode === "cards" ? "active" : ""}`}
              onClick={() => setViewMode("cards")}
              title="Card Grid View"
            >
              Cards
            </button>
            <button
              type="button"
              className={`toggle-btn ${viewMode === "table" ? "active" : ""}`}
              onClick={() => setViewMode("table")}
              title="Data Table View"
            >
              Table
            </button>
          </div>
        </div>
      </section>

      {/* MAIN DIRECTORY VIEW */}
      {loading ? (
        <div className="tenants-loading-state">
          <div className="tenants-spinner" />
          <p>Loading tenants directory...</p>
        </div>
      ) : filteredTenantsList.length === 0 ? (
        <div className="tenants-empty-state">
          <div className="empty-icon-wrap">
            <TenantIcon size={44} />
          </div>
          <h3>No tenants found</h3>
          <p>
            {searchQuery || filterBuilding !== "all" || filterStatus !== "all"
              ? "No tenants matched your active filters. Try resetting the search or filter."
              : "No tenants exist yet in your property directory."}
          </p>
        </div>
      ) : viewMode === "table" ? (
        /* TABLE VIEW */
        <div className="tenants-table-wrapper">
          <table className="tenants-table">
            <thead>
              <tr>
                <th>Unit & Building</th>
                <th>Tenant Details</th>
                <th>Rental / Lease</th>
                <th>Monthly Rent</th>
                <th>Current Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTenantsList.map(({ tenant, lease, rentStatus }) => (
                <tr key={tenant.id} className="tenant-table-row">
                  <td>
                    {lease ? (
                      <div className="unit-badge-cell">
                        <span className="unit-number-tag">
                          Unit {lease.unit_number || lease.unit_name}
                        </span>
                        <span className="building-sub-tag">
                          {lease.building_name} &bull; Floor {lease.floor_number ?? "N/A"}
                        </span>
                      </div>
                    ) : (
                      <span className="unassigned-badge">Unassigned</span>
                    )}
                  </td>

                  <td>
                    <div className="tenant-profile-cell">
                      <div className="avatar-circle">
                        {(tenant.first_name || tenant.full_name || "T")
                          .charAt(0)
                          .toUpperCase()}
                      </div>
                      <div className="tenant-text-info">
                        <strong className="tenant-full-name">
                          {tenant.full_name}
                        </strong>
                        <div className="contact-links">
                          {tenant.phone && (
                            <span className="contact-item">
                              <PhoneIcon size={12} /> {tenant.phone}
                            </span>
                          )}
                          {tenant.email && (
                            <span className="contact-item">
                              <MailIcon size={12} /> {tenant.email}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td>
                    {lease ? (
                      <div className="agreement-cell">
                        <span className="agreement-type-badge">
                          {lease.lease_type === "lease" ? "Lease" : "Rental"}
                        </span>
                        <span className="date-range-text">
                          {formatDate(lease.start_date)} &rarr; {formatDate(lease.end_date)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-dash">&mdash;</span>
                    )}
                  </td>

                  <td>
                    {lease ? (
                      <div className="rent-amount-cell">
                        <strong>₹{formatMoney(lease.monthly_rent)}</strong>
                        <small>/ month</small>
                      </div>
                    ) : (
                      <span className="text-muted-dash">&mdash;</span>
                    )}
                  </td>

                  <td>
                    {lease ? (
                      <div className="status-pill-cell">
                        <span
                          className={`rent-status-pill ${
                            rentStatus.status === "paid" ? "paid" : "pending"
                          }`}
                        >
                          <span className="dot" />
                          {rentStatus.label}
                        </span>
                        <span className="period-sub">
                          Period: {formatPeriodRange(rentStatus.billingStart, rentStatus.billingEnd)}
                        </span>
                      </div>
                    ) : (
                      <span className="unassigned-pill">No Lease</span>
                    )}
                  </td>

                  <td className="text-right">
                    <div className="row-actions-group">
                      <button
                        type="button"
                        className="btn-action-view"
                        onClick={() => openTenant(tenant)}
                        title="View Tenant Details"
                      >
                        <EyeIcon size={15} />
                        <span>Details</span>
                      </button>

                      {lease && rentStatus.status === "pending" && (
                        <button
                          type="button"
                          className="btn-action-pay"
                          onClick={() => openPaymentForm(tenant, lease)}
                          title="Record Rent Payment"
                        >
                          <RupeeIcon size={13} />
                          <span>Record Rent</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* CARDS / GROUPED VIEW */
        <div className="tenants-grouped-container">
          {groupedTenants.buildings.map((building) => {
            // Check if any tenants in this building match search/filter
            const buildingMatches = building.floors.some((f) =>
              f.tenants.some((item) =>
                filteredTenantsList.some((ft) => ft.tenant.id === item.tenant.id)
              )
            );

            if (!buildingMatches && (searchQuery || filterBuilding !== "all" || filterStatus !== "all")) {
              return null;
            }

            return (
              <div key={building.id} className="building-tenant-card">
                {/* Building Header Banner */}
                <div className="building-banner">
                  <div className="building-title-row">
                    <div className="building-icon-badge">
                      <BuildingIcon size={20} />
                    </div>
                    <div>
                      <h2>{building.name}</h2>
                      <p className="building-stats-sub">
                        {building.floors.reduce(
                          (acc, fl) => acc + fl.tenants.length,
                          0
                        )}{" "}
                        tenants assigned across {building.floors.length} floors
                      </p>
                    </div>
                  </div>
                </div>

                {/* Floors inside this building */}
                <div className="floors-container">
                  {building.floors.map((floor) => {
                    const floorFiltered = floor.tenants.filter((item) =>
                      filteredTenantsList.some((ft) => ft.tenant.id === item.tenant.id)
                    );

                    if (floorFiltered.length === 0) return null;

                    return (
                      <div key={floor.number} className="floor-tenant-group">
                        <div className="floor-divider-bar">
                          <div className="floor-indicator">
                            <LayersIcon size={16} />
                            <span>Floor {floor.number}</span>
                          </div>
                          <span className="floor-occupancy-pill">
                            {floorFiltered.length}{" "}
                            {floorFiltered.length === 1 ? "unit" : "units"}
                          </span>
                        </div>

                        {/* Tenant Card Grid for this floor */}
                        <div className="floor-cards-grid">
                          {floorFiltered.map(({ tenant, lease, rentStatus }) => (
                            <div
                              key={tenant.id}
                              className="tenant-directory-card"
                              onClick={() => openTenant(tenant)}
                            >
                              {/* Top Bar with Unit Badge and Status Tag */}
                              <div className="card-top-bar">
                                <div className="unit-indicator">
                                  <span className="unit-label">UNIT</span>
                                  <strong>{lease.unit_number || lease.unit_name}</strong>
                                </div>
                                <span
                                  className={`rent-status-pill ${
                                    rentStatus.status === "paid" ? "paid" : "pending"
                                  }`}
                                >
                                  <span className="dot" />
                                  {rentStatus.label}
                                </span>
                              </div>

                              {/* Tenant Identity */}
                              <div className="tenant-card-profile">
                                <div className="avatar-circle-lg">
                                  {(tenant.first_name || tenant.full_name || "T")
                                    .charAt(0)
                                    .toUpperCase()}
                                </div>
                                <div className="profile-text">
                                  <h3 className="tenant-name">{tenant.full_name}</h3>
                                  <div className="contact-chip-row">
                                    {tenant.phone && (
                                      <span className="contact-chip">
                                        <PhoneIcon size={12} />
                                        {tenant.phone}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Lease Info Strip */}
                              <div className="card-lease-strip">
                                <div className="strip-item">
                                  <span className="strip-lbl">Agreement</span>
                                  <span className="strip-val">
                                    {lease.lease_type === "lease" ? "Lease" : "Rental"}
                                  </span>
                                </div>
                                <div className="strip-item">
                                  <span className="strip-lbl">Monthly Rent</span>
                                  <strong className="strip-val rent-val">
                                    ₹{formatMoney(lease.monthly_rent)}
                                  </strong>
                                </div>
                                <div className="strip-item">
                                  <span className="strip-lbl">Billing Period</span>
                                  <span className="strip-val">
                                    {formatPeriodRange(rentStatus.billingStart, rentStatus.billingEnd)}
                                  </span>
                                </div>
                              </div>

                              {/* Card Actions */}
                              <div
                                className="card-actions-strip"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  className="btn-card-details"
                                  onClick={() => openTenant(tenant)}
                                >
                                  <EyeIcon size={14} />
                                  <span>View Details</span>
                                </button>

                                {rentStatus.status === "pending" && (
                                  <button
                                    type="button"
                                    className="btn-card-pay"
                                    onClick={() => openPaymentForm(tenant, lease)}
                                  >
                                    <RupeeIcon size={13} />
                                    <span>Record Rent</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Tenants without active agreement */}
          {groupedTenants.tenantsWithoutAgreement.length > 0 &&
            (!filterBuilding || filterBuilding === "all") && (
              <div className="building-tenant-card unassigned-section">
                <div className="building-banner unassigned">
                  <div className="building-title-row">
                    <div className="building-icon-badge unassigned">
                      <TenantIcon size={20} />
                    </div>
                    <div>
                      <h2>Tenants Without Active Agreement</h2>
                      <p className="building-stats-sub">
                        {groupedTenants.tenantsWithoutAgreement.length} tenants not assigned to any active lease
                      </p>
                    </div>
                  </div>
                </div>

                <div className="floor-cards-grid unassigned-grid">
                  {groupedTenants.tenantsWithoutAgreement.map(({ tenant }) => (
                    <div
                      key={tenant.id}
                      className="tenant-directory-card unassigned"
                      onClick={() => openTenant(tenant)}
                    >
                      <div className="tenant-card-profile">
                        <div className="avatar-circle-lg">
                          {(tenant.first_name || tenant.full_name || "T")
                            .charAt(0)
                            .toUpperCase()}
                        </div>
                        <div className="profile-text">
                          <h3 className="tenant-name">{tenant.full_name}</h3>
                          <span className="unassigned-tag">No Active Agreement</span>
                          <div className="contact-chip-row">
                            {tenant.phone && (
                              <span className="contact-chip">
                                <PhoneIcon size={12} />
                                {tenant.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="card-actions-strip" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="btn-card-details full-width"
                          onClick={() => openTenant(tenant)}
                        >
                          <EyeIcon size={14} />
                          <span>View Details</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
        </div>
      )}

      {/* TENANT DETAILS MODAL */}
      {showDetails && selectedTenant && (
        <div className="tenant-modal-overlay" onClick={closeDetails}>
          <div
            className="tenant-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="modal-topbar">
              <div className="modal-profile-header">
                <div className="modal-avatar">
                  {(selectedTenant.first_name || selectedTenant.full_name || "T")
                    .charAt(0)
                    .toUpperCase()}
                </div>
                <div>
                  <h2>{selectedTenant.full_name}</h2>
                  <p className="modal-subtitle">
                    Tenant Profile &bull; ID #{selectedTenant.id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-icon-btn"
                onClick={closeDetails}
                aria-label="Close"
              >
                <CloseIcon size={20} />
              </button>
            </div>

            {/* Modal Body Scroll */}
            <div className="modal-scroll-body">
              {/* Contact Information Cards */}
              <div className="modal-section-title">CONTACT INFORMATION</div>
              <div className="contact-info-grid">
                <div className="info-tile">
                  <span className="tile-label">Phone Number</span>
                  <strong className="tile-value">
                    {selectedTenant.phone || "Not provided"}
                  </strong>
                </div>
                <div className="info-tile">
                  <span className="tile-label">Email Address</span>
                  <strong className="tile-value">
                    {selectedTenant.email || "Not provided"}
                  </strong>
                </div>
                <div className="info-tile">
                  <span className="tile-label">Emergency Contact</span>
                  <strong className="tile-value">
                    {selectedTenant.emergency_contact || "Not provided"}
                  </strong>
                </div>
                <div className="info-tile">
                  <span className="tile-label">Emergency Phone</span>
                  <strong className="tile-value">
                    {selectedTenant.emergency_phone || "Not provided"}
                  </strong>
                </div>
              </div>

              {/* Active Lease Section */}
              <div className="modal-section-title">ACTIVE AGREEMENT & RENT</div>
              {activeLease ? (
                <div className="lease-overview-box">
                  <div className="lease-unit-header">
                    <div>
                      <h3>
                        {activeLease.building_name} &bull; Unit{" "}
                        {activeLease.unit_number || activeLease.unit_name}
                      </h3>
                      <p className="lease-sub">
                        Floor {activeLease.floor_number ?? "N/A"} &bull;{" "}
                        {activeLease.lease_type === "lease" ? "Commercial Lease" : "Residential Rental"}
                      </p>
                    </div>
                    <div className="lease-rent-highlight">
                      <span className="rent-amt">
                        ₹{formatMoney(activeLease.monthly_rent)}
                      </span>
                      <span className="rent-period">/ month</span>
                    </div>
                  </div>

                  <div className="lease-dates-row">
                    <div className="date-tile">
                      <CalendarIcon size={15} />
                      <span>
                        Lease Term: {formatDate(activeLease.start_date)} to{" "}
                        {formatDate(activeLease.end_date)}
                      </span>
                    </div>
                    {activeLease.security_deposit && (
                      <div className="deposit-tile">
                        Deposit: ₹{formatMoney(activeLease.security_deposit)}
                      </div>
                    )}
                  </div>

                  {/* Current Month Rent Status Alert */}
                  <div className={`rent-billing-card ${currentRentStatus.status}`}>
                    <div className="billing-details">
                      <div className="billing-top">
                        <span className="billing-badge">
                          {currentRentStatus.label}
                        </span>
                        <strong className="billing-period-name">
                          {getCurrentPeriodLabel(currentRentStatus)} Rent
                        </strong>
                      </div>
                      <div className="billing-period-dates">
                        <CalendarIcon size={13} />
                        <span>
                          Period: {formatPeriodRange(currentRentStatus.billingStart, currentRentStatus.billingEnd)}
                        </span>
                      </div>
                      <div className="billing-meta">
                        <span>Amount: ₹{formatMoney(currentRentStatus.amount)}</span>
                        <span>&bull;</span>
                        <span>
                          {currentRentStatus.status === "paid"
                            ? `Paid on: ${formatDate(currentRentStatus.paidDate)}`
                            : `Due on: ${formatDate(currentRentStatus.dueDate)}`}
                        </span>
                      </div>
                    </div>

                    {currentRentStatus.status === "pending" && (
                      <button
                        type="button"
                        className="btn-quick-record-rent"
                        onClick={() => openPaymentForm(selectedTenant, activeLease)}
                      >
                        <RupeeIcon size={14} />
                        <span>Record Payment</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="no-lease-banner">
                  <p>This tenant does not currently have an active rental or lease.</p>
                </div>
              )}

              {/* Payment History */}
              <div className="modal-section-title">PAYMENT HISTORY</div>
              {selectedPayments.length > 0 ? (
                <div className="modal-payments-table-wrap">
                  <table className="modal-payments-table">
                    <thead>
                      <tr>
                        <th>Invoice #</th>
                        <th>Due Date</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th className="text-right">Docs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedPayments.map((p) => (
                        <tr key={p.id}>
                          <td>{p.invoice_number || `INV-${String(p.id).padStart(5, "0")}`}</td>
                          <td>{formatDate(p.due_date)}</td>
                          <td>
                            <strong>₹{formatMoney(p.amount)}</strong>
                          </td>
                          <td>
                            <span
                              className={`rent-status-pill ${
                                p.status === "paid" ? "paid" : "pending"
                              }`}
                            >
                              <span className="dot" />
                              {p.status?.toUpperCase()}
                            </span>
                          </td>
                          <td className="text-right">
                            <div className="doc-btns-group">
                              <button
                                type="button"
                                className="btn-doc-link"
                                onClick={() => navigate(`/landlord/invoices/${p.id}`)}
                                title="View Rent Invoice"
                              >
                                Invoice
                              </button>
                              {p.status === "paid" && (
                                <button
                                  type="button"
                                  className="btn-doc-link receipt"
                                  onClick={() => navigate(`/landlord/receipts/${p.id}`)}
                                  title="View Receipt"
                                >
                                  Receipt
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="no-payments-banner">
                  <p>No recorded payment transactions for this tenant yet.</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="modal-footer">
              <button
                type="button"
                className="btn-modal-cancel"
                onClick={closeDetails}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECORD PAYMENT MODAL */}
      {showPaymentForm && (
        <div className="tenant-modal-overlay" onClick={closePaymentForm}>
          <div
            className="tenant-payment-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-topbar">
              <div>
                <h2>Record Rent Payment</h2>
                <p className="modal-subtitle">
                  {selectedTenant?.full_name} &bull; Unit{" "}
                  {activeLease?.unit_number || activeLease?.unit_name}
                </p>
              </div>
              <button
                type="button"
                className="modal-close-icon-btn"
                onClick={closePaymentForm}
              >
                <CloseIcon size={20} />
              </button>
            </div>

            <form onSubmit={savePayment} className="payment-modal-form">
              <div className="form-field-group">
                <label>Payment Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  name="amount"
                  value={paymentForm.amount}
                  onChange={handlePaymentChange}
                  placeholder="e.g. 15000"
                  required
                />
              </div>

              <div className="form-grid-2">
                <div className="form-field-group">
                  <label>Due Date</label>
                  <input
                    type="date"
                    name="due_date"
                    value={paymentForm.due_date}
                    onChange={handlePaymentChange}
                    required
                  />
                </div>
                <div className="form-field-group">
                  <label>Paid Date</label>
                  <input
                    type="date"
                    name="paid_date"
                    value={paymentForm.paid_date}
                    onChange={handlePaymentChange}
                    required
                  />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-field-group">
                  <label>Payment Method</label>
                  <select
                    name="payment_method"
                    value={paymentForm.payment_method}
                    onChange={handlePaymentChange}
                  >
                    <option value="online">Online / UPI</option>
                    <option value="bank_transfer">Bank Transfer / NEFT</option>
                    <option value="cash">Cash</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>

                <div className="form-field-group">
                  <label>Transaction / Reference ID</label>
                  <input
                    type="text"
                    name="transaction_id"
                    value={paymentForm.transaction_id}
                    onChange={handlePaymentChange}
                    placeholder="Optional reference number"
                  />
                </div>
              </div>

              <div className="modal-footer in-form">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={closePaymentForm}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-modal-submit"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Confirm & Save Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </LandlordLayout>
  );
}

export default Tenants;