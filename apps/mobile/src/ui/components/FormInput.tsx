import type { ComponentProps } from 'react';
import { Input } from 'tamagui';
import { formInputProps } from '@ui/formDefaults';

type FormInputProps = ComponentProps<typeof Input>;

export function FormInput(props: FormInputProps) {
  return (
    <Input
      borderRadius="$4"
      {...formInputProps}
      {...props}
    />
  );
}
