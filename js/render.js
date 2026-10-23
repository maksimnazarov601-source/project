/**
 * render.js — чистые функции рендера.
 * Каждая функция принимает данные и возвращает готовый DOM-элемент,
 * ничего не читает из глобального состояния и не меняет документ.
 * Данные вставляются только через createElement / textContent / setAttribute.
 */

/* ---------- Справочники подписей ---------- */

const STATUS_LABELS = {
  draft: 'Черновик',
  review: 'На проверке',
  published: 'Опубликована',
  rejected: 'Отклонена',
  archived: 'В архиве',
  active: 'Активна',
  hidden: 'Скрыта',
  vacation: 'В отпуске',
  blocked: 'Заблокирован',
  pending: 'Ожидает',
  approved: 'Одобрен',
  spam: 'Спам',
  rejected_comment: 'Отклонён',
};

export const PRIORITY_LABELS = {
  low: 'Низкий',
  normal: 'Обычный',
  high: 'Высокий',
  urgent: 'Срочный',
};
export const PRIORITY_RANK = { low: 0, normal: 1, high: 2, urgent: 3 };
const PRIORITY_ICONS = { low: '▼', normal: '●', high: '▲', urgent: '▲▲' };

const ROLE_LABELS = {
  'chief-editor': 'Главный редактор',
  editor: 'Редактор',
  author: 'Автор',
  moderator: 'Модератор',
  admin: 'Администратор',
};

/* ---------- Вспомогательные функции ---------- */

/**
 * Создаёт элемент с текстом и атрибутами.
 * @param {string} tag
 * @param {{text?: string, className?: string, attrs?: Record<string,string>}} [options]
 * @param {Node[]} [children]
 * @returns {HTMLElement}
 */
export function createElement(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = options.text;
  if (options.attrs) {
    Object.entries(options.attrs).forEach(([name, value]) => node.setAttribute(name, value));
  }
  children.forEach((child) => node.append(child));
  return node;
}

/** Тег <time> с машиночитаемым datetime в ISO 8601. */
export function createTime(isoString, withTime = false) {
  const date = new Date(isoString);
  const options = withTime
    ? { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: 'numeric', month: 'short', year: 'numeric' };
  return createElement('time', {
    text: date.toLocaleDateString('ru-RU', options),
    attrs: { datetime: isoString },
  });
}

/** Бейдж статуса. kind нужен, чтобы различать «rejected» у статей и комментариев. */
export function createStatusBadge(status, kind = 'article') {
  const key = kind === 'comment' && status === 'rejected' ? 'rejected_comment' : status;
  return createElement('span', {
    className: `badge badge--${status}`,
    text: STATUS_LABELS[key] ?? status,
  });
}

/** Индикатор приоритета: цветная иконка + текст (цвет не единственный носитель смысла). */
export function createPriority(priority) {
  return createElement('span', { className: `priority priority--${priority}` }, [
    createElement('span', { className: 'priority__icon', text: PRIORITY_ICONS[priority], attrs: { 'aria-hidden': 'true' } }),
    createElement('span', { text: PRIORITY_LABELS[priority] }),
  ]);
}

/** Кнопка. variant: primary | secondary | ghost. */
export function createButton(label, { variant = 'secondary', type = 'button', disabled = false, attrs = {} } = {}) {
  const button = createElement('button', {
    className: `btn btn--${variant}`,
    text: label,
    attrs: { type, ...attrs },
  });
  button.disabled = disabled;
  return button;
}

/** <option> для выпадающего списка. */
export function createOption(value, label) {
  return createElement('option', { text: label, attrs: { value } });
}

/** SVG-заглушка в виде data URI: картинка не требует сети и файлов. */
function makePlaceholder(color, letter, width, height) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<rect width="100%" height="100%" fill="${color}"/>` +
    `<text x="50%" y="52%" fill="#ffffff" font-family="sans-serif" font-size="${Math.round(height * 0.5)}" ` +
    `font-weight="700" text-anchor="middle" dominant-baseline="middle">${letter}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function firstLetter(text) {
  return text.trim().charAt(0).toUpperCase();
}

