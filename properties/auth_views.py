from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import Landlord, Tenant
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

    def get(self, request):
        user = request.user

        role = None

        if hasattr(user, "landlord_profile"):
            role = "landlord"

        elif hasattr(user, "tenant_profile"):
            role = "tenant"

        return Response({
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "role": role,
        })


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



