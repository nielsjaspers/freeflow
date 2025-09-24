import { state } from './state.js';

export function applySearch(query, notes) {
  const includeTitle = state.preferences.searchInTitle;
  const includeContent = state.preferences.searchInContent;
  if (!includeTitle && !includeContent) {
    return [...notes];
  }

  const scored = [];
  for (const note of notes) {
    let score = 0;
    if (includeTitle && typeof note.title === 'string') {
      score = Math.max(score, fuzzyScore(query, note.title.toLowerCase()));
    }
    if (includeContent && typeof note.content === 'string') {
      score = Math.max(score, fuzzyScore(query, note.content.toLowerCase()));
    }
    if (score > 0) {
      scored.push({ note, score });
    }
  }

  scored.sort((a, b) => {
    if (b.score === a.score) {
      return b.note.updatedAt - a.note.updatedAt;
    }
    return b.score - a.score;
  });
  return scored.map((item) => item.note);
}

export function fuzzyScore(query, text) {
  let score = 0;
  let textIdx = 0;

  for (let i = 0; i < query.length; i += 1) {
    const queryChar = query[i];
    let found = false;
    while (textIdx < text.length) {
      if (text[textIdx] === queryChar) {
        score += 10;
        if (i > 0 && textIdx > 0 && text[textIdx - 1] === query[i - 1]) {
          score += 5;
        }
        textIdx += 1;
        found = true;
        break;
      }
      textIdx += 1;
    }
    if (!found) {
      return 0;
    }
  }

  return score;
}
