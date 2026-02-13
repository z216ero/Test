import type { NavigatorScreenParams } from '@react-navigation/native';
import type { AvailableSlotTrainerDto, SlotDto } from '@generated/api';

export type ScheduleStackParamList = {
  ScheduleHome: { initialDateIsoLocal?: string } | undefined;
  SlotDetails: { slot: SlotDto };
  AttendanceQueue: undefined;
};

export type BookingsStackParamList = {
  BookingsHome: undefined;
  BookingDetails: {
    slot: SlotDto;
    trainerName?: string | null;
    trainerPhoneNumber?: string | null;
    trainerGender?: string | null;
    trainerWorksWithGender?: string | null;
    trainerRating?: number | null;
    trainerSpecializations?: string[] | null;
    trainerTrainingTypes?: string[] | null;
    trainerCityName?: string | null;
    trainerDistrictName?: string | null;
    trainerAvatarUrl?: string | null;
  };
};

export type LocationSelection = {
  cityId?: number | null;
  cityName?: string | null;
  districtId?: number | null;
  districtName?: string | null;
};

export type LocationSearchParams = {
  mode: 'city' | 'district';
  cityId?: number | null;
  cityName?: string | null;
  returnTo: 'Register' | 'PersonalInfo';
  returnToKey?: string;
};

export type ProfileStackParamList = {
  ProfileHome: undefined;
  PersonalInfo: { locationSelection?: LocationSelection } | undefined;
  Notifications: undefined;
  LocationSearch: LocationSearchParams;
};

export type UserRole = 'Client' | 'Trainer';

export type SlotsStackParamList = {
  SlotsList: undefined;
  ClientSlotDetails: {
    slot: SlotDto;
    trainer: AvailableSlotTrainerDto;
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
  Payments: undefined;
  Profile: NavigatorScreenParams<ProfileStackParamList>;
};

export type AppTabsParamList = ClientTabsParamList & TrainerTabsParamList;

export type AuthStackParamList = {
  Login: undefined;
  Register: { locationSelection?: LocationSelection } | undefined;
  LocationSearch: LocationSearchParams;
};

export type RootStackParamList = {
  Bootstrap: undefined;
  Auth: NavigatorScreenParams<AuthStackParamList>;
  App: { role: UserRole } | undefined;
};

