import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import LandlordLayout from "../components/LandlordLayout";
import { BuildingIcon, PlusIcon } from "../components/Icons";
import "./Buildings.css";

import { API_URL } from "../api";
import {
  sanitizeAlpha,
  sanitizeNumeric,
  sanitizeCode,
  isValidPhone,
  isValidPincode,
  isValidIFSC,
  isValidGSTIN,
  preventNumberSpill,
} from "../utils/validators";

function Buildings() {
  const navigate = useNavigate();

  const [buildings, setBuildings] = useState([]);
  const [floors, setFloors] = useState([]);
  const [units, setUnits] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [buildingToEdit, setBuildingToEdit] = useState(null);
  const [buildingToDelete, setBuildingToDelete] = useState(null);

  const [invoiceTemplateBuilding, setInvoiceTemplateBuilding] =
    useState(null);
  const [invoiceTemplateId, setInvoiceTemplateId] =
    useState(null);
  const [invoiceTemplateLoading, setInvoiceTemplateLoading] =
    useState(false);
  const [invoiceTemplateSaving, setInvoiceTemplateSaving] =
    useState(false);
  const [invoiceTemplateError, setInvoiceTemplateError] =
    useState("");
  const [invoiceTemplate, setInvoiceTemplate] = useState({
    business_name: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    phone: "",
    email: "",
    gstin: "",
    bank_name: "",
    account_number: "",
    ifsc: "",
    branch: "",
    payment_instructions: "",
    due_day: 7,
    upi_id: "",
    logo: null,
    signature: null,
    upi_qr_code: null,
    logo_url: null,
    signature_url: null,
    upi_qr_code_url: null,
  });

  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    number_of_floors: 1,
    description: "",
  });

  const token = localStorage.getItem("access_token");

  const logout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");

    navigate("/login", {
      replace: true,
    });
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

  const loadData = async () => {
    setLoading(true);
    setError("");

    try {
      const [
        buildingsResponse,
        floorsResponse,
        unitsResponse,
      ] = await Promise.all([
        authenticatedFetch(`${API_URL}/buildings/`),
        authenticatedFetch(`${API_URL}/floors/`),
        authenticatedFetch(`${API_URL}/units/`),
      ]);

      if (
        !buildingsResponse ||
        !floorsResponse ||
        !unitsResponse
      ) {
        return;
      }

      if (
        buildingsResponse.status === 401 ||
        floorsResponse.status === 401 ||
        unitsResponse.status === 401
      ) {
        logout();
        return;
      }

      const buildingsData =
        await buildingsResponse.json();

      const floorsData =
        await floorsResponse.json();

      const unitsData =
        await unitsResponse.json();

      if (!buildingsResponse.ok) {
        throw new Error(
          buildingsData.detail ||
            "Unable to load buildings."
        );
      }

      if (!floorsResponse.ok) {
        throw new Error(
          floorsData.detail ||
            "Unable to load floors."
        );
      }

      if (!unitsResponse.ok) {
        throw new Error(
          unitsData.detail ||
            "Unable to load units."
        );
      }

      setBuildings(
        Array.isArray(buildingsData)
          ? buildingsData
          : []
      );

      setFloors(
        Array.isArray(floorsData)
          ? floorsData
          : []
      );

      setUnits(
        Array.isArray(unitsData)
          ? unitsData
          : []
      );
    } catch (err) {
      console.error(
        "Buildings load error:",
        err
      );

      setError(
        err.message ||
          "Unable to load building information."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      navigate("/login", {
        replace: true,
      });
      return;
    }

    loadData();
  }, []);

  const getBuildingStats = (buildingId) => {
    const buildingFloors = floors.filter(
      (floor) =>
        Number(floor.building) ===
        Number(buildingId)
    );

    const floorIds = new Set(
      buildingFloors.map(
        (floor) => Number(floor.id)
      )
    );

    const buildingUnits = units.filter(
      (unit) =>
        floorIds.has(
          Number(unit.floor)
        )
    );

    const totalUnits =
      buildingUnits.length;

    const occupied =
      buildingUnits.filter(
        (unit) =>
          unit.status === "occupied"
      ).length;

    const vacant =
      buildingUnits.filter(
        (unit) =>
          unit.status === "vacant"
      ).length;

    const maintenance =
      buildingUnits.filter(
        (unit) =>
          unit.status === "maintenance"
      ).length;

    const inactive =
      buildingUnits.filter(
        (unit) =>
          unit.status === "inactive"
      ).length;

    const expectedIncome =
      buildingUnits
        .filter(
          (unit) =>
            unit.status !== "inactive"
        )
        .reduce(
          (total, unit) =>
            total +
            Number(
              unit.monthly_rent || 0
            ),
          0
        );

    const occupancy =
      totalUnits > 0
        ? Math.round(
            (occupied /
              totalUnits) *
              100
          )
        : 0;

    return {
      floors: buildingFloors.length,
      totalUnits,
      occupied,
      vacant,
      maintenance,
      inactive,
      expectedIncome,
      occupancy,
    };
  };

  const buildingStats = useMemo(() => {
    const result = {};

    buildings.forEach(
      (building) => {
        result[building.id] =
          getBuildingStats(
            building.id
          );
      }
    );

    return result;
  }, [
    buildings,
    floors,
    units,
  ]);

  const resetForm = () => {
    setForm({
      name: "",
      address: "",
      city: "",
      state: "",
      pincode: "",
      number_of_floors: 1,
      description: "",
    });
  };

  const closeForm = () => {
    if (saving) {
      return;
    }

    setShowForm(false);
    setBuildingToEdit(null);
    resetForm();
  };

  const handleChange = (event) => {
    const {
      name,
      value,
    } = event.target;

    let sanitizedValue = value;

    if (name === "city" || name === "state") {
      sanitizedValue = sanitizeAlpha(value, 50);
    } else if (name === "pincode") {
      sanitizedValue = sanitizeNumeric(value, 6);
    } else if (name === "number_of_floors") {
      sanitizedValue = value === "" ? "" : Math.max(1, parseInt(sanitizeNumeric(value, 3), 10) || 1);
    }

    setForm((previous) => ({
      ...previous,
      [name]: sanitizedValue,
    }));
  };

  const openCreateForm = () => {
    setError("");
    resetForm();
    setBuildingToEdit(null);
    setShowForm(true);
  };

  const openEditForm = (building) => {
    setError("");

    setForm({
      name: building.name || "",
      address: building.address || "",
      city: building.city || "",
      state: building.state || "",
      pincode: building.pincode || "",
      number_of_floors:
        building.number_of_floors || 1,
      description:
        building.description || "",
    });

    setBuildingToEdit(building);
    setShowForm(false);
  };

  const handleCreateBuilding = async (
    event
  ) => {
    event.preventDefault();

    setError("");

    const floorCount = Number(
      form.number_of_floors
    );

    if (!form.name.trim()) {
      setError(
        "Building name is required."
      );
      return;
    }

    if (!form.address.trim()) {
      setError(
        "Building address is required."
      );
      return;
    }

    if (!form.city.trim()) {
      setError(
        "City is required."
      );
      return;
    }

    if (!/^[A-Za-z\s.'-]+$/.test(form.city.trim())) {
      setError(
        "City can contain letters, spaces, periods, apostrophes and hyphens only."
      );
      return;
    }

    if (!form.state.trim()) {
      setError(
        "State is required."
      );
      return;
    }

    if (!/^[A-Za-z\s.'-]+$/.test(form.state.trim())) {
      setError(
        "State can contain letters, spaces, periods, apostrophes and hyphens only."
      );
      return;
    }

    if (!isValidPincode(form.pincode)) {
      setError(
        "Pincode must contain exactly 6 digits."
      );
      return;
    }

    if (
      !Number.isInteger(floorCount) ||
      floorCount < 1
    ) {
      setError(
        "Number of floors must be at least 1."
      );
      return;
    }

    setSaving(true);

    try {
      const response =
        await authenticatedFetch(
          `${API_URL}/buildings/`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              name: form.name.trim(),
              address:
                form.address.trim(),
              city:
                form.city.trim(),
              state:
                form.state.trim(),
              pincode:
                form.pincode.trim(),
              number_of_floors:
                floorCount,
              description:
                form.description.trim(),
            }),
          }
        );

      if (!response) {
        return;
      }

      if (response.status === 401) {
        logout();
        return;
      }

      const data =
        await response.json();

      if (!response.ok) {
        let message =
          "Unable to create building.";

        if (data.detail) {
          message =
            data.detail;
        } else {
          const messages =
            Object.values(data).flat();

          if (messages.length > 0) {
            message =
              messages[0];
          }
        }

        throw new Error(message);
      }

      closeForm();

      await loadData();
    } catch (err) {
      console.error(
        "Create building error:",
        err
      );

      setError(
        err.message ||
          "Unable to create building."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateBuilding = async (
    event
  ) => {
    event.preventDefault();

    if (!buildingToEdit) {
      return;
    }

    setError("");

    const floorCount = Number(
      form.number_of_floors
    );

    if (!form.name.trim()) {
      setError(
        "Building name is required."
      );
      return;
    }

    if (!form.address.trim()) {
      setError(
        "Building address is required."
      );
      return;
    }

    if (!form.city.trim()) {
      setError(
        "City is required."
      );
      return;
    }

    if (!/^[A-Za-z\s.'-]+$/.test(form.city.trim())) {
      setError(
        "City can contain letters, spaces, periods, apostrophes and hyphens only."
      );
      return;
    }

    if (!form.state.trim()) {
      setError(
        "State is required."
      );
      return;
    }

    if (!/^[A-Za-z\s.'-]+$/.test(form.state.trim())) {
      setError(
        "State can contain letters, spaces, periods, apostrophes and hyphens only."
      );
      return;
    }

    if (!isValidPincode(form.pincode)) {
      setError(
        "Pincode must contain exactly 6 digits."
      );
      return;
    }

    if (
      !Number.isInteger(floorCount) ||
      floorCount < 1
    ) {
      setError(
        "Number of floors must be at least 1."
      );
      return;
    }

    const currentFloorCount =
      Number(
        buildingToEdit.number_of_floors ||
          1
      );

    if (floorCount < currentFloorCount) {
      const hasUnitsOnRemovedFloors =
        floors.some((floor) => {
          const floorNumber =
            Number(
              floor.floor_number
            );

          if (
            Number(floor.building) !==
            Number(
              buildingToEdit.id
            )
          ) {
            return false;
          }

          if (
            floorNumber <
            floorCount
          ) {
            return false;
          }

          return units.some(
            (unit) =>
              Number(unit.floor) ===
              Number(floor.id)
          );
        });

      if (hasUnitsOnRemovedFloors) {
        setError(
          "You cannot reduce the number of floors because one or more of the floors you are removing contain units."
        );
        return;
      }
    }

    setSaving(true);

    try {
      const response =
        await authenticatedFetch(
          `${API_URL}/buildings/${buildingToEdit.id}/`,
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              name: form.name.trim(),
              address:
                form.address.trim(),
              city:
                form.city.trim(),
              state:
                form.state.trim(),
              pincode:
                form.pincode.trim(),
              number_of_floors:
                floorCount,
              description:
                form.description.trim(),
            }),
          }
        );

      if (!response) {
        return;
      }

      if (response.status === 401) {
        logout();
        return;
      }

      const data =
        await response.json();

      if (!response.ok) {
        let message =
          "Unable to update building.";

        if (data.detail) {
          message =
            data.detail;
        } else {
          const messages =
            Object.values(data).flat();

          if (messages.length > 0) {
            message =
              messages[0];
          }
        }

        throw new Error(message);
      }

      setBuildingToEdit(null);
      resetForm();

      await loadData();
    } catch (err) {
      console.error(
        "Update building error:",
        err
      );

      setError(
        err.message ||
          "Unable to update building."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBuilding =
    async () => {
      if (!buildingToDelete) {
        return;
      }

      setDeleting(true);
      setError("");

      try {
        const response =
          await authenticatedFetch(
            `${API_URL}/buildings/${buildingToDelete.id}/`,
            {
              method: "DELETE",
            }
          );

        if (!response) {
          return;
        }

        if (response.status === 401) {
          logout();
          return;
        }

        if (!response.ok) {
          let message =
            "Unable to delete this building.";

          try {
            const data =
              await response.json();

            if (data.detail) {
              message =
                data.detail;
            }
          } catch {
            // Ignore invalid JSON.
          }

          throw new Error(message);
        }

        setBuildingToDelete(null);

        await loadData();
      } catch (err) {
        console.error(
          "Delete building error:",
          err
        );

        setError(
          err.message ||
            "Unable to delete this building."
        );
      } finally {
        setDeleting(false);
      }
    };

  const resetInvoiceTemplate = () => {
    setInvoiceTemplateId(null);
    setInvoiceTemplate({
      business_name: "",
      address: "",
      city: "",
      state: "",
      pincode: "",
      phone: "",
      email: "",
      gstin: "",
      bank_name: "",
      account_number: "",
      ifsc: "",
      branch: "",
      payment_instructions: "",
      due_day: 7,
      upi_id: "",
      logo: null,
      signature: null,
      upi_qr_code: null,
      logo_url: null,
      signature_url: null,
      upi_qr_code_url: null,
    });
  };

  const closeInvoiceTemplate = () => {
    if (invoiceTemplateSaving) {
      return;
    }

    setInvoiceTemplateBuilding(null);
    setInvoiceTemplateError("");
    resetInvoiceTemplate();
  };

  const handleInvoiceTemplateChange = (event) => {
    const { name, value, files, type } = event.target;

    if (type === "file") {
      setInvoiceTemplate((previous) => ({
        ...previous,
        [name]: files?.[0] || null,
      }));
      return;
    }

    let sanitizedValue = value;
    if (name === "city" || name === "state" || name === "bank_name" || name === "branch") {
      sanitizedValue = sanitizeAlpha(value, 50);
    } else if (name === "pincode") {
      sanitizedValue = sanitizeNumeric(value, 6);
    } else if (name === "phone") {
      sanitizedValue = sanitizeNumeric(value, 10);
    } else if (name === "account_number") {
      sanitizedValue = sanitizeNumeric(value, 18);
    } else if (name === "ifsc") {
      sanitizedValue = sanitizeCode(value, 11);
    } else if (name === "gstin") {
      sanitizedValue = sanitizeCode(value, 15);
    } else if (name === "due_day") {
      sanitizedValue = sanitizeNumeric(value, 2);
    }

    setInvoiceTemplate((previous) => ({
      ...previous,
      [name]: sanitizedValue,
    }));
  };

  const openInvoiceTemplate = async (building) => {
    setError("");
    setInvoiceTemplateError("");
    setInvoiceTemplateBuilding(building);
    setInvoiceTemplateLoading(true);
    resetInvoiceTemplate();

    try {
      const response = await authenticatedFetch(
        `${API_URL}/invoice-settings/`
      );

      if (!response) {
        return;
      }

      if (response.status === 401) {
        logout();
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        let message = "Unable to load invoice template.";

        if (data.detail) {
          message = data.detail;
        } else {
          const messages = Object.values(data).flat();
          if (messages.length > 0) {
            message = messages[0];
          }
        }

        throw new Error(message);
      }

      const settingsList = Array.isArray(data)
        ? data
        : Array.isArray(data.results)
        ? data.results
        : [];

      const existing = settingsList.find(
        (settings) =>
          Number(settings.building) === Number(building.id)
      );

      if (existing) {
        setInvoiceTemplateId(existing.id);
        setInvoiceTemplate({
          business_name: existing.business_name || "",
          address: existing.address || "",
          city: existing.city || "",
          state: existing.state || "",
          pincode: existing.pincode || "",
          phone: existing.phone || "",
          email: existing.email || "",
          gstin: existing.gstin || "",
          bank_name: existing.bank_name || "",
          account_number: existing.account_number || "",
          ifsc: existing.ifsc || "",
          branch: existing.branch || "",
          payment_instructions:
            existing.payment_instructions || "",
          due_day: existing.due_day || 7,
          upi_id: existing.upi_id || "",
          logo: null,
          signature: null,
          upi_qr_code: null,
          logo_url: existing.logo_url || null,
          signature_url:
            existing.signature_url || null,
          upi_qr_code_url:
            existing.upi_qr_code_url || null,
        });
      }
    } catch (err) {
      console.error(
        "Invoice template load error:",
        err
      );

      setInvoiceTemplateError(
        err.message ||
          "Unable to load invoice template."
      );
    } finally {
      setInvoiceTemplateLoading(false);
    }
  };

  const handleSaveInvoiceTemplate = async (event) => {
    event.preventDefault();

    if (!invoiceTemplateBuilding) {
      return;
    }

    setInvoiceTemplateError("");

    const dueDay = Number(invoiceTemplate.due_day);

    if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
      setInvoiceTemplateError(
        "Invoice due day must be a whole number between 1 and 31."
      );
      return;
    }

    if (invoiceTemplate.pincode && !isValidPincode(invoiceTemplate.pincode)) {
      setInvoiceTemplateError("Pincode must be exactly 6 digits.");
      return;
    }

    if (invoiceTemplate.phone && !isValidPhone(invoiceTemplate.phone)) {
      setInvoiceTemplateError("Phone number must be a valid 10-digit mobile number.");
      return;
    }

    if (invoiceTemplate.account_number && (invoiceTemplate.account_number.length < 9 || invoiceTemplate.account_number.length > 18)) {
      setInvoiceTemplateError("Account number must be between 9 and 18 digits.");
      return;
    }

    if (invoiceTemplate.ifsc && !isValidIFSC(invoiceTemplate.ifsc)) {
      setInvoiceTemplateError("Please enter a valid 11-character IFSC code (e.g. HDFC0001234).");
      return;
    }

    if (invoiceTemplate.gstin && !isValidGSTIN(invoiceTemplate.gstin)) {
      setInvoiceTemplateError("Please enter a valid 15-character GSTIN number.");
      return;
    }

    setInvoiceTemplateSaving(true);

    try {
      const formData = new FormData();

      formData.append(
        "building",
        String(invoiceTemplateBuilding.id)
      );

      const textFields = [
        "business_name",
        "address",
        "city",
        "state",
        "pincode",
        "phone",
        "email",
        "gstin",
        "bank_name",
        "account_number",
        "ifsc",
        "branch",
        "payment_instructions",
      ];

      textFields.forEach((field) => {
        formData.append(
          field,
          invoiceTemplate[field] || ""
        );
      });

      formData.append("due_day", String(dueDay));

      if (invoiceTemplate.logo instanceof File) {
        formData.append("logo", invoiceTemplate.logo);
      }

      if (
        invoiceTemplate.signature instanceof File
      ) {
        formData.append(
          "signature",
          invoiceTemplate.signature
        );
      }

      if (
        invoiceTemplate.upi_qr_code instanceof File
      ) {
        formData.append(
          "upi_qr_code",
          invoiceTemplate.upi_qr_code
        );
      }

      const endpoint = invoiceTemplateId
        ? `${API_URL}/invoice-settings/${invoiceTemplateId}/`
        : `${API_URL}/invoice-settings/`;

      const response = await authenticatedFetch(
        endpoint,
        {
          method: invoiceTemplateId
            ? "PATCH"
            : "POST",
          body: formData,
        }
      );

      if (!response) {
        return;
      }

      if (response.status === 401) {
        logout();
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        let message =
          "Unable to save invoice template.";

        if (data.detail) {
          message = data.detail;
        } else {
          const messages = Object.values(data).flat();
          if (messages.length > 0) {
            message = messages[0];
          }
        }

        throw new Error(message);
      }

      setInvoiceTemplateId(data.id);
      setInvoiceTemplate({
        business_name: data.business_name || "",
        address: data.address || "",
        city: data.city || "",
        state: data.state || "",
        pincode: data.pincode || "",
        phone: data.phone || "",
        email: data.email || "",
        gstin: data.gstin || "",
        bank_name: data.bank_name || "",
        account_number: data.account_number || "",
        ifsc: data.ifsc || "",
        branch: data.branch || "",
        payment_instructions:
          data.payment_instructions || "",
        due_day: data.due_day || 7,
        upi_id: data.upi_id || "",
        logo: null,
        signature: null,
        upi_qr_code: null,
        logo_url: data.logo_url || null,
        signature_url:
          data.signature_url || null,
        upi_qr_code_url:
          data.upi_qr_code_url || null,
      });

      closeInvoiceTemplate();
    } catch (err) {
      console.error(
        "Save invoice template error:",
        err
      );

      setInvoiceTemplateError(
        err.message ||
          "Unable to save invoice template."
      );
    } finally {
      setInvoiceTemplateSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="buildings-loading">

        <div className="buildings-spinner"></div>

        <p>
          Loading your buildings...
        </p>

      </div>
    );
  }

  return (
    <LandlordLayout
      breadcrumb="Buildings"
      title="My Buildings"
      subtitle="Manage your buildings, floors and rental units from one place."
      actions={
        <button
          className="primary-button"
          onClick={openCreateForm}
        >
          <PlusIcon size={16} />
          <span>Add Building</span>
        </button>
      }
    >


      {/* =====================================
          ERROR
      ====================================== */}

      {error && (
        <div className="buildings-error">

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


      {/* =====================================
          BUILDINGS
      ====================================== */}

      {buildings.length === 0 ? (

        <section className="no-buildings">

          <div className="no-buildings-icon">
            <BuildingIcon size={32} />
          </div>

          <h2>
            No buildings yet
          </h2>

          <p>
            Create your first building
            to start managing floors,
            apartments, shops and
            offices.
          </p>

          <button
            className="primary-button"
            onClick={
              openCreateForm
            }
          >
            + Add Your First Building
          </button>

        </section>

      ) : (

        <section className="building-grid">

          {buildings.map(
            (building) => {

              const stats =
                buildingStats[
                  building.id
                ] || {
                  floors: 0,
                  totalUnits: 0,
                  occupied: 0,
                  vacant: 0,
                  maintenance: 0,
                  inactive: 0,
                  expectedIncome: 0,
                  occupancy: 0,
                };

              return (
                <article
                  className="building-card"
                  key={building.id}
                >

                  <div className="building-card-image">
                    <BuildingIcon size={44} />
                  </div>

                  <div className="building-card-content">

                    {/* TITLE */}

                    <div className="building-heading-row">

                      <div>

                        <h2>
                          {building.name}
                        </h2>

                        <p>
                          {building.city}
                          {building.state
                            ? `, ${building.state}`
                            : ""}
                        </p>

                      </div>

                      <span className="building-status">
                        Active
                      </span>

                    </div>


                    {/* ADDRESS */}

                    <p className="building-address">
                      {building.address}

                      {building.pincode
                        ? ` - ${building.pincode}`
                        : ""}
                    </p>


                    {/* STATS */}

                    <div className="building-stats">

                      <div>

                        <span>
                          Floors
                        </span>

                        <strong>
                          {stats.floors}
                        </strong>

                      </div>

                      <div>

                        <span>
                          Total Units
                        </span>

                        <strong>
                          {stats.totalUnits}
                        </strong>

                      </div>

                      <div>

                        <span>
                          Occupancy
                        </span>

                        <strong>
                          {stats.occupancy}%
                        </strong>

                      </div>

                    </div>


                    {/* INCOME */}

                    <div className="building-income">

                      <div>

                        <span>
                          Expected Monthly Income
                        </span>

                        <strong>
                          ₹
                          {stats.expectedIncome.toLocaleString(
                            "en-IN"
                          )}
                        </strong>

                      </div>

                      <div className="income-breakdown">

                        <span className="occupied-text">
                          {stats.occupied}
                          {" "}
                          occupied
                        </span>

                        <span className="vacant-text">
                          {stats.vacant}
                          {" "}
                          vacant
                        </span>

                        {stats.maintenance >
                          0 && (
                          <span className="maintenance-text">
                            {
                              stats.maintenance
                            }{" "}
                            maintenance
                          </span>
                        )}

                      </div>

                    </div>


                    {/* ACTIONS */}

                    <div className="building-footer">

                      <button
                        className="view-building-button"
                        onClick={() =>
                          navigate(
                            `/landlord/buildings/${building.id}`
                          )
                        }
                      >
                        View Building →
                      </button>

                      <div className="building-card-actions">

                        <button
                          className="edit-building-button"
                          onClick={() =>
                            openEditForm(
                              building
                            )
                          }
                        >
                          Edit
                        </button>

                        <button
                          className="invoice-template-button"
                          onClick={() =>
                            openInvoiceTemplate(
                              building
                            )
                          }
                        >
                          Invoice Template
                        </button>

                        <button
                          className="delete-building-button"
                          onClick={() => {
                            setError("");
                            setBuildingToDelete(
                              building
                            );
                          }}
                        >
                          Delete
                        </button>

                      </div>

                    </div>

                  </div>

                </article>
              );
            }
          )}

        </section>
      )}


      {/* =====================================
          ADD / EDIT BUILDING MODAL
      ====================================== */}

      {(showForm || buildingToEdit) && (

        <div
          className="modal-overlay"
          onClick={() => {
            if (!saving) {
              closeForm();
            }
          }}
        >

          <div
            className="building-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            <div className="modal-header">

              <div>

                <span className="modal-label">
                  {buildingToEdit
                    ? "EDIT BUILDING"
                    : "NEW BUILDING"}
                </span>

                <h2>
                  {buildingToEdit
                    ? "Edit Building"
                    : "Add Building"}
                </h2>

                <p>
                  {buildingToEdit
                    ? "Update your building information."
                    : "Floor numbers will automatically start from Floor 0."}
                </p>

              </div>

              <button
                className="modal-close"
                onClick={closeForm}
                disabled={saving}
              >
                ×
              </button>

            </div>


            <form
              className="building-form"
              onSubmit={
                buildingToEdit
                  ? handleUpdateBuilding
                  : handleCreateBuilding
              }
            >

              {/* NAME */}

              <div className="form-group full">

                <label>
                  Building Name
                </label>

                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Green Valley Apartments"
                  disabled={saving}
                  required
                />

              </div>


              {/* ADDRESS */}

              <div className="form-group full">

                <label>
                  Address
                </label>

                <input
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  placeholder="12 Anna Nagar"
                  disabled={saving}
                  required
                />

              </div>


              {/* CITY */}

              <div className="form-group">

                <label>
                  City
                </label>

                <input
                  name="city"
                  value={form.city}
                  onChange={handleChange}
                  placeholder="Chennai"
                  disabled={saving}
                  required
                  autoComplete="address-level2"
                />

              </div>


              {/* STATE */}

              <div className="form-group">

                <label>
                  State
                </label>

                <input
                  name="state"
                  value={form.state}
                  onChange={handleChange}
                  placeholder="Tamil Nadu"
                  disabled={saving}
                  required
                  autoComplete="address-level1"
                />

              </div>


              {/* PINCODE */}

              <div className="form-group">

                <label>
                  Pincode
                </label>

                <input
                  name="pincode"
                  value={form.pincode}
                  onChange={handleChange}
                  placeholder="600040"
                  disabled={saving}
                  required
                  inputMode="numeric"
                  maxLength={6}
                  pattern="^[1-9][0-9]{5}$"
                  title="Please enter a valid 6-digit Indian pincode starting with 1-9."
                  autoComplete="postal-code"
                />

              </div>


              {/* FLOORS */}

              <div className="form-group">

                <label>
                  Number of Floors
                </label>

                <input
                  type="number"
                  min="1"
                  max="150"
                  name="number_of_floors"
                  value={
                    form.number_of_floors
                  }
                  onChange={handleChange}
                  onKeyDown={preventNumberSpill}
                  disabled={saving}
                  required
                />

                <small>
                  Example: 4 floors creates
                  Floor 0, 1, 2 and 3.
                </small>

              </div>


              {/* DESCRIPTION */}

              <div className="form-group full">

                <label>
                  Description
                </label>

                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  placeholder="Optional building description"
                  rows="4"
                  disabled={saving}
                ></textarea>

              </div>


              {/* ACTIONS */}

              <div className="modal-actions">

                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeForm}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : buildingToEdit
                    ? "Save Changes"
                    : "Create Building"}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}


      {/* =====================================
          INVOICE TEMPLATE MODAL
      ====================================== */}

      {invoiceTemplateBuilding && (
        <div
          className="modal-overlay"
          onClick={closeInvoiceTemplate}
        >
          <div
            className="building-modal invoice-template-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="modal-header">
              <div>
                <span className="modal-label">
                  INVOICE TEMPLATE
                </span>

                <h2>
                  {invoiceTemplateLoading
                    ? "Loading Template..."
                    : "Edit Invoice Template"}
                </h2>

                <p>
                  {invoiceTemplateBuilding.name}
                </p>
              </div>

              <button
                className="modal-close"
                onClick={closeInvoiceTemplate}
                disabled={
                  invoiceTemplateSaving ||
                  invoiceTemplateLoading
                }
              >
                ×
              </button>
            </div>

            {invoiceTemplateError && (
              <div className="buildings-error invoice-template-error">
                <span>
                  {invoiceTemplateError}
                </span>

                <button
                  type="button"
                  onClick={() =>
                    setInvoiceTemplateError("")
                  }
                >
                  ×
                </button>
              </div>
            )}

            {invoiceTemplateLoading ? (
              <div className="invoice-template-loading">
                <div className="buildings-spinner"></div>
                <p>
                  Loading this building's
                  invoice template...
                </p>
              </div>
            ) : (
              <form
                className="building-form invoice-template-form"
                onSubmit={
                  handleSaveInvoiceTemplate
                }
              >
                <div className="invoice-template-section-title">
                  Business Details
                </div>

                <div className="form-group full">
                  <label>
                    Business / Landlord Name
                  </label>

                  <input
                    name="business_name"
                    value={
                      invoiceTemplate.business_name
                    }
                    onChange={
                      handleInvoiceTemplateChange
                    }
                    placeholder="Your business or landlord name"
                    disabled={
                      invoiceTemplateSaving
                    }
                  />
                </div>

                <div className="form-group full">
                  <label>
                    Address
                  </label>

                  <input
                    name="address"
                    value={
                      invoiceTemplate.address
                    }
                    onChange={
                      handleInvoiceTemplateChange
                    }
                    placeholder="Business address"
                    disabled={
                      invoiceTemplateSaving
                    }
                  />
                </div>

                <div className="form-group">
                  <label>City</label>

                  <input
                    name="city"
                    value={
                      invoiceTemplate.city
                    }
                    onChange={
                      handleInvoiceTemplateChange
                    }
                    placeholder="Chennai"
                    disabled={
                      invoiceTemplateSaving
                    }
                  />
                </div>

                <div className="form-group">
                  <label>State</label>

                  <input
                    name="state"
                    value={
                      invoiceTemplate.state
                    }
                    onChange={
                      handleInvoiceTemplateChange
                    }
                    placeholder="Tamil Nadu"
                    disabled={
                      invoiceTemplateSaving
                    }
                  />
                </div>

                <div className="form-group">
                  <label>Pincode</label>

                  <input
                    name="pincode"
                    value={
                      invoiceTemplate.pincode
                    }
                    onChange={
                      handleInvoiceTemplateChange
                    }
                    placeholder="600040"
                    disabled={
                      invoiceTemplateSaving
                    }
                    maxLength={6}
                    pattern="^[1-9][0-9]{5}$"
                    title="Please enter a valid 6-digit Indian pincode starting with 1-9."
                    inputMode="numeric"
                    autoComplete="postal-code"
                  />
                </div>

                <div className="form-group">
                  <label>Phone</label>

                  <input
                    name="phone"
                    value={
                      invoiceTemplate.phone
                    }
                    onChange={
                      handleInvoiceTemplateChange
                    }
                    placeholder="9876543210"
                    disabled={
                      invoiceTemplateSaving
                    }
                  />
                </div>

                <div className="form-group">
                  <label>Email</label>

                  <input
                    type="email"
                    name="email"
                    value={
                      invoiceTemplate.email
                    }
                    onChange={
                      handleInvoiceTemplateChange
                    }
                    placeholder="billing@example.com"
                    disabled={
                      invoiceTemplateSaving
                    }
                  />
                </div>

                <div className="form-group">
                  <label>GSTIN</label>

                  <input
                    name="gstin"
                    value={
                      invoiceTemplate.gstin
                    }
                    onChange={
                      handleInvoiceTemplateChange
                    }
                    placeholder="GST registration number"
                    disabled={
                      invoiceTemplateSaving
                    }
                  />
                </div>

                <div className="invoice-template-section-title">
                  Logo & Signature
                </div>

                <div className="form-group">
                  <label>
                    Invoice Logo
                  </label>

                  <input
                    type="file"
                    name="logo"
                    accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                    onChange={
                      handleInvoiceTemplateChange
                    }
                    disabled={
                      invoiceTemplateSaving
                    }
                  />

                  {invoiceTemplate.logo_url && (
                    <div className="invoice-asset-preview">
                      <img
                        src={
                          invoiceTemplate.logo_url
                        }
                        alt="Current invoice logo"
                      />
                    </div>
                  )}

                  <small>
                    PNG, JPG, JPEG or WEBP. Maximum 5 MB.
                  </small>
                </div>

                <div className="form-group">
                  <label>
                    Authorized Signature
                  </label>

                  <input
                    type="file"
                    name="signature"
                    accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                    onChange={
                      handleInvoiceTemplateChange
                    }
                    disabled={
                      invoiceTemplateSaving
                    }
                  />

                  {invoiceTemplate.signature_url && (
                    <div className="invoice-asset-preview signature-preview">
                      <img
                        src={
                          invoiceTemplate.signature_url
                        }
                        alt="Current invoice signature"
                      />
                    </div>
                  )}

                  <small>
                    PNG, JPG, JPEG or WEBP. Maximum 5 MB.
                  </small>
                </div>

                <div className="form-group">
                  <label>
                    UPI Payment QR Code
                  </label>

                  <input
                    type="file"
                    name="upi_qr_code"
                    accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                    onChange={
                      handleInvoiceTemplateChange
                    }
                    disabled={
                      invoiceTemplateSaving
                    }
                  />

                  {invoiceTemplate.upi_qr_code_url && (
                    <div className="invoice-asset-preview upi-qr-preview">
                      <img
                        src={
                          invoiceTemplate.upi_qr_code_url
                        }
                        alt="Current UPI QR code"
                      />
                    </div>
                  )}

                  <small>
                    PNG, JPG, JPEG or WEBP. Maximum 5 MB.
                  </small>
                </div>

                <div className="invoice-template-section-title">
                  Payment Details
                </div>

                <div className="form-group">
                  <label>Bank Name</label>

                  <input
                    name="bank_name"
                    value={
                      invoiceTemplate.bank_name
                    }
                    onChange={
                      handleInvoiceTemplateChange
                    }
                    placeholder="Bank name"
                    disabled={
                      invoiceTemplateSaving
                    }
                  />
                </div>

                <div className="form-group">
                  <label>Account Number</label>

                  <input
                    name="account_number"
                    value={
                      invoiceTemplate.account_number
                    }
                    onChange={
                      handleInvoiceTemplateChange
                    }
                    placeholder="Account number"
                    disabled={
                      invoiceTemplateSaving
                    }
                  />
                </div>

                <div className="form-group">
                  <label>IFSC</label>

                  <input
                    name="ifsc"
                    value={
                      invoiceTemplate.ifsc
                    }
                    onChange={
                      handleInvoiceTemplateChange
                    }
                    placeholder="Bank IFSC"
                    disabled={
                      invoiceTemplateSaving
                    }
                  />
                </div>

                <div className="form-group">
                  <label>Branch</label>

                  <input
                    name="branch"
                    value={
                      invoiceTemplate.branch
                    }
                    onChange={
                      handleInvoiceTemplateChange
                    }
                    placeholder="Branch name"
                    disabled={
                      invoiceTemplateSaving
                    }
                  />
                </div>

                <div className="form-group">
                  <label>UPI ID (VPA)</label>

                  <input
                    name="upi_id"
                    value={
                      invoiceTemplate.upi_id
                    }
                    onChange={
                      handleInvoiceTemplateChange
                    }
                    placeholder="e.g. merchant@okhdfcbank"
                    disabled={
                      invoiceTemplateSaving
                    }
                  />
                </div>

                <div className="form-group full">
                  <label>
                    Payment Instructions
                  </label>

                  <textarea
                    name="payment_instructions"
                    value={
                      invoiceTemplate.payment_instructions
                    }
                    onChange={
                      handleInvoiceTemplateChange
                    }
                    placeholder="UPI, payment instructions or other bank details"
                    rows="4"
                    disabled={
                      invoiceTemplateSaving
                    }
                  ></textarea>
                </div>

                <div className="invoice-template-section-title">
                  Invoice Settings
                </div>

                <div className="form-group">
                  <label>
                    Invoice Due Day
                  </label>

                  <input
                    type="number"
                    name="due_day"
                    min="1"
                    max="31"
                    step="1"
                    value={
                      invoiceTemplate.due_day
                    }
                    onChange={
                      handleInvoiceTemplateChange
                    }
                    onKeyDown={preventNumberSpill}
                    disabled={
                      invoiceTemplateSaving
                    }
                    required
                  />

                  <small>
                    The day of the month on which the
                    invoice is due.
                  </small>
                </div>

                <div className="invoice-template-help full">
                  <strong>
                    Commercial invoices only
                  </strong>

                  <span>
                    This template is used when an
                    invoice is generated for a
                    commercial tenant in this building.
                  </span>
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={closeInvoiceTemplate}
                    disabled={
                      invoiceTemplateSaving
                    }
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="primary-button"
                    disabled={
                      invoiceTemplateSaving
                    }
                  >
                    {invoiceTemplateSaving
                      ? "Saving..."
                      : invoiceTemplateId
                      ? "Update Template"
                      : "Save Template"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}


      {/* =====================================
          DELETE CONFIRMATION
      ====================================== */}

      {buildingToDelete && (

        <div
          className="modal-overlay delete-overlay"
          onClick={() => {
            if (!deleting) {
              setBuildingToDelete(
                null
              );
            }
          }}
        >

          <div
            className="delete-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            <div className="delete-icon">
              ⚠️
            </div>

            <h2>
              Delete Building?
            </h2>

            <p>
              Are you sure you want to
              delete{" "}
              <strong>
                "{buildingToDelete.name}"
              </strong>
              ?
            </p>

            <div className="delete-warning">

              <strong>
                This action cannot be undone.
              </strong>

              <span>
                The building's floors and
                units may also be removed.
              </span>

            </div>

            <div className="delete-actions">

              <button
                className="secondary-button"
                onClick={() =>
                  setBuildingToDelete(
                    null
                  )
                }
                disabled={deleting}
              >
                Cancel
              </button>

              <button
                className="delete-confirm-button"
                onClick={
                  handleDeleteBuilding
                }
                disabled={deleting}
              >
                {deleting
                  ? "Deleting..."
                  : "Delete Building"}
              </button>

            </div>

          </div>

        </div>
      )}

    </LandlordLayout>
  );
}

export default Buildings;