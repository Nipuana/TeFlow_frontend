import type { ReactNode } from 'react';

/**
 * Dense, line-numbered ledger table — the default view identity.
 * Every row carries a padded line number in the gutter (0001, 0002…) for stable
 * references ("check row 0042"), reinforcing the audit-ledger metaphor.
 */
export interface LedgerRow {
  key: string;
  cells: ReactNode[];
  onClick?: () => void;
}

export function Ledger({
  columns,
  rows,
  addRow,
}: {
  columns: string[];
  rows: LedgerRow[];
  /** Optional inline "quick add" row rendered at the top of the body. Its cells
   *  must align with `columns`; it carries a "+" in the gutter instead of a line
   *  number and is never treated as a data row. */
  addRow?: ReactNode[];
}) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="ledger">
        <thead>
          <tr>
            <th className="linenum" aria-hidden>
              #
            </th>
            {columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {addRow && (
            <tr className="ledger-add">
              <td className="linenum" aria-hidden>
                +
              </td>
              {addRow.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          )}
          {rows.map((row, i) => (
            <tr
              key={row.key}
              onClick={row.onClick}
              style={row.onClick ? { cursor: 'pointer' } : undefined}
              tabIndex={row.onClick ? 0 : undefined}
              onKeyDown={
                row.onClick
                  ? (e) => {
                      if (e.key === 'Enter') row.onClick!();
                    }
                  : undefined
              }
            >
              <td className="linenum">{String(i + 1).padStart(4, '0')}</td>
              {row.cells.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
