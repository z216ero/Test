import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, Text, YStack } from 'tamagui';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  return (
    <YStack
      flex={1}
      alignItems="center"
      justifyContent="center"
      gap="$4"
      padding="$6"
      backgroundColor="$background"
    >
      <Text fontSize="$8" fontWeight="700" color="$text">
        Fitness App
      </Text>
      <Button
        size="$4"
        backgroundColor="$primary"
        color="$primaryText"
        onPress={() => navigation.navigate('Trainers')}
      >
        Go to Trainers
      </Button>
    </YStack>
  );
}
