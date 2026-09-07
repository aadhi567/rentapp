from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

from properties.auth_views import (
    RegisterView,
    CurrentUserView,
)


urlpatterns = [
    # Django Admin
    path(
        "admin/",
        admin.site.urls,
    ),

    # RentEase API
    path(
        "api/",
        include("properties.urls"),
    ),

    # Authentication
    path(
        "api/auth/register/",
        RegisterView.as_view(),
        name="register",
    ),

    path(
        "api/auth/login/",
        TokenObtainPairView.as_view(),
        name="token_obtain_pair",
    ),

    path(
        "api/auth/refresh/",
        TokenRefreshView.as_view(),
        name="token_refresh",
    ),

    path(
        "api/auth/me/",
        CurrentUserView.as_view(),
        name="current_user",
    ),
]


# Serve uploaded files during development
if settings.DEBUG:
    urlpatterns += static(
        settings.MEDIA_URL,
        document_root=settings.MEDIA_ROOT,
    )