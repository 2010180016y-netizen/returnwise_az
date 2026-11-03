import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/Card';
import { Badge } from '../../components/Badge';

export interface B2BPartnerItem {
  id: string;
  category: string;
  badgeVariant: 'info' | 'success' | 'warning';
  title: string;
  description: string;
  benefit: string;
  ctaText: string;
  targetUrl: string;
}

export const DEFAULT_B2B_PARTNERS: B2BPartnerItem[] = [
  {
    id: 'partner-3pl',
    category: '반품 물류 3PL',
    badgeVariant: 'info',
    title: '반품 검수·재포장 전담 풀필먼트',
    description: '단순변심 B급 상품 재포장, 기능 검수, 당일 재입고 대행으로 폐기 손실을 40% 이상 절감합니다.',
    benefit: 'ReturnWise 셀러 특별 제휴: 첫 달 보관료 30% 지원',
    ctaText: '3PL 파트너 혜택 보기 →',
    targetUrl: '/partner/3pl?utm_source=returnwise&utm_medium=calc_banner&utm_campaign=3pl',
  },
  {
    id: 'partner-packaging',
    category: '포장재 B2B 특가',
    badgeVariant: 'success',
    title: '친환경 에어캡·안전봉투·반품 단상자',
    description: '회수 배송 시 파손 방지를 위한 전용 안전봉투 및 에어캡 완충재 도매 직공급.',
    benefit: '셀러 전용 대량 구매 15% 즉시 할인 쿠폰',
    ctaText: '포장재 단가표 확인 →',
    targetUrl: '/partner/packaging?utm_source=returnwise&utm_medium=calc_banner&utm_campaign=packaging',
  },
  {
    id: 'partner-erp',
    category: '반품 자동화 ERP',
    badgeVariant: 'warning',
    title: '스마트스토어·쿠팡 반품 자동 동기화',
    description: '멀티 마켓 반품 접수·송장 추적·환불 보류 자동화로 분실 및 오배송을 제로화합니다.',
    benefit: '신규 셀러 14일 무료 체험 + 초기 도입비 면제',
    ctaText: '솔루션 연동 혜택 보기 →',
    targetUrl: '/partner/erp?utm_source=returnwise&utm_medium=calc_banner&utm_campaign=erp',
  },
];

export const B2BAffiliateBanner: React.FC = () => {
  return (
    <Card className="rw-card" style={{ marginTop: '1.5rem' }}>
      <CardHeader>
        <div className="rw-flex-between" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
          <CardTitle>💼 반품 비용 절감 파트너십 (B2B 솔루션 추천)</CardTitle>
          <Badge variant="info">셀러 제휴 혜택</Badge>
        </div>
        <CardDescription>
          반품 처리 물류비와 자재비를 낮출 수 있는 검증된 이커머스 파트너 솔루션입니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="rw-stack-md">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '1rem',
          }}
        >
          {DEFAULT_B2B_PARTNERS.map((partner) => (
            <div
              key={partner.id}
              style={{
                background: '#FFFFFF',
                border: '1px solid var(--color-slate-200)',
                borderRadius: 'var(--radius-md)',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '0.75rem',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div className="rw-stack-xs">
                <div>
                  <Badge variant={partner.badgeVariant}>{partner.category}</Badge>
                </div>
                <h4
                  style={{
                    fontSize: '1rem',
                    fontWeight: 700,
                    color: 'var(--color-slate-900)',
                    margin: '0.25rem 0',
                    lineHeight: 1.4,
                  }}
                >
                  {partner.title}
                </h4>
                <p
                  style={{
                    fontSize: '0.8125rem',
                    color: 'var(--color-slate-600)',
                    margin: 0,
                    lineHeight: 1.5,
                  }}
                >
                  {partner.description}
                </p>
              </div>

              <div className="rw-stack-xs" style={{ marginTop: 'auto', paddingTop: '0.5rem' }}>
                <div
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'var(--color-primary-700)',
                    background: 'var(--color-primary-50)',
                    padding: '0.375rem 0.5rem',
                    borderRadius: 'var(--radius-sm)',
                    lineHeight: 1.3,
                  }}
                >
                  🎁 {partner.benefit}
                </div>
                <a
                  href={partner.targetUrl}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  style={{
                    display: 'inline-block',
                    textAlign: 'center',
                    background: 'var(--color-primary-600)',
                    color: '#FFFFFF',
                    padding: '0.5rem 0.75rem',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    textDecoration: 'none',
                    marginTop: '0.25rem',
                    transition: 'background-color 0.15s ease',
                  }}
                >
                  {partner.ctaText}
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* 공정거래위원회 추천·보증 심사지침 준수 경제적 대가 고지 */}
        <div
          style={{
            background: 'var(--color-slate-50)',
            border: '1px solid var(--color-slate-200)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.625rem 0.875rem',
            fontSize: '0.6875rem',
            color: 'var(--color-slate-500)',
            lineHeight: 1.4,
          }}
        >
          📢 <strong>[경제적 대가 관계 안내]</strong> 본 영역은 파트너사 제휴 링크를 포함하고 있으며, 이용자가 파트너사 서비스를 계약하거나 이용할 경우 ReturnWise에 소정의 제휴 수수료가 지급될 수 있습니다. ReturnWise는 엄격한 보안(CSP) 원칙에 따라 일체의 외부 JS 추적 스크립트를 탑재하지 않습니다.
        </div>
      </CardContent>
    </Card>
  );
};
