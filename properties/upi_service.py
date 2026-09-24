import re
import urllib.parse
from decimal import Decimal
from django.core.exceptions import ValidationError
from django.utils import timezone


UPI_ID_REGEX = re.compile(r"^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z0-9.\-_]{2,64}$")
UTR_REGEX = re.compile(r"^[a-zA-Z0-9]{6,40}$")


def validate_upi_id(value):
    """Validate that a string conforms to the UPI Virtual Payment Address (VPA) format."""
    if not value:
        return
    cleaned = value.strip()
    if not UPI_ID_REGEX.match(cleaned):
        raise ValidationError(
            f"'{value}' is not a valid UPI ID (e.g., name@upi, 9876543210@paytm, merchant@okhdfcbank)."
        )


def validate_utr(value):
    """Validate that a string conforms to a bank transaction reference or UTR."""
    if not value:
        raise ValidationError("UTR or Transaction Reference cannot be empty.")
    cleaned = value.strip()
    if not UTR_REGEX.match(cleaned):
        raise ValidationError(
            "Invalid UTR/reference number. Must be between 6 and 40 alphanumeric characters."
        )
    return cleaned


def generate_transaction_reference(prefix="RENT"):
    """
    Generate a unique, human-readable transaction reference.
    Example: RENT-20260923-A1B2C3
    """
    import uuid
    today_str = timezone.now().strftime("%Y%m%d")
    random_suffix = uuid.uuid4().hex[:6].upper()
    return f"{prefix}-{today_str}-{random_suffix}"


def build_upi_intent_uri(upi_id, payee_name, amount, transaction_ref, note=None):
    """
    Construct a standard NPCI UPI Intent URI for deep linking and QR generation.
    Structure:
    upi://pay?pa=<UPI_ID>&pn=<PAYEE_NAME>&am=<AMOUNT>&cu=INR&tr=<REF>&tn=<NOTE>
    """
    if not upi_id:
        raise ValueError("Payee UPI ID is required to generate UPI URI.")

    # Format amount strictly to 2 decimal places
    amount_str = f"{Decimal(str(amount)):.2f}"
    cleaned_payee = (payee_name or "Landlord").strip()
    cleaned_note = (note or f"Rent payment {transaction_ref}").strip()

    params = {
        "pa": upi_id.strip(),
        "pn": cleaned_payee,
        "am": amount_str,
        "cu": "INR",
        "tr": transaction_ref,
        "tn": cleaned_note,
    }

    # URL-encode query string
    query_string = urllib.parse.urlencode(params, quote_via=urllib.parse.quote)
    return f"upi://pay?{query_string}"
