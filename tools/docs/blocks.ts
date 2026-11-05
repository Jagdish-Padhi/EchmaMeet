/**
 * Generated sections of a markdown document sit between marker comments:
 *   <!-- name:start --> ... <!-- name:end -->
 * Only the text between the markers is ever rewritten.
 */
export function replaceBlock(document: string, name: string, body: string): string {
  const startMarker = `<!-- ${name}:start -->`;
  const endMarker = `<!-- ${name}:end -->`;
  const start = document.indexOf(startMarker);
  const end = document.indexOf(endMarker);
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`The document must contain ${startMarker} and ${endMarker}.`);
  }
  return `${document.slice(0, start)}${startMarker}\n${body}\n${endMarker}${document.slice(end + endMarker.length)}`;
}
