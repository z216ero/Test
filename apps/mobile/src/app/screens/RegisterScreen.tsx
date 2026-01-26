import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { Button, Input, Text, XStack, YStack } from 'tamagui';
import { setAccessToken } from '../../auth/tokenStorage';
import { register } from '../../api/authApi';
import { ApiError, getUiErrorMessage } from '../../api/core';
import {
  formInputProps,
  primaryButtonProps,
  secondaryButtonProps,
} from '../../ui/formDefaults';
import type { AuthStackParamList, RootStackParamList } from '../navigation/types';

const SPECIALIZATIONS = ['Strength', 'Mobility', 'Yoga', 'Pilates', 'HIIT'];

type Role = 'Trainer' | 'Client';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export function RegisterScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('Client');
  const [specialization, setSpecialization] = useState(SPECIALIZATIONS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isTrainer = role === 'Trainer';
  const specializationValue = useMemo(
    () => (isTrainer ? specialization : undefined),
    [isTrainer, specialization]
  );

  const handleRegister = async () => {
    if (!email.trim() || !password || !name.trim()) {
      setError('Email, password, and name are required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await register({
        email: email.trim(),
        password,
        name: name.trim(),
        role,
        specialization: specializationValue,
      });

      if (!response.accessToken) {
        throw new ApiError('Missing access token.');
      }

      await setAccessToken(response.accessToken);
      const rootNavigation =
        navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
      rootNavigation?.reset({ index: 0, routes: [{ name: 'App' }] });
    } catch (err) {
      setError(getUiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <YStack flex={1} padding="$6" gap="$4" backgroundColor="$background">
      <Text fontSize="$7" fontWeight="700" color="$text">
        Create account
      </Text>
      <YStack gap="$2">
        <Text fontSize="$3" color="$text">
          Email
        </Text>
        <Input
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          placeholder="you@example.com"
          {...formInputProps}
        />
      </YStack>
      <YStack gap="$2">
        <Text fontSize="$3" color="$text">
          Password
        </Text>
        <Input
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Choose a password"
          {...formInputProps}
        />
      </YStack>
      <YStack gap="$2">
        <Text fontSize="$3" color="$text">
          Name
        </Text>
        <Input
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          {...formInputProps}
        />
      </YStack>
      <YStack gap="$2">
        <Text fontSize="$3" color="$text">
          Role
        </Text>
        <XStack gap="$2">
          {(['Client', 'Trainer'] as Role[]).map((item) => {
            const isSelected = role === item;
            return (
              <Button
                key={item}
                size="$3"
                backgroundColor={isSelected ? '$primary' : '$background'}
                color={isSelected ? '$primaryText' : '$text'}
                borderWidth={1}
                borderColor="$border"
                onPress={() => setRole(item)}
                flex={1}
              >
                {item}
              </Button>
            );
          })}
        </XStack>
      </YStack>
      {isTrainer ? (
        <YStack gap="$2">
          <Text fontSize="$3" color="$text">
            Specialization
          </Text>
          <XStack gap="$2" flexWrap="wrap">
            {SPECIALIZATIONS.map((item) => {
              const isSelected = specialization === item;
              return (
                <Button
                  key={item}
                  size="$3"
                  backgroundColor={isSelected ? '$primary' : '$background'}
                  color={isSelected ? '$primaryText' : '$text'}
                  borderWidth={1}
                  borderColor="$border"
                  onPress={() => setSpecialization(item)}
                >
                  {item}
                </Button>
              );
            })}
          </XStack>
        </YStack>
      ) : null}
      {error ? (
        <Text fontSize="$3" color="$primary">
          {error}
        </Text>
      ) : null}
      <Button
        size="$4"
        backgroundColor="$primary"
        color="$primaryText"
        onPress={handleRegister}
        disabled={isSubmitting}
        {...primaryButtonProps}
      >
        {isSubmitting ? 'Creating...' : 'Register'}
      </Button>
      <Button
        size="$3"
        onPress={() => navigation.navigate('Login')}
        {...secondaryButtonProps}
      >
        Back to login
      </Button>
    </YStack>
  );
}
