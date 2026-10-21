"""Single backend source of truth for permission codenames and the roles that hold them.

Mirrors `src/config/permissions.js` in the frontend. Check codenames, never role names.
"""
from rest_framework.permissions import BasePermission

from .models import User

A, M, S, W, C = (
    User.Role.ADMIN,
    User.Role.MANAGER,
    User.Role.SITE_SUPERVISOR,
    User.Role.SITE_WORKER,
    User.Role.CLIENT,
)

PERMISSION_MATRIX = {
    'users.manage': [A],
    'roles.change': [A],
    'settings.stageTemplate': [A],
    'clients.view': [A, M],
    'clients.manage': [A, M],
    'clients.import': [A, M],
    'projects.viewAll': [A, M],
    'projects.viewAssigned': [S, W],
    'projects.viewOwn': [C],
    'projects.create': [A, M],
    'projects.assignPeople': [A, M],
    'agencies.manage': [A, M],
    'stages.editDates': [A, M],
    'stages.updateStatus': [A, M, S],
    'stages.editProjectStages': [A, M],
    'attendance.markOwn': [A, M, S, W],
    'attendance.viewBoard': [A, M],
    'attendance.correct': [A, M],
    'geofence.manage': [A, M],
    'tasks.create': [A, M, S],
    'tasks.updateOwn': [A, M, S, W],
    'tasks.viewAll': [A, M],
    'dsr.submit': [A, M, S, W],
    'dsr.viewAll': [A, M],
    'dsr.manageClientLink': [A, M],
    'payments.client.manage': [A, M],
    'payments.client.viewOwn': [C],
    'payments.labour.manage': [A, M],
    'leave.apply': [A, M, S, W],
    'leave.approve': [A, M],
    'payslips.viewOwn': [A, M, S, W],
    'files.gallery': [A, M],
    'reports.view': [A, M],
    'reports.profitLoss': [A],
    'leads.manage': [A, M],
    'feedback.submit': [C],
}


def user_has_permission(user, codename):
    """The one place that decides access. Superusers bypass."""
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    return user.role in PERMISSION_MATRIX.get(codename, [])


def permissions_for_user(user):
    return sorted(code for code in PERMISSION_MATRIX if user_has_permission(user, code))


class HasPermission(BasePermission):
    """Use on a view: `permission_classes = [IsAuthenticated, HasPermission]` with
    `required_permission = 'clients.view'`."""

    def has_permission(self, request, view):
        codename = getattr(view, 'required_permission', None)
        return bool(codename) and user_has_permission(request.user, codename)
