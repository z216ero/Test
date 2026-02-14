# Domain (MVP)

This document is the single source of truth for business rules.
If requirements are unclear or missing in code, follow this document.
If something is not described here, do not invent it.

---

## 1. Product goal (CRM-first phase)

The system is a CRM for personal trainers.

- Primary user: Trainer.
- Secondary user: Client (optional, can be unregistered).

The trainer must be able to:

- Manage own client list (registered or not).
- Create training slots.
- Assign slots to specific clients.
- Manage attendance.
- Track payments.
- View reporting and revenue.
- Receive live updates via push.

- Marketplace/search functionality is out of scope for this phase.
- Online coaching (video calls) is out of scope.
- Online training mode (external link only) may be added later.

## 2. Time & general rules

- All timestamps are stored in UTC.
- UI converts to local time.
- A User has exactly one role: Trainer OR Client.
- All state transitions must be server-side validated.
- All conflict checks must be atomic (transactional).
- OpenAPI is source of truth for mobile.

## 3. Core entities

### 3.1 User

- `User`
- `id`
- `role: Trainer | Client`
- `email`
- `passwordHash`
- `createdAtUtc`

- One user = one role only.

### 3.2 TrainerProfile

- `TrainerProfile`
- `userId` (PK, FK -> `User`)
- `displayName`
- `bio?`
- `pricePerSession`
- `specializations[]`
- `worksWith: Male | Female | Both`
- `supportsGroup: bool`
- `supportsOnline: bool`
- `createdAtUtc`

### 3.3 ClientProfile (registered client only)

- `ClientProfile`
- `userId` (PK)
- `displayName`
- `createdAtUtc`

Note:

- Clients may exist without being linked to a trainer.

### 3.4 TrainerClient (CRM contact)

Represents a trainer's client record.

- `TrainerClient`
- `id`
- `trainerId` (FK -> `TrainerProfile.userId`)
- `linkedUserId?` (FK -> `User.id`, nullable)
- `displayName` (required)
- `phone?`
- `notes?` (max 500)
- `status: Active | Archived`
- `createdAtUtc`
- `updatedAtUtc?`

Rules:

- Exactly one trainer owns a `TrainerClient`.
- If `linkedUserId` is not null:
- must reference a `User` with role `Client`.
- `Unique(trainerId, linkedUserId)` where `linkedUserId` is not null.
- `Unique(trainerId, phone)` where `phone` is not null (optional).

Purpose:

- Allows trainer to manage both:
- registered clients.
- unregistered clients.

### 3.5 TrainingSlot

- `TrainingSlot`
- `id`
- `trainerId`
- `startsAtUtc`
- `durationMinutes`
- `slotType: Individual | Group`
- `capacityMin?` (Group only)
- `capacityMax?` (Group only)
- `status: Open | Booked | Cancelled`
- `createdAtUtc`

Rules:

- For Individual:
- `capacityMin = null`
- `capacityMax = null`
- For Group:
- `2 <= capacityMin <= capacityMax <= 100`

Status meaning:

- Open:
- No booking (individual).
- Or group still accepting participants.
- Booked:
- Individual: exactly one Booking exists.
- Group: at least one active attendee exists.
- Cancelled:
- Trainer cancelled the slot.

### 3.6 Booking (Individual only)

Represents assignment of individual slot.

- `Booking`
- `id`
- `slotId` (unique)
- `clientId?` (FK -> `User.id`)
- `trainerClientId?` (FK -> `TrainerClient.id`)
- `status: Booked | Cancelled | Completed | NoShow`
- `createdAtUtc`
- `updatedAtUtc?`

Constraint:

- Exactly one of (`clientId`, `trainerClientId`) must be set.

Rules:

- Booking exists only for Individual slots.
- When Booking exists with status `Booked`:
- `slot.status = Booked`

### 3.7 SlotAttendee (Group only)

Represents group participant.

