import { Button, Text, XStack, YStack } from 'tamagui';
import type { LookupItem } from '@api/lookupsApi';
import { t } from '@i18n';
import { getGenderLabel, getRoleLabel } from '../registerFormValidation';

type RegisterLookupsSectionProps = {
  roleOptions: LookupItem[];
  selectedRole: string;
  onSelectRole: (role: string) => void;
  showRoleError: boolean;
  genderOptions: LookupItem[];
  selectedGender: string;
  onSelectGender: (gender: string) => void;
  showGenderError: boolean;
  isTrainer: boolean;
  specializationOptions: LookupItem[];
  selectedSpecialization: string;
  onSelectSpecialization: (specialization: string) => void;
  showSpecializationError: boolean;
};

export function RegisterLookupsSection({
  roleOptions,
  selectedRole,
  onSelectRole,
  showRoleError,
  genderOptions,
  selectedGender,
  onSelectGender,
  showGenderError,
  isTrainer,
  specializationOptions,
  selectedSpecialization,
  onSelectSpecialization,
  showSpecializationError,
}: RegisterLookupsSectionProps) {
  return (
    <>
      <YStack gap="$2">
        <Text fontSize="$3" color="$muted">
          {t('auth.register.role')}
        </Text>
        <XStack gap="$2" padding="$2" backgroundColor="$backgroundSoft" borderRadius="$3">
          {roleOptions.map((item) => {
            const isSelected = selectedRole === item.code;
            return (
              <Button
                key={item.code}
                size="$3"
                backgroundColor={isSelected ? '$accent' : '$backgroundSoft'}
                color={isSelected ? '$accentText' : '$text'}
                fontWeight={isSelected ? '700' : '400'}
                borderWidth={1}
                borderColor={isSelected ? '$accent' : '$border'}
                borderRadius="$3"
                onPress={() => onSelectRole(item.code)}
                flex={1}
                minHeight="$10"
              >
                {getRoleLabel(item.code)}
              </Button>
            );
          })}
        </XStack>
        {showRoleError ? (
          <Text fontSize="$2" color="$danger">
            {t('auth.register.roleRequired')}
          </Text>
        ) : null}
      </YStack>

      <YStack gap="$2">
        <Text fontSize="$3" color="$muted">
          {t('profile.personal.genderUserLabel')}
        </Text>
        <XStack gap="$2" padding="$2" backgroundColor="$backgroundSoft" borderRadius="$3">
          {genderOptions.map((item) => {
            const isSelected = selectedGender === item.code;
            return (
              <Button
                key={item.code}
                size="$3"
                backgroundColor={isSelected ? '$accent' : '$backgroundSoft'}
                color={isSelected ? '$accentText' : '$text'}
                fontWeight={isSelected ? '700' : '400'}
                borderWidth={1}
                borderColor={isSelected ? '$accent' : '$border'}
                borderRadius="$3"
                onPress={() => onSelectGender(item.code)}
                flex={1}
                minHeight="$10"
              >
                {getGenderLabel(item.code)}
              </Button>
            );
          })}
        </XStack>
        {showGenderError ? (
          <Text fontSize="$2" color="$danger">
            {t('auth.register.genderRequired')}
          </Text>
        ) : null}
      </YStack>

      {isTrainer ? (
        <YStack gap="$2">
          <Text fontSize="$3" color="$muted">
            {t('auth.register.specialization')}
          </Text>
          <XStack gap="$2" flexWrap="wrap">
            {specializationOptions.map((item) => {
              const isSelected = selectedSpecialization === item.code;
              return (
                <Button
                  key={item.code}
                  size="$3"
                  backgroundColor={isSelected ? '$background' : '$surfaceMuted'}
                  color="$text"
                  fontWeight={isSelected ? '700' : '400'}
                  borderWidth={1}
                  borderColor="$border"
                  borderRadius="$3"
                  onPress={() => onSelectSpecialization(item.code)}
                  minHeight="$9"
                >
                  {item.label}
                </Button>
              );
            })}
          </XStack>
          {showSpecializationError ? (
            <Text fontSize="$2" color="$danger">
              {t('auth.register.specializationRequired')}
            </Text>
          ) : null}
        </YStack>
      ) : null}
    </>
  );
}

