from rest_framework import status
from rest_framework.response import Response


def success_response(data=None, message='Success', status_code=status.HTTP_200_OK):
    return Response(
        {'success': True, 'message': message, 'data': data, 'errors': None},
        status=status_code,
    )