- `SlotAttendee`
- `id`
- `slotId`
- `clientId?` (FK -> `User.id`)
- `trainerClientId?` (FK -> `TrainerClient.id`)
- `status: Booked | Cancelled | Completed | NoShow`
- `createdAtUtc`
- `updatedAtUtc?`

Constraint:

- Exactly one of (`clientId`, `trainerClientId`) must be set.
- `Unique(slotId, clientId)` where `clientId` is not null.
- `Unique(slotId, trainerClientId)` where `trainerClientId` is not null.

OccupiedCount:

- Count of attendees with `status == Booked`.

Slot full:

- `occupiedCount >= capacityMax`

### 3.8 Payment

- `Payment`
- `id`
- `bookingId` (unique, FK -> `Booking.id`)
- `amount`
- `status: Pending | Paid`
- `method: Cash | Transfer | SBP | Other`
- `paidAtUtc?`
- `createdAtUtc`

Rules:

- Payments exist only for Individual bookings.
- Group payments are out of scope.

## 4. Core flows

### 4.1 Trainer manages clients

Trainer:

- Creates `TrainerClient`.
- Edits notes.
- Archives client.
- Links to registered user later (optional).

### 4.2 Trainer creates slot

Input:

- `startsAtUtc`
- `durationMinutes`
- `slotType`
- `capacityMin/Max` (if Group)
- Optional `assignToTrainerClientId`
- Optional `assignToClientId`

Flow:

- If `slotType == Individual`:
- If assignToX provided:
- validate ownership
- validate no time conflict
- create Booking immediately
- `slot.status = Booked`
- If not assigned:
- `slot.status = Open`
- If `slotType == Group`:
- `slot.status = Open`

### 4.3 Client books slot

For Individual:

- Create Booking.
- `slot.status = Booked`

For Group:

- Validate conflict.
- Validate capacity.
- Create `SlotAttendee`.
- Update `occupiedCount`.

### 4.4 Conflict rule (mandatory)

Two intervals overlap if:

- `startA < endB && startB < endA`

Conflict check applies to:

- For registered client:
- Individual `Booking` status `Booked`.
- Group `SlotAttendee` status `Booked`.
- For unregistered client (`trainerClientId`):
- Check only within same `trainerClientId`.

Error:

- `409 booking_time_conflict`

### 4.5 Cancel

Client cancel:

- Individual: `booking.status = Cancelled`
- Group: `attendee.status = Cancelled`

Trainer cancel slot:

- Individual: `booking.status = Cancelled`
- Group:
- all attendees -> `Cancelled`
- `slot.status = Cancelled`

- Cancelled empty slots should not pollute "Completed today".

### 4.6 Attendance

Individual:

- `POST complete`
- `POST no-show`
- allowed only after start time

Group:

- attendance per attendee
- time-gated server-side

### 4.7 Reporting (derived, no new entity)

Reporting summary for trainer (period-based):

- `sessionsBooked`
- `sessionsCompleted`
- `sessionsNoShow`
- `sessionsCancelled`
- `revenuePaid`
- `revenuePending`

- Derived from `Booking` + `Payment`.

## 5. Push events (FCM)

Server emits events:

- `booking_created`
- `booking_cancelled`
- `slot_cancelled`
- `attendee_marked`
- `payment_marked_paid`

Push must:

- contain `slotId`
- `actorName`
- `startsAtUtc`
- `durationMinutes`

Mobile:

- invalidates relevant queries
- updates badge
- logs in-app event

- Push failure must not break transaction.

## 6. Non-goals (for this phase)

- Marketplace search
- Reviews & ratings
- In-app chat
- Video calls
- Subscription plans
- Cross-trainer client sync
- Multi-trainer ownership

## 7. Invariants

- UTC everywhere
- No silent state transitions
- All booking/attendance changes are atomic
- No oversell in group
- No double booking via race condition
- Mobile trusts server as source of truth
