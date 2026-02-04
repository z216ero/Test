# Domain (MVP)

This document is the single source of truth for business rules.
If requirements are unclear or missing in code, ALWAYS follow this document.
If something is not described here — do NOT invent it.

---

## Product goal

The product is a mobile app for OFFLINE personal trainers in Russia.

Main value:
- reduce scheduling chaos
- reduce last-minute cancellations
- keep training history and payments in one place

Out of scope for MVP:
- online coaching
- chat/messaging
- nutrition / calories / meal plans
- social feed, posts, stories
- gym integrations
- inbody or other body scanners
- automatic payments / acquiring

---

## Roles

### Trainer
- Creates training availability (time slots)
- Manages own clients
- Marks attendance
- Tracks payments manually

### Client
- Books available slots
- Cancels own bookings
- Views own training history

A user can have ONLY ONE role in MVP.
(Role switching is out of scope.)

---

## Core entities

### User
- id
- role: Trainer | Client
- name
- avatar (optional): user profile photo
- phone or email (auth identifier)

### TrainerProfile
- userId
- pricePerSession
- specialization (string, optional)
- gymName (string, optional)
- about (string, optional, max 250)
- trainingTypes (string[], optional; predefined list from product requirements)
- clientGenderPreference: Men | Women | All (default All)
- rating (computed for UI; based on last 5–10 completed trainings)

### ClientProfile
- userId

### RefreshToken
- id
- userId
- token
- expiresAt (UTC)
- createdAt (UTC)
- revokedAt (UTC, optional)

### DeviceToken
- id
- userId
- platform: android | ios
- token (unique)
- createdAt (UTC)
- lastSeenAt (UTC)
- isEnabled (bool)

### TrainingSlot
- id
- trainerId
- startAt (UTC)
- endAt (UTC)
- status: Available | Booked | Cancelled

Slots MUST NOT overlap for the same trainer.

### Booking
- id
- slotId
- clientId
- status: Booked | Cancelled | Completed | NoShow
- createdAt (UTC)

Each slot can have at most ONE booking.

### Package (optional, MVP-lite)
- id
- trainerId
- clientId
- totalSessions
- remainingSessions
- price

### Payment
- id
- relatedEntity: Booking | Package
- amount
- status: Pending | Paid | Refunded
- method: Cash | Transfer | SBP

Payments are MANUAL in MVP.
No integrations with banks.

---

## Time rules

- All time in API and database is stored in UTC.
- Mobile app converts time to local device timezone.
- Never store local time in the database.

---

## Core flows

### Trainer creates slots
- Trainer creates slots with explicit startAt and endAt.
- Slot duration is fixed per slot.
- Overlapping slots are rejected.

### Trainer cancels slot
- Trainer can cancel an Available slot.
- Cancelling an Available slot sets slot status to Cancelled.

### Client booking
- Client can book ONLY Available slots.
- Booking must be atomic (no double booking).
- When booked:
  - slot.
