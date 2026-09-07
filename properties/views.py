import json
from decimal import Decimal, ROUND_HALF_UP
from io import BytesIO
from pathlib import Path

from rest_framework.decorators import action

from django.db import transaction
from django.db.models import Q
from django.utils.dateparse import parse_date
from django.http import FileResponse
from django.utils import timezone

from rest_framework import status, viewsets
from rest_framework.exceptions import (
    PermissionDenied,
    ValidationError,
)
from rest_framework.parsers import (
    FormParser,
    MultiPartParser,
)
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    Image,
)
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER

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

from .serializers import (
    InvoiceSettingsSerializer,
    BuildingSerializer,
    FloorSerializer,
    UnitSerializer,
    TenantSerializer,
    LeaseSerializer,
    LeaseReminderSerializer,
    PaymentSerializer,
    MaintenanceRequestSerializer,
    BillingEmailLogSerializer,
)

from .billing_communication import (
    send_invoice_email,
    send_receipt_email,
    generate_monthly_invoices,
    retry_failed_billing_emails,
)


class InvoiceSettingsViewSet(viewsets.ModelViewSet):
    serializer_class = InvoiceSettingsSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [
        MultiPartParser,
        FormParser,
    ]


    def get_queryset(self):
        user = self.request.user

        if not hasattr(
            user,
            "landlord_profile",
        ):
            return InvoiceSettings.objects.none()

        return (
            InvoiceSettings.objects
            .filter(
                Q(landlord=user.landlord_profile) |
                Q(building__landlord=user.landlord_profile)
            )
            .select_related(
                "building",
                "building__landlord",
            )
            .distinct()
        )

    def perform_create(self, serializer):
        user = self.request.user

        if not hasattr(
            user,
            "landlord_profile",
        ):
            raise PermissionDenied(
                "Only landlords can create invoice settings."
            )

        building = serializer.validated_data.get(
            "building"
        )

        if not building:
            raise ValidationError(
                {"building": "Building is required."}
            )

        if (
            building.landlord
            != user.landlord_profile
        ):
            raise PermissionDenied(
                "You can only create invoice templates for your own buildings."
            )

        if InvoiceSettings.objects.filter(
            building=building
        ).exists():
            raise ValidationError(
                "An invoice template already exists for this building."
            )

        serializer.save(
            landlord=user.landlord_profile
        )

    def perform_update(self, serializer):
        user = self.request.user

        if not hasattr(
            user,
            "landlord_profile",
        ):
            raise PermissionDenied(
                "Only landlords can update invoice settings."
            )

        settings = self.get_object()

        if (
            settings.landlord
            != user.landlord_profile
        ):
            raise PermissionDenied(
                "You can only update invoice templates for your own buildings."
            )

        building = serializer.validated_data.get(
            "building",
            settings.building,
        )

        if not building:
            raise ValidationError(
                {"building": "Building is required."}
            )

        if (
            building.landlord
            != user.landlord_profile
        ):
            raise PermissionDenied(
                "You can only use your own buildings."
            )

        duplicate = (
            InvoiceSettings.objects
            .filter(building=building)
            .exclude(id=settings.id)
            .exists()
        )

        if duplicate:
            raise ValidationError(
                "An invoice template already exists for this building."
            )

        serializer.save(
            landlord=user.landlord_profile
        )

    def perform_destroy(self, instance):
        user = self.request.user

        if not hasattr(
            user,
            "landlord_profile",
        ):
            raise PermissionDenied(
                "Only landlords can delete invoice settings."
            )

        if (
            instance.landlord != user.landlord_profile
        ):
            raise PermissionDenied(
                "You can only delete your own invoice templates."
            )

        instance.delete()


