import type { LucideIcon } from 'lucide-react-native';
import {
  AlertCircle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Check,
  CreditCard,
  Home,
  History,
  Info,
  Plus,
  Settings,
  Slash,
  Trash2,
  User,
  X,
} from 'lucide-react-native';

export const iconsMap = {
  alertCircle: AlertCircle,
  calendar: Calendar,
  check: Check,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  close: X,
  creditCard: CreditCard,
  home: Home,
  history: History,
  info: Info,
  plus: Plus,
  settings: Settings,
  slash: Slash,
  trash: Trash2,
  user: User,
} as const satisfies Record<string, LucideIcon>;

export type AppIconName = keyof typeof iconsMap;
