import os
import re
from django.utils import timezone
from rest_framework import serializers

from .models import (
    Building,
    InvoiceSettings,
    Floor,
    Unit,
    Tenant,
    Lease,
    LeaseReminder,
    Payment,
    MaintenanceRequest,
    BillingEmailLog,
    PaymentTransaction,
    Landlord,
    NotificationPreference,
)


class NotificationPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationPreference
        fields = [
            "id",
            "rent_payment_received",
            "rent_payment_pending",
            "rent_overdue",
            "maintenance_requests",
            "lease_expiry",
            "new_tenant",
            "theme",
            "updated_at",
        ]
        read_only_fields = ["id", "updated_at"]


class InvoiceSettingsSerializer(serializers.ModelSerializer):
    logo_url = serializers.SerializerMethodField()
    signature_url = serializers.SerializerMethodField()
    upi_qr_code_url = serializers.SerializerMethodField()

    class Meta:
        model = InvoiceSettings
        fields = [
            "id",
            "building",
            "landlord",
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
            "upi_id",
            "due_day",
            "logo",
            "logo_url",
            "signature",
            "signature_url",
            "upi_qr_code",
            "upi_qr_code_url",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "landlord",
            "logo_url",
            "signature_url",
            "upi_qr_code_url",
            "created_at",
            "updated_at",
        ]

    def _file_url(self, obj, field_name):
        request = self.context.get("request")
        file_obj = getattr(obj, field_name, None)

        if not file_obj:
            return None

        url = file_obj.url
        if request:
            return request.build_absolute_uri(url)
        return url

    def get_logo_url(self, obj):
        return self._file_url(obj, "logo")

    def get_signature_url(self, obj):
        return self._file_url(obj, "signature")

    def get_upi_qr_code_url(self, obj):
        return self._file_url(obj, "upi_qr_code")

    def validate(self, attrs):
        for field in ("logo", "signature", "upi_qr_code"):
            upload = attrs.get(field)
            if not upload:
                continue

            filename = upload.name.lower()
            if not filename.endswith((".png", ".jpg", ".jpeg", ".webp")):
                raise serializers.ValidationError({
                    field: "Only PNG, JPG, JPEG and WEBP files are allowed."
                })

            if upload.size > 5 * 1024 * 1024:
                raise serializers.ValidationError({
                    field: "File size must be 5 MB or smaller."
                })

        for name_field in ("city", "state", "bank_name", "branch"):
            val = attrs.get(name_field, getattr(self.instance, name_field, ""))
            if val and not re.match(r"^[a-zA-Z\s\-']+$", val.strip()):
                raise serializers.ValidationError({
                    name_field: f"{name_field.replace('_', ' ').capitalize()} can only contain letters, spaces, and hyphens."
                })

        pincode = attrs.get("pincode", getattr(self.instance, "pincode", ""))
        if pincode and not re.match(r"^[1-9][0-9]{5}$", pincode.strip()):
            raise serializers.ValidationError({
                "pincode": "Pincode must contain exactly 6 digits."
            })

        phone = attrs.get("phone", getattr(self.instance, "phone", ""))
        if phone and not re.match(r"^\+?[0-9]{10,15}$", phone.strip()):
            raise serializers.ValidationError({
                "phone": "Phone number must contain 10 to 15 digits."
            })

        account_number = attrs.get("account_number", getattr(self.instance, "account_number", ""))
        if account_number and not re.match(r"^\d{9,18}$", account_number.strip()):
            raise serializers.ValidationError({
                "account_number": "Account number must contain 9 to 18 digits only."
            })

        ifsc = attrs.get("ifsc", getattr(self.instance, "ifsc", ""))
        if ifsc and not re.match(r"^[A-Z]{4}0[A-Z0-9]{6}$", ifsc.strip().upper()):
            raise serializers.ValidationError({
                "ifsc": "Invalid IFSC code format (e.g. HDFC0001234)."
            })

        gstin = attrs.get("gstin", getattr(self.instance, "gstin", ""))
        if gstin and not re.match(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$", gstin.strip().upper()):
            if len(gstin.strip()) != 15:
                raise serializers.ValidationError({
                    "gstin": "GSTIN must contain 15 alphanumeric characters."
                })

        due_day = attrs.get(
            "due_day",
            getattr(self.instance, "due_day", 7),
        )

        if due_day is not None and (due_day < 1 or due_day > 31):
            raise serializers.ValidationError({
                "due_day": "Due day must be between 1 and 31."
            })

        return attrs
class BuildingSerializer(serializers.ModelSerializer):
    landlord_name = serializers.CharField(
        source="landlord.user.username",
        read_only=True,
    )

    class Meta:
        model = Building
        fields = [
            "id",
            "name",
            "address",
            "city",
            "state",
            "pincode",
            "number_of_floors",
            "description",
            "landlord",
            "landlord_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "landlord",
            "landlord_name",
            "created_at",
            "updated_at",
        ]

    def validate_city(self, value):
        value = (value or "").strip()
        if not value or not re.match(r"^[a-zA-Z\s\-']+$", value):
            raise serializers.ValidationError("City can only contain letters, spaces, and hyphens.")
        return value

    def validate_state(self, value):
        value = (value or "").strip()
        if not value or not re.match(r"^[a-zA-Z\s\-']+$", value):
            raise serializers.ValidationError("State can only contain letters, spaces, and hyphens.")
        return value

    def validate_pincode(self, value):
        value = (value or "").strip()
        if not re.match(r"^[1-9][0-9]{5}$", value):
            raise serializers.ValidationError("Pincode must contain exactly 6 digits.")
        return value

    def validate_number_of_floors(self, value):
        if value is None or value < 1:
            raise serializers.ValidationError("Number of floors must be at least 1.")
        return value


class FloorSerializer(serializers.ModelSerializer):
    building_name = serializers.CharField(
        source="building.name",
        read_only=True,
    )

    unit_count = serializers.SerializerMethodField()
    occupied_count = serializers.SerializerMethodField()
    vacant_count = serializers.SerializerMethodField()
    maintenance_count = serializers.SerializerMethodField()

    class Meta:
        model = Floor
        fields = [
            "id",
            "building",
            "building_name",
            "floor_number",
            "description",
            "unit_count",
            "occupied_count",
            "vacant_count",
            "maintenance_count",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "building_name",
            "floor_number",
            "unit_count",
            "occupied_count",
            "vacant_count",
            "maintenance_count",
            "created_at",
        ]

    def get_unit_count(self, obj):
        return obj.units.count()

    def get_occupied_count(self, obj):
        return obj.units.filter(
            status="occupied"
        ).count()

    def get_vacant_count(self, obj):
        return obj.units.filter(
            status="vacant"
        ).count()

    def get_maintenance_count(self, obj):
        return obj.units.filter(
            status="maintenance"
        ).count()


class UnitSerializer(serializers.ModelSerializer):
    floor_number = serializers.IntegerField(
        source="floor.floor_number",
        read_only=True,
    )

    building_id = serializers.IntegerField(
        source="floor.building.id",
        read_only=True,
    )

    building_name = serializers.CharField(
        source="floor.building.name",
        read_only=True,
    )

    unit_type_display = serializers.CharField(
        source="get_unit_type_display",
        read_only=True,
    )

    status_display = serializers.CharField(
        source="get_status_display",
        read_only=True,
    )

    class Meta:
        model = Unit
        fields = [
            "id",
            "floor",
            "floor_number",
            "building_id",
            "building_name",
            "unit_number",
            "name",
            "unit_type",
            "unit_type_display",
            "status",
            "status_display",
            "monthly_rent",
            "area",
            "description",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "floor_number",
            "building_id",
            "building_name",
            "unit_type_display",
            "status_display",
            "created_at",
            "updated_at",
        ]

    def validate_monthly_rent(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("Monthly rent cannot be negative.")
        return value

    def validate_area(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("Area cannot be negative.")
        return value


class TenantSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    has_account = serializers.SerializerMethodField()
    username = serializers.SerializerMethodField()
    active_lease = serializers.SerializerMethodField()
    current_unit = serializers.SerializerMethodField()
    current_building = serializers.SerializerMethodField()

    class Meta:
        model = Tenant
        fields = [
            "id",
            "first_name",
            "last_name",
            "shop_name",
            "gst_number",
            "postal_address",
            "gst_rate",
            "full_name",
            "email",
            "phone",
            "emergency_contact",
            "emergency_phone",
            "has_account",
            "username",
            "active_lease",
            "current_unit",
            "current_building",
            "must_change_password",
            "landlord",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "full_name",
            "has_account",
            "username",
            "active_lease",
            "current_unit",
            "current_building",
            "must_change_password",
            "landlord",
            "created_at",
            "updated_at",
        ]


    def validate_first_name(self, value):
        value = (value or "").strip()
        if value and not re.match(r"^[a-zA-Z\s\-']+$", value):
            raise serializers.ValidationError("First name can only contain letters, spaces, and hyphens.")
        return value

    def validate_last_name(self, value):
        value = (value or "").strip()
        if value and not re.match(r"^[a-zA-Z\s\-']+$", value):
            raise serializers.ValidationError("Last name can only contain letters, spaces, and hyphens.")
        return value

    def validate_phone(self, value):
        value = (value or "").strip()
        if value and not re.match(r"^\+?[0-9]{10,15}$", value):
            raise serializers.ValidationError("Phone number must contain 10 to 15 digits only.")
        return value

    def validate_emergency_contact(self, value):
        value = (value or "").strip()
        if value and not re.match(r"^[a-zA-Z\s\-']+$", value):
            raise serializers.ValidationError("Emergency contact name can only contain letters, spaces, and hyphens.")
        return value

    def validate_emergency_phone(self, value):
        value = (value or "").strip()
        if value and not re.match(r"^\+?[0-9]{10,15}$", value):
            raise serializers.ValidationError("Emergency phone number must contain 10 to 15 digits only.")
        return value

    def validate_email(self, value):
        if value:
            return value.strip().lower()
        return value

    def validate(self, attrs):
        shop_name = attrs.get("shop_name", getattr(self.instance, "shop_name", ""))
        email = attrs.get("email", getattr(self.instance, "email", ""))
        if shop_name and not (email or "").strip():
            raise serializers.ValidationError({
                "email": "A valid registered email address is required for commercial tenants to receive invoices and receipts."
            })
        return attrs

    def validate_gst_rate(self, value):
        if value < 0 or value > 100:
            raise serializers.ValidationError(
                "GST rate must be between 0 and 100."
            )
        return value

    def get_full_name(self, obj):
        name = (
            f"{obj.first_name} {obj.last_name}"
        ).strip()

        return (
            name
            or obj.email
            or f"Tenant #{obj.id}"
        )

    def get_has_account(self, obj):
        return obj.user_id is not None

    def get_username(self, obj):
        if not obj.user_id:
            return None

        return obj.user.username

    def get_active_lease(self, obj):
        lease = (
            obj.leases
            .filter(status="active")
            .select_related(
                "unit",
                "unit__floor",
                "unit__floor__building",
            )
            .first()
        )

        if not lease:
            return None

        return {
            "id": lease.id,
            "monthly_rent": lease.monthly_rent,
            "start_date": lease.start_date,
            "end_date": lease.end_date,
            "status": lease.status,
            "lease_type": lease.lease_type,
        }

    def get_current_unit(self, obj):
        lease = (
            obj.leases
            .filter(status="active")
            .select_related("unit")
            .first()
        )

        if not lease:
            return None

        return {
            "id": lease.unit.id,
            "unit_number": lease.unit.unit_number,
            "name": lease.unit.name,
            "unit_type": lease.unit.unit_type,
            "unit_type_display": (
                lease.unit.get_unit_type_display()
            ),
        }

    def get_current_building(self, obj):
        lease = (
            obj.leases
            .filter(status="active")
            .select_related(
                "unit__floor__building"
            )
            .first()
        )

        if not lease:
            return None

        return {
            "id": lease.unit.floor.building.id,
            "name": lease.unit.floor.building.name,
            "floor_number": (
                lease.unit.floor.floor_number
            ),
        }


class LeaseReminderSerializer(
    serializers.ModelSerializer
):
    tenant_name = serializers.SerializerMethodField()
    tenant_phone = serializers.SerializerMethodField()
    tenant_email = serializers.SerializerMethodField()
    unit_name = serializers.SerializerMethodField()
    building_name = serializers.SerializerMethodField()
    lease_end_date = serializers.SerializerMethodField()
    monthly_rent = serializers.SerializerMethodField()
    days_remaining = serializers.SerializerMethodField()

    class Meta:
        model = LeaseReminder
        fields = [
            "id",
            "lease",
            "days_before",
            "enabled",
            "sent",
            "sent_at",
            "created_at",
            "tenant_name",
            "tenant_phone",
            "tenant_email",
            "unit_name",
            "building_name",
            "lease_end_date",
            "monthly_rent",
            "days_remaining",
        ]
        read_only_fields = [
            "id",
            "sent",
            "sent_at",
            "created_at",
            "tenant_name",
            "tenant_phone",
            "tenant_email",
            "unit_name",
            "building_name",
            "lease_end_date",
            "monthly_rent",
            "days_remaining",
        ]

    def get_tenant_name(self, obj):
        if obj.lease and obj.lease.tenant:
            t = obj.lease.tenant
            name = f"{t.first_name} {t.last_name}".strip()
            return name or (t.user.get_full_name() if t.user else "Tenant")
        return "Unknown"

    def get_tenant_phone(self, obj):
        if obj.lease and obj.lease.tenant:
            return obj.lease.tenant.phone or ""
        return ""

    def get_tenant_email(self, obj):
        if obj.lease and obj.lease.tenant:
            t = obj.lease.tenant
            return t.email or (t.user.email if t.user else "")
        return ""

    def get_unit_name(self, obj):
        if obj.lease and obj.lease.unit:
            return obj.lease.unit.name
        return ""

    def get_building_name(self, obj):
        if obj.lease and obj.lease.unit and obj.lease.unit.floor and obj.lease.unit.floor.building:
            return obj.lease.unit.floor.building.name
        return ""

    def get_lease_end_date(self, obj):
        if obj.lease and obj.lease.end_date:
            return obj.lease.end_date.isoformat()
        return None

    def get_monthly_rent(self, obj):
        if obj.lease:
            return float(obj.lease.monthly_rent)
        return 0.0

    def get_days_remaining(self, obj):
        if obj.lease and obj.lease.end_date:
            today = timezone.localdate()
            return (obj.lease.end_date - today).days
        return None

    def validate_days_before(self, value):
        if value <= 0:
            raise serializers.ValidationError(
                "Reminder must be at least 1 day before expiry."
            )

        if value > 3650:
            raise serializers.ValidationError(
                "Reminder cannot be more than 10 years before expiry."
            )

        return value


class LeaseSerializer(
    serializers.ModelSerializer
):
    unit_number = serializers.CharField(
        source="unit.unit_number",
        read_only=True,
    )

    unit_name = serializers.CharField(
        source="unit.name",
        read_only=True,
    )

    unit_type = serializers.CharField(
        source="unit.unit_type",
        read_only=True,
    )

    unit_type_display = serializers.CharField(
        source="unit.get_unit_type_display",
        read_only=True,
    )

    floor_number = serializers.IntegerField(
        source="unit.floor.floor_number",
        read_only=True,
    )

    building_id = serializers.IntegerField(
        source="unit.floor.building.id",
        read_only=True,
    )

    building_name = serializers.CharField(
        source="unit.floor.building.name",
        read_only=True,
    )

    tenant_name = serializers.CharField(
        source="tenant.full_name",
        read_only=True,
    )

    tenant_email = serializers.EmailField(
        source="tenant.email",
        read_only=True,
    )

    tenant_phone = serializers.CharField(
        source="tenant.phone",
        read_only=True,
    )

    tenant_shop_name = serializers.CharField(
        source="tenant.shop_name",
        read_only=True,
    )

    tenant_gst_number = serializers.CharField(
        source="tenant.gst_number",
        read_only=True,
    )

    tenant_postal_address = serializers.CharField(
        source="tenant.postal_address",
        read_only=True,
    )

    tenant_gst_rate = serializers.DecimalField(
        source="tenant.gst_rate",
        max_digits=5,
        decimal_places=2,
        read_only=True,
    )

    tenant_first_name = serializers.CharField(
        source="tenant.first_name",
        read_only=True,
    )

    tenant_last_name = serializers.CharField(
        source="tenant.last_name",
        read_only=True,
    )

    tenant_emergency_contact = serializers.CharField(
        source="tenant.emergency_contact",
        read_only=True,
    )

    tenant_emergency_phone = serializers.CharField(
        source="tenant.emergency_phone",
        read_only=True,
    )

    agreement_file_url = serializers.SerializerMethodField()

    lease_type_display = serializers.CharField(
        source="get_lease_type_display",
        read_only=True,
    )

    status_display = serializers.CharField(
        source="get_status_display",
        read_only=True,
    )

    reminders = LeaseReminderSerializer(
        many=True,
        read_only=True,
    )

    class Meta:
        model = Lease
        fields = [
            "id",
            "unit",
            "unit_number",
            "unit_name",
            "unit_type",
            "unit_type_display",
            "floor_number",
            "building_id",
            "building_name",
            "tenant",
            "tenant_name",
            "tenant_first_name",
            "tenant_last_name",
            "tenant_email",
            "tenant_phone",
            "tenant_shop_name",
            "tenant_gst_number",
            "tenant_postal_address",
            "tenant_gst_rate",
            "tenant_emergency_contact",
            "tenant_emergency_phone",
            "lease_type",
            "lease_type_display",
            "start_date",
            "end_date",
            "monthly_rent",
            "security_deposit",
            "status",
            "status_display",
            "agreement_file",
            "agreement_file_url",
            "reminders",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "unit_number",
            "unit_name",
            "unit_type",
            "unit_type_display",
            "floor_number",
            "building_id",
            "building_name",
            "tenant_name",
            "tenant_first_name",
            "tenant_last_name",
            "tenant_email",
            "tenant_phone",
            "tenant_shop_name",
            "tenant_gst_number",
            "tenant_postal_address",
            "tenant_gst_rate",
            "tenant_emergency_contact",
            "tenant_emergency_phone",
            "lease_type_display",
            "status_display",
            "agreement_file_url",
            "reminders",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        start_date = attrs.get("start_date")
        end_date = attrs.get("end_date")

        if (
            start_date
            and end_date
            and end_date <= start_date
        ):
            raise serializers.ValidationError(
                {
                    "end_date": (
                        "End date must be after start date."
                    )
                }
            )

        monthly_rent = attrs.get("monthly_rent")

        if (
            monthly_rent is not None
            and monthly_rent < 0
        ):
            raise serializers.ValidationError(
                {
                    "monthly_rent": (
                        "Monthly rent cannot be negative."
                    )
                }
            )

        security_deposit = attrs.get(
            "security_deposit"
        )

        if (
            security_deposit is not None
            and security_deposit < 0
        ):
            raise serializers.ValidationError(
                {
                    "security_deposit": (
                        "Security deposit cannot be negative."
                    )
                }
            )

        return attrs

    def get_agreement_file_url(self, obj):
        request = self.context.get("request")

        if not obj.agreement_file:
            return None

        url = obj.agreement_file.url

        if request:
            return request.build_absolute_uri(
                url
            )

        return url


class PaymentSerializer(
    serializers.ModelSerializer
):
    tenant_name = serializers.CharField(
        source="lease.tenant.full_name",
        read_only=True,
    )

    tenant_email = serializers.EmailField(
        source="lease.tenant.email",
        read_only=True,
    )

    tenant_phone = serializers.CharField(
        source="lease.tenant.phone",
        read_only=True,
    )

    tenant_shop_name = serializers.CharField(
        source="lease.tenant.shop_name",
        read_only=True,
    )

    tenant_gst_number = serializers.CharField(
        source="lease.tenant.gst_number",
        read_only=True,
    )

    tenant_postal_address = serializers.CharField(
        source="lease.tenant.postal_address",
        read_only=True,
    )

    tenant_gst_rate = serializers.DecimalField(
        source="lease.tenant.gst_rate",
        max_digits=5,
        decimal_places=2,
        read_only=True,
    )

    unit_number = serializers.CharField(
        source="lease.unit.unit_number",
        read_only=True,
    )

    unit_name = serializers.CharField(
        source="lease.unit.name",
        read_only=True,
    )

    unit_type = serializers.CharField(
        source="lease.unit.unit_type",
        read_only=True,
    )

    unit_type_display = serializers.CharField(
        source="lease.unit.get_unit_type_display",
        read_only=True,
    )

    building_id = serializers.IntegerField(
        source="lease.unit.floor.building.id",
        read_only=True,
    )

    building_name = serializers.CharField(
        source="lease.unit.floor.building.name",
        read_only=True,
    )

    floor_number = serializers.IntegerField(
        source="lease.unit.floor.floor_number",
        read_only=True,
    )

    payment_type_display = serializers.CharField(
        source="get_payment_type_display",
        read_only=True,
    )

    payment_method_display = serializers.CharField(
        source="get_payment_method_display",
        read_only=True,
    )

    status_display = serializers.CharField(
        source="get_status_display",
        read_only=True,
    )

    latest_invoice_email = serializers.SerializerMethodField()
    latest_receipt_email = serializers.SerializerMethodField()
    latest_transaction = serializers.SerializerMethodField()
    utr = serializers.SerializerMethodField()
    transaction_reference = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = [
            "id",
            "lease",
            "tenant_name",
            "tenant_email",
            "tenant_phone",
            "tenant_shop_name",
            "tenant_gst_number",
            "tenant_postal_address",
            "tenant_gst_rate",
            "unit_number",
            "unit_name",
            "unit_type",
            "unit_type_display",
            "building_id",
            "building_name",
            "floor_number",
            "payment_type",
            "payment_type_display",
            "amount",
            "due_date",
            "paid_date",
            "payment_method",
            "payment_method_display",
            "status",
            "status_display",
            "transaction_id",
            "transaction_reference",
            "utr",
            "latest_transaction",
            "latest_invoice_email",
            "latest_receipt_email",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "tenant_name",
            "tenant_email",
            "tenant_phone",
            "tenant_shop_name",
            "tenant_gst_number",
            "tenant_postal_address",
            "tenant_gst_rate",
            "unit_number",
            "unit_name",
            "unit_type",
            "unit_type_display",
            "building_id",
            "building_name",
            "floor_number",
            "payment_type_display",
            "payment_method_display",
            "status_display",
            "transaction_reference",
            "utr",
            "latest_transaction",
            "latest_invoice_email",
            "latest_receipt_email",
            "created_at",
        ]

    def get_latest_invoice_email(self, obj):
        log = obj.latest_invoice_email
        if not log:
            return None
        return {
            "id": log.id,
            "status": log.status,
            "status_display": log.get_status_display(),
            "recipient_email": log.recipient_email,
            "subject": log.subject,
            "error_message": log.error_message,
            "retry_count": log.retry_count,
            "sent_at": log.sent_at,
            "created_at": log.created_at,
        }

    def get_latest_receipt_email(self, obj):
        log = obj.latest_receipt_email
        if not log:
            return None
        return {
            "id": log.id,
            "status": log.status,
            "status_display": log.get_status_display(),
            "recipient_email": log.recipient_email,
            "subject": log.subject,
            "error_message": log.error_message,
            "retry_count": log.retry_count,
            "sent_at": log.sent_at,
            "created_at": log.created_at,
        }

    def get_latest_transaction(self, obj):
        txn = obj.transactions.order_by("-created_at").first()
        if not txn:
            return None
        return {
            "id": txn.id,
            "transaction_reference": txn.transaction_reference,
            "utr": txn.utr,
            "status": txn.status,
            "status_display": txn.get_status_display(),
            "amount": str(txn.amount),
            "upi_id": txn.upi_id,
            "initiated_at": txn.initiated_at,
            "paid_at": txn.paid_at,
        }

    def get_utr(self, obj):
        txn = obj.transactions.filter(status__in=["PENDING", "SUCCESS"]).order_by("-created_at").first()
        return txn.utr if txn else ""

    def get_transaction_reference(self, obj):
        txn = obj.transactions.order_by("-created_at").first()
        return txn.transaction_reference if txn else ""

    def validate(self, attrs):
        amount = attrs.get("amount")

        if amount is not None and amount <= 0:
            raise serializers.ValidationError(
                {
                    "amount": (
                        "Payment amount must be greater than zero."
                    )
                }
            )

        paid_date = attrs.get("paid_date")
        status_value = attrs.get("status")

        if (
            status_value == "paid"
            and not paid_date
        ):
            raise serializers.ValidationError(
                {
                    "paid_date": (
                        "Paid date is required for a paid payment."
                    )
                }
            )

        if (
            status_value == "paid"
            and not attrs.get(
                "payment_method"
            )
        ):
            raise serializers.ValidationError(
                {
                    "payment_method": (
                        "Payment method is required for a paid payment."
                    )
                }
            )

        return attrs


class MaintenanceRequestSerializer(
    serializers.ModelSerializer
):
    unit_number = serializers.CharField(
        source="unit.unit_number",
        read_only=True,
    )

    unit_name = serializers.CharField(
        source="unit.name",
        read_only=True,
    )

    unit_type = serializers.CharField(
        source="unit.unit_type",
        read_only=True,
    )

    unit_type_display = serializers.CharField(
        source="unit.get_unit_type_display",
        read_only=True,
    )

    building_name = serializers.CharField(
        source="unit.floor.building.name",
        read_only=True,
    )

    building_id = serializers.IntegerField(
        source="unit.floor.building.id",
        read_only=True,
    )

    floor_number = serializers.IntegerField(
        source="unit.floor.floor_number",
        read_only=True,
    )

    tenant_name = serializers.CharField(
        source="tenant.full_name",
        read_only=True,
    )

    category_display = serializers.CharField(
        source="get_category_display",
        read_only=True,
    )

    status_display = serializers.CharField(
        source="get_status_display",
        read_only=True,
    )

    priority_display = serializers.CharField(
        source="get_priority_display",
        read_only=True,
    )

    class Meta:
        model = MaintenanceRequest
        fields = [
            "id",
            "unit",
            "unit_number",
            "unit_name",
            "unit_type",
            "unit_type_display",
            "building_name",
            "building_id",
            "floor_number",
            "tenant",
            "tenant_name",
            "title",
            "category",
            "category_display",
            "description",
            "priority",
            "priority_display",
            "status",
            "status_display",
            "image",
            "landlord_response",
            "resolved_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "unit_number",
            "unit_name",
            "unit_type",
            "unit_type_display",
            "building_name",
            "building_id",
            "floor_number",
            "tenant",
            "tenant_name",
            "category_display",
            "priority_display",
            "status_display",
            "created_at",
            "updated_at",
        ]

    def validate_image(self, value):
        if not value:
            return value

        # File size limit: 5 MB
        max_size = 5 * 1024 * 1024
        if value.size > max_size:
            raise serializers.ValidationError("Attached image file size must not exceed 5 MB.")

        allowed_extensions = [".jpg", ".jpeg", ".png", ".webp"]
        ext = os.path.splitext(value.name)[1].lower()
        if ext not in allowed_extensions:
            raise serializers.ValidationError(
                f"Unsupported image format '{ext}'. Allowed formats are JPEG, PNG, and WebP."
            )

        content_type = getattr(value, "content_type", "").lower()
        if content_type and content_type not in ["image/jpeg", "image/png", "image/webp", "image/pjpeg"]:
            raise serializers.ValidationError(
                f"Invalid file MIME type '{content_type}'. Must be JPEG, PNG, or WebP."
            )

        return value

    def validate(self, attrs):
        request = self.context.get("request")
        user = request.user if request else None

        if user and hasattr(user, "tenant_profile"):
            attrs.pop("landlord_response", None)
            attrs.pop("resolved_at", None)
            if self.instance:
                attrs.pop("status", None)

        return attrs



class BillingEmailLogSerializer(serializers.ModelSerializer):
    email_type_display = serializers.CharField(
        source="get_email_type_display",
        read_only=True,
    )
    status_display = serializers.CharField(
        source="get_status_display",
        read_only=True,
    )

    class Meta:
        model = BillingEmailLog
        fields = [
            "id",
            "payment",
            "lease",
            "email_type",
            "email_type_display",
            "recipient_email",
            "subject",
            "status",
            "status_display",
            "error_message",
            "retry_count",
            "max_retries",
            "sent_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class PaymentTransactionSerializer(serializers.ModelSerializer):
    tenant_name = serializers.CharField(source="tenant.full_name", read_only=True)
    tenant_email = serializers.EmailField(source="tenant.email", read_only=True)
    tenant_phone = serializers.CharField(source="tenant.phone", read_only=True)
    landlord_name = serializers.CharField(source="landlord.user.get_full_name", read_only=True)
    building_name = serializers.CharField(source="building.name", read_only=True)
    unit_number = serializers.CharField(source="payment.lease.unit.unit_number", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    invoice_due_date = serializers.DateField(source="payment.due_date", read_only=True)
    upi_uri = serializers.SerializerMethodField()

    class Meta:
        model = PaymentTransaction
        fields = [
            "id",
            "tenant",
            "tenant_name",
            "tenant_email",
            "tenant_phone",
            "landlord",
            "landlord_name",
            "building",
            "building_name",
            "unit_number",
            "payment",
            "invoice_due_date",
            "amount",
            "currency",
            "payment_method",
            "upi_id",
            "transaction_reference",
            "utr",
            "status",
            "status_display",
            "description",
            "upi_uri",
            "initiated_at",
            "paid_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "tenant",
            "tenant_name",
            "tenant_email",
            "tenant_phone",
            "landlord",
            "landlord_name",
            "building",
            "building_name",
            "unit_number",
            "payment",
            "invoice_due_date",
            "amount",
            "currency",
            "payment_method",
            "upi_id",
            "transaction_reference",
            "status",
            "status_display",
            "upi_uri",
            "initiated_at",
            "paid_at",
            "created_at",
            "updated_at",
        ]

    def get_upi_uri(self, obj):
        if obj.status == "CANCELLED":
            return None
        try:
            from .upi_service import build_upi_intent_uri
            payee_name = obj.landlord.user.get_full_name() or obj.landlord.user.username
            return build_upi_intent_uri(
                upi_id=obj.upi_id,
                payee_name=payee_name,
                amount=obj.amount,
                transaction_ref=obj.transaction_reference,
                note=obj.description or f"Rent payment {obj.transaction_reference}",
            )
        except Exception:
            return None
