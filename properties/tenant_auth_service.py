import logging
import os
import re
import secrets
import string
from django.conf import settings
from django.contrib.auth.models import User
from django.core.mail import EmailMultiAlternatives
from django.db import transaction

logger = logging.getLogger(__name__)


def generate_secure_password(length=12):
    """
    Generates a cryptographically strong temporary password that satisfies
    standard password complexity requirements (uppercase, lowercase, digit, symbol).
    """
    length = max(length, 10)
    uppercase = string.ascii_uppercase
    lowercase = string.ascii_lowercase
    digits = string.digits
    symbols = "!@#$%^&*"

    # Guarantee at least one of each required character class
    password_chars = [
        secrets.choice(uppercase),
        secrets.choice(lowercase),
        secrets.choice(digits),
        secrets.choice(symbols),
    ]

    all_chars = uppercase + lowercase + digits + symbols
    for _ in range(length - len(password_chars)):
        password_chars.append(secrets.choice(all_chars))

    secrets.SystemRandom().shuffle(password_chars)
    return "".join(password_chars)


def create_unique_tenant_username(email="", first_name="", last_name="", exclude_user_id=None):
    """
    Generates a clean, human-readable, unique username for a tenant.
    Derives from email prefix or first/last name with numeric suffix on collision.
    """
    raw_base = ""
    email = (email or "").strip().lower()
    first_name = (first_name or "").strip()
    last_name = (last_name or "").strip()

    if email and "@" in email:
        raw_base = email.split("@")[0]
    elif first_name:
        raw_base = f"{first_name}_{last_name}".strip("_")
    else:
        raw_base = "tenant"

    clean_base = re.sub(r"[^a-zA-Z0-9_]", "_", raw_base).strip("_").lower()
    if not clean_base:
        clean_base = "tenant"

    # Truncate clean_base to ensure room for numeric suffixes (Django username max_length is 150)
    clean_base = clean_base[:120]
    candidate = clean_base

    counter = 1
    query = User.objects.filter(username__iexact=candidate)
    if exclude_user_id:
        query = query.exclude(id=exclude_user_id)

    while query.exists():
        candidate = f"{clean_base}_{counter}"
        query = User.objects.filter(username__iexact=candidate)
        if exclude_user_id:
            query = query.exclude(id=exclude_user_id)
        counter += 1

    return candidate


def provision_tenant_user(tenant, landlord=None, commit=True):
    """
    Creates or links a Django User account for the Tenant.
    Returns a tuple: (user, temporary_password, email_sent).
    If user already existed, temporary_password will be None.
    """
    with transaction.atomic():
        if landlord and not tenant.landlord:
            tenant.landlord = landlord

        if tenant.user:
            if commit:
                tenant.save()
            return tenant.user, None, False

        email = (tenant.email or "").strip().lower()
        existing_user = None
        if email:
            existing_user = User.objects.filter(email__iexact=email).first()

        temp_password = generate_secure_password(12)

        if existing_user and not hasattr(existing_user, "tenant_profile"):
            user = existing_user
            user.set_password(temp_password)
            user.save()
        else:
            username = create_unique_tenant_username(
                email=email,
                first_name=tenant.first_name,
                last_name=tenant.last_name,
            )
            user = User.objects.create_user(
                username=username,
                email=email,
                password=temp_password,
                first_name=(tenant.first_name or "").strip(),
                last_name=(tenant.last_name or "").strip(),
            )

        tenant.user = user
        tenant.must_change_password = True
        if commit:
            tenant.save()

        # Send welcome email if email address is present
        email_sent = False
        if email:
            email_sent = send_tenant_welcome_email(tenant, temp_password)

        return user, temp_password, email_sent


