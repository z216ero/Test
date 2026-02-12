# Domain (MVP)

This document is the single source of truth for business rules.
If requirements are unclear or missing in code, follow this document.
If something is not described here, do not invent it.

---

## Product goal

Mobile app for OFFLINE personal trainers in Russia.

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
- creates and manages own slots
- manages cancellations
- marks attendance
- marks payments manually

### Client
- books available slots
- cancels own bookings
- views own upcoming/history

A user has only one role in MVP. Role switching is out of scope.

---

## Core entities

### User
- id
- role: Trainer | Client
- gender: Male | Female | Any (default Male)
- name
- avatar (optional)
- phone/email (auth identity)

### TrainerProfile
- id
- userId
- cityId (required in business flow)
- districtId (optional)
- pricePerSession
- specializations: string[]
- gymName (optional)
- about (optional, max 250)
- trainingTypes: string[] (includes `Individual` and optionally `Group`)
- worksWithGender: Male | Female | Any (default Any)

### ClientProfile
- userId
- cityId (required in business flow)
- districtId (optional)
- preferredTrainerGender: Male | Female | Any (default Any)
- level: Beginner | Intermediate | Advanced (default Beginner)
- goals: string[]

### City
- id
- name

### District
- id
- cityId
- name

### TrainingSlot
- id
- trainerId
- startsAtUtc
- durationMinutes
- slotType: Individual | Group
- capacityMin (group only)
- capacityMax (group only)
- autoCancelIfMinNotReached (group option)
- autoCancelAtUtc (derived, group only)
- status: Open | Booked | Cancelled
- createdAtUtc

Constraints:
- trainer slots must not overlap by time among active statuses (`Open`/`Booked`)
- `Individual` slots must have `capacityMin/capacityMax = null`
- `Group` slots must have capacities:
- `capacityMin >= 2`
- `capacityMin <= capacityMax`
- `capacityMax <= 100`

### Booking (individual flow)
- id
- slotId (unique, one booking per individual slot)
- clientId
- status: Booked | Cancelled | Completed | NoShow
- createdAtUtc

### SlotAttendee (group flow)
- id
- slotId
- clientId
- status: Booked | Cancelled | Completed | NoShow
- createdAtUtc
- updatedAtUtc (optional)

Constraint:
- unique `(slotId, clientId)` for group attendees

### Payment
- id
- bookingId (unique)
- amount
- status: Pending | Paid | Refunded
- method: Cash | Transfer | SBP | null
- paidAtUtc (optional)
- createdAtUtc
- updatedAtUtc

Important:
- payment is linked to `Booking`, not to `SlotAttendee`
- currently this means payment workflow is for individual bookings only

---

## Lookups (API source of truth)

All lookup options are returned by `GET /lookups/*`.

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

Note:
- `SlotStatus` is `Open` (not `Available`).

---

## Time rules

- API and DB store UTC only.
- Mobile converts to local timezone.
- local time must never be stored in DB.

---

## Core flows

### 1) Trainer creates slot

- trainer sends `startsAtUtc` + `durationMinutes`
- `startsAtUtc` must be UTC and in future
- `slotType` can be `Individual` or `Group` (default `Individual`)
- overlapping active slots of the same trainer are rejected

Group-specific creation:
- trainer must have `Group` in `TrainerProfile.trainingTypes`
- `capacityMin/capacityMax` are required and validated
- optional `autoCancelIfMinNotReached = true`
- if enabled, `autoCancelAtUtc = startsAtUtc - 40 minutes`
- auto-cancel option is allowed only if slot starts at least 40 minutes in future

### 2) Client books slot

Booking is atomic and runs in serializable transaction (no double booking race).

Shared checks:
- slot exists
- slot is not cancelled
- slot did not start yet
- no time conflict with existing client bookings/attendees

