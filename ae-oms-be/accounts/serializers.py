from rest_framework import serializers

from .models import User


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)


class UserSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'email', 'name', 'first_name', 'last_name', 'phone', 'role', 'is_active']
        read_only_fields = fields

    def get_name(self, obj):
        return obj.get_full_name() or obj.email
