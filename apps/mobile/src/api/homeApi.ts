import type {
  AuthUserDto,
  SlotDto,
  TrainerDto,
  UpcomingSessionDto,
} from '../generated/api';
import {
  getAuthMe,
  getClientsMeUpcoming,
  getTrainersMe,
  getTrainersTrainerIdSlots,
} from '../generated/api';
import { unwrap } from './core';

export type UpcomingSession = {
  slot: SlotDto;
  trainerName?: string | null;
  specialization?: string | null;
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
  specialization?: string | null,
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
    specialization,
  };
};

export const getUpcomingForClient = async (
  options?: RequestInit
): Promise<UpcomingSession | null> => {
  const response = await getClientsMeUpcoming(options);
  const data = unwrap<UpcomingSessionDto | null>(
    response,
    'Unable to load upcoming session.'
  );

  if (!data?.slot) {
    return null;
  }

  return {
    slot: data.slot,
    trainerName: data.trainerName,
    specialization: data.trainerSpecialization,
  };
};
