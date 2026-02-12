import Clipboard from '@react-native-clipboard/clipboard';
import { Sheet } from '@tamagui/sheet';
import { Button, Text, XStack, YStack } from 'tamagui';
import { t } from '@i18n';
import { AppIcon } from '@ui/AppIcon';
import { useToast } from '@ui/feedback/useToast';

type ProfileSupportSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const hiddenOverlayStyle = { opacity: 0 } as const;
const telegramUsername = '@the_3er0';

export function ProfileSupportSheet({ open, onOpenChange }: ProfileSupportSheetProps) {
  const { showToast } = useToast();

  const handleCopyTelegram = () => {
    Clipboard.setString(telegramUsername);
    showToast({
      type: 'success',
      title: t('profile.support.telegramCopied'),
    });
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      dismissOnSnapToBottom
      snapPoints={[48]}
      dismissOnOverlayPress
    >
      <Sheet.Overlay
        animation="fast"
        enterStyle={hiddenOverlayStyle}
        exitStyle={hiddenOverlayStyle}
        backgroundColor="rgba(15, 23, 42, 0.2)"
      />
      <Sheet.Frame
        padding="$5"
        gap="$4"
        backgroundColor="$backgroundSoft"
        borderTopLeftRadius="$6"
        borderTopRightRadius="$6"
      >
        <Sheet.Handle />

        <YStack gap="$1">
          <Text fontSize="$6" fontWeight="700" color="$text">
            {t('profile.support.title')}
          </Text>
          <Text fontSize="$3" color="$muted">
            {t('profile.support.subtitle')}
          </Text>
        </YStack>

        <YStack
          backgroundColor="$background"
          borderRadius="$5"
          borderWidth={1}
          borderColor="$border"
          padding="$4"
          gap="$2"
        >
          <Text fontSize="$2" color="$muted">
            {t('profile.support.telegramLabel')}
          </Text>
          <XStack alignItems="center" justifyContent="space-between" gap="$2">
            <Text fontSize="$5" fontWeight="700" color="$text">
              {telegramUsername}
            </Text>
            <Button
              size="$3"
              circular
              chromeless
              onPress={handleCopyTelegram}
              accessibilityLabel={t('profile.support.copyTelegram')}
            >
              <AppIcon name="copy" size={16} color="$muted" />
            </Button>
          </XStack>
          <Text fontSize="$2" color="$muted">
            {t('profile.support.telegramHint')}
          </Text>
        </YStack>

        <Button
          backgroundColor="$accent"
          borderRadius="$4"
          minHeight="$10"
          onPress={() => onOpenChange(false)}
        >
          <Text color="$accentText" fontWeight="600">
            {t('common.close')}
          </Text>
        </Button>
      </Sheet.Frame>
    </Sheet>
  );
}
