import { createTamagui } from '@tamagui/core';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'react-native';
import { enableScreens } from 'react-native-screens';
import { TamaguiProvider } from 'tamagui';
import { RootNavigator } from './src/app/navigation/RootNavigator';
import { config } from './tamagui.config';

const tamaguiConfig = createTamagui(config);
enableScreens();

function App() {
  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <StatusBar barStyle="dark-content" />
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </TamaguiProvider>
  );
}

export default App;
