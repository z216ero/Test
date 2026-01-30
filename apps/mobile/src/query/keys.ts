import type { GetTrainersTrainerIdSlotsParams } from '../generated/api';

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
  },
  slots: {
    available: (params?: GetTrainersTrainerIdSlotsParams) =>
      params
        ? (['slots', 'available', params] as const)
        : (['slots', 'available'] as const),
  },
};