/* ---------- Статистика ---------- */

/**
 * @param {Array<{label: string, value: number}>} items
 * @returns {HTMLElement} <dl> со сводными показателями
 */
export function createStats(items) {
  const list = createElement('dl', { className: 'stats' });
  items.forEach(({ label, value }) => {
    const card = createElement('div', { className: 'stats__item' }, [
      createElement('dt', { text: label }),
      createElement('dd', { text: String(value) }),
    ]);
    list.append(card);
  });
  return list;
}

/* ---------- Статьи ---------- */

/**
 * Карточка статьи: заголовочная часть (ID, заголовок, статус), основная часть
 * (описание, ключевые поля) и мета-информация (дата, ответственный, теги).
 * @returns {HTMLElement} <article>
 */
export function createArticleCard(article, author, category) {
  const cover = createElement('img', {
    attrs: {
      src: makePlaceholder(category.color, firstLetter(category.name), 640, 280),
      alt: `Обложка статьи «${article.title}» — рубрика ${category.name}`,
      width: '640',
      height: '280',
      loading: 'lazy',
    },
  });
  const figure = createElement('figure', { className: 'card__figure' }, [
    cover,
    createElement('figcaption', { text: `Рубрика: ${category.name}` }),
  ]);

  /* заголовочная часть */
  const title = createElement('h3', { className: 'card__title' }, [
    createElement('button', {
      className: 'card__open',
      text: article.title,
      attrs: { type: 'button', 'data-open': article.id, 'aria-haspopup': 'dialog' },
    }),
  ]);
  const header = createElement('header', { className: 'card__header' }, [
    createElement('p', { className: 'card__id', text: article.id.toUpperCase() }),
    createStatusBadge(article.status),
    title,
  ]);

  /* основная часть */
  const facts = createElement('dl', { className: 'facts' });
  [
    ['Приоритет', createPriority(article.priority)],
    ['Чтение', document.createTextNode(`${article.readingMinutes} мин`)],
    ['Просмотры', document.createTextNode(article.views.toLocaleString('ru-RU'))],
  ].forEach(([term, value]) => {
    facts.append(createElement('dt', { text: term }), createElement('dd', {}, [value]));
  });
  const body = createElement('section', { className: 'card__body' }, [
    createElement('p', { text: article.excerpt }),
    facts,
  ]);

  /* мета-информация */
  const tags = createElement('ul', { className: 'tags', attrs: { 'aria-label': 'Теги статьи' } });
  article.tags.forEach((tag) => tags.append(createElement('li', { text: `#${tag}` })));
  const meta = createElement('footer', { className: 'card__meta' }, [
    createElement('p', {}, [
      createElement('span', { text: `Ответственный: ${author.fullName}` }),
      document.createTextNode(' · '),
      article.publishedAt
        ? createTime(article.publishedAt)
        : createElement('span', { text: 'не опубликована' }),
    ]),
    tags,
  ]);

  return createElement(
    'article',
    { className: `card card--${article.priority}`, attrs: { 'data-id': article.id } },
    [figure, header, body, meta],
  );
}

/** @returns {HTMLUListElement} список карточек */
export function createArticleCards(articles, authorsById, categoriesById) {
  const list = createElement('ul', { className: 'cards' });
  articles.forEach((article) => {
    const author = authorsById.get(article.authorId);
    const category = categoriesById.get(article.categoryId);
    list.append(createElement('li', {}, [createArticleCard(article, author, category)]));
  });
  return list;
}

/** Колонки таблицы: ключ сортировки, подпись, тип значения. */
export const TABLE_COLUMNS = [
  { key: 'title', label: 'Заголовок' },
  { key: 'id', label: 'ID' },
  { key: 'author', label: 'Автор' },
  { key: 'category', label: 'Категория' },
  { key: 'priority', label: 'Приоритет' },
  { key: 'status', label: 'Статус' },
  { key: 'publishedAt', label: 'Публикация' },
  { key: 'views', label: 'Просмотры', numeric: true },
];

