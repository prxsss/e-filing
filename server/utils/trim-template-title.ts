export function trimTemplateTitle(rawTitle: string | null | undefined): string {
  const title = String(rawTitle ?? '').trim();
  if (!title) {
    return '';
  }

  const trimmedStart = title.trimStart();
  let index = 0;

  while (index < trimmedStart.length && trimmedStart.charCodeAt(index) >= 48 && trimmedStart.charCodeAt(index) <= 57) {
    index += 1;
  }

  if (index === 0) {
    return title;
  }

  if (index >= trimmedStart.length) {
    return title;
  }

  if (!/\s/.test(trimmedStart[index])) {
    return title;
  }

  const remainder = trimmedStart.slice(index).trim();
  return remainder.length > 0 ? remainder : title;
}
