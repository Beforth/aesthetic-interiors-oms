from django.urls import path

from .views import LoginView, PermissionsView

urlpatterns = [
    path('login/', LoginView.as_view(), name='accounts-login'),
    path('permissions/', PermissionsView.as_view(), name='accounts-permissions'),
]
