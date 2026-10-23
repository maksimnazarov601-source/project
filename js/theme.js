const THEME_KEY = 'cms-theme';
const ACCENT_KEY = 'cms-accent';
const THEMES = ['light', 'dark', 'contrast'];
const ANIMATION_MS = 450;

const root = document.documentElement;
const systemDark = window.matchMedia('(prefers-color-scheme: dark)');


function readStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
  }
}

export function hexToRgb(hex) {
  const match = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) return null;
  return { r: parseInt(match[1], 16), g: parseInt(match[2], 16), b: parseInt(match[3], 16) };
}

/** { r: 59, g: 91, b: 219 } → '#3b5bdb' */
export function rgbToHex({ r, g, b }) {
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

export function contrastColor({ r, g, b }) {
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.55 ? '#111827' : '#ffffff';
}


function storedTheme() {
  const value = readStorage(THEME_KEY);
  return THEMES.includes(value) ? value : null;
}

function resolveTheme() {
  return storedTheme() ?? (systemDark.matches ? 'dark' : 'light');
}

let animationTimer = 0;

function applyTheme(theme, { animate = true } = {}) {
  if (root.getAttribute('data-theme') === theme) return;
  if (animate) {
    root.classList.add('theme-animating');
    clearTimeout(animationTimer);
    animationTimer = setTimeout(() => root.classList.remove('theme-animating'), ANIMATION_MS);
  }
  root.setAttribute('data-theme', theme);
  syncAccentInput(); // у каждой темы свой акцент по умолчанию
}

const accentInput = document.querySelector('#accent-color');
const resetButtons = document.querySelectorAll('[data-accent-reset]');

function storedAccent() {
  const value = readStorage(ACCENT_KEY);
  return hexToRgb(value ?? '') ? value : null;
}

function applyAccent(hex) {
  const rgb = hex ? hexToRgb(hex) : null;
  if (rgb) {
    root.style.setProperty('--accent-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
    root.style.setProperty('--accent-contrast', contrastColor(rgb));
  } else {
    root.style.removeProperty('--accent-rgb');
    root.style.removeProperty('--accent-contrast');
  }
  resetButtons.forEach((button) => { button.hidden = !rgb; });
  syncAccentInput();
}

function syncAccentInput() {
  const current = getComputedStyle(root).getPropertyValue('--accent-rgb').split(',').map((n) => Number(n.trim()));
  if (current.length === 3 && current.every(Number.isFinite)) {
    accentInput.value = rgbToHex({ r: current[0], g: current[1], b: current[2] });
  }
}

export function initTheme() {
  const select = document.querySelector('#theme-select');
  select.value = storedTheme() ?? 'auto';
  applyAccent(storedAccent());

  select.addEventListener('change', () => {
    writeStorage(THEME_KEY, select.value === 'auto' ? null : select.value);
    applyTheme(resolveTheme());
  });

  systemDark.addEventListener('change', () => {
    if (storedTheme() === null) applyTheme(resolveTheme());
  });

  accentInput.addEventListener('input', () => {
    writeStorage(ACCENT_KEY, accentInput.value);
    applyAccent(accentInput.value);
  });

  resetButtons.forEach((button) =>
    button.addEventListener('click', () => {
      writeStorage(ACCENT_KEY, null);
      applyAccent(null);
    }),
  );

  window.addEventListener('storage', (event) => {
    if (event.key === THEME_KEY || event.key === null) {
      select.value = storedTheme() ?? 'auto';
      applyTheme(resolveTheme());
    }
    if (event.key === ACCENT_KEY || event.key === null) applyAccent(storedAccent());
  });
}
