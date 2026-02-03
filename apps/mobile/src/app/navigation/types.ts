import type { NavigatorScreenParams } from '@react-navigation/native';
import type { SlotDto } from '@generated/api';

export type ScheduleStackParamList = {
  ScheduleHome: undefined;
  SlotDetails: { slot: SlotDto };
};

export type BookingsStackParamList = {
  BookingsHome: undefined;
  BookingDetails: {
    slot: SlotDto;
    trainerName?: string | null;
    trainerSpecialization?: string | null;
    trainerAvatarUrl?: string | null;
  };
};

export type ProfileStackParamList = {
  ProfileHome: undefined;
  PersonalInfo: undefined;
  Notifications: undefined;
};

export type UserRole = 'Client' | 'Trainer';

export type SlotsStackParamList = {
  SlotsList: undefined;
  BookingConfirm: {
    slot: SlotDto;
    trainerName?: string | null;
    trainerSpecialization?: string | null;
  };
};

export type ClientTabsParamList = {
  Home: undefined;
  Slots: NavigatorScreenParams<SlotsStackParamList>;
  Bookings: NavigatorScreenParams<BookingsStackParamList>;
  Profile: NavigatorScreenParams<ProfileStackParamList>;
};

export type TrainerTabsParamList = {
  Home: undefined;
  Schedule: NavigatorScreenParams<ScheduleStackParamList>;
  CreateSlot: { initialDateIsoLocal?: string } | undefined;
  Profile: NavigatorScreenParams<ProfileStackParamList>;
};

export type AppTabsParamList = ClientTabsParamList & TrainerTabsParamList;

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type AppStackParamList = {
  Home: undefined;
  Trainers: { mode: 'client' | 'trainer'; clientId?: string };
  AvailableSlots: { trainerId: string; trainerName: string; clientId: string };
  SlotDetails: {
    trainerId: string;
    trainerName: string;
    slot: SlotDto;
    clientId: string;
  };
  TrainerSlots: { trainerId: string; trainerName: string };
  CreateSlot: {
    trainerId: string;
    trainerName: string;
    initialDateIsoLocal?: string;
  };
};

export type RootStackParamList = {
  Bootstrap: undefined;
  Auth: NavigatorScreenParams<AuthStackParamList>;
  App: { role: UserRole } | undefined;
};

