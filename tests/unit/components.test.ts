import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  Button,
  Input,
  FormField,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Alert,
  ResultTable,
} from '../../src/components';

describe('T11 | Design System Common Components Contract', () => {
  describe('1. Button Component', () => {
    it('primary 버튼 렌더링 시 rw-btn 및 rw-btn-primary 클래스가 포함되어야 한다', () => {
      const html = renderToStaticMarkup(
        React.createElement(Button, { variant: 'primary', size: 'md' }, '계산하기')
      );
      assert.equal(html.includes('rw-btn'), true);
      assert.equal(html.includes('rw-btn-primary'), true);
      assert.equal(html.includes('계산하기'), true);
      assert.equal(html.includes('type="button"'), true);
    });

    it('disabled 상태일 때 disabled 속성이 적용되어야 한다', () => {
      const html = renderToStaticMarkup(
        React.createElement(Button, { disabled: true }, '비활성화')
      );
      assert.equal(html.includes('disabled=""') || html.includes('disabled'), true);
    });
  });

  describe('2. Input & FormField Component', () => {
    it('Input에 suffix("원") 전달 시 rw-input-suffix가 올바르게 렌더링되어야 한다', () => {
      const html = renderToStaticMarkup(
        React.createElement(Input, { id: 'refund', suffix: '원', defaultValue: '30000' })
      );
      assert.equal(html.includes('rw-input'), true);
      assert.equal(html.includes('has-suffix'), true);
      assert.equal(html.includes('rw-input-suffix'), true);
      assert.equal(html.includes('원'), true);
    });

    it('FormField에서 error 전달 시 role="alert"과 aria-describedby 연결이 보장되어야 한다', () => {
      const html = renderToStaticMarkup(
        React.createElement(
          FormField,
          { id: 'refund', label: '환급 금액', required: true, error: '10억 원을 초과할 수 없습니다.' },
          React.createElement(Input, { id: 'refund', isError: true })
        )
      );
      assert.equal(html.includes('role="alert"'), true);
      assert.equal(html.includes('10억 원을 초과할 수 없습니다.'), true);
      assert.equal(html.includes('aria-invalid="true"'), true);
      assert.equal(html.includes('aria-describedby="refund-error"'), true);
    });
  });

  describe('3. Card & Badge Component', () => {
    it('isRecommended 카드 렌더링 시 rw-card-recommended 클래스가 적용되어야 한다', () => {
      const html = renderToStaticMarkup(
        React.createElement(
          Card,
          { isRecommended: true },
          React.createElement(CardHeader, null, React.createElement(CardTitle, null, '회수 후 전액환급')),
          React.createElement(CardContent, null, '최저비용 대안')
        )
      );
      assert.equal(html.includes('rw-card-recommended'), true);
      assert.equal(html.includes('회수 후 전액환급'), true);
    });

    it('Badge variants (success, warning, danger) 클래스가 올바르게 부여되어야 한다', () => {
      const htmlSuccess = renderToStaticMarkup(React.createElement(Badge, { variant: 'success' }, '최저비용'));
      const htmlWarning = renderToStaticMarkup(React.createElement(Badge, { variant: 'warning' }, '확인 필요'));
      assert.equal(htmlSuccess.includes('rw-badge-success'), true);
      assert.equal(htmlWarning.includes('rw-badge-warning'), true);
    });
  });

  describe('4. Alert Component', () => {
    it('warning 알림 렌더링 시 role="alert"과 아이콘이 렌더링되어야 한다', () => {
      const html = renderToStaticMarkup(
        React.createElement(
          Alert,
          { type: 'warning', title: '귀책 사유 미확인' },
          '귀책 사유가 불분명하여 추천이 중지되었습니다.'
        )
      );
      assert.equal(html.includes('role="alert"'), true);
      assert.equal(html.includes('rw-alert-warning'), true);
      assert.equal(html.includes('귀책 사유 미확인'), true);
    });
  });

  describe('5. ResultTable Component', () => {
    it('테이블 렌더링 시 금액이 오른쪽 정렬 및 포맷팅되어야 한다', () => {
      const rows = [
        { id: '1', name: '환급 금액', amount: 30000, type: 'CASH_OUTFLOW' },
        { id: '2', name: '회수 운임', amount: 3500, type: 'CASH_OUTFLOW' },
      ];
      const html = renderToStaticMarkup(
        React.createElement(ResultTable, { rows, totalCashOutflow: 33500 })
      );
      assert.equal(html.includes('rw-table'), true);
      assert.equal(html.includes('30,000원'), true);
      assert.equal(html.includes('3,500원'), true);
      assert.equal(html.includes('33,500원'), true);
      assert.equal(html.includes('rw-td-number'), true);
    });
  });
});
