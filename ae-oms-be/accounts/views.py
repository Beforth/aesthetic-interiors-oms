from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from core.responses import success_response

from . import services
from .serializers import LoginSerializer, UserSerializer


class LoginView(APIView):
    """POST /api/v1/accounts/login/ — public. Tokens + user only; permissions come from /permissions/."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request, *args, **kwargs):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user, tokens = services.login(**serializer.validated_data)
        return success_response(
            data={**tokens, 'user': UserSerializer(user).data},
            message='Logged in',
        )


class PermissionsView(APIView):
    """GET /api/v1/accounts/permissions/ — any authenticated user (their own permissions)."""

    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        return success_response(data={'permissions': services.get_permissions(request.user)})
