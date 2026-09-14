from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend

User = get_user_model()


class EmailOrUsernameModelBackend(ModelBackend):
    """
    Authenticates against settings.AUTH_USER_MODEL using either
    email or username case-insensitively.
    """

    def authenticate(self, request, username=None, password=None, **kwargs):
        email = kwargs.get("email")
        credential = username or email

        if not credential or not password:
            return None

        credential = str(credential).strip()

        user = None
        if "@" in credential:
            user = (
                User.objects.filter(email__iexact=credential)
                .exclude(email="")
                .first()
            )

        if not user:
            user = User.objects.filter(username__iexact=credential).first()

        if not user and "@" not in credential:
            user = (
                User.objects.filter(email__iexact=credential)
                .exclude(email="")
                .first()
            )

        if (
            user
            and user.check_password(password)
            and self.user_can_authenticate(user)
        ):
            return user

        return None
