import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import LandlordLayout from "../components/LandlordLayout";
import "./InvoiceSettings.css";

const API_URL = import.meta.env.VITE_API_URL || "https://rentapp-daiv.onrender.com/api";

const EMPTY_FORM = {
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
};

function InvoiceSettings() {
  const navigate = useNavigate();
  const token = localStorage.getItem("access_token");

  const [settingsId, setSettingsId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [logoFile, setLogoFile] = useState(null);
  const [signatureFile, setSignatureFile] = useState(null);
  const [logoUrl, setLogoUrl] = useState(null);
  const [signatureUrl, setSignatureUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const logout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
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

  const loadSettings = async () => {
    if (!token) {
      logout();
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/invoice-settings/`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        logout();
        return;
      }

      const data = await readResponse(response);

      if (!response.ok) {
        throw new Error(
          data.detail || "Unable to load invoice settings."
        );
      }

      const record = Array.isArray(data) ? data[0] : data;

      if (record) {
        setSettingsId(record.id);
        setForm({
          business_name: record.business_name || "",
          address: record.address || "",
          city: record.city || "",
          state: record.state || "",
          pincode: record.pincode || "",
          phone: record.phone || "",
          email: record.email || "",
          gstin: record.gstin || "",
          bank_name: record.bank_name || "",
          account_number: record.account_number || "",
          ifsc: record.ifsc || "",
          branch: record.branch || "",
          payment_instructions: record.payment_instructions || "",
        });
        setLogoUrl(record.logo_url || null);
        setSignatureUrl(record.signature_url || null);
      }
    } catch (err) {
      setError(err.message || "Unable to load invoice settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const validateFile = (file, label) => {
    if (!file) return null;

    const allowed = [
      "image/png",
      "image/jpeg",
      "image/webp",
    ];

    if (!allowed.includes(file.type)) {
      return `${label} must be a PNG, JPG or WEBP image.`;
    }

    if (file.size > 5 * 1024 * 1024) {
      return `${label} must be 5 MB or smaller.`;
    }

    return null;
  };

  const handleFileChange = (event, type) => {
    const file = event.target.files?.[0] || null;
    const label = type === "logo" ? "Logo" : "Signature";
    const validationError = validateFile(file, label);

    setError(validationError || "");

    if (validationError) return;

    if (type === "logo") {
      setLogoFile(file);
      setLogoUrl(file ? URL.createObjectURL(file) : logoUrl);
    } else {
      setSignatureFile(file);
      setSignatureUrl(
        file ? URL.createObjectURL(file) : signatureUrl
      );
    }
  };

  const saveSettings = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const body = new FormData();

      Object.entries(form).forEach(([key, value]) => {
        body.append(key, value);
      });

      if (logoFile) body.append("logo", logoFile);
      if (signatureFile) body.append("signature", signatureFile);

      const isUpdate = Boolean(settingsId);
      const url = isUpdate
        ? `${API_URL}/invoice-settings/${settingsId}/`
        : `${API_URL}/invoice-settings/`;

      const response = await fetch(url, {
        method: isUpdate ? "PUT" : "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body,
      });

      if (response.status === 401) {
        logout();
        return;
      }

      const data = await readResponse(response);

      if (!response.ok) {
        const firstError =
          data.detail ||
          Object.values(data).flat()[0] ||
          "Unable to save invoice settings.";
        throw new Error(firstError);
      }

      setSettingsId(data.id);
      setLogoUrl(data.logo_url || logoUrl);
      setSignatureUrl(data.signature_url || signatureUrl);
      setLogoFile(null);
      setSignatureFile(null);
      setMessage("Invoice settings saved successfully.");
    } catch (err) {
      setError(err.message || "Unable to save invoice settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="invoice-settings-loading">
        <div className="invoice-settings-spinner" />
        <p>Loading invoice settings...</p>
      </div>
    );
  }

  return (
    <LandlordLayout
      breadcrumb="Invoice Template"
      title="Invoice Settings & Template"
      subtitle="Customize the business details, banking info, logo and signature for rent invoices."
    >

      {error && (
        <div className="invoice-settings-alert error">
          <span>{error}</span>
        </div>
      )}

      {message && (
        <div className="invoice-settings-alert success">
          <span>{message}</span>
        </div>
      )}

      <form onSubmit={saveSettings} className="invoice-settings-form">
        <section className="invoice-settings-card">
          <div className="invoice-settings-card-heading">
            <div>
              <small>BUSINESS DETAILS</small>
              <h2>Invoice information</h2>
            </div>
          </div>

          <div className="invoice-settings-grid">
            <label>
              Business / Landlord Name
              <input
                name="business_name"
                value={form.business_name}
                onChange={handleChange}
                placeholder="name"
              />
            </label>

            <label>
              Phone
              <input
                name="phone"
                value={form.phone}
                onChange={handleChange}
              />
            </label>

            <label>
              Email
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
              />
            </label>

            <label>
              GSTIN
              <input
                name="gstin"
                value={form.gstin}
                onChange={handleChange}
              />
            </label>

            <label className="full-width">
              Address
              <input
                name="address"
                value={form.address}
                onChange={handleChange}
              />
            </label>

            <label>
              City
              <input
                name="city"
                value={form.city}
                onChange={handleChange}
              />
            </label>

            <label>
              State
              <input
                name="state"
                value={form.state}
                onChange={handleChange}
              />
            </label>

            <label>
              Pincode
              <input
                name="pincode"
                value={form.pincode}
                onChange={handleChange}
              />
            </label>
          </div>
        </section>

        <section className="invoice-settings-card">
          <div className="invoice-settings-card-heading">
            <div>
              <small>INVOICE BRANDING</small>
              <h2>Logo & signature</h2>
              <p>
                These uploads will be reused automatically on future invoices.
              </p>
            </div>
          </div>

          <div className="invoice-assets-grid">
            <div className="invoice-asset-box">
              <div className="invoice-asset-preview logo-preview">
                {logoUrl ? (
                  <img src={logoUrl} alt="Invoice logo preview" />
                ) : (
                  <span>LOGO</span>
                )}
              </div>

              <h3>Top-right image</h3>
              <p>Displayed in the top-right corner of the invoice.</p>

              <label className="invoice-upload-button">
                Choose image
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => handleFileChange(event, "logo")}
                />
              </label>
            </div>

            <div className="invoice-asset-box">
              <div className="invoice-asset-preview signature-preview">
                {signatureUrl ? (
                  <img
                    src={signatureUrl}
                    alt="Invoice signature preview"
                  />
                ) : (
                  <span>SIGNATURE</span>
                )}
              </div>

              <h3>Authorized signature</h3>
              <p>Displayed above the Authorized Signature label.</p>

              <label className="invoice-upload-button">
                Choose signature
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) =>
                    handleFileChange(event, "signature")
                  }
                />
              </label>
            </div>
          </div>
        </section>

        <section className="invoice-settings-card">
          <div className="invoice-settings-card-heading">
            <div>
              <small>PAYMENT DETAILS</small>
              <h2>Bank & payment instructions</h2>
            </div>
          </div>

          <div className="invoice-settings-grid">
            <label>
              Bank Name
              <input
                name="bank_name"
                value={form.bank_name}
                onChange={handleChange}
              />
            </label>

            <label>
              Account Number
              <input
                name="account_number"
                value={form.account_number}
                onChange={handleChange}
              />
            </label>

            <label>
              IFSC
              <input
                name="ifsc"
                value={form.ifsc}
                onChange={handleChange}
              />
            </label>

            <label>
              Branch
              <input
                name="branch"
                value={form.branch}
                onChange={handleChange}
              />
            </label>

            <label className="full-width">
              Payment Instructions
              <textarea
                name="payment_instructions"
                rows="5"
                value={form.payment_instructions}
                onChange={handleChange}
                placeholder="Pay by UPI, bank transfer or cheque..."
              />
            </label>
          </div>
        </section>

        <div className="invoice-settings-actions">
          <button
            type="button"
            className="invoice-settings-cancel"
            onClick={() => navigate("/landlord/dashboard")}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="invoice-settings-save"
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Invoice Settings"}
          </button>
        </div>
      </form>
    </LandlordLayout>
  );
}

export default InvoiceSettings;
