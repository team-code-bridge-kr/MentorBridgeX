"""학과/계열 프리셋 시드 데이터.

키워드는 한국어와 영어를 함께 넣는다 — 한국 뉴스 RSS 와 영어 논문 API 를
같은 키워드 집합으로 매칭해야 하기 때문이다.

키워드 선정 규칙:
- 1글자 키워드 금지. pg_trgm 부분일치라서 "암" 은 "프로그램"·"암호" 에 걸린다.
- 2글자도 최소화. 대신 "종양"·"항암" 처럼 분야가 드러나는 말을 쓴다.
- 영어 약어는 3글자 이상만 (ESG 는 되고 AI 는 "said"·"AIDS" 에 걸려서 뺐다).

각 트랙의 앞 4개는 그 분야의 중심 개념이라 가중치를 높였다.
"""

from __future__ import annotations

CORE_WEIGHT = 1.5
BASE_WEIGHT = 1.0

# (id, name, field, description, [keywords])
TRACKS: list[tuple[str, str, str, str, list[str]]] = [
    (
        "cs",
        "컴퓨터공학 / 소프트웨어",
        "공학",
        "프로그래밍, 시스템, 소프트웨어 개발 전반",
        [
            "알고리즘", "algorithm", "자료구조", "data structure",
            "운영체제", "operating system", "컴파일러", "compiler",
            "분산시스템", "distributed system", "클라우드", "cloud computing",
            "사이버보안", "cybersecurity", "오픈소스", "open source",
            "소프트웨어공학", "software engineering", "데이터베이스", "database",
        ],
    ),
    (
        "ai",
        "인공지능 / 데이터사이언스",
        "공학",
        "머신러닝, 딥러닝, 데이터 분석",
        [
            "인공지능", "artificial intelligence", "머신러닝", "machine learning",
            "딥러닝", "deep learning", "강화학습", "reinforcement learning",
            "트랜스포머", "transformer", "언어모델", "language model",
            "컴퓨터비전", "computer vision", "자연어처리",
            "natural language processing", "생성형", "generative model",
            "추천시스템", "recommender system", "데이터사이언스",
        ],
    ),
    (
        "ee",
        "전기전자 / 반도체",
        "공학",
        "반도체 소자, 회로, 통신",
        [
            "반도체", "semiconductor", "집적회로", "integrated circuit",
            "트랜지스터", "transistor", "파운드리", "foundry",
            "전력전자", "power electronics", "신호처리", "signal processing",
            "이동통신", "wireless communication", "회로설계", "circuit design",
            "광전자", "photonics", "메모리반도체",
        ],
    ),
    (
        "mech",
        "기계 / 로봇",
        "공학",
        "로보틱스, 제어, 기계 설계",
        [
            "로봇", "robotics", "자율주행", "autonomous driving",
            "제어시스템", "control system", "메카트로닉스", "mechatronics",
            "유체역학", "fluid dynamics", "열역학", "thermodynamics",
            "구조해석", "finite element", "적층제조", "additive manufacturing",
            "액추에이터", "actuator", "드론",
        ],
    ),
    (
        "chem",
        "화학 / 화학공학",
        "자연",
        "촉매, 합성, 소재, 공정",
        [
            "촉매", "catalysis", "유기합성", "organic synthesis",
            "고분자", "polymer", "전기화학", "electrochemistry",
            "나노소재", "nanomaterial", "반응공학", "reaction engineering",
            "분광", "spectroscopy", "분리공정", "separation process",
            "그린케미스트리", "green chemistry",
        ],
    ),
    (
        "bio",
        "생명과학 / 생명공학",
        "자연",
        "유전자, 세포, 단백질, 바이오테크",
        [
            "유전자", "gene editing", "크리스퍼", "CRISPR",
            "단백질", "protein structure", "세포", "cell biology",
            "미생물", "microbiome", "면역", "immunology",
            "합성생물학", "synthetic biology", "유전체", "genomics",
            "신경과학", "neuroscience", "바이오의약품",
        ],
    ),
    (
        "med",
        "의예 / 치의예 / 약학",
        "의약",
        "질병, 치료, 신약, 임상",
        [
            "종양", "cancer", "신약개발", "drug discovery",
            "임상시험", "clinical trial", "정밀의료", "precision medicine",
            "백신", "vaccine", "감염병", "infectious disease",
            "의료영상", "medical imaging", "약물전달", "drug delivery",
            "항생제", "antibiotic resistance", "항암",
        ],
    ),
    (
        "nursing",
        "간호 / 보건",
        "의약",
        "간호, 공중보건, 보건정책",
        [
            "간호", "nursing", "공중보건", "public health",
            "감염관리", "infection control", "환자안전", "patient safety",
            "만성질환", "chronic disease", "역학조사", "epidemiology",
            "정신건강", "mental health", "보건정책", "health policy",
            "건강불평등", "health equity", "노인돌봄",
        ],
    ),
    (
        "math",
        "수학 / 통계",
        "자연",
        "순수수학, 응용수학, 통계학",
        [
            "통계", "statistics", "확률", "probability",
            "미분방정식", "differential equation", "최적화", "optimization",
            "위상수학", "topology", "정수론", "number theory",
            "그래프이론", "graph theory", "선형대수", "linear algebra",
            "수치해석", "numerical analysis", "베이즈", "Bayesian",
        ],
    ),
    (
        "physics",
        "물리 / 천문",
        "자연",
        "양자, 입자, 우주, 응집물질",
        [
            "양자", "quantum", "양자컴퓨팅", "quantum computing",
            "입자물리", "particle physics", "우주", "astrophysics",
            "중력파", "gravitational wave", "블랙홀", "black hole",
            "응집물질", "condensed matter", "초전도", "superconductivity",
            "외계행성", "exoplanet", "암흑물질", "dark matter", "광학",
        ],
    ),
    (
        "civil",
        "건축 / 토목",
        "공학",
        "건축 설계, 구조, 도시",
        [
            "건축", "architecture", "구조공학", "structural engineering",
            "도시계획", "urban planning", "스마트시티", "smart city",
            "지반공학", "geotechnical", "교량", "bridge design",
            "내진", "seismic design", "건설재료", "concrete",
            "인프라", "infrastructure",
        ],
    ),
    (
        "env",
        "환경 / 에너지",
        "공학",
        "기후, 재생에너지, 환경 문제",
        [
            "기후변화", "climate change", "탄소중립", "carbon neutrality",
            "신재생에너지", "renewable energy", "이차전지", "battery",
            "태양광", "solar cell", "수소에너지", "hydrogen energy",
            "대기오염", "air pollution", "미세먼지", "탄소포집",
            "carbon capture", "생태계", "ecosystem", "재활용", "recycling",
        ],
    ),
    (
        "biz",
        "경영 / 경제",
        "사회",
        "경영학, 경제학, 금융",
        [
            "경영", "management", "경제", "economics",
            "스타트업", "startup", "금융", "finance",
            "마케팅", "marketing", "공급망", "supply chain",
            "소비자행동", "consumer behavior", "물가", "inflation",
            "노동시장", "labor market", "핀테크", "fintech", "ESG",
        ],
    ),
    (
        "psych",
        "심리 / 교육",
        "사회",
        "심리학, 교육학, 인지·발달",
        [
            "심리학", "psychology", "인지", "cognition",
            "교육", "education", "발달심리", "developmental psychology",
            "학습동기", "motivation", "상담", "counseling",
            "청소년", "adolescent", "정신건강", "mental health",
            "교육격차", "educational inequality", "행동경제학",
            "behavioral economics",
        ],
    ),
    (
        "social",
        "사회 / 정치외교",
        "사회",
        "사회학, 정치학, 국제관계",
        [
            "사회학", "sociology", "정치", "politics",
            "국제관계", "international relations", "외교", "diplomacy",
            "불평등", "inequality", "인구구조", "demography",
            "저출산", "고령화", "aging society", "이민", "migration",
            "복지정책", "welfare policy", "여론", "public opinion",
        ],
    ),
    (
        "humanities",
        "인문 / 어문",
        "인문",
        "문학, 역사, 철학, 언어",
        [
            "문학", "literature", "역사", "history",
            "철학", "philosophy", "언어학", "linguistics",
            "번역", "translation", "문화연구", "cultural studies",
            "윤리", "ethics", "미디어", "media studies",
            "디지털인문학", "digital humanities", "고전",
        ],
    ),
]


