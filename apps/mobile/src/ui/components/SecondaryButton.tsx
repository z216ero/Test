import type { ComponentProps, ReactNode } from 'react';
import { Button } from 'tamagui';
import { secondaryButtonProps } from '@ui/formDefaults';

type SecondaryButtonProps = Omit<ComponentProps<typeof Button>, 'children'> & {
  children: ReactNode;
};

export function SecondaryButton({ children, ...props }: SecondaryButtonProps) {
  return (
    <Button
      backgroundColor="$background"
      borderRadius="$4"
      borderWidth={1}
      borderColor="$border"
      {...secondaryButtonProps}
      {...props}
    >
      {children}
    </Button>
  );
}
