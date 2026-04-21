export async function copyText(value) {
  const text = String(value || '');
  if (!text) {
    return false;
  }

  if (navigator?.clipboard?.writeText && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      // Fall through to legacy copy path.
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'readonly');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';
  textarea.style.top = '-9999px';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    if (copied) {
      return true;
    }
  } catch (error) {
    document.body.removeChild(textarea);
  }

  window.prompt('复制失败，请手动复制下面内容', text);
  return false;
}
