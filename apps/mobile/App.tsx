import { NavigationContainer } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'react-native';
import { enableScreens } from 'react-native-screens';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { PortalProvider } from '@tamagui/portal';
import { TamaguiProvider } from 'tamagui';
import { RootNavigator } from './src/app/navigation/RootNavigator';
import { queryClient } from './src/query/queryClient';
import { ToastProvider } from './src/ui/feedback/ToastProvider';
import config from './tamagui.config.cjs';

enableScreens();

const tokens = config.tokens;
type TokenValue<T> = { val: T } | T;
const isTokenValue = <T,>(value: TokenValue<T>): value is { val: T } =>
  typeof value === 'object' && value !== null && 'val' in value;
const getTokenValue = <T,>(token: TokenValue<T> | undefined): T | undefined =>
  token && isTokenValue(token) ? token.val : token;

const baseInsetPadding = (getTokenValue(tokens.space[2]) as number) ?? 8;
const safeAreaBackground = (getTokenValue(tokens.color.background) as string) ?? '#ffffff';

function App() {
  return (
    <SafeAreaProvider>
      <TamaguiProvider config={config} defaultTheme="light">
        <SafeAreaView
          style={{
            flex: 1,
            backgroundColor: safeAreaBackground,
            paddingTop: baseInsetPadding,
            paddingBottom: baseInsetPadding,
          }}
          edges={{ top: 'additive', bottom: 'additive' }}
        >
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
        </SafeAreaView>
      </TamaguiProvider>
    </SafeAreaProvider>
  );
}

export default App;
