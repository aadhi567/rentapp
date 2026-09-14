from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.static import serve

from rest_framework_simplejwt.views import (
    TokenRefreshView,
)

from properties.auth_views import (
    RegisterView,
    CurrentUserView,
    RentEaseTokenObtainPairView,
    LandlordLoginView,
    CheckEmailView,
    GoogleLoginView,
    SystemAccountsView,
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
        "api/auth/system-accounts/",
        SystemAccountsView.as_view(),
        name="system_accounts",
    ),

    path(
        "api/auth/check-email/",
        CheckEmailView.as_view(),
        name="check_email",
    ),

    path(
        "api/auth/google/",
        GoogleLoginView.as_view(),
        name="google_login",
    ),

    path(
        "api/auth/register/",
        RegisterView.as_view(),
        name="register",
    ),

    path(
        "api/auth/login/",
        RentEaseTokenObtainPairView.as_view(),
        name="token_obtain_pair",
    ),

    path(
        "api/auth/landlord-login/",
        LandlordLoginView.as_view(),
        name="landlord_login",
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


# Serve uploaded media files
if settings.DEBUG:
    urlpatterns += static(
        settings.MEDIA_URL,
        document_root=settings.MEDIA_ROOT,
    )
else:
    urlpatterns += [
        re_path(r"^media/(?P<path>.*)$", serve, {"document_root": settings.MEDIA_ROOT}),
    ]