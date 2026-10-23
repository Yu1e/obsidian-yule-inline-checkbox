const { Plugin } = require('obsidian');
const { ViewPlugin, Decoration, WidgetType, EditorView } = require('@codemirror/view');

/* ═══════════════════════════════════════════════
   КАРТА ИКОНОК (Unicode escape для надёжности)
   ═══════════════════════════════════════════════ */

const ICON_MAP = {
  "▢": "empty",
  "☑": "done",
  "◧": "progress",
  "☒": "cancelled",
  "⚠": "important",
  "⍰": "question",
  "\u2460": "digit",   // ①
  "\u2461": "digit",   // ②
  "\u2462": "digit",   // ③
  "\u2463": "digit",   // ④
  "\u2464": "digit",   // ⑤
  "\u2465": "digit",   // ⑥
  "\u2466": "digit",   // ⑦
  "\u2467": "digit",   // ⑧
  "\u2468": "digit",   // ⑨
  "\u2789": "digit2",  // ➉
  "\u246A": "digit2",  // ⑪
  "\u246B": "digit2",  // ⑫
  "\u246C": "digit2",  // ⑬
  "\u246D": "digit2",  // ⑭
  "\u246E": "digit2",  // ⑮
  "\u246F": "digit2",  // ⑯
  "\u2470": "digit2",  // ⑰
  "\u2471": "digit2",  // ⑱
  "\u2472": "digit2",  // ⑲
  "\u2473": "digit2"   // ⑳
};

/* Два независимых цикла */
const CHECKBOX_CYCLE = ["▢", "☑", "◧", "☒", "⚠", "⍰"];
const DIGIT_CYCLE = [
  "\u2460", "\u2461", "\u2462", "\u2463", "\u2464",  // ①②③④⑤
  "\u2465", "\u2466", "\u2467", "\u2468", "\u2789",  // ⑥⑦⑧⑨➉
  "\u246A", "\u246B", "\u246C", "\u246D", "\u246E",  // ⑪⑫⑬⑭⑮
  "\u246F", "\u2470", "\u2471", "\u2472", "\u2473"   // ⑯⑰⑱⑲⑳
];

function getNextIcon(icon) {
  let idx = CHECKBOX_CYCLE.indexOf(icon);
  if (idx !== -1) return CHECKBOX_CYCLE[(idx + 1) % CHECKBOX_CYCLE.length];

  for (let i = 0; i < DIGIT_CYCLE.length; i++) {
    if (DIGIT_CYCLE[i] === icon) {
      return DIGIT_CYCLE[(i + 1) % DIGIT_CYCLE.length];
    }
  }

  return icon;
}

/* ═══════════════════════════════════════════════
   SVG-ИКОНКИ
   ═══════════════════════════════════════════════ */

const SVG_IMPORTANT = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='26' height='26'>
  <rect x='1.5' y='1.5' width='21' height='21' rx='3' fill='currentColor' stroke='currentColor' stroke-width='1.5'/>
  <line x1='12' y1='6' x2='12' y2='13' stroke='white' stroke-width='2.5' stroke-linecap='round'/>
  <circle cx='12' cy='17' r='1.5' fill='white'/>
</svg>`;

const SVG_QUESTION = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='26' height='26'>
  <rect x='1.5' y='1.5' width='21' height='21' rx='3' fill='currentColor' stroke='currentColor' stroke-width='1.5'/>
  <path d='M10 9.5c0-1.4 1.1-2.5 2-2.5s2 1.1 2 2.5c0 1-0.7 1.5-1.5 2-.5.3-.5.5-.5 1' fill='none' stroke='white' stroke-width='1.8' stroke-linecap='round'/>
  <circle cx='12' cy='17' r='1.2' fill='white'/>
</svg>`;

/* ═══════════════════════════════════════════════
   ВИДЖЕТ
   ═══════════════════════════════════════════════ */

/* Содержимое значка: SVG, пустой символ или сам глиф */
function fillIcon(s, icon) {
  if (icon === "☑") {
    s.textContent = '\u200B';
  } else if (icon === "⚠") {
    s.innerHTML = SVG_IMPORTANT;
  } else if (icon === "⍰") {
    s.innerHTML = SVG_QUESTION;
  } else {
    s.textContent = icon;
  }
}