Time conflict logic:
- conflicts are checked against BOTH:
- individual `Booking` with status `Booked`
- group `SlotAttendee` with status `Booked`
- cancelled slots are ignored
- overlap rule: requested interval intersects existing interval

#### Individual slot booking
- slot status must be `Open`
- slot must not already have `Booking`
- create `Booking(status=Booked)`
- create `Payment(status=Pending)`
- slot status becomes `Booked`

#### Group slot booking
- `capacityMax` must be configured
- if auto-cancel threshold time already reached and booked attendees are below `capacityMin`:
- slot is auto-cancelled immediately
- booked attendees become `Cancelled`
- booking request returns conflict
- client cannot have duplicate active attendee in the same slot
- if attendee is `Cancelled`, re-book reactivates it to `Booked`
- if attendee already `Completed`/`NoShow`, re-book is rejected
- if number of `Booked` attendees reached `capacityMax`, slot is full
- slot status remains `Open`; occupancy is tracked via attendees

### 3) Slot occupancy and "booked/full" semantics for group

For group slots:
- capacity control for new booking uses count of attendees with status `Booked`
- `isFull` is true when occupancy reaches `capacityMax`
- `occupiedCount` in slot DTO counts attendees with status not `Cancelled`
  (Booked + Completed + NoShow)

Interpretation:
- partially filled group slot is still active and stays `Open`
- "fully booked" for group is represented by `isFull=true`, not by changing slot status to `Booked`

### 4) Cancellation

#### Trainer cancellation

Rules:
- only slot owner trainer can cancel
- cannot cancel started slot
- cannot cancel within 30 minutes before start

Effects:
- individual:
- if no booking: slot -> `Cancelled`
- if booking `Booked`: booking -> `Cancelled`, slot -> `Cancelled`
- if booking already `Cancelled`/`Completed`/`NoShow`: reject
- group:
- all attendees with status `Booked` -> `Cancelled`
- slot -> `Cancelled`
- `autoCancelAtUtc` cleared

Payments/refunds on trainer cancellation:
- no automatic refund operation is executed
- payment changes (Paid/Refunded) are manual trainer actions
- group attendees do not have separate payment records

#### Client cancellation

Rules:
- allowed only before slot start

Effects:
- individual:
- only owner client can cancel own booked session
- booking row is deleted
- slot status becomes `Open`
- group:
- only own attendee can cancel
- attendee `Booked` -> `Cancelled`
- slot remains active (unless cancelled separately)

### 5) Attendance

#### Individual
- endpoints: `/slots/{slotId}/complete` and `/slots/{slotId}/no-show`
- allowed only for individual slot with slot status `Booked`
- booking must still be `Booked`
- new status: `Completed` or `NoShow`

#### Group
- endpoints: `/slots/{slotId}/attendees/{clientId}/complete|no-show`
- trainer only
- slot must be `Group`
- attendee must be `Booked`
- `Completed`: allowed only after slot start
- `NoShow`: allowed only 15 minutes after slot start

### 6) Group auto-cancellation worker

Background worker periodically processes due group slots:
- only `Group`, `Open`, auto-cancel enabled, `autoCancelAtUtc <= now`, `startsAtUtc > now`
- if booked attendees `< capacityMin`:
- slot -> `Cancelled`
- booked attendees -> `Cancelled`
- cancellation notifications sent
- if minimum reached, `autoCancelAtUtc` is cleared and slot stays active

---

## Location rules

- city is required on registration and profile update for both roles
- district is optional
- city/district are stored on profiles
- city is required for client browsing available slots
- if city/district does not exist during registration/profile update, it is created
- trainer discovery for clients is limited to same city
- optional district-only filter limits by same district

---

## API consistency notes

- slot statuses in code and lookups use `Open | Booked | Cancelled`
- do not use `Available` in new contracts
- group flow is attendee-based (`SlotAttendee`), not `Booking`-based
- when changing slot/group behavior, update both API contract and mobile usage in same PR
