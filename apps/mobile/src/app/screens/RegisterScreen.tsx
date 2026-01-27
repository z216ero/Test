// apps/mobile/src/navigation/screens/RegisterScreen.tsx
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack'
import { useMemo, useState } from 'react'
import { KeyboardAvoidingView, Platform } from 'react-native'
import { Button, ScrollView, Text, XStack, YStack } from 'tamagui'

import { register } from '../../api/authApi'
import { ApiError, getUiErrorMessage } from '../../api/core'
import { setAccessToken } from '../../auth/tokenStorage'
import {
  AuthCard,
  AuthError,
  AuthField,
  AuthFooter,
  AuthHeader,
  AuthPrimaryButton,
} from '../../ui/authUi'
import type { AuthStackParamList, RootStackParamList } from '../navigation/types'

const SPECIALIZATIONS = ['Strength', 'Mobility', 'Yoga', 'Pilates', 'HIIT'] as const

type Role = 'Trainer' | 'Client'
type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>

export function RegisterScreen({ navigation }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<Role>('Client')
  const [specialization, setSpecialization] = useState<(typeof SPECIALIZATIONS)[number]>(
    SPECIALIZATIONS[0]
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isTrainer = role === 'Trainer'
  const specializationValue = useMemo(
    () => (isTrainer ? specialization : undefined),
    [isTrainer, specialization]
  )

  const handleRegister = async () => {
    const emailTrimmed = email.trim()
    const nameTrimmed = name.trim()

    if (!emailTrimmed || !password || !nameTrimmed) {
      setError('Email, password, and name are required.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await register({
        email: emailTrimmed,
        password,
        name: nameTrimmed,
        role,
        specialization: specializationValue,
      })

      if (!response.accessToken) {
        throw new ApiError('Missing access token.')
      }

      await setAccessToken(response.accessToken)

      const rootNavigation =
        navigation.getParent<NativeStackNavigationProp<RootStackParamList>>()
      rootNavigation?.reset({ index: 0, routes: [{ name: 'App' }] })
    } catch (err) {
      setError(getUiErrorMessage(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <YStack flex={1} backgroundColor="$backgroundSoft">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          flex={1}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1,
            padding: 24,
            gap: 24,
          }}
        >
          <AuthHeader title="Get started" subtitle="Create your account to book sessions." />

          <AuthCard gap="$4" padding="$4">
            <AuthField
              label="Email"
              value={email}
              onChangeText={(v) => {
                setEmail(v)
                if (error) setError(null)
              }}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="you@example.com"
              textContentType="emailAddress"
            />

            <AuthField
              label="Password"
              value={password}
              onChangeText={(v) => {
                setPassword(v)
                if (error) setError(null)
              }}
              secureTextEntry
              placeholder="Choose a password"
              textContentType="password"
            />

            <AuthField
              label="Name"
              value={name}
              onChangeText={(v) => {
                setName(v)
                if (error) setError(null)
              }}
              placeholder="Your name"
              textContentType="name"
            />

            <YStack gap="$2">
              <Text fontSize="$3" color="$muted">
                Role
              </Text>

              <XStack
                padding="$1"
                backgroundColor="$backgroundSoft"
                borderRadius="$4"
                borderWidth={1}
                borderColor="$border"
                gap="$1"
              >
                {(['Client', 'Trainer'] as const).map((item) => {
                  const isSelected = role === item
                  return (
                    <Button
                      key={item}
                      unstyled
                      onPress={() => setRole(item)}
                      flex={1}
                      height="$10"
                      borderRadius="$3"
                      alignItems="center"
                      justifyContent="center"
                      backgroundColor={isSelected ? '$background' : 'transparent'}
                    >
                      <Text fontSize="$3" fontWeight={isSelected ? '700' : '400'} color="$text">
                        {item}
                      </Text>
                    </Button>
                  )
                })}
              </XStack>

            </YStack>
            {isTrainer ? (
              <YStack gap="$2">
                <Text fontSize="$3" color="$muted">
                  Specialization
                </Text>

                <XStack gap="$2" flexWrap="wrap">
                  {SPECIALIZATIONS.map((item) => {
                    const isSelected = specialization === item
                    return (
                      <Button
                        key={item}
                        size="$3"
                        onPress={() => setSpecialization(item)}
                        backgroundColor={isSelected ? '$background' : '$surfaceMuted'}
                        borderWidth={1}
                        borderColor={isSelected ? '$border' : '$border'}
                        borderRadius="$3"
                        height="$8"
                        pressStyle={{ opacity: 0.85 }}
                      >
                        <Text
                          fontSize="$3"
                          fontWeight={isSelected ? '700' : '500'}
                          color="$text"
                        >
                          {item}
                        </Text>
                      </Button>
                    )
                  })}
                </XStack>
              </YStack>
            ) : null}

            {error ? <AuthError message={error} /> : null}

            <AuthPrimaryButton onPress={handleRegister} disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create account'}
            </AuthPrimaryButton>
          </AuthCard>

          <AuthFooter
            text="Already have an account?"
            actionText="Log in"
            onPress={() => navigation.navigate('Login')}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </YStack>
  )
}