# ─────────────────────────────────────────────────────────────────────────────
# 수집 소스
#
# 모두 공식 RSS / 공개 API 만 쓴다. 스크래핑은 하지 않는다.
# enabled=False 인 소스는 시드에 정의만 해두고 수집하지 않는다 — 매체가
# 저작권 고지에서 "AI 학습 및 활용 금지"를 명시한 곳이라, 켤지 말지는
# 운영자가 판단할 문제로 남겨둔다. README 의 "소스 추가" 절 참고.
#
# (id, name, type, url, query, outlet, enabled)
# ─────────────────────────────────────────────────────────────────────────────
SOURCES: list[tuple[str, str, str, str, str | None, str, bool]] = [
    # ── 뉴스 (RSS) ──
    (
        "yna-industry",
        "연합뉴스 산업",
        "rss",
        "https://www.yna.co.kr/rss/industry.xml",
        None,
        "연합뉴스",
        True,
    ),
    (
        "yna-health",
        "연합뉴스 보건",
        "rss",
        "https://www.yna.co.kr/rss/health.xml",
        None,
        "연합뉴스",
        True,
    ),
    (
        "etnews-it",
        "전자신문 IT",
        "rss",
        "https://rss.etnews.com/Section901.xml",
        None,
        "전자신문",
        True,
    ),
    (
        "etnews-science",
        "전자신문 과학",
        "rss",
        "https://rss.etnews.com/Section902.xml",
        None,
        "전자신문",
        True,
    ),
    # 저작권 고지에 "AI 학습 및 활용 금지" 가 명시된 매체 — 기본 비활성
    (
        "hani-science",
        "한겨레 미래&과학",
        "rss",
        "https://www.hani.co.kr/rss/science",
        None,
        "한겨레",
        False,
    ),
    (
        "khan-science",
        "경향신문 과학",
        "rss",
        "https://www.khan.co.kr/rss/rssdata/science_news.xml",
        None,
        "경향신문",
        False,
    ),
    # 연합뉴스 나머지 섹션 — 산업·보건만으로는 사회·인문·예체능 트랙이 빈다.
    # 섹션당 120건이라 커버리지 확대 효과가 가장 크다 (robots: Allow /).
    ("yna-economy", "연합뉴스 경제", "rss", "https://www.yna.co.kr/rss/economy.xml", None, "연합뉴스", True),
    ("yna-society", "연합뉴스 사회", "rss", "https://www.yna.co.kr/rss/society.xml", None, "연합뉴스", True),
    ("yna-culture", "연합뉴스 문화", "rss", "https://www.yna.co.kr/rss/culture.xml", None, "연합뉴스", True),
    ("yna-politics", "연합뉴스 정치", "rss", "https://www.yna.co.kr/rss/politics.xml", None, "연합뉴스", True),
    ("yna-world", "연합뉴스 국제", "rss", "https://www.yna.co.kr/rss/international.xml", None, "연합뉴스", True),
    ("yna-sports", "연합뉴스 스포츠", "rss", "https://www.yna.co.kr/rss/sports.xml", None, "연합뉴스", True),
    (
        "hankyung-economy",
        "한국경제 경제",
        "rss",
        "https://www.hankyung.com/feed/economy",
        None,
        "한국경제",
        True,
    ),
    (
        "donga-it",
        "동아일보 IT·의학",
        "rss",
        "https://rss.donga.com/science.xml",
        None,
        "동아일보",
        True,
    ),
    ("zdnet-kr", "ZDNet Korea", "rss", "https://feeds.feedburner.com/zdkorea", None, "ZDNet Korea", True),
    # 매일경제(mk.co.kr)는 **일부러 넣지 않았다.** robots.txt 가 GPTBot·ClaudeBot·
    # anthropic-ai·CCBot 등 AI 크롤러에 Disallow: / 를 걸어 두었다. 우리 UA 는
    # 거기 없어서 문자열로는 통과하지만, 매체의 뜻이 분명하므로 따른다.
    # (한겨레·경향을 enabled=False 로 둔 것과 같은 판단)

    # ── 뉴스 (네이버 검색 API — NCP API HUB) ──
    # RSS 는 매체가 정해 준 섹션만 오지만 검색은 **주제로** 가져온다. 그래서
    # RSS 로는 안 채워지던 트랙(화학·생명·간호·예체능 등)을 여기서 메운다.
    # 검색어는 트랙 키워드가 실제 기사에 쓰이는 말로 골랐다 — "반응공학" 같은
    # 교과서 용어로 검색하면 기사가 없다.
    # 구분자는 | 다. 네이버 검색은 OR 문법이 없어서 낱말마다 따로 요청한다.
    ("naver-chem", "네이버 화학·소재", "naver", "", "촉매|고분자|신소재|배터리 소재", "네이버 뉴스", True),
    ("naver-bio", "네이버 생명과학", "naver", "", "유전자|단백질|바이오|세포 치료", "네이버 뉴스", True),
    ("naver-med", "네이버 의약", "naver", "", "신약|임상시험|의료기술|감염병", "네이버 뉴스", True),
    ("naver-nursing", "네이버 간호·보건", "naver", "", "간호|공중보건|보건정책|환자 안전", "네이버 뉴스", True),
    ("naver-env", "네이버 환경·에너지", "naver", "", "기후변화|재생에너지|탄소중립|환경오염", "네이버 뉴스", True),
    ("naver-ee", "네이버 전기전자", "naver", "", "반도체|디스플레이|전력망|통신기술", "네이버 뉴스", True),
    ("naver-social", "네이버 사회·정책", "naver", "", "사회정책|불평등|인구구조|복지제도", "네이버 뉴스", True),
    ("naver-edu", "네이버 교육·심리", "naver", "", "교육정책|청소년|심리학|학습법", "네이버 뉴스", True),
    ("naver-art", "네이버 예술·문화", "naver", "", "전시회|공연예술|디자인|문화정책", "네이버 뉴스", True),
    ("naver-civil", "네이버 건축·토목", "naver", "", "건축설계|도시재생|사회기반시설|토목", "네이버 뉴스", True),

    # ── 뉴스 (NewsAPI.org — 선택, 기본 꺼짐) ──
    # 무료 플랜은 하루 100요청 + 기사 24시간 지연 + **운영 환경 사용 금지**다.
    # 유료($449/월)로 전환했거나 개발 환경에서만 쓸 때 enabled 를 켠다.
    # url 칸은 언어 코드로 쓴다 (newsapi 는 URL 이 고정이라 빈 칸을 재활용).
    ("newsapi-ko", "NewsAPI 한국어", "newsapi", "ko", "과학 OR 기술 OR 연구", "NewsAPI", False),
    ("newsapi-en", "NewsAPI 영어", "newsapi", "en", "science OR research OR technology", "NewsAPI", False),

    # ── 논문 (arXiv 공식 API) ──
    ("arxiv-cs-ai", "arXiv 인공지능", "arxiv", "", "cat:cs.AI OR cat:cs.LG", "arXiv", True),
    ("arxiv-cs-cv", "arXiv 컴퓨터비전", "arxiv", "", "cat:cs.CV OR cat:cs.CL", "arXiv", True),
    # 컴퓨터공학 트랙 키워드(알고리즘·운영체제·컴파일러·분산시스템·클라우드·
    # 보안·데이터베이스·소프트웨어공학)를 받아 줄 카테고리가 없어서, 그 트랙을
    # 고른 학생에게 빈 피드가 나가고 있었다. AI·비전만으로는 못 덮는다.
    ("arxiv-cs-ds", "arXiv 알고리즘·자료구조", "arxiv", "", "cat:cs.DS OR cat:cs.CC", "arXiv", True),
    ("arxiv-cs-sys", "arXiv 시스템·분산", "arxiv", "", "cat:cs.DC OR cat:cs.OS", "arXiv", True),
    ("arxiv-cs-se", "arXiv 소프트웨어공학", "arxiv", "", "cat:cs.SE OR cat:cs.PL", "arXiv", True),
    ("arxiv-cs-sec", "arXiv 보안·데이터베이스", "arxiv", "", "cat:cs.CR OR cat:cs.DB", "arXiv", True),
    ("arxiv-eess", "arXiv 전기전자", "arxiv", "", "cat:eess.SP OR cat:eess.SY", "arXiv", True),
    # 화학 트랙이 3건밖에 안 잡혀서 넣었다 (arXiv 에 chem 전용 카테고리는 없다)
    (
        "arxiv-chem",
        "arXiv 화학·소재",
        "arxiv",
        "",
        "cat:physics.chem-ph OR cat:cond-mat.mtrl-sci",
        "arXiv",
        True,
    ),
    (
        "arxiv-physics",
        "arXiv 물리·천문",
        "arxiv",
        "",
        "cat:astro-ph.GA OR cat:quant-ph",
        "arXiv",
        True,
    ),
    ("arxiv-math", "arXiv 수학·통계", "arxiv", "", "cat:math.ST OR cat:stat.ML", "arXiv", True),
    ("arxiv-bio", "arXiv 정량생물학", "arxiv", "", "cat:q-bio.GN OR cat:q-bio.NC", "arXiv", True),
    ("arxiv-econ", "arXiv 경제", "arxiv", "", "cat:econ.GN OR cat:q-fin.GN", "arXiv", True),
    # ── 논문 (Crossref 공식 API) — arXiv 가 안 다루는 분야를 메운다 ──
    (
        "crossref-med",
        "Crossref 의약",
        "crossref",
        "",
        "precision medicine clinical trial",
        "Crossref",
        True,
    ),
    (
        "crossref-nursing",
        "Crossref 간호·보건",
        "crossref",
        "",
        "public health nursing patient safety",
        "Crossref",
        True,
    ),
    (
        "crossref-env",
        "Crossref 환경·에너지",
        "crossref",
        "",
        "climate change renewable energy",
        "Crossref",
        True,
    ),
    (
        "crossref-edu",
        "Crossref 교육·심리",
        "crossref",
        "",
        "education psychology adolescent learning",
        "Crossref",
        True,
    ),
    (
        "crossref-social",
        "Crossref 사회·정치",
        "crossref",
        "",
        "social policy inequality demography",
        "Crossref",
        True,
    ),
    (
        "crossref-humanities",
        "Crossref 인문",
        "crossref",
        "",
        "digital humanities literature philosophy",
        "Crossref",
        True,
    ),
]


def track_keyword_rows() -> list[tuple[str, str, float]]:
    """(track_id, keyword, weight) 목록으로 펼친다."""
    rows: list[tuple[str, str, float]] = []
    for track_id, _name, _field, _desc, keywords in TRACKS:
        for idx, keyword in enumerate(keywords):
            weight = CORE_WEIGHT if idx < 4 else BASE_WEIGHT
            rows.append((track_id, keyword, weight))
    return rows
