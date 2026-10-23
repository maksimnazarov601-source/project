/**
 * app.js — главный файл приложения.
 * Хранит состояние (фильтры, сортировка, открытое окно), фильтрует и сортирует данные,
 * вызывает функции рендера и управляет модальным окном.
 */
import { articles, authors, categories, comments, ARTICLE_PRIORITIES } from './data.js';
import { initNavigation } from './nav.js';
import { initTheme } from './theme.js';
import { initTabs, initAccordions, showToast } from './interactions.js';
import {
  TABLE_COLUMNS,
  PRIORITY_LABELS,
  PRIORITY_RANK,
  createOption,
  createStats,
  createArticleCards,
  createArticlesTable,
  createEmptyState,
  createArticleModal,
  createCategoryTree,
  createAuthorList,
  createModerationQueue,
} from './render.js';

/* ---------- Справочники ---------- */

const authorsById = new Map(authors.map((a) => [a.id, a]));
const categoriesById = new Map(categories.map((c) => [c.id, c]));
const articlesById = new Map(articles.map((a) => [a.id, a]));

const DEFAULT_SORT = { key: 'publishedAt', dir: 'desc' };
let sort = { ...DEFAULT_SORT };

const form = document.querySelector('#filters');
const results = document.querySelector('#results');
const resetButton = document.querySelector('#f-reset');
const sortSelect = document.querySelector('#f-sort');

/** Подменяет содержимое контейнера; без строк разметки. */
function mount(selector, node) {
  const target = document.querySelector(selector);
  if (!target) throw new Error(`Не найден контейнер ${selector}`);
  target.replaceChildren(node);
}

/* ---------- Фильтры ---------- */

function readFilters() {
  const data = new FormData(form);
  return {
    query: String(data.get('query')).trim().toLowerCase(),
    category: String(data.get('category')),
    priority: String(data.get('priority')),
    statuses: new Set(data.getAll('status')),
    view: String(data.get('view')),
  };
}

function matches(article, filters) {
  if (!filters.statuses.has(article.status)) return false;
  if (filters.category && article.categoryId !== filters.category) return false;
  if (filters.priority && article.priority !== filters.priority) return false;
  if (filters.query) {
    const haystack = [article.title, article.excerpt, authorsById.get(article.authorId).fullName, ...article.tags]
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(filters.query)) return false;
  }
  return true;
}

function isDefaultState(filters) {
  return (
    filters.query === '' &&
    filters.category === '' &&
    filters.priority === '' &&
    filters.statuses.size === 5 &&
    filters.view === 'table' &&
    sort.key === DEFAULT_SORT.key &&
    sort.dir === DEFAULT_SORT.dir
  );
}

/* ---------- Сортировка ---------- */

function sortValue(article, key) {
  switch (key) {
    case 'author': return authorsById.get(article.authorId).fullName;
    case 'category': return categoriesById.get(article.categoryId).name;
    case 'priority': return PRIORITY_RANK[article.priority];
    case 'publishedAt': return article.publishedAt ? Date.parse(article.publishedAt) : null;
    default: return article[key];
  }
}

function sortArticles(list, { key, dir }) {
  const factor = dir === 'asc' ? 1 : -1;
  return [...list].sort((a, b) => {
    const x = sortValue(a, key);
    const y = sortValue(b, key);
    if (x === null && y === null) return 0;
    if (x === null) return 1; // пустые значения всегда внизу
    if (y === null) return -1;
    const result = typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'ru');
    return result * factor;
  });
}

/* ---------- Главный рендер ---------- */

function countBy(status) {
  return articles.filter((a) => a.status === status).length;
}

function update() {
  const filters = readFilters();
  const visible = sortArticles(articles.filter((a) => matches(a, filters)), sort);

  mount('#stats', createStats([
    { label: 'Всего статей', value: articles.length },
    { label: 'Опубликовано', value: countBy('published') },
    { label: 'На проверке', value: countBy('review') },
    { label: 'Комментариев на модерации', value: comments.filter((c) => c.status === 'pending').length },
  ]));

  results.classList.toggle('table-wrap', filters.view === 'table');
  if (visible.length === 0) {
    results.replaceChildren(createEmptyState('По выбранным условиям статей не найдено. Измените фильтры или сбросьте их.'));
  } else if (filters.view === 'cards') {
    results.replaceChildren(createArticleCards(visible, authorsById, categoriesById));
  } else {
    results.replaceChildren(createArticlesTable(visible, authorsById, categoriesById, sort));
  }

  sortSelect.value = `${sort.key}:${sort.dir}`; // выпадающая сортировка всегда показывает текущее состояние
  document.querySelector('#results-count').textContent = `Найдено статей: ${visible.length} из ${articles.length}`;
  resetButton.disabled = isDefaultState(filters);
}

/* ---------- Обработчики фильтров и сортировки ---------- */

form.addEventListener('input', (event) => {
  if (event.target === sortSelect) {
    const [key, dir] = sortSelect.value.split(':');
    sort = { key, dir };
  }
  update();
});
form.addEventListener('submit', (event) => event.preventDefault());
form.addEventListener('reset', () => {
  sort = { ...DEFAULT_SORT };
  setTimeout(update, 0); // форма сбрасывает значения уже после события
});

