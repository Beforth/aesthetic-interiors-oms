from django.contrib import admin

from .models import Client


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ['name', 'phone', 'email', 'status', 'is_deleted']
    list_filter = ['status', 'is_deleted']
    search_fields = ['name', 'phone', 'email']

    def get_queryset(self, request):
        return self.model.all_objects.all()
