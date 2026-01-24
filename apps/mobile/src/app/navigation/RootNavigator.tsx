import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '../screens/HomeScreen';
import { TrainersScreen } from '../screens/TrainersScreen';
import { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator initialRouteName="Home">
      <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Home' }} />
      <Stack.Screen name="Trainers" component={TrainersScreen} options={{ title: 'Trainers' }} />
    </Stack.Navigator>
  );
}
