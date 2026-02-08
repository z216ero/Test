import type { ComponentProps, ReactNode } from 'react';
import { Button } from 'tamagui';
import { primaryButtonProps } from '@ui/formDefaults';

type PrimaryButtonProps = Omit<ComponentProps<typeof Button>, 'children'> & {
  children: ReactNode;
};

export function PrimaryButton({ children, ...props }: PrimaryButtonProps) {
  return (
    <Button
      backgroundColor="$accent"
      color="$accentText"
      borderRadius="$4"
      {...primaryButtonProps}
      {...props}
    >
      {children}
    </Button>
  );
}
