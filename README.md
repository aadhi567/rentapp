# RentEase

RentEase is a modern property management application designed to help landlords manage their buildings, tenants, rental agreements, rent payments, maintenance requests, reminders, and billing from a single platform.

## Features

### 🏢 Building Management
- Add and manage multiple buildings
- Manage floors and units
- Store building details and locations

### 👥 Tenant Management
- Add and manage tenant information
- Associate tenants with rental agreements
- View tenant-related information

### 📄 Rental Agreements
- Manage rental agreements
- Track agreement details
- Connect rental agreements with tenants and properties

### 💰 Rent & Payments
- Record rental payments
- Edit payment records
- Track payment status
- Track payment methods
- Store transaction/reference IDs
- View payment history

### 🧾 Automated Billing
- Generate monthly invoices
- Support commercial rental billing
- GST calculation support
- Invoice generation workflow
- Tenant invoice notification workflow

### 🔧 Maintenance
- Manage maintenance requests
- Track maintenance status
- Monitor property-related issues

### 🔔 Reminders
- Manage important rental and payment reminders

### 📊 Dashboard & Analytics
- Property portfolio overview
- Occupancy information
- Monthly rent potential
- Payment collection status
- Payment tracking

### ⚙️ Settings
- Application preferences
- User/account settings
- Theme preferences

## Tech Stack

### Frontend
- React
- Vite
- JavaScript
- HTML
- CSS

### Backend
- FastAPI
- Python

### Database
- SQLite during development
- PostgreSQL planned/recommended for production deployment

## Project Structure

```text
RentEase/
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vite.config.js
│
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   └── ...
│
└── README.md
```