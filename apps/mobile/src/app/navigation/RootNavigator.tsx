import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { TextStyle } from 'react-native';
import { BootstrapScreen } from '@app/screens/BootstrapScreen';
import { ClientSlotDetailsScreen } from '@app/screens/ClientSlotDetailsScreen';
import { BookingDetailsScreen } from '@app/screens/BookingDetailsScreen';
import { BookingsScreen } from '@app/screens/BookingsScreen';
import { CreateSlotTabScreen } from '@app/screens/CreateSlotTabScreen';
import { HomeScreen } from '@app/screens/HomeScreen';
import { LoginScreen } from '@app/screens/LoginScreen';
import { LocationSearchScreen } from '@app/screens/LocationSearchScreen';
import { NotificationsScreen } from '@app/screens/NotificationsScreen';
import { PersonalInfoScreen } from '@app/screens/PersonalInfoScreen';
import { ProfileScreen } from '@app/screens/ProfileScreen';
import { RegisterScreen } from '@app/screens/RegisterScreen';
import { ScheduleScreen } from '@app/screens/ScheduleScreen';
import { SlotsScreen } from '@app/screens/SlotsScreen';
import { TrainerSlotDetailsScreen } from '@app/screens/TrainerSlotDetailsScreen';
import type {
  ClientTabsParamList,
  AuthStackParamList,
  BookingsStackParamList,
  ProfileStackParamList,
  RootStackParamList,
  ScheduleStackParamList,
  SlotsStackParamList,
  TrainerTabsParamList,
} from './types';
import { Text, YStack } from 'tamagui';
import { config } from '../../../tamagui.config.cjs';
import { t } from '@i18n';
import { AppIcon } from '@ui/AppIcon';
import { usePushIndicators } from '@notifications/pushIndicators';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const ClientTabs = createBottomTabNavigator<ClientTabsParamList>();
const TrainerTabs = createBottomTabNavigator<TrainerTabsParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();
const SlotsStack = createNativeStackNavigator<SlotsStackParamList>();
const ScheduleStack = createNativeStackNavigator<ScheduleStackParamList>();
const BookingsStack = createNativeStackNavigator<BookingsStackParamList>();

const AuthStackNavigator = () => (
  <AuthStack.Navigator>
    <AuthStack.Screen name="Login" component={LoginScreen} options={{ title: t('auth.login.title') }} />
    <AuthStack.Screen name="Register" component={RegisterScreen} options={{ title: t('auth.register.title') }} />
    <AuthStack.Screen name="LocationSearch" component={LocationSearchScreen} options={{ headerShown: false }} />
  </AuthStack.Navigator>
);

const ProfileStackNavigator = () => (
  <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
    <ProfileStack.Screen name="ProfileHome" component={ProfileScreen} />
    <ProfileStack.Screen name="PersonalInfo" component={PersonalInfoScreen} />
    <ProfileStack.Screen name="Notifications" component={NotificationsScreen} />
    <ProfileStack.Screen name="LocationSearch" component={LocationSearchScreen} />
  </ProfileStack.Navigator>
);

const SlotsStackNavigator = () => (
  <SlotsStack.Navigator screenOptions={{ headerShown: false }}>
    <SlotsStack.Screen name="SlotsList" component={SlotsScreen} />
    <SlotsStack.Screen name="ClientSlotDetails" component={ClientSlotDetailsScreen} />
  </SlotsStack.Navigator>
);

const ScheduleStackNavigator = () => (
  <ScheduleStack.Navigator screenOptions={{ headerShown: false }}>
    <ScheduleStack.Screen name="ScheduleHome" component={ScheduleScreen} />
    <ScheduleStack.Screen name="SlotDetails" component={TrainerSlotDetailsScreen} />
  </ScheduleStack.Navigator>
);

const BookingsStackNavigator = () => (
  <BookingsStack.Navigator screenOptions={{ headerShown: false }}>
    <BookingsStack.Screen name="BookingsHome" component={BookingsScreen} />
    <BookingsStack.Screen name="BookingDetails" component={BookingDetailsScreen} />
  </BookingsStack.Navigator>
);

const tokens = config.tokens;
type TokenValue<T> = { val: T } | T;
const isTokenValue = <T,>(value: TokenValue<T>): value is { val: T } =>
  typeof value === 'object' && value !== null && 'val' in value;
const getTokenValue = <T,>(token: TokenValue<T> | undefined): T | undefined =>
  token && isTokenValue(token) ? token.val : token;

const tabActiveColor = getTokenValue(tokens.color.accent) as string;
const tabInactiveColor = getTokenValue(tokens.color.muted) as string;
const tabBackground = getTokenValue(tokens.color.background) as string;
const tabBorder = getTokenValue(tokens.color.border) as string;
const tabPaddingTop = getTokenValue(tokens.space[2]) as number;
const tabPaddingBottom = getTokenValue(tokens.space[3]) as number;
const tabHeight =
  (getTokenValue(tokens.size[10]) as number) +
  (getTokenValue(tokens.space[3]) as number) +
  (getTokenValue(tokens.space[2]) as number);
