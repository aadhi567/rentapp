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
)


class InvoiceSettingsSerializer(serializers.ModelSerializer):
    logo_url = serializers.SerializerMethodField()
    signature_url = serializers.SerializerMethodField()

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
            "due_day",
            "logo",
            "logo_url",
            "signature",
            "signature_url",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "landlord",
            "logo_url",
            "signature_url",
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

    def validate(self, attrs):
        for field in ("logo", "signature"):
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

        due_day = attrs.get(
            "due_day",
            getattr(self.instance, "due_day", 7),
        )

        if due_day < 1 or due_day > 31:
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
            "created_at",
            "updated_at",
        ]

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
        ]
        read_only_fields = [
            "id",
            "sent",
            "sent_at",
            "created_at",
        ]

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
            "description",
            "priority",
            "status",
            "image",
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
            "created_at",
            "updated_at",
        ]


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