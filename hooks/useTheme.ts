import {
  ComputerDesktopIcon,
  MoonIcon,
  SunIcon,
} from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';
import { useTranslation } from 'next-i18next';
import { Theme, ThemesProps, applyTheme } from '@/lib/theme';

// Función para obtener el tema inicial
const getInitialTheme = (): Theme => {
  if (typeof window === 'undefined') return 'system';
  
  const savedTheme = localStorage.getItem('theme') as Theme;
  if (savedTheme) return savedTheme;
  
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
};

const useTheme = () => {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const { t } = useTranslation('common');

  // Efecto para sincronizar el tema con localStorage y aplicarlo
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'theme' && e.newValue) {
        const newTheme = e.newValue as Theme;
        setTheme(newTheme);
        applyTheme(newTheme);
      }
    };

    // Aplicar tema inicial
    applyTheme(theme);
    localStorage.setItem('theme', theme);

    // Escuchar cambios en localStorage
    window.addEventListener('storage', handleStorageChange);
    
    // Escuchar cambios en las preferencias del sistema
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleMediaChange = (e: MediaQueryListEvent) => {
      if (theme === 'system') {
        const newTheme = e.matches ? 'dark' : 'light';
        applyTheme(newTheme);
      }
    };
    
    mediaQuery.addEventListener('change', handleMediaChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      mediaQuery.removeEventListener('change', handleMediaChange);
    };
  }, [theme]);

  const themes: ThemesProps[] = [
    {
      id: 'system',
      name: t('system'),
      icon: ComputerDesktopIcon,
    },
    {
      id: 'dark',
      name: t('dark'),
      icon: MoonIcon,
    },
    {
      id: 'light',
      name: t('light'),
      icon: SunIcon,
    },
  ];

  const selectedTheme = themes.find((t) => t.id === theme) || themes[0];

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  return { theme, setTheme, selectedTheme, toggleTheme, themes };
};

export default useTheme;
