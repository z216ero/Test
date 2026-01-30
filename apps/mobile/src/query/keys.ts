import type { GetTrainersTrainerIdSlotsParams } from '../generated/api';

export const keys = {
  trainers: {
    slots: (trainerId: string, params?: GetTrainersTrainerIdSlotsParams) =>
      ['trainers', 'slots', trainerId, params ?? null] as const,
  },
  bookings: {
    upcoming: () => ['bookings', 'upcoming'] as const,
  },
};
