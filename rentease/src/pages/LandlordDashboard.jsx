import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import LandlordLayout from "../components/LandlordLayout";
import {
  BuildingIcon,
  TenantIcon,
  LeaseIcon,
  PaymentIcon,
  RupeeIcon,
  PlusIcon,
  ChevronRightIcon,
  MaintenanceIcon,
} from "../components/Icons";
import "./LandlordDashboard.css";

const API_URL = "http://127.0.0.1:8000/api";

function LandlordDashboard() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [properties, setProperties] = useState([]);
  const [leases, setLeases] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    const savedUser = localStorage.getItem("user");

    if (!token) {
      navigate("/login");
      return;
    }

    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (error) {
        console.error("Failed to read saved user:", error);
      }
    }

    const fetchDashboardData = async () => {
      try {
        const headers = {
          Authorization: `Bearer ${token}`,
        };

        const [propertiesResponse, leasesResponse, paymentsResponse] =
          await Promise.all([
            fetch(`${API_URL}/buildings/`, { headers }),
            fetch(`${API_URL}/leases/`, { headers }),
            fetch(`${API_URL}/payments/`, { headers }),
          ]);

        if (
          propertiesResponse.status === 401 ||
          leasesResponse.status === 401 ||
          paymentsResponse.status === 401
        ) {
          handleLogout();
          return;
        }

        const propertiesData = await propertiesResponse.json();
        const leasesData = await leasesResponse.json();
        const paymentsData = await paymentsResponse.json();

        setProperties(Array.isArray(propertiesData) ? propertiesData : []);
        setLeases(Array.isArray(leasesData) ? leasesData : []);
        setPayments(Array.isArray(paymentsData) ? paymentsData : []);
      } catch (error) {
        console.error("Dashboard data error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  };

  const activeLeases = leases.filter((lease) => lease.status === "active");

  const pendingPayments = payments.filter(
    (payment) => payment.status === "pending" || payment.status === "overdue"
  );

  const totalMonthlyRent = activeLeases.reduce(
    (total, lease) => total + Number(lease.monthly_rent || 0),
    0
  );

  const occupiedProperties = new Set(
    activeLeases.map((lease) => lease.property)
  ).size;

  const occupancyRate =
    properties.length > 0
      ? Math.round((occupiedProperties / properties.length) * 100)
      : 0;

  const pendingRent = pendingPayments.reduce(
    (total, payment) => total + Number(payment.amount || 0),
    0
  );

  const totalTrackedPayments = payments.reduce(
    (total, payment) => total + Number(payment.amount || 0),
    0
  );

  if (loading) {
    return (
      <div className="dashboard-loading-screen">
        <div className="dashboard-spinner" />
        <p>Loading RentEase dashboard...</p>
      </div>
    );
  }

  const userGreeting = user?.first_name
    ? `${user.first_name}`
    : user?.username || "Landlord";

  return (
    <LandlordLayout
      breadcrumb="Overview"
      badgeCounts={{ payments: pendingPayments.length }}
    >
      <div className="dash-container">
        {/* WELCOME BANNER */}
        <section className="dash-welcome">
          <div className="dash-welcome-content">
            <span className="dash-welcome-tag">PORTFOLIO OVERVIEW</span>
            <h2>Good day, {userGreeting}! 👋</h2>
            <p>
              Here is what is happening across your buildings, units, leases, and
              tenant payments today.
            </p>
          </div>
          <div className="dash-welcome-actions">
            <button
              className="dash-primary-btn"
              onClick={() => navigate("/landlord/buildings")}
            >
              <PlusIcon size={18} />
              <span>Add Building</span>
            </button>
          </div>
        </section>

        {/* STATS OVERVIEW */}
        <section className="dash-stats-grid">
          <div className="dash-stat-card">
            <div className="dash-stat-icon blue">
              <BuildingIcon size={22} />
            </div>
            <div className="dash-stat-meta">
              <span className="dash-stat-label">Total Buildings</span>
              <strong className="dash-stat-val">{properties.length}</strong>
            </div>
          </div>

          <div className="dash-stat-card">
            <div className="dash-stat-icon purple">
              <LeaseIcon size={22} />
            </div>
            <div className="dash-stat-meta">
              <span className="dash-stat-label">Active Leases</span>
              <strong className="dash-stat-val">{activeLeases.length}</strong>
            </div>
          </div>

          <div className="dash-stat-card">
            <div className="dash-stat-icon green">
              <TenantIcon size={22} />
            </div>
            <div className="dash-stat-meta">
              <span className="dash-stat-label">Occupancy Rate</span>
              <strong className="dash-stat-val">{occupancyRate}%</strong>
            </div>
          </div>

          <div className="dash-stat-card">
            <div className="dash-stat-icon orange">
              <RupeeIcon size={20} />
            </div>
            <div className="dash-stat-meta">
              <span className="dash-stat-label">Pending Collection</span>
              <strong className="dash-stat-val orange-text">
                ₹{pendingRent.toLocaleString("en-IN")}
              </strong>
            </div>
          </div>
        </section>

        {/* FINANCIAL & PAYMENT STATUS SPLIT */}
        <section className="dash-cards-split">
          {/* MONTHLY RENT SUMMARY */}
          <div className="dash-card">
            <div className="dash-card-head">
              <div>
                <span className="dash-card-tag">MONTHLY RENT POTENTIAL</span>
                <h3 className="dash-card-big-num">
                  ₹{totalMonthlyRent.toLocaleString("en-IN")}
                </h3>
              </div>
              <span className="dash-pill success">
                {activeLeases.length} Active Leases
              </span>
            </div>

            {/* Visual Bar Indicator */}
            <div className="dash-chart-container">
              <div className="dash-chart-bars">
                {[45, 60, 52, 75, 68, 85, 92].map((height, idx) => (
                  <div key={idx} className="dash-bar-col">
                    <div
                      className="dash-bar-fill"
                      style={{ height: `${height}%` }}
                    />
                    <span className="dash-bar-label">
                      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][idx]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* PAYMENT BREAKDOWN */}
          <div className="dash-card">
            <div className="dash-card-head">
              <div>
                <span className="dash-card-tag">COLLECTION STATUS</span>
                <h3 className="dash-card-big-num">
                  {pendingPayments.length}{" "}
                  <span className="dash-sub-num">Pending</span>
                </h3>
              </div>
              {pendingPayments.length > 0 ? (
                <span className="dash-pill warning">Attention Needed</span>
              ) : (
                <span className="dash-pill success">All Settled</span>
              )}
            </div>

            <div className="dash-payment-list">
              <div className="dash-payment-row">
                <span className="dash-pay-label">Pending / Overdue</span>
                <strong className="dash-pay-amount danger-text">
                  ₹{pendingRent.toLocaleString("en-IN")}
                </strong>
              </div>

              <div className="dash-payment-row">
                <span className="dash-pay-label">Total Tracked Payments</span>
                <strong className="dash-pay-amount">
                  ₹{totalTrackedPayments.toLocaleString("en-IN")}
                </strong>
              </div>

              <div className="dash-payment-row">
                <span className="dash-pay-label">Payment Invoices Generated</span>
                <strong className="dash-pay-amount">{payments.length}</strong>
              </div>
            </div>

            <button
              className="dash-link-btn"
              onClick={() => navigate("/landlord/payments")}
            >
              <span>Manage all payments</span>
              <ChevronRightIcon size={16} />
            </button>
          </div>
        </section>

        {/* RECENT PROPERTIES / BUILDINGS */}
        <section className="dash-card">
          <div className="dash-card-head">
            <div>
              <span className="dash-card-tag">PORTFOLIO PROPERTIES</span>
              <h3 className="dash-card-title">Recent Buildings</h3>
            </div>
            <button
              className="dash-text-btn"
              onClick={() => navigate("/landlord/buildings")}
            >
              <span>View all buildings</span>
              <ChevronRightIcon size={16} />
            </button>
          </div>

          {properties.length === 0 ? (
            <div className="dash-empty-state">
              <div className="dash-empty-icon">
                <BuildingIcon size={32} />
              </div>
              <h4>No buildings registered yet</h4>
              <p>
                Add your first building and configure floors and units to start
                managing your properties.
              </p>
              <button
                className="dash-primary-btn"
                onClick={() => navigate("/landlord/buildings")}
              >
                <PlusIcon size={18} />
                <span>Add Your First Building</span>
              </button>
            </div>
          ) : (
            <div className="dash-property-table">
              {properties.slice(0, 5).map((property) => {
                return (
                  <div
                    key={property.id}
                    className="dash-property-row"
                    onClick={() =>
                      navigate(`/landlord/buildings/${property.id}`)
                    }
                  >
                    <div className="dash-property-avatar">
                      <BuildingIcon size={22} />
                    </div>

                    <div className="dash-property-info">
                      <strong className="dash-property-name">
                        {property.name}
                      </strong>
                      <span className="dash-property-location">
                        {property.address}
                        {property.city ? `, ${property.city}` : ""}
                        {property.state ? `, ${property.state}` : ""}
                      </span>
                    </div>

                    <div className="dash-property-meta">
                      <span className="dash-meta-label">Floors</span>
                      <strong className="dash-meta-val">
                        {property.number_of_floors || 1}
                      </strong>
                    </div>

                    <div className="dash-property-actions">
                      <button
                        className="dash-view-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/landlord/buildings/${property.id}`);
                        }}
                      >
                        View Dashboard →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* QUICK SHORTCUT ACTIONS */}
        <section className="dash-shortcuts">
          <button
            className="dash-shortcut-card"
            onClick={() => navigate("/landlord/buildings")}
          >
            <div className="dash-shortcut-icon blue">
              <BuildingIcon size={22} />
            </div>
            <div className="dash-shortcut-text">
              <strong>Manage Buildings</strong>
              <small>Configure floors, units & pricing</small>
            </div>
          </button>

          <button
            className="dash-shortcut-card"
            onClick={() => navigate("/landlord/tenants")}
          >
            <div className="dash-shortcut-icon green">
              <TenantIcon size={22} />
            </div>
            <div className="dash-shortcut-text">
              <strong>Manage Tenants</strong>
              <small>View tenants & lease records</small>
            </div>
          </button>

          <button
            className="dash-shortcut-card"
            onClick={() => navigate("/landlord/leases")}
          >
            <div className="dash-shortcut-icon purple">
              <LeaseIcon size={22} />
            </div>
            <div className="dash-shortcut-text">
              <strong>Manage Leases</strong>
              <small>Create & renew rental agreements</small>
            </div>
          </button>

          <button
            className="dash-shortcut-card"
            onClick={() => navigate("/landlord/maintenance")}
          >
            <div className="dash-shortcut-icon orange">
              <MaintenanceIcon size={22} />
            </div>
            <div className="dash-shortcut-text">
              <strong>Maintenance</strong>
              <small>Track unit repairs & requests</small>
            </div>
          </button>
        </section>
      </div>
    </LandlordLayout>
  );
}

export default LandlordDashboard;