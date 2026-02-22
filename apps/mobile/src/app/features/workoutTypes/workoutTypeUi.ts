import type { TrainerWorkoutType, WorkoutTypeCategory } from '@api/workoutTypesApi';

export const workoutTypeCategoryOrder: WorkoutTypeCategory[] = [
  'Strength',
  'Cardio',
  'Mobility',
  'Rehab',
  'Technique',
  'Other',
];

export const workoutTypeCategoryLabels: Record<WorkoutTypeCategory, string> = {
  Strength: 'Силовые',
  Cardio: 'Кардио',
  Mobility: 'Мобильность',
  Rehab: 'Реабилитация',
  Technique: 'Техника',
  Other: 'Другое',
};

export const getWorkoutTypeCategoryLabel = (category?: string | null): string => {
  if (!category) {
    return workoutTypeCategoryLabels.Other;
  }
  return workoutTypeCategoryLabels[(category as WorkoutTypeCategory) ?? 'Other'] ?? category;
};

export const groupWorkoutTypesByCategory = (items: TrainerWorkoutType[]) =>
  workoutTypeCategoryOrder
    .map((category) => ({
      category,
      title: workoutTypeCategoryLabels[category],
      items: items
        .filter((item) => item.category === category)
        .sort((a, b) => a.name.localeCompare(b.name, 'ru')),
    }))
    .filter((group) => group.items.length > 0);
