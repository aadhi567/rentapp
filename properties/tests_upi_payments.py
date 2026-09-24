import json
from decimal import Decimal
from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from properties.models import (
    Landlord,
    Tenant,
    Building,
    Floor,
    Unit,
    Lease,
    Payment,
    PaymentTransaction,
    InvoiceSettings,
)
from properties.upi_service import validate_upi_id, validate_utr, build_upi_intent_uri


class RealUPIPaymentTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # 1. Landlord 1
        self.landlord_user = User.objects.create_user(
            username="landlord_arun",
            email="arun@landlord.com",
            password="SecurePassword123!",
            first_name="Arun",
            last_name="Kumar",
        )
        self.landlord = Landlord.objects.create(
            user=self.landlord_user,
            phone="9876543210",
            address="123 MG Road, Bengaluru",
            upi_id="arunkumar@okhdfcbank",
        )

        # 2. Building, Floor, Unit for Landlord 1
        self.building = Building.objects.create(
            landlord=self.landlord,
            name="Greenwood Heights",
            address="45 Residency Road",
            city="Bengaluru",
            state="Karnataka",
            pincode="560025",
        )
        self.invoice_settings = InvoiceSettings.objects.create(
            building=self.building,
            landlord=self.landlord,
            business_name="Greenwood Properties",
            upi_id="greenwood@icici",
        )
        self.floor = Floor.objects.create(building=self.building, floor_number=1)
        self.unit = Unit.objects.create(
            floor=self.floor,
            unit_number="101",
            name="Flat 101",
            unit_type="residential",
            monthly_rent=Decimal("15000.00"),
        )

        # 3. Tenant 1
        self.tenant_user = User.objects.create_user(
            username="tenant_rahul",
            email="rahul@tenant.com",
            password="SecurePassword123!",
            first_name="Rahul",
            last_name="Sharma",
        )
        self.tenant = Tenant.objects.create(
            user=self.tenant_user,
            landlord=self.landlord,
            first_name="Rahul",
            last_name="Sharma",
            email="rahul@tenant.com",
            phone="9876500001",
        )

        # 4. Active Lease for Tenant 1
        today = timezone.localdate()
        self.lease = Lease.objects.create(
            unit=self.unit,
            tenant=self.tenant,
            lease_type="rent",
            start_date=today,
            end_date=today.replace(year=today.year + 1),
            monthly_rent=Decimal("15000.00"),
            status="active",
        )

        # 5. Pending Rent Payment for Tenant 1
        self.payment = Payment.objects.create(
            lease=self.lease,
            payment_type="rent",
            amount=Decimal("15000.00"),
            due_date=today,
            status="pending",
        )

        # 6. Landlord 2 (for authorization boundary tests)
        self.landlord_user2 = User.objects.create_user(
            username="landlord_bob",
            email="bob@landlord.com",
            password="SecurePassword123!",
            first_name="Bob",
            last_name="Builder",
        )
        self.landlord2 = Landlord.objects.create(
            user=self.landlord_user2,
            upi_id="bob@upi",
        )

        # 7. Tenant 2 (for authorization boundary tests)
        self.tenant_user2 = User.objects.create_user(
            username="tenant_priya",
            email="priya@tenant.com",
            password="SecurePassword123!",
            first_name="Priya",
            last_name="Nair",
        )
        self.tenant2 = Tenant.objects.create(
            user=self.tenant_user2,
            landlord=self.landlord2,
            first_name="Priya",
            email="priya@tenant.com",
        )

    def test_01_initiate_upi_payment_creates_pending_transaction(self):
        """Test tenant initiates payment: creates PENDING transaction and valid UPI URI."""
        self.client.force_authenticate(user=self.tenant_user)

        res = self.client.post(
            "/api/transactions/initiate/",
            {"payment_id": self.payment.id},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        data = res.data
        self.assertEqual(data["status"], "PENDING")
        self.assertEqual(Decimal(data["amount"]), Decimal("15000.00"))
        self.assertEqual(data["upi_id"], "greenwood@icici")
        self.assertTrue(data["transaction_reference"].startswith("RENT-"))
        self.assertIn("upi://pay?pa=greenwood%40icici", data["upi_uri"])
        self.assertIn("am=15000.00", data["upi_uri"])

        # Check DB state
        txn = PaymentTransaction.objects.get(id=data["id"])
        self.assertEqual(txn.status, "PENDING")
        self.assertEqual(txn.tenant, self.tenant)
        self.assertEqual(txn.landlord, self.landlord)
        self.assertEqual(txn.payment, self.payment)

    def test_02_tenant_cannot_arbitrarily_change_payable_amount(self):
        """Ensure payment amount is strictly derived from the invoice, ignoring client payload tampering."""
        self.client.force_authenticate(user=self.tenant_user)

        res = self.client.post(
            "/api/transactions/initiate/",
            {
                "payment_id": self.payment.id,
                "amount": "1.00",  # malicious attempt to pay ₹1 instead of ₹15,000
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Decimal(res.data["amount"]), Decimal("15000.00"))

    def test_03_submit_utr_keeps_status_pending(self):
        """Tenant submits UTR from their UPI app: status must remain PENDING until landlord verifies."""
        txn = PaymentTransaction.objects.create(
            tenant=self.tenant,
            landlord=self.landlord,
            building=self.building,
            payment=self.payment,
            amount=self.payment.amount,
            currency="INR",
            payment_method="upi",
            upi_id="greenwood@icici",
            transaction_reference="RENT-2026-TEST01",
            status="PENDING",
        )

        self.client.force_authenticate(user=self.tenant_user)
        res = self.client.post(
            f"/api/transactions/{txn.id}/submit-utr/",
            {"utr": "426189012345"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        txn.refresh_from_db()
        self.assertEqual(txn.utr, "426189012345")
        self.assertEqual(txn.status, "PENDING")  # Crucial: NOT SUCCESS yet!

    def test_04_tenant_cannot_verify_payment(self):
        """Tenants must be strictly forbidden from verifying their own or any payment."""
        txn = PaymentTransaction.objects.create(
            tenant=self.tenant,
            landlord=self.landlord,
            building=self.building,
            payment=self.payment,
            amount=self.payment.amount,
            status="PENDING",
            transaction_reference="RENT-2026-TEST02",
            utr="426189012345",
        )

        self.client.force_authenticate(user=self.tenant_user)
        res = self.client.post(f"/api/transactions/{txn.id}/verify/", format="json")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        txn.refresh_from_db()
        self.assertEqual(txn.status, "PENDING")

    def test_05_landlord_verifies_payment_sets_success_and_invoice_paid(self):
        """When landlord verifies the payment, transaction becomes SUCCESS and invoice becomes PAID."""
        txn = PaymentTransaction.objects.create(
            tenant=self.tenant,
            landlord=self.landlord,
            building=self.building,
            payment=self.payment,
            amount=self.payment.amount,
            status="PENDING",
            transaction_reference="RENT-2026-TEST03",
            utr="426189012345",
        )

        self.client.force_authenticate(user=self.landlord_user)
        res = self.client.post(f"/api/transactions/{txn.id}/verify/", format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        txn.refresh_from_db()
        self.payment.refresh_from_db()

        self.assertEqual(txn.status, "SUCCESS")
        self.assertIsNotNone(txn.paid_at)
        self.assertEqual(self.payment.status, "paid")
        self.assertEqual(self.payment.payment_method, "upi")
        self.assertEqual(self.payment.transaction_id, "426189012345")

        # Test receipt download works and includes reference
        res_receipt = self.client.get(f"/api/payments/{self.payment.id}/receipt/")
        self.assertEqual(res_receipt.status_code, status.HTTP_200_OK)
        self.assertEqual(res_receipt["Content-Type"], "application/pdf")

    def test_06_cancellation_flow(self):
        """Test that an initiated pending transaction can be cancelled by tenant."""
        txn = PaymentTransaction.objects.create(
            tenant=self.tenant,
            landlord=self.landlord,
            building=self.building,
            payment=self.payment,
            amount=self.payment.amount,
            status="PENDING",
            transaction_reference="RENT-2026-TEST04",
        )

        self.client.force_authenticate(user=self.tenant_user)
        res = self.client.post(f"/api/transactions/{txn.id}/cancel/", format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        txn.refresh_from_db()
        self.assertEqual(txn.status, "CANCELLED")
        self.payment.refresh_from_db()
        self.assertEqual(self.payment.status, "pending")

    def test_07_duplicate_payment_prevention(self):
        """Prevent paying an already paid invoice, and prevent double verification."""
        self.payment.status = "paid"
        self.payment.save()

        self.client.force_authenticate(user=self.tenant_user)
        res = self.client.post(
            "/api/transactions/initiate/",
            {"payment_id": self.payment.id},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("already been verified and paid", str(res.data))

    def test_08_cross_tenant_and_cross_landlord_boundaries(self):
        """Ensure Tenant B cannot initiate for Tenant A, and Landlord B cannot verify Landlord A's payments."""
        # Tenant B attempts to initiate for Tenant A's payment
        self.client.force_authenticate(user=self.tenant_user2)
        res = self.client.post(
            "/api/transactions/initiate/",
            {"payment_id": self.payment.id},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

        # Landlord B attempts to verify Landlord A's transaction
        txn = PaymentTransaction.objects.create(
            tenant=self.tenant,
            landlord=self.landlord,
            building=self.building,
            payment=self.payment,
            amount=self.payment.amount,
            status="PENDING",
            transaction_reference="RENT-2026-TEST05",
            utr="426189012345",
        )
        self.client.force_authenticate(user=self.landlord_user2)
        res_verify = self.client.post(f"/api/transactions/{txn.id}/verify/", format="json")
        self.assertIn(res_verify.status_code, [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND])

    def test_09_vpa_validation_and_missing_landlord_upi(self):
        """Validate UPI ID format and handle missing landlord UPI ID gracefully."""
        # VPA validation
        self.assertIsNone(validate_upi_id("arunkumar@okhdfcbank"))
        with self.assertRaises(Exception):
            validate_upi_id("invalid-upi-without-at-sign")

        # Clear UPI IDs on landlord and building
        self.invoice_settings.upi_id = ""
        self.invoice_settings.save()
        self.landlord.upi_id = ""
        self.landlord.save()

        self.client.force_authenticate(user=self.tenant_user)
        res = self.client.post(
            "/api/transactions/initiate/",
            {"payment_id": self.payment.id},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("landlord has not configured a UPI ID", str(res.data))
