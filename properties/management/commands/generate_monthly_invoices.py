from datetime import datetime
from django.core.management.base import BaseCommand
from django.utils import timezone
from properties.models import Building
from properties.billing_communication import generate_monthly_invoices


class Command(BaseCommand):
    help = "Automatically generates commercial rent invoices and emails them to tenants on the 1st of the month."

    def add_arguments(self, parser):
        parser.add_argument(
            "--date",
            type=str,
            help="Target billing date in YYYY-MM-DD format (defaults to today).",
        )
        parser.add_argument(
            "--building",
            type=int,
            help="Optional building ID to limit generation to.",
        )
        parser.add_argument(
            "--no-email",
            action="store_true",
            help="Create invoices only without sending emails.",
        )

    def handle(self, *args, **options):
        date_str = options.get("date")
        if date_str:
            try:
                target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
            except ValueError:
                self.stderr.write(self.style.ERROR(f"Invalid date format: {date_str}. Expected YYYY-MM-DD."))
                return
        else:
            target_date = timezone.localdate()

        building_id = options.get("building")
        building = None
        if building_id:
            try:
                building = Building.objects.get(id=building_id)
            except Building.DoesNotExist:
                self.stderr.write(self.style.ERROR(f"Building with ID {building_id} does not exist."))
                return

        send_emails = not options.get("no_email", False)

        self.stdout.write(
            self.style.NOTICE(
                f"Running automated commercial invoice generation for date: {target_date} "
                f"(Emails enabled: {send_emails})..."
            )
        )

        result = generate_monthly_invoices(
            target_date=target_date,
            building=building,
            send_emails=send_emails,
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"Completed. Active leases: {result['total_active_leases']}, "
                f"New invoices created: {result['invoices_created']}, "
                f"Emails sent: {result['emails_sent']}, "
                f"Emails failed: {result['emails_failed']}."
            )
        )
