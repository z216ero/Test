import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AvailableSlotsScreen } from '../screens/AvailableSlotsScreen';
import { BootstrapScreen } from '../screens/BootstrapScreen';
import { CreateSlotScreen } from '../screens/CreateSlotScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { SlotDetailsScreen } from '../screens/SlotDetailsScreen';
import { TrainerSlotsScreen } from '../screens/TrainerSlotsScreen';
import { TrainersScreen } from '../screens/TrainersScreen';
import type {
  AppStackParamList,
  AuthStackParamList,
  RootStackParamList,
} from './types';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();

const AuthStackNavigator = () => (
  <AuthStack.Navigator>
    <AuthStack.Screen name="Login" component={LoginScreen} options={{ title: 'Login' }} />
    <AuthStack.Screen name="Register" component={RegisterScreen} options={{ title: 'Register' }} />
  </AuthStack.Navigator>
);

const AppStackNavigator = () => (
  <AppStack.Navigator>
    <AppStack.Screen name="Home" component={HomeScreen} options={{ title: 'Home' }} />
    <AppStack.Screen name="Trainers" component={TrainersScreen} options={{ title: 'Trainers' }} />
    <AppStack.Screen
      name="AvailableSlots"
      component={AvailableSlotsScreen}
      options={{ title: 'Available Slots' }}
    />
    <AppStack.Screen
      name="SlotDetails"
      component={SlotDetailsScreen}
      options={{ title: 'Confirm Booking' }}
    />
    <AppStack.Screen
      name="TrainerSlots"
      component={TrainerSlotsScreen}
      options={{ title: 'Trainer Slots' }}
    />
    <AppStack.Screen
      name="CreateSlot"
      component={CreateSlotScreen}
      options={{ title: 'Create Slot' }}
    />
  </AppStack.Navigator>
);

export function RootNavigator() {
  return (
    <RootStack.Navigator
      initialRouteName="Bootstrap"
      screenOptions={{ headerShown: false }}
    >
      <RootStack.Screen name="Bootstrap" component={BootstrapScreen} />
      <RootStack.Screen name="Auth" component={AuthStackNavigator} />
      <RootStack.Screen name="App" component={AppStackNavigator} />
    </RootStack.Navigator>
  );
}
