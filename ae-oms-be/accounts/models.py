from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models

from core.models import BaseModel, SoftDeleteQuerySet


class UserManager(BaseUserManager.from_queryset(SoftDeleteQuerySet)):
    """Default manager: hides soft-deleted users, so they can no longer authenticate."""

    use_in_migrations = True

    def get_queryset(self):
        return super().get_queryset().filter(is_deleted=False)

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('The Email field must be set')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', User.Role.ADMIN)
        return self.create_user(email, password, **extra_fields)


class User(BaseModel, AbstractUser):
    class Role(models.TextChoices):
        ADMIN = 'ADMIN', 'Admin'
        MANAGER = 'MANAGER', 'Manager'
        SITE_SUPERVISOR = 'SITE_SUPERVISOR', 'Site Supervisor'
        SITE_WORKER = 'SITE_WORKER', 'Site Worker'
        CLIENT = 'CLIENT', 'Client'

    username = None  # Log in with email instead of username
    # Stays globally unique even after soft delete: USERNAME_FIELD must be unique.
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.SITE_WORKER)
    phone = models.CharField(max_length=15, blank=True, default='')

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['first_name', 'last_name']

    objects = UserManager()
    all_objects = models.Manager()

    def __str__(self):
        return f'{self.email} ({self.role})'
