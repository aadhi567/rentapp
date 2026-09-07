from django.contrib.auth.models import User
from django.db import transaction
from rest_framework import serializers

from .models import Landlord, Tenant


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(
        max_length=150
    )

    email = serializers.EmailField()

    password = serializers.CharField(
        write_only=True,
        min_length=8
    )

    confirm_password = serializers.CharField(
        write_only=True
    )

    first_name = serializers.CharField(
        max_length=150
    )

    last_name = serializers.CharField(
        max_length=150,
        required=False,
        allow_blank=True
    )

    phone = serializers.CharField(
        max_length=15,
        required=False,
        allow_blank=True
    )

    role = serializers.ChoiceField(
        choices=[
            ("landlord", "Landlord"),
            ("tenant", "Tenant"),
        ]
    )

    emergency_contact = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True
    )

    emergency_phone = serializers.CharField(
        max_length=15,
        required=False,
        allow_blank=True
    )

    def validate_username(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError(
                "Username cannot be empty."
            )

        if User.objects.filter(
            username__iexact=value
        ).exists():
            raise serializers.ValidationError(
                "This username is already taken."
            )

        return value

    def validate_email(self, value):
        value = value.strip().lower()

        if User.objects.filter(
            email__iexact=value
        ).exists():
            raise serializers.ValidationError(
                "An account with this email already exists."
            )

        return value

    def validate(self, attrs):
        if attrs["password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({
                "confirm_password": "Passwords do not match."
            })

        return attrs

    @transaction.atomic
    def create(self, validated_data):
        role = validated_data["role"]

        emergency_contact = validated_data.pop(
            "emergency_contact",
            ""
        )

        emergency_phone = validated_data.pop(
            "emergency_phone",
            ""
        )

        validated_data.pop("confirm_password")

        password = validated_data.pop("password")

        phone = validated_data.pop(
            "phone",
            ""
        )

        user = User.objects.create_user(
            username=validated_data["username"],
            email=validated_data["email"],
            password=password,
            first_name=validated_data["first_name"],
            last_name=validated_data.get(
                "last_name",
                ""
            ),
        )

        if role == "landlord":
            Landlord.objects.create(
                user=user,
                phone=phone,
            )

        else:
            Tenant.objects.create(
                user=user,
                phone=phone,
                emergency_contact=emergency_contact,
                emergency_phone=emergency_phone,
            )

        return user