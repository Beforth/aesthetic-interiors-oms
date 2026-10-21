from django.contrib.auth import authenticate
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.tokens import RefreshToken

from .permissions import permissions_for_user


def issue_tokens(user):
    refresh = RefreshToken.for_user(user)
    return {'access': str(refresh.access_token), 'refresh': str(refresh)}


def login(email, password):
    user = authenticate(email=email, password=password)
    if user is None or not user.is_active:
        raise AuthenticationFailed('Invalid email or password.')
    return user, issue_tokens(user)


def get_permissions(user):
    return permissions_for_user(user)
