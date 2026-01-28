import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BootstrapScreen } from '../screens/BootstrapScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { PersonalInfoScreen } from '../screens/PersonalInfoScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { SlotsScreen } from '../screens/SlotsScreen';
import type {
  AuthStackParamList,
  AppTabsParamList,
  ProfileStackParamList,
  RootStackParamList,
} from './types';
import { Text } from 'tamagui';
import { config } from '../../../tamagui.config';
import { t } from '../../i18n';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppTabs = createBottomTabNavigator<AppTabsParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();

const AuthStackNavigator = () => (
  <AuthStack.Navigator>
    <AuthStack.Screen name="Login" component={LoginScreen} options={{ title: 'Login' }} />
    <AuthStack.Screen name="Register" component={RegisterScreen} options={{ title: 'Register' }} />
  </AuthStack.Navigator>
);

const ProfileStackNavigator = () => (
  <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
    <ProfileStack.Screen name="ProfileHome" component={ProfileScreen} />
    <ProfileStack.Screen name="PersonalInfo" component={PersonalInfoScreen} />
  </ProfileStack.Navigator>
);

const AppTabsNavigator = () => {
  const tokens = config.tokens;

  return (
    <AppTabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: tokens.color.accent,
        tabBarInactiveTintColor: tokens.color.muted,
        tabBarStyle: {
          backgroundColor: tokens.color.background,
          borderTopColor: tokens.color.border,
          borderTopWidth: 1,
          paddingTop: tokens.space[2],
          paddingBottom: tokens.space[3],
          height: tokens.size[10] + tokens.space[3] + tokens.space[2],
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontSize: tokens.size[2],
          fontWeight: '600',
        },
        tabBarIcon: ({ color }) => (
          <Text color={color} fontSize="$5">
            {route.name === 'Home' ? 'H' : route.name === 'Slots' ? 'S' : 'P'}
          </Text>
        ),
      })}
    >
      <AppTabs.Screen name="Home" component={HomeScreen} options={{ title: t('tabs.home') }} />
      <AppTabs.Screen name="Slots" component={SlotsScreen} options={{ title: t('tabs.slots') }} />
      <AppTabs.Screen name="Profile" component={ProfileStackNavigator} options={{ title: t('tabs.profile') }} />
    </AppTabs.Navigator>
  );
};

export function RootNavigator() {
  return (
    <RootStack.Navigator
      initialRouteName="Bootstrap"
      screenOptions={{ headerShown: false }}
    >
      <RootStack.Screen name="Bootstrap" component={BootstrapScreen} />
      <RootStack.Screen name="Auth" component={AuthStackNavigator} />
      <RootStack.Screen name="App" component={AppTabsNavigator} />
    </RootStack.Navigator>
  );
}
