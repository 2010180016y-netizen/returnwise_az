import React from 'react';
import { CostLineItem } from '../domain/types';

export interface ResultTableRow {
  id: string;
  name: string;
  amount: number;
  type?: string;
  description?: string;
}

export interface ResultTableProps {
  caption?: string;
  rows: (CostLineItem | ResultTableRow)[];
  totalCashOutflow: number;
  totalEconomicCost?: number;
  showEconomicColumn?: boolean;
  className?: string;
}

export const ResultTable: React.FC<ResultTableProps> = ({
  caption,
  rows,
  totalCashOutflow,
  totalEconomicCost,
  showEconomicColumn = false,
  className = '',
}) => {
  return (
    <div className={`rw-table-container ${className}`.trim()}>
      <table className="rw-table">
        {caption && <caption className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>{caption}</caption>}
        <thead>
          <tr>
            <th scope="col" style={{ width: '50%' }}>비용 세부 항목</th>
            <th scope="col" className="rw-td-number" style={{ width: showEconomicColumn ? '25%' : '50%' }}>
              현금 지출 (원)
            </th>
            {showEconomicColumn && (
              <th scope="col" className="rw-td-number" style={{ width: '25%' }}>
                순경제비용 (원)
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isCredit = row.type === 'CREDIT';
            const isAsset = row.type === 'ASSET_VALUE';
            const amountPrefix = isCredit || isAsset ? '-' : '+';
            const amountDisplay = `${amountPrefix}${row.amount.toLocaleString('ko-KR')}원`;

            return (
              <tr key={row.id}>
                <td>
                  <strong>{row.name}</strong>
                  {row.description && (
                    <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>
                      {row.description}
                    </span>
                  )}
                </td>
                <td className="rw-td-number">
                  {isAsset ? '0원 (현금 아님)' : amountDisplay}
                </td>
                {showEconomicColumn && (
                  <td className="rw-td-number">
                    {amountDisplay}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="rw-table-total-row">
            <th scope="row">최종 합계 (Total)</th>
            <td className="rw-td-number" style={{ color: '#0f172a' }}>
              <strong>{totalCashOutflow.toLocaleString('ko-KR')}원</strong>
            </td>
            {showEconomicColumn && totalEconomicCost !== undefined && (
              <td className="rw-td-number" style={{ color: '#047857' }}>
                <strong>{totalEconomicCost.toLocaleString('ko-KR')}원</strong>
              </td>
            )}
          </tr>
        </tfoot>
      </table>
    </div>
  );
};
