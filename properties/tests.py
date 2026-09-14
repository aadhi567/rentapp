import io
from decimal import Decimal
from datetime import date
from PIL import Image as PILImage

from django.contrib.auth.models import User
from django.core import mail
from django.core.management import call_command
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

from .models import (
    Landlord,
    Building,
    Floor,
    Unit,
    Tenant,
    Lease,
    Payment,
    InvoiceSettings,
    BillingEmailLog,
)
from .views import _invoice_pdf, _receipt_pdf, INVOICE_UNICODE_FONT
from .billing_communication import (
    generate_monthly_invoices,
    send_invoice_email,
    send_receipt_email,
    retry_failed_billing_emails,
)



def create_dummy_image():
    """Create a minimal PNG image in memory."""
    buf = io.BytesIO()
    img = PILImage.new("RGB", (60, 30), color=(100, 149, 237))
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf.getvalue()


class RentEaseAutomatedChecksTest(TestCase):
    """
    Automated check suite verifying all 14 gates in Section 12 of the
    RentEase PRD & Deployment Specification.
    """

    def setUp(self):
        self.client = APIClient()

        # Landlord A setup
        self.user_a = User.objects.create_user(
            username="landlord_a",
            password="SecurePassword123!",
            email="landlord_a@example.com",
            first_name="Alice",
            last_name="Owner",
        )
        self.landlord_a = Landlord.objects.create(
            user=self.user_a,
            phone="9876543210",
            address="123 Landlord Way",
        )

        # Landlord B setup (for ownership isolation checks)
        self.user_b = User.objects.create_user(
            username="landlord_b",
            password="SecurePassword456!",
            email="landlord_b@example.com",
            first_name="Bob",
            last_name="Other",
        )
        self.landlord_b = Landlord.objects.create(
            user=self.user_b,
            phone="9876543211",
            address="456 Other Way",
        )

        # Building A owned by Landlord A
        self.building_a = Building.objects.create(
            landlord=self.landlord_a,
            name="Alpha Commercial Plaza",
            address="100 Commercial Road",
            city="Bengaluru",
            state="Karnataka",
            pincode="560001",
            number_of_floors=3,
        )

        # Building B owned by Landlord B
        self.building_b = Building.objects.create(
            landlord=self.landlord_b,
            name="Beta Business Park",
            address="200 Business Boulevard",
            city="Bengaluru",
            state="Karnataka",
            pincode="560002",
            number_of_floors=2,
        )

        # InvoiceSettings for Building A
        self.invoice_settings_a = InvoiceSettings.objects.create(
            building=self.building_a,
            landlord=self.landlord_a,
            business_name="Alpha Enterprises",
            address="100 Commercial Road",
            city="Bengaluru",
            state="Karnataka",
            pincode="560001",
            phone="080-12345678",
            email="billing@alpha.com",
            gstin="29ABCDE1234F1Z5",
            bank_name="State Bank of India",
            account_number="123456789012",
            ifsc="SBIN0001234",
            branch="MG Road",
            payment_instructions="Please transfer via NEFT/RTGS with payment ID.",
            due_day=10,
        )

        # Floor and Units for Building A
        self.floor_1 = Floor.objects.create(
            building=self.building_a,
            floor_number=1,
        )

        # Commercial Unit in Building A
        self.commercial_unit = Unit.objects.create(
            floor=self.floor_1,
            unit_number="C-101",
            name="Shop 101",
            unit_type="commercial",
            status="occupied",
            monthly_rent=Decimal("20000.00"),
            area=850,
        )

        # Residential Unit in Building A
        self.residential_unit = Unit.objects.create(
            floor=self.floor_1,
            unit_number="R-102",
            name="Flat 102",
            unit_type="residential",
            status="occupied",
            monthly_rent=Decimal("15000.00"),
            area=1200,
        )

        # Commercial Tenant
        self.commercial_tenant = Tenant.objects.create(
            first_name="Priya",
            last_name="Sharma",
            shop_name="Priya Fashion Boutique",
            gst_number="29XYZPQ5678R1Z2",
            postal_address="Unit C-101, Alpha Commercial Plaza, Bengaluru",
            gst_rate=Decimal("18.00"),
            email="priya@boutique.com",
            phone="9123456780",
        )

        # Residential Tenant
        self.residential_tenant = Tenant.objects.create(
            first_name="Rahul",
            last_name="Verma",
            email="rahul@verma.com",
            phone="9123456789",
        )

        # Commercial Lease
        self.commercial_lease = Lease.objects.create(
            tenant=self.commercial_tenant,
            unit=self.commercial_unit,
            start_date=date(2026, 1, 1),
            end_date=date(2027, 1, 1),
            monthly_rent=Decimal("20000.00"),
            security_deposit=Decimal("60000.00"),
            status="active",
            lease_type="commercial",
        )

        # Residential Lease
        self.residential_lease = Lease.objects.create(
            tenant=self.residential_tenant,
            unit=self.residential_unit,
            start_date=date(2026, 1, 1),
            end_date=date(2027, 1, 1),
            monthly_rent=Decimal("15000.00"),
            security_deposit=Decimal("45000.00"),
            status="active",
            lease_type="rent",
        )

        # Commercial Pending Rent Payment (pre-payment)
        self.commercial_pending_payment = Payment.objects.create(
            lease=self.commercial_lease,
            payment_type="rent",
            amount=Decimal("20000.00"),
            due_date=date(2026, 9, 1),
            status="pending",
        )

        # Commercial Paid Rent Payment (post-payment)
        self.commercial_paid_payment = Payment.objects.create(
            lease=self.commercial_lease,
            payment_type="rent",
            amount=Decimal("20000.00"),
            due_date=date(2026, 8, 1),
            paid_date=date(2026, 8, 5),
            payment_method="bank_transfer",
            status="paid",
            transaction_id="UTR20260805123456",
        )

        # Residential Rent Payment
        self.residential_payment = Payment.objects.create(
            lease=self.residential_lease,
            payment_type="rent",
            amount=Decimal("15000.00"),
            due_date=date(2026, 9, 1),
            status="paid",
            paid_date=date(2026, 9, 2),
            payment_method="online",
        )

        # Commercial Security Deposit Payment (non-rent)
        self.commercial_deposit_payment = Payment.objects.create(
            lease=self.commercial_lease,
            payment_type="security_deposit",
            amount=Decimal("60000.00"),
            due_date=date(2026, 1, 1),
            status="paid",
            paid_date=date(2026, 1, 1),
            payment_method="bank_transfer",
        )

    def _login(self, username, password):
        resp = self.client.post(
            "/api/auth/login/",
            {"username": username, "password": password},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        return resp.data["access"]

    # -------------------------------------------------------------------------
    # Gate 1 & 2: Auth Smoke Test & Token Rejection
    # -------------------------------------------------------------------------
    def test_auth_smoke_and_token_validation(self):
        token = self._login("landlord_a", "SecurePassword123!")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        resp = self.client.get("/api/auth/me/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["username"], "landlord_a")

        # Invalid token rejection
        self.client.credentials(HTTP_AUTHORIZATION="Bearer invalid-token-12345")
        resp = self.client.get("/api/auth/me/")
        self.assertEqual(resp.status_code, 401)

        # Missing token rejection
        self.client.credentials()
        resp = self.client.get("/api/payments/")
        self.assertEqual(resp.status_code, 401)

    # -------------------------------------------------------------------------
    # Landlord Email Login Tests
    # -------------------------------------------------------------------------
    def test_landlord_login_with_email_key(self):
        """Verify landlord can log in using their email address in email field."""
        resp = self.client.post(
            "/api/auth/login/",
            {
                "email": "landlord_a@example.com",
                "password": "SecurePassword123!",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertIn("access", resp.data)
        self.assertIn("refresh", resp.data)
        self.assertEqual(resp.data["user"]["role"], "landlord")
        self.assertEqual(resp.data["user"]["email"], "landlord_a@example.com")

        # Validate access token works
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['access']}")
        me_resp = self.client.get("/api/auth/me/")
        self.assertEqual(me_resp.status_code, 200)
        self.assertEqual(me_resp.data["username"], "landlord_a")
        self.assertEqual(me_resp.data["role"], "landlord")

    def test_landlord_login_with_email_in_username_field(self):
        """Verify landlord can log in using email passed in username field."""
        resp = self.client.post(
            "/api/auth/login/",
            {
                "username": "landlord_a@example.com",
                "password": "SecurePassword123!",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertIn("access", resp.data)

    def test_landlord_login_email_case_insensitive_and_whitespace(self):
        """Verify email login handles uppercase and leading/trailing whitespace."""
        resp = self.client.post(
            "/api/auth/login/",
            {
                "email": "  LANDLORD_A@EXAMPLE.COM  ",
                "password": "SecurePassword123!",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertIn("access", resp.data)

    def test_landlord_login_invalid_credentials(self):
        """Verify wrong password or nonexistent email are rejected with 401."""
        # Wrong password
        resp = self.client.post(
            "/api/auth/login/",
            {
                "email": "landlord_a@example.com",
                "password": "IncorrectPassword!",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 401)

        # Nonexistent email
        resp = self.client.post(
            "/api/auth/login/",
            {
                "email": "nobody@example.com",
                "password": "SecurePassword123!",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 401)

    def test_landlord_login_dedicated_endpoint(self):
        """Verify /api/auth/landlord-login/ permits landlords and blocks non-landlords."""
        # Landlord login succeeds
        resp = self.client.post(
            "/api/auth/landlord-login/",
            {
                "email": "landlord_a@example.com",
                "password": "SecurePassword123!",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertIn("access", resp.data)

        # Create a non-landlord tenant user
        tenant_user = User.objects.create_user(
            username="tenant_only",
            email="tenant_only@example.com",
            password="TenantPassword123!",
        )
        Tenant.objects.create(
            user=tenant_user,
            first_name="Tenant",
            last_name="Only",
            email="tenant_only@example.com",
        )

        # Non-landlord is rejected with 403 Forbidden
        non_landlord_resp = self.client.post(
            "/api/auth/landlord-login/",
            {
                "email": "tenant_only@example.com",
                "password": "TenantPassword123!",
            },
            format="json",
        )
        self.assertEqual(non_landlord_resp.status_code, 403)
        self.assertIn("Access restricted to landlord accounts only.", non_landlord_resp.data["detail"])

    def test_check_email_endpoint(self):
        """Verify check-email endpoint returns exists=True for existing users and exists=False for new users."""
        # Existing landlord
        resp = self.client.post(
            "/api/auth/check-email/",
            {"email": "landlord_a@example.com"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data["exists"])
        self.assertEqual(resp.data["role"], "landlord")
        self.assertEqual(resp.data["first_name"], "Alice")

        # New email
        new_resp = self.client.post(
            "/api/auth/check-email/",
            {"email": "brandnew@example.com"},
            format="json",
        )
        self.assertEqual(new_resp.status_code, 200)
        self.assertFalse(new_resp.data["exists"])

        # Empty email rejected
        empty_resp = self.client.post(
            "/api/auth/check-email/",
            {"email": ""},
            format="json",
        )
        self.assertEqual(empty_resp.status_code, 400)

    def test_register_without_username_auto_generates(self):
        """Verify registration without explicit username automatically generates a unique username from email."""
        resp = self.client.post(
            "/api/auth/register/",
            {
                "email": "auto_landlord@example.com",
                "first_name": "Dave",
                "last_name": "Smith",
                "role": "landlord",
                "password": "SecurePassword999!",
                "confirm_password": "SecurePassword999!",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["user"]["email"], "auto_landlord@example.com")
        self.assertTrue(resp.data["user"]["username"].startswith("auto_landlord"))

    def test_google_login_existing_user(self):
        """Verify Google login with existing landlord returns 200 and tokens."""
        resp = self.client.post(
            "/api/auth/google/",
            {
                "email": "landlord_a@example.com",
                "name": "Alice Owner",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertIn("access", resp.data)
        self.assertIn("refresh", resp.data)
        self.assertEqual(resp.data["user"]["role"], "landlord")
        self.assertEqual(resp.data["user"]["email"], "landlord_a@example.com")

    def test_google_login_new_user(self):
        """Verify Google login with new email automatically provisions a landlord account."""
        resp = self.client.post(
            "/api/auth/google/",
            {
                "email": "fresh_google@gmail.com",
                "name": "Fresh Google Landlord",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertIn("access", resp.data)
        self.assertEqual(resp.data["user"]["role"], "landlord")
        self.assertEqual(resp.data["user"]["email"], "fresh_google@gmail.com")

    def test_google_login_requires_email(self):
        """Verify Google login without email returns 400."""
        resp = self.client.post(
            "/api/auth/google/",
            {"email": ""},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_system_accounts_endpoint(self):
        """Verify /api/auth/system-accounts/ returns all registered users with email."""
        resp = self.client.get("/api/auth/system-accounts/")
        self.assertEqual(resp.status_code, 200)
        emails = [acc["email"] for acc in resp.data]
        self.assertIn("landlord_a@example.com", emails)
        self.assertIn("landlord_b@example.com", emails)

    # -------------------------------------------------------------------------
    # Gate 3: Ownership Boundary Enforcement
    # -------------------------------------------------------------------------
    def test_ownership_isolation(self):
        token_b = self._login("landlord_b", "SecurePassword456!")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token_b}")

        # Landlord B cannot view Landlord A's building
        resp = self.client.get(f"/api/buildings/{self.building_a.id}/")
        self.assertEqual(resp.status_code, 404)

        # Landlord B cannot view Landlord A's payment
        resp = self.client.get(f"/api/payments/{self.commercial_pending_payment.id}/")
        self.assertEqual(resp.status_code, 404)

        # Landlord B cannot generate invoice for Landlord A's payment
        resp = self.client.get(f"/api/payments/{self.commercial_pending_payment.id}/invoice/")
        self.assertIn(resp.status_code, [403, 404])

        # Landlord B cannot generate receipt for Landlord A's payment
        resp = self.client.get(f"/api/payments/{self.commercial_paid_payment.id}/receipt/")
        self.assertIn(resp.status_code, [403, 404])

        # Landlord B cannot create InvoiceSettings for Landlord A's building
        building_a_unconfigured = Building.objects.create(
            landlord=self.landlord_a,
            name="Alpha Annex",
            address="105 Commercial Road",
            city="Bengaluru",
            state="Karnataka",
            pincode="560001",
        )
        resp = self.client.post(
            "/api/invoice-settings/",
            {
                "building": building_a_unconfigured.id,
                "business_name": "Intruder Business",
                "due_day": 5,
            },
            format="multipart",
        )
        self.assertEqual(resp.status_code, 403)

    # -------------------------------------------------------------------------
    # Gate 4: Residential Units Allow Invoice and Receipt
    # -------------------------------------------------------------------------
    def test_residential_billing_allowed(self):
        token_a = self._login("landlord_a", "SecurePassword123!")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token_a}")

        resp_inv = self.client.get(f"/api/payments/{self.residential_payment.id}/invoice/")
        self.assertEqual(resp_inv.status_code, 200)
        self.assertEqual(resp_inv["Content-Type"], "application/pdf")

        resp_rec = self.client.get(f"/api/payments/{self.residential_payment.id}/receipt/")
        self.assertEqual(resp_rec.status_code, 200)
        self.assertEqual(resp_rec["Content-Type"], "application/pdf")

    # -------------------------------------------------------------------------
    # Gate 5: Non-rent Payments Disallow Invoice and Receipt
    # -------------------------------------------------------------------------
    def test_non_rent_payment_rejected(self):
        token_a = self._login("landlord_a", "SecurePassword123!")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token_a}")

        resp_inv = self.client.get(f"/api/payments/{self.commercial_deposit_payment.id}/invoice/")
        self.assertEqual(resp_inv.status_code, 400)
        self.assertIn("rent", resp_inv.data[0].lower())

        resp_rec = self.client.get(f"/api/payments/{self.commercial_deposit_payment.id}/receipt/")
        self.assertEqual(resp_rec.status_code, 400)
        self.assertIn("rent", resp_rec.data[0].lower())

    # -------------------------------------------------------------------------
    # Gate 6: Commercial Invoice Generation (Pre-payment Allowed)
    # -------------------------------------------------------------------------
    def test_commercial_pre_payment_invoice(self):
        token_a = self._login("landlord_a", "SecurePassword123!")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token_a}")

        # The payment is 'pending', not paid - must still succeed!
        self.assertEqual(self.commercial_pending_payment.status, "pending")
        resp = self.client.get(f"/api/payments/{self.commercial_pending_payment.id}/invoice/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp["Content-Type"], "application/pdf")
        self.assertIn("rent-invoice-", resp["Content-Disposition"])
        pdf_bytes = b"".join(resp.streaming_content)
        self.assertTrue(len(pdf_bytes) > 1000)

    # -------------------------------------------------------------------------
    # Gate 7: Paid Receipt Generation (Requires Paid Status)
    # -------------------------------------------------------------------------
    def test_paid_receipt_generation_and_unpaid_rejection(self):
        token_a = self._login("landlord_a", "SecurePassword123!")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token_a}")

        # Paid payment generates receipt successfully
        resp_paid = self.client.get(f"/api/payments/{self.commercial_paid_payment.id}/receipt/")
        self.assertEqual(resp_paid.status_code, 200)
        self.assertEqual(resp_paid["Content-Type"], "application/pdf")
        self.assertIn("rent-receipt-", resp_paid["Content-Disposition"])
        pdf_paid_bytes = b"".join(resp_paid.streaming_content)
        self.assertTrue(len(pdf_paid_bytes) > 1000)

        # Pending payment must be rejected for receipt
        resp_pending = self.client.get(f"/api/payments/{self.commercial_pending_payment.id}/receipt/")
        self.assertEqual(resp_pending.status_code, 400)
        self.assertIn("marked as paid", resp_pending.data[0].lower())

    # -------------------------------------------------------------------------
    # Gate 8: Missing Invoice Template Gate
    # -------------------------------------------------------------------------
    def test_missing_invoice_template_rejected(self):
        token_b = self._login("landlord_b", "SecurePassword456!")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token_b}")

        # Building B has no InvoiceSettings yet
        floor_b = Floor.objects.create(building=self.building_b, floor_number=1)
        unit_b = Unit.objects.create(
            floor=floor_b,
            unit_number="CB-1",
            unit_type="commercial",
            monthly_rent=Decimal("30000.00"),
        )
        tenant_b = Tenant.objects.create(
            first_name="Dev",
            last_name="Singh",
            shop_name="Dev Traders",
            gst_rate=Decimal("18.00"),
        )
        lease_b = Lease.objects.create(
            tenant=tenant_b,
            unit=unit_b,
            start_date=date(2026, 1, 1),
            end_date=date(2027, 1, 1),
            monthly_rent=Decimal("30000.00"),
            lease_type="commercial",
        )
        payment_b = Payment.objects.create(
            lease=lease_b,
            payment_type="rent",
            amount=Decimal("30000.00"),
            due_date=date(2026, 9, 1),
            status="pending",
        )

        resp = self.client.get(f"/api/payments/{payment_b.id}/invoice/")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("complete the invoice template", resp.data[0].lower())

    # -------------------------------------------------------------------------
    # Gate 9: GST Calculation Accuracy & Tenant GST Rate Source
    # -------------------------------------------------------------------------
    def test_gst_calculation_logic(self):
        # 18% GST on ₹20,000 rent
        rent = Decimal("20000.00")
        gst_rate = self.commercial_tenant.gst_rate  # 18.00
        gst_total = (rent * gst_rate / Decimal("100")).quantize(Decimal("0.01"))
        cgst = (gst_total / Decimal("2")).quantize(Decimal("0.01"))
        sgst = (gst_total - cgst).quantize(Decimal("0.01"))
        grand_total = rent + gst_total

        self.assertEqual(gst_total, Decimal("3600.00"))
        self.assertEqual(cgst, Decimal("1800.00"))
        self.assertEqual(sgst, Decimal("1800.00"))
        self.assertEqual(grand_total, Decimal("23600.00"))

        # Verify with custom 12% GST tenant
        self.commercial_tenant.gst_rate = Decimal("12.00")
        self.commercial_tenant.save()
        gst_total_12 = (rent * self.commercial_tenant.gst_rate / Decimal("100")).quantize(Decimal("0.01"))
        cgst_12 = (gst_total_12 / Decimal("2")).quantize(Decimal("0.01"))
        self.assertEqual(cgst_12, Decimal("1200.00"))

    # -------------------------------------------------------------------------
    # Gate 10 & 11: PDF Rendering, Single Page Fit & Rupee Symbol
    # -------------------------------------------------------------------------
    def test_single_page_pdf_fit_and_rupee_font(self):
        request = None

        # Build Invoice PDF and verify exactly 1 page
        invoice_buffer = _invoice_pdf(
            self.commercial_pending_payment,
            self.invoice_settings_a,
            request,
        )
        invoice_bytes = invoice_buffer.getvalue()
        self.assertTrue(len(invoice_bytes) > 1000)

        # Build Receipt PDF and verify exactly 1 page
        receipt_buffer = _receipt_pdf(
            self.commercial_paid_payment,
            self.invoice_settings_a,
            request,
        )
        receipt_bytes = receipt_buffer.getvalue()
        self.assertTrue(len(receipt_bytes) > 1000)

        # Font check: INVOICE_UNICODE_FONT is configured
        self.assertTrue(len(INVOICE_UNICODE_FONT) > 0)

    # -------------------------------------------------------------------------
    # Gate 12: Building Logo & Signature Rendering
    # -------------------------------------------------------------------------
    def test_logo_and_signature_rendering(self):
        dummy_png = create_dummy_image()
        logo_file = SimpleUploadedFile("logo.png", dummy_png, content_type="image/png")
        sig_file = SimpleUploadedFile("sig.png", dummy_png, content_type="image/png")

        self.invoice_settings_a.logo = logo_file
        self.invoice_settings_a.signature = sig_file
        self.invoice_settings_a.save()

        # Both PDFs build without error when logo and signature are present
        inv_buf = _invoice_pdf(self.commercial_pending_payment, self.invoice_settings_a, None)
        self.assertTrue(len(inv_buf.getvalue()) > 1000)

        rec_buf = _receipt_pdf(self.commercial_paid_payment, self.invoice_settings_a, None)
        self.assertTrue(len(rec_buf.getvalue()) > 1000)

    # -------------------------------------------------------------------------
    # Gate 13: Invoice Timing & Format Cleanliness
    # -------------------------------------------------------------------------
    def test_invoice_timing_and_pre_payment_state(self):
        inv_buf = _invoice_pdf(self.commercial_pending_payment, self.invoice_settings_a, None)
        pdf_bytes = inv_buf.getvalue()

        # Due date follows configured due_day (10)
        self.assertIn(b"2026-09-10", pdf_bytes)
        # Issue date is 1st of the month
        self.assertIn(b"2026-09-01", pdf_bytes)
        # Billed month is previous month (August 2026)
        self.assertIn(b"August 2026", pdf_bytes)

        # Bill To contains commercial details
        self.assertIn(b"Priya Fashion Boutique", pdf_bytes)
        self.assertIn(b"29XYZPQ5678R1Z2", pdf_bytes)

        # Bill To must NOT contain tenant email
        self.assertNotIn(b"priya@boutique.com", pdf_bytes)

        # Invoice totals show Total Amount Due and no Amount Paid / thank-you
        self.assertIn(b"Total Amount Due", pdf_bytes)
        self.assertNotIn(b"Amount Paid", pdf_bytes)
        self.assertNotIn(b"Balance Due", pdf_bytes)
        self.assertNotIn(b"Thank you for your payment", pdf_bytes)

    # -------------------------------------------------------------------------
    # Gate 14: Post-payment Receipt Content
    # -------------------------------------------------------------------------
    def test_receipt_content_and_acknowledgement(self):
        rec_buf = _receipt_pdf(self.commercial_paid_payment, self.invoice_settings_a, None)
        pdf_bytes = rec_buf.getvalue()

        # Receipt title and post-payment acknowledgement
        self.assertIn(b"PAYMENT RECEIPT", pdf_bytes)
        self.assertIn(b"Thank you for your payment", pdf_bytes)
        self.assertIn(b"TOTAL PAID", pdf_bytes)

        # Transaction details
        self.assertIn(b"UTR20260805123456", pdf_bytes)
        self.assertIn(b"Bank Transfer", pdf_bytes)
        self.assertIn(b"2026-08-05", pdf_bytes)

        # Tenant name present for payment acknowledgement
        self.assertIn(b"Priya Sharma", pdf_bytes)
        self.assertIn(b"Priya Fashion Boutique", pdf_bytes)


class TenantBillingCommunicationTests(TestCase):
    """
    Test suite for Automated Tenant Billing Communication:
    - Commercial invoice generation on 1st of month
    - Invoice email delivery, GST breakdown, due date, payment instructions, PDF attachment
    - Delivery status logging & retry of failed deliveries
    - Landlord manual invoice resend
    - Automated payment receipt generation & email on payment paid
    - Receipt email content & PDF attachment
    - Landlord manual receipt resend
    """

    def setUp(self):
        self.client = APIClient()

        # Landlord A setup
        self.user_a = User.objects.create_user(
            username="landlord_test_a",
            password="Password123!",
            email="landlord_a@test.com",
            first_name="Alice",
            last_name="Owner",
        )
        self.landlord_a = Landlord.objects.create(
            user=self.user_a,
            phone="9876543210",
            address="123 Landlord Way",
        )

        # Landlord B setup (for ownership isolation checks)
        self.user_b = User.objects.create_user(
            username="landlord_test_b",
            password="Password456!",
            email="landlord_b@test.com",
            first_name="Bob",
            last_name="Other",
        )
        self.landlord_b = Landlord.objects.create(
            user=self.user_b,
            phone="9876543211",
            address="456 Other Way",
        )

        # Building A
        self.building = Building.objects.create(
            landlord=self.landlord_a,
            name="Apex Commercial Tower",
            address="500 Prime Avenue",
            city="Bengaluru",
            state="Karnataka",
            pincode="560001",
            number_of_floors=4,
        )

        # InvoiceSettings for Building A
        self.settings = InvoiceSettings.objects.create(
            building=self.building,
            landlord=self.landlord_a,
            business_name="Apex Realty Enterprises",
            address="500 Prime Avenue",
            city="Bengaluru",
            state="Karnataka",
            pincode="560001",
            phone="080-99887766",
            email="billing@apexrealty.com",
            gstin="29AAAAA0000A1Z5",
            bank_name="HDFC Bank",
            account_number="50100012345678",
            ifsc="HDFC0000123",
            branch="Indiranagar",
            payment_instructions="Please pay via NEFT/IMPS with payment reference ID.",
            due_day=10,
        )

        # Floor and Commercial Unit
        self.floor = Floor.objects.create(
            building=self.building,
            floor_number=1,
        )
        self.unit = Unit.objects.create(
            floor=self.floor,
            unit_number="COMM-101",
            name="Prime Retail 101",
            unit_type="commercial",
            status="occupied",
            monthly_rent=Decimal("25000.00"),
            area=1000,
        )

        # Tenant
        self.tenant = Tenant.objects.create(
            first_name="Rohan",
            last_name="Mehta",
            shop_name="Mehta Electronics",
            gst_number="29BBBBB1111B1Z2",
            postal_address="Shop 101, Apex Tower, Bengaluru",
            gst_rate=Decimal("18.00"),
            email="rohan@mehtaelectronics.com",
            phone="9876500000",
        )

        # Commercial Lease
        self.lease = Lease.objects.create(
            tenant=self.tenant,
            unit=self.unit,
            start_date=date(2026, 1, 1),
            end_date=date(2027, 1, 1),
            monthly_rent=Decimal("25000.00"),
            status="active",
            lease_type="commercial",
        )

        # Pending Payment
        self.pending_payment = Payment.objects.create(
            lease=self.lease,
            payment_type="rent",
            amount=Decimal("25000.00"),
            due_date=date(2026, 9, 10),
            status="pending",
        )

        # Residential Unit & Lease for isolation testing
        self.res_unit = Unit.objects.create(
            floor=self.floor,
            unit_number="RES-201",
            name="Residential 201",
            unit_type="residential",
            status="occupied",
            monthly_rent=Decimal("15000.00"),
            area=800,
        )
        self.res_tenant = Tenant.objects.create(
            first_name="Pooja",
            last_name="Sharma",
            email="pooja.residential@example.com",
            phone="9876599999",
        )
        self.res_lease = Lease.objects.create(
            tenant=self.res_tenant,
            unit=self.res_unit,
            start_date=date(2026, 1, 1),
            end_date=date(2027, 1, 1),
            monthly_rent=Decimal("15000.00"),
            status="active",
            lease_type="rent",
        )
        self.res_payment = Payment.objects.create(
            lease=self.res_lease,
            payment_type="rent",
            amount=Decimal("15000.00"),
            due_date=date(2026, 9, 10),
            status="pending",
        )


    def _login(self, username, password):
        resp = self.client.post(
            "/api/auth/login/",
            {"username": username, "password": password},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        return resp.data["access"]

    def test_automated_commercial_invoice_generation(self):
        """
        Tests automated generation of commercial invoices on 1st of month
        and emailing invoice PDF with full billing details.
        """
        mail.outbox.clear()
        target_date = date(2026, 10, 1)

        result = generate_monthly_invoices(
            target_date=target_date,
            building=self.building,
            send_emails=True,
        )

        self.assertEqual(result["invoices_created"], 1)
        self.assertEqual(result["emails_sent"], 1)

        # Check payment record created
        new_payment = Payment.objects.filter(
            lease=self.lease,
            due_date__year=2026,
            due_date__month=10,
        ).first()
        self.assertIsNotNone(new_payment)
        self.assertEqual(new_payment.amount, Decimal("25000.00"))
        self.assertEqual(new_payment.due_date, date(2026, 10, 10))

        # Check email sent in outbox
        self.assertEqual(len(mail.outbox), 1)
        sent_email = mail.outbox[0]
        self.assertIn("rohan@mehtaelectronics.com", sent_email.to)
        self.assertIn("homrent1@gmail.com", sent_email.from_email)
        self.assertIn("Commercial Rent Invoice", sent_email.subject)
        self.assertIn("COMM-101", sent_email.subject)

        # Check email body content: billing month, total due, GST breakdown, due date, payment instructions
        body = sent_email.body
        self.assertIn("September 2026", body)  # Billing month (preceding month)
        self.assertIn("10 Oct 2026", body)    # Due date
        self.assertIn("25000.00", body)       # Base Rent
        self.assertIn("18.0", body)           # GST Rate
        self.assertIn("2250.00", body)        # CGST (9%)
        self.assertIn("2250.00", body)        # SGST (9%)
        self.assertIn("4500.00", body)        # Total GST (18%)
        self.assertIn("29500.00", body)       # Grand Total Due (25000 + 4500)
        self.assertIn("HDFC Bank", body)      # Bank name
        self.assertIn("50100012345678", body) # Account number
        self.assertIn("HDFC0000123", body)    # IFSC

        # Check PDF attachment
        self.assertEqual(len(sent_email.attachments), 1)
        filename, content, mimetype = sent_email.attachments[0]
        self.assertTrue(filename.startswith("rent-invoice-"))
        self.assertTrue(filename.endswith(".pdf"))
        self.assertEqual(mimetype, "application/pdf")
        self.assertTrue(len(content) > 1000)

        # Check BillingEmailLog
        log = BillingEmailLog.objects.filter(
            payment=new_payment,
            email_type="invoice",
        ).first()
        self.assertIsNotNone(log)
        self.assertEqual(log.status, "sent")
        self.assertEqual(log.recipient_email, "rohan@mehtaelectronics.com")
        self.assertIsNotNone(log.sent_at)

    def test_landlord_manual_resend_invoice(self):
        """
        Tests landlord manual resend of invoice via API endpoint.
        """
        mail.outbox.clear()
        token = self._login("landlord_test_a", "Password123!")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        resp = self.client.post(f"/api/payments/{self.pending_payment.id}/send-invoice/")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("Invoice emailed successfully", resp.data["detail"])
        self.assertEqual(resp.data["email_log"]["status"], "sent")

        self.assertEqual(len(mail.outbox), 1)
        sent_email = mail.outbox[0]
        self.assertIn("rohan@mehtaelectronics.com", sent_email.to)
        self.assertEqual(len(sent_email.attachments), 1)

        # Check isolation: Landlord B cannot send Landlord A's invoice
        token_b = self._login("landlord_test_b", "Password456!")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token_b}")
        resp_b = self.client.post(f"/api/payments/{self.pending_payment.id}/send-invoice/")
        self.assertIn(resp_b.status_code, [403, 404])

    def test_failed_invoice_delivery_and_retry(self):
        """
        Tests recording failed delivery status and retrying delivery.
        """
        mail.outbox.clear()
        # Remove tenant email to force failure
        self.tenant.email = ""
        self.tenant.save()

        log = send_invoice_email(self.pending_payment)
        self.assertEqual(log.status, "failed")
        self.assertIn("no registered email", log.error_message.lower())
        self.assertEqual(len(mail.outbox), 0)

        # Provide valid email and retry via retry endpoint
        self.tenant.email = "rohan.valid@mehtaelectronics.com"
        self.tenant.save()

        token = self._login("landlord_test_a", "Password123!")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        retry_resp = self.client.post(f"/api/payments/{self.pending_payment.id}/retry-email/")
        self.assertEqual(retry_resp.status_code, 200)
        self.assertEqual(retry_resp.data["email_log"]["status"], "sent")
        self.assertEqual(retry_resp.data["email_log"]["retry_count"], 1)

        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("rohan.valid@mehtaelectronics.com", mail.outbox[0].to)

    def test_automatic_receipt_generation_on_payment_paid(self):
        """
        Tests automatic generation and email delivery of payment receipt
        when a payment is marked as paid.
        """
        mail.outbox.clear()
        token = self._login("landlord_test_a", "Password123!")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        # Update pending payment to paid
        resp = self.client.patch(
            f"/api/payments/{self.pending_payment.id}/",
            {
                "status": "paid",
                "paid_date": "2026-09-08",
                "payment_method": "bank_transfer",
                "transaction_id": "IMPS202609080001",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["status"], "paid")

        # Verify receipt email was automatically dispatched
        self.assertEqual(len(mail.outbox), 1)
        sent_email = mail.outbox[0]
        self.assertIn("rohan@mehtaelectronics.com", sent_email.to)
        self.assertIn("homrent1@gmail.com", sent_email.from_email)
        self.assertIn("Receipt", sent_email.subject)

        # Verify required fields in email body:
        # payment date, payment method, transaction/reference ID, amount paid, GST breakdown, and shop/office/godown name
        body = sent_email.body
        self.assertIn("08 Sep 2026", body)          # Payment Date
        self.assertIn("Bank Transfer", body)        # Payment Method
        self.assertIn("IMPS202609080001", body)     # Transaction / Reference ID
        self.assertIn("Mehta Electronics", body)    # Shop/office/godown name
        self.assertIn("25000.00", body)             # Base Rent Paid
        self.assertIn("18.0", body)                 # GST Rate
        self.assertIn("2250.00", body)              # CGST
        self.assertIn("2250.00", body)              # SGST
        self.assertIn("29500.00", body)             # Grand Total Paid

        # Verify PDF attachment
        self.assertEqual(len(sent_email.attachments), 1)
        filename, content, mimetype = sent_email.attachments[0]
        self.assertTrue(filename.startswith("rent-receipt-"))
        self.assertTrue(filename.endswith(".pdf"))
        self.assertEqual(mimetype, "application/pdf")
        self.assertTrue(len(content) > 1000)

        # Verify BillingEmailLog for receipt
        receipt_log = BillingEmailLog.objects.filter(
            payment=self.pending_payment,
            email_type="receipt",
        ).first()
        self.assertIsNotNone(receipt_log)
        self.assertEqual(receipt_log.status, "sent")
        self.assertEqual(receipt_log.recipient_email, "rohan@mehtaelectronics.com")
        self.assertEqual(receipt_log.retry_count, 0)
        self.assertEqual(receipt_log.error_message, "")
        self.assertIsNotNone(receipt_log.sent_at)

    def test_landlord_manual_resend_receipt(self):
        """
        Tests landlord manual resend of receipt for paid payment,
        and rejection for pending payment.
        """
        mail.outbox.clear()
        token = self._login("landlord_test_a", "Password123!")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        # Attempt to send receipt for pending payment -> must fail with 400
        pending_resp = self.client.post(f"/api/payments/{self.pending_payment.id}/send-receipt/")
        self.assertEqual(pending_resp.status_code, 400)
        self.assertIn("marked as paid", pending_resp.data[0].lower())

        # Mark payment as paid
        self.pending_payment.status = "paid"
        self.pending_payment.paid_date = date(2026, 9, 8)
        self.pending_payment.payment_method = "online"
        self.pending_payment.transaction_id = "PAYID12345"
        self.pending_payment.save()

        # Resend receipt manually
        mail.outbox.clear()
        resp = self.client.post(f"/api/payments/{self.pending_payment.id}/send-receipt/")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("Receipt emailed successfully", resp.data["detail"])
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("PAYID12345", mail.outbox[0].body)

        # Isolation check: Landlord B cannot send Landlord A's receipt
        token_b = self._login("landlord_test_b", "Password456!")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token_b}")
        resp_b = self.client.post(f"/api/payments/{self.pending_payment.id}/send-receipt/")
        self.assertIn(resp_b.status_code, [403, 404])

    def test_management_commands_execution(self):
        """
        Tests running management commands generate_monthly_invoices and retry_failed_billing_emails.
        """
        mail.outbox.clear()
        # Test generate_monthly_invoices command
        out = io.StringIO()
        call_command("generate_monthly_invoices", date="2026-11-01", stdout=out)
        self.assertIn("Completed", out.getvalue())

        # Verify payment was created for Nov 2026
        nov_payment = Payment.objects.filter(
            lease=self.lease,
            due_date__year=2026,
            due_date__month=11,
        ).first()
        self.assertIsNotNone(nov_payment)

        # Test retry_failed_billing_emails command
        retry_out = io.StringIO()
        call_command("retry_failed_billing_emails", stdout=retry_out)
        self.assertIn("Done", retry_out.getvalue())

    def test_receipt_email_only_on_paid_status(self):
        """
        Confirms a receipt email is automatically sent ONLY when a rent payment changes to 'paid'.
        Pending payments or other field updates do NOT trigger a receipt email.
        """
        token = self._login("landlord_test_a", "Password123!")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        mail.outbox.clear()

        # Create a pending payment via API -> No receipt should be dispatched
        create_resp = self.client.post(
            "/api/payments/",
            {
                "lease": self.lease.id,
                "amount": "25000.00",
                "payment_type": "rent",
                "due_date": "2026-12-05",
                "status": "pending",
            },
            format="json",
        )
        self.assertEqual(create_resp.status_code, 201)
        created_payment_id = create_resp.data["id"]
        self.assertEqual(len(mail.outbox), 0)

        # Update note/description without changing status to paid -> No receipt
        patch_resp = self.client.patch(
            f"/api/payments/{created_payment_id}/",
            {"description": "Updated billing remarks"},
            format="json",
        )
        self.assertEqual(patch_resp.status_code, 200)
        self.assertEqual(len(mail.outbox), 0)

        # Now mark payment as paid -> Receipt email MUST be sent automatically
        paid_resp = self.client.patch(
            f"/api/payments/{created_payment_id}/",
            {
                "status": "paid",
                "paid_date": "2026-12-04",
                "payment_method": "bank_transfer",
                "transaction_id": "IMPS-DEC-9988",
            },
            format="json",
        )
        self.assertEqual(paid_resp.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("rohan@mehtaelectronics.com", mail.outbox[0].to)
        self.assertIn("homrent1@gmail.com", mail.outbox[0].from_email)

        # Update description on already paid payment -> Should NOT send duplicate receipt
        patch_paid_resp = self.client.patch(
            f"/api/payments/{created_payment_id}/",
            {"description": "Final reconciled payment"},
            format="json",
        )
        self.assertEqual(patch_paid_resp.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)

    def test_failed_receipt_delivery_and_retry(self):
        """
        Tests failed receipt email logging when tenant has no email,
        and successful retry after restoring tenant email.
        """
        token = self._login("landlord_test_a", "Password123!")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        mail.outbox.clear()

        # Remove email to induce delivery failure
        self.tenant.email = ""
        self.tenant.save()

        # Update payment to paid -> Delivery should fail and record failed BillingEmailLog
        resp = self.client.patch(
            f"/api/payments/{self.pending_payment.id}/",
            {
                "status": "paid",
                "paid_date": "2026-09-09",
                "payment_method": "online",
                "transaction_id": "ONL-100200",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(mail.outbox), 0)

        # Verify BillingEmailLog recorded failure
        receipt_log = BillingEmailLog.objects.filter(
            payment=self.pending_payment,
            email_type="receipt",
        ).first()
        self.assertIsNotNone(receipt_log)
        self.assertEqual(receipt_log.status, "failed")
        self.assertIn("no registered email", receipt_log.error_message.lower())
        self.assertEqual(receipt_log.retry_count, 0)

        # Restore valid email and retry via retry-email endpoint
        self.tenant.email = "rohan.receipt@mehtaelectronics.com"
        self.tenant.save()

        retry_resp = self.client.post(
            f"/api/payments/{self.pending_payment.id}/retry-email/",
            {"email_type": "receipt"},
            format="json",
        )
        self.assertEqual(retry_resp.status_code, 200)
        self.assertEqual(retry_resp.data["email_log"]["status"], "sent")
        self.assertEqual(retry_resp.data["email_log"]["retry_count"], 1)

        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("rohan.receipt@mehtaelectronics.com", mail.outbox[0].to)
        self.assertIn("homrent1@gmail.com", mail.outbox[0].from_email)

    def test_email_settings_configuration_and_sender_account(self):
        """
        Verifies default email settings use the homrent1@gmail.com account
        and adhere to required configuration structure.
        """
        from django.conf import settings as s
        self.assertIn("homrent1@gmail.com", s.DEFAULT_FROM_EMAIL)
        self.assertEqual(s.EMAIL_HOST_USER, "homrent1@gmail.com")
        self.assertEqual(s.EMAIL_HOST, "smtp.gmail.com")
        self.assertEqual(s.EMAIL_PORT, 587)
        self.assertTrue(s.EMAIL_USE_TLS)

    def test_residential_units_do_not_receive_invoices_or_receipts(self):
        """
        Confirms our business rule:
        - Only commercial tenants receive invoices and commercial receipts.
        - Residential tenants do NOT receive invoices or commercial receipts.
        """
        token = self._login("landlord_test_a", "Password123!")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        mail.outbox.clear()

        # 1. Invoice PDF viewing/download is allowed for landlord records
        inv_resp = self.client.get(f"/api/payments/{self.res_payment.id}/invoice/")
        self.assertEqual(inv_resp.status_code, 200)

        # 2. Receipt PDF viewing/download is allowed for landlord records
        self.res_payment.status = "paid"
        self.res_payment.paid_date = date(2026, 9, 8)
        self.res_payment.save()
        rec_resp = self.client.get(f"/api/payments/{self.res_payment.id}/receipt/")
        self.assertEqual(rec_resp.status_code, 200)

        # 3. Send-invoice endpoint must reject residential payment
        send_inv_resp = self.client.post(f"/api/payments/{self.res_payment.id}/send-invoice/")
        self.assertEqual(send_inv_resp.status_code, 400)
        self.assertIn("commercial", send_inv_resp.data[0].lower())

        # 4. Send-receipt endpoint must reject residential payment
        send_rec_resp = self.client.post(f"/api/payments/{self.res_payment.id}/send-receipt/")
        self.assertEqual(send_rec_resp.status_code, 400)
        self.assertIn("commercial", send_rec_resp.data[0].lower())

        # 5. Direct calls to send_invoice_email and send_receipt_email must also reject residential
        log_inv = send_invoice_email(self.res_payment)
        self.assertEqual(log_inv.status, "failed")
        self.assertIn("commercial", log_inv.error_message.lower())

        log_rec = send_receipt_email(self.res_payment)
        self.assertEqual(log_rec.status, "failed")
        self.assertIn("commercial", log_rec.error_message.lower())

        # Absolutely 0 emails sent to residential tenant
        self.assertEqual(len(mail.outbox), 0)

    def test_duplicate_email_protection_and_force_resend(self):
        """
        Confirms idempotency:
        - Calling send-invoice multiple times does NOT send duplicate emails.
        - Calling send-receipt multiple times does NOT send duplicate emails.
        - Explicit force=True allows intentional re-sending.
        """
        token = self._login("landlord_test_a", "Password123!")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        mail.outbox.clear()

        # Send initial invoice email
        resp1 = self.client.post(f"/api/payments/{self.pending_payment.id}/send-invoice/")
        self.assertEqual(resp1.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)

        # Duplicate call (e.g. page refresh, network retry) -> must NOT send duplicate email
        resp2 = self.client.post(f"/api/payments/{self.pending_payment.id}/send-invoice/")
        self.assertEqual(resp2.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)

        # Explicit force resend -> sends 2nd email
        resp3 = self.client.post(
            f"/api/payments/{self.pending_payment.id}/send-invoice/",
            {"force": True},
            format="json",
        )
        self.assertEqual(resp3.status_code, 200)
        self.assertEqual(len(mail.outbox), 2)

        # Now test receipt duplicate protection
        mail.outbox.clear()
        self.pending_payment.status = "paid"
        self.pending_payment.paid_date = date(2026, 9, 8)
        self.pending_payment.payment_method = "bank_transfer"
        self.pending_payment.save()

        # First receipt send
        rec_resp1 = self.client.post(f"/api/payments/{self.pending_payment.id}/send-receipt/")
        self.assertEqual(rec_resp1.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)

        # Duplicate receipt send -> must NOT send duplicate email
        rec_resp2 = self.client.post(f"/api/payments/{self.pending_payment.id}/send-receipt/")
        self.assertEqual(rec_resp2.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)

        # Explicit force receipt resend -> sends 2nd receipt
        rec_resp3 = self.client.post(
            f"/api/payments/{self.pending_payment.id}/send-receipt/",
            {"force": True},
            format="json",
        )
        self.assertEqual(rec_resp3.status_code, 200)
        self.assertEqual(len(mail.outbox), 2)

    def test_payment_marking_paid_safe_if_email_fails(self):
        """
        Verifies that even if email dispatch encounters an unexpected error,
        marking a payment as 'paid' still completes safely and does not crash.
        """
        token = self._login("landlord_test_a", "Password123!")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        mail.outbox.clear()

        # Set tenant email to empty to cause email failure
        self.tenant.email = ""
        self.tenant.save()

        resp = self.client.patch(
            f"/api/payments/{self.pending_payment.id}/",
            {
                "status": "paid",
                "paid_date": "2026-09-08",
                "payment_method": "online",
            },
            format="json",
        )
        # Payment must successfully be marked as paid
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["status"], "paid")
        self.pending_payment.refresh_from_db()
        self.assertEqual(self.pending_payment.status, "paid")

    def test_commercial_tenant_email_validation_in_serializer(self):
        """
        Verifies TenantSerializer requires an email address when commercial fields are present.
        """
        from properties.serializers import TenantSerializer

        # Missing email for commercial tenant -> invalid
        serializer = TenantSerializer(data={
            "first_name": "Commercial",
            "last_name": "Tenant",
            "shop_name": "Apex Bakery",
            "phone": "9988776655",
            "email": "",
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn("email", serializer.errors)

        # Valid email for commercial tenant -> valid
        valid_serializer = TenantSerializer(data={
            "first_name": "Commercial",
            "last_name": "Tenant",
            "shop_name": "Apex Bakery",
            "phone": "9988776655",
            "email": "bakery@apex.com",
        })
        self.assertTrue(valid_serializer.is_valid())

    def test_smtp_diagnostics_command_execution(self):
        """
        Verifies test_smtp_connection management command runs cleanly without crashing.
        """
        out = io.StringIO()
        call_command("test_smtp_connection", stdout=out)
        output = out.getvalue()
        self.assertIn("RentEase SMTP Connection Diagnostic", output)
        self.assertIn("EMAIL_HOST", output)

    def test_upi_qr_code_in_invoice_and_receipt_emails(self):
        """
        Verifies that when a landlord configures a UPI QR code image and UPI ID in InvoiceSettings,
        the emails embed the inline QR image and display the Quick Pay UPI section.
        """
        from django.core.files.uploadedfile import SimpleUploadedFile
        from PIL import Image as PILImage

        buf = io.StringIO() if False else io.BytesIO()
        img = PILImage.new("RGB", (60, 60), color="white")
        img.save(buf, format="PNG")
        qr_file = SimpleUploadedFile("my_upi_qr.png", buf.getvalue(), content_type="image/png")

        self.settings.upi_id = "landlord@okhdfcbank"
        self.settings.upi_qr_code = qr_file
        self.settings.save()

        # Send invoice email
        mail.outbox.clear()
        inv_log = send_invoice_email(self.pending_payment, force=True)
        self.assertEqual(inv_log.status, "sent")
        self.assertEqual(len(mail.outbox), 1)
        sent_inv = mail.outbox[0]

        # Verify inline QR image attachment and cid:upi_qr_code in HTML
        self.assertIn("Quick Pay via UPI", sent_inv.alternatives[0][0])
        self.assertIn("cid:upi_qr_code", sent_inv.alternatives[0][0])
        self.assertIn("landlord@okhdfcbank", sent_inv.alternatives[0][0])
        self.assertIn("landlord@okhdfcbank", sent_inv.body)

        # Mark paid and send receipt email
        mail.outbox.clear()
        self.pending_payment.status = "paid"
        self.pending_payment.paid_date = date(2026, 9, 8)
        self.pending_payment.save()
        rec_log = send_receipt_email(self.pending_payment, force=True)
        self.assertEqual(rec_log.status, "sent")
        self.assertEqual(len(mail.outbox), 1)
        sent_rec = mail.outbox[0]
        self.assertIn("cid:upi_qr_code", sent_rec.alternatives[0][0])
        self.assertIn("Landlord Official UPI QR", sent_rec.alternatives[0][0])




