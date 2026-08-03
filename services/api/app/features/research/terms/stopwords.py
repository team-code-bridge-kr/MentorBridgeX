"""불용어와 한국어 조사·어미 목록.

형태소 분석기를 쓰지 않는 대신, 어절 끝에서 조사를 깎아내고 불용어로 거른다.
정확도는 형태소 분석기보다 떨어지지만 의존성 없이 동작하고,
TermExtractor 인터페이스 뒤에 있어 나중에 교체할 수 있다.
"""

from __future__ import annotations

# 길이가 긴 것부터 시도해야 "에서는" 을 "에서"+"는" 으로 잘못 깎지 않는다
JOSA_SUFFIXES: tuple[str, ...] = (
    "으로부터", "에서부터", "이라고", "라고는", "에서는", "에게서", "으로써", "으로서",
    "까지는", "부터는", "에서도", "이라는", "라는", "이라", "에서", "에게", "한테",
    "으로", "처럼", "보다", "까지", "부터", "마다", "조차", "밖에", "이나", "라도",
    "이란", "이든", "과의", "와의", "의는", "이며", "하며", "하고", "이고",
    "은", "는", "이", "가", "을", "를", "에", "의", "와", "과", "도", "만", "로",
    "며", "고", "요", "야", "께", "든",
)

# 형식명사·의존명사 — 조사를 깎으면 1글자만 남아 걸러지지 않으므로 원형도 함께 막는다
KO_FUNCTION_NOUNS = """
    것 것이 것을 것은 것으로 것들 수 수가 수는 등 등등 및 때 때문 곳 점 중 안 밖 위 아래
    앞 뒤 옆 간 초 말 년 월 일 시 분 개 명 건 원 억 만 차 번 대 측 내 외 전 후 약 총
    이것 그것 저것 여기 저기 거기 무엇 누구 어디 언제
"""

# 뉴스·논문 문장에 흔하지만 개념이 아닌 말들
KO_STOPWORDS: frozenset[str] = frozenset(
    KO_FUNCTION_NOUNS.split()
) | frozenset(
    """
    그리고 그러나 하지만 또한 그래서 따라서 때문 통해 위해 대한 관련 이번 지난 올해 내년
    최근 현재 오늘 어제 내일 기자 연합뉴스 뉴스 사진 제공 무단 전재 재배포 금지 저작권
    있다 없다 한다 했다 된다 됐다 이다 아니다 같다 밝혔다 말했다 전했다 나타났다 보인다
    예정 계획 방침 추진 진행 발표 공개 개최 실시 운영 지원 확대 강화 개선 마련 구축
    가장 매우 더욱 다시 아직 이미 서로 모두 각각 등의 등을 등이 이런 저런 그런 어떤
    이후 이전 동안 사이 경우 정도 수준 상황 문제 결과 대상 대해 대비 위한 따른 따라
    올해도 지난해 관계자 이날 당시 우리 자신 사람 사람들 국내 해외 세계 전국 서울
    오는 향후 당초 현지시간 잇따라 함께 통한 활용 역량 확대해 나갈 예정이다
    한국 미국 중국 일본 정부 기업 회사 그룹 시장 산업 분야 사업 서비스 제품 기술
    """.split()
)

EN_STOPWORDS: frozenset[str] = frozenset(
    """
    the and for are but not you all can has have had was were will with this that these those
    from into over under than then they them their there here what when where which while who
    whom how why its it's our your his her him she he we us been being does did done doing
    such some any more most other another each both few own same very just also however
    therefore thus hence moreover furthermore although though because since about above below
    between during before after again further once only same too via per etc using used use
    based show shows shown propose proposed present presents paper study studies results
    method methods approach model models data analysis new novel first second three two one
    abstract introduction conclusion discussion figure table section appendix
    """.split()
)

# 개념으로 보기 어려운 단독 숫자·단위성 표현
GENERIC_TOKENS: frozenset[str] = frozenset({"20", "30", "50", "100", "000", "억원", "만원", "조원"})

# 용언 어미 — "구축한다", "운영했다" 처럼 서술어는 개념이 아니다.
# 조사와 달리 깎아내지 않고 토큰 자체를 버린다 (어간만 남겨도 명사가 아닐 수 있어서).
VERB_ENDINGS: tuple[str, ...] = (
    "한다고", "했다고", "된다고", "됐다고", "이라고", "라고",
    "한다", "했다", "된다", "됐다", "이다", "있다", "없다", "같다", "본다", "온다", "간다",
    "하는", "되는", "이는", "지는", "시켰", "시킨", "하며", "되며", "했고", "됐고",
    "하고", "되고", "해야", "돼야", "하기", "되기", "해서", "돼서", "하면", "되면",
    "습니다", "합니다", "됩니다", "입니다", "했으며", "됐으며", "도록", "지만", "면서",
)

# 관형사형 접미사 — "선제적", "세계적" 같은 수식어는 단독 개념이 아니다.
# -형/-화/-성 은 "맞춤형"·"자동화"처럼 개념이 되는 경우가 많아 제외하지 않는다.
MODIFIER_SUFFIXES: tuple[str, ...] = ("적",)
