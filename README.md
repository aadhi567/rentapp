# RentEase - Commercial Property Management Platform

RentEase is a full-featured commercial real estate and property management platform. It streamlines unit leasing, tenant management, GST-compliant billing, PDF generation, and automated tenant email communications for invoices and receipts.

---

## Automated Email System (Gmail SMTP)

RentEase automatically sends official tax invoices and payment receipts directly to tenants' registered email addresses using **Gmail SMTP** through the dedicated sender account:

- **Sender Address**: `homrent1@gmail.com`
- **Sender Display Name**: `RentEase Billing <homrent1@gmail.com>`
- **Recipients**: Sent dynamically to each tenant's stored email address (`tenant.email` or `tenant.user.email`).

---

### Step-by-Step Gmail SMTP Setup Guide

To enable real email dispatch from `homrent1@gmail.com`:

#### 1. Enable 2-Step Verification on Google Account
1. Sign in to [Google Account](https://myaccount.google.com/) using `homrent1@gmail.com`.
2. Navigate to **Security** from the left-hand navigation.
3. Under the **"How you sign in to Google"** section, click on **2-Step Verification** and follow the prompts to turn it on.

#### 2. Generate a Google App Password
1. Once 2-Step Verification is enabled, return to the **Security** tab.
2. In the search box at the top or under 2-Step Verification, search for **App passwords**.
3. Enter an app name (e.g., `RentEase Backend`) and click **Create**.
4. Google will display a **16-character passcode** (e.g., `abcd efgh ijkl mnop`).
5. Copy this passcode immediately (remove any spaces when setting the variable).

> [!WARNING]
> **Never use your personal Google account password!** Google blocks standard password logins for SMTP. You MUST use a 16-character Google App Password.

#### 3. Configure Hosting Platform Environment Variables (e.g. Render)
In your Render Dashboard (or production server environment):
1. Go to your `rentease-backend` Web Service.
2. Navigate to **Environment** settings.
3. Add the following secret environment variable:
   - **Key**: `EMAIL_HOST_PASSWORD`
   - **Value**: `[Your 16-character Google App Password without spaces]`
4. Save changes. Render will automatically redeploy the backend with the new credentials.

> [!CAUTION]
> **CRITICAL SECURITY REQUIREMENT - NEVER COMMIT SECRETS TO GIT**:
> - Never commit your `.env` file or Google App Password to Git or public repositories.
> - `.env` is listed in `.gitignore` and must stay excluded from version control.
> - `render.yaml` intentionally omits `EMAIL_HOST_PASSWORD` so that secrets are exclusively configured in the hosting dashboard.

---

### Environment Variables Reference

Configure these in your local `.env` (copied from `.env.example`) or production environment:

```env
# Email Configuration (Gmail SMTP)
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=homrent1@gmail.com
EMAIL_HOST_PASSWORD=replace-with-google-app-password
DEFAULT_FROM_EMAIL=RentEase Billing <homrent1@gmail.com>
```

#### Development Fallback Behavior
- When `DEBUG=True` and `EMAIL_HOST_PASSWORD` is not supplied, RentEase automatically falls back to `django.core.mail.backends.console.EmailBackend`. Emails will be output directly to the terminal console for safe local development.
- When `EMAIL_HOST_PASSWORD` (or `EMAIL_BACKEND=...smtp.EmailBackend`) is provided, RentEase connects directly to Gmail SMTP.

---

### Automated Billing & Email Workflow

1. **Automated Monthly Invoices**:
   - On the 1st of each month, commercial rent invoices can be generated across all active leases.
   - Generates the official tax invoice PDF (`rent-invoice-{id}.pdf`) with complete GST breakdowns (Base Rent, CGST, SGST, Grand Total) and payment instructions.
   - Automatically emails the PDF and billing summary to the tenant's registered email.
   - Can be scheduled via cron or triggered via:
     ```bash
     python manage.py generate_monthly_invoices
     ```
     Or from the web dashboard under **Payments -> Generate Monthly Invoices**.

2. **Automatic Payment Receipts**:
   - When a rent payment is marked as `paid` (via API, dashboard, or creation), a receipt email is **automatically dispatched**.
   - Generates the official payment receipt PDF (`rent-receipt-{id}.pdf`) detailing payment method, transaction ID, date, and GST breakdown.
   - Skipped if the payment was already marked paid and the receipt was already delivered, preventing duplicate emails.

3. **Audit Logging & Retries**:
   - Every email attempt creates or updates a `BillingEmailLog` record containing:
     - `payment`: Reference to payment
     - `email_type`: `invoice` or `receipt`
     - `recipient_email`: Tenant's email address
     - `status`: `sent`, `failed`, or `pending`
     - `sent_at`: Timestamp of successful delivery
     - `error_message`: Failure reason (e.g. missing tenant email, template missing)
     - `retry_count`: Number of retry attempts
   - Failed emails can be retried via the API (`POST /api/payments/{id}/retry-email/`) or via management command:
     ```bash
     python manage.py retry_failed_billing_emails
     ```

---

### Running Tests & Building

#### Backend Tests
```bash
# Run unit tests
.venv\Scripts\python.exe manage.py test properties
```

#### Frontend Production Build
```bash
# In the rentease directory
cd rentease
npm run build
```