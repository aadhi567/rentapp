import { useState, useEffect, useMemo } from "react";
import TenantLayout from "../components/TenantLayout";
import {
  MaintenanceIcon,
  PlusIcon,
  CloseIcon,
  UploadIcon,
  CheckIcon,
  WarningIcon,
  CalendarIcon,
  BuildingIcon,
  EyeIcon,
  WrenchIcon,
  ShieldIcon,
} from "../components/Icons";
import "./TenantMaintenance.css";
import { API_URL } from "../api";

const CATEGORIES = [
  { id: "plumbing", label: "Plumbing", icon: "🔧" },
  { id: "electrical", label: "Electrical", icon: "⚡" },
  { id: "cleaning", label: "Cleaning", icon: "🧹" },
  { id: "security", label: "Security", icon: "🛡️" },
  { id: "structural", label: "Structural", icon: "🏗️" },
  { id: "other", label: "Other", icon: "📦" },
];

const PRIORITIES = [
  { id: "low", label: "Low", color: "blue" },
  { id: "medium", label: "Medium", color: "amber" },
  { id: "high", label: "High", color: "orange" },
  { id: "urgent", label: "Urgent", color: "red" },
];

function TenantMaintenance() {
  const [complaints, setComplaints] = useState([]);
  const [leases, setLeases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [activeTab, setActiveTab] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [selectedImageModal, setSelectedImageModal] = useState(null);

  // New Complaint Form
  const [form, setForm] = useState({
    unit: "",
    title: "",
    category: "plumbing",
    priority: "medium",
    description: "",
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [formError, setFormError] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formSuccess, setFormSuccess] = useState("");

  const token = localStorage.getItem("access_token");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError("");

    try {
      const headers = { Authorization: `Bearer ${token}` };

      const [leasesRes, maintRes] = await Promise.all([
        fetch(`${API_URL}/leases/`, { headers }),
        fetch(`${API_URL}/maintenance/`, { headers }),
      ]);

      if (!leasesRes.ok || !maintRes.ok) {
        throw new Error("Unable to fetch maintenance data from server.");
      }

      const [leasesData, maintData] = await Promise.all([
        leasesRes.json(),
        maintRes.json(),
      ]);

      const leaseItems = Array.isArray(leasesData)
        ? leasesData
        : leasesData.results || [];
      const maintItems = Array.isArray(maintData)
        ? maintData
        : maintData.results || [];

      setLeases(leaseItems);
      setComplaints(maintItems);

      // Pre-select active unit
      const active = leaseItems.find((l) => l.status === "active") || leaseItems[0];
      if (active) {
        setForm((prev) => ({ ...prev, unit: active.unit }));
      }
    } catch (err) {
      console.error("Error loading maintenance complaints:", err);
      setError("Failed to load maintenance records. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setFormError("");

    // Validate size: max 5 MB
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setFormError("The selected photo exceeds the 5 MB file size limit.");
      return;
    }

    // Validate type: JPEG, PNG, WebP
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      setFormError("Only JPEG, PNG, and WebP image formats are supported.");
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    if (!form.unit) {
      setFormError("Please select a rented unit for this request.");
      return;
    }
    if (!form.title.trim()) {
      setFormError("Please enter a short title for the complaint.");
      return;
    }
    if (!form.description.trim()) {
      setFormError("Please provide a description of the issue.");
      return;
    }

    setFormSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("unit", form.unit);
      formData.append("title", form.title.trim());
      formData.append("category", form.category);
      formData.append("priority", form.priority);
      formData.append("description", form.description.trim());

      if (imageFile) {
        formData.append("image", imageFile);
      }

      const res = await fetch(`${API_URL}/maintenance/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          // Note: browser sets Content-Type automatically with boundary for FormData
        },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.detail ||
            data.image?.[0] ||
            data.title?.[0] ||
            "Failed to submit maintenance request."
        );
      }

      setFormSuccess("Maintenance request submitted successfully!");
      setComplaints((prev) => [data, ...prev]);

      setTimeout(() => {
        setShowModal(false);
        setFormSuccess("");
        removeImage();
        setForm((prev) => ({
          ...prev,
          title: "",
          description: "",
          category: "plumbing",
          priority: "medium",
        }));
      }, 1500);
    } catch (err) {
      setFormError(err.message || "Failed to submit request.");
    } finally {
      setFormSubmitting(false);
    }
  };

  const filteredComplaints = useMemo(() => {
    return complaints.filter((c) => {
      if (activeTab === "all") return true;
      if (activeTab === "open") return c.status === "open" || c.status === "pending";
      if (activeTab === "in_progress") return c.status === "in_progress";
      if (activeTab === "resolved")
        return c.status === "resolved" || c.status === "closed";
      return true;
    });
  }, [complaints, activeTab]);

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

  return (
    <TenantLayout
      breadcrumb="Maintenance"
      title="Maintenance & Complaints"
      subtitle="Report maintenance issues, track landlord response, and upload inspection photos."
      actions={
        <button
          type="button"
          className="tenant-btn-new-complaint"
          onClick={() => setShowModal(true)}
        >
          <PlusIcon size={16} />
          <span>New Complaint</span>
        </button>
      }
    >
      <div className="tenant-maint-page">
        {/* STATS SUMMARY */}
        <div className="tenant-maint-stats">
          <div
            className={`maint-stat-pill ${activeTab === "all" ? "active" : ""}`}
            onClick={() => setActiveTab("all")}
          >
            <span className="count">{stats.total}</span>
            <span className="label">Total Submitted</span>
          </div>

          <div
            className={`maint-stat-pill amber ${activeTab === "open" ? "active" : ""}`}
            onClick={() => setActiveTab("open")}
          >
            <span className="count">{stats.open}</span>
            <span className="label">Open Tickets</span>
          </div>

          <div
            className={`maint-stat-pill blue ${activeTab === "in_progress" ? "active" : ""}`}
            onClick={() => setActiveTab("in_progress")}
          >
            <span className="count">{stats.inProgress}</span>
            <span className="label">In Progress</span>
          </div>

          <div
            className={`maint-stat-pill green ${activeTab === "resolved" ? "active" : ""}`}
            onClick={() => setActiveTab("resolved")}
          >
            <span className="count">{stats.resolved}</span>
            <span className="label">Resolved</span>
          </div>
        </div>

        {/* ERROR STATE */}
        {error && (
          <div className="tenant-maint-error" role="alert">
            <WarningIcon size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* LOADING STATE */}
        {loading ? (
          <div className="tenant-maint-loading">
            <div className="tenant-maint-spinner" />
            <p>Loading your maintenance complaints...</p>
          </div>
        ) : filteredComplaints.length === 0 ? (
          /* EMPTY STATE */
          <div className="tenant-maint-empty">
            <div className="tenant-empty-icon-wrap">
              <MaintenanceIcon size={32} />
            </div>
            <h3>No maintenance complaints</h3>
            <p>
              {activeTab === "all"
                ? "You haven't submitted any maintenance requests yet. Need a repair? Click 'New Complaint' above."
                : `No complaints found with status '${activeTab}'.`}
            </p>
            {activeTab === "all" && (
              <button
                type="button"
                className="tenant-btn-empty-action"
                onClick={() => setShowModal(true)}
              >
                <PlusIcon size={16} />
                <span>Submit Your First Request</span>
              </button>
            )}
          </div>
        ) : (
          /* COMPLAINTS LIST */
          <div className="tenant-complaints-list">
            {filteredComplaints.map((item) => {
              const isResolved = item.status === "resolved" || item.status === "closed";
              const isInProgress = item.status === "in_progress";
              const createdDate = item.created_at
                ? new Date(item.created_at).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : "-";

              return (
                <div key={item.id} className="tenant-complaint-card">
                  {/* CARD HEADER */}
                  <div className="complaint-card-header">
                    <div className="complaint-badges">
                      <span
                        className={`complaint-status-pill ${
                          isResolved ? "resolved" : isInProgress ? "in-progress" : "open"
                        }`}
                      >
                        <span className="dot" />
                        {item.status ? item.status.replace("_", " ").toUpperCase() : "OPEN"}
                      </span>

                      <span className={`complaint-priority-badge ${item.priority || "medium"}`}>
                        {item.priority ? item.priority.toUpperCase() : "MEDIUM"}
                      </span>

                      <span className="complaint-category-chip">
                        {item.category ? item.category.toUpperCase() : "OTHER"}
                      </span>
                    </div>

                    <div className="complaint-date">
                      <CalendarIcon size={14} />
                      <span>{createdDate}</span>
                    </div>
                  </div>

                  {/* BODY */}
                  <div className="complaint-card-body">
                    <h3 className="complaint-title">{item.title}</h3>
                    <div className="complaint-meta-unit">
                      <BuildingIcon size={14} />
                      <span>
                        {item.building_name || "Building"} &bull; Unit{" "}
                        {item.unit_number || item.unit}
                      </span>
                    </div>

                    <p className="complaint-description">{item.description}</p>

                    {/* ATTACHED PHOTO PREVIEW */}
                    {item.image && (
                      <div className="complaint-image-section">
                        <span className="complaint-img-label">Attached Photo:</span>
                        <div
                          className="complaint-thumb-container"
                          onClick={() => setSelectedImageModal(item.image)}
                          title="Click to view full image"
                        >
                          <img
                            src={item.image}
                            alt={item.title}
                            className="complaint-thumb"
                          />
                          <div className="thumb-overlay">
                            <EyeIcon size={18} />
                            <span>Inspect</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* LANDLORD RESPONSE SECTION */}
                  <div className="complaint-response-box">
                    <div className="response-header">
                      <div className="response-icon">
                        <WrenchIcon size={15} />
                      </div>
                      <strong>Landlord Response</strong>
                      {isResolved && item.resolved_at && (
                        <span className="resolved-date-tag">
                          Resolved on:{" "}
                          {new Date(item.resolved_at).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      )}
                    </div>

                    {item.landlord_response ? (
                      <p className="response-message">{item.landlord_response}</p>
                    ) : (
                      <p className="response-pending">
                        Ticket is pending landlord review. You will see repair updates and technician notes here.
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CREATE COMPLAINT MODAL */}
      {showModal && (
        <div className="tenant-modal-backdrop" onClick={() => setShowModal(false)}>
          <div
            className="tenant-maint-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="tenant-modal-header">
              <div className="tenant-modal-icon-wrap">
                <MaintenanceIcon size={22} />
              </div>
              <div>
                <h2>Submit Maintenance Request</h2>
                <p>Report a repair or service issue to your property manager.</p>
              </div>
              <button
                type="button"
                className="tenant-modal-close"
                onClick={() => setShowModal(false)}
              >
                <CloseIcon size={18} />
              </button>
            </div>

            {formError && (
              <div className="tenant-alert-error">
                <WarningIcon size={16} />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="tenant-alert-success">
                <CheckIcon size={16} />
                <span>{formSuccess}</span>
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="tenant-maint-form">
              {/* UNIT SELECTION */}
              {leases.length > 1 && (
                <div className="tenant-form-group">
                  <label htmlFor="maint_unit">Select Rented Unit</label>
                  <select
                    id="maint_unit"
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    required
                    disabled={formSubmitting}
                  >
                    {leases.map((l) => (
                      <option key={l.id} value={l.unit}>
                        {l.building_name} - Unit {l.unit_number} ({l.unit_type_display})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* TITLE */}
              <div className="tenant-form-group">
                <label htmlFor="maint_title">Complaint Title</label>
                <input
                  id="maint_title"
                  type="text"
                  placeholder="e.g. Leaking bathroom sink pipe"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                  disabled={formSubmitting}
                />
              </div>

              {/* CATEGORY & PRIORITY ROW */}
              <div className="tenant-form-row">
                <div className="tenant-form-group flex-1">
                  <label htmlFor="maint_category">Category</label>
                  <select
                    id="maint_category"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    disabled={formSubmitting}
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.icon} {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="tenant-form-group flex-1">
                  <label htmlFor="maint_priority">Priority Level</label>
                  <select
                    id="maint_priority"
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value })}
                    disabled={formSubmitting}
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* DESCRIPTION */}
              <div className="tenant-form-group">
                <label htmlFor="maint_desc">Detailed Description</label>
                <textarea
                  id="maint_desc"
                  rows={4}
                  placeholder="Describe the issue, when it started, and exact location inside the unit..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  required
                  disabled={formSubmitting}
                />
              </div>

              {/* PHOTO UPLOAD */}
              <div className="tenant-form-group">
                <label>Attach Inspection Photo (Optional)</label>
                {imagePreview ? (
                  <div className="tenant-upload-preview-card">
                    <img
                      src={imagePreview}
                      alt="Upload preview"
                      className="preview-img"
                    />
                    <div className="preview-meta">
                      <span className="file-name">{imageFile?.name}</span>
                      <span className="file-size">
                        {(imageFile?.size / (1024 * 1024)).toFixed(2)} MB
                      </span>
                      <button
                        type="button"
                        className="btn-remove-photo"
                        onClick={removeImage}
                        disabled={formSubmitting}
                      >
                        Remove Photo
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="tenant-upload-dropzone">
                    <UploadIcon size={24} />
                    <span className="dropzone-text">Click to choose a photo</span>
                    <span className="dropzone-hint">
                      JPEG, PNG, or WebP up to 5 MB
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleImageChange}
                      style={{ display: "none" }}
                      disabled={formSubmitting}
                    />
                  </label>
                )}
              </div>

              <div className="tenant-modal-actions">
                <button
                  type="button"
                  className="tenant-btn-cancel"
                  onClick={() => setShowModal(false)}
                  disabled={formSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="tenant-btn-submit"
                  disabled={formSubmitting}
                >
                  {formSubmitting ? "Submitting Request..." : "Submit Complaint"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FULLSCREEN PHOTO LIGHTBOX MODAL */}
      {selectedImageModal && (
        <div
          className="tenant-modal-backdrop"
          onClick={() => setSelectedImageModal(null)}
        >
          <div
            className="tenant-lightbox-container"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="tenant-lightbox-close"
              onClick={() => setSelectedImageModal(null)}
            >
              <CloseIcon size={24} />
            </button>
            <img
              src={selectedImageModal}
              alt="Full size maintenance inspection"
              className="tenant-lightbox-img"
            />
          </div>
        </div>
      )}
    </TenantLayout>
  );
}

export default TenantMaintenance;