class BuildingViewSet(viewsets.ModelViewSet):
    serializer_class = BuildingSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        if not hasattr(user, "landlord_profile"):
            return Building.objects.none()

        return (
            Building.objects.filter(
                landlord=user.landlord_profile
            )
            .prefetch_related(
                "floors__units"
            )
            .order_by("name")
        )

    def perform_create(self, serializer):
        user = self.request.user

        if not hasattr(
            user,
            "landlord_profile",
        ):
            raise PermissionDenied(
                "Only landlords can create buildings."
            )

        building = serializer.save(
            landlord=user.landlord_profile
        )

        Floor.objects.bulk_create(
            [
                Floor(
                    building=building,
                    floor_number=floor_number,
                )
                for floor_number in range(
                    building.number_of_floors
                )
            ]
        )

    def perform_update(self, serializer):
        user = self.request.user

        if not hasattr(
            user,
            "landlord_profile",
        ):
            raise PermissionDenied(
                "Only landlords can update buildings."
            )

        serializer.save()

    def destroy(
        self,
        request,
        *args,
        **kwargs,
    ):
        building = self.get_object()

        if Unit.objects.filter(
            floor__building=building,
            status="occupied",
        ).exists():
            return Response(
                {
                    "detail": (
                        "This building cannot be deleted because it contains occupied units."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if Lease.objects.filter(
            unit__floor__building=building,
            status="active",
        ).exists():
            return Response(
                {
                    "detail": (
                        "This building cannot be deleted because it contains active leases."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if Payment.objects.filter(
            lease__unit__floor__building=building,
            status__in=[
                "pending",
                "overdue",
            ],
        ).exists():
            return Response(
                {
                    "detail": (
                        "This building cannot be deleted because pending or overdue payments exist."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if MaintenanceRequest.objects.filter(
            unit__floor__building=building,
            status__in=[
                "pending",
                "in_progress",
            ],
        ).exists():
            return Response(
                {
                    "detail": (
                        "This building cannot be deleted because open maintenance requests exist."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        return super().destroy(
            request,
            *args,
            **kwargs,
        )


class FloorViewSet(viewsets.ModelViewSet):
    serializer_class = FloorSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        if not hasattr(
            user,
            "landlord_profile",
        ):
            return Floor.objects.none()

        return (
            Floor.objects.filter(
                building__landlord=user.landlord_profile
            )
            .select_related("building")
            .prefetch_related("units")
            .order_by(
                "building",
                "floor_number",
            )
        )

    def perform_create(self, serializer):
        user = self.request.user

        if not hasattr(
            user,
            "landlord_profile",
        ):
            raise PermissionDenied(
                "Only landlords can create floors."
            )

        building = serializer.validated_data[
            "building"
        ]

        if (
            building.landlord
            != user.landlord_profile
        ):
            raise PermissionDenied(
                "You can only create floors in your own buildings."
            )

        serializer.save()


class UnitViewSet(viewsets.ModelViewSet):
    serializer_class = UnitSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        if hasattr(
            user,
            "landlord_profile",
        ):
            return (
                Unit.objects.filter(
                    floor__building__landlord=(
                        user.landlord_profile
                    )
                )
                .select_related(
                    "floor",
                    "floor__building",
                )
                .order_by(
                    "floor__building__name",
                    "floor__floor_number",
                    "unit_number",
                )
            )

        if hasattr(
            user,
            "tenant_profile",
        ):
            return (
                Unit.objects.filter(
                    leases__tenant=user.tenant_profile,
                    leases__status="active",
                )
                .select_related(
                    "floor",
                    "floor__building",
                )
                .distinct()
            )

        return Unit.objects.none()

    def perform_create(self, serializer):
        user = self.request.user

        if not hasattr(
            user,
            "landlord_profile",
        ):
            raise PermissionDenied(
                "Only landlords can create units."
            )

        floor = serializer.validated_data[
            "floor"
        ]

        if (
            floor.building.landlord
            != user.landlord_profile
        ):
            raise PermissionDenied(
                "You can only create units in your own buildings."
            )

        serializer.save()

    def perform_update(self, serializer):
        user = self.request.user

        if not hasattr(
            user,
            "landlord_profile",
        ):
            raise PermissionDenied(
                "Only landlords can update units."
            )

        unit = self.get_object()

        if (
            unit.floor.building.landlord
            != user.landlord_profile
        ):
            raise PermissionDenied(
                "You can only update your own units."
            )

        serializer.save()

    def destroy(
        self,
        request,
        *args,
        **kwargs,
    ):
        unit = self.get_object()

        if unit.leases.filter(
            status="active"
        ).exists():
            return Response(
                {
                    "detail": (
                        "This unit cannot be deleted because it has an active lease."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        return super().destroy(
            request,
            *args,
            **kwargs,
        )


class TenantViewSet(viewsets.ModelViewSet):
    serializer_class = TenantSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        if hasattr(
            user,
            "landlord_profile",
        ):
            return (
                Tenant.objects
                .filter(
                    leases__unit__floor__building__landlord=(
                        user.landlord_profile
                    )
                )
                .select_related("user")
                .prefetch_related(
                    "leases__unit__floor__building",
                    "leases__reminders",
                )
                .distinct()
                .order_by(
                    "first_name",
                    "last_name",
                    "id",
                )
            )

        if hasattr(
            user,
            "tenant_profile",
        ):
            return Tenant.objects.filter(
                id=user.tenant_profile.id
            ).select_related("user")

        return Tenant.objects.none()

    def perform_create(self, serializer):
        user = self.request.user

        if not hasattr(
            user,
            "landlord_profile",
        ):
            raise PermissionDenied(
                "Only landlords can create tenants."
            )

        serializer.save()

    def perform_update(self, serializer):
        user = self.request.user

        if not hasattr(
            user,
            "landlord_profile",
        ):
            raise PermissionDenied(
                "Only landlords can update tenants."
            )

        serializer.save()


class LeaseViewSet(viewsets.ModelViewSet):
    serializer_class = LeaseSerializer
    permission_classes = [IsAuthenticated]

    parser_classes = [
        MultiPartParser,
        FormParser,
    ]

    def get_queryset(self):
        user = self.request.user

        if hasattr(
            user,
            "landlord_profile",
        ):
            return (
                Lease.objects.filter(
                    unit__floor__building__landlord=(
                        user.landlord_profile
                    )
                )
                .select_related(
                    "unit",
                    "unit__floor",
                    "unit__floor__building",
                    "tenant",
                )
                .prefetch_related(
                    "reminders"
                )
                .order_by("-created_at")
            )

        if hasattr(
            user,
            "tenant_profile",
        ):
            return (
                Lease.objects.filter(
                    tenant=user.tenant_profile
                )
                .select_related(
                    "unit",
                    "unit__floor",
                    "unit__floor__building",
                    "tenant",
                )
                .prefetch_related(
                    "reminders"
                )
                .order_by("-created_at")
            )

        return Lease.objects.none()

    def _get_landlord(self):
        user = self.request.user

        if not hasattr(
            user,
            "landlord_profile",
        ):
            raise PermissionDenied(
                "Only landlords can manage leases."
            )

        return user.landlord_profile

    def _validate_unit(
        self,
        unit,
        landlord,
        current_lease_id=None,
    ):
        if (
            unit.floor.building.landlord
            != landlord
        ):
            raise PermissionDenied(
                "You can only use units from your own buildings."
            )

        if unit.status in [
            "maintenance",
            "inactive",
        ]:
            raise ValidationError(
                "This unit is not available for leasing."
            )

        active_query = Lease.objects.filter(
            unit=unit,
            status="active",
        )

        if current_lease_id:
            active_query = active_query.exclude(
                id=current_lease_id
            )

        if active_query.exists():
            raise ValidationError(
                "This unit already has an active lease."
            )

    def _validate_reminders(
        self,
        reminders_raw,
    ):
        if not reminders_raw:
            return []

        try:
            reminders = json.loads(
                reminders_raw
            )
        except (
            TypeError,
            ValueError,
        ):
            raise ValidationError(
                "Invalid reminder data."
            )

        if not isinstance(
            reminders,
            list,
        ):
            raise ValidationError(
                "Reminders must be a list."
            )

        cleaned = []
        used_days = set()

        for reminder in reminders:

            if not isinstance(
                reminder,
                dict,
            ):
                raise ValidationError(
                    "Invalid reminder format."
                )

            if not reminder.get(
                "enabled",
                True,
            ):
                continue

            try:
                days_before = int(
                    reminder.get(
                        "days_before"
                    )
                )
            except (
                TypeError,
                ValueError,
            ):
                raise ValidationError(
                    "Reminder days must be a number."
                )

            if days_before <= 0:
                raise ValidationError(
                    "Reminder days must be greater than zero."
                )

            if days_before > 3650:
                raise ValidationError(
                    "Reminder cannot be more than 10 years before expiry."
                )

            if days_before in used_days:
                raise ValidationError(
                    "Reminder days must be unique."
                )

            used_days.add(
                days_before
            )

            cleaned.append(
                days_before
            )

        return cleaned

    def _update_reminders(
        self,
        lease,
        reminder_days,
    ):
        LeaseReminder.objects.filter(
            lease=lease
        ).delete()

        for days_before in reminder_days:
            LeaseReminder.objects.create(
                lease=lease,
                days_before=days_before,
                enabled=True,
            )

    def _update_tenant(
        self,
        tenant,
        request,
    ):
        fields = {
            "first_name": request.data.get(
                "tenant_first_name"
            ),
            "last_name": request.data.get(
                "tenant_last_name"
            ),
            "shop_name": request.data.get(
                "tenant_shop_name"
            ),
            "gst_number": request.data.get(
                "tenant_gst_number"
            ),
            "postal_address": request.data.get(
                "tenant_postal_address"
            ),
            "gst_rate": request.data.get(
                "tenant_gst_rate"
            ),
            "email": request.data.get(
                "tenant_email"
            ),
            "phone": request.data.get(
                "tenant_phone"
            ),
            "emergency_contact": request.data.get(
                "tenant_emergency_contact"
            ),
            "emergency_phone": request.data.get(
                "tenant_emergency_phone"
            ),
        }

        for field, value in fields.items():
            if value is not None:
                setattr(
                    tenant,
                    field,
                    str(value).strip(),
                )

        if not tenant.first_name:
            raise ValidationError(
                "Tenant first name is required."
            )

        if not tenant.phone:
            raise ValidationError(
                "Tenant phone number is required."
            )

        try:
            tenant.gst_rate = float(
                tenant.gst_rate or 0
            )
        except (
            TypeError,
            ValueError,
        ):
            raise ValidationError(
                "Tenant GST rate must be a valid number."
            )

        if tenant.gst_rate < 0 or tenant.gst_rate > 100:
            raise ValidationError(
                "Tenant GST rate must be between 0 and 100."
            )

        tenant.save()

    def create(
        self,
        request,
        *args,
        **kwargs,
    ):
        landlord = self._get_landlord()

        tenant_mode = str(
            request.data.get(
                "tenant_mode",
                "new",
            )
        ).strip().lower()

        unit_id = request.data.get(
            "unit"
        )

        if not unit_id:
            raise ValidationError(
                "Unit is required."
            )

        try:
            unit = (
                Unit.objects
                .select_related(
                    "floor__building"
                )
                .get(
                    id=unit_id
                )
            )
        except Unit.DoesNotExist:
            raise ValidationError(
                "Selected unit does not exist."
            )

        self._validate_unit(
            unit,
            landlord,
        )

        is_commercial = (
            unit.unit_type == "commercial"
        )

        if tenant_mode == "existing":

            tenant_id = request.data.get(
                "tenant"
            )

            if not tenant_id:
                raise ValidationError(
                    "Please select a tenant."
                )

            try:
                tenant = Tenant.objects.get(
                    id=tenant_id
                )
            except Tenant.DoesNotExist:
                raise ValidationError(
                    "Selected tenant does not exist."
                )

            if is_commercial:
                if not tenant.shop_name.strip():
                    raise ValidationError(
                        "Shop name is required for commercial units."
                    )

                if not tenant.postal_address.strip():
                    raise ValidationError(
                        "Postal address is required for commercial units."
                    )

                if not tenant.gst_number.strip():
                    raise ValidationError(
                        "GST number is required for commercial units."
                    )

        elif tenant_mode == "new":

            first_name = str(
                request.data.get(
                    "first_name",
                    "",
                )
            ).strip()

            last_name = str(
                request.data.get(
                    "last_name",
                    "",
                )
            ).strip()

            email = str(
                request.data.get(
                    "email",
                    "",
                )
            ).strip().lower()

            phone = str(
                request.data.get(
                    "phone",
                    "",
                )
            ).strip()

            emergency_contact = str(
                request.data.get(
                    "emergency_contact",
                    "",
                )
            ).strip()

            emergency_phone = str(
                request.data.get(
                    "emergency_phone",
                    "",
                )
            ).strip()

            shop_name = str(
                request.data.get(
                    "shop_name",
                    "",
                )
            ).strip()

            gst_number = str(
                request.data.get(
                    "gst_number",
                    "",
                )
            ).strip()

            postal_address = str(
                request.data.get(
                    "postal_address",
                    "",
                )
            ).strip()

            gst_rate_raw = request.data.get(
                "gst_rate",
                0,
            )

            try:
                gst_rate = float(
                    gst_rate_raw or 0
                )
            except (
                TypeError,
                ValueError,
            ):
                raise ValidationError(
                    "Tenant GST rate must be a valid number."
                )

            if gst_rate < 0 or gst_rate > 100:
                raise ValidationError(
                    "Tenant GST rate must be between 0 and 100."
                )

            if not first_name:
                raise ValidationError(
                    "Tenant first name is required."
                )

            if not phone:
                raise ValidationError(
                    "Tenant phone number is required."
                )

            tenant = Tenant.objects.create(
                first_name=first_name,
                last_name=last_name,
                shop_name=shop_name,
                gst_number=gst_number,
                postal_address=postal_address,
                gst_rate=gst_rate,
                email=email,
                phone=phone,
                emergency_contact=emergency_contact,
                emergency_phone=emergency_phone,
            )

            if is_commercial:
                if not tenant.shop_name:
                    raise ValidationError(
                        "Shop name is required for commercial units."
                    )

                if not tenant.postal_address:
                    raise ValidationError(
                        "Postal address is required for commercial units."
                    )

                if not tenant.gst_number:
                    raise ValidationError(
                        "GST number is required for commercial units."
                    )

        else:
            raise ValidationError(
                "Invalid tenant mode."
            )

        start_date = request.data.get(
            "start_date"
        )

        end_date = request.data.get(
            "end_date"
        )

        if not start_date or not end_date:
            raise ValidationError(
                "Start date and end date are required."
            )

        parsed_start = parse_date(
            str(start_date)
        )

        parsed_end = parse_date(
            str(end_date)
        )

        if not parsed_start or not parsed_end:
            raise ValidationError(
                "Invalid lease dates."
            )

        if parsed_end <= parsed_start:
            raise ValidationError(
                "End date must be after start date."
            )

        lease_type = request.data.get(
            "lease_type",
            "rent",
        )

        monthly_rent = request.data.get(
            "monthly_rent"
        )

        security_deposit = request.data.get(
            "security_deposit",
            0,
        )

        lease_status = request.data.get(
            "status",
            "active",
        )

        try:
            monthly_rent = float(
                monthly_rent
            )
        except (
            TypeError,
            ValueError,
        ):
            raise ValidationError(
                "Monthly rent must be a valid number."
            )

        try:
            security_deposit = float(
                security_deposit
            )
        except (
            TypeError,
            ValueError,
        ):
            raise ValidationError(
                "Security deposit must be a valid number."
            )

        if monthly_rent < 0:
            raise ValidationError(
                "Monthly rent cannot be negative."
            )

        if security_deposit < 0:
            raise ValidationError(
                "Security deposit cannot be negative."
            )

        if lease_status not in [
            "pending",
            "active",
        ]:
            raise ValidationError(
                "New leases can only be Pending or Active."
            )

        agreement_file = request.FILES.get(
            "agreement_file"
        )

        if agreement_file:
            filename = agreement_file.name.lower()

            if not filename.endswith(
                (
                    ".pdf",
                    ".doc",
                    ".docx",
                )
            ):
                raise ValidationError(
                    "Only PDF, DOC and DOCX files are allowed."
                )

        reminder_days = (
            self._validate_reminders(
                request.data.get(
                    "reminders",
                    "[]",
                )
            )
        )

        with transaction.atomic():

            lease = Lease.objects.create(
                unit=unit,
                tenant=tenant,
                lease_type=lease_type,
                start_date=parsed_start,
                end_date=parsed_end,
                monthly_rent=monthly_rent,
                security_deposit=security_deposit,
                status=lease_status,
                agreement_file=agreement_file,
            )

            self._update_reminders(
                lease,
                reminder_days,
            )

            if lease.status == "active":
                unit.status = "occupied"

                unit.save(
                    update_fields=[
                        "status"
                    ]
                )

        serializer = LeaseSerializer(
            lease,
            context={
                "request": request
            },
        )

        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED,
        )

    @transaction.atomic
    def update(
        self,
        request,
        *args,
        **kwargs,
    ):
        landlord = self._get_landlord()

        lease = self.get_object()

        old_unit = lease.unit

        unit_id = request.data.get(
            "unit"
        )

        if unit_id:
            try:
                new_unit = (
                    Unit.objects
                    .select_related(
                        "floor__building"
                    )
                    .get(
                        id=unit_id
                    )
                )
            except Unit.DoesNotExist:
                raise ValidationError(
                    "Selected unit does not exist."
                )
        else:
            new_unit = old_unit

        self._validate_unit(
            new_unit,
            landlord,
            current_lease_id=lease.id,
        )

        start_date = request.data.get(
            "start_date",
            lease.start_date,
        )

        end_date = request.data.get(
            "end_date",
            lease.end_date,
        )

        parsed_start = (
            parse_date(
                str(start_date)
            )
            if not hasattr(
                start_date,
                "year",
            )
            else start_date
        )

        parsed_end = (
            parse_date(
                str(end_date)
            )
            if not hasattr(
                end_date,
                "year",
            )
            else end_date
        )

        if not parsed_start or not parsed_end:
            raise ValidationError(
                "Invalid lease dates."
            )

        if parsed_end <= parsed_start:
            raise ValidationError(
                "End date must be after start date."
            )

        monthly_rent = request.data.get(
            "monthly_rent",
            lease.monthly_rent,
        )

        security_deposit = request.data.get(
            "security_deposit",
            lease.security_deposit,
        )

        try:
            monthly_rent = float(
                monthly_rent
            )

            security_deposit = float(
                security_deposit
            )
        except (
            TypeError,
            ValueError,
        ):
            raise ValidationError(
                "Rent and deposit must be valid numbers."
            )

        if monthly_rent < 0:
            raise ValidationError(
                "Monthly rent cannot be negative."
            )

        if security_deposit < 0:
            raise ValidationError(
                "Security deposit cannot be negative."
            )

        new_status = request.data.get(
            "status",
            lease.status,
        )

        if new_status not in [
            "pending",
            "active",
            "expired",
            "terminated",
        ]:
            raise ValidationError(
                "Invalid lease status."
            )

        self._update_tenant(
            lease.tenant,
            request,
        )

        if new_unit.unit_type == "commercial":
            if not lease.tenant.shop_name.strip():
                raise ValidationError(
                    "Shop name is required for commercial units."
                )

            if not lease.tenant.postal_address.strip():
                raise ValidationError(
                    "Postal address is required for commercial units."
                )

            if not lease.tenant.gst_number.strip():
                raise ValidationError(
                    "GST number is required for commercial units."
                )

        agreement_file = request.FILES.get(
            "agreement_file"
        )

        if agreement_file:

            filename = (
                agreement_file.name.lower()
            )

            if not filename.endswith(
                (
                    ".pdf",
                    ".doc",
                    ".docx",
                )
            ):
                raise ValidationError(
                    "Only PDF, DOC and DOCX files are allowed."
                )

            lease.agreement_file = (
                agreement_file
            )

        lease.unit = new_unit

        lease.lease_type = request.data.get(
            "lease_type",
            lease.lease_type,
        )

        lease.start_date = parsed_start
        lease.end_date = parsed_end
        lease.monthly_rent = monthly_rent
        lease.security_deposit = (
            security_deposit
        )
        lease.status = new_status

        lease.save()

        if "reminders" in request.data:

            reminder_days = (
                self._validate_reminders(
                    request.data.get(
                        "reminders",
                        "[]",
                    )
                )
            )

            self._update_reminders(
                lease,
                reminder_days,
            )

        if old_unit != new_unit:

            if not old_unit.leases.filter(
                status="active"
            ).exists():

                old_unit.status = "vacant"

                old_unit.save(
                    update_fields=[
                        "status"
                    ]
                )

        if lease.status == "active":

            new_unit.status = "occupied"

        elif not new_unit.leases.filter(
            status="active"
        ).exists():

            new_unit.status = "vacant"

        new_unit.save(
            update_fields=[
                "status"
            ]
        )

        serializer = LeaseSerializer(
            lease,
            context={
                "request": request
            },
        )

        return Response(
            serializer.data
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="renew",
    )
    @transaction.atomic
    def renew(
        self,
        request,
        pk=None,
    ):
        landlord = self._get_landlord()

        old_lease = self.get_object()

        if old_lease.status not in [
            "active",
            "expired",
        ]:
            raise ValidationError(
                "Only active or expired leases can be renewed."
            )

        unit = old_lease.unit

        if (
            unit.floor.building.landlord
            != landlord
        ):
            raise PermissionDenied(
                "You can only renew your own leases."
            )

        start_date = request.data.get(
            "start_date"
        )

        end_date = request.data.get(
            "end_date"
        )

        if not start_date or not end_date:
            raise ValidationError(
                "Renewal dates are required."
            )

        parsed_start = parse_date(
            str(start_date)
        )

        parsed_end = parse_date(
            str(end_date)
        )

        if not parsed_start or not parsed_end:
            raise ValidationError(
                "Invalid renewal dates."
            )

        if parsed_end <= parsed_start:
            raise ValidationError(
                "Renewal end date must be after start date."
            )

        if parsed_start <= old_lease.end_date:
            raise ValidationError(
                "Renewal must start after the previous lease ends."
            )

        monthly_rent = request.data.get(
            "monthly_rent",
            old_lease.monthly_rent,
        )

        security_deposit = request.data.get(
            "security_deposit",
            old_lease.security_deposit,
        )

        try:
            monthly_rent = float(
                monthly_rent
            )

            security_deposit = float(
                security_deposit
            )
        except (
            TypeError,
            ValueError,
        ):
            raise ValidationError(
                "Rent and deposit must be valid numbers."
            )

        if monthly_rent < 0:
            raise ValidationError(
                "Monthly rent cannot be negative."
            )

        if security_deposit < 0:
            raise ValidationError(
                "Security deposit cannot be negative."
            )

        agreement_file = request.FILES.get(
            "agreement_file"
        )

        if agreement_file:

            filename = (
                agreement_file.name.lower()
            )

            if not filename.endswith(
                (
                    ".pdf",
                    ".doc",
                    ".docx",
                )
            ):
                raise ValidationError(
                    "Only PDF, DOC and DOCX files are allowed."
                )

        reminder_days = (
            self._validate_reminders(
                request.data.get(
                    "reminders",
                    "[]",
                )
            )
        )

        old_lease.status = "expired"

        old_lease.save(
            update_fields=[
                "status",
                "updated_at",
            ]
        )

        new_lease = Lease.objects.create(
            unit=unit,
            tenant=old_lease.tenant,
            lease_type=request.data.get(
                "lease_type",
                old_lease.lease_type,
            ),
            start_date=parsed_start,
            end_date=parsed_end,
            monthly_rent=monthly_rent,
            security_deposit=security_deposit,
            status="active",
            agreement_file=agreement_file,
        )

        self._update_reminders(
            new_lease,
            reminder_days,
        )

        unit.status = "occupied"

        unit.save(
            update_fields=[
                "status"
            ]
        )

        serializer = LeaseSerializer(
            new_lease,
            context={
                "request": request
            },
        )

        return Response(
            {
                "renewed_from": old_lease.id,
                "lease": serializer.data,
            },
            status=status.HTTP_201_CREATED,
        )

    def destroy(
        self,
        request,
        *args,
        **kwargs,
    ):
        landlord = self._get_landlord()

        lease = self.get_object()

        if (
            lease.unit.floor.building.landlord
            != landlord
        ):
            raise PermissionDenied(
                "You can only delete your own leases."
            )

        unit = lease.unit

        response = super().destroy(
            request,
            *args,
            **kwargs,
        )

        if response.status_code == 204:

            if not unit.leases.filter(
                status="active"
            ).exists():

                unit.status = "vacant"

                unit.save(
                    update_fields=[
                        "status"
                    ]
                )

        return response


class LeaseReminderViewSet(
    viewsets.ModelViewSet
):
    serializer_class = LeaseReminderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        if hasattr(
            user,
            "landlord_profile",
        ):
            return (
                LeaseReminder.objects.filter(
                    lease__unit__floor__building__landlord=(
                        user.landlord_profile
                    )
                )
                .select_related(
                    "lease",
                    "lease__unit",
                    "lease__unit__floor",
                    "lease__unit__floor__building",
                )
                .order_by(
                    "-days_before"
                )
            )

        return LeaseReminder.objects.none()

    def perform_create(
        self,
        serializer,
    ):
        user = self.request.user

        if not hasattr(
            user,
            "landlord_profile",
        ):
            raise PermissionDenied(
                "Only landlords can create reminders."
            )

        lease = serializer.validated_data[
            "lease"
        ]

        if (
            lease.unit.floor.building.landlord
            != user.landlord_profile
        ):
            raise PermissionDenied(
                "You can only create reminders for your own leases."
            )

        serializer.save()

    def perform_update(
        self,
        serializer,
    ):
        user = self.request.user

        if not hasattr(
            user,
            "landlord_profile",
        ):
            raise PermissionDenied(
                "Only landlords can update reminders."
            )

        reminder = self.get_object()

        if (
            reminder.lease.unit.floor.building.landlord
            != user.landlord_profile
        ):
            raise PermissionDenied(
                "You can only update your own reminders."
            )

        serializer.save()

    def destroy(
        self,
        request,
        *args,
        **kwargs,
    ):
        user = request.user

        if not hasattr(
            user,
            "landlord_profile",
        ):
            raise PermissionDenied(
                "Only landlords can delete reminders."
            )

        reminder = self.get_object()

        if (
            reminder.lease.unit.floor.building.landlord
            != user.landlord_profile
        ):
            raise PermissionDenied(
                "You can only delete your own reminders."
            )

        return super().destroy(
            request,
            *args,
            **kwargs,
        )



# ReportLab's built-in Helvetica font does not contain the Indian Rupee
# glyph (₹). Use a Windows Unicode font that actually contains U+20B9,
# and verify the glyph before accepting the font.
def _register_invoice_font():
    candidates = [
        # Windows fonts commonly available on modern Windows installations.
        Path(r"C:\Windows\Fonts\segoeui.ttf"),
        Path(r"C:\Windows\Fonts\Nirmala.ttf"),
        Path(r"C:\Windows\Fonts\NirmalaUI.ttf"),
        Path(r"C:\Windows\Fonts\arial.ttf"),
        Path(r"C:\Windows\Fonts\tahoma.ttf"),
        Path(r"C:\Windows\Fonts\calibri.ttf"),
        # Linux / common containers
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
        Path("/usr/share/fonts/dejavu/DejaVuSans.ttf"),
    ]

    for font_path in candidates:
        if not font_path.exists():
            continue
        try:
            font_name = f"InvoiceUnicode_{font_path.stem.replace(' ', '_')}"
            if font_name not in pdfmetrics.getRegisteredFontNames():
                pdfmetrics.registerFont(TTFont(font_name, str(font_path)))
            font = pdfmetrics.getFont(font_name)
            if 0x20B9 in getattr(font.face, "charWidths", {}):
                return font_name
        except Exception:
            continue

    return "Helvetica"


INVOICE_UNICODE_FONT = _register_invoice_font()


def _money(value):
    return f"\u20b9{float(value or 0):,.2f}"


def _safe_text(value):
    return str(value or "").strip()


def _invoice_pdf(payment, settings, request):
    buffer = BytesIO()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=10 * mm,
        leftMargin=10 * mm,
        topMargin=9 * mm,
        bottomMargin=9 * mm,
        title=f"Rent Invoice - {payment.id}",
        author=_safe_text(settings.business_name),
        pageCompression=0,
    )

    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="InvoiceSmall",
            parent=styles["Normal"],
            fontSize=7.5,
            leading=9,
            textColor=colors.HexColor("#555555"),
        )
    )
    styles.add(
        ParagraphStyle(
            name="InvoiceBody",
            parent=styles["Normal"],
            fontSize=8.5,
            leading=10.5,
            textColor=colors.HexColor("#222222"),
        )
    )
    styles.add(
        ParagraphStyle(
            name="InvoiceTitle",
            parent=styles["Heading1"],
            fontSize=16,
            leading=18,
            alignment=TA_RIGHT,
            textColor=colors.HexColor("#222222"),
            spaceAfter=2,
        )
    )
    styles.add(
        ParagraphStyle(
            name="InvoiceSection",
            parent=styles["Heading2"],
            fontSize=9,
            leading=10.5,
            textColor=colors.HexColor("#222222"),
            spaceBefore=2,
            spaceAfter=5,
        )
    )
    styles.add(
        ParagraphStyle(
            name="InvoiceRight",
            parent=styles["Normal"],
            fontSize=7.5,
            leading=9,
            alignment=TA_RIGHT,
            textColor=colors.HexColor("#444444"),
        )
    )
    styles.add(
        ParagraphStyle(
            name="InvoiceMoney",
            parent=styles["Normal"],
            fontName=INVOICE_UNICODE_FONT,
            fontSize=8.5,
            leading=10.5,
            textColor=colors.HexColor("#222222"),
        )
    )
    styles.add(
        ParagraphStyle(
            name="InvoiceMoneyRight",
            parent=styles["InvoiceMoney"],
            alignment=TA_RIGHT,
        )
    )

    story = []

    # Header: business details on the left and user-provided logo/image on right.
    header_left = []
    business_name = _safe_text(settings.business_name) or _safe_text(
        payment.lease.unit.floor.building.landlord.user.get_full_name()
    ) or payment.lease.unit.floor.building.landlord.user.username

    header_left.append(
        Paragraph(
            business_name,
            ParagraphStyle(
                "BusinessName",
                parent=styles["Heading2"],
                fontSize=16,
                leading=19,
                textColor=colors.HexColor("#222222"),
                spaceAfter=2,
            ),
        )
    )

    address_lines = [
        _safe_text(settings.address),
        ", ".join(
            part for part in [
                _safe_text(settings.city),
                _safe_text(settings.state),
                _safe_text(settings.pincode),
            ] if part
        ),
        _safe_text(settings.phone),
        _safe_text(settings.email),
        _safe_text(settings.gstin),
    ]

    for line in address_lines:
        if line:
            header_left.append(
                Paragraph(line, styles["InvoiceSmall"])
            )

    header_right = [Paragraph("RENT INVOICE", styles["InvoiceTitle"])]

    # The invoice is issued on the 1st of the month in which the
    # payment is due. The billed month is the previous calendar month.
    issue_date = payment.due_date.replace(day=1)

    if settings.due_day:
        import calendar
        last_day = calendar.monthrange(issue_date.year, issue_date.month)[1]
        due_date = issue_date.replace(
            day=min(int(settings.due_day), last_day)
        )
    else:
        due_date = payment.due_date

    header_right.append(
        Paragraph(
            f"Invoice Date: {issue_date.strftime('%Y-%m-%d')}<br/>"
            f"Due Date: {due_date.strftime('%Y-%m-%d')}",
            styles["InvoiceRight"],
        )
    )

    if settings.logo:
        try:
            logo = Image(settings.logo.path, width=28 * mm, height=28 * mm)
            logo.hAlign = "RIGHT"
            header_right.append(logo)
        except Exception:
            pass

    header_table = Table(
        [[header_left, header_right]],
        colWidths=[112 * mm, 63 * mm],
    )
    header_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    story.append(header_table)
    story.append(Spacer(1, 4 * mm))

    tenant = payment.lease.tenant
    unit = payment.lease.unit
    floor = unit.floor
    building = floor.building

    building_address_parts = [
        _safe_text(building.address),
        ", ".join(
            part
            for part in [
                _safe_text(building.city),
                _safe_text(building.state),
                _safe_text(building.pincode),
            ]
            if part
        ),
    ]
    building_address = ", ".join(
        part for part in building_address_parts if part
    ) or "-"

    bill_to = (
        f"Shop / Office / Godown: {_safe_text(tenant.shop_name) or '-'}<br/>"
        f"Address: {_safe_text(building_address)}<br/>"
        f"GST No: {_safe_text(tenant.gst_number) or '-'}<br/>"
        f"Phone: {_safe_text(tenant.phone) or '-'}"
    )

    import calendar
    previous_month = issue_date.month - 1
    previous_year = issue_date.year
    if previous_month == 0:
        previous_month = 12
        previous_year -= 1
    billed_month = f"{calendar.month_name[previous_month]} {previous_year}"

    info_table = Table(
        [
            [
                Paragraph("BILL TO", styles["InvoiceSection"]),
                Paragraph("RENTAL / LEASE DETAILS", styles["InvoiceSection"]),
            ],
            [
                Paragraph(bill_to, styles["InvoiceBody"]),
                Paragraph(
                    f"Agreement: {payment.lease.get_lease_type_display()}<br/>"
                    f"Billing month: {billed_month}<br/>"
                    f"Monthly rent: {_money(payment.lease.monthly_rent)}",
                    styles["InvoiceMoney"],
                ),
            ],
        ],
        colWidths=[87 * mm, 88 * mm],
    )
    info_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f4f5f4")),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#d9ddd9")),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e6e8e6")),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.append(info_table)
    story.append(Spacer(1, 4 * mm))

    rent_amount = Decimal(str(payment.amount or 0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    gst_rate = Decimal(str(tenant.gst_rate or 0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    gst_total = (rent_amount * gst_rate / Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    cgst = (gst_total / Decimal("2")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    sgst = (gst_total - cgst).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    grand_total = (rent_amount + gst_total).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    line_items = [
        [
            Paragraph("DESCRIPTION", styles["InvoiceSmall"]),
            Paragraph("PERIOD", styles["InvoiceSmall"]),
            Paragraph("AMOUNT", styles["InvoiceSmall"]),
        ],
        [
            Paragraph(
                f"Monthly Rent - Unit {unit.unit_number}",
                styles["InvoiceBody"],
            ),
            Paragraph(
                billed_month,
                styles["InvoiceBody"],
            ),
            Paragraph(
                _money(rent_amount),
                styles["InvoiceMoneyRight"],
            ),
        ],
    ]

    if gst_rate > Decimal("0"):
        line_items.extend([
            [
                Paragraph(
                    f"CGST ({_safe_text(gst_rate / Decimal('2'))}%)",
                    styles["InvoiceBody"],
                ),
                Paragraph("", styles["InvoiceBody"]),
                Paragraph(
                    _money(cgst),
                    styles["InvoiceMoneyRight"],
                ),
            ],
            [
                Paragraph(
                    f"SGST ({_safe_text(gst_rate / Decimal('2'))}%)",
                    styles["InvoiceBody"],
                ),
                Paragraph("", styles["InvoiceBody"]),
                Paragraph(
                    _money(sgst),
                    styles["InvoiceMoneyRight"],
                ),
            ],
        ])
    else:
        line_items.append([
            Paragraph("GST (0% Exempt - Residential)", styles["InvoiceBody"]),
            Paragraph("", styles["InvoiceBody"]),
            Paragraph(_money(Decimal("0.00")), styles["InvoiceMoneyRight"]),
        ])

    items_table = Table(
        line_items,
        colWidths=[82 * mm, 45 * mm, 48 * mm],
    )
    items_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f4f5f4")),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#d9ddd9")),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e6e8e6")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.append(items_table)
    story.append(Spacer(1, 3 * mm))

    if gst_rate > Decimal("0"):
        total_rows = [
            ["Subtotal", Paragraph(_money(rent_amount), styles["InvoiceMoneyRight"])],
            [f"GST ({_safe_text(gst_rate)}%)", Paragraph(_money(gst_total), styles["InvoiceMoneyRight"])],
            ["CGST", Paragraph(_money(cgst), styles["InvoiceMoneyRight"])],
            ["SGST", Paragraph(_money(sgst), styles["InvoiceMoneyRight"])],
            ["Total Amount Due", Paragraph(_money(grand_total), styles["InvoiceMoneyRight"])],
        ]
    else:
        total_rows = [
            ["Subtotal", Paragraph(_money(rent_amount), styles["InvoiceMoneyRight"])],
            ["GST (0% Exempt)", Paragraph(_money(Decimal("0.00")), styles["InvoiceMoneyRight"])],
            ["Total Amount Due", Paragraph(_money(grand_total), styles["InvoiceMoneyRight"])],
        ]

    total_table = Table(
        total_rows,
        colWidths=[42 * mm, 40 * mm],
        hAlign="RIGHT",
    )
    total_table.setStyle(
        TableStyle(
            [
                ("ALIGN", (1, 0), (1, -1), "RIGHT"),
                ("FONTNAME", (0, 1), (0, 1), "Helvetica-Bold"),
                ("FONTNAME", (0, 4), (0, 4), "Helvetica-Bold"),
                ("LINEABOVE", (0, 1), (-1, 1), 0.8, colors.HexColor("#222222")),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.append(total_table)
    story.append(Spacer(1, 4 * mm))

    payment_details = []
    if settings.bank_name:
        payment_details.append(f"Bank: {_safe_text(settings.bank_name)}")
    if settings.account_number:
        payment_details.append(f"Account No: {_safe_text(settings.account_number)}")
    if settings.ifsc:
        payment_details.append(f"IFSC: {_safe_text(settings.ifsc)}")
    if settings.branch:
        payment_details.append(f"Branch: {_safe_text(settings.branch)}")
    if settings.payment_instructions:
        payment_details.append(
            f"Instructions: {_safe_text(settings.payment_instructions)}"
        )

    if payment_details:
        story.append(
            Paragraph("PAYMENT DETAILS", styles["InvoiceSection"])
        )
        story.append(
            Paragraph("<br/>".join(payment_details), styles["InvoiceBody"])
        )
        story.append(Spacer(1, 4 * mm))

    # Larger stacked signature block. The surrounding invoice is compact
    # enough that this still remains on the same A4 page.
    signature_parts = []
    if settings.signature:
        try:
            signature = Image(
                settings.signature.path,
                width=45 * mm,
                height=20 * mm,
                kind="proportional",
            )
            signature.hAlign = "RIGHT"
            signature_parts.append(signature)
        except Exception:
            pass

    signature_parts.append(
        Paragraph(
            "Authorized Signature",
            styles["InvoiceRight"],
        )
    )

    sig_table = Table(
        [[signature_parts]],
        colWidths=[175 * mm],
    )
    sig_table.setStyle(
        TableStyle(
            [
                ("ALIGN", (0, 0), (0, 0), "RIGHT"),
                ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    story.append(Spacer(1, 2 * mm))
    story.append(sig_table)

    doc.build(story)
    buffer.seek(0)
    return buffer



def _receipt_pdf(payment, settings, request):
    """Build a one-page payment receipt for a paid commercial rent payment."""
    buffer = BytesIO()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=10 * mm,
        leftMargin=10 * mm,
        topMargin=9 * mm,
        bottomMargin=9 * mm,
        title=f"Payment Receipt - {payment.id}",
        author=_safe_text(settings.business_name),
        pageCompression=0,
    )

    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="ReceiptSmall",
            parent=styles["Normal"],
            fontName=INVOICE_UNICODE_FONT,
            fontSize=7.5,
            leading=9,
            textColor=colors.HexColor("#555555"),
        )
    )
    styles.add(
        ParagraphStyle(
            name="ReceiptBody",
            parent=styles["Normal"],
            fontName=INVOICE_UNICODE_FONT,
            fontSize=8.5,
            leading=10.5,
            textColor=colors.HexColor("#222222"),
        )
    )
    styles.add(
        ParagraphStyle(
            name="ReceiptTitle",
            parent=styles["Heading1"],
            fontName=INVOICE_UNICODE_FONT,
            fontSize=16,
            leading=18,
            alignment=TA_RIGHT,
            textColor=colors.HexColor("#222222"),
            spaceAfter=2,
        )
    )
    styles.add(
        ParagraphStyle(
            name="ReceiptSection",
            parent=styles["Heading2"],
            fontName=INVOICE_UNICODE_FONT,
            fontSize=9,
            leading=10.5,
            textColor=colors.HexColor("#222222"),
            spaceBefore=2,
            spaceAfter=4,
        )
    )
    styles.add(
        ParagraphStyle(
            name="ReceiptRight",
            parent=styles["Normal"],
            fontName=INVOICE_UNICODE_FONT,
            fontSize=7.5,
            leading=9,
            alignment=TA_RIGHT,
            textColor=colors.HexColor("#444444"),
        )
    )
    styles.add(
        ParagraphStyle(
            name="ReceiptMoney",
            parent=styles["Normal"],
            fontName=INVOICE_UNICODE_FONT,
            fontSize=8.5,
            leading=10.5,
            textColor=colors.HexColor("#222222"),
        )
    )
    styles.add(
        ParagraphStyle(
            name="ReceiptMoneyRight",
            parent=styles["ReceiptMoney"],
            alignment=TA_RIGHT,
        )
    )

    story = []

    building = payment.lease.unit.floor.building
    tenant = payment.lease.tenant
    unit = payment.lease.unit
    floor = unit.floor

    business_name = _safe_text(settings.business_name) or _safe_text(
        building.landlord.user.get_full_name()
    ) or building.landlord.user.username

    header_left = [
        Paragraph(
            business_name,
            ParagraphStyle(
                "ReceiptBusinessName",
                parent=styles["Heading2"],
                fontName=INVOICE_UNICODE_FONT,
                fontSize=16,
                leading=19,
                textColor=colors.HexColor("#222222"),
                spaceAfter=2,
            ),
        )
    ]

    address_lines = [
        _safe_text(settings.address),
        ", ".join(
            part for part in [
                _safe_text(settings.city),
                _safe_text(settings.state),
                _safe_text(settings.pincode),
            ] if part
        ),
        _safe_text(settings.phone),
        _safe_text(settings.email),
        _safe_text(settings.gstin),
    ]
    for line in address_lines:
        if line:
            header_left.append(Paragraph(line, styles["ReceiptSmall"]))

    header_right = [Paragraph("PAYMENT RECEIPT", styles["ReceiptTitle"])]
    receipt_date = payment.paid_date or timezone.localdate()
    header_right.append(
        Paragraph(
            f"Receipt Date: {receipt_date.strftime('%Y-%m-%d')}",
            styles["ReceiptRight"],
        )
    )

    if settings.logo:
        try:
            logo = Image(settings.logo.path, width=26 * mm, height=26 * mm)
            logo.hAlign = "RIGHT"
            header_right.append(logo)
        except Exception:
            pass

    header_table = Table(
        [[header_left, header_right]],
        colWidths=[112 * mm, 63 * mm],
    )
    header_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    story.append(header_table)
    story.append(Spacer(1, 4 * mm))

    building_address_parts = [
        _safe_text(building.address),
        ", ".join(
            part for part in [
                _safe_text(building.city),
                _safe_text(building.state),
                _safe_text(building.pincode),
            ] if part
        ),
    ]
    building_address = ", ".join(
        part for part in building_address_parts if part
    ) or "-"

    bill_to = (
        f"Shop / Office / Godown: {_safe_text(tenant.shop_name) or '-'}<br/>"
        f"Address: {_safe_text(building_address)}<br/>"
        f"GST No: {_safe_text(tenant.gst_number) or '-'}<br/>"
        f"Phone: {_safe_text(tenant.phone) or '-'}"
    )

    # The same arrears rule as the invoice: a payment due in a month is for
    # the previous calendar month's rent.
    import calendar
    receipt_month_date = payment.due_date
    billed_month = f"{calendar.month_name[receipt_month_date.month - 1] if receipt_month_date.month > 1 else calendar.month_name[12]} {receipt_month_date.year if receipt_month_date.month > 1 else receipt_month_date.year - 1}"

    info_table = Table(
        [
            [
                Paragraph("BILL TO", styles["ReceiptSection"]),
                Paragraph("RENTAL / PAYMENT DETAILS", styles["ReceiptSection"]),
            ],
            [
                Paragraph(bill_to, styles["ReceiptBody"]),
                Paragraph(
                    f"Tenant: {_safe_text(tenant.first_name + ' ' + tenant.last_name)}<br/>"
                    f"Billing month: {billed_month}<br/>"
                    f"Unit: {_safe_text(unit.unit_number)} - Floor {_safe_text(floor.floor_number)}<br/>"
                    f"Payment date: {_safe_text(receipt_date)}<br/>"
                    f"Payment method: {_safe_text(payment.get_payment_method_display()) or '-'}",
                    styles["ReceiptBody"],
                ),
            ],
        ],
        colWidths=[87 * mm, 88 * mm],
    )
    info_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f4f5f4")),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#d9ddd9")),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e6e8e6")),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.append(info_table)
    story.append(Spacer(1, 4 * mm))

    rent_amount = Decimal(str(payment.amount or 0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    gst_rate = Decimal(str(tenant.gst_rate or 0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    gst_total = (rent_amount * gst_rate / Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    cgst = (gst_total / Decimal("2")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    sgst = (gst_total - cgst).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    grand_total = (rent_amount + gst_total).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    if gst_rate > Decimal("0"):
        receipt_items = [
            [
                Paragraph("DESCRIPTION", styles["ReceiptSmall"]),
                Paragraph("AMOUNT", styles["ReceiptSmall"]),
            ],
            [
                Paragraph(f"Monthly Rent - Unit {unit.unit_number}", styles["ReceiptBody"]),
                Paragraph(_money(rent_amount), styles["ReceiptMoneyRight"]),
            ],
            [
                Paragraph(f"CGST ({_safe_text(gst_rate / Decimal('2'))}%)", styles["ReceiptBody"]),
                Paragraph(_money(cgst), styles["ReceiptMoneyRight"]),
            ],
            [
                Paragraph(f"SGST ({_safe_text(gst_rate / Decimal('2'))}%)", styles["ReceiptBody"]),
                Paragraph(_money(sgst), styles["ReceiptMoneyRight"]),
            ],
        ]
        totals_rows = [
            ["Subtotal", Paragraph(_money(rent_amount), styles["ReceiptMoneyRight"])],
            [f"GST ({_safe_text(gst_rate)}%)", Paragraph(_money(gst_total), styles["ReceiptMoneyRight"])],
            ["CGST", Paragraph(_money(cgst), styles["ReceiptMoneyRight"])],
            ["SGST", Paragraph(_money(sgst), styles["ReceiptMoneyRight"])],
            ["TOTAL PAID", Paragraph(_money(grand_total), styles["ReceiptMoneyRight"])],
        ]
    else:
        receipt_items = [
            [
                Paragraph("DESCRIPTION", styles["ReceiptSmall"]),
                Paragraph("AMOUNT", styles["ReceiptSmall"]),
            ],
            [
                Paragraph(f"Monthly Rent - Unit {unit.unit_number}", styles["ReceiptBody"]),
                Paragraph(_money(rent_amount), styles["ReceiptMoneyRight"]),
            ],
            [
                Paragraph("GST (0% Exempt - Residential)", styles["ReceiptBody"]),
                Paragraph(_money(Decimal("0.00")), styles["ReceiptMoneyRight"]),
            ],
        ]
        totals_rows = [
            ["Subtotal", Paragraph(_money(rent_amount), styles["ReceiptMoneyRight"])],
            ["GST (0% Exempt)", Paragraph(_money(Decimal("0.00")), styles["ReceiptMoneyRight"])],
            ["TOTAL PAID", Paragraph(_money(grand_total), styles["ReceiptMoneyRight"])],
        ]

    items_table = Table(
        receipt_items,
        colWidths=[122 * mm, 53 * mm],
    )
    items_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f4f5f4")),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#d9ddd9")),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e6e8e6")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.append(items_table)
    story.append(Spacer(1, 3 * mm))

    totals = Table(
        totals_rows,
        colWidths=[42 * mm, 40 * mm],
        hAlign="RIGHT",
    )
    totals.setStyle(
        TableStyle(
            [
                ("ALIGN", (1, 0), (1, -1), "RIGHT"),
                ("FONTNAME", (0, 4), (0, 4), INVOICE_UNICODE_FONT),
                ("FONTNAME", (0, 1), (0, 1), INVOICE_UNICODE_FONT),
                ("LINEABOVE", (0, 4), (-1, 4), 0.8, colors.HexColor("#222222")),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.append(totals)
    story.append(Spacer(1, 4 * mm))

    payment_lines = []
    payment_lines.append(f"Payment date: {_safe_text(receipt_date)}")
    payment_lines.append(f"Payment method: {_safe_text(payment.get_payment_method_display()) or '-'}")
    payment_lines.append(f"Transaction / Reference: {_safe_text(payment.transaction_id) or '-'}")
    story.append(Paragraph("PAYMENT CONFIRMATION", styles["ReceiptSection"]))
    story.append(Paragraph("<br/>".join(payment_lines), styles["ReceiptBody"]))
    story.append(Spacer(1, 3 * mm))

    signature_parts = [Spacer(1, 7 * mm)]
    if settings.signature:
        try:
            signature = Image(settings.signature.path, width=42 * mm, height=18 * mm)
            signature.hAlign = "RIGHT"
            signature_parts.append(signature)
        except Exception:
            pass
    signature_parts.append(Paragraph("Authorized Signature", styles["ReceiptRight"]))

    sig_table = Table([[signature_parts]], colWidths=[175 * mm])
    sig_table.setStyle(
        TableStyle(
            [
                ("ALIGN", (0, 0), (0, 0), "RIGHT"),
                ("VALIGN", (0, 0), (0, 0), "BOTTOM"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    story.append(sig_table)
    story.append(Spacer(1, 2 * mm))
    story.append(
        Paragraph(
            "Thank you for your payment.",
            ParagraphStyle(
                "ReceiptThankYou",
                parent=styles["ReceiptSmall"],
                alignment=TA_CENTER,
            ),
        )
    )

    doc.build(story)
    buffer.seek(0)
    return buffer


class PaymentViewSet(
    viewsets.ModelViewSet
):
    serializer_class = PaymentSerializer
    permission_classes = [IsAuthenticated]

    @action(
        detail=True,
        methods=["get"],
        url_path="invoice",
    )
    def invoice(self, request, pk=None):
        user = request.user
        payment = self.get_object()

        # Allow landlord of the building, tenant of the lease, or staff
        is_landlord = (
            hasattr(user, "landlord_profile")
            and payment.lease.unit.floor.building.landlord == user.landlord_profile
        )
        is_tenant = (
            hasattr(user, "tenant_profile")
            and payment.lease.tenant == user.tenant_profile
        )
        if not (is_landlord or is_tenant or user.is_staff):
            raise PermissionDenied(
                "You do not have permission to access this invoice."
            )

        if payment.payment_type != "rent":
            raise ValidationError(
                "Invoice generation is currently available for rent payments only."
            )

        building = payment.lease.unit.floor.building

        settings = InvoiceSettings.objects.filter(
            building=building
        ).first()

        if not settings and hasattr(user, "landlord_profile"):
            settings = InvoiceSettings.objects.filter(
                landlord=user.landlord_profile
            ).first()

        if not settings:
            settings = InvoiceSettings.objects.filter(
                landlord=building.landlord
            ).first()

        if not settings:
            raise ValidationError(
                "Please complete the Invoice Template for this building before generating an invoice."
            )

        pdf_buffer = _invoice_pdf(
            payment,
            settings,
            request,
        )

        response = FileResponse(
            pdf_buffer,
            as_attachment=False,
            filename=f"rent-invoice-{payment.id:06d}.pdf",
            content_type="application/pdf",
        )
        response["Content-Disposition"] = (
            f'inline; filename="rent-invoice-{payment.id:06d}.pdf"'
        )
        return response

    @action(
        detail=True,
        methods=["get"],
        url_path="receipt",
    )
    def receipt(self, request, pk=None):
        user = request.user
        payment = self.get_object()

        # Allow landlord of the building, tenant of the lease, or staff
        is_landlord = (
            hasattr(user, "landlord_profile")
            and payment.lease.unit.floor.building.landlord == user.landlord_profile
        )
        is_tenant = (
            hasattr(user, "tenant_profile")
            and payment.lease.tenant == user.tenant_profile
        )
        if not (is_landlord or is_tenant or user.is_staff):
            raise PermissionDenied(
                "You do not have permission to access this receipt."
            )

        if payment.payment_type != "rent":
            raise ValidationError(
                "Receipts are currently available for rent payments only."
            )

        if payment.status != "paid":
            raise ValidationError(
                "A payment receipt can only be generated after the rent is marked as paid."
            )

        building = payment.lease.unit.floor.building
        settings = InvoiceSettings.objects.filter(
            building=building
        ).first()

        if not settings and hasattr(user, "landlord_profile"):
            settings = InvoiceSettings.objects.filter(
                landlord=user.landlord_profile
            ).first()

        if not settings:
            settings = InvoiceSettings.objects.filter(
                landlord=building.landlord
            ).first()

        if not settings:
            raise ValidationError(
                "Please complete the Invoice Template for this building before generating a receipt."
            )

        pdf_buffer = _receipt_pdf(
            payment,
            settings,
            request,
        )

        response = FileResponse(
            pdf_buffer,
            as_attachment=False,
            filename=f"rent-receipt-{payment.id:06d}.pdf",
            content_type="application/pdf",
        )
        response["Content-Disposition"] = (
            f'inline; filename="rent-receipt-{payment.id:06d}.pdf"'
        )
        return response

    @action(
        detail=True,
        methods=["post"],
        url_path="send-invoice",
    )
    def send_invoice(self, request, pk=None):
        user = request.user
        payment = self.get_object()

        is_landlord = (
            hasattr(user, "landlord_profile")
            and payment.lease.unit.floor.building.landlord == user.landlord_profile
        )
        if not (is_landlord or user.is_staff):
            raise PermissionDenied(
                "You do not have permission to send this invoice."
            )

        if payment.payment_type != "rent":
            raise ValidationError(
                "Invoice email is currently available for rent payments only."
            )

        email_log = send_invoice_email(payment)
        serializer = self.get_serializer(payment)
        status_code = (
            status.HTTP_200_OK
            if email_log.status == "sent"
            else status.HTTP_400_BAD_REQUEST
        )

        return Response(
            {
                "detail": (
                    "Invoice emailed successfully."
                    if email_log.status == "sent"
                    else f"Failed to email invoice: {email_log.error_message}"
                ),
                "email_log": BillingEmailLogSerializer(email_log).data,
                "payment": serializer.data,
            },
            status=status_code,
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="send-receipt",
    )
    def send_receipt(self, request, pk=None):
        user = request.user
        payment = self.get_object()

        is_landlord = (
            hasattr(user, "landlord_profile")
            and payment.lease.unit.floor.building.landlord == user.landlord_profile
        )
        if not (is_landlord or user.is_staff):
            raise PermissionDenied(
                "You do not have permission to send this receipt."
            )

        if payment.payment_type != "rent":
            raise ValidationError(
                "Receipt email is currently available for rent payments only."
            )

        if payment.status != "paid":
            raise ValidationError(
                "A payment receipt can only be sent after the rent is marked as paid."
            )

        email_log = send_receipt_email(payment)
        serializer = self.get_serializer(payment)
        status_code = (
            status.HTTP_200_OK
            if email_log.status == "sent"
            else status.HTTP_400_BAD_REQUEST
        )

        return Response(
            {
                "detail": (
                    "Receipt emailed successfully."
                    if email_log.status == "sent"
                    else f"Failed to email receipt: {email_log.error_message}"
                ),
                "email_log": BillingEmailLogSerializer(email_log).data,
                "payment": serializer.data,
            },
            status=status_code,
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="retry-email",
    )
    def retry_email(self, request, pk=None):
        user = request.user
        payment = self.get_object()

        is_landlord = (
            hasattr(user, "landlord_profile")
            and payment.lease.unit.floor.building.landlord == user.landlord_profile
        )
        if not (is_landlord or user.is_staff):
            raise PermissionDenied(
                "You do not have permission to retry billing emails for this payment."
            )

        email_type = request.data.get("email_type")
        failed_logs = payment.email_logs.filter(status="failed")
        if email_type:
            failed_logs = failed_logs.filter(email_type=email_type)
        log = failed_logs.first()

        if not log:
            raise ValidationError(
                "No failed email delivery found to retry for this payment."
            )

        if log.email_type == "invoice":
            res_log = send_invoice_email(payment, is_retry=True, email_log=log)
        else:
            res_log = send_receipt_email(payment, is_retry=True, email_log=log)

        serializer = self.get_serializer(payment)
        status_code = (
            status.HTTP_200_OK
            if res_log.status == "sent"
            else status.HTTP_400_BAD_REQUEST
        )

        return Response(
            {
                "detail": (
                    "Email retried successfully."
                    if res_log.status == "sent"
                    else f"Email retry failed: {res_log.error_message}"
                ),
                "email_log": BillingEmailLogSerializer(res_log).data,
                "payment": serializer.data,
            },
            status=status_code,
        )

    @action(
        detail=False,
        methods=["post"],
        url_path="generate-monthly-invoices",
    )
    def generate_monthly_invoices_endpoint(self, request):
        user = request.user
        if not hasattr(user, "landlord_profile") and not user.is_staff:
            raise PermissionDenied("Only landlords can generate monthly invoices.")

        landlord = getattr(user, "landlord_profile", None)
        date_str = request.data.get("date")
        target_date = None
        if date_str:
            try:
                from datetime import datetime
                target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
            except ValueError:
                raise ValidationError("Invalid date format. Expected YYYY-MM-DD.")

        building_id = request.data.get("building_id")
        building = None
        if building_id:
            try:
                building = Building.objects.get(id=building_id, landlord=landlord)
            except Building.DoesNotExist:
                raise ValidationError("Building not found or does not belong to you.")

        send_emails = request.data.get("send_emails", True)
        summary = generate_monthly_invoices(
            target_date=target_date,
            building=building,
            landlord=landlord,
            send_emails=send_emails,
        )
        return Response(summary, status=status.HTTP_200_OK)


    def get_queryset(self):
        user = self.request.user

        if hasattr(
            user,
            "landlord_profile",
        ):
            return (
                Payment.objects.filter(
                    lease__unit__floor__building__landlord=(
                        user.landlord_profile
                    )
                )
                .select_related(
                    "lease",
                    "lease__tenant",
                    "lease__unit",
                    "lease__unit__floor",
                    "lease__unit__floor__building",
                )
                .order_by(
                    "-due_date",
                    "-created_at",
                )
            )

        if hasattr(
            user,
            "tenant_profile",
        ):
            return (
                Payment.objects.filter(
                    lease__tenant=user.tenant_profile
                )
                .select_related(
                    "lease",
                    "lease__tenant",
                    "lease__unit",
                    "lease__unit__floor",
                    "lease__unit__floor__building",
                )
                .order_by(
                    "-due_date",
                    "-created_at",
                )
            )

        return Payment.objects.none()

    def perform_create(
        self,
        serializer,
    ):
        user = self.request.user

        if not hasattr(
            user,
            "landlord_profile",
        ):
            raise PermissionDenied(
                "Only landlords can create payments."
            )

        lease = serializer.validated_data[
            "lease"
        ]

        if (
            lease.unit.floor.building.landlord
            != user.landlord_profile
        ):
            raise PermissionDenied(
                "You can only create payments for your own leases."
            )

        payment = serializer.save()
        if payment.payment_type == "rent" and payment.status == "paid":
            send_receipt_email(payment)

    def perform_update(
        self,
        serializer,
    ):
        user = self.request.user

        if not hasattr(
            user,
            "landlord_profile",
        ):
            raise PermissionDenied(
                "Only landlords can update payments."
            )

        payment = self.get_object()

        if (
            payment.lease.unit.floor.building.landlord
            != user.landlord_profile
        ):
            raise PermissionDenied(
                "You can only update your own payments."
            )

        old_status = payment.status
        updated_payment = serializer.save()

        if updated_payment.payment_type == "rent" and updated_payment.status == "paid":
            already_sent = updated_payment.email_logs.filter(
                email_type="receipt",
                status="sent",
            ).exists()
            if old_status != "paid" or not already_sent:
                send_receipt_email(updated_payment)

    def destroy(
        self,
        request,
        *args,
        **kwargs,
    ):
        user = request.user

        if not hasattr(
            user,
            "landlord_profile",
        ):
            raise PermissionDenied(
                "Only landlords can delete payments."
            )

        payment = self.get_object()

        if (
            payment.lease.unit.floor.building.landlord
            != user.landlord_profile
        ):
            raise PermissionDenied(
                "You can only delete your own payments."
            )

        return super().destroy(
            request,
            *args,
            **kwargs,
        )


class MaintenanceRequestViewSet(
    viewsets.ModelViewSet
):
    serializer_class = MaintenanceRequestSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        if hasattr(
            user,
            "landlord_profile",
        ):
            return (
                MaintenanceRequest.objects.filter(
                    unit__floor__building__landlord=(
                        user.landlord_profile
                    )
                )
                .select_related(
                    "unit",
                    "unit__floor",
                    "unit__floor__building",
                    "tenant",
                )
                .order_by("-created_at")
            )

        if hasattr(
            user,
            "tenant_profile",
        ):
            return (
                MaintenanceRequest.objects.filter(
                    tenant=user.tenant_profile
                )
                .select_related(
                    "unit",
                    "unit__floor",
                    "unit__floor__building",
                    "tenant",
                )
                .order_by("-created_at")
            )

        return MaintenanceRequest.objects.none()

    def perform_create(
        self,
        serializer,
    ):
        user = self.request.user

        if not hasattr(
            user,
            "tenant_profile",
        ):
            raise PermissionDenied(
                "Only tenants can create maintenance requests."
            )

        unit = serializer.validated_data[
            "unit"
        ]

        active_lease = Lease.objects.filter(
            unit=unit,
            tenant=user.tenant_profile,
            status="active",
        ).exists()

        if not active_lease:
            raise PermissionDenied(
                "You can only create maintenance requests for your rented unit."
            )

        serializer.save(
            tenant=user.tenant_profile
        )


class BillingEmailLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = BillingEmailLogSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, "landlord_profile"):
            qs = BillingEmailLog.objects.filter(
                payment__lease__unit__floor__building__landlord=user.landlord_profile
            )
        elif hasattr(user, "tenant_profile"):
            qs = BillingEmailLog.objects.filter(
                payment__lease__tenant=user.tenant_profile
            )
        elif user.is_staff:
            qs = BillingEmailLog.objects.all()
        else:
            return BillingEmailLog.objects.none()

        payment_id = self.request.query_params.get("payment")
        if payment_id:
            qs = qs.filter(payment_id=payment_id)
        return qs.select_related(
            "payment",
            "payment__lease",
            "payment__lease__tenant",
            "payment__lease__unit",
        ).order_by("-created_at")

    @action(detail=True, methods=["post"], url_path="retry")
    def retry(self, request, pk=None):
        log = self.get_object()
        user = request.user
        is_landlord = (
            hasattr(user, "landlord_profile")
            and log.payment.lease.unit.floor.building.landlord == user.landlord_profile
        )
        if not (is_landlord or user.is_staff):
            raise PermissionDenied("Only the landlord can retry billing emails.")

        if log.status != "failed":
            raise ValidationError("Only failed deliveries can be retried.")

        if log.email_type == "invoice":
            res_log = send_invoice_email(log.payment, is_retry=True, email_log=log)
        else:
            res_log = send_receipt_email(log.payment, is_retry=True, email_log=log)

        status_code = (
            status.HTTP_200_OK
            if res_log.status == "sent"
            else status.HTTP_400_BAD_REQUEST
        )

        return Response(
            {
                "detail": (
                    "Email retried successfully."
                    if res_log.status == "sent"
                    else f"Email retry failed: {res_log.error_message}"
                ),
                "email_log": BillingEmailLogSerializer(res_log).data,
            },
            status=status_code,
        )