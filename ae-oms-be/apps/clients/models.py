from django.db import models

class Client(models.Model):
    class ClientStatus(models.TextChoices):
        NEW = 'NEW', 'New'
        OLD = 'OLD', 'Old'

    name = models.CharField(max_length=255)
    phone = models.CharField(max_length=20)
    email = models.EmailField(blank=True, null=True)
    address = models.TextField()
    status = models.CharField(max_length=10, choices=ClientStatus.choices, default=ClientStatus.NEW)
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name