results.addEventListener('click', (event) => {
  const sortButton = event.target.closest('[data-sort]');
  if (sortButton) {
    const key = sortButton.dataset.sort;
    sort = sort.key === key ? { key, dir: sort.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' };
    update();
    results.querySelector(`[data-sort="${key}"]`)?.focus(); // не теряем фокус после перерисовки
    return;
  }
  const item = event.target.closest('[data-id]');
  if (item) openModal(item.dataset.id);
});

/* ---------- Модальное окно ---------- */

let activeModal = null;
let lastFocused = null;

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function lockScroll() {
  const scrollbar = window.innerWidth - document.documentElement.clientWidth;
  document.documentElement.classList.add('is-locked');
  document.body.style.paddingRight = `${scrollbar}px`; // страница не «прыгает» при пропадании полосы прокрутки
}

function unlockScroll() {
  document.documentElement.classList.remove('is-locked');
  document.body.style.paddingRight = '';
}

function openModal(articleId) {
  const article = articlesById.get(articleId);
  if (!article || activeModal) return;

  lastFocused = document.activeElement;
  const dialog = createArticleModal(
    article,
    authorsById.get(article.authorId),
    categoriesById.get(article.categoryId),
    comments.filter((c) => c.articleId === article.id),
  );
  document.body.append(dialog);
  activeModal = dialog;
  dialog.showModal();
  lockScroll();
  dialog.querySelector('[data-action="close"]').focus();

  // клик по затемнённому фону: событие приходит на сам <dialog>, у которого нет отступов
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) closeModal();
    const action = event.target.closest('[data-action]');
    if (!action) return;
    if (action.dataset.action === 'close') closeModal();
    if (action.dataset.action === 'save') saveArticle(dialog);
    if (action.dataset.action === 'publish') changeStatus(action.dataset.id, 'published');
    if (action.dataset.action === 'archive') changeStatus(action.dataset.id, 'archived');
  });

  // Escape: отменяем стандартное закрытие и закрываем сами, чтобы разблокировать скролл
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeModal();
  });

  // focus trap: Tab и Shift+Tab ходят по кругу внутри окна
  dialog.querySelector('[data-edit-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    saveArticle(dialog);
  });
  dialog.querySelector('[data-edit-form]')?.addEventListener('input', () => validateForm(dialog.querySelector('[data-edit-form]'), false));
  dialog.querySelector('[data-edit-form]')?.addEventListener('blur', (event) => {
    if (event.target.matches('input, textarea')) validateField(event.target);
  }, true);

  dialog.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const items = [...dialog.querySelectorAll(FOCUSABLE)];
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
}

function validateField(field) {
  const value = field.value.trim();
  const min = Number(field.dataset.min || 0);
  const max = Number(field.dataset.max || Infinity);
  let message = '';
  if (!value) message = 'Поле обязательно для заполнения.';
  else if (value.length < min) message = `Минимум ${min} символов.`;
  else if (value.length > max) message = `Максимум ${max} символов.`;

  const error = document.getElementById(field.getAttribute('aria-describedby'));
  field.setAttribute('aria-invalid', String(Boolean(message)));
  if (error) error.textContent = message;
  return !message;
}

function validateForm(formElement, focusFirst = true) {
  if (!formElement) return false;
  const valid = [...formElement.querySelectorAll('[data-validate]')].map((field) => validateField(field)).every(Boolean);
  if (!valid && focusFirst) formElement.querySelector('[aria-invalid="true"]')?.focus();
  return valid;
}

function saveArticle(dialog) {
  const formElement = dialog.querySelector('[data-edit-form]');
  if (!validateForm(formElement)) return;
  const article = articlesById.get(formElement.dataset.articleId);
  article.title = formElement.elements.title.value.trim();
  article.excerpt = formElement.elements.excerpt.value.trim();
  article.seo.title = formElement.elements.seoTitle.value.trim();
  closeModal();
  update();
  showToast('Изменения статьи сохранены.');
}

function closeModal() {
  if (!activeModal) return;
  activeModal.close();
  activeModal.remove();
  activeModal = null;
  unlockScroll();
  lastFocused?.focus?.(); // возвращаем фокус туда, откуда открывали окно
  lastFocused = null;
}

function changeStatus(articleId, status) {
  const article = articlesById.get(articleId);
  article.status = status;
  if (status === 'published') article.publishedAt = new Date().toISOString();
  closeModal();
  update();
  showToast(status === 'published' ? 'Статья опубликована.' : 'Статья перемещена в архив.');
}

/* ---------- Первый запуск ---------- */

// сортировка для карточек и мобильной версии, где нет заголовков колонок
TABLE_COLUMNS.forEach(({ label, key }) => {
  sortSelect.append(createOption(`${key}:asc`, `${label} ↑`), createOption(`${key}:desc`, `${label} ↓`));
});
const today = document.querySelector('#today');
today.setAttribute('datetime', new Date().toISOString().slice(0, 10));
today.textContent = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
initNavigation();
initTheme();

const categorySelect = document.querySelector('#f-category');
categories.forEach((c) => categorySelect.append(createOption(c.id, c.name)));
const prioritySelect = document.querySelector('#f-priority');
ARTICLE_PRIORITIES.forEach((p) => prioritySelect.append(createOption(p, PRIORITY_LABELS[p])));

mount('#categories-list', createCategoryTree(categories, articles));
mount('#authors-list', createAuthorList(authors, articles));
mount('#moderation-list', createModerationQueue(comments.filter((c) => c.status === 'pending'), articlesById));
initTabs();
initAccordions();
const resultsSkeleton = document.querySelector('#results');
resultsSkeleton.innerHTML = '<div class="skeleton-list" aria-label="Загрузка статей"><span class="skeleton skeleton--wide"></span><span class="skeleton"></span><span class="skeleton"></span></div>';
window.setTimeout(() => update(), 450);
