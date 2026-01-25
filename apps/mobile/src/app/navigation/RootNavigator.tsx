import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '../screens/HomeScreen';
import { TrainersScreen } from '../screens/TrainersScreen';
import { AvailableSlotsScreen } from '../screens/AvailableSlotsScreen';
import { SlotDetailsScreen } from '../screens/SlotDetailsScreen';
import { TrainerSlotsScreen } from '../screens/TrainerSlotsScreen';
import { CreateSlotScreen } from '../screens/CreateSlotScreen';
import { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator initialRouteName="Home">
      <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Home' }} />
      <Stack.Screen name="Trainers" component={TrainersScreen} options={{ title: 'Trainers' }} />
      <Stack.Screen
        name="AvailableSlots"
        component={AvailableSlotsScreen}
        options={{ title: 'Available Slots' }}
      />
      <Stack.Screen
        name="SlotDetails"
        component={SlotDetailsScreen}
        options={{ title: 'Confirm Booking' }}
      />
      <Stack.Screen
        name="TrainerSlots"
        component={TrainerSlotsScreen}
        options={{ title: 'Trainer Slots' }}
      />
      <Stack.Screen
        name="CreateSlot"
        component={CreateSlotScreen}
        options={{ title: 'Create Slot' }}
      />
    </Stack.Navigator>
  );
}
