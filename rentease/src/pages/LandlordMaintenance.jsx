import { useState, useEffect, useMemo } from "react";
import LandlordLayout from "../components/LandlordLayout";
import {
  WrenchIcon,
  SearchIcon,
  FilterIcon,
  CheckIcon,
  WarningIcon,
  EyeIcon,
  BuildingIcon,
  CalendarIcon,
  UserIcon,
} from "../components/Icons";
import { API_URL } from "../api";
import "./LandlordMaintenance.css";

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const PRIORITY_OPTIONS = [
  { value: "all", label: "All Priorities" },
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export default function LandlordMaintenance() {
  const token = localStorage.getItem("access_token");

  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  // Response / Status Modal
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [newStatus, setNewStatus] = useState("open");
  const [landlordReply, setLandlordReply] = useState("");
  const [updating, setUpdating] = useState(false);
  const [modalError, setModalError] = useState("");

  // Photo viewer lightbox
  const [previewPhoto, setPreviewPhoto] = useState(null);

  useEffect(() => {
    fetchComplaints();
  }, []);

  const fetchComplaints = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/maintenance/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load maintenance complaints.");
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.results || [];
      setComplaints(list);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load complaints.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenActionModal = (ticket) => {
    setSelectedTicket(ticket);
    setNewStatus(ticket.status || "open");
    setLandlordReply(ticket.landlord_response || "");
    setModalError("");
  };

  const handleCloseActionModal = () => {
    setSelectedTicket(null);
    setLandlordReply("");
    setModalError("");
  };

  const handleUpdateTicket = async (e) => {
    e.preventDefault();
    if (!selectedTicket) return;
    setUpdating(true);
    setModalError("");

    try {
      const res = await fetch(`${API_URL}/maintenance/${selectedTicket.id}/`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: newStatus,
          landlord_response: landlordReply,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to update maintenance request.");
      }

      const updated = await res.json();
      setComplaints((prev) =>
        prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
      );
      handleCloseActionModal();
    } catch (err) {
      setModalError(err.message);
    } finally {
      setUpdating(false);
    }
  };

  // Metrics
  const stats = useMemo(() => {
    const total = complaints.length;
    const open = complaints.filter(
      (c) => c.status === "open" || c.status === "pending"
    ).length;
    const inProgress = complaints.filter((c) => c.status === "in_progress").length;
    const resolved = complaints.filter(
      (c) => c.status === "resolved" || c.status === "closed"
    ).length;
    return { total, open, inProgress, resolved };
  }, [complaints]);

  // Filtered complaints
  const filteredComplaints = useMemo(() => {
    return complaints.filter((c) => {
      const matchesSearch =
        search.trim() === "" ||
        (c.title || "").toLowerCase().includes(search.toLowerCase()) ||
        (c.description || "").toLowerCase().includes(search.toLowerCase()) ||
        (c.tenant_name || "").toLowerCase().includes(search.toLowerCase()) ||
        (c.building_name || "").toLowerCase().includes(search.toLowerCase()) ||
        (c.unit_name || "").toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === "all" ||
        c.status === statusFilter ||
        (statusFilter === "open" && c.status === "pending");

      const matchesPriority =
        priorityFilter === "all" || c.priority === priorityFilter;

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [complaints, search, statusFilter, priorityFilter]);

  const getPriorityBadgeClass = (priority) => {
    switch (priority) {
      case "urgent":
        return "priority-badge urgent";
      case "high":
        return "priority-badge high";
      case "medium":
        return "priority-badge medium";
      case "low":
      default:
        return "priority-badge low";
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case "resolved":
      case "closed":
        return "status-badge resolved";
      case "in_progress":
        return "status-badge in-progress";
      case "rejected":
        return "status-badge rejected";
      case "open":
      case "pending":
      default:
        return "status-badge open";
    }
  };

  return (
    <LandlordLayout
      breadcrumb="Maintenance"
      title="Maintenance Management"
      subtitle="Review repair complaints from your tenants, track progress, and provide responses."
    >
      <div className="lm-container">
        {/* STATS OVERVIEW */}
        <div className="lm-stats-grid">
          <div className="lm-stat-card">
            <span className="lm-stat-label">TOTAL TICKETS</span>
            <strong className="lm-stat-val">{stats.total}</strong>
            <span className="lm-stat-sub">Across all buildings</span>
          </div>

          <div className="lm-stat-card warning">
            <span className="lm-stat-label">OPEN / PENDING</span>
            <strong className="lm-stat-val text-amber">{stats.open}</strong>
            <span className="lm-stat-sub">Requires landlord attention</span>
          </div>

          <div className="lm-stat-card blue">
            <span className="lm-stat-label">IN PROGRESS</span>
            <strong className="lm-stat-val text-blue">{stats.inProgress}</strong>
            <span className="lm-stat-sub">Technicians assigned</span>
          </div>

          <div className="lm-stat-card green">
            <span className="lm-stat-label">RESOLVED / CLOSED</span>
            <strong className="lm-stat-val text-green">{stats.resolved}</strong>
            <span className="lm-stat-sub">Repairs finalized</span>
          </div>
        </div>

        {/* CONTROLS BAR */}
        <div className="lm-controls-bar">
          <div className="lm-search-box">
            <SearchIcon size={16} />
            <input
              type="text"
              placeholder="Search by tenant, unit, building, or issue..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="lm-filter-group">
            <div className="lm-select-wrap">
              <FilterIcon size={14} />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="lm-select-wrap">
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
              >
                {PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ERROR BANNER */}
        {error && (
          <div className="lm-error-banner">
            <WarningIcon size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* COMPLAINTS LIST */}
        {loading ? (
          <div className="lm-loading-state">
            <div className="lm-spinner" />
            <p>Loading maintenance tickets...</p>
          </div>
        ) : filteredComplaints.length === 0 ? (
          <div className="lm-empty-state">
            <WrenchIcon size={44} />
            <h3>No maintenance requests found</h3>
            <p>
              {search || statusFilter !== "all" || priorityFilter !== "all"
                ? "Try clearing filters to see more results."
                : "Your tenants have not reported any maintenance issues."}
            </p>
          </div>
        ) : (
          <div className="lm-tickets-grid">
            {filteredComplaints.map((ticket) => {
              const photoUrl = ticket.image || ticket.image_url;
              return (
                <div key={ticket.id} className="lm-ticket-card">
                  <div className="lm-ticket-top">
                    <div className="lm-ticket-meta">
                      <span className={getPriorityBadgeClass(ticket.priority)}>
                        {(ticket.priority || "medium").toUpperCase()}
                      </span>
                      <span className="lm-category-tag">
                        {(ticket.category || "General").replace("_", " ")}
                      </span>
                    </div>

                    <span className={getStatusBadgeClass(ticket.status)}>
                      {(ticket.status || "open").replace("_", " ").toUpperCase()}
                    </span>
                  </div>

                  <h3 className="lm-ticket-title">{ticket.title}</h3>
                  <p className="lm-ticket-desc">{ticket.description}</p>

                  {/* TENANT & LOCATION DETAILS */}
                  <div className="lm-location-info">
                    <div className="info-item">
                      <UserIcon size={14} />
                      <strong>{ticket.tenant_name || "Unknown Tenant"}</strong>
                    </div>
                    <div className="info-item">
                      <BuildingIcon size={14} />
                      <span>
                        {ticket.building_name || "Building"} &bull; Unit{" "}
                        {ticket.unit_name || ticket.unit_number || "-"}
                      </span>
                    </div>
                    <div className="info-item date-item">
                      <CalendarIcon size={13} />
                      <span>
                        Reported:{" "}
                        {ticket.created_at
                          ? new Date(ticket.created_at).toLocaleDateString()
                          : "-"}
                      </span>
                    </div>
                  </div>

                  {/* PHOTO THUMBNAIL IF PRESENT */}
                  {photoUrl && (
                    <div className="lm-photo-row">
                      <button
                        type="button"
                        className="lm-photo-preview-btn"
                        onClick={() => setPreviewPhoto(photoUrl)}
                      >
                        <img src={photoUrl} alt="Complaint Attachment" />
                        <span className="preview-overlay">
                          <EyeIcon size={14} /> View Photo
                        </span>
                      </button>
                    </div>
                  )}

                  {/* LANDLORD RESPONSE */}
                  {ticket.landlord_response && (
                    <div className="lm-response-box">
                      <span className="resp-label">Your Response to Tenant:</span>
                      <p className="resp-text">{ticket.landlord_response}</p>
                    </div>
                  )}

                  {/* ACTION FOOTER */}
                  <div className="lm-card-footer">
                    <button
                      type="button"
                      className="btn-update-ticket"
                      onClick={() => handleOpenActionModal(ticket)}
                    >
                      <WrenchIcon size={14} />
                      <span>
                        {ticket.landlord_response ? "Edit Response / Status" : "Respond to Complaint"}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* UPDATE STATUS & RESPONSE MODAL */}
      {selectedTicket && (
        <div className="modal-backdrop" onClick={handleCloseActionModal}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Manage Maintenance Ticket #{selectedTicket.id}</h3>
                <span className="modal-subtitle">
                  {selectedTicket.title} &bull; {selectedTicket.tenant_name}
                </span>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={handleCloseActionModal}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleUpdateTicket} className="modal-form">
              {modalError && (
                <div className="modal-error">
                  <WarningIcon size={14} />
                  <span>{modalError}</span>
                </div>
              )}

              <div className="form-group">
                <label>Ticket Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="form-select"
                >
                  <option value="open">Open (Awaiting Inspection)</option>
                  <option value="in_progress">In Progress (Work Assigned)</option>
                  <option value="resolved">Resolved (Work Completed)</option>
                  <option value="closed">Closed (Archived)</option>
                  <option value="rejected">Rejected (Not Covered)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Landlord Response / Notes to Tenant</label>
                <textarea
                  rows={4}
                  className="form-textarea"
                  placeholder="Explain resolution steps, plumber arrival time, or repair status visible to the tenant..."
                  value={landlordReply}
                  onChange={(e) => setLandlordReply(e.target.value)}
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleCloseActionModal}
                  disabled={updating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={updating}
                >
                  {updating ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FULLSCREEN PHOTO LIGHTBOX */}
      {previewPhoto && (
        <div className="photo-lightbox" onClick={() => setPreviewPhoto(null)}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <img src={previewPhoto} alt="Maintenance Attachment" />
            <button
              type="button"
              className="lightbox-close"
              onClick={() => setPreviewPhoto(null)}
            >
              &times;
            </button>
          </div>
        </div>
      )}
    </LandlordLayout>
  );
}
