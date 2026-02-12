import type { ComponentProps, ReactNode } from 'react';
import { Button, Input, ScrollView, Text, XStack, YStack } from 'tamagui';

type StackProps = ComponentProps<typeof YStack>;
type InputProps = ComponentProps<typeof Input>;
type ButtonProps = ComponentProps<typeof Button>;

type AuthHeaderProps = {
  title: string;
  subtitle: string;
};

type AuthFieldProps = InputProps & {
  label: string;
};

type AuthFooterProps = {
  text: string;
  actionText: string;
  onPress: () => void;
  variant?: 'row' | 'column';
};

type AuthErrorProps = {
  message: string;
};

export function AuthScreen({ children }: { children: ReactNode }) {
  return (
    <YStack flex={1} backgroundColor="$backgroundSoft">
      <ScrollView
        flex={1}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          padding: 24,
          paddingTop: 24,
          paddingBottom: 24,
          gap: 24,
        }}
      >
        {children}
      </ScrollView>
    </YStack>
  )
}

export function AuthHeader({ title, subtitle }: AuthHeaderProps) {
  return (
    <YStack gap="$2">
      <Text fontSize="$8" fontWeight="700" color="$text">
        {title}
      </Text>
      <Text fontSize="$4" color="$muted">
        {subtitle}
      </Text>
    </YStack>
  );
}

export function AuthCard({ children, ...props }: StackProps) {
  return (
    <YStack
      gap="$4"
      padding="$4"
      backgroundColor="$background"
      borderRadius="$4"
      borderWidth={1}
      borderColor="$border"
      {...props}
    >
      {children}
    </YStack>
  )
}

export function AuthField({ label, ...inputProps }: AuthFieldProps) {
  return (
    <YStack gap="$2">
      <Text fontSize="$3" color="$muted">
        {label}
      </Text>
      <Input
        backgroundColor="$surfaceMuted"
        borderColor="$border"
        borderWidth={1}
        borderRadius="$3"
        paddingHorizontal="$4"
        verticalAlign="center"
        fontSize="$3"
        color="$text"
        placeholderTextColor="$muted"
        height={40}
        {...inputProps}
      />
    </YStack>
  )
}


export function AuthPrimaryButton({ children, ...props }: ButtonProps) {
  return (
    <Button
      size="$4"
      backgroundColor="$accent"
      color="$accentText"
      borderRadius="$4"
      height="$10"
      {...props}
    >
      {children}
    </Button>
  )
}


export function AuthError({ message }: AuthErrorProps) {
  return (
    <Text fontSize="$3" color="$text" fontWeight="700">
      {message}
    </Text>
  );
}

export function AuthFooter({ text, actionText, onPress, variant = 'row' }: AuthFooterProps) {
  if (variant === 'column') {
    return (
      <YStack alignItems="center" gap="$2">
        <Text fontSize="$3" color="$muted">
          {text}
        </Text>
        <Text fontSize="$3" fontWeight="700" color="$text" onPress={onPress}>
          {actionText}
        </Text>
      </YStack>
    );
  }

  return (
    <XStack justifyContent="center" gap="$2">
      <Text fontSize="$3" color="$muted">
        {text}
      </Text>
      <Text fontSize="$3" fontWeight="700" color="$text" onPress={onPress}>
        {actionText}
      </Text>
    </XStack>
  );
}
