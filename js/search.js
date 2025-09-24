export function applySearch(query, notes) {
  const scored = [];
  for (const note of notes) {
    const haystack = `${note.title}\n${note.content}`.toLowerCase();
    const score = fuzzyScore(query, haystack);
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