class IconWidget extends WidgetType {
  constructor(icon, cls, pos, len) {
    super();
    this.icon = icon;
    this.cls = cls;
    this.pos = pos;
    this.len = len;
  }

  toDOM(view) {
    const s = document.createElement('span');
    s.className = `inline-icon icon-${this.cls}`;
    s.dataset.icon = this.icon;
    fillIcon(s, this.icon);

    s.addEventListener('click', (e) => {
      e.preventDefault();
      const next = getNextIcon(this.icon);
      view.dispatch({
        changes: { from: this.pos, to: this.pos + this.len, insert: next }
      });
    });
    return s;
  }

  eq(o) { return this.icon === o.icon && this.pos === o.pos; }
  ignoreEvent() { return false; }
}

/* ═══════════════════════════════════════════════
   ДЕКОРАЦИИ
   ═══════════════════════════════════════════════ */

function buildDecorations(view) {
  const decs = [];
  const doc = view.state.doc;
  const allIcons = Object.keys(ICON_MAP);

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    const text = line.text;

    for (let ch = 0; ch < text.length; ch++) {
      for (const icon of allIcons) {
        if (text.substring(ch, ch + icon.length) === icon) {
          const cls = ICON_MAP[icon];
          const from = line.from + ch;
          let len = icon.length;
          while (ch + len < text.length &&
            (text.charCodeAt(ch + len) === 0xFE0E || text.charCodeAt(ch + len) === 0xFE0F)) {
            len++;
          }
          decs.push(
            Decoration.replace({
              widget: new IconWidget(icon, cls, from, len),
            }).range(from, from + len)
          );
          ch += len - 1;
          break;
        }
      }
    }
  }
  return Decoration.set(decs);
}

const ext = ViewPlugin.fromClass(
  class {
    constructor(v) { this.decorations = buildDecorations(v); }
    update(u) {
      if (u.docChanged || u.viewportChanged)
        this.decorations = buildDecorations(u.view);
    }
  },
  { decorations: (v) => v.decorations }
);

/* ═══════════════════════════════════════════════
   ФУНКЦИИ ДЛЯ КОМАНД
   ═══════════════════════════════════════════════ */

function toggleOrInsert(editor, icons) {
  const c = editor.getCursor();
  const line = editor.getLine(c.line);

  let found = null, pos = -1, foundIdx = -1;

  for (let p = c.ch; p >= Math.max(0, c.ch - 5); p--) {
    for (let i = 0; i < icons.length; i++) {
      if (line.substring(p, p + icons[i].length) === icons[i]) {
        found = icons[i]; pos = p; foundIdx = i;
        break;
      }
    }
    if (found) break;
  }

  if (found) {
    const next = icons[(foundIdx + 1) % icons.length];
    let end = pos + found.length;
    while (end < line.length && (line.charCodeAt(end) === 0xFE0E || line.charCodeAt(end) === 0xFE0F)) end++;
    editor.replaceRange(next, { line: c.line, ch: pos }, { line: c.line, ch: end });
    editor.setCursor({ line: c.line, ch: pos + next.length });
  } else {
    let ws = c.ch;
    while (ws > 0 && !" \t,".includes(line[ws - 1])) ws--;
    editor.replaceRange(icons[0] + " ", { line: c.line, ch: ws });
    editor.setCursor({ line: c.line, ch: ws + icons[0].length + 1 });
  }
}

function findAllDigits(text) {
  const result = [];
  for (let ch = 0; ch < text.length; ch++) {
    for (const icon of DIGIT_CYCLE) {
      if (text.substring(ch, ch + icon.length) === icon) {
        result.push({ pos: ch, icon, idx: DIGIT_CYCLE.indexOf(icon), len: icon.length });
        ch += icon.length - 1;
        break;
      }
    }
  }
  return result;
}