/**
 * Таблица статей: caption, thead с th[scope=col], индикатор и aria-sort у сортируемых колонок.
 * @param {{key: string, dir: 'asc'|'desc'}} sort текущая сортировка
 * @returns {HTMLTableElement}
 */
export function createArticlesTable(articles, authorsById, categoriesById, sort) {
  const table = createElement('table', { className: 'table' });
  table.append(createElement('caption', { text: 'Материалы редакции: нажмите на заголовок колонки для сортировки' }));

  const headRow = createElement('tr');
  TABLE_COLUMNS.forEach((column) => {
    const active = sort.key === column.key;
    const th = createElement('th', {
      className: column.numeric ? 'num' : '',
      attrs: {
        scope: 'col',
        'aria-sort': active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none',
      },
    }, [
      createElement('button', {
        className: `sort${active ? ` sort--${sort.dir}` : ''}`,
        attrs: { type: 'button', 'data-sort': column.key },
      }, [
        createElement('span', { text: column.label }),
        createElement('span', { className: 'sort__icon', attrs: { 'aria-hidden': 'true' } }),
      ]),
    ]);
    headRow.append(th);
  });
  table.append(createElement('thead', {}, [headRow]));

  const body = createElement('tbody');
  const label = (key) => TABLE_COLUMNS.find((c) => c.key === key).label;
  articles.forEach((article) => {
    const row = createElement('tr', { attrs: { 'data-id': article.id } });
    // data-label нужен мобильной версии: CSS выводит его перед значением ячейки (attr(data-label))
    row.append(
      createElement('th', { attrs: { scope: 'row', 'data-label': label('title') } }, [
        createElement('button', {
          className: 'link-button',
          text: article.title,
          attrs: { type: 'button', 'data-open': article.id, 'aria-haspopup': 'dialog' },
        }),
      ]),
    );
    const cell = (key, children, options = {}) =>
      createElement('td', { ...options, attrs: { 'data-label': label(key) } }, children);

    row.append(cell('id', [], { className: 'mono', text: article.id.toUpperCase() }));
    row.append(cell('author', [], { text: authorsById.get(article.authorId).fullName }));
    row.append(cell('category', [], { text: categoriesById.get(article.categoryId).name }));
    row.append(cell('priority', [createPriority(article.priority)]));
    row.append(cell('status', [createStatusBadge(article.status)]));
    row.append(
      cell('publishedAt', [
        article.publishedAt ? createTime(article.publishedAt) : createElement('span', { text: '—' }),
      ]),
    );
    row.append(cell('views', [], { className: 'num', text: article.views.toLocaleString('ru-RU') }));
    body.append(row);
  });
  table.append(body);
  return table;
}

/** Сообщение, когда фильтры ничего не нашли. */
export function createEmptyState(text) {
  return createElement('p', { className: 'empty', text });
}

/**
 * Модальное окно со статьёй: заголовок, основная часть и footer с кнопками.
 * Возвращает <dialog>; открытием, закрытием и фокусом управляет app.js.
 */
