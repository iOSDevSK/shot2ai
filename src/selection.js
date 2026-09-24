// Runs in the page. Read only the explicit selection, including text fields
// and focused same-origin frames; never read a password or a whole field.
export function readSelectedText() {
  function read(doc) {
    let active = doc.activeElement;
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    if (active?.tagName === 'IFRAME') {
      try { return active.contentDocument ? read(active.contentDocument) : ''; } catch { return ''; }
    }
    if (active?.closest?.('#shot2ai-preview-card') || active?.id === 'shot2ai-preview-card') return '';
    if (active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA') {
      if (active.type === 'password' || typeof active.selectionStart !== 'number') return '';
      return active.value.slice(active.selectionStart, active.selectionEnd);
    }
    const root = active?.getRootNode();
    const selection = root?.getSelection?.() || doc.getSelection();
    return selection?.toString() || '';
  }
  return read(document);
}

export const textWithPrompt = (prompt, text) => [prompt?.trim(), text?.trim()].filter(Boolean).join('\n\n');
