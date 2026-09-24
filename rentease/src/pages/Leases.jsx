import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import LandlordLayout from "../components/LandlordLayout";
import { PlusIcon } from "../components/Icons";
import "./Leases.css";
import TenantCredentialsModal from "../components/TenantCredentialsModal";


import { API_URL } from "../api";
import {
  sanitizeAlpha,
  sanitizeNumeric,
  sanitizeDecimal,
  sanitizeCode,
  isValidPhone,
  isValidGSTIN,
  preventNumberSpill,
} from "../utils/validators";


function Leases() {

  const navigate =
    useNavigate();


  const [leases, setLeases] =
    useState([]);

  const [tenants, setTenants] =
    useState([]);

  const [buildings, setBuildings] =
    useState([]);

  const [floors, setFloors] =
    useState([]);

  const [units, setUnits] =
    useState([]);


  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [deleting, setDeleting] =
    useState(false);


  const [error, setError] =
    useState("");

  const [showForm, setShowForm] =
    useState(false);

  const [showDetails, setShowDetails] =
    useState(false);

  const [showRenewal, setShowRenewal] =
    useState(false);

  // New Tenant Credentials Modal
  const [newTenantCredentials, setNewTenantCredentials] = useState(null);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [newTenantName, setNewTenantName] = useState("");


  const [selectedLease, setSelectedLease] =
    useState(null);


  const [tenantMode, setTenantMode] =
    useState("new");


  const [tenantForm, setTenantForm] =
    useState({
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      emergency_contact: "",
      emergency_phone: "",
      shop_name: "",
      gst_number: "",
      postal_address: "",
      gst_rate: "",
    });


  const emptyForm = {
    tenant: "",
    building: "",
    floor: "",
    unit: "",
    lease_type: "rent",
    start_date: "",
    end_date: "",
    monthly_rent: "",
    security_deposit: "",
    status: "active",
    agreement_file: null,
  };


  const [form, setForm] =
    useState(emptyForm);


  const [reminders, setReminders] =
    useState([
      {
        days_before: 90,
        enabled: true,
      },
      {
        days_before: 30,
        enabled: true,
      },
      {
        days_before: 7,
        enabled: true,
      },
    ]);


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
          },
        }
      );
    };


  const loadData =
    async () => {

      setLoading(true);
      setError("");

      try {

        const responses =
          await Promise.all([
            authenticatedFetch(
              `${API_URL}/leases/`
            ),

            authenticatedFetch(
              `${API_URL}/tenants/`
            ),

            authenticatedFetch(
              `${API_URL}/buildings/`
            ),

            authenticatedFetch(
              `${API_URL}/floors/`
            ),

            authenticatedFetch(
              `${API_URL}/units/`
            ),
          ]);


        if (
          responses.some(
            (response) =>
              !response
          )
        ) {
          return;
        }


        if (
          responses.some(
            (response) =>
              response.status ===
              401
          )
        ) {
          logout();
          return;
        }


        const data =
          await Promise.all(
            responses.map(
              (
                response
              ) =>
                response.json()
            )
          );


        const labels = [
          "leases",
          "tenants",
          "buildings",
          "floors",
          "units",
        ];


        for (
          let index = 0;
          index <
            responses.length;
          index++
        ) {

          if (
            !responses[index].ok
          ) {

            throw new Error(
              data[index].detail ||
                `Unable to load ${labels[index]}.`
            );
          }
        }


        setLeases(
          Array.isArray(
            data[0]
          )
            ? data[0]
            : []
        );


        setTenants(
          Array.isArray(
            data[1]
          )
            ? data[1]
            : []
        );


        setBuildings(
          Array.isArray(
            data[2]
          )
            ? data[2]
            : []
        );


        setFloors(
          Array.isArray(
            data[3]
          )
            ? data[3]
            : []
        );


        setUnits(
          Array.isArray(
            data[4]
          )
            ? data[4]
            : []
        );

      } catch (
        err
      ) {

        console.error(
          "Lease data error:",
          err
        );

        setError(
          err.message ||
            "Unable to load lease data."
        );

      } finally {

        setLoading(false);
      }
    };


  useEffect(() => {
    loadData();
  }, []);


  const selectedBuildingFloors =
    useMemo(() => {

      if (!form.building) {
        return [];
      }

      return floors
        .filter(
          (
            floor
          ) =>
            Number(
              floor.building
            ) ===
            Number(
              form.building
            )
        )
        .sort(
          (
            a,
            b
          ) =>
            Number(
              a.floor_number
            ) -
            Number(
              b.floor_number
            )
        );

    }, [
      floors,
      form.building,
    ]);


  const selectedFloorUnits =
    useMemo(() => {

      if (!form.floor) {
        return [];
      }

      return units
        .filter(
          (
            unit
          ) =>
            Number(
              unit.floor
            ) ===
              Number(
                form.floor
              ) &&
            (
              unit.status ===
                "vacant" ||
              (
                selectedLease &&
                Number(
                  unit.id
                ) ===
                  Number(
                    selectedLease.unit
                  )
              )
            )
        )
        .sort(
          (
            a,
            b
          ) =>
            String(
              a.unit_number
            ).localeCompare(
              String(
                b.unit_number
              )
            )
        );

    }, [
      units,
      form.floor,
      selectedLease,
    ]);


  const resetForm = () => {

    setForm({
      ...emptyForm,
    });

    setTenantForm({
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      emergency_contact: "",
      emergency_phone: "",
      shop_name: "",
      gst_number: "",
      postal_address: "",
      gst_rate: "",
    });

    setTenantMode(
      "new"
    );

    setReminders([
      {
        days_before: 90,
        enabled: true,
      },
      {
        days_before: 30,
        enabled: true,
      },
      {
        days_before: 7,
        enabled: true,
      },
    ]);
  };


  const openCreateForm = () => {

    setError("");

    resetForm();

    setSelectedLease(
      null
    );

    setShowForm(
      true
    );
  };


  const closeAllModals = () => {

    if (saving) {
      return;
    }

    setShowForm(
      false
    );

    setShowDetails(
      false
    );

    setShowRenewal(
      false
    );

    setSelectedLease(
      null
    );

    resetForm();

    setError("");
  };


  const openDetails = (
    lease
  ) => {

    setError("");

    setSelectedLease(
      lease
    );

    setShowDetails(
      true
    );
  };


  const openEdit = (
    lease
  ) => {

    const unit =
      units.find(
        (
          item
        ) =>
          Number(
            item.id
          ) ===
          Number(
            lease.unit
          )
      );


    setSelectedLease(
      lease
    );


    setTenantMode(
      "existing"
    );


    setTenantForm({
      first_name:
        lease.tenant_first_name ||
        "",
      last_name:
        lease.tenant_last_name ||
        "",
      email:
        lease.tenant_email ||
        "",
      phone:
        lease.tenant_phone ||
        "",
      emergency_contact:
        lease.tenant_emergency_contact ||
        "",
      emergency_phone:
        lease.tenant_emergency_phone ||
        "",
      shop_name:
        lease.tenant_shop_name ||
        "",
      gst_number:
        lease.tenant_gst_number ||
        "",
      postal_address:
        lease.tenant_postal_address ||
        "",
      gst_rate:
        lease.tenant_gst_rate ?? "",
    });


    setForm({
      tenant:
        lease.tenant ||
        "",
      building:
        lease.building_id ||
        unit?.building_id ||
        "",
      floor:
        unit?.floor ||
        "",
      unit:
        lease.unit ||
        "",
      lease_type:
        lease.lease_type ||
        "rent",
      start_date:
        lease.start_date ||
        "",
      end_date:
        lease.end_date ||
        "",
      monthly_rent:
        lease.monthly_rent ||
        "",
      security_deposit:
        lease.security_deposit ||
        "",
      status:
        lease.status ||
        "active",
      agreement_file:
        null,
    });


    setReminders(
      Array.isArray(
        lease.reminders
      )
        ? lease.reminders.map(
            (
              reminder
            ) => ({
              days_before:
                Number(
                  reminder.days_before
                ),
              enabled:
                reminder.enabled,
            })
          )
        : []
    );


    setShowForm(
      true
    );
  };


  const openRenewal = (
    lease
  ) => {

    setError("");

    setSelectedLease(
      lease
    );

    setForm({
      ...emptyForm,

      tenant:
        lease.tenant,

      unit:
        lease.unit,

      lease_type:
        lease.lease_type ||
        "rent",

      monthly_rent:
        lease.monthly_rent,

      security_deposit:
        lease.security_deposit,

      start_date:
        "",

      end_date:
        "",

      status:
        "active",

      agreement_file:
        null,
    });


    setReminders(
      Array.isArray(
        lease.reminders
      )
        ? lease.reminders.map(
            (
              reminder
            ) => ({
              days_before:
                Number(
                  reminder.days_before
                ),
              enabled:
                reminder.enabled,
            })
          )
        : [
            {
              days_before: 90,
              enabled: true,
            },
            {
              days_before: 30,
              enabled: true,
            },
            {
              days_before: 7,
              enabled: true,
            },
          ]
    );


    setShowRenewal(
      true
    );
  };


  const handleChange = (
    event
  ) => {

    const {
      name,
      value,
    } = event.target;


    if (
      name ===
      "building"
    ) {

      setForm(
        (
          previous
        ) => ({
          ...previous,
          building:
            value,
          floor: "",
          unit: "",
        })
      );

      return;
    }


    if (
      name ===
      "floor"
    ) {

      setForm(
        (
          previous
        ) => ({
          ...previous,
          floor:
            value,
          unit: "",
        })
      );

      return;
    }


    let sanitizedValue = value;
    if (name === "monthly_rent" || name === "security_deposit") {
      sanitizedValue = sanitizeDecimal(value);
    }

    setForm(
      (
        previous
      ) => ({
        ...previous,
        [name]:
          sanitizedValue,
      })
    );
  };


  const handleTenantChange =
    (
      event
    ) => {

      const {
        name,
        value,
      } = event.target;

      let sanitizedValue = value;
      if (name === "first_name" || name === "last_name" || name === "emergency_contact") {
        sanitizedValue = sanitizeAlpha(value, 50);
      } else if (name === "phone" || name === "emergency_phone") {
        sanitizedValue = sanitizeNumeric(value, 10);
      } else if (name === "gst_number") {
        sanitizedValue = sanitizeCode(value, 15);
      } else if (name === "gst_rate") {
        sanitizedValue = sanitizeDecimal(value);
      }

      setTenantForm(
        (
          previous
        ) => ({
          ...previous,
          [name]:
            sanitizedValue,
        })
      );
    };


  const handleFileChange =
    (
      event
    ) => {

      const file =
        event.target.files?.[0] ||
        null;


      if (!file) {
        return;
      }


      const extension =
        file.name
          .split(".")
          .pop()
          ?.toLowerCase();


      if (
        ![
          "pdf",
          "doc",
          "docx",
        ].includes(
          extension
        )
      ) {

        setError(
          "Only PDF, DOC and DOCX files are allowed."
        );

        event.target.value =
          "";

        return;
      }


      setForm(
        (
          previous
        ) => ({
          ...previous,
          agreement_file:
            file,
        })
      );


      setError("");
    };


  const addReminder = () => {

    setReminders(
      (
        previous
      ) => [
        ...previous,
        {
          days_before:
            14,
          enabled:
            true,
        },
      ]
    );
  };


  const updateReminder = (
    index,
    field,
    value
  ) => {

    let sanitizedValue = value;
    if (field === "days_before") {
      sanitizedValue = sanitizeNumeric(value, 4);
    }

    setReminders(
      (
        previous
      ) =>
        previous.map(
          (
            reminder,
            reminderIndex
          ) =>
            reminderIndex ===
            index
              ? {
                  ...reminder,
                  [field]:
                    sanitizedValue,
                }
              : reminder
        )
    );
  };


  const removeReminder = (
    index
  ) => {

    setReminders(
      (
        previous
      ) =>
        previous.filter(
          (
            _,
            reminderIndex
          ) =>
            reminderIndex !==
            index
        )
    );
  };


  const selectedUnit =
    useMemo(() => {
      if (!form.unit) {
        return null;
      }

      return units.find(
        (unit) =>
          Number(unit.id) === Number(form.unit)
      ) || null;
    }, [units, form.unit]);

  const isCommercialUnit =
    String(
      selectedUnit?.unit_type ||
      selectedUnit?.unit_type_display ||
      ""
    ).toLowerCase() === "commercial";

  const validateCommon =
    () => {

      if (!form.unit) {
        return "Please select a unit.";
      }

      if (!form.start_date) {
        return "Start date is required.";
      }

      if (!form.end_date) {
        return "End date is required.";
      }

      if (
        form.end_date <=
        form.start_date
      ) {
        return "End date must be after start date.";
      }

      if (
        form.monthly_rent ===
          "" ||
        Number(
          form.monthly_rent
        ) < 0
      ) {
        return "Enter a valid monthly rent.";
      }

      if (
        form.security_deposit ===
          "" ||
        Number(
          form.security_deposit
        ) < 0
      ) {
        return "Enter a valid security deposit.";
      }

      if (tenantForm.phone && !isValidPhone(tenantForm.phone)) {
        return "Tenant phone number must be a valid 10-digit mobile number.";
      }

      if (tenantForm.emergency_phone && !isValidPhone(tenantForm.emergency_phone)) {
        return "Emergency phone number must be a valid 10-digit mobile number.";
      }

      if (isCommercialUnit) {
        if (!tenantForm.shop_name.trim()) {
          return "Shop Name is required for commercial units.";
        }
        if (!tenantForm.gst_number.trim()) {
          return "GST Number is required for commercial units.";
        }
        if (!tenantForm.postal_address.trim()) {
          return "Postal Address is required for commercial units.";
        }
        if (!tenantForm.email.trim()) {
          return "Email Address is required for commercial tenants to receive invoices and receipts.";
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(tenantForm.email.trim())) {
          return "Please enter a valid email address.";
        }
        if (
          tenantForm.gst_rate === "" ||
          Number.isNaN(Number(tenantForm.gst_rate)) ||
          Number(tenantForm.gst_rate) < 0 ||
          Number(tenantForm.gst_rate) > 100
        ) {
          return "Enter a valid GST Rate between 0 and 100.";
        }
      }

      const days =
        reminders
          .filter(
            (
              reminder
            ) =>
              reminder.enabled
          )
          .map(
            (
              reminder
            ) =>
              Number(
                reminder.days_before
              )
          );


      if (
        days.some(
          (
            value
          ) =>
            !Number.isInteger(
              value
            ) ||
            value <= 0
        )
      ) {
        return "Every reminder must contain a positive number of days.";
      }


      if (
        new Set(
          days
        ).size !==
        days.length
      ) {
        return "Reminder days must be unique.";
      }


      return null;
    };


  const validateCreate =
    () => {

      if (
        tenantMode ===
        "existing"
      ) {

        if (!form.tenant) {
          return "Please select a tenant.";
        }

      } else {

        if (
          !tenantForm.first_name.trim()
        ) {
          return "Tenant first name is required.";
        }

        if (
          !tenantForm.phone.trim()
        ) {
          return "Tenant phone number is required.";
        }
      }


      return validateCommon();
    };


  const handleCreate =
    async (
      event
    ) => {

      event.preventDefault();

      const validationError =
        validateCreate();


      if (validationError) {

        setError(
          validationError
        );

        return;
      }


      setSaving(
        true
      );

      setError("");


      try {

        const formData =
          new FormData();


        formData.append(
          "tenant_mode",
          tenantMode
        );


        if (
          tenantMode ===
          "existing"
        ) {

          formData.append(
            "tenant",
            form.tenant
          );

        } else {

          formData.append(
            "first_name",
            tenantForm.first_name
          );

          formData.append(
            "last_name",
            tenantForm.last_name
          );

          formData.append(
            "email",
            tenantForm.email
          );

          formData.append(
            "phone",
            tenantForm.phone
          );

          formData.append(
            "emergency_contact",
            tenantForm.emergency_contact
          );

          formData.append(
            "emergency_phone",
            tenantForm.emergency_phone
          );

          if (isCommercialUnit) {
            formData.append("shop_name", tenantForm.shop_name);
            formData.append("gst_number", tenantForm.gst_number);
            formData.append("postal_address", tenantForm.postal_address);
            formData.append("gst_rate", tenantForm.gst_rate);
          }
        }


        formData.append(
          "unit",
          form.unit
        );

        formData.append(
          "lease_type",
          form.lease_type
        );

        formData.append(
          "start_date",
          form.start_date
        );

        formData.append(
          "end_date",
          form.end_date
        );

        formData.append(
          "monthly_rent",
          form.monthly_rent
        );

        formData.append(
          "security_deposit",
          form.security_deposit
        );

        formData.append(
          "status",
          form.status
        );

        formData.append(
          "reminders",
          JSON.stringify(
            reminders
          )
        );


        if (
          form.agreement_file
        ) {

          formData.append(
            "agreement_file",
            form.agreement_file
          );
        }


        const response =
          await authenticatedFetch(
            `${API_URL}/leases/`,
            {
              method:
                "POST",
              body:
                formData,
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

          throw new Error(
            data.detail ||
              "Unable to create lease."
          );
        }


        closeAllModals();

        if (data.temporary_credentials) {
          setNewTenantCredentials(data.temporary_credentials);
          setNewTenantName(
            `${tenantForm.first_name} ${tenantForm.last_name || ""}`.trim()
          );
          setShowCredentialsModal(true);
        }

        await loadData();

      } catch (
        err
      ) {

        console.error(
          err
        );

        setError(
          err.message ||
            "Unable to create lease."
        );

      } finally {

        setSaving(
          false
        );
      }
    };


  const handleEdit =
    async (
      event
    ) => {

      event.preventDefault();


      const validationError =
        validateCommon();


      if (validationError) {

        setError(
          validationError
        );

        return;
      }


      if (
        !tenantForm.first_name.trim()
      ) {

        setError(
          "Tenant first name is required."
        );

        return;
      }


      if (
        !tenantForm.phone.trim()
      ) {

        setError(
          "Tenant phone number is required."
        );

        return;
      }


      setSaving(
        true
      );

      setError("");


      try {

        const formData =
          new FormData();


        formData.append(
          "unit",
          form.unit
        );

        formData.append(
          "lease_type",
          form.lease_type
        );

        formData.append(
          "start_date",
          form.start_date
        );

        formData.append(
          "end_date",
          form.end_date
        );

        formData.append(
          "monthly_rent",
          form.monthly_rent
        );

        formData.append(
          "security_deposit",
          form.security_deposit
        );

        formData.append(
          "status",
          form.status
        );


        formData.append(
          "tenant_first_name",
          tenantForm.first_name
        );

        formData.append(
          "tenant_last_name",
          tenantForm.last_name
        );

        formData.append(
          "tenant_email",
          tenantForm.email
        );

        formData.append(
          "tenant_phone",
          tenantForm.phone
        );

        formData.append(
          "tenant_emergency_contact",
          tenantForm.emergency_contact
        );

        formData.append(
          "tenant_emergency_phone",
          tenantForm.emergency_phone
        );

        formData.append(
          "tenant_shop_name",
          tenantForm.shop_name
        );

        formData.append(
          "tenant_gst_number",
          tenantForm.gst_number
        );

        formData.append(
          "tenant_postal_address",
          tenantForm.postal_address
        );

        formData.append(
          "tenant_gst_rate",
          tenantForm.gst_rate
        );


        formData.append(
          "reminders",
          JSON.stringify(
            reminders
          )
        );


        if (
          form.agreement_file
        ) {

          formData.append(
            "agreement_file",
            form.agreement_file
          );
        }


        const response =
          await authenticatedFetch(
            `${API_URL}/leases/${selectedLease.id}/`,
            {
              method:
                "PATCH",
              body:
                formData,
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

          throw new Error(
            data.detail ||
              "Unable to update lease."
          );
        }


        closeAllModals();

        await loadData();

      } catch (
        err
      ) {

        console.error(
          err
        );

        setError(
          err.message ||
            "Unable to update lease."
        );

      } finally {

        setSaving(
          false
        );
      }
    };


  const handleRenew =
    async (
      event
    ) => {

      event.preventDefault();


      if (
        !form.start_date
      ) {
        setError(
          "Renewal start date is required."
        );

        return;
      }


      if (
        !form.end_date
      ) {
        setError(
          "Renewal end date is required."
        );

        return;
      }


      if (
        form.end_date <=
        form.start_date
      ) {

        setError(
          "Renewal end date must be after the start date."
        );

        return;
      }


      if (
        selectedLease.end_date &&
        form.start_date <=
          selectedLease.end_date
      ) {

        setError(
          "Renewal must start after the previous lease ends."
        );

        return;
      }


      const days =
        reminders
          .filter(
            (
              reminder
            ) =>
              reminder.enabled
          )
          .map(
            (
              reminder
            ) =>
              Number(
                reminder.days_before
              )
          );


      if (
        new Set(
          days
        ).size !==
        days.length
      ) {

        setError(
          "Reminder days must be unique."
        );

        return;
      }


      setSaving(
        true
      );

      setError("");


      try {

        const formData =
          new FormData();


        formData.append(
          "start_date",
          form.start_date
        );

        formData.append(
          "end_date",
          form.end_date
        );

        formData.append(
          "lease_type",
          form.lease_type
        );

        formData.append(
          "monthly_rent",
          form.monthly_rent
        );

        formData.append(
          "security_deposit",
          form.security_deposit
        );

        formData.append(
          "reminders",
          JSON.stringify(
            reminders
          )
        );


        if (
          form.agreement_file
        ) {

          formData.append(
            "agreement_file",
            form.agreement_file
          );
        }


        const response =
          await authenticatedFetch(
            `${API_URL}/leases/${selectedLease.id}/renew/`,
            {
              method:
                "POST",
              body:
                formData,
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

          throw new Error(
            data.detail ||
              "Unable to renew lease."
          );
        }


        closeAllModals();

        await loadData();

      } catch (
        err
      ) {

        console.error(
          err
        );

        setError(
          err.message ||
            "Unable to renew lease."
        );

      } finally {

        setSaving(
          false
        );
      }
    };


  const statusLabel = (
    status
  ) => {

    switch (
      status
    ) {

      case "active":
        return "Active";

      case "pending":
        return "Pending";

      case "expired":
        return "Expired";

      case "terminated":
        return "Terminated";

      default:
        return status;
    }
  };


  const formatDate = (
    value
  ) => {

    if (!value) {
      return "-";
    }

    const parts =
      String(
        value
      ).split(
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


  if (loading) {

    return (
      <div className="leases-loading">

        <div className="leases-spinner"></div>

        <p>
          Loading leases...
        </p>

      </div>
    );
  }


  return (
    <LandlordLayout
      breadcrumb="Leases"
      title="Leases & Agreements"
      subtitle="Manage tenants, rental agreements, terms and lease history."
      actions={
        <button
          className="leases-primary-button"
          onClick={openCreateForm}
        >
          <PlusIcon size={16} />
          <span>Create Lease</span>
        </button>
      }
    >


      {error && (
        <div className="leases-error">

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


      <section className="leases-summary">

        <div className="leases-summary-card">

          <span>
            TOTAL LEASES
          </span>

          <strong>
            {leases.length}
          </strong>

        </div>


        <div className="leases-summary-card">

          <span>
            ACTIVE
          </span>

          <strong>
            {
              leases.filter(
                (
                  lease
                ) =>
                  lease.status ===
                  "active"
              ).length
            }
          </strong>

        </div>


        <div className="leases-summary-card">

          <span>
            PENDING
          </span>

          <strong>
            {
              leases.filter(
                (
                  lease
                ) =>
                  lease.status ===
                  "pending"
              ).length
            }
          </strong>

        </div>


        <div className="leases-summary-card">

          <span>
            EXPIRING
          </span>

          <strong>
            {
              leases.filter(
                (
                  lease
                ) => {

                  if (
                    lease.status !==
                    "active"
                  ) {
                    return false;
                  }

                  if (
                    !lease.end_date
                  ) {
                    return false;
                  }

                  const difference =
                    new Date(
                      lease.end_date
                    ).getTime() -
                    Date.now();

                  return (
                    difference >=
                      0 &&
                    difference <=
                      90 *
                        24 *
                        60 *
                        60 *
                        1000
                  );
                }
              ).length
            }
          </strong>

        </div>

      </section>


      {leases.length ===
      0 ? (

        <section className="no-leases">

          <div className="no-leases-icon">
            📄
          </div>

          <h2>
            No leases yet
          </h2>

          <p>
            Create a lease to connect
            a tenant with a rental unit.
          </p>

          <button
            className="leases-primary-button"
            onClick={
              openCreateForm
            }
          >
            + Create First Lease
          </button>

        </section>

      ) : (

        <section className="leases-list">

          {leases.map(
            (
              lease
            ) => (

              <article
                className="lease-card"
                key={
                  lease.id
                }
              >

                <div className="lease-card-main">

                  <div className="lease-icon">
                    📄
                  </div>


                  <div className="lease-main-info">

                    <h2>
                      {
                        lease.unit_name
                      }
                    </h2>

                    <p>
                      {
                        lease.unit_number
                      }
                      {" · "}
                      {
                        lease.building_name
                      }
                      {" · Floor "}
                      {
                        lease.floor_number
                      }
                    </p>

                    <span>
                      Tenant:{" "}
                      {
                        lease.tenant_name
                      }
                    </span>

                  </div>


                  <span
                    className={`lease-status ${lease.status}`}
                  >
                    {
                      statusLabel(
                        lease.status
                      )
                    }
                  </span>

                </div>


                <div className="lease-details">

                  <div>

                    <span>
                      Lease Period
                    </span>

                    <strong>
                      {
                        formatDate(
                          lease.start_date
                        )
                      }
                      {" — "}
                      {
                        formatDate(
                          lease.end_date
                        )
                      }
                    </strong>

                  </div>


                  <div>

                    <span>
                      Monthly Rent
                    </span>

                    <strong>
                      ₹
                      {Number(
                        lease.monthly_rent ||
                          0
                      ).toLocaleString(
                        "en-IN"
                      )}
                    </strong>

                  </div>


                  <div>

                    <span>
                      Security Deposit
                    </span>

                    <strong>
                      ₹
                      {Number(
                        lease.security_deposit ||
                          0
                      ).toLocaleString(
                        "en-IN"
                      )}
                    </strong>

                  </div>


                  <div>

                    <span>
                      Reminders
                    </span>

                    <strong>
                      {
                        Array.isArray(
                          lease.reminders
                        ) &&
                        lease.reminders.length
                          ? lease.reminders
                              .map(
                                (
                                  reminder
                                ) =>
                                  `${reminder.days_before}d`
                              )
                              .join(
                                ", "
                              )
                          : "None"
                      }
                    </strong>

                  </div>

                </div>


                <div className="lease-actions">

                  <button
                    className="agreement-button"
                    onClick={() =>
                      openDetails(
                        lease
                      )
                    }
                  >
                    Details
                  </button>


                  {lease.agreement_file_url && (

                    <a
                      href={
                        lease.agreement_file_url
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="agreement-button"
                    >
                      Agreement
                    </a>

                  )}


                  <button
                    className="lease-edit-button"
                    onClick={() =>
                      openEdit(
                        lease
                      )
                    }
                  >
                    Edit
                  </button>


                  {(
                    lease.status ===
                      "active" ||
                    lease.status ===
                      "expired"
                  ) && (

                    <button
                      className="lease-renew-button"
                      onClick={() =>
                        openRenewal(
                          lease
                        )
                      }
                    >
                      Renew
                    </button>

                  )}

                </div>

              </article>
            )
          )}

        </section>
      )}


      {/* ======================================
          CREATE / EDIT MODAL
      ======================================= */}

      {showForm && (

        <div
          className="leases-modal-overlay"
          onClick={() => {

            if (!saving) {
              closeAllModals();
            }

          }}
        >

          <div
            className="lease-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            <div className="lease-modal-header">

              <div>

                <span>
                  {
                    selectedLease
                      ? "EDIT LEASE"
                      : "NEW LEASE"
                  }
                </span>

                <h2>
                  {
                    selectedLease
                      ? "Edit Lease"
                      : "Create Lease"
                  }
                </h2>

                <p>
                  Manage tenant and lease
                  information.
                </p>

              </div>


              <button
                className="lease-modal-close"
                onClick={
                  closeAllModals
                }
                disabled={
                  saving
                }
              >
                ×
              </button>

            </div>


            <form
              className="lease-form"
              onSubmit={
                selectedLease
                  ? handleEdit
                  : handleCreate
              }
            >

              {/* TENANT */}

              {!selectedLease && (

                <>

                  <div className="lease-field full">

                    <label>
                      Tenant
                    </label>

                    <div className="tenant-mode-buttons">

                      <button
                        type="button"
                        className={
                          tenantMode ===
                          "new"
                            ? "tenant-mode-button active"
                            : "tenant-mode-button"
                        }
                        onClick={() =>
                          setTenantMode(
                            "new"
                          )
                        }
                        disabled={
                          saving
                        }
                      >
                        + New Tenant
                      </button>


                      <button
                        type="button"
                        className={
                          tenantMode ===
                          "existing"
                            ? "tenant-mode-button active"
                            : "tenant-mode-button"
                        }
                        onClick={() =>
                          setTenantMode(
                            "existing"
                          )
                        }
                        disabled={
                          saving
                        }
                      >
                        Existing Tenant
                      </button>

                    </div>

                  </div>


                  {tenantMode ===
                    "existing" ? (

                    <div className="lease-field full">

                      <label>
                        Existing Tenant
                      </label>

                      <select
                        value={
                          form.tenant
                        }
                        onChange={(
                          event
                        ) =>
                          setForm(
                            (
                              previous
                            ) => ({
                              ...previous,
                              tenant:
                                event
                                  .target
                                  .value,
                            })
                          )
                        }
                        disabled={
                          saving
                        }
                      >

                        <option value="">
                          Select tenant
                        </option>

                        {tenants.map(
                          (
                            tenant
                          ) => (

                            <option
                              key={
                                tenant.id
                              }
                              value={
                                tenant.id
                              }
                            >
                              {
                                tenant.full_name
                              }
                              {tenant.email
                                ? ` — ${tenant.email}`
                                : ""}
                            </option>

                          )
                        )}

                      </select>

                    </div>

                  ) : (

                    <div className="new-tenant-section full">

                      <div className="new-tenant-heading">

                        <span>
                          TENANT DETAILS
                        </span>

                        <h3>
                          Tenant information
                        </h3>

                        <p>
                          No login account is
                          created in Phase 1.
                        </p>

                      </div>


                      <div className="new-tenant-grid">

                        <div className="lease-field">

                          <label>
                            First Name
                          </label>

                          <input
                            name="first_name"
                            value={
                              tenantForm.first_name
                            }
                            onChange={
                              handleTenantChange
                            }
                            disabled={
                              saving
                            }
                            required
                          />

                        </div>


                        <div className="lease-field">

                          <label>
                            Last Name
                          </label>

                          <input
                            name="last_name"
                            value={
                              tenantForm.last_name
                            }
                            onChange={
                              handleTenantChange
                            }
                            disabled={
                              saving
                            }
                          />

                        </div>


                        <div className="lease-field">

                          <label>
                            Email
                          </label>

                          <input
                            type="email"
                            name="email"
                            value={
                              tenantForm.email
                            }
                            onChange={
                              handleTenantChange
                            }
                            disabled={
                              saving
                            }
                          />

                        </div>


                        <div className="lease-field">

                          <label>
                            Phone
                          </label>

                          <input
                            name="phone"
                            value={
                              tenantForm.phone
                            }
                            onChange={
                              handleTenantChange
                            }
                            disabled={
                              saving
                            }
                            required
                          />

                        </div>


                        <div className="lease-field">

                          <label>
                            Emergency Contact
                          </label>

                          <input
                            name="emergency_contact"
                            value={
                              tenantForm.emergency_contact
                            }
                            onChange={
                              handleTenantChange
                            }
                            disabled={
                              saving
                            }
                          />

                        </div>


                        <div className="lease-field">

                          <label>
                            Emergency Phone
                          </label>

                          <input
                            name="emergency_phone"
                            value={
                              tenantForm.emergency_phone
                            }
                            onChange={
                              handleTenantChange
                            }
                            disabled={
                              saving
                            }
                          />

                        </div>

                        {isCommercialUnit && (
                          <>
                            <div className="lease-field">
                              <label>Shop Name</label>
                              <input
                                name="shop_name"
                                value={tenantForm.shop_name}
                                onChange={handleTenantChange}
                                disabled={saving}
                                required
                              />
                            </div>

                            <div className="lease-field">
                              <label>GST Number</label>
                              <input
                                name="gst_number"
                                value={tenantForm.gst_number}
                                onChange={handleTenantChange}
                                disabled={saving}
                                required
                              />
                            </div>

                            <div className="lease-field full">
                              <label>Postal Address</label>
                              <textarea
                                name="postal_address"
                                value={tenantForm.postal_address}
                                onChange={handleTenantChange}
                                disabled={saving}
                                rows="3"
                                required
                              />
                            </div>

                            <div className="lease-field">
                              <label>GST Rate (%)</label>
                              <input
                                type="number"
                                name="gst_rate"
                                min="0"
                                max="100"
                                step="0.01"
                                value={tenantForm.gst_rate}
                                onChange={handleTenantChange}
                                disabled={saving}
                                placeholder="Enter GST rate"
                                required
                              />
                            </div>
                          </>
                        )}

                      </div>

                    </div>

                  )}

                </>

              )}


              {/* EDIT TENANT */}

              {selectedLease && (

                <div className="new-tenant-section full">

                  <div className="new-tenant-heading">

                    <span>
                      TENANT
                    </span>

                    <h3>
                      Tenant information
                    </h3>

                  </div>


                  <div className="new-tenant-grid">

                    <div className="lease-field">

                      <label>
                        First Name
                      </label>

                      <input
                        name="first_name"
                        value={
                          tenantForm.first_name
                        }
                        onChange={
                          handleTenantChange
                        }
                        disabled={
                          saving
                        }
                        required
                      />

                    </div>


                    <div className="lease-field">

                      <label>
                        Last Name
                      </label>

                      <input
                        name="last_name"
                        value={
                          tenantForm.last_name
                        }
                        onChange={
                          handleTenantChange
                        }
                        disabled={
                          saving
                        }
                      />

                    </div>


                    <div className="lease-field">

                      <label>
                        Email
                      </label>

                      <input
                        type="email"
                        name="email"
                        value={
                          tenantForm.email
                        }
                        onChange={
                          handleTenantChange
                        }
                        disabled={
                          saving
                        }
                      />

                    </div>


                    <div className="lease-field">

                      <label>
                        Phone
                      </label>

                      <input
                        name="phone"
                        value={
                          tenantForm.phone
                        }
                        onChange={
                          handleTenantChange
                        }
                        disabled={
                          saving
                        }
                        required
                      />

                    </div>

                      {isCommercialUnit && (
                        <>
                          <div className="lease-field">
                            <label>Shop Name</label>
                            <input
                              name="shop_name"
                              value={tenantForm.shop_name}
                              onChange={handleTenantChange}
                              disabled={saving}
                              required
                            />
                          </div>

                          <div className="lease-field">
                            <label>GST Number</label>
                            <input
                              name="gst_number"
                              value={tenantForm.gst_number}
                              onChange={handleTenantChange}
                              disabled={saving}
                              required
                            />
                          </div>

                          <div className="lease-field full">
                            <label>Postal Address</label>
                            <textarea
                              name="postal_address"
                              value={tenantForm.postal_address}
                              onChange={handleTenantChange}
                              disabled={saving}
                              rows="3"
                              required
                            />
                          </div>

                          <div className="lease-field">
                            <label>GST Rate (%)</label>
                            <input
                              type="number"
                              name="gst_rate"
                              min="0"
                              max="100"
                              step="0.01"
                              value={tenantForm.gst_rate}
                              onChange={handleTenantChange}
                              disabled={saving}
                              placeholder="Enter GST rate"
                              required
                            />
                          </div>
                        </>
                      )}

                  </div>

                </div>
              )}


              {/* PROPERTY */}

              <div className="lease-field">

                <label>
                  Building
                </label>

                <select
                  name="building"
                  value={
                    form.building
                  }
                  onChange={
                    handleChange
                  }
                  disabled={
                    saving
                  }
                  required
                >

                  <option value="">
                    Select building
                  </option>

                  {buildings.map(
                    (
                      building
                    ) => (

                      <option
                        key={
                          building.id
                        }
                        value={
                          building.id
                        }
                      >
                        {
                          building.name
                        }
                      </option>

                    )
                  )}

                </select>

              </div>


              <div className="lease-field">

                <label>
                  Floor
                </label>

                <select
                  name="floor"
                  value={
                    form.floor
                  }
                  onChange={
                    handleChange
                  }
                  disabled={
                    saving ||
                    !form.building
                  }
                  required
                >

                  <option value="">
                    Select floor
                  </option>

                  {selectedBuildingFloors.map(
                    (
                      floor
                    ) => (

                      <option
                        key={
                          floor.id
                        }
                        value={
                          floor.id
                        }
                      >
                        Floor{" "}
                        {
                          floor.floor_number
                        }
                      </option>

                    )
                  )}

                </select>

              </div>


              <div className="lease-field full">

                <label>
                  Unit
                </label>

                <select
                  name="unit"
                  value={
                    form.unit
                  }
                  onChange={
                    handleChange
                  }
                  disabled={
                    saving ||
                    !form.floor
                  }
                  required
                >

                  <option value="">
                    Select vacant unit
                  </option>

                  {selectedFloorUnits.map(
                    (
                      unit
                    ) => (

                      <option
                        key={
                          unit.id
                        }
                        value={
                          unit.id
                        }
                      >
                        {
                          unit.unit_number
                        }
                        {" — "}
                        {
                          unit.name
                        }
                        {" — "}
                        {
                          unit.unit_type_display
                        }
                      </option>

                    )
                  )}

                </select>

              </div>


              {/* LEASE */}

              <div className="lease-field">

                <label>
                  Lease Type
                </label>

                <select
                  name="lease_type"
                  value={
                    form.lease_type
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

                  <option value="lease">
                    Lease
                  </option>

                </select>

              </div>


              <div className="lease-field">

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

                  <option value="active">
                    Active
                  </option>

                  <option value="pending">
                    Pending
                  </option>

                  {selectedLease && (
                    <>
                      <option value="expired">
                        Expired
                      </option>

                      <option value="terminated">
                        Terminated
                      </option>
                    </>
                  )}

                </select>

              </div>


              {/* DATES */}

              <div className="lease-field">

                <label>
                  Start Date
                </label>

                <input
                  type="date"
                  name="start_date"
                  value={
                    form.start_date
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


              <div className="lease-field">

                <label>
                  End Date
                </label>

                <input
                  type="date"
                  name="end_date"
                  value={
                    form.end_date
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


              <div className="lease-field">

                <label>
                  Monthly Rent
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  name="monthly_rent"
                  value={
                    form.monthly_rent
                  }
                  onChange={
                    handleChange
                  }
                  onKeyDown={preventNumberSpill}
                  disabled={
                    saving
                  }
                  required
                />

              </div>


              <div className="lease-field">

                <label>
                  Security Deposit
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  name="security_deposit"
                  value={
                    form.security_deposit
                  }
                  onChange={
                    handleChange
                  }
                  onKeyDown={preventNumberSpill}
                  disabled={
                    saving
                  }
                  required
                />

              </div>


              {/* AGREEMENT */}

              <div className="lease-field full">

                <label>
                  Agreement File
                </label>

                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={
                    handleFileChange
                  }
                  disabled={
                    saving
                  }
                />

                {selectedLease?.agreement_file_url && (
                  <small>
                    Existing agreement remains
                    unless a new file is selected.
                  </small>
                )}

              </div>


              {/* REMINDERS */}

              <div className="lease-reminders full">

                <div className="reminders-header">

                  <div>

                    <span>
                      EXPIRY REMINDERS
                    </span>

                    <h3>
                      Custom reminder schedule
                    </h3>

                    <p>
                      Set any reminder timing
                      you prefer.
                    </p>

                  </div>


                  <button
                    type="button"
                    className="add-reminder-button"
                    onClick={
                      addReminder
                    }
                    disabled={
                      saving
                    }
                  >
                    + Add Reminder
                  </button>

                </div>


                {reminders.map(
                  (
                    reminder,
                    index
                  ) => (

                    <div
                      className="reminder-row"
                      key={
                        index
                      }
                    >

                      <input
                        type="number"
                        min="1"
                        max="3650"
                        value={
                          reminder.days_before
                        }
                        onChange={(
                          event
                        ) =>
                          updateReminder(
                            index,
                            "days_before",
                            event
                              .target
                              .value
                          )
                        }
                        onKeyDown={preventNumberSpill}
                        disabled={
                          saving
                        }
                      />

                      <span>
                        days before expiry
                      </span>


                      <label className="reminder-toggle">

                        <input
                          type="checkbox"
                          checked={
                            reminder.enabled
                          }
                          onChange={(
                            event
                          ) =>
                            updateReminder(
                              index,
                              "enabled",
                              event
                                .target
                                .checked
                            )
                          }
                          disabled={
                            saving
                          }
                        />

                        Enabled

                      </label>


                      <button
                        type="button"
                        className="remove-reminder-button"
                        onClick={() =>
                          removeReminder(
                            index
                          )
                        }
                        disabled={
                          saving
                        }
                      >
                        Remove
                      </button>

                    </div>

                  )
                )}

              </div>


              <div className="lease-form-actions full">

                <button
                  type="button"
                  className="lease-secondary-button"
                  onClick={
                    closeAllModals
                  }
                  disabled={
                    saving
                  }
                >
                  Cancel
                </button>


                <button
                  type="submit"
                  className="leases-primary-button"
                  disabled={
                    saving
                  }
                >
                  {saving
                    ? "Saving..."
                    : selectedLease
                    ? "Save Changes"
                    : "Create Lease"}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}


      {/* ======================================
          DETAILS MODAL
      ======================================= */}

      {showDetails &&
        selectedLease && (

        <div
          className="leases-modal-overlay"
          onClick={
            closeAllModals
          }
        >

          <div
            className="lease-modal lease-details-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            <div className="lease-modal-header">

              <div>

                <span>
                  LEASE DETAILS
                </span>

                <h2>
                  {
                    selectedLease.unit_name
                  }
                </h2>

                <p>
                  {
                    selectedLease.building_name
                  }
                  {" · Floor "}
                  {
                    selectedLease.floor_number
                  }
                </p>

              </div>


              <button
                className="lease-modal-close"
                onClick={
                  closeAllModals
                }
              >
                ×
              </button>

            </div>


            <div className="details-grid">

              <div className="details-section">

                <span>
                  TENANT
                </span>

                <h3>
                  {
                    selectedLease.tenant_name
                  }
                </h3>

                <p>
                  {
                    selectedLease.tenant_email ||
                    "No email provided"
                  }
                </p>

                <p>
                  {
                    selectedLease.tenant_phone ||
                    "No phone provided"
                  }
                </p>

              </div>


              <div className="details-section">

                <span>
                  UNIT
                </span>

                <h3>
                  {
                    selectedLease.unit_number
                  }
                </h3>

                <p>
                  {
                    selectedLease.unit_name
                  }
                </p>

                <p>
                  {
                    selectedLease.unit_type_display
                  }
                </p>

              </div>


              <div className="details-section">

                <span>
                  LEASE PERIOD
                </span>

                <h3>
                  {
                    formatDate(
                      selectedLease.start_date
                    )
                  }
                </h3>

                <p>
                  to{" "}
                  {
                    formatDate(
                      selectedLease.end_date
                    )
                  }
                </p>

              </div>


              <div className="details-section">

                <span>
                  FINANCIALS
                </span>

                <h3>
                  ₹
                  {Number(
                    selectedLease.monthly_rent ||
                      0
                  ).toLocaleString(
                    "en-IN"
                  )}
                </h3>

                <p>
                  Security: ₹
                  {Number(
                    selectedLease.security_deposit ||
                      0
                  ).toLocaleString(
                    "en-IN"
                  )}
                </p>

              </div>


              <div className="details-section full">

                <span>
                  REMINDERS
                </span>

                <div className="details-reminder-list">

                  {selectedLease.reminders?.length
                    ? selectedLease.reminders.map(
                        (
                          reminder
                        ) => (

                          <span
                            key={
                              reminder.id
                            }
                          >
                            {
                              reminder.days_before
                            }{" "}
                            days before
                          </span>

                        )
                      )
                    : (
                      <span>
                        No reminders configured
                      </span>
                    )}

                </div>

              </div>

            </div>


            <div className="details-actions">

              {selectedLease.agreement_file_url && (

                <a
                  href={
                    selectedLease.agreement_file_url
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="agreement-button"
                >
                  Open Agreement
                </a>

              )}


              <button
                className="lease-edit-button"
                onClick={() => {

                  setShowDetails(
                    false
                  );

                  openEdit(
                    selectedLease
                  );

                }}
              >
                Edit Lease
              </button>


              {(
                selectedLease.status ===
                  "active" ||
                selectedLease.status ===
                  "expired"
              ) && (

                <button
                  className="lease-renew-button"
                  onClick={() => {

                    setShowDetails(
                      false
                    );

                    openRenewal(
                      selectedLease
                    );

                  }}
                >
                  Renew Lease
                </button>

              )}

            </div>

          </div>

        </div>
      )}


      {/* ======================================
          RENEW MODAL
      ======================================= */}

      {showRenewal &&
        selectedLease && (

        <div
          className="leases-modal-overlay"
          onClick={() => {

            if (!saving) {
              closeAllModals();
            }

          }}
        >

          <div
            className="lease-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            <div className="lease-modal-header">

              <div>

                <span>
                  LEASE RENEWAL
                </span>

                <h2>
                  Renew Lease
                </h2>

                <p>
                  Previous lease remains in
                  history.
                </p>

              </div>


              <button
                className="lease-modal-close"
                onClick={
                  closeAllModals
                }
                disabled={
                  saving
                }
              >
                ×
              </button>

            </div>


            <div className="renewal-summary">

              <div>

                <span>
                  CURRENT EXPIRY
                </span>

                <strong>
                  {
                    formatDate(
                      selectedLease.end_date
                    )
                  }
                </strong>

              </div>


              <div>

                <span>
                  TENANT
                </span>

                <strong>
                  {
                    selectedLease.tenant_name
                  }
                </strong>

              </div>


              <div>

                <span>
                  UNIT
                </span>

                <strong>
                  {
                    selectedLease.unit_number
                  }
                </strong>

              </div>

            </div>


            <form
              className="lease-form"
              onSubmit={
                handleRenew
              }
            >

              <div className="lease-field">

                <label>
                  New Start Date
                </label>

                <input
                  type="date"
                  name="start_date"
                  value={
                    form.start_date
                  }
                  onChange={
                    handleChange
                  }
                  required
                  disabled={
                    saving
                  }
                />

              </div>


              <div className="lease-field">

                <label>
                  New End Date
                </label>

                <input
                  type="date"
                  name="end_date"
                  value={
                    form.end_date
                  }
                  onChange={
                    handleChange
                  }
                  required
                  disabled={
                    saving
                  }
                />

              </div>


              <div className="lease-field">

                <label>
                  Monthly Rent
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  name="monthly_rent"
                  value={
                    form.monthly_rent
                  }
                  onChange={
                    handleChange
                  }
                  required
                  disabled={
                    saving
                  }
                />

              </div>


              <div className="lease-field">

                <label>
                  Security Deposit
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  name="security_deposit"
                  value={
                    form.security_deposit
                  }
                  onChange={
                    handleChange
                  }
                  required
                  disabled={
                    saving
                  }
                />

              </div>


              <div className="lease-field full">

                <label>
                  New Agreement
                </label>

                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={
                    handleFileChange
                  }
                  disabled={
                    saving
                  }
                />

              </div>


              <div className="lease-reminders full">

                <div className="reminders-header">

                  <div>

                    <span>
                      REMINDERS
                    </span>

                    <h3>
                      Renewal reminder schedule
                    </h3>

                  </div>


                  <button
                    type="button"
                    className="add-reminder-button"
                    onClick={
                      addReminder
                    }
                    disabled={
                      saving
                    }
                  >
                    + Add Reminder
                  </button>

                </div>


                {reminders.map(
                  (
                    reminder,
                    index
                  ) => (

                    <div
                      className="reminder-row"
                      key={
                        index
                      }
                    >

                      <input
                        type="number"
                        min="1"
                        max="3650"
                        value={
                          reminder.days_before
                        }
                        onChange={(
                          event
                        ) =>
                          updateReminder(
                            index,
                            "days_before",
                            event
                              .target
                              .value
                          )
                        }
                        disabled={
                          saving
                        }
                      />

                      <span>
                        days before expiry
                      </span>


                      <label className="reminder-toggle">

                        <input
                          type="checkbox"
                          checked={
                            reminder.enabled
                          }
                          onChange={(
                            event
                          ) =>
                            updateReminder(
                              index,
                              "enabled",
                              event
                                .target
                                .checked
                            )
                          }
                          disabled={
                            saving
                          }
                        />

                        Enabled

                      </label>


                      <button
                        type="button"
                        className="remove-reminder-button"
                        onClick={() =>
                          removeReminder(
                            index
                          )
                        }
                        disabled={
                          saving
                        }
                      >
                        Remove
                      </button>

                    </div>

                  )
                )}

              </div>


              <div className="lease-form-actions full">

                <button
                  type="button"
                  className="lease-secondary-button"
                  onClick={
                    closeAllModals
                  }
                  disabled={
                    saving
                  }
                >
                  Cancel
                </button>


                <button
                  type="submit"
                  className="lease-renew-button"
                  disabled={
                    saving
                  }
                >
                  {saving
                    ? "Renewing..."
                    : "Renew Lease"}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

      {/* ONE-TIME TENANT CREDENTIALS MODAL */}
      <TenantCredentialsModal
        isOpen={showCredentialsModal}
        onClose={() => {
          setShowCredentialsModal(false);
          setNewTenantCredentials(null);
          setNewTenantName("");
        }}
        credentials={newTenantCredentials}
        tenantName={newTenantName}
        title="Tenant Login Credentials Created"
        isReset={false}
      />

    </LandlordLayout>
  );
}


export default Leases;