export function createArticleModal(article, author, category, articleComments) {
  const titleId = `modal-title-${article.id}`;
  const field = (id, label, value, { min, max, multiline = false } = {}) => {
    const errorId = `error-${id}-${article.id}`;
    const control = createElement(multiline ? 'textarea' : 'input', {
      className: 'form-control',
      text: multiline ? value : undefined,
      attrs: {
        id, name: id, ...(multiline ? {} : { type: 'text', value }),
        'aria-describedby': errorId, 'data-validate': '', 'data-min': String(min), 'data-max': String(max),
      },
    });
    if (multiline) control.value = value;
    return createElement('div', { className: 'form-field' }, [
      createElement('label', { text: label, attrs: { for: id } }),
      control,
      createElement('p', { className: 'form-error', attrs: { id: errorId, 'aria-live': 'polite' } }),
    ]);
  };

  const header = createElement('header', { className: 'modal__header' }, [
    createElement('section', {}, [
      createElement('p', { className: 'card__id', text: `${article.id.toUpperCase()} · ${category.name}` }),
      createElement('h2', { text: article.title, attrs: { id: titleId } }),
    ]),
    createElement('button', {
      className: 'icon-btn', text: '×', attrs: { type: 'button', 'data-action': 'close', 'aria-label': 'Закрыть окно' },
    }),
  ]);

  const facts = createElement('dl', { className: 'facts facts--wide' });
  [['Статус', createStatusBadge(article.status)], ['Приоритет', createPriority(article.priority)],
   ['Ответственный', document.createTextNode(`${author.fullName} (${ROLE_LABELS[author.role]})`)],
   ['Создана', createTime(article.createdAt, true)], ['Опубликована', article.publishedAt ? createTime(article.publishedAt, true) : document.createTextNode('—')],
   ['Просмотры', document.createTextNode(article.views.toLocaleString('ru-RU'))], ['Время чтения', document.createTextNode(`${article.readingMinutes} мин`)]]
    .forEach(([term, value]) => facts.append(createElement('dt', { text: term }), createElement('dd', {}, [value])));

  const form = createElement('form', { className: 'edit-form', attrs: { 'data-edit-form': '', 'data-article-id': article.id, novalidate: '' } }, [
    field(`title`, 'Заголовок', article.title, { min: 10, max: 120 }),
    field(`excerpt`, 'Описание', article.excerpt, { min: 20, max: 300, multiline: true }),
    field(`seoTitle`, 'SEO-заголовок', article.seo.title, { min: 10, max: 70 }),
  ]);

  const tags = createElement('ul', { className: 'tags', attrs: { 'aria-label': 'Теги статьи' } });
  article.tags.forEach((tag) => tags.append(createElement('li', { text: `#${tag}` })));
  const commentsList = createElement('ul', { className: 'modal__comments' });
  articleComments.forEach((comment) => commentsList.append(createElement('li', {}, [createElement('strong', { text: comment.authorName }), document.createTextNode(': ' + comment.text + ' '), createStatusBadge(comment.status, 'comment')] )));

  const body = createElement('section', { className: 'modal__body' }, [
    createElement('p', { className: 'muted', text: article.seo.description }), facts,
    createElement('h3', { text: 'Редактирование' }), form,
    tags, createElement('h3', { text: `Комментарии (${articleComments.length})` }),
    articleComments.length > 0 ? commentsList : createElement('p', { className: 'muted', text: 'Комментариев пока нет.' }),
  ]);

  const canPublish = article.status === 'draft' || article.status === 'review';
  const footer = createElement('footer', { className: 'modal__footer' }, [
    createButton('Закрыть', { variant: 'ghost', attrs: { 'data-action': 'close' } }),
    createButton('Сохранить', { variant: 'secondary', attrs: { 'data-action': 'save' } }),
    createButton('В архив', { variant: 'secondary', disabled: article.status === 'archived', attrs: { 'data-action': 'archive', 'data-id': article.id } }),
    createButton('Опубликовать', { variant: 'primary', disabled: !canPublish, attrs: { 'data-action': 'publish', 'data-id': article.id } }),
  ]);

  const panel = createElement('section', { className: 'modal__panel' }, [header, body, footer]);
  return createElement('dialog', { className: 'modal', attrs: { 'aria-labelledby': titleId, 'aria-modal': 'true' } }, [panel]);
}

/* ---------- Категории ---------- */

/**
 * Список категорий с вложенной структурой: родитель → дочерние, ключевые слова.
 * @returns {HTMLUListElement}
 */
