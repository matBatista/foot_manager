import { useWindowDimensions, Platform } from 'react-native';

export interface Layout {
  isWide: boolean;   // >= 768px wide (tablet / desktop web)
  isWeb: boolean;
  width: number;
  height: number;
}

export function useLayout(): Layout {
  const { width, height } = useWindowDimensions();
  return {
    isWide: width >= 768,
    isWeb: Platform.OS === 'web',
    width,
    height,
  };
}
