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
- gender: Male | Female | Any (default Male)
- name
- avatar (optional): user profile photo
- phone or email (auth identifier)

### TrainerProfile
- userId
- pricePerSession
- specializations (string[], optional; predefined list from product requirements)
- gymName (string, optional)
- about (string, optional, max 250)
- trainingTypes (string[], optional; predefined list from product requirements)
- worksWithGender: Male | Female | Any (default Any)
- rating (computed for UI; based on last 5–10 completed trainings)

### ClientProfile
- userId
- preferredTrainerGender: Male | Female | Any (default Any)
- level: Beginner | Intermediate | Advanced (default Beginner)
- goals (string[], optional; predefined list from product requirements)

### City
- id
- name

### District
- id
- cityId
- name

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

## Lookups (source of truth via API)

Enums / lookup lists:
- Role: Trainer, Client
- Gender: Male, Female, Any
- Level: Beginner, Intermediate, Advanced
- Goal: WeightLoss, MuscleGain, Strength, Rehab, GeneralFitness
- Specialization: StrengthTraining, Crossfit, Functional, Rehab, WeightLoss, Yoga, Pilates
- TrainingType: Individual, Group
- SlotStatus: Open, Booked, Cancelled
- BookingStatus: Booked, Cancelled, Completed, NoShow
- PaymentStatus: Pending, Paid, Refunded
- PaymentMethod: Cash, Transfer, SBP
- DateFilter: Today, Tomorrow, ThisWeek, CustomDate
- SortOption: ByRating, ByPrice, ByDistance

Lookups are returned via `GET /lookups/*` and are the only source of truth for UI options.

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
