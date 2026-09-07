from django.contrib import admin

from .models import (
    Landlord,
    Building,
    Floor,
    Unit,
    Tenant,
    Lease,
    Payment,
    MaintenanceRequest,
    BillingEmailLog,
)


@admin.register(Landlord)
class LandlordAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "phone",
        "address",
        "created_at",
    )

    search_fields = (
        "user__username",
        "user__first_name",
        "user__last_name",
        "user__email",
        "phone",
    )


@admin.register(Building)
class BuildingAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "landlord",
        "number_of_floors",
        "city",
        "state",
        "created_at",
    )

    list_filter = (
        "city",
        "state",
    )

    search_fields = (
        "name",
        "address",
        "city",
        "landlord__user__username",
    )


@admin.register(Floor)
class FloorAdmin(admin.ModelAdmin):
    list_display = (
        "building",
        "floor_number",
        "created_at",
    )

    list_filter = (
        "building",
        "floor_number",
    )

    search_fields = (
        "building__name",
    )

    ordering = (
        "building",
        "floor_number",
    )


@admin.register(Unit)
class UnitAdmin(admin.ModelAdmin):
    list_display = (
        "unit_number",
        "name",
        "unit_type",
        "status",
        "floor",
        "monthly_rent",
        "area",
        "created_at",
    )

    list_filter = (
        "unit_type",
        "status",
    )

    search_fields = (
        "unit_number",
        "name",
        "floor__building__name",
        "floor__floor_number",
    )

    ordering = (
        "floor__building",
        "floor__floor_number",
        "unit_number",
    )


@admin.register(Tenant)
class TenantAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "phone",
        "emergency_contact",
        "emergency_phone",
        "created_at",
    )

    search_fields = (
        "user__username",
        "user__first_name",
        "user__last_name",
        "user__email",
        "phone",
    )


@admin.register(Lease)
class LeaseAdmin(admin.ModelAdmin):
    list_display = (
        "unit",
        "tenant",
        "lease_type",
        "start_date",
        "end_date",
        "monthly_rent",
        "security_deposit",
        "status",
        "created_at",
    )

    list_filter = (
        "lease_type",
        "status",
        "start_date",
        "end_date",
    )

    search_fields = (
        "unit__unit_number",
        "unit__name",
        "unit__floor__building__name",
        "tenant__user__username",
        "tenant__user__email",
    )

    ordering = (
        "-created_at",
    )


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = (
        "lease",
        "payment_type",
        "amount",
        "due_date",
        "paid_date",
        "payment_method",
        "status",
        "created_at",
    )

    list_filter = (
        "payment_type",
        "status",
        "payment_method",
        "due_date",
    )

    search_fields = (
        "transaction_id",
        "lease__unit__unit_number",
        "lease__unit__name",
        "lease__tenant__user__username",
    )

    ordering = (
        "-due_date",
    )


@admin.register(MaintenanceRequest)
class MaintenanceRequestAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "unit",
        "tenant",
        "priority",
        "status",
        "created_at",
    )

    list_filter = (
        "priority",
        "status",
        "created_at",
    )

    search_fields = (
        "title",
        "description",
        "unit__unit_number",
        "unit__name",
        "unit__floor__building__name",
        "tenant__user__username",
    )

    ordering = (
        "-created_at",
    )


@admin.register(BillingEmailLog)
class BillingEmailLogAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "payment",
        "email_type",
        "recipient_email",
        "status",
        "retry_count",
        "sent_at",
        "created_at",
    )

    list_filter = (
        "email_type",
        "status",
        "created_at",
    )

    search_fields = (
        "recipient_email",
        "subject",
        "payment__id",
        "payment__lease__tenant__first_name",
        "payment__lease__tenant__last_name",
    )

    ordering = (
        "-created_at",
    )