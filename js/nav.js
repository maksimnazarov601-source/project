/**
 * nav.js — мобильное меню: выезжает слева, закрывается по overlay, по Escape и по клику на ссылку.
 * Состояние хранится в классе body.nav-open и в aria-expanded у кнопки-гамбургера.
 */

// Mobile-First: «широкий экран» — от 768px, всё что уже — мобильная версия с выезжающим меню.
const WIDE_QUERY = '(min-width: 768px)';

export function initNavigation() {
  const burger = document.querySelector('#burger');
  const sidebar = document.querySelector('#sidebar');
  const overlay = document.querySelector('#nav-overlay');
  const wide = window.matchMedia(WIDE_QUERY);
  const isMobile = () => !wide.matches;
  const background = document.querySelectorAll('main, .panel, .site-footer'); // недоступно, пока меню открыто

  const isOpen = () => document.body.classList.contains('nav-open');

  function open() {
    document.body.classList.add('nav-open');
    document.documentElement.classList.add('is-locked'); // фон не прокручивается
    overlay.hidden = false;
    burger.setAttribute('aria-expanded', 'true');
    burger.setAttribute('aria-label', 'Закрыть меню');
    sidebar.removeAttribute('inert');
    background.forEach((el) => el.setAttribute('inert', ''));
    sidebar.querySelector('a')?.focus();
  }

  function close({ restoreFocus = true } = {}) {
    if (!isOpen()) return;
    document.body.classList.remove('nav-open');
    document.documentElement.classList.remove('is-locked');
    overlay.hidden = true;
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Открыть меню');
    background.forEach((el) => el.removeAttribute('inert'));
    if (isMobile()) sidebar.setAttribute('inert', '');
    if (restoreFocus) burger.focus();
  }

  /** Под мобильную ширину меню спрятано и недоступно с клавиатуры; на широких экранах — всегда видно. */
  function syncWithViewport() {
    if (isMobile()) {
      if (!isOpen()) sidebar.setAttribute('inert', '');
    } else {
      close({ restoreFocus: false });
      sidebar.removeAttribute('inert');
    }
  }

  burger.addEventListener('click', () => (isOpen() ? close() : open()));
  overlay.addEventListener('click', () => close());
  sidebar.addEventListener('click', (event) => {
    if (event.target.closest('a')) close({ restoreFocus: false });
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen()) close();
  });
  wide.addEventListener('change', syncWithViewport);
  syncWithViewport();
}
