import re
from django.contrib.auth import password_validation
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import Landlord, Tenant, NotificationPreference
from .serializers import NotificationPreferenceSerializer
from .auth_serializers import (
    RegisterSerializer,
    EmailOrUsernameTokenObtainPairSerializer,
)


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(
            data=request.data
        )

        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST
            )

        user = serializer.save()

        if hasattr(user, "landlord_profile"):
            role = "landlord"
        elif hasattr(user, "tenant_profile"):
            role = "tenant"
        else:
            role = None

        return Response(
            {
                "message": "Account created successfully.",
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "role": role,
                },
            },
            status=status.HTTP_201_CREATED
        )


class CurrentUserView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        user = request.user

        role = None
        must_change_password = False
        tenant_id = None
        phone = ""
        avatar_url = None
        theme = "system"

        if hasattr(user, "landlord_profile"):
            role = "landlord"
            landlord = user.landlord_profile
            phone = landlord.phone or ""
            if landlord.avatar and hasattr(landlord.avatar, "url"):
                avatar_url = request.build_absolute_uri(landlord.avatar.url)
            pref, _ = NotificationPreference.objects.get_or_create(landlord=landlord)
            theme = pref.theme

        elif hasattr(user, "tenant_profile"):
            role = "tenant"
            must_change_password = getattr(user.tenant_profile, "must_change_password", False)
            tenant_id = user.tenant_profile.id
            phone = user.tenant_profile.phone or ""

        return Response({
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "full_name": f"{user.first_name} {user.last_name}".strip() or user.username,
            "role": role,
            "phone": phone,
            "avatar_url": avatar_url,
            "theme": theme,
            "must_change_password": must_change_password,
            "tenant_id": tenant_id,
        })

    def patch(self, request):
        user = request.user
        if not hasattr(user, "landlord_profile"):
            return Response(
                {"detail": "Profile editing is only enabled for landlord accounts."},
                status=status.HTTP_403_FORBIDDEN,
            )

        landlord = user.landlord_profile

        # Update full name if provided
        if "full_name" in request.data:
            full_name = (request.data.get("full_name") or "").strip()
            if not full_name:
                return Response(
                    {"detail": "Full name cannot be empty."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            parts = full_name.split(None, 1)
            user.first_name = parts[0]
            user.last_name = parts[1] if len(parts) > 1 else ""

        # Update email if provided
        if "email" in request.data:
            email = (request.data.get("email") or "").strip().lower()
            if not email or "@" not in email or "." not in email:
                return Response(
                    {"detail": "Please enter a valid email address."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if User.objects.filter(email__iexact=email).exclude(id=user.id).exists():
                return Response(
                    {"detail": "An account with this email address already exists."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            user.email = email

        # Update phone if provided
        if "phone" in request.data:
            phone = (request.data.get("phone") or "").strip()
            if phone and not re.match(r"^\+?[0-9]{10,15}$", phone):
                return Response(
                    {"detail": "Phone number must contain 10 to 15 digits."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            landlord.phone = phone

        # Handle avatar photo upload
        if "avatar" in request.FILES:
            landlord.avatar = request.FILES["avatar"]
        elif "avatar" in request.data and (request.data["avatar"] == "" or request.data["avatar"] is None):
            if landlord.avatar:
                landlord.avatar.delete(save=False)
            landlord.avatar = None

        user.save()
        landlord.save()

        avatar_url = None
        if landlord.avatar and hasattr(landlord.avatar, "url"):
            avatar_url = request.build_absolute_uri(landlord.avatar.url)

        pref, _ = NotificationPreference.objects.get_or_create(landlord=landlord)

        return Response({
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "full_name": f"{user.first_name} {user.last_name}".strip() or user.username,
            "role": "landlord",
            "phone": landlord.phone or "",
            "avatar_url": avatar_url,
            "theme": pref.theme,
            "must_change_password": False,
            "tenant_id": None,
            "message": "Profile updated successfully.",
        }, status=status.HTTP_200_OK)

    def put(self, request):
        return self.patch(request)


class NotificationPreferenceView(APIView):
    """
    Manages landlord notification preferences and theme settings.
    Ensures a landlord can only view and update their own preferences.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not hasattr(request.user, "landlord_profile"):
            return Response(
                {"detail": "Only landlords have notification preferences."},
                status=status.HTTP_403_FORBIDDEN,
            )
        pref, _ = NotificationPreference.objects.get_or_create(
            landlord=request.user.landlord_profile
        )
        serializer = NotificationPreferenceSerializer(pref)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request):
        if not hasattr(request.user, "landlord_profile"):
            return Response(
                {"detail": "Only landlords have notification preferences."},
                status=status.HTTP_403_FORBIDDEN,
            )
        pref, _ = NotificationPreference.objects.get_or_create(
            landlord=request.user.landlord_profile
        )
        serializer = NotificationPreferenceSerializer(
            pref, data=request.data, partial=True
        )
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def put(self, request):
        return self.patch(request)


class RentEaseTokenObtainPairView(TokenObtainPairView):
    """
    Takes credentials (email or username, and password) and returns
    access and refresh JWT tokens.
    """

    permission_classes = [AllowAny]
    serializer_class = EmailOrUsernameTokenObtainPairSerializer


class LandlordLoginView(TokenObtainPairView):
    """
    Specialized login endpoint for landlords. Authenticates using email
    or username and verifies that the account possesses a Landlord profile.
    """

    permission_classes = [AllowAny]
    serializer_class = EmailOrUsernameTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)

        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as e:
            raise InvalidToken(e.args[0])

        user = serializer.user
        if not hasattr(user, "landlord_profile"):
            return Response(
                {"detail": "Access restricted to landlord accounts only."},
                status=status.HTTP_403_FORBIDDEN,
            )

        return Response(serializer.validated_data, status=status.HTTP_200_OK)


class TenantLoginView(TokenObtainPairView):
    """
    Specialized login endpoint for tenants. Authenticates using email
    or username and verifies that the account possesses a Tenant profile.
    Denies access to landlords.
    """

    permission_classes = [AllowAny]
    serializer_class = EmailOrUsernameTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)

        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as e:
            raise InvalidToken(e.args[0])

        user = serializer.user
        if not hasattr(user, "tenant_profile"):
            return Response(
                {"detail": "Access restricted to tenant accounts only. Landlords should sign in at the landlord portal."},
                status=status.HTTP_403_FORBIDDEN,
            )

        data = dict(serializer.validated_data)
        if hasattr(user, "tenant_profile"):
            data["user"]["must_change_password"] = getattr(user.tenant_profile, "must_change_password", False)
            data["user"]["tenant_id"] = user.tenant_profile.id

        return Response(data, status=status.HTTP_200_OK)


class ChangePasswordView(APIView):
    """
    Allows authenticated users (especially tenants after first login)
    to safely update their password.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        old_password = request.data.get("old_password", "")
        new_password = (request.data.get("new_password") or "").strip()
        confirm_password = (request.data.get("confirm_password") or "").strip()

        if not new_password:
            return Response(
                {"detail": "New password is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(new_password) < 8:
            return Response(
                {"detail": "Password must be at least 8 characters long."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if confirm_password and new_password != confirm_password:
            return Response(
                {"detail": "New passwords do not match."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Check old password if provided or if not in forced change mode
        is_first_login = hasattr(user, "tenant_profile") and getattr(user.tenant_profile, "must_change_password", False)
        if user.has_usable_password():
            if old_password and not user.check_password(old_password):
                return Response(
                    {"detail": "Current password is incorrect."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            elif not old_password and not is_first_login:
                return Response(
                    {"detail": "Current password is required."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        try:
            password_validation.validate_password(new_password, user)
        except ValidationError as err:
            return Response(
                {"detail": list(err.messages)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(new_password)
        user.save()

        if hasattr(user, "tenant_profile"):
            user.tenant_profile.must_change_password = False
            user.tenant_profile.save()

        return Response(
            {"detail": "Password updated successfully."},
            status=status.HTTP_200_OK,
        )


class CheckEmailView(APIView):
    """
    Checks whether an email or username is already registered in RentEase.
    Supports email-first login/signup flows.
    """

    permission_classes = [AllowAny]

    def post(self, request):
        email_or_username = (
            request.data.get("email") or request.data.get("username") or ""
        ).strip()

        if not email_or_username:
            return Response(
                {"detail": "Please enter an email address."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = None
        if "@" in email_or_username:
            user = (
                User.objects.filter(email__iexact=email_or_username)
                .exclude(email="")
                .first()
            )

        if not user:
            user = User.objects.filter(username__iexact=email_or_username).first()

        if not user and "@" not in email_or_username:
            user = (
                User.objects.filter(email__iexact=email_or_username)
                .exclude(email="")
                .first()
            )

        if user:
            role = (
                "landlord"
                if hasattr(user, "landlord_profile")
                else ("tenant" if hasattr(user, "tenant_profile") else None)
            )
            return Response({
                "exists": True,
                "email": user.email or user.username,
                "username": user.username,
                "first_name": user.first_name,
                "role": role,
            })

        return Response({
            "exists": False,
            "email": email_or_username,
        })


class GoogleLoginView(APIView):
    """
    Authenticates a user via Google Sign-In.
    Finds or creates a landlord account with the Google email and issues JWT tokens.
    """

    permission_classes = [AllowAny]

    def post(self, request):
        email = (request.data.get("email") or "").strip().lower()
        name = (request.data.get("name") or "").strip()
        role = request.data.get("role") or "landlord"

        if not email:
            return Response(
                {"detail": "Email is required for Google Sign-In."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = User.objects.filter(email__iexact=email).first()

        if not user:
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

            first_name = name.split()[0] if name else clean_base.capitalize()
            last_name = (
                " ".join(name.split()[1:])
                if name and len(name.split()) > 1
                else ""
            )

            user = User.objects.create_user(
                username=candidate,
                email=email,
                first_name=first_name,
                last_name=last_name,
            )
            user.set_unusable_password()
            user.save()

            if role == "tenant":
                Tenant.objects.create(
                    user=user,
                    first_name=first_name,
                    last_name=last_name,
                    email=email,
                )
            else:
                Landlord.objects.create(user=user)

        if not hasattr(user, "landlord_profile") and not hasattr(user, "tenant_profile"):
            Landlord.objects.create(user=user)

        refresh = RefreshToken.for_user(user)

        user_role = (
            "landlord"
            if hasattr(user, "landlord_profile")
            else ("tenant" if hasattr(user, "tenant_profile") else None)
        )

        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "role": user_role,
                },
            },
            status=status.HTTP_200_OK,
        )


class SystemAccountsView(APIView):
    """
    Returns all mail IDs registered in the system.
    """

    permission_classes = [AllowAny]

    def get(self, request):
        users = User.objects.exclude(email="").order_by("-id")
        seen_emails = set()
        accounts = []
        for u in users:
            clean_email = u.email.strip().lower()
            if clean_email and clean_email not in seen_emails:
                seen_emails.add(clean_email)
                accounts.append(
                    {
                        "id": u.id,
                        "email": u.email.strip(),
                    }
                )
        return Response(accounts, status=status.HTTP_200_OK)



