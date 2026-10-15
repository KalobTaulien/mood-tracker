import { useColorScheme } from 'react-native';

export type Palette = {
  bg: string;
  card: string;
  cardAlt: string;
  border: string;
  text: string;
  textMuted: string;
  textFaint: string;
  accent: string;
  accentSoft: string;
  danger: string;
  dangerSoft: string;
  mood: string;
  fatigue: string;
  success: string;
  overlay: string;
};

const light: Palette = {
  bg: '#F7F7FB',
  card: '#FFFFFF',
  cardAlt: '#F1F2F8',
  border: '#E3E4EF',
  text: '#15161C',
  textMuted: '#61637A',
  textFaint: '#9A9CB0',
  accent: '#5B6CFF',
  accentSoft: '#E8EAFF',
  danger: '#D2334D',
  dangerSoft: '#FCE9EC',
  mood: '#5B6CFF',
  fatigue: '#F2851F',
  success: '#1E9E6A',
  overlay: 'rgba(10,10,20,0.35)',
};

const dark: Palette = {
  bg: '#0E0E14',
  card: '#1A1B24',
  cardAlt: '#22232F',
  border: '#2E3040',
  text: '#F2F3F8',
  textMuted: '#A0A2B8',
  textFaint: '#6B6D82',
  accent: '#8B98FF',
  accentSoft: '#232640',
  danger: '#FF6B7F',
  dangerSoft: '#3A1E26',
  mood: '#8B98FF',
  fatigue: '#FFA552',
  success: '#49D19C',
  overlay: 'rgba(0,0,0,0.55)',
};

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}

export function useIsDark(): boolean {
  return useColorScheme() === 'dark';
}

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 } as const;

/** Red (low) -> amber (mid) -> green (high) across a 0-10 score. */
export function scoreColor(score: number, isDark: boolean): string {
  const clamped = Math.max(0, Math.min(10, score));
  const stops = isDark
    ? ['#FF6B7F', '#FF8A5B', '#FFB13D', '#C8D44A', '#49D19C']
    : ['#D2334D', '#E9622E', '#E39A12', '#8FA81E', '#1E9E6A'];
  const idx = Math.round((clamped / 10) * (stops.length - 1));
  return stops[idx];
}