function recalcRight(editor, lineNum, digits, startPos, startIdx) {
  let offset = 0;
  for (const digit of digits) {
    if (digit.pos < startPos) continue;
    const newPos = digit.pos + offset;
    const newIcon = DIGIT_CYCLE[startIdx % DIGIT_CYCLE.length];
    startIdx++;
    const current = editor.getLine(lineNum).substring(newPos, newPos + digit.len);
    if (current === digit.icon) {
      editor.replaceRange(
        newIcon,
        { line: lineNum, ch: newPos },
        { line: lineNum, ch: newPos + digit.len }
      );
      offset += newIcon.length - digit.len;
    }
  }
}

function smartInsertDigit(editor) {
  const c = editor.getCursor();
  const line = editor.getLine(c.line);
  const allDigits = findAllDigits(line);

  // Ищем цифру рядом с курсором
  let nearFound = null, nearPos = -1, nearFoundIdx = -1;
  for (let p = c.ch; p >= Math.max(0, c.ch - 5); p--) {
    for (let i = 0; i < DIGIT_CYCLE.length; i++) {
      if (line.substring(p, p + DIGIT_CYCLE[i].length) === DIGIT_CYCLE[i]) {
        nearFound = DIGIT_CYCLE[i]; nearPos = p; nearFoundIdx = i;
        break;
      }
    }
    if (nearFound) break;
  }

  if (nearFound) {
    // Переключаем и пересчитываем правее
    const next = DIGIT_CYCLE[(nearFoundIdx + 1) % DIGIT_CYCLE.length];
    let end = nearPos + nearFound.length;
    while (end < line.length && (line.charCodeAt(end) === 0xFE0E || line.charCodeAt(end) === 0xFE0F)) end++;
    editor.replaceRange(next, { line: c.line, ch: nearPos }, { line: c.line, ch: end });

    const rightDigits = allDigits.filter(f => f.pos > nearPos);
    recalcRight(editor, c.line, rightDigits, nearPos + next.length, nearFoundIdx + 2);
    editor.setCursor({ line: c.line, ch: nearPos + next.length });

  } else {
    // Вставляем новую
    const leftDigits = allDigits.filter(f => f.pos < c.ch);
    const rightDigits = allDigits.filter(f => f.pos >= c.ch);

    let insertIdx;
    if (leftDigits.length === 0) {
      insertIdx = 0;
    } else {
      const maxLeft = leftDigits.reduce((a, b) => a.idx > b.idx ? a : b);
      insertIdx = maxLeft.idx + 1;
    }

    const toInsert = DIGIT_CYCLE[insertIdx % DIGIT_CYCLE.length];

    let ws = c.ch;
    while (ws > 0 && !" \t,".includes(line[ws - 1])) ws--;

    editor.replaceRange(toInsert + " ", { line: c.line, ch: ws });

    const insertedLen = toInsert.length + 1;
    const shiftedRight = rightDigits.map(d => ({ ...d, pos: d.pos + insertedLen }));
    recalcRight(editor, c.line, shiftedRight, ws + insertedLen, insertIdx + 1);

    editor.setCursor({ line: c.line, ch: ws + toInsert.length + 1 });
  }
}

/* ═══════════════════════════════════════════════
   ЗАДАЧИ MARKDOWN  - [ ]
   ═══════════════════════════════════════════════ */

/* Круг по щелчку */
const TASK_CYCLE = [" ", "ю", "+", "-"];

/* Пункты меню при наведении, в этом порядке */
const TASK_STATES = [
  [" ", "Не начато"],
  ["ю", "В работе"],
  ["+", "Готово"],
  ["-", "Отказ"],
  ["а", "Срочно"],
  ["!", "Важно"],
  ["?", "Вопрос"],
  ["=", "Пауза"],
  ["и", "Работает ИИ"],
  ["x", "Выполнено (x)"]
];

const MENU_SHOW_DELAY = 400;   // мс до появления меню
const MENU_HIDE_DELAY = 250;   // мс до скрытия после ухода мыши

function nextTaskState(ch) {
  const i = TASK_CYCLE.indexOf(ch);
  return i === -1 ? TASK_CYCLE[0] : TASK_CYCLE[(i + 1) % TASK_CYCLE.length];
}

