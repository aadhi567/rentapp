from django.contrib.auth import authenticate
from django.contrib.auth.models import User, update_last_login
from django.db import transaction
from rest_framework import exceptions, serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.settings import api_settings

from .models import Landlord, Tenant


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(
        max_length=150,
        required=False,
        allow_blank=True,
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
        if not value:
            return ""

        value = value.strip()

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

        username = (attrs.get("username") or "").strip()
        if not username:
            email = attrs.get("email", "").strip().lower()
            base_username = email.split("@")[0] if "@" in email else "user"
            clean_base = (
                "".join(c for c in base_username if c.isalnum() or c == "_")
                or "user"
            )
            candidate = clean_base
            counter = 1
            while User.objects.filter(username__iexact=candidate).exists():
                candidate = f"{clean_base}_{counter}"
                counter += 1
            attrs["username"] = candidate

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


class EmailOrUsernameTokenObtainPairSerializer(TokenObtainPairSerializer):
    username = serializers.CharField(
        required=False,
        allow_blank=True,
        write_only=True,
    )
    email = serializers.CharField(
        required=False,
        allow_blank=True,
        write_only=True,
    )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields[self.username_field].required = False
        self.fields["email"] = serializers.CharField(
            required=False,
            allow_blank=True,
            write_only=True,
        )

    def validate(self, attrs):
        username_val = attrs.get(self.username_field, "")
        email_val = attrs.get("email", "")

        credential = (email_val or username_val or "").strip()
        password = attrs.get("password")

        if not credential:
            raise serializers.ValidationError({
                "username": "Email or username is required."
            })

        if not password:
            raise serializers.ValidationError({
                "password": "Password is required."
            })

        request = self.context.get("request")
        self.user = authenticate(
            request=request,
            username=credential,
            password=password,
            email=credential,
        )

        if self.user is None:
            raise exceptions.AuthenticationFailed(
                self.error_messages["no_active_account"],
                "no_active_account",
            )

        if not api_settings.USER_AUTHENTICATION_RULE(self.user):
            raise exceptions.AuthenticationFailed(
                self.error_messages["no_active_account"],
                "no_active_account",
            )

        refresh = self.get_token(self.user)

        data = {
            "refresh": str(refresh),
            "access": str(refresh.access_token),
        }

        if hasattr(self.user, "landlord_profile"):
            role = "landlord"
        elif hasattr(self.user, "tenant_profile"):
            role = "tenant"
        else:
            role = None

        data["user"] = {
            "id": self.user.id,
            "username": self.user.username,
            "email": self.user.email,
            "first_name": self.user.first_name,
            "last_name": self.user.last_name,
            "role": role,
        }

        if api_settings.UPDATE_LAST_LOGIN:
            update_last_login(None, self.user)

        return data