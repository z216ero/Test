import type {
  GetSlotsAvailableParams,
  GetTrainerClientsParams,
  GetTrainerPaymentsParams,
  GetTrainersMeReportsSummaryParams,
  GetTrainersTrainerIdSlotsParams,
} from '@generated/api';

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
  trainerClients: {
    list: (params?: GetTrainerClientsParams) =>
      params
        ? (['trainer', 'clients', 'list', params] as const)
        : (['trainer', 'clients', 'list'] as const),
  },
  trainerWorkoutTypes: {
    list: (includeArchived = false) =>
      ['trainer', 'workout-types', { includeArchived }] as const,
  },
  myClients: () => ['trainer', 'clients', 'my-clients'] as const,
  clientRequests: () => ['client', 'links', 'requests'] as const,
  pendingLinkRequestsCount: () => ['client', 'links', 'pending-count'] as const,
  pendingBookingConfirmationsCount: () =>
    ['client', 'bookings', 'pending-confirmations-count'] as const,
  reports: {
    summary: (params?: GetTrainersMeReportsSummaryParams) =>
      params
        ? (['trainer', 'reports', 'summary', params] as const)
        : (['trainer', 'reports', 'summary'] as const),
  },
  bookings: {
    upcoming: () => ['bookings', 'upcoming'] as const,
    history: () => ['bookings', 'history'] as const,
  },
  payments: {
    all: () => ['payments'] as const,
    trainer: (params?: GetTrainerPaymentsParams) =>
      params
        ? (['payments', 'trainer', params] as const)
        : (['payments', 'trainer'] as const),
    booking: (bookingId: string) => ['payments', 'booking', bookingId] as const,
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
    cities: (query?: string) =>
      query
        ? (['lookups', 'cities', query] as const)
        : (['lookups', 'cities'] as const),
    districts: (cityId?: number, query?: string) =>
      cityId !== undefined || query
        ? (['lookups', 'districts', cityId ?? null, query ?? null] as const)
        : (['lookups', 'districts'] as const),
  },
};

