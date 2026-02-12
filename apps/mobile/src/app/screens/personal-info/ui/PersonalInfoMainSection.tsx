import { Button, Text, XStack, YStack } from 'tamagui';
import { t } from '@i18n';
import { AppIcon } from '@ui/AppIcon';
import { FormInput, SelectFieldButton } from '@ui/components';
import { useAppTheme } from '@app/theme/AppThemeContext';

type LookupOption = {
  code: string;
  label: string;
};

type PersonalInfoMainSectionProps = {
  name: string;
  onChangeName: (value: string) => void;
  phoneNumber: string;
  onChangePhoneNumber: (value: string) => void;
  cityName: string;
  districtName: string;
  onSelectCity: () => void;
  onSelectDistrict: () => void;
  userGenderOptions: LookupOption[];
  userGender: string;
  onSelectUserGender: (code: string) => void;
  isTrainer: boolean;
  pricePerSession: string;
  onChangePrice: (value: string) => void;
  priceHint: string;
  email: string;
};

export function PersonalInfoMainSection({
  name,
  onChangeName,
  phoneNumber,
  onChangePhoneNumber,
  cityName,
  districtName,
  onSelectCity,
  onSelectDistrict,
  userGenderOptions,
  userGender,
  onSelectUserGender,
  isTrainer,
  pricePerSession,
  onChangePrice,
  priceHint,
  email,
}: PersonalInfoMainSectionProps) {
  const { isDark } = useAppTheme();

  return (
    <YStack
      gap="$3"
      padding="$4"
      backgroundColor="$background"
      borderRadius="$5"
      borderWidth={1}
      borderColor="$border"
    >
      <Text fontSize="$4" fontWeight="700" color="$text">
        {t('profile.personal.main')}
      </Text>
      <YStack gap="$2">
        <Text fontSize="$3" color="$text">
          {t('profile.personal.name')}
        </Text>
        <FormInput
          value={name}
          onChangeText={onChangeName}
          placeholder={t('profile.personal.name')}
        />
      </YStack>
      <YStack gap="$2">
        <Text fontSize="$3" color="$text">
          {t('profile.personal.phone')}
        </Text>
        <FormInput
          value={phoneNumber}
          onChangeText={onChangePhoneNumber}
          placeholder={t('profile.personal.phonePlaceholder')}
          keyboardType="numeric"
        />
      </YStack>
      <YStack gap="$2">
        <Text fontSize="$3" color="$text">
          {t('profile.personal.city')}
        </Text>
        <SelectFieldButton
          value={cityName}
          placeholder={t('profile.personal.cityPlaceholder')}
          onPress={onSelectCity}
        />
      </YStack>
      <YStack gap="$2">
        <Text fontSize="$3" color="$text">
          {t('profile.personal.district')}
        </Text>
        <SelectFieldButton
          value={districtName}
          placeholder={t('profile.personal.districtPlaceholder')}
          onPress={onSelectDistrict}
        />
      </YStack>
      <YStack gap="$2">
        <Text fontSize="$3" color="$text">
          {t('profile.personal.genderUserLabel')}
        </Text>
        <XStack gap="$2" flexWrap="wrap">
          {userGenderOptions.map((option) => {
            const selected = userGender === option.code;
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
                onPress={() => onSelectUserGender(option.code)}
              >
                <XStack alignItems="center" gap="$2">
                  <AppIcon
                    name="check"
                    size={16}
                    color={selected ? '$accentText' : '$muted'}
                  />
                  <Text fontSize="$3" color={selected ? '$accentText' : '$text'}>
                    {option.label}
                  </Text>
                </XStack>
              </Button>
            );
          })}
        </XStack>
      </YStack>
      {isTrainer ? (
        <YStack gap="$2">
          <Text fontSize="$3" color="$text">
            {t('profile.personal.price')}
          </Text>
          <FormInput
            value={pricePerSession}
            onChangeText={onChangePrice}
            placeholder={t('profile.personal.pricePlaceholder')}
            color={isDark ? '#FFFFFF' : '#0F172A'}
            placeholderTextColor={isDark ? '#FFFFFF' : '#64748B'}
            keyboardType="numeric"
          />
          <Text fontSize="$2" color="$muted">
            {priceHint}
          </Text>
        </YStack>
      ) : null}
      {email ? (
        <YStack gap="$2">
          <Text fontSize="$3" color="$text">
            {t('profile.personal.email')}
          </Text>
          <FormInput
            value={email}
            editable={false}
            backgroundColor="$surfaceMuted"
            color="$muted"
          />
        </YStack>
      ) : null}
    </YStack>
  );
}
