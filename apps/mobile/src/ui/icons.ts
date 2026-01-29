import type { LucideIcon } from 'lucide-react-native';
import {
  AlertCircle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Home,
  History,
  Info,
  Plus,
  Settings,
  User,
  X,
} from 'lucide-react-native';

export const iconsMap = {
  alertCircle: AlertCircle,
  calendar: Calendar,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  close: X,
  creditCard: CreditCard,
  home: Home,
  history: History,
  info: Info,
  plus: Plus,
  settings: Settings,
  user: User,
} as const satisfies Record<string, LucideIcon>;

export type AppIconName = keyof typeof iconsMap;
