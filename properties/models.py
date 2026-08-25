from django.db import models
from django.contrib.auth.models import User


class Property(models.Model):

    PROPERTY_TYPES = [
        ('apartment', 'Apartment'),
        ('house', 'House'),
        ('room', 'Room'),
        ('office', 'Office'),
        ('shop', 'Shop'),
    ]

    title = models.CharField(max_length=200)

    description = models.TextField()

    property_type = models.CharField(
        max_length=20,
        choices=PROPERTY_TYPES
    )

    owner = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='properties'
    )

    rent = models.DecimalField(
        max_digits=10,
        decimal_places=2
    )

    bedrooms = models.PositiveIntegerField(default=0)

    bathrooms = models.PositiveIntegerField(default=0)

    area = models.PositiveIntegerField(
        help_text="Area in square feet"
    )

    address = models.CharField(max_length=300)

    city = models.CharField(max_length=100)

    state = models.CharField(max_length=100)

    pincode = models.CharField(max_length=10)

    furnished = models.BooleanField(default=False)

    available = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)

    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title