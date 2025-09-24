import { state } from './state.js';
import { dom } from './dom.js';
import { persistNotes, persistPreferences, loadNotes } from './storage.js';
import { applySearch } from './search.js';
import {
  generateId,
  buildPreview,
  formatRelativeTimestamp,
  formatFullTimestamp,
} from './utils.js';

export function buildNewNote(initial = {}) {
  const now = Date.now();
  return {
    id: initial.id || generateId(),
    title: typeof initial.title === 'string' ? initial.title : '',
    content: typeof initial.content === 'string' ? initial.content : '',
    updatedAt: typeof initial.updatedAt === 'number' ? initial.updatedAt : now,
  };
}

export function createNote() {
  const newNote = buildNewNote();
  state.notes.unshift(newNote);
  changeActiveNote(newNote.id);
  persistNotes();
  renderNoteList();
  renderActiveNote();
  if (dom.noteList) {
    dom.noteList.scrollTop = 0;
  }
  return newNote;
}

export function changeActiveNote(id) {
  if (state.activeNoteId === id) return;
  state.activeNoteId = id;
  persistPreferences({ activeNoteId: id });
}

export function updateActiveNote(patch) {
  const note = state.notes.find((item) => item.id === state.activeNoteId);
  if (!note) return;
  let didChange = false;
  if (typeof patch.title === 'string' && patch.title !== note.title) {
    note.title = patch.title;
    didChange = true;
  }
  if (typeof patch.content === 'string' && patch.content !== note.content) {
    note.content = patch.content;
    didChange = true;
  }
  if (didChange) {
    note.updatedAt = Date.now();
    if (dom.timestamp) {
      dom.timestamp.textContent = formatFullTimestamp(note.updatedAt);
    }
  }
}

export function deleteNote(id) {
  const index = state.notes.findIndex((note) => note.id === id);
  if (index === -1) return;
  state.notes.splice(index, 1);

  if (!state.notes.length) {
    const replacement = buildNewNote();
    state.notes.push(replacement);
    changeActiveNote(replacement.id);
  } else if (state.activeNoteId === id) {
    const nextIndex = Math.max(0, index - 1);
    changeActiveNote(state.notes[nextIndex].id);
  }

  persistNotes();
  renderNoteList();
  renderActiveNote();
}

export function renderNoteList() {
  const list = dom.noteList;
  if (!list) return;
  const query = state.searchQuery.trim().toLowerCase();
  list.innerHTML = '';

  const notes = query ? applySearch(query, state.notes) : sortNotes(state.notes);

  if (!notes.length) {
    const empty = document.createElement('div');
    empty.className = 'note-list__empty';
    empty.textContent = query ? 'No notes match your search.' : 'No notes yet. Create one to get started.';
    list.appendChild(empty);
    return;
  }

  notes.forEach((note) => {
    const card = document.createElement('div');
    card.className = 'note-card';
    card.dataset.noteId = note.id;
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    if (note.id === state.activeNoteId) {
      card.classList.add('is-active');
    }

    const contentBox = document.createElement('div');
    contentBox.className = 'note-card__content';

    const titleEl = document.createElement('h2');
    titleEl.className = 'note-card__title';
    titleEl.textContent = note.title.trim() || 'Untitled note';

    const previewEl = document.createElement('p');
    previewEl.className = 'note-card__preview';
    previewEl.textContent = buildPreview(note.content);

    const footer = document.createElement('div');
    footer.className = 'note-card__footer';

    const meta = document.createElement('span');
    meta.className = 'note-card__meta';
    meta.textContent = formatRelativeTimestamp(note.updatedAt);

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'note-card__delete';
    deleteBtn.dataset.noteAction = 'delete';
    deleteBtn.dataset.noteId = note.id;
    deleteBtn.textContent = 'Delete';

    footer.append(meta, deleteBtn);
    contentBox.append(titleEl, previewEl);
    card.append(contentBox, footer);
    list.appendChild(card);
  });
}

export function renderActiveNote() {
  const note = state.notes.find((item) => item.id === state.activeNoteId);
  if (!dom.noteTitle || !dom.noteContent || !dom.timestamp) return;

  if (!note) {
    dom.noteTitle.value = '';
    dom.noteContent.value = '';
    dom.timestamp.textContent = '';
    return;
  }

  dom.noteTitle.value = note.title;
  dom.noteContent.value = note.content;
  dom.timestamp.textContent = formatFullTimestamp(note.updatedAt);
}

export function updateSearchQuery(query) {
  state.searchQuery = query;
  renderNoteList();
}

export function syncNotesFromStorage() {
  state.notes = loadNotes();
  if (!state.notes.length) {
    const fresh = buildNewNote();
    state.notes.push(fresh);
    changeActiveNote(fresh.id);
  } else if (!state.notes.some((note) => note.id === state.activeNoteId)) {
    changeActiveNote(state.notes[0].id);
  }
  renderNoteList();
  renderActiveNote();
}

function sortNotes(notes) {
  return [...notes].sort((a, b) => b.updatedAt - a.updatedAt);
}
