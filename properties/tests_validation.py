from django.test import TestCase
from properties.auth_serializers import RegisterSerializer
from properties.serializers import (
    BuildingSerializer,
    InvoiceSettingsSerializer,
    UnitSerializer,
    TenantSerializer,
)


class InputValidationTests(TestCase):
    def test_register_serializer_alphabetic_names(self):
        # Invalid first_name with numbers
        serializer = RegisterSerializer(data={
            "first_name": "John123",
            "last_name": "Doe",
            "email": "valid1@example.com",
            "password": "Password123!",
            "confirm_password": "Password123!",
            "role": "landlord",
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn("first_name", serializer.errors)

        # Invalid last_name with symbols
        serializer = RegisterSerializer(data={
            "first_name": "John",
            "last_name": "Doe@#$",
            "email": "valid2@example.com",
            "password": "Password123!",
            "confirm_password": "Password123!",
            "role": "landlord",
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn("last_name", serializer.errors)

        # Valid names with spaces/hyphens
        serializer = RegisterSerializer(data={
            "first_name": "Mary Jane",
            "last_name": "Smith-Doe",
            "email": "valid3@example.com",
            "password": "Password123!",
            "confirm_password": "Password123!",
            "role": "landlord",
            "phone": "9876543210",
        })
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_register_serializer_phone_number(self):
        # Invalid phone with letters
        serializer = RegisterSerializer(data={
            "first_name": "John",
            "last_name": "Doe",
            "email": "valid4@example.com",
            "phone": "98765abc10",
            "password": "Password123!",
            "confirm_password": "Password123!",
            "role": "landlord",
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn("phone", serializer.errors)

        # Invalid phone with fewer than 10 digits
        serializer = RegisterSerializer(data={
            "first_name": "John",
            "last_name": "Doe",
            "email": "valid5@example.com",
            "phone": "12345",
            "password": "Password123!",
            "confirm_password": "Password123!",
            "role": "landlord",
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn("phone", serializer.errors)

    def test_building_serializer_validation(self):
        # Invalid city with numbers
        serializer = BuildingSerializer(data={
            "name": "Tower A",
            "address": "12 Main St",
            "city": "Chennai123",
            "state": "Tamil Nadu",
            "pincode": "600001",
            "number_of_floors": 3,
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn("city", serializer.errors)

        # Invalid state with numbers
        serializer = BuildingSerializer(data={
            "name": "Tower A",
            "address": "12 Main St",
            "city": "Chennai",
            "state": "State 99",
            "pincode": "600001",
            "number_of_floors": 3,
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn("state", serializer.errors)

        # Invalid pincode with letters or wrong length
        serializer = BuildingSerializer(data={
            "name": "Tower A",
            "address": "12 Main St",
            "city": "Chennai",
            "state": "Tamil Nadu",
            "pincode": "6000A1",
            "number_of_floors": 3,
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn("pincode", serializer.errors)

        serializer_short_pin = BuildingSerializer(data={
            "name": "Tower A",
            "address": "12 Main St",
            "city": "Chennai",
            "state": "Tamil Nadu",
            "pincode": "6000",
            "number_of_floors": 3,
        })
        self.assertFalse(serializer_short_pin.is_valid())
        self.assertIn("pincode", serializer_short_pin.errors)

        # Invalid number of floors <= 0
        serializer_floors = BuildingSerializer(data={
            "name": "Tower A",
            "address": "12 Main St",
            "city": "Chennai",
            "state": "Tamil Nadu",
            "pincode": "600001",
            "number_of_floors": 0,
        })
        self.assertFalse(serializer_floors.is_valid())
        self.assertIn("number_of_floors", serializer_floors.errors)

        # Valid building
        serializer_valid = BuildingSerializer(data={
            "name": "Tower A",
            "address": "12 Main St",
            "city": "Chennai",
            "state": "Tamil Nadu",
            "pincode": "600001",
            "number_of_floors": 4,
        })
        self.assertTrue(serializer_valid.is_valid(), serializer_valid.errors)

    def test_invoice_settings_validation(self):
        # Invalid bank account number with letters
        serializer = InvoiceSettingsSerializer(data={
            "business_name": "Acme Rentals",
            "account_number": "1234ABC5678",
            "city": "Chennai",
            "state": "Tamil Nadu",
            "pincode": "600001",
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn("account_number", serializer.errors)

        # Invalid IFSC format
        serializer = InvoiceSettingsSerializer(data={
            "business_name": "Acme Rentals",
            "account_number": "123456789012",
            "ifsc": "HDFC123",
            "city": "Chennai",
            "state": "Tamil Nadu",
            "pincode": "600001",
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn("ifsc", serializer.errors)

        # Invalid due_day
        serializer = InvoiceSettingsSerializer(data={
            "business_name": "Acme Rentals",
            "due_day": 35,
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn("due_day", serializer.errors)

        # Valid invoice settings
        serializer = InvoiceSettingsSerializer(data={
            "business_name": "Acme Rentals",
            "account_number": "123456789012",
            "ifsc": "HDFC0001234",
            "city": "Chennai",
            "state": "Tamil Nadu",
            "pincode": "600001",
            "phone": "9876543210",
            "due_day": 5,
        })
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_unit_serializer_validation(self):
        # Negative monthly rent
        serializer = UnitSerializer(data={
            "unit_number": "101",
            "name": "Flat 101",
            "monthly_rent": -500,
            "area": 850,
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn("monthly_rent", serializer.errors)

        # Negative area
        serializer = UnitSerializer(data={
            "unit_number": "101",
            "name": "Flat 101",
            "monthly_rent": 15000,
            "area": -10,
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn("area", serializer.errors)

    def test_tenant_serializer_validation(self):
        # Invalid first_name with numbers
        serializer = TenantSerializer(data={
            "first_name": "Tenant123",
            "last_name": "Doe",
            "phone": "9876543210",
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn("first_name", serializer.errors)

        # Invalid phone with letters
        serializer = TenantSerializer(data={
            "first_name": "John",
            "last_name": "Doe",
            "phone": "98765abc10",
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn("phone", serializer.errors)

        # Valid tenant
        serializer = TenantSerializer(data={
            "first_name": "Ravi",
            "last_name": "Kumar",
            "phone": "9876543210",
            "email": "ravi@example.com",
        })
        self.assertTrue(serializer.is_valid(), serializer.errors)
