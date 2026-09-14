import smtplib
import socket
from django.conf import settings
from django.core.management.base import BaseCommand
from django.core.mail import send_mail


class Command(BaseCommand):
    help = "Safely tests SMTP connection, TLS/SSL handshake, authentication, and optional test email dispatch without exposing credentials."

    def add_arguments(self, parser):
        parser.add_argument(
            "--to",
            type=str,
            default="",
            help="Optional recipient address for test email (defaults to EMAIL_HOST_USER if configured).",
        )
        parser.add_argument(
            "--send",
            action="store_true",
            help="Actually attempt sending a test email if SMTP authentication succeeds.",
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("=== RentEase SMTP Connection Diagnostic ==="))

        host = getattr(settings, "EMAIL_HOST", "")
        port = getattr(settings, "EMAIL_PORT", 587)
        use_tls = getattr(settings, "EMAIL_USE_TLS", True)
        use_ssl = getattr(settings, "EMAIL_USE_SSL", False)
        username = getattr(settings, "EMAIL_HOST_USER", "")
        password = getattr(settings, "EMAIL_HOST_PASSWORD", "")
        from_email = getattr(settings, "DEFAULT_FROM_EMAIL", "")
        backend = getattr(settings, "EMAIL_BACKEND", "")
        timeout = getattr(settings, "EMAIL_TIMEOUT", 15)

        self.stdout.write(f"EMAIL_BACKEND:       {backend}")
        self.stdout.write(f"EMAIL_HOST:          {host}")
        self.stdout.write(f"EMAIL_PORT:          {port}")
        self.stdout.write(f"EMAIL_USE_TLS:       {use_tls}")
        self.stdout.write(f"EMAIL_USE_SSL:       {use_ssl}")
        self.stdout.write(f"EMAIL_HOST_USER:     {username}")
        self.stdout.write(f"DEFAULT_FROM_EMAIL:  {from_email}")
        self.stdout.write(f"PASSWORD CONFIGURED: {'YES' if bool(password.strip()) else 'NO (MISSING/EMPTY)'}")
        self.stdout.write("-" * 50)

        # 1. Socket Connectivity Check
        self.stdout.write(f"1. Testing TCP network reachability to {host}:{port} (timeout={timeout}s)...")
        try:
            sock = socket.create_connection((host, int(port)), timeout=timeout)
            sock.close()
            self.stdout.write(self.style.SUCCESS(f"   [PASS] Successfully established TCP connection to {host}:{port}"))
        except Exception as exc:
            self.stdout.write(self.style.ERROR(f"   [FAIL] Could not connect to {host}:{port}: {exc}"))
            return

        # 2. SMTP Protocol & Handshake Check
        self.stdout.write(f"2. Testing SMTP handshake and TLS/SSL negotiation...")
        smtp_server = None
        try:
            if use_ssl:
                smtp_server = smtplib.SMTP_SSL(host, port, timeout=timeout)
                smtp_server.ehlo()
                self.stdout.write(self.style.SUCCESS("   [PASS] SMTP SSL connection & EHLO succeeded."))
            else:
                smtp_server = smtplib.SMTP(host, port, timeout=timeout)
                smtp_server.ehlo()
                if use_tls:
                    smtp_server.starttls()
                    smtp_server.ehlo()
                    self.stdout.write(self.style.SUCCESS("   [PASS] SMTP STARTTLS handshake & EHLO succeeded."))
                else:
                    self.stdout.write(self.style.SUCCESS("   [PASS] Plain SMTP handshake succeeded."))
        except Exception as exc:
            self.stdout.write(self.style.ERROR(f"   [FAIL] SMTP handshake failed: {exc}"))
            if smtp_server:
                try:
                    smtp_server.quit()
                except Exception:
                    pass
            return

        # 3. SMTP Authentication Check
        self.stdout.write("3. Testing SMTP Authentication...")
        if not password.strip():
            self.stdout.write(
                self.style.WARNING(
                    "   [ACTION REQUIRED] EMAIL_HOST_PASSWORD is not set in backend .env!\n"
                    "   Network connectivity and TLS handshake to smtp.gmail.com succeeded.\n"
                    "   To enable authenticated email dispatch, please add your 16-character\n"
                    "   Google App Password to .env:\n"
                    "   EMAIL_HOST_PASSWORD=your-google-app-password"
                )
            )
            try:
                smtp_server.quit()
            except Exception:
                pass
            return

        try:
            smtp_server.login(username, password)
            self.stdout.write(self.style.SUCCESS(f"   [PASS] SMTP authentication succeeded for user: {username}"))
        except smtplib.SMTPAuthenticationError as exc:
            self.stdout.write(
                self.style.ERROR(
                    f"   [FAIL] SMTP Authentication failed ({exc.smtp_code}): {exc.smtp_error.decode(errors='ignore') if isinstance(exc.smtp_error, bytes) else exc.smtp_error}\n"
                    "   Note: For Gmail, ensure 2-Factor Authentication is enabled and use a 16-character App Password."
                )
            )
            try:
                smtp_server.quit()
            except Exception:
                pass
            return
        except Exception as exc:
            self.stdout.write(self.style.ERROR(f"   [FAIL] Unexpected error during SMTP login: {exc}"))
            try:
                smtp_server.quit()
            except Exception:
                pass
            return

        # 4. Optional Test Email Dispatch
        should_send = options.get("send", False)
        test_recipient = options.get("to") or username

        if should_send:
            self.stdout.write(f"4. Sending test email via Django to {test_recipient}...")
            try:
                sent = send_mail(
                    subject="RentEase SMTP Diagnostic Test Email",
                    message="This is a test email sent from RentEase to verify SMTP delivery.",
                    from_email=from_email,
                    recipient_list=[test_recipient],
                    fail_silently=False,
                )
                if sent > 0:
                    self.stdout.write(self.style.SUCCESS(f"   [PASS] Test email successfully dispatched to {test_recipient}!"))
                else:
                    self.stdout.write(self.style.WARNING("   [WARN] send_mail returned 0 dispatched messages."))
            except Exception as exc:
                self.stdout.write(self.style.ERROR(f"   [FAIL] Error sending test email: {exc}"))
        else:
            self.stdout.write(
                self.style.NOTICE(
                    f"4. Test email skipped. (Use --send --to={test_recipient} to send a live test message)."
                )
            )

        try:
            smtp_server.quit()
        except Exception:
            pass

        self.stdout.write(self.style.SUCCESS("=== SMTP Diagnostics Complete ==="))
