import { Sheet } from '@tamagui/sheet';
import { useEffect, useMemo, useState } from 'react';
import { Button, Text, XStack, YStack } from 'tamagui';
import { AppIcon } from '@ui/AppIcon';
import type { ClientGenderFilter, ClientSlotsFilters } from '@app/utils/clientSlotsFilters';
import type { LookupItem } from '@api/lookupsApi';
import { t } from '@i18n/index';

const normalizeSelection = (
  options: readonly string[],
  selection: string[]
): string[] => {
  const allowed = new Set(options);
  return selection.filter((item) => allowed.has(item));
};

type FilterSheetProps = {
  open: boolean;
  filters: ClientSlotsFilters;
  specializationOptions: readonly LookupItem[];
  genderOptions: readonly LookupItem[];
  resetGenderCode: string;
  onApply: (filters: ClientSlotsFilters) => void;
  onOpenChange: (open: boolean) => void;
};

export function FilterSheet({
  open,
  filters,
  specializationOptions,
  genderOptions,
  resetGenderCode,
  onApply,
  onOpenChange,
}: FilterSheetProps) {
  const specializationCodes = useMemo(
    () => specializationOptions.map((item) => item.code),
    [specializationOptions]
  );
  const [selectedSpecializations, setSelectedSpecializations] = useState<string[]>(
    normalizeSelection(specializationCodes, filters.specializations)
  );
  const [selectedGender, setSelectedGender] = useState<ClientGenderFilter>(
    filters.gender || resetGenderCode
  );

  useEffect(() => {
    if (open) {
      setSelectedSpecializations(
        normalizeSelection(specializationCodes, filters.specializations)
      );
      setSelectedGender(filters.gender || resetGenderCode);
    }
  }, [
    open,
    filters.gender,
    filters.specializations,
    resetGenderCode,
    specializationCodes,
  ]);

  const toggleSpecialization = (value: string) => {
    setSelectedSpecializations((prev) =>
      prev.includes(value)
        ? prev.filter((item) => item !== value)
        : [...prev, value]
    );
  };

  const handleReset = () => {
    setSelectedSpecializations([]);
    setSelectedGender(resetGenderCode);
  };

  const handleApply = () => {
    onApply({
      specializations: normalizeSelection(specializationCodes, selectedSpecializations),
      gender: selectedGender,
    });
    onOpenChange(false);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      dismissOnSnapToBottom
      snapPoints={[90]}
      dismissOnOverlayPress
    >
      <Sheet.Overlay
        animation="fast"
        enterStyle={{ opacity: 0 }}
        exitStyle={{ opacity: 0 }}
        backgroundColor="rgba(15, 23, 42, 0.2)"
      />
      <Sheet.Frame
        padding="$5"
        gap="$4"
        backgroundColor="$backgroundSoft"
        borderTopLeftRadius="$6"
        borderTopRightRadius="$6"
        flex={1}
      >
        <Sheet.Handle />
        <YStack gap="$4" flex={1}>
          <Text fontSize="$6" fontWeight="700" color="$text">
            {t('slots.filters.title')}
          </Text>
          <XStack gap="$3">
            <Button
              flex={1}
              backgroundColor="$background"
              borderRadius="$4"
              borderWidth={1}
              borderColor="$border"
              minHeight="$10"
              onPress={handleReset}
            >
              <Text color="$text">{t('slots.filters.reset')}</Text>
            </Button>
            <Button
              flex={1}
              backgroundColor="$accent"
              borderRadius="$4"
              minHeight="$10"
              onPress={handleApply}
            >
              <Text color="$accentText">{t('slots.filters.apply')}</Text>
            </Button>
          </XStack>

          <Sheet.ScrollView
            flex={1}
            minHeight={0}
            showsVerticalScrollIndicator={false}
          >
            <YStack gap="$4" paddingBottom="$3">
              <YStack
                gap="$3"
                padding="$4"
                backgroundColor="$background"
                borderRadius="$5"
                borderWidth={1}
                borderColor="$border"
              >
                <Text fontSize="$4" fontWeight="700" color="$text">
                  {t('slots.filters.specialization')}
                </Text>
                <XStack flexWrap="wrap" gap="$2">
                  {specializationOptions.map((option) => {
                    const selected = selectedSpecializations.includes(option.code);
                    return (
                      <Button
                        key={option.code}
                        unstyled
                        paddingHorizontal="$3"
                        paddingVertical="$2"
                        minHeight="$9"
                        borderRadius="$4"
                        backgroundColor={selected ? '$accent' : '$background'}
                        borderWidth={1}
                        borderColor={selected ? '$accent' : '$border'}
                        onPress={() => toggleSpecialization(option.code)}
                      >
                        <XStack alignItems="center" gap="$2">
                          <AppIcon
                            name="check"
                            size={16}
                            color={selected ? '$accentText' : '$muted'}
                          />
                          <Text
                            fontSize="$3"
                            color={selected ? '$accentText' : '$text'}
                          >
                            {option.label}
                          </Text>
                        </XStack>
                      </Button>
                    );
                  })}
                </XStack>
              </YStack>

              <YStack
                gap="$3"
                padding="$4"
                backgroundColor="$background"
                borderRadius="$5"
                borderWidth={1}
                borderColor="$border"
              >
                <Text fontSize="$4" fontWeight="700" color="$text">
                  {t('slots.filters.gender')}
                </Text>
                <YStack gap="$2">
                  {genderOptions.map((option) => {
                    const selected = selectedGender === option.code;
                    return (
                      <Button
                        key={option.code}
                        unstyled
                        backgroundColor="$background"
                        borderRadius="$4"
                        borderWidth={1}
                        borderColor={selected ? '$accent' : '$border'}
                        padding="$3"
                        minHeight="$10"
                        width="100%"
                        justifyContent="flex-start"
                        onPress={() => setSelectedGender(option.code)}
                      >
                        <XStack alignItems="center" gap="$3" flex={1}>
                          <YStack
                            width="$4"
                            height="$4"
                            borderRadius="$10"
                            borderWidth={1}
                            borderColor={selected ? '$accent' : '$border'}
                            backgroundColor={selected ? '$accent' : '$background'}
                            alignItems="center"
                            justifyContent="center"
                          >
                            {selected ? (
                              <AppIcon name="check" size={12} color="$accentText" />
                            ) : null}
                          </YStack>
                          <Text fontSize="$3" color="$text">
                            {option.label}
                          </Text>
                        </XStack>
                      </Button>
                    );
                  })}
                </YStack>
              </YStack>
            </YStack>
          </Sheet.ScrollView>


        </YStack>
      </Sheet.Frame>
    </Sheet>
  );
}
