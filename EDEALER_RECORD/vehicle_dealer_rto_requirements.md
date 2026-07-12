# Vehicle Dealer & RTO Management System

## Full Requirements Documentation

## 1. Introduction

### 1.1 Purpose

The purpose of this system is to build a multi-tenant SaaS platform that
allows second-hand vehicle dealers and RTO agents to manage the entire
lifecycle of vehicles.

The system will support: - Vehicle inventory management - Repair and job
tracking - RTO transfer tracking - Document management - OCR vehicle
data extraction - Financial accounting and khata book - Agent
collaboration - Marketplace vehicle listings

The platform must be mobile friendly and simple since many dealers may
not be highly technical.

------------------------------------------------------------------------

# 2. System Overview

The platform acts as a central management tool for vehicle dealerships.

Dealers can: - Add vehicles they purchase - Upload vehicle documents and
photos - Track repair and inspection jobs - Assign vehicles to RTO
agents - Record vehicle expenses - Calculate profit - Track ledger
entries between dealer and agents - Sell vehicles - Publish vehicles to
marketplace

Agents can: - Manage RTO transfer processes - Update transfer statuses -
Upload RTO documents

------------------------------------------------------------------------

# 3. System Architecture

The system is designed as a multi-tenant SaaS platform.

Each dealer has isolated data.

Example structure:

Dealer A - Vehicles - Employees - Agents - Jobs - Expenses

Dealer B - Vehicles - Employees - Agents - Jobs - Expenses

Agents may work with multiple dealers simultaneously.

------------------------------------------------------------------------

# 4. User Roles

## Platform Admin

Responsibilities: - Manage dealers - Manage subscriptions - Monitor
system - Manage marketplace

## Dealer Owner

Permissions: - Manage vehicles - Manage employees - Assign agents - View
financial data - Configure workflows

## Dealer Employees

Examples: - Sales manager - Accountant - Document manager - Technician

## Agents

Responsibilities: - Update RTO transfer status - Upload RTO documents -
Manage transfer workflow

------------------------------------------------------------------------

# 5. Vehicle Lifecycle

Typical lifecycle:

Dealer purchases vehicle Vehicle added to system Inspection Repair or
preparation Ready for sale Vehicle sold RTO transfer initiated Transfer
completed

However the workflow must remain flexible.

Possible flows: - Buy → Sell - Buy → Repair → Sell - Buy → Sell → RTO

------------------------------------------------------------------------

# 6. Vehicle Management

Each vehicle record stores:

Vehicle number Make Model Fuel type Engine number Chassis number
Registration date RC validity Owner name Owner address

Purchase information: - Purchase price - Purchase date

Sale information: - Sale price - Sale date - Buyer details

------------------------------------------------------------------------

# 7. OCR Vehicle Entry

When adding a vehicle the dealer may scan the RC book.

Process: 1. Dealer captures RC image 2. OCR extracts data 3. Fields
auto-fill 4. Dealer confirms or edits

Fields extracted: - Vehicle number - Engine number - Chassis number -
Registration date - Owner name

------------------------------------------------------------------------

# 8. Document Management

Vehicles require multiple documents such as: - RC - Insurance - PUC -
Owner ID - NOC - Transfer forms

Dealers may create custom document categories.

Files are stored in object storage while the database stores metadata.

------------------------------------------------------------------------

# 9. Vehicle Photos

Vehicles can have multiple photos including: - Front view - Back view -
Interior - Engine - Side view

Photos are stored in object storage such as AWS S3 or Cloudflare R2.

------------------------------------------------------------------------

# 10. Workflow Engine

The platform supports Jira-like workflows.

Dealers can configure: - Processes - Statuses - Transitions

Example workflow: Inspection → Repair → Ready for Sale → Sold → RTO →
Completed

------------------------------------------------------------------------

# 11. Task Management

Vehicles may have tasks such as: - Inspection - Repair - Document
verification - Cleaning - Transport

Each task includes: - Title - Description - Status - Priority - Assigned
user

------------------------------------------------------------------------

# 12. Subtasks

Tasks may include smaller subtasks.

Example: Task: Repair

Subtasks: - Engine repair - Paint job - Cleaning

------------------------------------------------------------------------

# 13. Tags and Priority

Tasks support tags such as: - urgent - documents - engine

Priority levels: - Low - Medium - High - Urgent

------------------------------------------------------------------------

# 14. RTO Transfer Tracking

Vehicles assigned to agents create an RTO process.

Stages: - Documents collected - Forms submitted - Verification -
Transfer initiated - Transfer completed - RC received

Each change is stored in status history.

------------------------------------------------------------------------

# 15. Vehicle Expenses

Expenses include: - Repair cost - Transport - RTO fees - Agent
commission - Service cost

Expenses are linked to vehicles.

------------------------------------------------------------------------

# 16. Profit Calculation

profit = sale price − purchase price − total expenses

------------------------------------------------------------------------

# 17. Khata Book Ledger

The platform includes a ledger system.

Transactions may occur between: - Dealer and agent - Dealer and vendor -
Dealer and buyer

Each ledger entry records: - Credit or debit - Amount - Description -
Linked vehicle (optional)

------------------------------------------------------------------------

# 18. Marketplace

Dealers may list vehicles publicly.

Listings include: - Vehicle photos - Model - Year - Price - Location -
Dealer contact

Customers contact dealers directly.

------------------------------------------------------------------------

# 19. Activity Timeline

Vehicle actions are logged such as: - Vehicle created - Repair started -
Vehicle sold - RTO assigned - Transfer completed

------------------------------------------------------------------------

# 20. Notification System

Notifications appear when: - Tasks are assigned - Vehicle status
changes - RTO updates occur

------------------------------------------------------------------------

# 21. Audit Logs

Important actions are logged including: - Vehicle creation - Document
uploads - Ledger entries

------------------------------------------------------------------------

# 22. Subscription System

Dealers subscribe to plans.

Plans may limit: - Number of vehicles - Number of employees - Number of
agents

------------------------------------------------------------------------

# 23. Security

Security requirements: - Role-based access control - Secure
authentication - Password hashing - Audit logs

Dealer data must remain isolated.

------------------------------------------------------------------------

# 24. Performance Requirements

The system must support: - Thousands of dealers - Millions of vehicles

Indexes should exist on: - vehicle_number - dealer_id - task_status -
assigned_user

------------------------------------------------------------------------

# 25. Recommended Technology Stack

Frontend: - Next.js - React - TypeScript - Material UI

Backend: - Node.js - NestJS - Prisma ORM

Database: - PostgreSQL

Storage: - AWS S3 or Cloudflare R2

Cache: - Redis

------------------------------------------------------------------------

# 26. Future Enhancements

Possible future improvements: - Mobile apps - WhatsApp notifications -
Document automation - Vehicle auctions - Advanced analytics
