import type { ComponentProps } from 'react';
import { Input } from 'tamagui';
import { formInputProps } from '@ui/formDefaults';

type FormInputProps = ComponentProps<typeof Input>;

export function FormInput(props: FormInputProps) {
  return (
    <Input
      backgroundColor="$background"
      borderWidth={1}
      borderColor="$border"
      color="$text"
      placeholderTextColor="$muted"
      fontSize="$4"
      paddingHorizontal="$4"
      borderRadius="$4"
      {...formInputProps}
      {...props}
    />
  );
}
