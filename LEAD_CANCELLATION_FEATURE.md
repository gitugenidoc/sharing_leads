# Lead Cancellation Feature

## Overview

This feature allows agents and admins to temporarily cancel (unassign) leads for a specified duration. After the duration expires, the leads automatically become available again.

## Features

### 1. Temporary Lead Cancellation

Cancel a lead assignment for a specific duration (in hours). The lead will not appear in the agent's assigned leads list until the cancellation expires.

**Endpoint:** `PUT /api/leads/:id/cancel`

**Request Body:**

```json
{
  "durationHours": 24
}
```

**Response:**

```json
{
  "message": "Lead cancelled for 24 hours",
  "lead": { ... },
  "cancellation_expiry": "2024-01-20T15:30:00Z"
}
```

### 2. Resume Lead Cancellation

Remove the cancellation from a lead, making it immediately available again.

**Endpoint:** `PUT /api/leads/:id/resume`

**Response:**

```json
{
  "message": "Lead cancellation removed",
  "lead": { ... }
}
```

### 3. Get Active Leads

The `/api/leads/me` endpoint now returns only active (non-cancelled) leads.

**Endpoint:** `GET /api/leads/me?offset=0&limit=100`

**Response:**

```json
{
  "leads": [...],
  "total": 42,
  "offset": 0,
  "limit": 100
}
```

## Database Schema

The `leads` table now has two new columns:

| Column                | Type      | Description                                                     |
| --------------------- | --------- | --------------------------------------------------------------- |
| `assigned_at`         | TIMESTAMP | When the lead was assigned to the user                          |
| `cancellation_expiry` | TIMESTAMP | When the temporary cancellation expires (NULL if not cancelled) |

## API Usage Examples

### Cancel a lead for 24 hours

```bash
curl -X PUT http://localhost:3000/api/leads/123/cancel \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"durationHours": 24}'
```

### Cancel a lead for 8 hours

```bash
curl -X PUT http://localhost:3000/api/leads/123/cancel \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"durationHours": 8}'
```

### Resume a lead immediately

```bash
curl -X PUT http://localhost:3000/api/leads/123/resume \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get only active leads

```bash
curl -X GET http://localhost:3000/api/leads/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Permissions

- **Agents:** Can cancel/resume only their own assigned leads
- **Admins:** Can cancel/resume any lead

## Implementation Details

### Automatic Expiry

Cancelled leads automatically become available when:

- The `cancellation_expiry` time is reached
- The lead is no longer returned in the `/me` endpoint
- No manual cleanup is required

### Search Behavior

The search endpoint (`/api/leads/search`) also respects cancellations:

- Agents can only search in their active leads
- Admins see all leads

## Database Migration

Run the migration script to add the new columns to existing databases:

```bash
psql -U postgres -d lead_db -f backend/db/migrations.sql
```

Or include in your standard migration process:

```sql
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS cancellation_expiry TIMESTAMP;
```
