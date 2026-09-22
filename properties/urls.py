from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    InvoiceSettingsViewSet,
    BuildingViewSet,
    FloorViewSet,
    UnitViewSet,
    TenantViewSet,
    LeaseViewSet,
    LeaseReminderViewSet,
    PaymentViewSet,
    MaintenanceRequestViewSet,
    BillingEmailLogViewSet,
    AnalyticsViewSet,
)



router = DefaultRouter()

router.register(
    r"analytics",
    AnalyticsViewSet,
    basename="analytics",
)

router.register(
    r"buildings",
    BuildingViewSet,
    basename="building",
)
router.register(
    r"invoice-settings",
    InvoiceSettingsViewSet,
    basename="invoice-settings",
)

router.register(
    r"floors",
    FloorViewSet,
    basename="floor",
)

router.register(
    r"units",
    UnitViewSet,
    basename="unit",
)

router.register(
    r"tenants",
    TenantViewSet,
    basename="tenant",
)

router.register(
    r"leases",
    LeaseViewSet,
    basename="lease",
)

router.register(
    r"lease-reminders",
    LeaseReminderViewSet,
    basename="lease-reminder",
)

router.register(
    r"payments",
    PaymentViewSet,
    basename="payment",
)



router.register(
    r"maintenance",
    MaintenanceRequestViewSet,
    basename="maintenance",
)

router.register(
    r"billing-emails",
    BillingEmailLogViewSet,
    basename="billing-email",
)



urlpatterns = [
    path(
        "",
        include(router.urls),
    ),
]