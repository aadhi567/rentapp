from rest_framework import serializers
from .models import Property


class PropertySerializer(serializers.ModelSerializer):
    owner_name = serializers.CharField(
        source='owner.username',
        read_only=True
    )

    class Meta:
        model = Property
        fields = [
            'id',
            'title',
            'description',
            'property_type',
            'owner',
            'owner_name',
            'rent',
            'bedrooms',
            'bathrooms',
            'area',
            'address',
            'city',
            'state',
            'pincode',
            'furnished',
            'available',
            'created_at',
            'updated_at',
        ]

        read_only_fields = [
            'id',
            'created_at',
            'updated_at',
        ]