import calendar
from decimal import Decimal, ROUND_HALF_UP
from datetime import date

from django.conf import settings as django_settings
from django.core.mail import EmailMultiAlternatives
from django.utils import timezone

from .models import Payment, Lease, InvoiceSettings, BillingEmailLog


def resolve_invoice_settings(payment):
    """
    Resolve InvoiceSettings for the payment's building or landlord.
    """
    building = payment.lease.unit.floor.building
    inv_settings = InvoiceSettings.objects.filter(building=building).first()
    if not inv_settings:
        inv_settings = InvoiceSettings.objects.filter(landlord=building.landlord).first()
    return inv_settings


def _calculate_gst_breakdown(amount, gst_rate):
    """
    Calculates subtotal, GST total, CGST, SGST, and grand total.
    """
    rent_amount = Decimal(str(amount or 0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    rate = Decimal(str(gst_rate or 0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    gst_total = (rent_amount * rate / Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    cgst = (gst_total / Decimal("2")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    sgst = (gst_total - cgst).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    grand_total = (rent_amount + gst_total).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return {
        "rent_amount": rent_amount,
        "gst_rate": rate,
        "gst_total": gst_total,
        "cgst": cgst,
        "sgst": sgst,
        "grand_total": grand_total,
    }


def _get_billed_month(due_date):
    """
    In RentEase, payment due in a month is for the preceding calendar month.
    """
    issue_date = due_date.replace(day=1)
    prev_m = issue_date.month - 1
    prev_y = issue_date.year
    if prev_m == 0:
        prev_m = 12
        prev_y -= 1
    return f"{calendar.month_name[prev_m]} {prev_y}"


def send_invoice_email(payment, is_retry=False, email_log=None):
    """
    Generates the commercial invoice PDF and emails it to the tenant's registered email.
    Records delivery status in BillingEmailLog.
    """
    tenant = payment.lease.tenant
    unit = payment.lease.unit
    floor = unit.floor
    building = floor.building
    inv_settings = resolve_invoice_settings(payment)

    recipient = (tenant.email or "").strip()
    if not recipient and tenant.user and tenant.user.email:
        recipient = tenant.user.email.strip()

    billed_month = _get_billed_month(payment.due_date)
    subject = f"Commercial Rent Invoice - {unit.unit_number} - {billed_month}"

    # Determine or create email log
    if email_log is None:
        email_log = BillingEmailLog.objects.create(
            payment=payment,
            email_type="invoice",
            recipient_email=recipient or "no-email-provided@rentease.local",
            subject=subject,
            status="pending",
        )
    else:
        email_log.recipient_email = recipient or email_log.recipient_email
        email_log.subject = subject

    if is_retry:
        email_log.retry_count += 1

    if not recipient:
        email_log.status = "failed"
        email_log.error_message = "Tenant has no registered email address."
        email_log.save()
        return email_log

    if not inv_settings:
        email_log.status = "failed"
        email_log.error_message = "Invoice template not configured for this building/landlord."
        email_log.save()
        return email_log

    # Calculate financial details
    calc = _calculate_gst_breakdown(payment.amount, tenant.gst_rate)
    due_date_str = payment.due_date.strftime("%d %b %Y")
    tenant_name = f"{tenant.first_name} {tenant.last_name}".strip() or "Valued Tenant"
    shop_name = tenant.shop_name or f"Unit {unit.unit_number}"
    landlord_name = building.landlord.user.get_full_name() or building.landlord.user.username
    business_name = inv_settings.business_name or landlord_name

    # Plain text content
    text_content = f"""Dear {tenant_name},

Please find attached the official commercial rent invoice for {billed_month}.

--- INVOICE SUMMARY ---
Property: {building.name} - Unit {unit.unit_number} (Floor {floor.floor_number})
Shop / Commercial Establishment: {shop_name}
Billing Month: {billed_month}
Due Date: {due_date_str}

--- CHARGES & GST BREAKDOWN ---
Base Rent: INR {calc['rent_amount']:.2f}
GST Rate: {calc['gst_rate']}%
CGST: INR {calc['cgst']:.2f}
SGST: INR {calc['sgst']:.2f}
Total GST: INR {calc['gst_total']:.2f}
---------------------------------
TOTAL AMOUNT DUE: INR {calc['grand_total']:.2f}

--- PAYMENT INSTRUCTIONS ---
Bank: {inv_settings.bank_name or '-'}
Account Number: {inv_settings.account_number or '-'}
IFSC Code: {inv_settings.ifsc or '-'}
Branch: {inv_settings.branch or '-'}
Instructions: {inv_settings.payment_instructions or 'Please include your unit number in the payment reference.'}

Please ensure payment is completed on or before {due_date_str}.
The official tax invoice PDF is attached to this email.

Warm regards,
{business_name}
Managed via RentEase
"""

    # Rich HTML content
    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }}
    .container {{ max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }}
    .header {{ background: #0f172a; padding: 28px 32px; color: #ffffff; }}
    .header h1 {{ margin: 0 0 6px 0; font-size: 20px; font-weight: 700; letter-spacing: -0.5px; }}
    .header p {{ margin: 0; font-size: 13px; color: #94a3b8; }}
    .content {{ padding: 32px; }}
    .greeting {{ font-size: 15px; margin-bottom: 20px; }}
    .summary-card {{ background: #f1f5f9; border-radius: 8px; padding: 20px; margin-bottom: 24px; border-left: 4px solid #2563eb; }}
    .summary-row {{ display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; }}
    .summary-label {{ color: #64748b; }}
    .summary-value {{ font-weight: 600; color: #0f172a; }}
    .table {{ width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px; }}
    .table th {{ background: #f8fafc; color: #475569; font-weight: 600; text-align: left; padding: 10px 12px; border-bottom: 1px solid #e2e8f0; }}
    .table td {{ padding: 10px 12px; border-bottom: 1px solid #f1f5f9; }}
    .table td.amount {{ text-align: right; font-family: monospace; font-size: 13px; }}
    .total-banner {{ background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; margin: 24px 0; }}
    .total-title {{ font-size: 14px; font-weight: 600; color: #1e40af; margin: 0; }}
    .total-amount {{ font-size: 22px; font-weight: 800; color: #1e3a8a; margin: 0; }}
    .instructions-card {{ background: #fefce8; border: 1px solid #fef08a; border-radius: 8px; padding: 18px; margin: 24px 0; font-size: 12.5px; }}
    .instructions-card h4 {{ margin: 0 0 10px 0; color: #854d0e; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; }}
    .footer {{ background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 32px; font-size: 12px; color: #64748b; text-align: center; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Rent Invoice</h1>
      <p>{business_name} &bull; Billing Period: {billed_month}</p>
    </div>
    <div class="content">
      <p class="greeting">Dear <strong>{tenant_name}</strong>,</p>
      <p style="font-size: 13.5px; line-height: 1.5; color: #334155;">
        Your commercial rent invoice for the month of <strong>{billed_month}</strong> has been generated and is ready for payment.
      </p>

      <div class="summary-card">
        <div class="summary-row"><span class="summary-label">Commercial Unit:</span><span class="summary-value">Unit {unit.unit_number} ({shop_name})</span></div>
        <div class="summary-row"><span class="summary-label">Building / Floor:</span><span class="summary-value">{building.name}, Floor {floor.floor_number}</span></div>
        <div class="summary-row"><span class="summary-label">Billing Month:</span><span class="summary-value">{billed_month}</span></div>
        <div class="summary-row"><span class="summary-label">Due Date:</span><span class="summary-value" style="color: #dc2626;">{due_date_str}</span></div>
      </div>

      <table class="table">
        <thead>
          <tr>
            <th>Description</th>
            <th style="text-align: right;">Amount (INR)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Monthly Rent (Base)</td>
            <td class="amount">&#8377;{calc['rent_amount']:.2f}</td>
          </tr>
          <tr>
            <td>CGST ({calc['gst_rate'] / Decimal('2')}%)</td>
            <td class="amount">&#8377;{calc['cgst']:.2f}</td>
          </tr>
          <tr>
            <td>SGST ({calc['gst_rate'] / Decimal('2')}%)</td>
            <td class="amount">&#8377;{calc['sgst']:.2f}</td>
          </tr>
        </tbody>
      </table>

      <div class="total-banner">
        <div>
          <p class="total-title">Total Due by {due_date_str}</p>
          <span style="font-size: 11px; color: #3b82f6;">Includes GST &#8377;{calc['gst_total']:.2f}</span>
        </div>
        <div class="total-amount">&#8377;{calc['grand_total']:.2f}</div>
      </div>

      <div class="instructions-card">
        <h4>Payment Instructions</h4>
        <p style="margin: 0 0 6px 0;"><strong>Bank:</strong> {inv_settings.bank_name or '-'}</p>
        <p style="margin: 0 0 6px 0;"><strong>Account No:</strong> {inv_settings.account_number or '-'}</p>
        <p style="margin: 0 0 6px 0;"><strong>IFSC Code:</strong> {inv_settings.ifsc or '-'}</p>
        <p style="margin: 0 0 6px 0;"><strong>Branch:</strong> {inv_settings.branch or '-'}</p>
        <p style="margin: 6px 0 0 0; color: #713f12;">{inv_settings.payment_instructions or 'Please mention your unit number in the transfer remarks.'}</p>
      </div>

      <p style="font-size: 12px; color: #64748b; font-style: italic;">
        * Note: The formal tax invoice document is attached to this email as a PDF.
      </p>
    </div>
    <div class="footer">
      Sent by {business_name} via RentEase Commercial Property Management.<br/>
      Need support? Contact your property manager at {inv_settings.email or inv_settings.phone or 'support@rentease.com'}.
    </div>
  </div>
</body>
</html>
"""

    try:
        from .views import _invoice_pdf
        # Build PDF attachment
        pdf_buffer = _invoice_pdf(payment, inv_settings, request=None)
        pdf_bytes = pdf_buffer.getvalue()

        from_email = getattr(django_settings, "DEFAULT_FROM_EMAIL", "billing@rentease.com")
        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_content,
            from_email=from_email,
            to=[recipient],
        )
        msg.attach_alternative(html_content, "text/html")
        msg.attach(
            f"rent-invoice-{payment.id:06d}.pdf",
            pdf_bytes,
            "application/pdf",
        )
        msg.send(fail_silently=False)

        email_log.status = "sent"
        email_log.sent_at = timezone.now()
        email_log.error_message = ""
        email_log.save()
    except Exception as exc:
        email_log.status = "failed"
        email_log.error_message = str(exc)
        email_log.save()

    return email_log


def send_receipt_email(payment, is_retry=False, email_log=None):
    """
    Generates the payment receipt PDF and emails it to the tenant.
    Records delivery status in BillingEmailLog.
    """
    tenant = payment.lease.tenant
    unit = payment.lease.unit
    floor = unit.floor
    building = floor.building
    inv_settings = resolve_invoice_settings(payment)

    recipient = (tenant.email or "").strip()
    if not recipient and tenant.user and tenant.user.email:
        recipient = tenant.user.email.strip()

    txn_ref = payment.transaction_id or f"TXN-{payment.id:06d}"
    subject = f"Rent Payment Receipt - {unit.unit_number} - {txn_ref}"

    if email_log is None:
        email_log = BillingEmailLog.objects.create(
            payment=payment,
            email_type="receipt",
            recipient_email=recipient or "no-email-provided@rentease.local",
            subject=subject,
            status="pending",
        )
    else:
        email_log.recipient_email = recipient or email_log.recipient_email
        email_log.subject = subject

    if is_retry:
        email_log.retry_count += 1

    if not recipient:
        email_log.status = "failed"
        email_log.error_message = "Tenant has no registered email address."
        email_log.save()
        return email_log

    if not inv_settings:
        email_log.status = "failed"
        email_log.error_message = "Invoice template not configured for this building/landlord."
        email_log.save()
        return email_log

    if payment.status != "paid":
        email_log.status = "failed"
        email_log.error_message = "Receipt can only be emailed after payment is marked as paid."
        email_log.save()
        return email_log

    calc = _calculate_gst_breakdown(payment.amount, tenant.gst_rate)
    paid_date = payment.paid_date or timezone.localdate()
    paid_date_str = paid_date.strftime("%d %b %Y")
    tenant_name = f"{tenant.first_name} {tenant.last_name}".strip() or "Valued Tenant"
    shop_name = tenant.shop_name or f"Unit {unit.unit_number}"
    landlord_name = building.landlord.user.get_full_name() or building.landlord.user.username
    business_name = inv_settings.business_name or landlord_name
    payment_method_str = payment.get_payment_method_display() or payment.payment_method or "Direct Payment"
    billed_month = _get_billed_month(payment.due_date)

    # Plain text content
    text_content = f"""Dear {tenant_name},

Thank you for your payment! Here is your official payment receipt.

--- RECEIPT CONFIRMATION ---
Receipt Number: REC-{payment.id:06d}
Transaction / Ref ID: {txn_ref}
Payment Date: {paid_date_str}
Payment Method: {payment_method_str}

--- PROPERTY DETAILS ---
Commercial Unit: Unit {unit.unit_number} (Floor {floor.floor_number})
Shop / Office / Godown: {shop_name}
Building: {building.name}
Billing Period: {billed_month}

--- PAYMENT BREAKDOWN ---
Base Rent Paid: INR {calc['rent_amount']:.2f}
GST Rate: {calc['gst_rate']}%
CGST: INR {calc['cgst']:.2f}
SGST: INR {calc['sgst']:.2f}
Total GST Paid: INR {calc['gst_total']:.2f}
---------------------------------
TOTAL PAID: INR {calc['grand_total']:.2f}

Your official payment receipt PDF is attached to this email.

Regards,
{business_name}
Managed via RentEase
"""

    # HTML content
    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }}
    .container {{ max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }}
    .header {{ background: #065f46; padding: 28px 32px; color: #ffffff; }}
    .header h1 {{ margin: 0 0 6px 0; font-size: 20px; font-weight: 700; }}
    .header p {{ margin: 0; font-size: 13px; color: #a7f3d0; }}
    .content {{ padding: 32px; }}
    .paid-badge {{ display: inline-block; background: #dcfce7; color: #15803d; font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 9999px; margin-bottom: 16px; }}
    .summary-card {{ background: #f8fafc; border-radius: 8px; padding: 20px; margin-bottom: 24px; border: 1px solid #e2e8f0; }}
    .summary-row {{ display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; }}
    .summary-label {{ color: #64748b; }}
    .summary-value {{ font-weight: 600; color: #0f172a; }}
    .table {{ width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px; }}
    .table th {{ background: #f8fafc; color: #475569; font-weight: 600; text-align: left; padding: 10px 12px; border-bottom: 1px solid #e2e8f0; }}
    .table td {{ padding: 10px 12px; border-bottom: 1px solid #f1f5f9; }}
    .table td.amount {{ text-align: right; font-family: monospace; font-size: 13px; }}
    .total-banner {{ background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; margin: 24px 0; }}
    .total-title {{ font-size: 14px; font-weight: 600; color: #065f46; margin: 0; }}
    .total-amount {{ font-size: 22px; font-weight: 800; color: #047857; margin: 0; }}
    .footer {{ background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 32px; font-size: 12px; color: #64748b; text-align: center; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Payment Receipt</h1>
      <p>{business_name} &bull; Reference: {txn_ref}</p>
    </div>
    <div class="content">
      <div class="paid-badge">&#10003; PAYMENT RECEIVED</div>
      <p style="font-size: 14px; line-height: 1.5; color: #334155; margin-top: 0;">
        Dear <strong>{tenant_name}</strong>, we have received your rent payment for <strong>{billed_month}</strong>.
      </p>

      <div class="summary-card">
        <div class="summary-row"><span class="summary-label">Shop / Office / Godown:</span><span class="summary-value">{shop_name}</span></div>
        <div class="summary-row"><span class="summary-label">Unit / Building:</span><span class="summary-value">Unit {unit.unit_number}, {building.name}</span></div>
        <div class="summary-row"><span class="summary-label">Payment Date:</span><span class="summary-value">{paid_date_str}</span></div>
        <div class="summary-row"><span class="summary-label">Payment Method:</span><span class="summary-value">{payment_method_str}</span></div>
        <div class="summary-row"><span class="summary-label">Transaction ID:</span><span class="summary-value" style="font-family: monospace;">{txn_ref}</span></div>
      </div>

      <table class="table">
        <thead>
          <tr>
            <th>Description</th>
            <th style="text-align: right;">Amount (INR)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Base Rent Received</td>
            <td class="amount">&#8377;{calc['rent_amount']:.2f}</td>
          </tr>
          <tr>
            <td>CGST ({calc['gst_rate'] / Decimal('2')}%)</td>
            <td class="amount">&#8377;{calc['cgst']:.2f}</td>
          </tr>
          <tr>
            <td>SGST ({calc['gst_rate'] / Decimal('2')}%)</td>
            <td class="amount">&#8377;{calc['sgst']:.2f}</td>
          </tr>
        </tbody>
      </table>

      <div class="total-banner">
        <div>
          <p class="total-title">Total Amount Paid</p>
          <span style="font-size: 11px; color: #059669;">Includes GST &#8377;{calc['gst_total']:.2f}</span>
        </div>
        <div class="total-amount">&#8377;{calc['grand_total']:.2f}</div>
      </div>

      <p style="font-size: 12px; color: #64748b; font-style: italic;">
        * An official PDF payment receipt is attached for your records and accounting.
      </p>
    </div>
    <div class="footer">
      Issued by {business_name} via RentEase.<br/>
      Thank you for being a valued tenant.
    </div>
  </div>
</body>
</html>
"""

    try:
        from .views import _receipt_pdf
        pdf_buffer = _receipt_pdf(payment, inv_settings, request=None)
        pdf_bytes = pdf_buffer.getvalue()

        from_email = getattr(django_settings, "DEFAULT_FROM_EMAIL", "billing@rentease.com")
        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_content,
            from_email=from_email,
            to=[recipient],
        )
        msg.attach_alternative(html_content, "text/html")
        msg.attach(
            f"rent-receipt-{payment.id:06d}.pdf",
            pdf_bytes,
            "application/pdf",
        )
        msg.send(fail_silently=False)

        email_log.status = "sent"
        email_log.sent_at = timezone.now()
        email_log.error_message = ""
        email_log.save()
    except Exception as exc:
        email_log.status = "failed"
        email_log.error_message = str(exc)
        email_log.save()

    return email_log


def generate_monthly_invoices(target_date=None, building=None, landlord=None, send_emails=True):
    """
    Automatically generates commercial rent invoices on the 1st of the month
    for active commercial leases, renders PDFs, and emails tenants.
    """
    if target_date is None:
        target_date = timezone.localdate()

    # The due date month is target_date.month and year is target_date.year
    due_month = target_date.month
    due_year = target_date.year

    qs = Lease.objects.filter(
        status="active",
        unit__unit_type="commercial",
    ).select_related(
        "unit",
        "unit__floor",
        "unit__floor__building",
        "unit__floor__building__landlord",
        "tenant",
    )

    if building:
        qs = qs.filter(unit__floor__building=building)
    if landlord:
        qs = qs.filter(unit__floor__building__landlord=landlord)

    results = []
    created_count = 0
    sent_count = 0
    failed_count = 0

    for lease in qs:
        # Check if an invoice already exists for this lease for this month
        existing_payment = Payment.objects.filter(
            lease=lease,
            payment_type="rent",
            due_date__year=due_year,
            due_date__month=due_month,
        ).first()

        inv_settings = InvoiceSettings.objects.filter(
            building=lease.unit.floor.building
        ).first() or InvoiceSettings.objects.filter(
            landlord=lease.unit.floor.building.landlord
        ).first()

        last_day = calendar.monthrange(due_year, due_month)[1]
        due_day = 7
        if inv_settings and inv_settings.due_day:
            due_day = min(int(inv_settings.due_day), last_day)

        due_date = date(due_year, due_month, due_day)

        if not existing_payment:
            payment = Payment.objects.create(
                lease=lease,
                payment_type="rent",
                amount=lease.monthly_rent,
                due_date=due_date,
                status="pending",
            )
            created_count += 1
            is_new = True
        else:
            payment = existing_payment
            is_new = False

        email_status = None
        if send_emails:
            # Check if invoice email was already successfully sent
            already_sent = payment.email_logs.filter(
                email_type="invoice",
                status="sent",
            ).exists()

            if not already_sent:
                log = send_invoice_email(payment)
                email_status = log.status
                if log.status == "sent":
                    sent_count += 1
                else:
                    failed_count += 1
            else:
                email_status = "already_sent"

        results.append({
            "payment_id": payment.id,
            "lease_id": lease.id,
            "tenant_name": str(lease.tenant),
            "unit_number": lease.unit.unit_number,
            "amount": float(payment.amount),
            "due_date": str(payment.due_date),
            "is_new": is_new,
            "email_status": email_status,
        })

    return {
        "target_date": str(target_date),
        "total_active_leases": qs.count(),
        "invoices_created": created_count,
        "emails_sent": sent_count,
        "emails_failed": failed_count,
        "results": results,
    }


def retry_failed_billing_emails(max_retries=3, payment_id=None, email_log_id=None):
    """
    Retries failed billing emails that have not reached max_retries.
    """
    qs = BillingEmailLog.objects.filter(
        status="failed",
        retry_count__lt=max_retries,
    ).select_related("payment", "payment__lease", "payment__lease__tenant")

    if payment_id:
        qs = qs.filter(payment_id=payment_id)
    if email_log_id:
        qs = qs.filter(id=email_log_id)

    total_attempted = 0
    succeeded = 0
    failed = 0

    for log in qs:
        total_attempted += 1
        if log.email_type == "invoice":
            res = send_invoice_email(log.payment, is_retry=True, email_log=log)
        else:
            res = send_receipt_email(log.payment, is_retry=True, email_log=log)

        if res.status == "sent":
            succeeded += 1
        else:
            failed += 1

    return {
        "attempted": total_attempted,
        "succeeded": succeeded,
        "failed": failed,
    }