const tabLabelSize = getTokenValue(tokens.size[2]) as number;
const tabLabelWeight = config.fonts.body.weight[7] as TextStyle['fontWeight'];

const tabBarScreenOptions: BottomTabNavigationOptions = {
  headerShown: false,
  tabBarActiveTintColor: tabActiveColor,
  tabBarInactiveTintColor: tabInactiveColor,
  tabBarStyle: {
    backgroundColor: tabBackground,
    borderTopColor: tabBorder,
    borderTopWidth: 1,
    paddingTop: tabPaddingTop,
    paddingBottom: tabPaddingBottom,
    height: tabHeight,
    elevation: 0,
    shadowOpacity: 0,
  },
  tabBarLabelStyle: {
    fontSize: tabLabelSize,
    fontWeight: tabLabelWeight,
  },
};

const makeTabIcon = (name: Parameters<typeof AppIcon>[0]['name']) => ({ color }: { color: string }) => (
  <AppIcon name={name} color={color} size={22} />
);

const ScheduleTabIcon = ({ color }: { color: string }) => {
  const { scheduleBadge } = usePushIndicators();
  return (
    <YStack position="relative" alignItems="center" justifyContent="center">
      <AppIcon name="calendar" color={color} size={22} />
      {scheduleBadge.hasUnread ? (
        <YStack
          position="absolute"
          top={0}
          right={0}
          width="$1"
          height="$1"
          borderRadius="$6"
          backgroundColor="$accent"
        />
      ) : null}
    </YStack>
  );
};

const ClientTabsNavigator = () => (
  <ClientTabs.Navigator screenOptions={tabBarScreenOptions}>
    <ClientTabs.Screen
      name="Home"
      component={HomeScreen}
      options={{ title: t('tabs.home'), tabBarIcon: makeTabIcon('home') }}
    />
    <ClientTabs.Screen
      name="Slots"
      component={SlotsStackNavigator}
      options={{ title: t('tabs.slots'), tabBarIcon: makeTabIcon('calendar') }}
    />
    <ClientTabs.Screen
      name="Bookings"
      component={BookingsStackNavigator}
      options={{ title: t('tabs.bookings'), tabBarIcon: makeTabIcon('history') }}
    />
    <ClientTabs.Screen
      name="Profile"
      component={ProfileStackNavigator}
      options={{ title: t('tabs.profile'), tabBarIcon: makeTabIcon('user') }}
    />
  </ClientTabs.Navigator>
);

const TrainerTabsNavigator = () => (
  <TrainerTabs.Navigator screenOptions={tabBarScreenOptions}>
    <TrainerTabs.Screen
      name="Home"
      component={HomeScreen}
      options={{ title: t('tabs.home'), tabBarIcon: makeTabIcon('home') }}
    />
    <TrainerTabs.Screen
      name="Schedule"
      component={ScheduleStackNavigator}
      options={{ title: t('tabs.schedule'), tabBarIcon: ScheduleTabIcon }}
    />
    <TrainerTabs.Screen
      name="CreateSlot"
      component={CreateSlotTabScreen}
      options={{ title: t('tabs.createSlot'), tabBarIcon: makeTabIcon('plus') }}
    />
    <TrainerTabs.Screen
      name="Profile"
      component={ProfileStackNavigator}
      options={{ title: t('tabs.profile'), tabBarIcon: makeTabIcon('user') }}
    />
  </TrainerTabs.Navigator>
);

type RoleTabsProps = NativeStackScreenProps<RootStackParamList, 'App'>;

const AppLoadingScreen = () => (
  <YStack
    flex={1}
    alignItems="center"
    justifyContent="center"
    gap="$3"
    padding="$6"
    backgroundColor="$background"
  >
    <Text fontSize="$6" fontWeight="700" color="$text">
      {t('common.loading')}
    </Text>
  </YStack>
);

const RoleTabsNavigator = ({ route }: RoleTabsProps) => {
  const role = route.params?.role;
  if (!role) {
    return <AppLoadingScreen />;
  }
  return role === 'Trainer' ? <TrainerTabsNavigator /> : <ClientTabsNavigator />;
};

export function RootNavigator() {
  return (
    <RootStack.Navigator
      initialRouteName="Bootstrap"
      screenOptions={{ headerShown: false }}
    >
      <RootStack.Screen name="Bootstrap" component={BootstrapScreen} />
      <RootStack.Screen name="Auth" component={AuthStackNavigator} />
      <RootStack.Screen name="App" component={RoleTabsNavigator} />
    </RootStack.Navigator>
  );
}



