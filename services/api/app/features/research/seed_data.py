"""학과/계열 프리셋 시드 데이터.

키워드는 한국어와 영어를 함께 넣는다 — 한국 뉴스 RSS 와 영어 논문 API 를
같은 키워드 집합으로 매칭해야 하기 때문이다.

키워드 선정 규칙:
- 1글자 키워드 금지. pg_trgm 부분일치라서 "암" 은 "프로그램"·"암호" 에 걸린다.
- 2글자도 최소화. 대신 "종양"·"항암" 처럼 분야가 드러나는 말을 쓴다.
- 영어 약어는 3글자 이상만 (ESG 는 되고 AI 는 "said"·"AIDS" 에 걸려서 뺐다).

각 트랙의 앞 4개는 그 분야의 중심 개념이라 가중치를 높였다.

2글자를 쓴 자리는 그 말 자체가 분야를 드러내는 경우뿐이다(국악·성악·발레·
안무·경혈·생약·적조·빙하). 반대로 뺀 것들: "지휘"는 군사 기사에, "믹싱"은
요리 기사("믹싱볼")에 더 자주 걸려서 각각 빼고 "음원믹싱"으로 바꿨다.
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
        "심리 / 인지",
        "사회",
        "심리학, 인지·발달, 행동",
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
        "국어국문 / 문예창작",
        "인문",
        "한국 문학과 글쓰기",
        [
            "국문학", "korean literature", "문예창작", "creative writing",
            "현대문학", "modern literature", "고전문학", "classical literature",
            "문학비평", "literary criticism", "국어학", "korean linguistics",
            "시문학", "poetry", "서사구조", "narrative",
            "출판문화", "번역문학",
        ],
    ),
    (
        "edu",
        "교육학 / 교육공학",
        "교육",
        "교수학습, 교육평가, 교육정책",
        [
            "교육과정", "curriculum", "교수법", "pedagogy",
            "학습동기", "learning motivation", "교육평가", "assessment",
            "문해력", "literacy", "특수교육", "special education",
            "진로교육", "career education", "교육정책", "education policy",
            "에듀테크", "교실수업",
        ],
    ),
    (
        "arts",
        "미술 / 디자인",
        "예체능",
        "회화, 조형, 시각·산업 디자인",
        [
            "시각디자인", "visual design", "현대미술", "contemporary art",
            "산업디자인", "industrial design", "조형예술", "fine art",
            "전시기획", "exhibition", "미술사", "art history",
            "일러스트", "illustration", "공간디자인", "space design",
            "미디어아트", "media art",
        ],
    ),
    # ── 공학 ──
    (
        "industrial",
        "산업공학 / 물류",
        "공학",
        "생산·물류·품질을 최적화하는 공학",
        [
            "산업공학", "industrial engineering", "공급망", "supply chain",
            "생산관리", "production planning", "물류시스템", "logistics",
            "품질경영", "quality management", "재고관리", "inventory control",
            "스마트팩토리", "smart factory", "수요예측", "demand forecasting",
            "공정개선", "operations research",
        ],
    ),
    (
        "aerospace",
        "항공우주 / 기계항공",
        "공학",
        "항공기·위성·발사체와 추진 기술",
        [
            "항공우주", "aerospace", "발사체", "launch vehicle",
            "인공위성", "satellite", "추진기관", "propulsion",
            "공기역학", "aerodynamics", "우주탐사", "space exploration",
            "무인기", "unmanned aerial", "궤도역학", "orbital mechanics",
            "항공소재", "우주개발",
        ],
    ),
    (
        "materials",
        "신소재 / 재료공학",
        "공학",
        "금속·세라믹·고분자와 나노 소재",
        [
            "신소재", "advanced materials", "나노소재", "nanomaterials",
            "복합재료", "composite material", "금속재료", "metallurgy",
            "고분자", "polymer", "세라믹", "ceramics",
            "박막공정", "thin film", "결정구조", "crystal structure",
            "표면처리", "소재분석",
        ],
    ),
    (
        "urban",
        "도시 / 교통공학",
        "공학",
        "도시계획, 교통망, 스마트시티",
        [
            "도시계획", "urban planning", "교통공학", "transportation",
            "스마트시티", "smart city", "대중교통", "public transit",
            "도시재생", "urban regeneration", "교통수요", "traffic flow",
            "지리정보", "geographic information", "보행환경", "walkability",
            "국토개발", "도시설계",
        ],
    ),
    # ── 자연 ──
    (
        "earth",
        "지구과학 / 대기",
        "자연",
        "기상, 지질, 기후 변화",
        [
            "대기과학", "atmospheric science", "기후변화", "climate change",
            "지질학", "geology", "기상예보", "weather forecasting",
            "지진연구", "seismology", "탄소순환", "carbon cycle",
            "원격탐사", "remote sensing", "빙하", "glacier",
            "미세먼지", "화산활동",
        ],
    ),
    (
        "agri",
        "농업생명 / 원예",
        "자연",
        "작물, 토양, 스마트팜",
        [
            "농업생명", "agricultural science", "작물육종", "crop breeding",
            "스마트팜", "smart farming", "토양학", "soil science",
            "원예학", "horticulture", "식물병리", "plant pathology",
            "축산과학", "animal science", "종자산업", "seed industry",
            "친환경농업", "수직농장",
        ],
    ),
    (
        "marine",
        "해양 / 수산",
        "자연",
        "해양 생태와 수산 자원",
        [
            "해양학", "oceanography", "수산자원", "fisheries",
            "해양생태", "marine ecology", "양식산업", "aquaculture",
            "해양오염", "marine pollution", "연안관리", "coastal management",
            "해양생물", "marine biology", "해수온", "sea temperature",
            "수산업", "심해탐사",
        ],
    ),
    # ── 의약 ──
    (
        "vet",
        "수의학",
        "의약",
        "동물 질병과 인수공통감염",
        [
            "수의학", "veterinary", "동물질병", "animal disease",
            "인수공통", "zoonosis", "반려동물", "companion animal",
            "가축방역", "livestock disease", "동물복지", "animal welfare",
            "야생동물", "wildlife", "예방접종", "vaccination",
            "동물병원", "축산위생",
        ],
    ),
    (
        "kmed",
        "한의학",
        "의약",
        "한약, 침구, 전통의학 연구",
        [
            "한의학", "traditional korean medicine", "한약재", "herbal medicine",
            "침구치료", "acupuncture", "경혈자극", "meridian point",
            "본초학", "materia medica", "체질의학", "constitutional medicine",
            "통합의학", "integrative medicine", "생약", "phytotherapy",
            "한방치료", "약침",
        ],
    ),
    (
        "rehab",
        "물리치료 / 재활",
        "의약",
        "재활치료와 근골격 회복",
        [
            "물리치료", "physical therapy", "재활의학", "rehabilitation",
            "작업치료", "occupational therapy", "근골격", "musculoskeletal",
            "보행분석", "gait analysis", "운동치료", "exercise therapy",
            "보조기기", "assistive device", "통증관리", "pain management",
            "척추재활", "노인재활",
        ],
    ),
    (
        "food",
        "식품영양 / 위생",
        "의약",
        "영양, 식품 안전, 발효 기술",
        [
            "식품영양", "food science", "영양학", "nutrition",
            "식품안전", "food safety", "발효식품", "fermentation",
            "식품공학", "food engineering", "기능성식품", "functional food",
            "식중독", "foodborne illness", "대사증후군", "metabolic syndrome",
            "식단관리", "위생관리",
        ],
    ),
    # ── 사회 ──
    (
        "law",
        "법학",
        "사회",
        "헌법·형법·민법과 판례 연구",
        [
            "법률", "jurisprudence", "헌법재판", "constitutional law",
            "형사법", "criminal law", "민사소송", "civil litigation",
            "판례연구", "case law", "입법과정", "legislation",
            "지식재산", "intellectual property", "국제법", "international law",
            "인권보호", "노동법",
        ],
    ),
    (
        "pubadmin",
        "행정 / 정책",
        "사회",
        "공공정책, 지방자치, 규제",
        [
            "공공정책", "public policy", "행정학", "public administration",
            "지방자치", "local government", "정책평가", "policy evaluation",
            "규제개혁", "regulatory reform", "예산제도", "public budgeting",
            "거버넌스", "governance", "공공서비스", "public service",
            "전자정부", "정책결정",
        ],
    ),
    (
        "media",
        "미디어 / 커뮤니케이션",
        "사회",
        "저널리즘, 광고홍보, 미디어 산업",
        [
            "저널리즘", "journalism", "미디어산업", "media industry",
            "광고홍보", "advertising", "커뮤니케이션", "communication studies",
            "방송제작", "broadcasting", "소셜미디어", "social media",
            "허위정보", "misinformation", "여론조사", "public opinion",
            "콘텐츠산업", "미디어리터러시",
        ],
    ),
    (
        "tourism",
        "관광 / 호텔경영",
        "사회",
        "관광 산업과 호스피탈리티",
        [
            "관광산업", "tourism industry", "호텔경영", "hospitality",
            "관광정책", "tourism policy", "여행수요", "travel demand",
            "문화관광", "cultural tourism", "지역축제", "destination management",
            "마이스산업", "convention industry", "숙박업", "accommodation",
            "항공여객", "관광자원",
        ],
    ),
    (
        "trade",
        "무역 / 국제통상",
        "사회",
        "수출입, 통상 정책, 국제 시장",
        [
            "국제통상", "international trade", "수출입", "export import",
            "관세정책", "tariff policy", "무역협정", "trade agreement",
            "환율변동", "exchange rate", "공급망재편", "global supply chain",
            "통상마찰", "trade dispute", "해외시장", "overseas market",
            "무역금융", "물류비용",
        ],
    ),
    # ── 인문 ──
    (
        "englit",
        "영어영문 / 번역",
        "인문",
        "영미 문학과 번역·언어학",
        [
            "영문학", "english literature", "번역학", "translation studies",
            "영미문학", "american literature", "언어학", "linguistics",
            "비교문학", "comparative literature", "통번역", "interpretation",
            "담화분석", "discourse analysis", "영어교육학", "english language",
            "셰익스피어", "문체론",
        ],
    ),
    (
        "history",
        "사학 / 고고학",
        "인문",
        "역사 연구와 유적 조사",
        [
            "역사학", "historiography", "고고학", "archaeology",
            "한국사", "korean history", "근현대사", "modern history",
            "세계사", "world history", "문화유산", "cultural heritage",
            "사료연구", "historical record", "발굴조사", "excavation",
            "고문서", "박물관",
        ],
    ),
    (
        "philo",
        "철학 / 종교학",
        "인문",
        "사상, 윤리, 종교 연구",
        [
            "철학과", "philosophy", "윤리학", "ethics",
            "종교학", "religious studies", "인식론", "epistemology",
            "형이상학", "metaphysics", "정치철학", "political philosophy",
            "동양철학", "eastern philosophy", "논리학", "logic",
            "생명윤리", "bioethics", "기술윤리", "인문학",
        ],
    ),
    (
        "culture",
        "문화인류 / 지리",
        "인문",
        "문화, 지역, 공간에 대한 연구",
        [
            "문화인류학", "anthropology", "인문지리", "human geography",
            "민속학", "folklore", "지역연구", "area studies",
            "이주연구", "migration studies", "다문화", "multiculturalism",
            "도시문화", "urban culture", "구술사", "oral history",
            "문화정책", "공간분석",
        ],
    ),
    # ── 교육 ──
    (
        "elemedu",
        "초등교육",
        "교육",
        "초등학교 교실과 아동 학습",
        [
            "초등교육", "elementary education", "아동발달", "child development",
            "교실수업", "classroom teaching", "기초학력", "basic literacy",
            "학습부진", "learning difficulty", "생활지도", "student guidance",
            "놀이중심", "play based learning", "학급운영", "classroom management",
            "또래관계", "학습습관",
        ],
    ),
    (
        "earlyedu",
        "유아교육",
        "교육",
        "영유아 발달과 보육",
        [
            "유아교육", "early childhood education", "보육과정", "childcare",
            "영유아발달", "infant development", "놀이활동", "play activity",
            "부모교육", "parenting education", "정서발달", "emotional development",
            "언어발달", "language development", "누리과정", "애착형성",
            "유아놀이", "보육교사",
        ],
    ),
    (
        "specedu",
        "특수교육",
        "교육",
        "장애 학생의 학습과 통합교육",
        [
            "특수교육", "special education", "통합교육", "inclusive education",
            "발달장애", "developmental disability", "행동중재", "behavior intervention",
            "개별화교육", "individualized education", "보조공학", "assistive technology",
            "자폐스펙트럼", "autism spectrum", "학습장애", "learning disability",
            "의사소통지원", "장애인식",
        ],
    ),
    (
        "subjedu",
        "교과교육",
        "교육",
        "국어·수학·과학 등 과목별 교수법",
        [
            "교과교육", "subject teaching", "수학교육", "mathematics education",
            "과학교육", "science education", "국어교육", "language arts",
            "탐구학습", "inquiry learning", "수업설계", "instructional design",
            "평가도구", "assessment tool", "디지털교과서", "digital textbook",
            "교사연수", "학습자중심",
        ],
    ),
    # ── 예체능 ──
    (
        "music",
        "음악 / 작곡",
        "예체능",
        "연주, 작곡, 음악학",
        [
            "음악학", "musicology", "작곡기법", "composition",
            "관현악", "orchestra", "화성학", "music theory",
            "국악", "korean traditional music", "성악", "vocal music",
            "음향기술", "audio engineering", "음악교육", "music education",
            "실내악", "연주회",
        ],
    ),
    (
        "pe",
        "체육 / 스포츠과학",
        "예체능",
        "운동 수행과 스포츠 산업",
        [
            "스포츠과학", "sports science", "운동생리", "exercise physiology",
            "체육교육", "physical education", "생활체육", "community sports",
            "스포츠재활", "sports rehabilitation", "경기력분석", "performance analysis",
            "스포츠산업", "sports industry", "운동처방", "exercise prescription",
            "체력측정", "선수육성",
        ],
    ),
    (
        "dance",
        "무용",
        "예체능",
        "한국무용, 발레, 현대무용",
        [
            "무용예술", "dance art", "현대무용", "contemporary dance",
            "발레", "ballet", "한국무용", "korean dance",
            "안무", "choreography", "무용교육", "dance education",
            "신체표현", "movement studies", "무용치료", "dance therapy",
            "공연무대", "전통춤",
        ],
    ),
    (
        "film",
        "연극영화 / 영상",
        "예체능",
        "연출, 촬영, 영상 콘텐츠",
        [
            "영화연출", "film directing", "연극예술", "theatre arts",
            "영상제작", "video production", "시나리오", "screenplay",
            "촬영기법", "cinematography", "편집기술", "film editing",
            "다큐멘터리", "documentary", "무대연출", "stage design",
            "영상콘텐츠", "미장센",
        ],
    ),
    (
        "appmusic",
        "실용음악 / 대중음악",
        "예체능",
        "대중음악 연주·프로듀싱",
        [
            "실용음악", "popular music", "대중음악", "music industry",
            "음악프로듀싱", "music production", "보컬트레이닝", "vocal training",
            "작사작곡", "songwriting", "음원믹싱", "audio mixing",
            "케이팝", "kpop", "공연기획", "concert production",
            "스트리밍음원", "밴드연주",
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


def _is_ascii(word: str) -> bool:
    return all(ord(c) < 128 for c in word)


def keyword_pairs(keywords: list[str]) -> list[list[str]]:
    """한국어 낱말과 바로 뒤의 영어 낱말을 한 묶음으로 본다.

    시드는 "촉매", "catalysis" 처럼 같은 개념의 한국어·영어를 나란히 적는다(파일
    맨 위 규칙). 화면에서는 이 둘이 따로 뜨면 같은 걸 두 번 고르게 되므로 묶어서
    내려준다. **순서가 곧 짝**이라 DB 로 내려갔다 오면(정렬이 바뀐다) 알 수 없다.
    그래서 여기, 시드 상수에서 만든다.
    """
    groups: list[list[str]] = []
    i = 0
    while i < len(keywords):
        word = keywords[i]
        nxt = keywords[i + 1] if i + 1 < len(keywords) else None
        if nxt and not _is_ascii(word) and _is_ascii(nxt):
            groups.append([word, nxt])
            i += 2
        else:
            groups.append([word])
            i += 1
    return groups


def _english_to_korean() -> dict[str, str]:
    idx: dict[str, str] = {}
    for _id, _name, _field, _desc, keywords in TRACKS:
        for group in keyword_pairs(keywords):
            if len(group) == 2:
                idx[group[1].lower()] = group[0]
    return idx


ENGLISH_TO_KOREAN = _english_to_korean()


def display_keywords(words: list[str]) -> list[str]:
    """보여주기용으로 한국어·영어 짝을 하나로 줄인다.

    저장된 키워드는 줄이지 않는다 — 매칭에는 둘 다 필요하다. 화면에
    "algorithm"과 "알고리즘"이 나란히 뜨면 두 개를 등록한 것처럼 보일 뿐이다.
    """
    out: list[str] = []
    for word in words:
        head = ENGLISH_TO_KOREAN.get(word.lower(), word)
        if head not in out:
            out.append(head)
    return out


def track_keyword_rows() -> list[tuple[str, str, float]]:
    """(track_id, keyword, weight) 목록으로 펼친다."""
    rows: list[tuple[str, str, float]] = []
    for track_id, _name, _field, _desc, keywords in TRACKS:
        for idx, keyword in enumerate(keywords):
            weight = CORE_WEIGHT if idx < 4 else BASE_WEIGHT
            rows.append((track_id, keyword, weight))
    return rows
