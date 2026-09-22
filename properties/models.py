from django.contrib.auth.models import User
from django.db import models


class Landlord(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="landlord_profile",
    )

    phone = models.CharField(
        max_length=15,
        blank=True,
    )

    address = models.CharField(
        max_length=300,
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    def __str__(self):
        return (
            self.user.get_full_name()
            or self.user.username
        )


class InvoiceSettings(models.Model):
    # One invoice template can be assigned to a building.
    # Nullable for the first migration so any existing landlord-level
    # settings are not destroyed; new templates must specify a building.
    building = models.OneToOneField(
        "Building",
        on_delete=models.CASCADE,
        related_name="invoice_settings",
        null=True,
        blank=True,
    )

    # Retained temporarily for existing settings during the transition.
    landlord = models.ForeignKey(
        Landlord,
        on_delete=models.CASCADE,
        related_name="legacy_invoice_settings",
        null=True,
        blank=True,
    )

    business_name = models.CharField(
        max_length=200,
        blank=True,
        default="",
    )

    address = models.CharField(
        max_length=300,
        blank=True,
        default="",
    )

    city = models.CharField(
        max_length=100,
        blank=True,
        default="",
    )

    state = models.CharField(
        max_length=100,
        blank=True,
        default="",
    )

    pincode = models.CharField(
        max_length=10,
        blank=True,
        default="",
    )

    phone = models.CharField(
        max_length=15,
        blank=True,
        default="",
    )

    email = models.EmailField(
        blank=True,
        default="",
    )

    gstin = models.CharField(
        max_length=30,
        blank=True,
        default="",
    )

    bank_name = models.CharField(
        max_length=150,
        blank=True,
        default="",
    )

    account_number = models.CharField(
        max_length=100,
        blank=True,
        default="",
    )

    ifsc = models.CharField(
        max_length=20,
        blank=True,
        default="",
    )

    branch = models.CharField(
        max_length=150,
        blank=True,
        default="",
    )

    payment_instructions = models.TextField(
        blank=True,
        default="",
    )

    upi_id = models.CharField(
        max_length=100,
        blank=True,
        default="",
    )

    due_day = models.PositiveSmallIntegerField(
        default=7,
        help_text="Day of month (1-31) when the invoice is due.",
    )

    logo = models.FileField(
        upload_to="invoice_assets/logos/",
        blank=True,
        null=True,
    )

    signature = models.FileField(
        upload_to="invoice_assets/signatures/",
        blank=True,
        null=True,
    )

    upi_qr_code = models.FileField(
        upload_to="invoice_assets/upi_qr/",
        blank=True,
        null=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    def __str__(self):
        return (
            self.business_name
            or (
                f"Invoice settings for {self.building}"
                if self.building_id
                else f"Invoice settings for {self.landlord}"
            )
        )


class Building(models.Model):
    landlord = models.ForeignKey(
        Landlord,
        on_delete=models.CASCADE,
        related_name="buildings",
    )

    name = models.CharField(
        max_length=200,
    )

    address = models.CharField(
        max_length=300,
    )

    city = models.CharField(
        max_length=100,
    )

    state = models.CharField(
        max_length=100,
    )

    pincode = models.CharField(
        max_length=10,
    )

    number_of_floors = models.PositiveIntegerField(
        default=1,
    )

    description = models.TextField(
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    def __str__(self):
        return self.name


class Floor(models.Model):
    building = models.ForeignKey(
        Building,
        on_delete=models.CASCADE,
        related_name="floors",
    )

    floor_number = models.PositiveIntegerField()

    description = models.TextField(
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    class Meta:
        ordering = ["floor_number"]

        constraints = [
            models.UniqueConstraint(
                fields=[
                    "building",
                    "floor_number",
                ],
                name="unique_floor_number_per_building",
            )
        ]

    def __str__(self):
        return (
            f"{self.building.name} - "
            f"Floor {self.floor_number}"
        )


class Unit(models.Model):

    UNIT_TYPES = [
        (
            "residential",
            "Residential",
        ),
        (
            "commercial",
            "Commercial",
        ),
    ]

    UNIT_STATUS = [
        (
            "vacant",
            "Vacant",
        ),
        (
            "occupied",
            "Occupied",
        ),
        (
            "maintenance",
            "Under Maintenance",
        ),
        (
            "inactive",
            "Inactive",
        ),
    ]

    floor = models.ForeignKey(
        Floor,
        on_delete=models.CASCADE,
        related_name="units",
    )

    unit_number = models.CharField(
        max_length=50,
    )

    name = models.CharField(
        max_length=150,
    )

    unit_type = models.CharField(
        max_length=20,
        choices=UNIT_TYPES,
        default="residential",
    )

    status = models.CharField(
        max_length=20,
        choices=UNIT_STATUS,
        default="vacant",
    )

    monthly_rent = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
    )

    area = models.PositiveIntegerField(
        default=0,
        help_text="Area in square feet",
    )

    description = models.TextField(
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=[
                    "floor",
                    "unit_number",
                ],
                name="unique_unit_number_per_floor",
            )
        ]

    def __str__(self):
        return (
            f"{self.name} "
            f"({self.unit_number})"
        )


class Tenant(models.Model):
    """
    Phase 1:
    Tenant is only a rental/contact record.

    Phase 2:
    A Django User account can be attached later.
    """

    user = models.OneToOneField(
        User,
        on_delete=models.SET_NULL,
        related_name="tenant_profile",
        null=True,
        blank=True,
    )

    first_name = models.CharField(
        max_length=100,
        default="",
    )

    last_name = models.CharField(
        max_length=100,
        blank=True,
        default="",
    )

    shop_name = models.CharField(
        max_length=200,
        blank=True,
        default="",
    )

    gst_number = models.CharField(
        max_length=30,
        blank=True,
        default="",
    )

    postal_address = models.TextField(
        blank=True,
        default="",
    )

    gst_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
    )

    email = models.EmailField(
        blank=True,
        default="",
    )

    phone = models.CharField(
        max_length=15,
        blank=True,
        default="",
    )

    emergency_contact = models.CharField(
        max_length=100,
        blank=True,
        default="",
    )

    emergency_phone = models.CharField(
        max_length=15,
        blank=True,
        default="",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    def __str__(self):
        full_name = (
            f"{self.first_name} "
            f"{self.last_name}"
        ).strip()

        return (
            full_name
            or self.email
            or f"Tenant #{self.id}"
        )


class Lease(models.Model):

    LEASE_TYPES = [
        (
            "rent",
            "Monthly Rent",
        ),
        (
            "lease",
            "Lease",
        ),
    ]

    LEASE_STATUS = [
        (
            "pending",
            "Pending",
        ),
        (
            "active",
            "Active",
        ),
        (
            "expired",
            "Expired",
        ),
        (
            "terminated",
            "Terminated",
        ),
    ]

    unit = models.ForeignKey(
        Unit,
        on_delete=models.CASCADE,
        related_name="leases",
    )

    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        related_name="leases",
    )

    lease_type = models.CharField(
        max_length=20,
        choices=LEASE_TYPES,
        default="rent",
    )

    start_date = models.DateField()

    end_date = models.DateField()

    monthly_rent = models.DecimalField(
        max_digits=10,
        decimal_places=2,
    )

    security_deposit = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
    )

    status = models.CharField(
        max_length=20,
        choices=LEASE_STATUS,
        default="pending",
    )

    agreement_file = models.FileField(
        upload_to="lease_agreements/",
        blank=True,
        null=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["unit"],
                condition=models.Q(
                    status="active"
                ),
                name="one_active_lease_per_unit",
            )
        ]

    def __str__(self):
        return (
            f"{self.unit.name} - "
            f"{self.tenant}"
        )


