import io
from decimal import Decimal
from PIL import Image
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from properties.models import (
    Landlord,
    Building,
    Floor,
    Unit,
    Tenant,
    Lease,
    Payment,
    MaintenanceRequest,
    InvoiceSettings,
)
from properties.tenant_auth_service import (
    create_unique_tenant_username,
    generate_secure_password,
    provision_tenant_user,
    reset_tenant_user_password,
)


def create_test_image(format="JPEG", size=(100, 100), color="blue"):
    file_io = io.BytesIO()
    img = Image.new("RGB", size, color=color)
    img.save(file_io, format=format)
    file_io.seek(0)
    ext = format.lower()
    return SimpleUploadedFile(
        f"test.{ext}",
        file_io.read(),
        content_type=f"image/{ext}",
    )


class TenantPortalBackendTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Create Landlord 1
        self.landlord_user1 = User.objects.create_user(
            username="landlord1",
            email="landlord1@test.com",
            password="Password123!",
            first_name="Larry",
            last_name="Landlord",
        )
        self.landlord1 = Landlord.objects.create(user=self.landlord_user1, phone="9876543210")

        # Create Landlord 2
        self.landlord_user2 = User.objects.create_user(
            username="landlord2",
            email="landlord2@test.com",
            password="Password123!",
            first_name="Lucy",
            last_name="Landlord",
        )
        self.landlord2 = Landlord.objects.create(user=self.landlord_user2, phone="9876543211")

        # Create Property Structure for Landlord 1
        self.building1 = Building.objects.create(
            landlord=self.landlord1,
            name="Sunrise Towers",
            address="123 Main St",
            city="Chennai",
            state="TN",
            pincode="600001",
        )
        self.invoice_settings = InvoiceSettings.objects.create(
            building=self.building1,
            business_name="Sunrise Estates",
            due_day=5,
        )
        self.floor1 = Floor.objects.create(building=self.building1, floor_number=1)
        self.unit1 = Unit.objects.create(
            floor=self.floor1,
            unit_number="101",
            name="Flat 101",
            monthly_rent=Decimal("15000.00"),
        )
        self.unit2 = Unit.objects.create(
            floor=self.floor1,
            unit_number="102",
            name="Flat 102",
            monthly_rent=Decimal("18000.00"),
        )

        # Create Property Structure for Landlord 2
        self.building2 = Building.objects.create(
            landlord=self.landlord2,
            name="Moonlight Heights",
            address="456 Cross St",
            city="Chennai",
            state="TN",
            pincode="600002",
        )
        self.floor2 = Floor.objects.create(building=self.building2, floor_number=1)
        self.unit3 = Unit.objects.create(
            floor=self.floor2,
            unit_number="201",
            name="Flat 201",
            monthly_rent=Decimal("20000.00"),
        )

        # Create Tenant 1 (will be linked to Unit 1 under Landlord 1)
        self.tenant1 = Tenant.objects.create(
            landlord=self.landlord1,
            first_name="Alice",
            last_name="Smith",
            email="alice@tenant.com",
            phone="9123456780",
        )
        provision_tenant_user(self.tenant1, landlord=self.landlord1)
        self.tenant_user1 = self.tenant1.user
        self.tenant_user1.set_password("TenantPass123!")
        self.tenant_user1.save()

        # Lease for Tenant 1
        self.lease1 = Lease.objects.create(
            unit=self.unit1,
            tenant=self.tenant1,
            lease_type="rent",
            start_date="2026-01-01",
            end_date="2026-12-31",
            monthly_rent=Decimal("15000.00"),
            status="active",
        )

        # Payment for Lease 1
        self.payment1 = Payment.objects.create(
            lease=self.lease1,
            payment_type="rent",
            amount=Decimal("15000.00"),
            due_date="2026-02-05",
            paid_date="2026-02-04",
            status="paid",
            payment_method="online",
            transaction_id="TXN12345",
        )

        # Create Tenant 2 (under Landlord 2)
        self.tenant2 = Tenant.objects.create(
            landlord=self.landlord2,
            first_name="Bob",
            last_name="Jones",
            email="bob@tenant.com",
            phone="9123456781",
        )
        provision_tenant_user(self.tenant2, landlord=self.landlord2)
        self.tenant_user2 = self.tenant2.user
        self.tenant_user2.set_password("TenantPass123!")
        self.tenant_user2.save()

        self.lease2 = Lease.objects.create(
            unit=self.unit3,
            tenant=self.tenant2,
            lease_type="rent",
            start_date="2026-01-01",
            end_date="2026-12-31",
            monthly_rent=Decimal("20000.00"),
            status="active",
        )
        self.payment2 = Payment.objects.create(
            lease=self.lease2,
            payment_type="rent",
            amount=Decimal("20000.00"),
            due_date="2026-02-05",
            status="pending",
        )

    def test_automatic_tenant_credential_creation(self):
        """Landlord creating tenant automatically provisions User with unique username and temp password."""
        self.client.force_authenticate(user=self.landlord_user1)

        payload = {
            "first_name": "Charlie",
            "last_name": "Brown",
            "email": "charlie.brown@example.com",
            "phone": "9998887776",
        }
        res = self.client.post("/api/tenants/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        data = res.json()
        self.assertIn("temporary_credentials", data)
        creds = data["temporary_credentials"]
        self.assertEqual(creds["email"], "charlie.brown@example.com")
        self.assertTrue(len(creds["temporary_password"]) >= 10)
        self.assertTrue(creds["must_change_password"])

        # Verify linked User exists
        tenant_obj = Tenant.objects.get(id=data["id"])
        self.assertIsNotNone(tenant_obj.user)
        self.assertEqual(tenant_obj.user.email, "charlie.brown@example.com")
        self.assertTrue(tenant_obj.must_change_password)

        # Subsequent GET request must NOT expose temporary_password
        get_res = self.client.get(f"/api/tenants/{tenant_obj.id}/")
        self.assertEqual(get_res.status_code, status.HTTP_200_OK)
        self.assertNotIn("temporary_password", get_res.json())
        self.assertNotIn("temporary_credentials", get_res.json())

    def test_unique_username_collision_handling(self):
        """Tenants sharing identical emails or names receive unique usernames."""
        u1 = create_unique_tenant_username("duplicate@example.com", "David", "Miller")
        User.objects.create_user(username=u1, email="duplicate@example.com")

        u2 = create_unique_tenant_username("duplicate@example.com", "David", "Miller")
        self.assertNotEqual(u1, u2)
        self.assertTrue(u2.startswith("duplicate_"))

    def test_tenant_only_login_endpoint(self):
        """Tenant can log in at /api/auth/tenant-login/; Landlord is denied with 403."""
        # 1. Tenant login succeeds
        res = self.client.post(
            "/api/auth/tenant-login/",
            {"username": "alice@tenant.com", "password": "TenantPass123!"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("access", res.json())
        self.assertEqual(res.json()["user"]["role"], "tenant")

        # 2. Landlord attempting tenant login is denied
        res_landlord = self.client.post(
            "/api/auth/tenant-login/",
            {"username": "landlord1", "password": "Password123!"},
            format="json",
        )
        self.assertEqual(res_landlord.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("tenant accounts only", res_landlord.json()["detail"])

        # 3. Tenant attempting landlord login is denied
        res_tenant_at_landlord = self.client.post(
            "/api/auth/landlord-login/",
            {"username": "alice@tenant.com", "password": "TenantPass123!"},
            format="json",
        )
        self.assertEqual(res_tenant_at_landlord.status_code, status.HTTP_403_FORBIDDEN)

    def test_tenant_authorization_boundaries(self):
        """Tenant 1 cannot view Tenant 2's tenant record, lease, or payments."""
        self.client.force_authenticate(user=self.tenant_user1)

        # 1. Tenant listing only returns Tenant 1
        res = self.client.get("/api/tenants/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        tenant_ids = [t["id"] for t in res.json()]
        self.assertEqual(tenant_ids, [self.tenant1.id])

        # 2. Leases listing only returns Lease 1
        res_leases = self.client.get("/api/leases/")
        self.assertEqual(res_leases.status_code, status.HTTP_200_OK)
        lease_ids = [l["id"] for l in res_leases.json()]
        self.assertIn(self.lease1.id, lease_ids)
        self.assertNotIn(self.lease2.id, lease_ids)

        # 3. Payments listing only returns Payment 1
        res_payments = self.client.get("/api/payments/")
        self.assertEqual(res_payments.status_code, status.HTTP_200_OK)
        payment_ids = [p["id"] for p in res_payments.json()]
        self.assertIn(self.payment1.id, payment_ids)
        self.assertNotIn(self.payment2.id, payment_ids)

    def test_tenant_invoice_and_receipt_access(self):
        """Tenant 1 can access their own invoice and receipt PDF; cannot access Tenant 2's."""
        self.client.force_authenticate(user=self.tenant_user1)

        # Access own receipt PDF
        res_rcpt = self.client.get(f"/api/payments/{self.payment1.id}/receipt/")
        self.assertEqual(res_rcpt.status_code, status.HTTP_200_OK)
        self.assertEqual(res_rcpt["Content-Type"], "application/pdf")

        # Access own invoice PDF
        res_inv = self.client.get(f"/api/payments/{self.payment1.id}/invoice/")
        self.assertEqual(res_inv.status_code, status.HTTP_200_OK)
        self.assertEqual(res_inv["Content-Type"], "application/pdf")

        # Attempt to access Tenant 2's payment receipt
        res_other = self.client.get(f"/api/payments/{self.payment2.id}/receipt/")
        self.assertEqual(res_other.status_code, status.HTTP_404_NOT_FOUND)

    def test_maintenance_complaint_creation(self):
        """Tenant can create maintenance complaint with category, priority, and optional image."""
        self.client.force_authenticate(user=self.tenant_user1)

        valid_image = create_test_image("PNG")
        payload = {
            "unit": self.unit1.id,
            "title": "Leaking kitchen tap",
            "category": "plumbing",
            "priority": "high",
            "description": "Water dripping constantly under the sink.",
            "image": valid_image,
        }
        res = self.client.post("/api/maintenance/", payload, format="multipart")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        data = res.json()
        self.assertEqual(data["title"], "Leaking kitchen tap")
        self.assertEqual(data["category"], "plumbing")
        self.assertEqual(data["priority"], "high")
        self.assertEqual(data["status"], "open")
        self.assertIsNotNone(data["image"])

        # Tenant cannot create maintenance request for unit they do not rent
        payload_invalid = {
            "unit": self.unit3.id,
            "title": "Unauthorized Request",
            "category": "electrical",
            "priority": "low",
            "description": "Trying to submit for another building.",
        }
        res_invalid = self.client.post("/api/maintenance/", payload_invalid, format="json")
        self.assertEqual(res_invalid.status_code, status.HTTP_403_FORBIDDEN)

    def test_maintenance_image_validation(self):
        """Rejects non-image files and files larger than 5 MB."""
        self.client.force_authenticate(user=self.tenant_user1)

        # 1. Invalid file extension (.txt instead of JPEG/PNG/WebP)
        fake_file = SimpleUploadedFile("danger.txt", b"plain text content", content_type="text/plain")
        res_text = self.client.post(
            "/api/maintenance/",
            {
                "unit": self.unit1.id,
                "title": "Bad attachment",
                "category": "structural",
                "description": "Testing text upload.",
                "image": fake_file,
            },
            format="multipart",
        )
        self.assertEqual(res_text.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("image", res_text.json())

        # 2. File exceeding 5 MB
        file_io = io.BytesIO()
        img = Image.new("RGB", (100, 100), color="blue")
        img.save(file_io, format="JPEG")
        file_io.write(b"\x00" * (5 * 1024 * 1024 + 1024))
        file_io.seek(0)
        large_file = SimpleUploadedFile("huge.jpg", file_io.read(), content_type="image/jpeg")
        res_large = self.client.post(
            "/api/maintenance/",
            {
                "unit": self.unit1.id,
                "title": "Too large image",
                "category": "other",
                "description": "Testing 5MB+ upload.",
                "image": large_file,
            },
            format="multipart",
        )
        self.assertEqual(res_large.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("exceed 5 MB", str(res_large.json()))

    def test_landlord_complaint_management(self):
        """Landlord can view, respond, and update status of complaints in their own properties."""
        complaint = MaintenanceRequest.objects.create(
            unit=self.unit1,
            tenant=self.tenant1,
            title="Short circuit in bedroom",
            category="electrical",
            priority="urgent",
            description="Power trips when plugging in heater.",
            status="open",
        )

        # Landlord 2 (unrelated) cannot view or update Landlord 1's complaint
        self.client.force_authenticate(user=self.landlord_user2)
        res_unauth = self.client.patch(
            f"/api/maintenance/{complaint.id}/",
            {"status": "in_progress"},
            format="json",
        )
        self.assertEqual(res_unauth.status_code, status.HTTP_404_NOT_FOUND)

        # Landlord 1 can update status and add response
        self.client.force_authenticate(user=self.landlord_user1)
        res_update = self.client.patch(
            f"/api/maintenance/{complaint.id}/",
            {
                "status": "resolved",
                "landlord_response": "Electrician repaired the circuit breaker on Feb 10.",
            },
            format="json",
        )
        self.assertEqual(res_update.status_code, status.HTTP_200_OK)

        complaint.refresh_from_db()
        self.assertEqual(complaint.status, "resolved")
        self.assertEqual(complaint.landlord_response, "Electrician repaired the circuit breaker on Feb 10.")
        self.assertIsNotNone(complaint.resolved_at)

    def test_password_reset_and_change_workflow(self):
        """Landlord can reset their tenant's password; Tenant can change password via /api/auth/change-password/."""
        # 1. Landlord 1 resets Tenant 1 password
        self.client.force_authenticate(user=self.landlord_user1)
        res_reset = self.client.post(f"/api/tenants/{self.tenant1.id}/reset-password/")
        self.assertEqual(res_reset.status_code, status.HTTP_200_OK)

        creds = res_reset.json()["temporary_credentials"]
        temp_pw = creds["temporary_password"]
        self.assertTrue(len(temp_pw) >= 10)

        # 2. Landlord 2 cannot reset Tenant 1 password (unauthorized)
        self.client.force_authenticate(user=self.landlord_user2)
        res_unauth = self.client.post(f"/api/tenants/{self.tenant1.id}/reset-password/")
        self.assertEqual(res_unauth.status_code, status.HTTP_404_NOT_FOUND)

        # 3. Tenant logs in with new temporary password
        self.client.logout()
        res_login = self.client.post(
            "/api/auth/tenant-login/",
            {"username": "alice@tenant.com", "password": temp_pw},
            format="json",
        )
        self.assertEqual(res_login.status_code, status.HTTP_200_OK)
        access_token = res_login.json()["access"]

        # 4. Tenant changes password
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")
        res_change = self.client.post(
            "/api/auth/change-password/",
            {
                "old_password": temp_pw,
                "new_password": "MyNewSecurePassword2026!",
                "confirm_password": "MyNewSecurePassword2026!",
            },
            format="json",
        )
        self.assertEqual(res_change.status_code, status.HTTP_200_OK)

        self.tenant1.refresh_from_db()
        self.assertFalse(self.tenant1.must_change_password)
