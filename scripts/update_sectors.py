"""sectors 테이블 sector_en / macro_sector 일괄 업데이트"""
import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(Path(__file__).parent.parent / 'frontend' / '.env.local', override=True)

sb = create_client(
    os.environ['NEXT_PUBLIC_SUPABASE_URL'],
    os.environ['SUPABASE_SERVICE_ROLE_KEY']
)

# 한글 섹터명 → (영문, 8대 대분류)
SECTOR_MAP = {
    '반도체와 반도체장비':      ('Semiconductors',              'Semiconductor'),
    '디스플레이·전자부품':      ('Display & Electronics',        'Semiconductor'),
    '전기장비':                 ('Electrical Equipment',         'Industrial'),
    '화학':                     ('Chemicals',                    'Industrial'),
    '바이오·제약':              ('Bio/Pharma',                   'Biotech'),
    '고무·플라스틱':            ('Rubber & Plastics',            'Industrial'),
    '비금속광물':               ('Non-metallic Minerals',        'Industrial'),
    '2차전지·소재':             ('Battery & Materials',          'Battery'),
    '금속가공':                 ('Metal Processing',             'Industrial'),
    '자동차':                   ('Automotive',                   'Automotive'),
    '방산·항공':                ('Defense & Aerospace',          'Industrial'),
    '기계·설비':                ('Machinery & Equipment',        'Industrial'),
    '식품':                     ('Food',                         'Consumer'),
    '음료':                     ('Beverages',                    'Consumer'),
    '담배':                     ('Tobacco',                      'Consumer'),
    '섬유':                     ('Textiles',                     'Consumer'),
    '의복·패션':                ('Apparel & Fashion',            'Consumer'),
    '가죽·신발':                ('Leather & Footwear',           'Consumer'),
    '목재·종이':                ('Wood & Paper',                 'Industrial'),
    '출판·인쇄':                ('Publishing & Printing',        'Consumer'),
    '석유·화학제품':            ('Petroleum & Chemicals',        'Energy'),
    '1차금속':                  ('Primary Metals',               'Industrial'),
    '출판·미디어':              ('Media & Publishing',           'Consumer'),
    '영상·방송':                ('Broadcasting & Video',         'Consumer'),
    '통신·방송':                ('Telecom & Broadcasting',       'Industrial'),
    '통신':                     ('Telecommunications',           'Industrial'),
    'IT·소프트웨어':            ('IT Software',                  'Semiconductor'),
    '정보서비스':               ('Information Services',         'Semiconductor'),
    '금융':                     ('Banking & Finance',            'Finance'),
    '보험·연금':                ('Insurance',                    'Finance'),
    '금융지원서비스':           ('Financial Services',           'Finance'),
    '건설':                     ('Construction',                 'Industrial'),
    '도매':                     ('Wholesale',                    'Consumer'),
    '소매':                     ('Retail',                       'Consumer'),
    '운송':                     ('Transportation',               'Industrial'),
    '창고·물류':                ('Warehousing & Logistics',      'Industrial'),
    '항공':                     ('Aviation',                     'Industrial'),
    '창고·운송':                ('Storage & Transport',          'Industrial'),
    '숙박':                     ('Accommodation',                'Consumer'),
    '음식점':                   ('Restaurants',                  'Consumer'),
    '부동산':                   ('Real Estate',                  'Finance'),
    '전문·과학·기술서비스':     ('Professional & Tech Services', 'Industrial'),
    '연구개발':                 ('R&D Services',                 'Biotech'),
    '광고·시장조사':            ('Advertising & Marketing',      'Consumer'),
    '전문서비스':               ('Professional Services',        'Industrial'),
    '사업지원서비스':           ('Business Support Services',    'Industrial'),
    '공공행정':                 ('Public Administration',        'Industrial'),
    '교육':                     ('Education',                    'Consumer'),
    '보건·의료':                ('Healthcare',                   'Biotech'),
    '사회복지':                 ('Social Welfare',               'Consumer'),
    '예술·스포츠·여가':         ('Arts, Sports & Leisure',       'Consumer'),
    '창작·예술':                ('Creative Arts',                'Consumer'),
    '도서관·박물관':            ('Libraries & Museums',          'Consumer'),
    '농업':                     ('Agriculture',                  'Industrial'),
    '임업':                     ('Forestry',                     'Industrial'),
    '어업':                     ('Fishing',                      'Industrial'),
    '석탄·광업':                ('Coal & Mining',                'Energy'),
    '원유·가스':                ('Oil & Gas',                    'Energy'),
    '금속광업':                 ('Metal Mining',                 'Industrial'),
    '전기·가스':                ('Utilities',                    'Energy'),
    '수도':                     ('Water Supply',                 'Energy'),
    '하수·폐기물':              ('Waste Management',             'Industrial'),
    '환경·복원':                ('Environmental Services',       'Industrial'),
    '환경정화':                 ('Environmental Cleanup',        'Industrial'),
    '토목':                     ('Civil Engineering',            'Industrial'),
    '전문건설':                 ('Specialty Construction',       'Industrial'),
    '기타':                     ('Others',                       'Industrial'),
    '미분류':                   ('Unclassified',                 'Industrial'),
    '가구':                     ('Furniture',                    'Consumer'),
    '기타 제조':                ('Other Manufacturing',          'Industrial'),
    '산업용 기계수리':          ('Industrial Machinery Repair',  'Industrial'),
    '광업지원서비스':           ('Mining Support Services',      'Industrial'),
    '임대업':                   ('Rental Services',              'Finance'),
    '기타 오락':                ('Other Entertainment',          'Consumer'),
    '협회·단체':                ('Associations & Groups',        'Industrial'),
    '수리업':                   ('Repair Services',              'Industrial'),
    '기타 개인서비스':          ('Other Personal Services',      'Consumer'),
    '지주회사':                 ('Holding Company',              'Finance'),
    '투자회사':                 ('Investment Company',           'Finance'),
    '지주회사(전자·화학)':      ('Holding Co. (Electronics)',    'Finance'),
    '지주회사(반도체·ICT)':     ('Holding Co. (Semiconductor)',  'Finance'),
    '지주회사(방산·에너지)':    ('Holding Co. (Defense/Energy)', 'Finance'),
    '지주회사(유통·식품)':      ('Holding Co. (Retail/Food)',    'Finance'),
    '지주회사(에너지·인프라)':  ('Holding Co. (Energy/Infra)',   'Finance'),
    '지주회사(자동차)':         ('Holding Co. (Automotive)',     'Finance'),
    '지주회사(건설·시멘트)':    ('Holding Co. (Construction)',   'Finance'),
    '지주회사(금융)':           ('Holding Co. (Financial)',      'Finance'),
    '지주회사(기타)':           ('Holding Co. (Other)',          'Finance'),
    '운송장비':                 ('Transportation Equipment',     'Automotive'),
    '지주회사(전선·전기)':      ('Holding Co. (Electric Wire)',  'Finance'),
    '지주회사(기계·건설)':      ('Holding Co. (Machinery)',      'Finance'),
}

# macro_sector 컬럼이 없으면 일단 sector_en만 업데이트 (에러 핸들링)
success, fail = 0, 0
for kr, (en, macro) in SECTOR_MAP.items():
    try:
        sb.table('sectors').update({'sector_en': en}).eq('name', kr).execute()
        success += 1
    except Exception as e:
        print(f'FAIL {kr}: {e}')
        fail += 1

print(f'sector_en 업데이트: 성공 {success}개, 실패 {fail}개')
