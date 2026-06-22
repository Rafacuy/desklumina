/**
 * Render a non-selectable section header row for the Settings panel
 */
export function sectionHeader(label: string, panelWidth = 42): string {
  const labelWidth = Array.from(label).length;
  const innerWidth = panelWidth - labelWidth - 4; 
  const half = Math.floor(innerWidth / 2);
  const leftDashes = "─".repeat(half);
  const rightDashes = "─".repeat(innerWidth - half); 

  const line = (s: string) => `<span alpha="35%">${s}</span>`;
  const text = `<span size="small" weight="bold" alpha="60%"> ${label} </span>`;

  return `${line(leftDashes)}${text}${line(rightDashes)}`;
}
