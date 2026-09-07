from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .auth_serializers import RegisterSerializer


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