import { useState } from 'react';
import { Button } from 'tamagui';
import type { AvailableSlotTrainerDto } from '@generated/api';
import { Avatar, useAuthorizedImageSource } from '@ui/components';
import { TrainerProfileSheet } from '@app/screens/slots/ui/TrainerProfileSheet';

type TrainerAvatarProps = {
  name?: string | null;
  avatarUrl?: string | null;
  size?: number | string;
  trainerProfile?: AvailableSlotTrainerDto | null;
  disableProfileSheet?: boolean;
};

export function TrainerAvatar({
  name,
  avatarUrl,
  size = '$9',
  trainerProfile,
  disableProfileSheet = false,
}: TrainerAvatarProps) {
  const avatarSource = useAuthorizedImageSource(avatarUrl);
  const [sheetOpen, setSheetOpen] = useState(false);

  const avatar = (
    <Avatar
      name={name}
      source={avatarSource}
      size={size}
      borderRadius="$6"
      textSize="$4"
    />
  );

  if (!trainerProfile || disableProfileSheet) {
    return avatar;
  }

  return (
    <>
      <Button
        unstyled
        onPress={() => setSheetOpen(true)}
      >
        {avatar}
      </Button>
      <TrainerProfileSheet
        open={sheetOpen}
        trainer={trainerProfile}
        onOpenChange={setSheetOpen}
      />
    </>
  );
}


