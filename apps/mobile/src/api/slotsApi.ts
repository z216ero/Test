import type {
  GetTrainersTrainerIdSlotsParams,
  SlotDto,
  TrainerDto,
} from '../generated/api';
import { getTrainers, getTrainersTrainerIdSlots } from '../generated/api';
import { t } from '../i18n';
import { unwrap } from './core';

const isAvailableStatus = (status?: string | null) => {
  if (!status) {
    return false;
  }
  const normalized = status.toLowerCase();
  return normalized === 'open' || normalized === 'available';
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

const sortByStart = (a: SlotDto, b: SlotDto) => {
  const aTime = a.startsAtUtc ? new Date(a.startsAtUtc).getTime() : 0;
  const bTime = b.startsAtUtc ? new Date(b.startsAtUtc).getTime() : 0;
  return aTime - bTime;
};

export type SlotsWithTrainers = {
  slots: SlotDto[];
  trainersById: Record<string, TrainerDto>;
};

export const getAvailableSlots = async (
  params?: GetTrainersTrainerIdSlotsParams
): Promise<SlotDto[]> => {
  const data = await getAvailableSlotsWithTrainers(params);
  return data.slots;
};

export const getAvailableSlotsWithTrainers = async (
  params?: GetTrainersTrainerIdSlotsParams
): Promise<SlotsWithTrainers> => {
  const trainersResponse = await getTrainers();
  const trainers = unwrap<TrainerDto[]>(
    trainersResponse,
    t('errors.generic')
  );

  const trainersById: Record<string, TrainerDto> = {};
  const trainerIds = trainers
    .map((trainer) => {
      if (trainer.id) {
        trainersById[trainer.id] = trainer;
      }
      return trainer.id;
    })
    .filter((id): id is string => typeof id === 'string');

  if (trainerIds.length === 0) {
    return { slots: [], trainersById };
  }

  const slotsPerTrainer = await Promise.all(
    trainerIds.map(async (trainerId) => {
      const response = await getTrainersTrainerIdSlots(trainerId, params);
      const slots = unwrap<SlotDto[]>(response, t('errors.generic'));
      return slots;
    })
  );

  const now = Date.now();
  const slots = slotsPerTrainer
    .flat()
    .filter((slot) => isAvailableStatus(slot.status))
    .filter((slot) => isFutureSlot(slot, now))
    .sort(sortByStart);

  return { slots, trainersById };
};
