import { useState } from "react";
import {
  CheckIcon,
  ClipboardIcon,
  KeyIcon,
  MailIcon,
  ShieldIcon,
  WarningIcon,
} from "./Icons";
import "./TenantCredentialsModal.css";

export default function TenantCredentialsModal({
  isOpen,
  onClose,
  credentials,
  tenantName,
  title = "Tenant Portal Credentials",
  isReset = false,
}) {
  const [copiedField, setCopiedField] = useState("");

  if (!isOpen || !credentials) return null;

  const handleCopy = (text, fieldName) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => {
      setCopiedField("");
    }, 2500);
  };

  const loginUrl = `${window.location.origin}/tenant/login`;

  return (
    <div className="cred-modal-overlay" onClick={onClose}>
      <div className="cred-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* HEADER */}
        <div className="cred-modal-header">
          <div className="cred-icon-wrap">
            <KeyIcon size={24} />
          </div>
          <div>
            <h3>{title}</h3>
            <p className="cred-subtitle">
              {isReset
                ? "Temporary password generated successfully"
                : "Tenant login account created successfully"}
            </p>
          </div>
          <button
            type="button"
            className="cred-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* BODY */}
        <div className="cred-modal-body">
          {/* EMAIL STATUS BANNER */}
          {credentials.email_sent ? (
            <div className="cred-banner success">
              <CheckIcon size={16} />
              <span>
                An email with login instructions was successfully dispatched to{" "}
                <strong>{credentials.email}</strong>.
              </span>
            </div>
          ) : (
            <div className="cred-banner warning">
              <WarningIcon size={16} />
              <span>
                Email delivery was not sent. Please share these temporary login
                credentials directly with the tenant now.
              </span>
            </div>
          )}

          {tenantName && (
            <div className="cred-tenant-tag">
              <span>Account for:</span>
              <strong>{tenantName}</strong>
            </div>
          )}

          {/* CREDENTIALS BOX */}
          <div className="cred-box">
            {/* PORTAL URL */}
            <div className="cred-row">
              <span className="cred-label">Tenant Portal URL</span>
              <div className="cred-field-action">
                <code className="cred-val">{loginUrl}</code>
                <button
                  type="button"
                  className="btn-copy"
                  onClick={() => handleCopy(loginUrl, "url")}
                  title="Copy Login URL"
                >
                  {copiedField === "url" ? (
                    <span className="copied-tag">
                      <CheckIcon size={12} /> Copied
                    </span>
                  ) : (
                    <ClipboardIcon size={14} />
                  )}
                </button>
              </div>
            </div>

            {/* EMAIL / LOGIN */}
            <div className="cred-row">
              <span className="cred-label">Login Email</span>
              <div className="cred-field-action">
                <code className="cred-val">{credentials.email}</code>
                <button
                  type="button"
                  className="btn-copy"
                  onClick={() => handleCopy(credentials.email, "email")}
                  title="Copy Email"
                >
                  {copiedField === "email" ? (
                    <span className="copied-tag">
                      <CheckIcon size={12} /> Copied
                    </span>
                  ) : (
                    <ClipboardIcon size={14} />
                  )}
                </button>
              </div>
            </div>

            {/* USERNAME */}
            {credentials.username && (
              <div className="cred-row">
                <span className="cred-label">Username</span>
                <div className="cred-field-action">
                  <code className="cred-val">{credentials.username}</code>
                  <button
                    type="button"
                    className="btn-copy"
                    onClick={() => handleCopy(credentials.username, "username")}
                    title="Copy Username"
                  >
                    {copiedField === "username" ? (
                      <span className="copied-tag">
                        <CheckIcon size={12} /> Copied
                      </span>
                    ) : (
                      <ClipboardIcon size={14} />
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* TEMPORARY PASSWORD */}
            <div className="cred-row highlight-password">
              <div className="cred-label-row">
                <span className="cred-label text-bold">TEMPORARY PASSWORD</span>
                <span className="cred-one-time-badge">ONE-TIME VIEW</span>
              </div>
              <div className="cred-field-action">
                <span className="cred-password-display">
                  {credentials.temporary_password}
                </span>
                <button
                  type="button"
                  className="btn-copy-password"
                  onClick={() =>
                    handleCopy(credentials.temporary_password, "password")
                  }
                  title="Copy Password"
                >
                  {copiedField === "password" ? (
                    <>
                      <CheckIcon size={14} /> Copied!
                    </>
                  ) : (
                    <>
                      <ClipboardIcon size={14} /> Copy Password
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* SECURITY WARNING */}
          <div className="cred-security-notice">
            <ShieldIcon size={16} />
            <p>
              <strong>Security Policy:</strong> This temporary password will
              never be displayed again. The tenant will be strictly required to
              set a new personal password upon their first login.
            </p>
          </div>
        </div>

        {/* FOOTER */}
        <div className="cred-modal-footer">
          <button
            type="button"
            className="btn-cred-dismiss"
            onClick={onClose}
          >
            I Have Saved These Credentials
          </button>
        </div>
      </div>
    </div>
  );
}
