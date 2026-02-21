import type { ComponentProps } from 'react';
import { FormInput } from './FormInput';
import { normalizeRussianPhoneInput } from '@utils/phone';

type PhoneInputProps = Omit<ComponentProps<typeof FormInput>, 'onChangeText' | 'value'> & {
  value: string;
  onChangeText: (value: string) => void;
};

export function PhoneInput({ value, onChangeText, ...props }: PhoneInputProps) {
  return (
    <FormInput
      value={value}
      onChangeText={(next: string) => onChangeText(normalizeRussianPhoneInput(next))}
      keyboardType="numeric"
      {...props}
    />
  );
}