def reset_tenant_user_password(tenant, landlord=None):
    """
    Generates a new temporary password for the tenant user and flags must_change_password.
    Returns (user, temporary_password, email_sent).
    """
    with transaction.atomic():
        if landlord and not tenant.landlord:
            tenant.landlord = landlord
            tenant.save()

        if not tenant.user:
            return provision_tenant_user(tenant, landlord=landlord)

        user = tenant.user
        temp_password = generate_secure_password(12)
        user.set_password(temp_password)
        user.save()

        tenant.must_change_password = True
        tenant.save()

        email_sent = False
        if tenant.email:
            email_sent = send_tenant_password_reset_email(tenant, temp_password)

        return user, temp_password, email_sent


def _get_portal_url(path="/tenant/login"):
    """
    Resolves the frontend tenant portal URL based on environment or default hosts.
    """
    base = os.getenv("FRONTEND_URL", "").rstrip("/")
    if not base:
        base = "http://localhost:5173"
    return f"{base}{path}"


def send_tenant_welcome_email(tenant, temp_password, login_url=None):
    """
    Sends a welcome email with one-time credentials to the tenant.
    Never throws an exception so account creation is never blocked by SMTP issues.
    """
    recipient = (tenant.email or "").strip()
    if not recipient or "@" not in recipient:
        return False

    if not login_url:
        login_url = _get_portal_url("/tenant/login")

    tenant_name = (f"{tenant.first_name} {tenant.last_name}").strip() or "Valued Tenant"
    username = tenant.user.username if tenant.user else recipient
    login_id = recipient or username

    subject = "Welcome to RentEase – Your Tenant Portal Credentials"

    text_body = f"""Hello {tenant_name},

Welcome to RentEase! Your tenant account has been created by your property manager.

You can now log in to the Tenant Portal to review your lease, track rent payments, download invoices & receipts, and submit maintenance complaints.

Login URL: {login_url}
Email / Login ID: {login_id}
Username: {username}
Temporary Password: {temp_password}

IMPORTANT SECURITY NOTICE:
You are required to change your temporary password immediately upon your first sign-in.

If you have any questions or need assistance, please contact your property manager.

Best regards,
RentEase Property Management
"""

    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }}
        .email-container {{ max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }}
        .header {{ background: linear-gradient(135deg, #0056d2 0%, #1e40af 100%); padding: 32px 28px; text-align: center; color: #ffffff; }}
        .header h1 {{ margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }}
        .header p {{ margin: 6px 0 0; font-size: 14px; opacity: 0.9; }}
        .content {{ padding: 32px 28px; }}
        .salutation {{ font-size: 16px; font-weight: 600; margin-bottom: 16px; color: #0f172a; }}
        .credentials-card {{ background-color: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; padding: 20px; margin: 24px 0; }}
        .cred-row {{ display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px; }}
        .cred-label {{ color: #64748b; font-weight: 500; }}
        .cred-value {{ color: #0f172a; font-weight: 600; font-family: monospace; }}
        .temp-pw-box {{ background: #ffffff; border: 1px dashed #0056d2; padding: 10px 14px; border-radius: 6px; font-size: 16px; font-weight: 700; color: #0056d2; font-family: monospace; text-align: center; margin-top: 10px; letter-spacing: 1px; }}
        .cta-btn {{ display: block; width: fit-content; margin: 24px auto 0; padding: 12px 28px; background: #0056d2; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; text-align: center; }}
        .notice {{ background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; border-radius: 4px; font-size: 13px; color: #991b1b; margin-top: 24px; }}
        .footer {{ padding: 20px 28px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #94a3b8; }}
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="header">
          <h1>RentEase Tenant Portal</h1>
          <p>Your property rental access is ready</p>
        </div>
        <div class="content">
          <div class="salutation">Hello {tenant_name},</div>
          <p style="font-size: 14px; line-height: 1.6; color: #334155;">
            Your tenant account has been successfully configured. You can now access your lease details, review rent statements, download official invoices & receipts, and raise maintenance tickets online.
          </p>

          <div class="credentials-card">
            <div class="cred-row">
              <span class="cred-label">Login Identifier:</span>
              <span class="cred-value">{login_id}</span>
            </div>
            <div class="cred-row">
              <span class="cred-label">Username:</span>
              <span class="cred-value">{username}</span>
            </div>
            <div class="cred-row" style="margin-bottom: 4px;">
              <span class="cred-label">Temporary Password:</span>
            </div>
            <div class="temp-pw-box">{temp_password}</div>
          </div>

          <a href="{login_url}" class="cta-btn">Sign In to Tenant Portal</a>

          <div class="notice">
            <strong>Security Notice:</strong> Please sign in using the button above and change your temporary password immediately.
          </div>
        </div>
        <div class="footer">
          &copy; RentEase Property Management. This is an automated notification.
        </div>
      </div>
    </body>
    </html>
    """

    try:
        from_email = getattr(settings, "DEFAULT_FROM_EMAIL", "RentEase <no-reply@rentease.com>")
        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_body,
            from_email=from_email,
            to=[recipient],
        )
        msg.attach_alternative(html_body, "text/html")
        msg.send(fail_silently=False)
        return True
    except Exception as exc:
        logger.warning("Failed to deliver tenant welcome email to %s: %s", recipient, exc)
        return False


def send_tenant_password_reset_email(tenant, temp_password, login_url=None):
    """
    Sends a password reset notification email to the tenant.
    Never throws an exception to avoid breaking the reset action.
    """
    recipient = (tenant.email or "").strip()
    if not recipient or "@" not in recipient:
        return False

    if not login_url:
        login_url = _get_portal_url("/tenant/login")

    tenant_name = (f"{tenant.first_name} {tenant.last_name}").strip() or "Valued Tenant"
    username = tenant.user.username if tenant.user else recipient
    login_id = recipient or username

    subject = "RentEase – Temporary Password Reset"

    text_body = f"""Hello {tenant_name},

Your property manager has generated a fresh temporary password for your RentEase Tenant Portal account.

Login URL: {login_url}
Login ID / Email: {login_id}
Username: {username}
New Temporary Password: {temp_password}

SECURITY REMINDER:
Please log in and update this temporary password to a secure personal password.

Best regards,
RentEase Property Management
"""

    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; color: #1e293b; padding: 24px; }}
        .email-container {{ max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; }}
        .header {{ background: #0056d2; padding: 24px 28px; text-align: center; color: #ffffff; }}
        .content {{ padding: 28px; }}
        .temp-pw-box {{ background: #eff6ff; border: 1px dashed #0056d2; padding: 12px; border-radius: 6px; font-size: 18px; font-weight: 700; color: #0056d2; font-family: monospace; text-align: center; margin: 20px 0; letter-spacing: 1px; }}
        .cta-btn {{ display: block; width: fit-content; margin: 20px auto; padding: 12px 28px; background: #0056d2; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; }}
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="header">
          <h2 style="margin: 0;">RentEase Password Reset</h2>
        </div>
        <div class="content">
          <p>Hello <strong>{tenant_name}</strong>,</p>
          <p>A new temporary password has been generated for your RentEase account by your property manager.</p>
          <div class="temp-pw-box">{temp_password}</div>
          <p>Your login username is: <code>{username}</code></p>
          <a href="{login_url}" class="cta-btn">Sign In to Tenant Portal</a>
          <p style="font-size: 13px; color: #64748b; margin-top: 24px;">
            Please log in and update your password immediately after sign-in.
          </p>
        </div>
      </div>
    </body>
    </html>
    """

    try:
        from_email = getattr(settings, "DEFAULT_FROM_EMAIL", "RentEase <no-reply@rentease.com>")
        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_body,
            from_email=from_email,
            to=[recipient],
        )
        msg.attach_alternative(html_body, "text/html")
        msg.send(fail_silently=False)
        return True
    except Exception as exc:
        logger.warning("Failed to deliver tenant password reset email to %s: %s", recipient, exc)
        return False