/* Строка задачи: префикс до символа состояния и сам символ */
const TASK_LINE_RE = /^((?:[ \t]*>)*[ \t]*(?:[-*+]|\d{1,9}[.)])[ \t]+\[)([^\]])\]/;

/* Пункт списка: цитата, отступ, маркер, состояние задачи (если есть) */
const LIST_RE = /^((?:[ \t]*>)*)([ \t]*)([-*+]|\d{1,9}[.)])(?:[ \t]+|$)(?:\[([^\]])\](?=[ \t]|$))?/;
const QUOTE_RE = /^((?:[ \t]*>)*)([ \t]*)/;
const FENCE_RE = /^(?:[ \t]*>)*[ \t]*(```|~~~)/;

function visualWidth(ws, tabSize) {
  let w = 0;
  for (const c of ws) w = c === "\t" ? w + tabSize - (w % tabSize) : w + 1;
  return w;
}

/* --- номера задач по уровням --- */

class TaskNumWidget extends WidgetType {
  constructor(num) { super(); this.num = num; }
  toDOM(view) {
    const s = view.dom.ownerDocument.createElement("span");
    s.className = "yic-task-num";
    s.setAttribute("contenteditable", "false");
    s.setAttribute("aria-hidden", "true");
    s.createSpan({ cls: "yic-task-num-inner", text: String(this.num) });
    return s;
  }
  eq(o) { return o.num === this.num; }
  ignoreEvent() { return true; }
}

/* Возвращает [{pos, num}] — позиция маркера списка и номер задачи.
   Каждый уровень вложенности считается отдельно с 1.
   Номер ставится, только если на уровне больше одного пункта
   (как в режиме чтения). Задачи в нумерованных списках не нумеруются. */
function computeTaskNumbers(doc, tabSize) {
  const out = [];
  const stack = [];
  let quote = null, inFence = false, inFm = false;

  const flush = (lvl) => {
    if (lvl.ordered || lvl.items < 2) return;
    lvl.tasks.forEach((pos, i) => out.push({ pos, num: i + 1 }));
  };
  const closeAll = () => {
    while (stack.length) flush(stack.pop());
    quote = null;
  };

  for (let n = 1; n <= doc.lines; n++) {
    const line = doc.line(n);
    const text = line.text;

    if (n === 1 && /^---\s*$/.test(text)) { inFm = true; continue; }
    if (inFm) { if (/^(---|\.\.\.)\s*$/.test(text)) inFm = false; continue; }

    if (FENCE_RE.test(text)) { inFence = !inFence; closeAll(); continue; }
    if (inFence) continue;

    const m = LIST_RE.exec(text);
    if (!m) {
      const qm = QUOTE_RE.exec(text);
      const q = qm[1].replace(/[ \t]/g, "");
      const rest = text.slice(qm[0].length);
      if (rest === "") continue;                                  // пустая строка
      if (stack.length && q === quote && qm[2].length > 0) continue; // продолжение пункта
      closeAll();
      continue;
    }

    const q = m[1].replace(/[ \t]/g, "");
    if (stack.length && q !== quote) closeAll();
    quote = q;

    const indent = visualWidth(m[2], tabSize);
    const ordered = /\d/.test(m[3]);

    while (stack.length && stack[stack.length - 1].indent > indent) flush(stack.pop());
    let top = stack[stack.length - 1];
    if (top && top.indent === indent && top.ordered !== ordered) {
      flush(stack.pop());
      top = null;
    }
    if (!top || top.indent < indent) {
      top = { indent, ordered, items: 0, tasks: [] };
      stack.push(top);
    }

    top.items++;
    if (m[4] !== undefined) top.tasks.push(line.from + m[1].length + m[2].length);
  }
  closeAll();
  return out;
}

function buildTaskNumberDecorations(view) {
  const list = computeTaskNumbers(view.state.doc, view.state.tabSize);
  return Decoration.set(
    list.map(({ pos, num }) =>
      Decoration.widget({ widget: new TaskNumWidget(num), side: -1 }).range(pos)
    ),
    true
  );
}

const taskNumbersExt = ViewPlugin.fromClass(
  class {
    constructor(v) { this.decorations = buildTaskNumberDecorations(v); }
    update(u) {
      if (u.docChanged) this.decorations = buildTaskNumberDecorations(u.view);
    }
  },
  { decorations: (v) => v.decorations }
);

/* --- щелчок и меню --- */

function isTaskCheckbox(el) {
  return !!el && el.tagName === "INPUT" &&
    el.classList.contains("task-list-item-checkbox") &&
    !!el.closest(".markdown-source-view.is-live-preview") &&
    !el.closest(".yic-task-menu");
}

/* Чекбокс задачи под указателем: сам input или любой элемент строки задачи,
   если указатель попадает в прямоугольник чекбокса (на случай, когда поверх
   чекбокса лежит другой элемент) */
function taskCheckboxAt(e) {
  const t = e.target;
  if (!t || t.nodeType !== 1) return null;
  if (isTaskCheckbox(t)) return t;
  if (t.closest(".yic-task-menu")) return null;
  const lineEl = t.closest(".markdown-source-view.is-live-preview .cm-line");
  if (!lineEl) return null;
  const input = lineEl.querySelector("input.task-list-item-checkbox");
  if (!input || !isTaskCheckbox(input)) return null;
  const r = input.getBoundingClientRect();
  const pad = 3;
  if (e.clientX < r.left - pad || e.clientX > r.right + pad ||
      e.clientY < r.top - pad || e.clientY > r.bottom + pad) return null;
  return input;
}

/* Где в документе стоит чекбокс и какой у него символ.
   Строку берём по её DOM-элементу .cm-line: позиция внутри виджета
   чекбокса может указывать на соседнюю строку */
function getTaskContext(input) {
  if (!isTaskCheckbox(input)) return null;
  const cmEl = input.closest(".cm-editor");
  if (!cmEl) return null;
  const view = EditorView.findFromDOM(cmEl);
  if (!view) return null;
  const lineEl = input.closest(".cm-line");
  let pos = null;
  try { if (lineEl) pos = view.posAtDOM(lineEl, 0); } catch (e) { pos = null; }
  if (pos === null) {
    const r = input.getBoundingClientRect();
    pos = view.posAtCoords({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  }
  if (pos === null) return null;
  const line = view.state.doc.lineAt(pos);
  const m = TASK_LINE_RE.exec(line.text);
  if (!m) return null;
  return { view, lineFrom: line.from, char: m[2] };
}

/* Меняет символ в квадратных скобках задачи на строке lineFrom */
function setTaskState(view, lineFrom, ch) {
  const doc = view.state.doc;
  if (lineFrom > doc.length) return;
  const line = doc.lineAt(lineFrom);
  const m = TASK_LINE_RE.exec(line.text);
  if (!m || m[2] === ch) return;
  const at = line.from + m[1].length;
  view.dispatch({
    changes: { from: at, to: at + m[2].length, insert: ch },
    userEvent: "input.yic-task"
  });
}

/* --- значки-глифы: флажки и цифры --- */

const FLAG_LABELS = {
  "▢": "Пусто",
  "☑": "Готово",
  "◧": "В процессе",
  "☒": "Отменено",
  "⚠": "Важно",
  "⍰": "Вопрос"
};

function isGlyphIcon(el) {
  return !!el && el.nodeType === 1 &&
    el.classList.contains("inline-icon") &&
    !!el.dataset.icon &&
    !!el.closest(".cm-editor") &&
    !el.closest(".yic-task-menu");
}

/* Где в документе стоит значок; длина — с селекторами варианта FE0E/FE0F */
function getGlyphContext(span) {
  if (!isGlyphIcon(span)) return null;
  const view = EditorView.findFromDOM(span.closest(".cm-editor"));
  if (!view) return null;
  const icon = span.dataset.icon;
  let from;
  try { from = view.posAtDOM(span); } catch (e) { return null; }
  const doc = view.state.doc;
  if (doc.sliceString(from, from + icon.length) !== icon) return null;
  let to = from + icon.length;
  while (to < doc.length) {
    const c = doc.sliceString(to, to + 1).charCodeAt(0);
    if (c !== 0xFE0E && c !== 0xFE0F) break;
    to++;
  }
  return { view, from, to, icon };
}

function setGlyph(ctx, icon) {
  const { view, from, to } = ctx;
  if (view.state.doc.sliceString(from, from + ctx.icon.length) !== ctx.icon) return;
  if (icon === ctx.icon) return;
  view.dispatch({
    changes: { from, to, insert: icon },
    userEvent: "input.yic-glyph"
  });
}

/* --- всплывающее меню состояний (задачи, флажки, цифры) --- */

class StateMenu {
  constructor() {
    this.el = null;
    this.anchor = null;
    this.showTimer = null;
    this.hideTimer = null;
  }

  scheduleShow(anchor) {
    this.cancelHide();
    if (this.anchor === anchor && this.el) return;
    if (this.pending === anchor && this.showTimer) return;
    clearTimeout(this.showTimer);
    this.pending = anchor;
    this.showTimer = setTimeout(() => this.show(anchor), MENU_SHOW_DELAY);
  }

  cancelShow() {
    clearTimeout(this.showTimer);
    this.showTimer = null;
    this.pending = null;
  }

  scheduleHide() {
    this.cancelShow();
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => this.hide(), MENU_HIDE_DELAY);
  }

  cancelHide() {
    clearTimeout(this.hideTimer);
    this.hideTimer = null;
  }

  show(anchor) {
    this.showTimer = null;
    this.pending = null;
    if (!anchor.isConnected) return;
    const spec = isTaskCheckbox(anchor) ? taskMenuSpec(anchor) : glyphMenuSpec(anchor);
    if (!spec) return;
    this.hide();

    this.anchor = anchor;
    const doc = anchor.ownerDocument;
    const menu = doc.body.createDiv({ cls: "yic-task-menu" });
    if (spec.grid) menu.addClass("is-grid");

    for (const item of spec.items) {
      const el = menu.createDiv({ cls: "yic-task-menu-item" });
      if (item.value === spec.current) el.addClass("is-current");
      if (item.title) el.setAttribute("aria-label", item.title);
      item.render(el);

      el.addEventListener("mousedown", (e) => e.preventDefault());
      el.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.hide();
        spec.apply(item.value);
      });
    }

    menu.addEventListener("mouseenter", () => this.cancelHide());
    menu.addEventListener("mouseleave", () => this.scheduleHide());

    /* под значком, не выходя за окно */
    const r = anchor.getBoundingClientRect();
    const win = doc.defaultView;
    const mw = menu.offsetWidth, mh = menu.offsetHeight;
    let left = r.left;
    let top = r.bottom + 4;
    if (left + mw > win.innerWidth - 8) left = win.innerWidth - mw - 8;
    if (top + mh > win.innerHeight - 8) top = r.top - mh - 4;
    menu.style.left = Math.max(8, left) + "px";
    menu.style.top = Math.max(8, top) + "px";

    this.el = menu;
  }

  hide() {
    this.cancelShow();
    this.cancelHide();
    if (this.el) this.el.remove();
    this.el = null;
    this.anchor = null;
  }

  contains(node) {
    return !!this.el && !!node && this.el.contains(node);
  }
}

/* Меню задачи: список с чекбоксом, названием и символом */
function taskMenuSpec(input) {
  const ctx = getTaskContext(input);
  if (!ctx) return null;
  return {
    current: ctx.char,
    items: TASK_STATES.map(([ch, label]) => ({
      value: ch,
      render(el) {
        const box = el.createEl("input", { cls: "task-list-item-checkbox", type: "checkbox" });
        box.tabIndex = -1;
        if (ch !== " ") {
          box.checked = true;
          box.setAttribute("data-task", ch);
        }
        el.createSpan({ cls: "yic-task-menu-label", text: label });
        el.createSpan({ cls: "yic-task-menu-key", text: `[${ch}]` });
      }
    })),
    apply(ch) {
      setTaskState(ctx.view, ctx.lineFrom, ch);
      ctx.view.focus();
    }
  };
}

/* Меню значка: флажки списком, цифры сеткой 4 × 5 */
function glyphMenuSpec(span) {
  const ctx = getGlyphContext(span);
  if (!ctx) return null;
  const isDigit = DIGIT_CYCLE.includes(ctx.icon);
  const icons = isDigit ? DIGIT_CYCLE : CHECKBOX_CYCLE;
  return {
    current: ctx.icon,
    grid: isDigit,
    items: icons.map((icon) => ({
      value: icon,
      render(el) {
        const g = el.createSpan({ cls: `inline-icon icon-${ICON_MAP[icon]}` });
        fillIcon(g, icon);
        if (!isDigit) el.createSpan({ cls: "yic-task-menu-label", text: FLAG_LABELS[icon] || "" });
      }
    })),
    apply(icon) {
      setGlyph(ctx, icon);
      ctx.view.focus();
    }
  };
}

/* ═══════════════════════════════════════════════
   ПЛАГИН
   ═══════════════════════════════════════════════ */

class InlineCheckboxPlugin extends Plugin {
  async onload() {
    this.registerEditorExtension([ext, taskNumbersExt]);

    this.taskMenu = new StateMenu();
    this.register(() => this.taskMenu.hide());
    this.registerTaskHandlers(window);
    this.registerEvent(this.app.workspace.on("window-open", (_w, win) => this.registerTaskHandlers(win)));
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.taskMenu.hide()));
    this.registerEvent(this.app.workspace.on("layout-change", () => this.taskMenu.hide()));

    this.addCommand({
      id: 'toggle-checkbox',
      name: 'Insert or toggle checkbox',
      editorCallback: (editor) => {
        toggleOrInsert(editor, CHECKBOX_CYCLE);
      }
    });

    this.addCommand({
      id: 'toggle-digit',
      name: 'Insert or toggle circled digit',
      editorCallback: (editor) => {
        smartInsertDigit(editor);
      }
    });
  }

  /* Перехват щелчка по чекбоксу задачи и наведение — в фазе захвата,
     раньше обработчиков Obsidian, которые переключают [ ] ↔ [x] */
  registerTaskHandlers(win) {
    const menu = this.taskMenu;
    const opts = { capture: true };

    /* Не пускаем нажатие к Obsidian, иначе он сам переключит [ ] ↔ [x] */
    const block = (e) => {
      const input = taskCheckboxAt(e);
      if (!input || !getTaskContext(input)) return;
      e.stopPropagation();
      e.stopImmediatePropagation();
      if (e.type !== "pointerdown" && e.type !== "pointerup") e.preventDefault();
    };
    for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup"]) {
      this.registerDomEvent(win, type, block, opts);
    }

    this.registerDomEvent(win, "click", (e) => {
      const input = taskCheckboxAt(e);
      if (input) {
        const ctx = getTaskContext(input);
        if (!ctx) return;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        menu.hide();
        if (e.button !== 0) return;
        setTaskState(ctx.view, ctx.lineFrom, nextTaskState(ctx.char));
        return;
      }
      /* щелчок по глифу переключает его сам (IconWidget), меню убираем */
      const g = e.target && e.target.closest && e.target.closest(".inline-icon");
      if (isGlyphIcon(g)) menu.hide();
    }, opts);

    const hoverTarget = (e) => {
      const input = taskCheckboxAt(e);
      if (input) return input;
      const t = e.target;
      const g = t && t.closest && t.closest(".inline-icon");
      return isGlyphIcon(g) ? g : null;
    };

    /* Наведение отслеживается по движению: чекбокс может быть
       закрыт другим элементом строки, и mouseover на нём не срабатывает */
    this.registerDomEvent(win, "mousemove", (e) => {
      const a = hoverTarget(e);
      if (a) { menu.scheduleShow(a); return; }
      if (menu.contains(e.target)) { menu.cancelHide(); return; }
      if (menu.el) { if (!menu.hideTimer) menu.scheduleHide(); }
      else menu.cancelShow();
    }, { capture: true, passive: true });

    this.registerDomEvent(win, "keydown", () => menu.hide(), opts);
    this.registerDomEvent(win, "wheel", (e) => {
      if (!menu.contains(e.target)) menu.hide();
    }, { capture: true, passive: true });
  }
}

module.exports = InlineCheckboxPlugin;