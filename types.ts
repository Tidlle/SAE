export interface NavItem {
  label: string;
  path: string;
  icon?: React.ReactNode;
  children?: NavItem[];
}

export interface Course {
  id: string;
  title: string;
  instructor: string;
  level: 'Iniciante' | 'Intermediário' | 'Avançado';
  date?: string;
  image: string;
  price?: number;
  originalPrice?: number;
  category: string;
}

export interface Stat {
  label: string;
  value: string;
  icon: React.ReactNode;
}