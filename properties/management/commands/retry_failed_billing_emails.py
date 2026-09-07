from django.core.management.base import BaseCommand
from properties.billing_communication import retry_failed_billing_emails


class Command(BaseCommand):
    help = "Retries sending failed invoice and receipt delivery emails."

    def add_arguments(self, parser):
        parser.add_argument(
            "--max-retries",
            type=int,
            default=3,
            help="Maximum allowed retry attempts per email (default 3).",
        )
        parser.add_argument(
            "--payment",
            type=int,
            help="Optional payment ID to restrict retries to.",
        )

    def handle(self, *args, **options):
        max_retries = options.get("max_retries", 3)
        payment_id = options.get("payment")

        self.stdout.write(
            self.style.NOTICE(
                f"Starting failed billing email retries (max_retries={max_retries})..."
            )
        )

        res = retry_failed_billing_emails(
            max_retries=max_retries,
            payment_id=payment_id,
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"Done. Attempted: {res['attempted']}, "
                f"Succeeded: {res['succeeded']}, "
                f"Failed: {res['failed']}."
            )
        )
