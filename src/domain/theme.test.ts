import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyThemeToElement,
  isValidThemeMode,
  persistThemeMode,
  resolveInitialTheme,
  THEME_STORAGE_KEY,
  toggleThemeMode,
} from './theme';

describe('theme domain helpers', () => {
  it('validates supported theme modes strictly', () => {
    assert.equal(isValidThemeMode('light'), true);
    assert.equal(isValidThemeMode('dark'), true);
    assert.equal(isValidThemeMode('sepia'), false);
    assert.equal(isValidThemeMode(null), false);
  });

  it('prefers valid persisted storage value over system preference', () => {
    const storage = {
      getItem: (key: string) => (key === THEME_STORAGE_KEY ? 'dark' : null),
    };
    assert.equal(resolveInitialTheme(storage, false), 'dark');

    const lightStorage = {
      getItem: (key: string) => (key === THEME_STORAGE_KEY ? 'light' : null),
    };
    assert.equal(resolveInitialTheme(lightStorage, true), 'light');
  });

  it('falls back to system preference when storage is empty or invalid', () => {
    const invalidStorage = {
      getItem: () => 'midnight-blue',
    };
    assert.equal(resolveInitialTheme(invalidStorage, true), 'dark');
    assert.equal(resolveInitialTheme(invalidStorage, false), 'light');
    assert.equal(resolveInitialTheme(null, false), 'light');
  });

  it('handles storage read/write exceptions gracefully', () => {
    const brokenStorage = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    assert.equal(resolveInitialTheme(brokenStorage, false), 'light');
    assert.doesNotThrow(() => persistThemeMode('dark', brokenStorage));
  });

  it('toggles cleanly between light and dark', () => {
    assert.equal(toggleThemeMode('light'), 'dark');
    assert.equal(toggleThemeMode('dark'), 'light');
  });

  it('syncs .dark class and colorScheme onto target root element', () => {
    const classes = new Set<string>();
    const fakeRoot = {
      classList: {
        toggle(token: string, force?: boolean) {
          if (force === true) classes.add(token);
          else if (force === false) classes.delete(token);
          return classes.has(token);
        },
      },
      style: { colorScheme: 'light' },
    };

    applyThemeToElement(fakeRoot, 'dark');
    assert.equal(classes.has('dark'), true);
    assert.equal(fakeRoot.style.colorScheme, 'dark');

    applyThemeToElement(fakeRoot, 'light');
    assert.equal(classes.has('dark'), false);
    assert.equal(fakeRoot.style.colorScheme, 'light');
  });
});
