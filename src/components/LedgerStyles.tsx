// Styly Knihy majitelů (Vklady a vyrovnání + záložka Tým). Jako komponenta
// vedle stránek, ne v globals.css — tabulka se na mobilu mění na karty.
export default function LedgerStyles() {
  return <style>{`
.vk-grid {
  display: grid;
  grid-template-columns: 1.1fr repeat(6, 1fr) 1.3fr;
  gap: 8px;
  align-items: center;
  font-size: 13px;
  color: var(--text-secondary);
}
.vk-grid > *:not(:first-child) { text-align: right; }
.vk-head {
  font-size: 11px; font-weight: 600; color: var(--text-muted);
  padding: 0 10px 8px; border-bottom: 1px solid var(--border-subtle);
}
.vk-row { padding: 10px; border-bottom: 1px solid var(--border-subtle); }
.vk-move {
  padding: 10px 14px; border-radius: 10px;
  background-color: var(--bg-card-alt); border: 1px solid var(--border-card);
}
.vk-move-main { display: flex; align-items: center; gap: 10px; font-size: 14px; }
.vk-move-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 4px; font-size: 12px; color: var(--text-muted); }

@media (max-width: 768px) {
  .vk-head { display: none; }
  .vk-grid.vk-row {
    grid-template-columns: 1fr 1fr;
    padding: 12px; margin-bottom: 8px; border: 1px solid var(--border-card); border-radius: 10px;
  }
  .vk-grid.vk-row > *:first-child { grid-column: 1 / -1; font-size: 15px; }
  .vk-grid.vk-row > *:not(:first-child) { text-align: left; }
  .vk-grid.vk-row > *[data-label]::before {
    content: attr(data-label); display: block; font-size: 10px; color: var(--text-dim); font-weight: 400;
  }
  .vk-grid.vk-row > *:last-child { grid-column: 1 / -1; font-size: 15px; }
}
`}</style>
}
