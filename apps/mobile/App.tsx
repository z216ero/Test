import { createTamagui } from '@tamagui/core';
import { StatusBar } from 'react-native';
import { Button, TamaguiProvider, Text, XStack, YStack } from 'tamagui';
import { config } from './tamagui.config';

const tamaguiConfig = createTamagui(config);

function App() {
  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <StatusBar barStyle="dark-content" />
      <AppContent />
    </TamaguiProvider>
  );
}

function AppContent() {
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
      <Text fontSize="$4" color="$muted" textAlign="center">
        Tamagui is working
      </Text>
      <XStack>
        <Button size="$4" backgroundColor="$primary" color="$primaryText" height="$8">
          Continue1
        </Button>
      </XStack>
      <Button size="$4" backgroundColor="$primary" color="$primaryText" height="$4">
        Continue1
      </Button>
      <Button width="1000" minHeight={100} size="$4" backgroundColor="$primary" textAlign='left' color="$primaryText" height="$4">
        Continue1
      </Button>
    </YStack>
  );
}

export default App;
