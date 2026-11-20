export type ThemeMode = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'camio_theme_mode';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function isValidThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark';
}

export function resolveInitialTheme(
  storage?: Pick<StorageLike, 'getItem'> | null,
  prefersDark = false
): ThemeMode {
  if (storage) {
    try {
      const saved = storage.getItem(THEME_STORAGE_KEY);
      if (isValidThemeMode(saved)) {
        return saved;
      }
    } catch {
      // Ignore storage access errors (private browsing / restricted storage)
    }
  }
  return prefersDark ? 'dark' : 'light';
}

export function persistThemeMode(
  mode: ThemeMode,
  storage?: Pick<StorageLike, 'setItem'> | null
): void {
  if (!storage) return;
  try {
    storage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // Ignore storage quota or security errors
  }
}

export function toggleThemeMode(current: ThemeMode): ThemeMode {
  return current === 'dark' ? 'light' : 'dark';
}

export function applyThemeToElement(
  root: { classList: { toggle(token: string, force?: boolean): boolean }; style?: { colorScheme?: string } } | null | undefined,
  mode: ThemeMode
): void {
  if (!root) return;
  root.classList.toggle('dark', mode === 'dark');
  if (root.style) {
    root.style.colorScheme = mode;
  }
}
