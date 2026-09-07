import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import LandlordLayout from "../components/LandlordLayout";
import {
  ArrowLeftIcon,
  PlusIcon,
  HomeIcon,
  BuildingIcon,
  RupeeIcon,
  CheckIcon,
  WarningIcon,
  EditIcon,
  TrashIcon,
  CloseIcon,
  LayersIcon,
} from "../components/Icons";
import "./FloorDashboard.css";

const API_URL = "http://127.0.0.1:8000/api";

function FloorDashboard() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [floor, setFloor] = useState(null);
  const [units, setUnits] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const [showAddUnit, setShowAddUnit] = useState(false);
  const [unitToDelete, setUnitToDelete] = useState(null);
  const [unitToEdit, setUnitToEdit] = useState(null);

  const [form, setForm] = useState({
    unit_number: "",
    name: "",
    unit_type: "residential",
    status: "vacant",
    monthly_rent: "",
    area: "",
    description: "",
  });

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

    return fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });
  };

  const loadFloorData = async () => {
    setLoading(true);
    setError("");

    try {
      const floorResponse = await authenticatedFetch(`${API_URL}/floors/${id}/`);
      if (!floorResponse) return;

      if (floorResponse.status === 401) {
        logout();
        return;
      }

      const floorData = await floorResponse.json();
      if (!floorResponse.ok) {
        throw new Error(floorData.detail || "Unable to load floor.");
      }
      setFloor(floorData);

      const unitsResponse = await authenticatedFetch(`${API_URL}/units/`);
      if (!unitsResponse) return;

      if (unitsResponse.status === 401) {
        logout();
        return;
      }

      const unitsData = await unitsResponse.json();
      if (!unitsResponse.ok) {
        throw new Error(unitsData.detail || "Unable to load units.");
      }

      const floorUnits = Array.isArray(unitsData)
        ? unitsData.filter((unit) => Number(unit.floor) === Number(id))
        : [];

      setUnits(floorUnits);
    } catch (err) {
      console.error("Floor load error:", err);
      setError(err.message || "Unable to load floor information.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    if (!id) {
      setError("Floor ID is missing.");
      setLoading(false);
      return;
    }

    loadFloorData();
  }, [id]);

  const stats = useMemo(() => {
    const total = units.length;
    const occupied = units.filter((unit) => unit.status === "occupied").length;
    const vacant = units.filter((unit) => unit.status === "vacant").length;
    const maintenance = units.filter((unit) => unit.status === "maintenance").length;
    const inactive = units.filter((unit) => unit.status === "inactive").length;

    const expectedIncome = units
      .filter((unit) => unit.status !== "inactive")
      .reduce((total, unit) => total + Number(unit.monthly_rent || 0), 0);

    const occupancy = total > 0 ? Math.round((occupied / total) * 100) : 0;
    const vacantPct = total > 0 ? Math.round((vacant / total) * 100) : 0;
    const maintenancePct = total > 0 ? Math.round((maintenance / total) * 100) : 0;

    const residential = units.filter((unit) => unit.unit_type === "residential").length;
    const commercial = units.filter((unit) => unit.unit_type === "commercial").length;

    return {
      total,
      occupied,
      vacant,
      maintenance,
      inactive,
      expectedIncome,
      occupancy,
      vacantPct,
      maintenancePct,
      residential,
      commercial,
    };
  }, [units]);

  const resetForm = () => {
    setForm({
      unit_number: "",
      name: "",
      unit_type: "residential",
      status: "vacant",
      monthly_rent: "",
      area: "",
      description: "",
    });
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCreateUnit = async (event) => {
    event.preventDefault();
    setError("");

    if (!form.unit_number.trim()) {
      setError("Unit number is required.");
      return;
    }

    if (!form.name.trim()) {
      setError("Unit name is required.");
      return;
    }

    if (form.monthly_rent === "" || Number(form.monthly_rent) < 0) {
      setError("Enter a valid monthly rent.");
      return;
    }

    if (form.area === "" || Number(form.area) < 0) {
      setError("Enter a valid area in sq.ft.");
      return;
    }

    setSaving(true);

    try {
      const response = await authenticatedFetch(`${API_URL}/units/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          floor: Number(id),
          unit_number: form.unit_number.trim(),
          name: form.name.trim(),
          unit_type: form.unit_type,
          status: form.status,
          monthly_rent: Number(form.monthly_rent),
          area: Number(form.area),
          description: form.description.trim(),
        }),
      });

      if (!response) return;

      if (response.status === 401) {
        logout();
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        let message = "Unable to create unit.";
        if (data.detail) {
          message = data.detail;
        } else {
          const messages = Object.values(data).flat();
          if (messages.length > 0) message = messages[0];
        }
        throw new Error(message);
      }

      resetForm();
      setShowAddUnit(false);
      await loadFloorData();
    } catch (err) {
      console.error("Create unit error:", err);
      setError(err.message || "Unable to create unit.");
    } finally {
      setSaving(false);
    }
  };

  const openEditUnit = (unit) => {
    setError("");
    setForm({
      unit_number: unit.unit_number || "",
      name: unit.name || "",
      unit_type: unit.unit_type || "residential",
      status: unit.status || "vacant",
      monthly_rent: unit.monthly_rent ?? "",
      area: unit.area ?? "",
      description: unit.description || "",
    });
    setUnitToEdit(unit);
  };

  const handleUpdateUnit = async (event) => {
    event.preventDefault();
    if (!unitToEdit) return;

    setError("");

    if (!form.unit_number.trim()) {
      setError("Unit number is required.");
      return;
    }

    if (!form.name.trim()) {
      setError("Unit name is required.");
      return;
    }

    if (form.monthly_rent === "" || Number(form.monthly_rent) < 0) {
      setError("Enter a valid monthly rent.");
      return;
    }

    if (form.area === "" || Number(form.area) < 0) {
      setError("Enter a valid area in sq.ft.");
      return;
    }

    setSaving(true);

    try {
      const response = await authenticatedFetch(
        `${API_URL}/units/${unitToEdit.id}/`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            unit_number: form.unit_number.trim(),
            name: form.name.trim(),
            unit_type: form.unit_type,
            status: form.status,
            monthly_rent: Number(form.monthly_rent),
            area: Number(form.area),
            description: form.description.trim(),
          }),
        }
      );

      if (!response) return;

      if (response.status === 401) {
        logout();
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        let message = "Unable to update unit.";
        if (data.detail) {
          message = data.detail;
        } else {
          const messages = Object.values(data).flat();
          if (messages.length > 0) message = messages[0];
        }
        throw new Error(message);
      }

      setUnitToEdit(null);
      resetForm();
      await loadFloorData();
    } catch (err) {
      console.error("Update unit error:", err);
      setError(err.message || "Unable to update unit.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUnit = async () => {
    if (!unitToDelete) return;

    setDeleting(true);
    setError("");

    try {
      const response = await authenticatedFetch(
        `${API_URL}/units/${unitToDelete.id}/`,
        { method: "DELETE" }
      );

      if (!response) return;

      if (response.status === 401) {
        logout();
        return;
      }

      if (!response.ok) {
        let message = "Unable to delete unit.";
        try {
          const data = await response.json();
          if (data.detail) message = data.detail;
        } catch {
          // ignore non-json
        }
        throw new Error(message);
      }

      setUnitToDelete(null);
      await loadFloorData();
    } catch (err) {
      console.error("Delete unit error:", err);
      setError(err.message || "Unable to delete unit.");
    } finally {
      setDeleting(false);
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case "occupied":
        return "Occupied";
      case "vacant":
        return "Vacant";
      case "maintenance":
        return "Maintenance";
      case "inactive":
        return "Inactive";
      default:
        return status;
    }
  };

  const getUnitTypeLabel = (type) => {
    switch (type) {
      case "residential":
        return "Residential";
      case "commercial":
        return "Commercial";
      default:
        return type;
    }
  };

  if (loading) {
    return (
      <div className="floor-loading-state">
        <div className="floor-spinner"></div>
        <p>Loading floor details...</p>
      </div>
    );
  }

  if (!floor) {
    return (
      <div className="floor-error-container">
        <div className="floor-error-box">
          <div className="floor-error-icon">!</div>
          <h2>Floor not found</h2>
          <p>{error || "We could not locate this floor. It may have been deleted."}</p>
          <button
            className="floor-primary-btn"
            onClick={() => navigate("/landlord/buildings")}
          >
            <ArrowLeftIcon size={16} />
            <span>Back to Buildings</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <LandlordLayout
      breadcrumb={`Buildings / ${floor.building_name || "Building"} / Floor ${floor.floor_number}`}
      title={`Floor ${floor.floor_number}`}
      subtitle={`${floor.building_name || "Building"} • ${units.length} ${units.length === 1 ? "Unit" : "Units"}`}
      actions={
        <div className="floor-header-actions">
          <button
            className="floor-secondary-btn"
            onClick={() => navigate(`/landlord/buildings/${floor.building}`)}
          >
            <ArrowLeftIcon size={16} />
            <span>Back to Building</span>
          </button>
          <button
            className="floor-primary-btn"
            onClick={() => {
              setError("");
              resetForm();
              setUnitToEdit(null);
              setShowAddUnit(true);
            }}
          >
            <PlusIcon size={16} />
            <span>Add Unit</span>
          </button>
        </div>
      }
    >
      {/* ERROR ALERT */}
      {error && (
        <div className="floor-alert-banner">
          <div className="floor-alert-text">
            <WarningIcon size={18} />
            <span>{error}</span>
          </div>
          <button
            className="floor-alert-dismiss"
            onClick={() => setError("")}
            title="Dismiss error"
          >
            <CloseIcon size={16} />
          </button>
        </div>
      )}

      {/* TOP KPI STATS */}
      <section className="floor-kpi-grid">
        <div className="floor-kpi-card">
          <div className="floor-kpi-header">
            <span className="floor-kpi-title">Total Units</span>
            <div className="floor-kpi-icon blue">
              <LayersIcon size={18} />
            </div>
          </div>
          <div className="floor-kpi-value">{units.length}</div>
          <span className="floor-kpi-caption">Configured on this floor</span>
        </div>

        <div className="floor-kpi-card">
          <div className="floor-kpi-header">
            <span className="floor-kpi-title">Occupied</span>
            <div className="floor-kpi-icon green">
              <CheckIcon size={18} />
            </div>
          </div>
          <div className="floor-kpi-value green-text">{stats.occupied}</div>
          <span className="floor-kpi-caption">Currently tenanted</span>
        </div>

        <div className="floor-kpi-card">
          <div className="floor-kpi-header">
            <span className="floor-kpi-title">Vacant</span>
            <div className="floor-kpi-icon cyan">
              <HomeIcon size={18} />
            </div>
          </div>
          <div className="floor-kpi-value cyan-text">{stats.vacant}</div>
          <span className="floor-kpi-caption">Ready for leasing</span>
        </div>

        <div className="floor-kpi-card">
          <div className="floor-kpi-header">
            <span className="floor-kpi-title">Maintenance</span>
            <div className="floor-kpi-icon amber">
              <WarningIcon size={18} />
            </div>
          </div>
          <div className="floor-kpi-value amber-text">{stats.maintenance}</div>
          <span className="floor-kpi-caption">Under service</span>
        </div>

        <div className="floor-kpi-card">
          <div className="floor-kpi-header">
            <span className="floor-kpi-title">Occupancy Rate</span>
            <div className="floor-kpi-icon purple">
              <BuildingIcon size={18} />
            </div>
          </div>
          <div className="floor-kpi-value purple-text">{stats.occupancy}%</div>
          <span className="floor-kpi-caption">
            {stats.occupied} of {units.length || 1} units occupied
          </span>
        </div>

        <div className="floor-kpi-card highlight-income">
          <div className="floor-kpi-header">
            <span className="floor-kpi-title">Expected Income</span>
            <div className="floor-kpi-icon primary">
              <RupeeIcon size={18} />
            </div>
          </div>
          <div className="floor-kpi-value primary-text">
            ₹{stats.expectedIncome.toLocaleString("en-IN")}
          </div>
          <span className="floor-kpi-caption">Projected monthly rent</span>
        </div>
      </section>

      {/* OVERVIEW SECTION: OCCUPANCY & UNIT MIX */}
      <section className="floor-overview-row">
        {/* Occupancy Card */}
        <div className="floor-card">
          <div className="floor-card-top">
            <div>
              <span className="floor-card-tag">OCCUPANCY STATUS</span>
              <h3 className="floor-card-heading">Floor Utilization</h3>
            </div>
            <div className="floor-rate-badge">
              <span>{stats.occupancy}%</span>
            </div>
          </div>

          <div className="floor-progress-container">
            <div className="floor-progress-track">
              <div
                className="floor-progress-fill occupied"
                style={{ width: `${stats.occupancy}%` }}
                title={`Occupied: ${stats.occupancy}%`}
              />
              <div
                className="floor-progress-fill maintenance"
                style={{ width: `${stats.maintenancePct}%` }}
                title={`Maintenance: ${stats.maintenancePct}%`}
              />
            </div>
          </div>

          <div className="floor-legend-row">
            <div className="legend-item">
              <span className="legend-dot green"></span>
              <span className="legend-label">Occupied</span>
              <strong className="legend-count">{stats.occupied}</strong>
            </div>
            <div className="legend-item">
              <span className="legend-dot blue"></span>
              <span className="legend-label">Vacant</span>
              <strong className="legend-count">{stats.vacant}</strong>
            </div>
            <div className="legend-item">
              <span className="legend-dot amber"></span>
              <span className="legend-label">Maintenance</span>
              <strong className="legend-count">{stats.maintenance}</strong>
            </div>
          </div>
        </div>

        {/* Unit Mix Card */}
        <div className="floor-card">
          <div className="floor-card-top">
            <div>
              <span className="floor-card-tag">UNIT TYPES</span>
              <h3 className="floor-card-heading">Property Category Mix</h3>
            </div>
            <div className="floor-total-pill">
              {units.length} {units.length === 1 ? "Unit" : "Total Units"}
            </div>
          </div>

          <div className="unit-category-grid">
            <div className="category-card">
              <div className="category-icon residential">
                <HomeIcon size={20} />
              </div>
              <div className="category-info">
                <span className="category-label">Residential</span>
                <strong className="category-count">{stats.residential}</strong>
              </div>
              <div className="category-pct">
                {units.length > 0
                  ? Math.round((stats.residential / units.length) * 100)
                  : 0}
                %
              </div>
            </div>

            <div className="category-card">
              <div className="category-icon commercial">
                <BuildingIcon size={20} />
              </div>
              <div className="category-info">
                <span className="category-label">Commercial</span>
                <strong className="category-count">{stats.commercial}</strong>
              </div>
              <div className="category-pct">
                {units.length > 0
                  ? Math.round((stats.commercial / units.length) * 100)
                  : 0}
                %
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* UNITS LIST SECTION */}
      <section className="floor-units-panel">
        <div className="floor-units-header">
          <div>
            <div className="floor-section-label">UNITS DIRECTORY</div>
            <h2 className="floor-section-title">Units on Floor {floor.floor_number}</h2>
          </div>
          <button
            className="floor-primary-btn compact"
            onClick={() => {
              setError("");
              resetForm();
              setUnitToEdit(null);
              setShowAddUnit(true);
            }}
          >
            <PlusIcon size={15} />
            <span>Add Unit</span>
          </button>
        </div>

        {units.length === 0 ? (
          <div className="floor-empty-state">
            <div className="floor-empty-icon-wrap">
              <HomeIcon size={32} />
            </div>
            <h3>No units created yet</h3>
            <p>
              Get started by adding your first residential or commercial unit to
              Floor {floor.floor_number}.
            </p>
            <button
              className="floor-primary-btn"
              onClick={() => {
                setError("");
                resetForm();
                setUnitToEdit(null);
                setShowAddUnit(true);
              }}
            >
              <PlusIcon size={16} />
              <span>Add First Unit</span>
            </button>
          </div>
        ) : (
          <div className="floor-table-wrapper">
            <table className="floor-table">
              <thead>
                <tr>
                  <th>Unit</th>
                  <th>Type</th>
                  <th>Monthly Rent</th>
                  <th>Area</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {units.map((unit) => (
                  <tr key={unit.id} className="floor-table-row">
                    <td>
                      <div className="unit-cell-main">
                        <div
                          className={`unit-badge-icon ${unit.unit_type === "commercial" ? "commercial" : "residential"}`}
                        >
                          {unit.unit_type === "commercial" ? (
                            <BuildingIcon size={18} />
                          ) : (
                            <HomeIcon size={18} />
                          )}
                        </div>
                        <div className="unit-names">
                          <div className="unit-top-name">
                            <span className="unit-code">{unit.unit_number}</span>
                            <span className="unit-primary-name">{unit.name}</span>
                          </div>
                          {unit.description && (
                            <div className="unit-desc" title={unit.description}>
                              {unit.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    <td>
                      <span
                        className={`unit-type-pill ${unit.unit_type === "commercial" ? "commercial" : "residential"}`}
                      >
                        {unit.unit_type === "commercial" ? (
                          <BuildingIcon size={13} />
                        ) : (
                          <HomeIcon size={13} />
                        )}
                        <span>{getUnitTypeLabel(unit.unit_type)}</span>
                      </span>
                    </td>

                    <td>
                      <span className="unit-rent-value">
                        ₹{Number(unit.monthly_rent || 0).toLocaleString("en-IN")}
                      </span>
                      <span className="unit-rent-period"> / mo</span>
                    </td>

                    <td>
                      <span className="unit-area-pill">
                        {unit.area || 0} sq.ft
                      </span>
                    </td>

                    <td>
                      <span className={`unit-status-badge ${unit.status || "vacant"}`}>
                        <span className="status-dot"></span>
                        {getStatusLabel(unit.status)}
                      </span>
                    </td>

                    <td>
                      <div className="unit-actions-row">
                        <button
                          className="unit-btn-edit"
                          onClick={() => openEditUnit(unit)}
                          title="Edit unit"
                        >
                          <EditIcon size={14} />
                          <span>Edit</span>
                        </button>
                        <button
                          className="unit-btn-delete"
                          onClick={() => setUnitToDelete(unit)}
                          title="Delete unit"
                        >
                          <TrashIcon size={14} />
                          <span>Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ADD / EDIT UNIT MODAL */}
      {(showAddUnit || unitToEdit) && (
        <div
          className="floor-modal-backdrop"
          onClick={() => {
            if (!saving) {
              setShowAddUnit(false);
              setUnitToEdit(null);
              resetForm();
            }
          }}
        >
          <div
            className="floor-modal-card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="floor-modal-header">
              <div className="floor-modal-title-box">
                <div className="floor-modal-icon">
                  {unitToEdit ? <EditIcon size={20} /> : <PlusIcon size={20} />}
                </div>
                <div>
                  <h3>
                    {unitToEdit
                      ? `Edit Unit (${unitToEdit.unit_number})`
                      : "Add New Unit"}
                  </h3>
                  <p>
                    Floor {floor.floor_number} • {floor.building_name || "Building"}
                  </p>
                </div>
              </div>
              <button
                className="floor-modal-close-btn"
                onClick={() => {
                  setShowAddUnit(false);
                  setUnitToEdit(null);
                  resetForm();
                }}
                disabled={saving}
                title="Close modal"
              >
                <CloseIcon size={18} />
              </button>
            </div>

            <form
              className="floor-modal-form"
              onSubmit={unitToEdit ? handleUpdateUnit : handleCreateUnit}
            >
              <div className="form-grid-2">
                <div className="form-field-group">
                  <label htmlFor="unit_number">
                    Unit Number <span className="req">*</span>
                  </label>
                  <input
                    id="unit_number"
                    name="unit_number"
                    value={form.unit_number}
                    onChange={handleChange}
                    placeholder="e.g. 101, F1-A"
                    disabled={saving}
                    required
                  />
                </div>

                <div className="form-field-group">
                  <label htmlFor="name">
                    Unit Name / Label <span className="req">*</span>
                  </label>
                  <input
                    id="name"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="e.g. Apartment 101, Studio"
                    disabled={saving}
                    required
                  />
                </div>

                <div className="form-field-group">
                  <label htmlFor="unit_type">Unit Type</label>
                  <select
                    id="unit_type"
                    name="unit_type"
                    value={form.unit_type}
                    onChange={handleChange}
                    disabled={saving}
                  >
                    <option value="residential">Residential</option>
                    <option value="commercial">Commercial</option>
                  </select>
                </div>

                <div className="form-field-group">
                  <label htmlFor="status">Initial Status</label>
                  <select
                    id="status"
                    name="status"
                    value={form.status}
                    onChange={handleChange}
                    disabled={saving}
                  >
                    <option value="vacant">Vacant</option>
                    <option value="occupied">Occupied</option>
                    <option value="maintenance">Under Maintenance</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                <div className="form-field-group">
                  <label htmlFor="monthly_rent">
                    Monthly Rent (₹) <span className="req">*</span>
                  </label>
                  <div className="input-with-affix">
                    <span className="input-affix">₹</span>
                    <input
                      id="monthly_rent"
                      type="number"
                      min="0"
                      name="monthly_rent"
                      value={form.monthly_rent}
                      onChange={handleChange}
                      placeholder="15000"
                      disabled={saving}
                      required
                    />
                  </div>
                </div>

                <div className="form-field-group">
                  <label htmlFor="area">
                    Area (sq.ft) <span className="req">*</span>
                  </label>
                  <div className="input-with-affix">
                    <input
                      id="area"
                      type="number"
                      min="0"
                      name="area"
                      value={form.area}
                      onChange={handleChange}
                      placeholder="850"
                      disabled={saving}
                      required
                    />
                    <span className="input-affix-right">sq.ft</span>
                  </div>
                </div>

                <div className="form-field-group full-width">
                  <label htmlFor="description">Description & Notes</label>
                  <textarea
                    id="description"
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    placeholder="Optional notes, furnish details, balcony view, etc."
                    rows="3"
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="floor-modal-footer">
                <button
                  type="button"
                  className="floor-secondary-btn"
                  onClick={() => {
                    setShowAddUnit(false);
                    setUnitToEdit(null);
                    resetForm();
                  }}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="floor-primary-btn"
                  disabled={saving}
                >
                  {saving ? (
                    <span>Saving...</span>
                  ) : unitToEdit ? (
                    <span>Save Changes</span>
                  ) : (
                    <>
                      <PlusIcon size={16} />
                      <span>Add Unit</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {unitToDelete && (
        <div
          className="floor-modal-backdrop"
          onClick={() => {
            if (!deleting) setUnitToDelete(null);
          }}
        >
          <div
            className="floor-delete-dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="floor-delete-icon-wrap">
              <WarningIcon size={28} />
            </div>
            <h3>Delete Unit?</h3>
            <p>
              Are you sure you want to delete unit{" "}
              <strong>"{unitToDelete.name}"</strong> (
              <span className="delete-unit-tag">{unitToDelete.unit_number}</span>
              )?
            </p>
            <div className="delete-warning-note">
              This action cannot be undone. All active lease connections, tenant
              assignments, or logs associated with this unit may be affected.
            </div>
            <div className="floor-delete-actions">
              <button
                className="floor-secondary-btn"
                onClick={() => setUnitToDelete(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="floor-danger-btn"
                onClick={handleDeleteUnit}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete Unit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </LandlordLayout>
  );
}

export default FloorDashboard;