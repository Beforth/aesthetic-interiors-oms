import logging

from django.core.exceptions import PermissionDenied
from django.http import Http404
from rest_framework import status
from rest_framework.exceptions import APIException, ValidationError
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)


class ConflictError(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = 'Conflict.'
    default_code = 'conflict'


def _first_message(errors):
    """Build a short sentence from DRF errors, naming the field when known."""
    if isinstance(errors, dict):
        for field, detail in errors.items():
            msg = _first_message(detail)
            if field in ('detail', 'non_field_errors'):
                return msg
            return f"{field.replace('_', ' ').capitalize()} - {msg}"
    if isinstance(errors, (list, tuple)) and errors:
        return _first_message(errors[0])
    return str(errors)


def _envelope(message, errors, status_code):
    return Response(
        {'success': False, 'message': message, 'data': None, 'errors': errors},
        status=status_code,
    )


def custom_exception_handler(exc, context):
    if isinstance(exc, Http404):
        return _envelope('Not found.', None, status.HTTP_404_NOT_FOUND)
    if isinstance(exc, PermissionDenied):
        return _envelope('You do not have permission to perform this action.', None, status.HTTP_403_FORBIDDEN)

    response = exception_handler(exc, context)
    if response is None:
        logger.exception('Unhandled API error', exc_info=exc)
        return _envelope('Something went wrong.', None, status.HTTP_500_INTERNAL_SERVER_ERROR)

    if isinstance(exc, ValidationError):
        return _envelope(_first_message(response.data), response.data, response.status_code)

    detail = response.data.get('detail') if isinstance(response.data, dict) else None
    return _envelope(str(detail or _first_message(response.data)), None, response.status_code)