class LeaseReminder(models.Model):
    lease = models.ForeignKey(
        Lease,
        on_delete=models.CASCADE,
        related_name="reminders",
    )

    days_before = models.PositiveIntegerField()

    enabled = models.BooleanField(
        default=True,
    )

    sent = models.BooleanField(
        default=False,
    )

    sent_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    class Meta:
        ordering = ["-days_before"]

        constraints = [
            models.UniqueConstraint(
                fields=[
                    "lease",
                    "days_before",
                ],
                name="unique_lease_reminder_days",
            )
        ]

    def __str__(self):
        return (
            f"{self.lease} - "
            f"{self.days_before} days before"
        )


class Payment(models.Model):

    PAYMENT_STATUS = [
        (
            "pending",
            "Pending",
        ),
        (
            "paid",
            "Paid",
        ),
        (
            "failed",
            "Failed",
        ),
        (
            "overdue",
            "Overdue",
        ),
    ]

    PAYMENT_METHODS = [
        (
            "online",
            "Online",
        ),
        (
            "cash",
            "Cash",
        ),
        (
            "bank_transfer",
            "Bank Transfer",
        ),
    ]

    PAYMENT_TYPES = [
        (
            "rent",
            "Monthly Rent",
        ),
        (
            "security_deposit",
            "Security Deposit",
        ),
        (
            "other",
            "Other",
        ),
    ]

    lease = models.ForeignKey(
        Lease,
        on_delete=models.CASCADE,
        related_name="payments",
    )

    payment_type = models.CharField(
        max_length=30,
        choices=PAYMENT_TYPES,
        default="rent",
    )

    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
    )

    due_date = models.DateField()

    paid_date = models.DateField(
        null=True,
        blank=True,
    )

    payment_method = models.CharField(
        max_length=20,
        choices=PAYMENT_METHODS,
        blank=True,
        default="",
    )

    status = models.CharField(
        max_length=20,
        choices=PAYMENT_STATUS,
        default="pending",
    )

    transaction_id = models.CharField(
        max_length=200,
        blank=True,
        default="",
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    def __str__(self):
        return (
            f"{self.payment_type} - "
            f"₹{self.amount}"
        )

    @property
    def latest_invoice_email(self):
        return self.email_logs.filter(email_type="invoice").order_by("-created_at").first()

    @property
    def latest_receipt_email(self):
        return self.email_logs.filter(email_type="receipt").order_by("-created_at").first()


class MaintenanceRequest(models.Model):

    REQUEST_STATUS = [
        (
            "pending",
            "Pending",
        ),
        (
            "in_progress",
            "In Progress",
        ),
        (
            "resolved",
            "Resolved",
        ),
        (
            "rejected",
            "Rejected",
        ),
    ]

    PRIORITY_LEVELS = [
        (
            "low",
            "Low",
        ),
        (
            "medium",
            "Medium",
        ),
        (
            "high",
            "High",
        ),
        (
            "urgent",
            "Urgent",
        ),
    ]

    unit = models.ForeignKey(
        Unit,
        on_delete=models.CASCADE,
        related_name="maintenance_requests",
    )

    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        related_name="maintenance_requests",
    )

    title = models.CharField(
        max_length=200,
    )

    description = models.TextField()

    priority = models.CharField(
        max_length=20,
        choices=PRIORITY_LEVELS,
        default="medium",
    )

    status = models.CharField(
        max_length=20,
        choices=REQUEST_STATUS,
        default="pending",
    )

    image = models.ImageField(
        upload_to="maintenance/",
        blank=True,
        null=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    def __str__(self):
        return self.title


class BillingEmailLog(models.Model):
    EMAIL_TYPES = [
        ("invoice", "Commercial Invoice"),
        ("receipt", "Payment Receipt"),
        ("reminder", "Payment Reminder"),
        ("lease_renewal", "Lease Renewal Notice"),
    ]

    EMAIL_STATUS = [
        ("pending", "Pending"),
        ("sent", "Sent"),
        ("failed", "Failed"),
    ]

    payment = models.ForeignKey(
        Payment,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="email_logs",
    )

    lease = models.ForeignKey(
        Lease,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="email_logs",
    )

    email_type = models.CharField(
        max_length=20,
        choices=EMAIL_TYPES,
    )

    recipient_email = models.EmailField()

    subject = models.CharField(
        max_length=255,
    )

    status = models.CharField(
        max_length=20,
        choices=EMAIL_STATUS,
        default="pending",
    )

    error_message = models.TextField(
        blank=True,
        default="",
    )

    retry_count = models.PositiveIntegerField(
        default=0,
    )

    max_retries = models.PositiveIntegerField(
        default=3,
    )

    sent_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["payment", "email_type"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return f"{self.get_email_type_display()} to {self.recipient_email} ({self.status})"