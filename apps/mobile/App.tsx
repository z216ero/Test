import { NavigationContainer } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'react-native';
import { enableScreens } from 'react-native-screens';
import { PortalProvider } from '@tamagui/portal';
import { TamaguiProvider } from 'tamagui';
import { RootNavigator } from './src/app/navigation/RootNavigator';
import { queryClient } from './src/query/queryClient';
import { ToastProvider } from './src/ui/feedback/ToastProvider';
import config from './tamagui.config';

enableScreens();

function App() {
  return (
    <TamaguiProvider config={config} defaultTheme="light">
      <StatusBar barStyle="dark-content" />
      <PortalProvider shouldAddRootHost>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <NavigationContainer>
              <RootNavigator />
            </NavigationContainer>
          </ToastProvider>
        </QueryClientProvider>
      </PortalProvider>
    </TamaguiProvider>
  );
}

export default App;
