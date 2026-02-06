import type { GetSlotsAvailableParams, GetTrainersTrainerIdSlotsParams } from '@generated/api';

export const keys = {
  auth: {
    me: () => ['auth', 'me'] as const,
    bootstrap: () => ['auth', 'bootstrap'] as const,
  },
  home: {
    upcoming: (role: 'Trainer' | 'Client') =>
      ['home', 'upcoming', role] as const,
  },
  trainers: {
    list: () => ['trainers', 'list'] as const,
    slots: (trainerId: string, params?: GetTrainersTrainerIdSlotsParams) =>
      params
        ? (['trainers', 'slots', trainerId, params] as const)
        : (['trainers', 'slots', trainerId] as const),
  },
  trainerSlots: {
    mine: (params?: GetTrainersTrainerIdSlotsParams) =>
      params
        ? (['trainer', 'slots', 'mine', params] as const)
        : (['trainer', 'slots', 'mine'] as const),
  },
  bookings: {
    upcoming: () => ['bookings', 'upcoming'] as const,
    history: () => ['bookings', 'history'] as const,
  },
  slots: {
    available: (params?: GetSlotsAvailableParams) =>
      params
        ? (['slots', 'available', params] as const)
        : (['slots', 'available'] as const),
  },
  lookups: {
    roles: () => ['lookups', 'roles'] as const,
    genders: () => ['lookups', 'genders'] as const,
    levels: () => ['lookups', 'levels'] as const,
    goals: () => ['lookups', 'goals'] as const,
    specializations: () => ['lookups', 'specializations'] as const,
    trainingTypes: () => ['lookups', 'training-types'] as const,
    slotStatuses: () => ['lookups', 'slot-statuses'] as const,
    bookingStatuses: () => ['lookups', 'booking-statuses'] as const,
    paymentStatuses: () => ['lookups', 'payment-statuses'] as const,
    paymentMethods: () => ['lookups', 'payment-methods'] as const,
    dateFilters: () => ['lookups', 'date-filters'] as const,
    sortOptions: () => ['lookups', 'sort-options'] as const,
    cities: () => ['lookups', 'cities'] as const,
    districts: (cityId?: number) =>
      cityId !== undefined
        ? (['lookups', 'districts', cityId] as const)
        : (['lookups', 'districts'] as const),
  },
};

