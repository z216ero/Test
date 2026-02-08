import { Button, Text, XStack, YStack } from 'tamagui';
import { t } from '@i18n';
import { secondaryButtonProps } from '@ui/formDefaults';
import { AppIcon } from '@ui/AppIcon';
import { FormInput } from '@ui/components';

type LookupOption = {
  code: string;
  label: string;
};

type PersonalInfoTrainerSectionsProps = {
  isTrainer: boolean;
  about: string;
  onChangeAbout: (value: string) => void;
  specializationOptions: LookupOption[];
  specializations: string[];
  onToggleSpecialization: (code: string) => void;
  visibleTrainingTypes: LookupOption[];
  trainingTypes: string[];
  onToggleTrainingType: (code: string) => void;
  hasMoreTrainingTypes: boolean;
  trainingTypesExpanded: boolean;
  onToggleTrainingTypesExpanded: () => void;
  genderOptions: LookupOption[];
  worksWithGender: string;
  onSelectWorksWithGender: (code: string) => void;
};

const ChipButton = ({
  selected,
  label,
  onPress,
}: {
  selected: boolean;
  label: string;
  onPress: () => void;
}) => (
  <Button
    unstyled
    paddingHorizontal="$3"
    paddingVertical="$2"
    minHeight="$9"
    borderRadius="$4"
    backgroundColor={selected ? '$accent' : '$background'}
    borderWidth={1}
    borderColor={selected ? '$accent' : '$border'}
    onPress={onPress}
  >
    <XStack alignItems="center" gap="$2">
      <AppIcon
        name="check"
        size={16}
        color={selected ? '$accentText' : '$muted'}
      />
      <Text fontSize="$3" color={selected ? '$accentText' : '$text'}>
        {label}
      </Text>
    </XStack>
  </Button>
);

export function PersonalInfoTrainerSections({
  isTrainer,
  about,
  onChangeAbout,
  specializationOptions,
  specializations,
  onToggleSpecialization,
  visibleTrainingTypes,
  trainingTypes,
  onToggleTrainingType,
  hasMoreTrainingTypes,
  trainingTypesExpanded,
  onToggleTrainingTypesExpanded,
  genderOptions,
  worksWithGender,
  onSelectWorksWithGender,
}: PersonalInfoTrainerSectionsProps) {
  if (!isTrainer) {
    return null;
  }

  return (
    <>
      <YStack
        gap="$3"
        padding="$4"
        backgroundColor="$background"
        borderRadius="$5"
        borderWidth={1}
        borderColor="$border"
      >
        <Text fontSize="$4" fontWeight="700" color="$text">
          {t('profile.personal.about')}
        </Text>
        <FormInput
          value={about}
          onChangeText={onChangeAbout}
          placeholder={t('profile.personal.aboutPlaceholder')}
          multiline
          numberOfLines={4}
          maxLength={250}
          height={120}
          textAlignVertical="top"
        />
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
          {t('profile.personal.specializations')}
        </Text>
        <XStack flexWrap="wrap" gap="$2">
          {specializationOptions.map((option) => (
            <ChipButton
              key={option.code}
              selected={specializations.includes(option.code)}
              label={option.label}
              onPress={() => onToggleSpecialization(option.code)}
            />
          ))}
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
          {t('profile.personal.trainingTypes')}
        </Text>
        <XStack flexWrap="wrap" gap="$2">
          {visibleTrainingTypes.map((option) => (
            <ChipButton
              key={option.code}
              selected={trainingTypes.includes(option.code)}
              label={option.label}
              onPress={() => onToggleTrainingType(option.code)}
            />
          ))}
        </XStack>
        {hasMoreTrainingTypes ? (
          <Button
            minHeight="$2"
            backgroundColor="$background"
            borderRadius="$4"
            borderWidth={1}
            borderColor="$border"
            onPress={onToggleTrainingTypesExpanded}
            paddingHorizontal="$3"
            {...secondaryButtonProps}
          >
            <Text fontSize="$3" color="$text">
              {trainingTypesExpanded
                ? t('profile.personal.trainingTypesHide')
                : t('profile.personal.trainingTypesShowMore')}
            </Text>
          </Button>
        ) : null}
        <YStack gap="$2">
          <Text fontSize="$4" fontWeight="700" color="$text">
            {t('profile.personal.genderLabel')}
          </Text>
          <YStack gap="$2">
            {genderOptions.map((option) => {
              const selected = worksWithGender === option.code;
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
                  onPress={() => onSelectWorksWithGender(option.code)}
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
    </>
  );
}