export function createCategoryTree(categories, articles) {
  const countByCategory = new Map();
  articles.forEach((a) => countByCategory.set(a.categoryId, (countByCategory.get(a.categoryId) ?? 0) + 1));

  const buildItem = (category) => {
    const keywords = createElement('ul', { className: 'tags' });
    category.keywords.forEach((k) => keywords.append(createElement('li', { text: k })));

    const item = createElement('li', { className: 'tree__item' }, [
      createElement('div', { className: 'tree__heading' }, [
        createElement('span', { className: 'dot', attrs: { style: `background:${category.color}`, 'aria-hidden': 'true' } }),
        createElement('strong', { text: category.name }),
        createElement('span', { className: 'muted', text: ` · статей: ${countByCategory.get(category.id) ?? 0}` }),
        createStatusBadge(category.status),
      ]),
      createElement('p', { className: 'muted', text: category.description }),
      keywords,
    ]);

    const children = categories.filter((c) => c.parentId === category.id);
    if (children.length > 0) {
      const panelId = `category-panel-${category.id}`;
      const trigger = createElement('button', {
        className: 'accordion__trigger', text: `Подкатегории (${children.length})`,
        attrs: { type: 'button', 'data-accordion-trigger': '', 'aria-expanded': 'false', 'aria-controls': panelId },
      });
      const nested = createElement('ul', { className: 'tree accordion__panel', attrs: { id: panelId, hidden: '' } });
      children.forEach((child) => nested.append(buildItem(child)));
      item.append(trigger, nested);
    }
    return item;
  };

  const root = createElement('ul', { className: 'tree', attrs: { 'data-accordion': '' } });
  categories.filter((c) => c.parentId === null).forEach((c) => root.append(buildItem(c)));
  return root;
}

/* ---------- Авторы ---------- */

/**
 * Карточки авторов: аватар, роль, специализации, контакты.
 * @returns {HTMLUListElement}
 */
export function createAuthorList(authors, articles) {
  const countByAuthor = new Map();
  articles.forEach((a) => countByAuthor.set(a.authorId, (countByAuthor.get(a.authorId) ?? 0) + 1));

  const list = createElement('ul', { className: 'authors' });
  authors.forEach((author) => {
    const avatar = createElement('img', {
      attrs: {
        src: makePlaceholder(author.avatarColor, firstLetter(author.fullName), 96, 96),
        alt: `Аватар автора ${author.fullName}`,
        width: '48',
        height: '48',
        loading: 'lazy',
      },
    });

    const contacts = createElement('address', { className: 'muted' }, [
      createElement('a', { text: author.email, attrs: { href: `mailto:${author.email}` } }),
      document.createTextNode(` · ${author.contacts.telegram}`),
    ]);

    const specialties = createElement('ul', { className: 'tags' });
    author.specialties.forEach((s) => specialties.append(createElement('li', { text: s })));

    const info = createElement('section', { className: 'author__info' }, [
      createElement('h3', { text: author.fullName }),
      createElement('p', { className: 'muted' }, [
        createElement('span', { className: 'badge badge--accent', text: ROLE_LABELS[author.role] }),
        document.createTextNode(` статей: ${countByAuthor.get(author.id) ?? 0}`),
      ]),
      createStatusBadge(author.status),
      specialties,
      contacts,
    ]);

    list.append(
      createElement('li', {}, [
        createElement('article', { className: 'author' }, [
          createElement('figure', { className: 'author__avatar' }, [avatar]),
          info,
        ]),
      ]),
    );
  });
  return list;
}

/* ---------- Модерация ---------- */

/**
 * Очередь комментариев на модерации.
 * @returns {HTMLOListElement}
 */
export function createModerationQueue(comments, articlesById) {
  const list = createElement('ol', { className: 'queue' });
  comments.forEach((comment) => {
    const article = articlesById.get(comment.articleId);
    const flags = createElement('ul', { className: 'tags' });
    comment.flags.forEach((flag) => flags.append(createElement('li', { text: flag })));

    const header = createElement('header', {}, [
      createElement('strong', { text: comment.authorName }),
      createStatusBadge(comment.status, 'comment'),
    ]);

    const item = createElement('article', { className: 'comment' }, [
      header,
      createElement('blockquote', { text: comment.text }),
      createElement('p', { className: 'muted' }, [
        document.createTextNode(`К статье «${article.title}» · `),
        createTime(comment.createdAt, true),
      ]),
    ]);
    if (comment.flags.length > 0) item.append(flags);
    list.append(createElement('li', {}, [item]));
  });
  return list;
}
