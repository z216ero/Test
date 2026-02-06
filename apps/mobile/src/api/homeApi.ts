import type {
  AuthUserDto,
  SlotDto,
  TrainerDto,
} from '@generated/api';
import {
  getAuthMe,
  getTrainersMe,
  getTrainersTrainerIdSlots,
} from '@generated/api';
import { unwrap } from './core';
import { getClientUpcomingBookings } from './bookingsApi';

export type UpcomingSession = {
  slot: SlotDto;
  trainerName?: string | null;
  trainerSpecializations?: string[] | null;
  trainerAvatarUrl?: string | null;
};

export const getMe = async (options?: RequestInit): Promise<AuthUserDto> => {
  const response = await getAuthMe(options);
  return unwrap(response, 'Unable to load profile.');
};

const isFutureSlot = (slot: SlotDto, now: number) => {
  if (!slot.startsAtUtc) {
    return false;
  }
  const start = new Date(slot.startsAtUtc).getTime();
  if (Number.isNaN(start)) {
    return false;
  }
  return start >= now;
};

const isBooked = (slot: SlotDto) => slot.status === 'Booked';

const sortByStart = (a: SlotDto, b: SlotDto) => {
  const aTime = a.startsAtUtc ? new Date(a.startsAtUtc).getTime() : 0;
  const bTime = b.startsAtUtc ? new Date(b.startsAtUtc).getTime() : 0;
  return aTime - bTime;
};

export const getUpcomingForTrainer = async (
  trainerSpecializations?: string[] | null,
  options?: RequestInit
): Promise<UpcomingSession | null> => {
  const trainerResponse = await getTrainersMe(options);
  const trainer = unwrap<TrainerDto>(
    trainerResponse,
    'Unable to load trainer profile.'
  );

  if (!trainer?.id) {
    return null;
  }

  const response = await getTrainersTrainerIdSlots(
    trainer.id,
    undefined,
    options
  );
  const slots = unwrap<SlotDto[]>(response, 'Unable to load trainer slots.');
  const now = Date.now();
  const upcoming = slots
    .filter((slot) => isBooked(slot) && isFutureSlot(slot, now))
    .sort(sortByStart)[0];

  if (!upcoming) {
    return null;
  }

  return {
    slot: upcoming,
    trainerName: trainer.displayName,
    trainerSpecializations,
  };
};

export const getUpcomingForClient = async (
  options?: RequestInit
): Promise<UpcomingSession | null> => {
  const bookings = await getClientUpcomingBookings(options);
  const sorted = bookings
    .filter((item) => item.slot?.startsAtUtc)
    .slice()
    .sort((a, b) => {
      const aTime = a.slot.startsAtUtc
        ? new Date(a.slot.startsAtUtc).getTime()
        : 0;
      const bTime = b.slot.startsAtUtc
        ? new Date(b.slot.startsAtUtc).getTime()
        : 0;
      return aTime - bTime;
    });

  const upcoming = sorted[0] ?? bookings[0];
  if (!upcoming?.slot) {
    return null;
  }

  return {
    slot: upcoming.slot,
    trainerName: upcoming.trainerName,
    trainerSpecializations: upcoming.trainerSpecializations,
    trainerAvatarUrl: upcoming.trainerAvatarUrl,
  };
};

