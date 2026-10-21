from django.db import models

from core.models import BaseModel


class Client(BaseModel):
    class Status(models.TextChoices):
        NEW = 'NEW', 'New'
        OLD = 'OLD', 'Old'

    name = models.CharField(max_length=255)
    phone = models.CharField(max_length=20)
    email = models.EmailField(blank=True, default='')
    address = models.TextField()
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.NEW, db_index=True)
    notes = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.name
