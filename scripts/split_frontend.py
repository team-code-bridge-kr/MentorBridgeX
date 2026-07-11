#!/usr/bin/env python3
"""
split_frontend.py — 초안_코드.jsx (5148줄) → apps/web/src/ 모듈 분리 v2
=========================================================================
실행:  python3 scripts/split_frontend.py
결과:  apps/web/src/ 아래 파일들이 생성됩니다.

핵심 전략:
  - 각 섹션의 시작 줄 번호를 사전에 파악하고
  - '다음 섹션 시작 줄 - 1'을 끝 줄로 사용 (brace counting 불필요)
  - 경계 마커를 더해 CSS 같은 특수 섹션도 올바르게 범위 지정
"""
import re, os
from pathlib import Path

ROOT   = Path(__file__).parent.parent
SOURCE = ROOT / "초안_코드.jsx"
OUTDIR = ROOT / "apps/web/src"

raw   = SOURCE.read_text(encoding="utf-8")
lines = raw.splitlines(keepends=True)

def get_lines(start_1, end_1=None):
    """1-indexed inclusive slice → str"""
    return "".join(lines[start_1 - 1 : (end_1 or len(lines))])

# ──────────────────────────────────────────────────────────────
# 알려진 시작 줄 번호 맵
# 키 이름은 섹션/함수 식별자 (CSS 같은 경계 마커 포함)
# ──────────────────────────────────────────────────────────────
KNOWN_STARTS = {
    "reducer":          192,
    "useStore":         230,
    "StoreProvider":    236,
    "Toast":            332,
    "TDS":              350,
    "CSS":              399,   # 경계 마커 (template literal — 직접 추출)
    "TFI":              804,
    "Btn_etc":          829,   # Btn, Badge, Av, Card, StatCard, Notice, Divider
    "NAV_ICON_PATHS":   858,
    "NavIcon":          885,
    "S_NAV":            897,
    "T_NAV":            908,
    "A_NAV":            917,
    "Sidebar":          932,
    "TITLES":           984,
    "GlobalHeader":     1004,
    "S01":              1024,
    "S03":              1159,
    "S04":              1184,
    "DonutChart":       1222,
    "S05":              1260,
    "S06":              1510,
    "S11":              1719,
    "S12":              1764,
    "S15":              1806,
    "S16":              1838,
    "S20":              1867,
    "timeAgo":          1901,
    "S24":              1911,
    "S25":              1985,
    "S27":              2036,
    "S28":              2071,
    "S30":              2115,
    "S07":              2276,
    "S08":              2333,
    "S09":              2374,
    "S10":              2414,
    "S13":              2449,
    "S14":              2479,
    "S17":              2522,
    "S18":              2558,
    "S19":              2596,
    "S21":              2641,
    "S22":              2674,
    "S23":              2720,
    "S26":              2760,
    "S29":              2790,
    "S31":              2836,
    "S32":              2877,
    "T01":              2940,
    "T03":              2980,
    "T06":              3039,
    "T07":              3072,
    "T10":              3126,
    "T02":              3186,
    "T04":              3252,
    "T05":              3298,
    "T09":              3334,
    "A00":              3371,
    "A01":              3405,
    "A02":              3498,
    "A13":              3566,
    "A21":              3611,
    "A03":              3656,
    "A04":              3712,
    "A05":              3766,
    "A06":              3854,
    "A07":              3899,
    "A08":              3939,
    "A09":              3994,
    "A10":              4031,
    "A11":              4064,
    "A12":              4098,
    "A14":              4144,
    "A15":              4194,
    "A16":              4228,
    "A17":              4265,
    "A18":              4298,
    "A19":              4346,
    "A20":              4382,
    "A22":              4418,
    "A23":              4450,
    "A24":              4490,
    "A25":              4553,
    "A26":              4601,
    "A27":              4636,
    "A28":              4673,
    "A29":              4718,
    "A30":              4752,
    "A31":              4787,
    "A32":              4814,
    "Placeholder":      4894,
    "renderScreen":     4910,
    "ALL_SCREENS":      4972,
    "ScreenPicker":     5006,
    "PUBLIC_SCREENS":   5047,
    "requiredRole":     5049,
    "App":              5056,
    "AppShell":         5065,
    "_EOF_":            5150,  # sentinel (file ends at 5149)
}

_sorted_starts = sorted(KNOWN_STARTS.values())

def section_end(name):
    """다음 알려진 섹션 시작 줄 - 1 (1-indexed, inclusive)"""
    start = KNOWN_STARTS[name]
    idx   = _sorted_starts.index(start)
    if idx + 1 < len(_sorted_starts):
        return _sorted_starts[idx + 1] - 1
    return len(lines)

def extract_section(name):
    """섹션 텍스트를 꺼내되 앞뒤 빈 줄 정리"""
    start = KNOWN_STARTS[name]
    end   = section_end(name)
    return get_lines(start, end).rstrip() + "\n"

# ──────────────────────────────────────────────────────────────
# CSS 템플릿 리터럴 (백틱 → 실제 CSS 텍스트만 뽑기)
# @import 규칙을 최상단으로 이동 (CSS 표준: @import 는 다른 규칙보다 앞)
# ──────────────────────────────────────────────────────────────
css_match = re.search(r'^const CSS = `', raw, re.MULTILINE)
assert css_match
css_body_start = css_match.end()
css_body_end   = raw.index('`;', css_body_start)
_css_raw       = raw[css_body_start:css_body_end].lstrip('\n')

# @import 줄을 분리해 최상단으로
_import_lines  = [l for l in _css_raw.splitlines(keepends=True) if l.strip().startswith("@import")]
_other_lines   = [l for l in _css_raw.splitlines(keepends=True) if not l.strip().startswith("@import")]
CSS_CONTENT    = "".join(_import_lines) + "\n" + "".join(_other_lines)

# ──────────────────────────────────────────────────────────────
# 파일 쓰기 헬퍼
# ──────────────────────────────────────────────────────────────
def write_file(rel_path, content):
    full = OUTDIR / rel_path
    full.parent.mkdir(parents=True, exist_ok=True)
    full.write_text(content, encoding="utf-8")
    print(f"  ✅  src/{rel_path}  ({len(content.splitlines())}줄)")

# ══════════════════════════════════════════════════════════════
# 파일 생성
# ══════════════════════════════════════════════════════════════

# 1. theme/styles.css
write_file("theme/styles.css", CSS_CONTENT)

# ──────────────────────────────────────────────────────────────
# 2. theme/tokens.js
# ──────────────────────────────────────────────────────────────
tds_raw = extract_section("TDS")
write_file("theme/tokens.js",
    tds_raw.replace("const TDS =", "export const TDS =", 1)
    + "\nexport default TDS;\n"
)

# ──────────────────────────────────────────────────────────────
# 3. utils/time.js
# ──────────────────────────────────────────────────────────────
time_raw = extract_section("timeAgo")
write_file("utils/time.js",
    "export const _uid = (p = 'id') => "
    "`${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2,6)}`;\n\n"
    + time_raw.replace("function timeAgo", "export function timeAgo", 1)
    + "\n"
)

# ──────────────────────────────────────────────────────────────
# 4. store/initialState.js
# ──────────────────────────────────────────────────────────────
init_raw = get_lines(176, KNOWN_STARTS["reducer"] - 1).rstrip()
write_file("store/initialState.js",
    init_raw.replace("const initialState =", "export const initialState =", 1) + "\n"
)

# ──────────────────────────────────────────────────────────────
# 5. store/reducer.js
# ──────────────────────────────────────────────────────────────
reducer_raw = extract_section("reducer")
write_file("store/reducer.js",
    'import { initialState } from "./initialState.js";\n\n'
    + reducer_raw.replace("function reducer", "export function reducer", 1)
    + "\n"
)

# ──────────────────────────────────────────────────────────────
# 6. store/StoreProvider.jsx
#    useStore (230-235) + StoreProvider (236-331)
# ──────────────────────────────────────────────────────────────
use_store_raw  = extract_section("useStore")
store_prov_raw = extract_section("StoreProvider")

write_file("store/StoreProvider.jsx",
    'import { useState, useEffect, useCallback, useReducer,\n'
    '         useContext, createContext, useMemo, useRef } from "react";\n'
    'import { initialState } from "./initialState.js";\n'
    'import { reducer } from "./reducer.js";\n'
    'import { _uid } from "../utils/time.js";\n'
    'import api from "../api/index.js";\n\n'
    'const StoreCtx = createContext(null);\n\n'
    + use_store_raw.replace("const useStore =", "export const useStore =", 1)
    + "\n"
    + store_prov_raw.replace("function StoreProvider", "export function StoreProvider", 1)
    + "\n"
)

# ──────────────────────────────────────────────────────────────
# 7. components/ui.jsx
#    TFI + Btn/Badge/Av/Card/StatCard/Notice/Divider + DonutChart
# ──────────────────────────────────────────────────────────────
tfi_raw      = extract_section("TFI")
btn_etc_raw  = extract_section("Btn_etc")
donut_raw    = extract_section("DonutChart")

btn_out = btn_etc_raw
for nm in ["Btn","Badge","Av","Card","StatCard","Notice","Divider"]:
    btn_out = btn_out.replace(f"const {nm} =", f"export const {nm} =", 1)

write_file("components/ui.jsx",
    'import TDS from "../theme/tokens.js";\n\n'
    + tfi_raw.replace("const TFI =", "export const TFI =", 1)
    + "\n"
    + btn_out
    + "\n"
    + donut_raw.replace("function DonutChart", "export function DonutChart", 1)
    + "\n"
)

# ──────────────────────────────────────────────────────────────
# 8. components/NavIcon.jsx
# ──────────────────────────────────────────────────────────────
nav_icon_paths_raw = extract_section("NAV_ICON_PATHS")
nav_icon_raw       = extract_section("NavIcon")

write_file("components/NavIcon.jsx",
    nav_icon_paths_raw.replace("const NAV_ICON_PATHS =", "export const NAV_ICON_PATHS =", 1)
    + "\n"
    + nav_icon_raw.replace("function NavIcon", "export function NavIcon", 1)
    + "\n"
)

# ──────────────────────────────────────────────────────────────
# 9. components/Toast.jsx
# ──────────────────────────────────────────────────────────────
toast_raw = extract_section("Toast")

write_file("components/Toast.jsx",
    'import { useStore } from "../store/StoreProvider.jsx";\n'
    'import TDS from "../theme/tokens.js";\n'
    'import { TFI } from "./ui.jsx";\n\n'
    + toast_raw.replace("function Toast", "export function Toast", 1)
    + "\n"
)

# ──────────────────────────────────────────────────────────────
# 10. components/layout/Sidebar.jsx
# ──────────────────────────────────────────────────────────────
sidebar_raw = extract_section("Sidebar")

write_file("components/layout/Sidebar.jsx",
    'import { useStore } from "../../store/StoreProvider.jsx";\n'
    'import TDS from "../../theme/tokens.js";\n'
    'import { TFI, Av } from "../ui.jsx";\n'
    'import { NavIcon } from "../NavIcon.jsx";\n\n'
    + sidebar_raw.replace("function Sidebar", "export function Sidebar", 1)
    + "\n"
)

# ──────────────────────────────────────────────────────────────
# 11. components/layout/GlobalHeader.jsx
# ──────────────────────────────────────────────────────────────
global_hdr_raw = extract_section("GlobalHeader")
# TITLES const is bundled right before GlobalHeader — slice it out
titles_raw     = extract_section("TITLES")

write_file("components/layout/GlobalHeader.jsx",
    'import TDS from "../../theme/tokens.js";\n'
    'import { TFI, Av } from "../ui.jsx";\n\n'
    + titles_raw.replace("const TITLES =", "export const TITLES =", 1)
    + "\n"
    + global_hdr_raw.replace("function GlobalHeader", "export function GlobalHeader", 1)
    + "\n"
)

# ──────────────────────────────────────────────────────────────
# 12. components/Placeholder.jsx
# ──────────────────────────────────────────────────────────────
placeholder_raw = extract_section("Placeholder")

write_file("components/Placeholder.jsx",
    'import TDS from "../theme/tokens.js";\n'
    'import { TFI } from "./ui.jsx";\n\n'
    + placeholder_raw.replace("function Placeholder", "export function Placeholder", 1)
    + "\n"
)

# ──────────────────────────────────────────────────────────────
# 13. nav/menus.js
# ──────────────────────────────────────────────────────────────
s_nav_raw  = extract_section("S_NAV")
t_nav_raw  = extract_section("T_NAV")
a_nav_raw  = extract_section("A_NAV")
shared_raw = extract_section("PUBLIC_SCREENS")   # PUBLIC_SCREENS + requiredRole는 App.jsx에서 처리
# SHARED_SCREENS, getLayout, NO_HDR 는 App.jsx 근처에 있음 — ALL_SCREENS 이전

# SHARED_SCREENS는 ALL_SCREENS 바로 앞에 정의됨. renderScreen 다음에 정의됨.
# renderScreen: 4910, ALL_SCREENS: 4972, ScreenPicker: 5006
# getLayout / NO_HDR 는 SHARED_SCREENS 이후이지만 ScreenPicker 앞에 있음.
shared_screens_raw = get_lines(KNOWN_STARTS["ALL_SCREENS"] - 16, KNOWN_STARTS["ALL_SCREENS"] - 1).rstrip()

write_file("nav/menus.js",
    "// 내비게이션 메뉴 설정 & 레이아웃·권한 헬퍼\n\n"
    + s_nav_raw.replace("const S_NAV =", "export const S_NAV =", 1)
    + "\n"
    + t_nav_raw.replace("const T_NAV =", "export const T_NAV =", 1)
    + "\n"
    + a_nav_raw.replace("const A_NAV =", "export const A_NAV =", 1)
    + "\n"
    + shared_screens_raw
        .replace("const SHARED_SCREENS =", "export const SHARED_SCREENS =", 1)
        .replace("function getLayout", "export function getLayout", 1)
        .replace("const NO_HDR=", "export const NO_HDR=", 1)
    + "\n\n"
    + titles_raw.replace("const TITLES =", "export const TITLES =", 1)
    + "\n"
)

# ──────────────────────────────────────────────────────────────
# 14. components/ScreenPicker.jsx
# ──────────────────────────────────────────────────────────────
all_screens_raw    = extract_section("ALL_SCREENS")
screen_picker_raw  = extract_section("ScreenPicker")

write_file("components/ScreenPicker.jsx",
    'import { useState } from "react";\n'
    'import TDS from "../theme/tokens.js";\n'
    'import { TFI } from "./ui.jsx";\n'
    'import { NavIcon, NAV_ICON_PATHS } from "./NavIcon.jsx";\n'
    'import { S_NAV, T_NAV, A_NAV } from "../nav/menus.js";\n\n'
    + all_screens_raw
    + "\n"
    + screen_picker_raw.replace("function ScreenPicker", "export function ScreenPicker", 1)
    + "\n"
)

# ──────────────────────────────────────────────────────────────
# 15. screens/index.jsx  — renderScreen map
# ──────────────────────────────────────────────────────────────
render_screen_raw = extract_section("renderScreen")

student_screens = ["S01","S03","S04","S05","S06","S07","S08","S09","S10","S11",
                   "S12","S13","S14","S15","S16","S17","S18","S19","S20","S21",
                   "S22","S23","S24","S25","S26","S27","S28","S29","S30","S31","S32"]
teacher_screens = ["T01","T02","T03","T04","T05","T06","T07","T09","T10"]
admin_screens   = ["A00","A01","A02","A03","A04","A05","A06","A07","A08","A09",
                   "A10","A11","A12","A13","A14","A15","A16","A17","A18","A19",
                   "A20","A21","A22","A23","A24","A25","A26","A27","A28","A29",
                   "A30","A31","A32"]

imports_lines = []
for s in student_screens:
    imports_lines.append(f'import {{ {s} }} from "./student/{s}.jsx";')
for t in teacher_screens:
    imports_lines.append(f'import {{ {t} }} from "./teacher/{t}.jsx";')
for a in admin_screens:
    imports_lines.append(f'import {{ {a} }} from "./admin/{a}.jsx";')
imports_lines.append('import { Placeholder } from "../components/Placeholder.jsx";')

write_file("screens/index.jsx",
    "\n".join(imports_lines) + "\n\n"
    + render_screen_raw.replace("function renderScreen", "export function renderScreen", 1)
    + "\n"
)

# ──────────────────────────────────────────────────────────────
# 16. 개별 화면 파일
# ──────────────────────────────────────────────────────────────
SCREEN_HDR = (
    'import {{ useState, useEffect, useCallback, useRef }} from "react";\n'
    'import {{ useStore }} from "../../store/StoreProvider.jsx";\n'
    'import TDS from "../../theme/tokens.js";\n'
    'import {{ TFI, Btn, Badge, Av, Card, StatCard, Notice, Divider }} from "../../components/ui.jsx";\n'
    'import {{ NavIcon }} from "../../components/NavIcon.jsx";\n'
)

def write_screen(name, subdir):
    if name not in KNOWN_STARTS:
        write_file(
            f"screens/{subdir}/{name}.jsx",
            'import { Placeholder } from "../../components/Placeholder.jsx";\n\n'
            f'export function {name}({{ onNav }}) {{\n'
            f'  return <Placeholder title="{name}" screen="{name}" />;\n}}\n'
        )
        return
    block = extract_section(name)
    extra = ""
    if "DonutChart" in block:
        extra += 'import { DonutChart } from "../../components/ui.jsx";\n'
    if "timeAgo" in block:
        extra += 'import { timeAgo } from "../../utils/time.js";\n'
    hdr = SCREEN_HDR.format() + extra + "\n"
    out = hdr + block.replace(f"function {name}", f"export function {name}", 1) + "\n"
    write_file(f"screens/{subdir}/{name}.jsx", out)

print("\n── 학생 화면 ──")
for s in student_screens:
    write_screen(s, "student")

print("\n── 교사 화면 ──")
for t in teacher_screens:
    write_screen(t, "teacher")

print("\n── 관리자 화면 ──")
for a in admin_screens:
    write_screen(a, "admin")

# ──────────────────────────────────────────────────────────────
# 17. App.jsx
# ──────────────────────────────────────────────────────────────
app_raw      = extract_section("App")
appshell_raw = extract_section("AppShell")
public_raw   = extract_section("PUBLIC_SCREENS")
req_role_raw = extract_section("requiredRole")

write_file("App.jsx",
    'import { useState, useEffect, useCallback, useRef } from "react";\n'
    'import { StoreProvider, useStore } from "./store/StoreProvider.jsx";\n'
    'import { Toast } from "./components/Toast.jsx";\n'
    'import { Sidebar } from "./components/layout/Sidebar.jsx";\n'
    'import { GlobalHeader } from "./components/layout/GlobalHeader.jsx";\n'
    'import { ScreenPicker } from "./components/ScreenPicker.jsx";\n'
    'import { renderScreen } from "./screens/index.jsx";\n'
    'import { S_NAV, T_NAV, A_NAV, TITLES, NO_HDR,\n'
    '         SHARED_SCREENS, getLayout } from "./nav/menus.js";\n'
    'import TDS from "./theme/tokens.js";\n'
    'import { TFI } from "./components/ui.jsx";\n\n'
    + public_raw
    + "\n"
    + req_role_raw.replace("function requiredRole", "function requiredRole", 1)
    + "\n\n"
    + app_raw
    + "\n\n"
    + appshell_raw
    + "\n"
)

# ──────────────────────────────────────────────────────────────
# 18. main.jsx
# ──────────────────────────────────────────────────────────────
write_file("main.jsx",
    'import { StrictMode } from "react";\n'
    'import { createRoot } from "react-dom/client";\n'
    'import "./theme/styles.css";\n'
    'import App from "./App.jsx";\n\n'
    'createRoot(document.getElementById("root")).render(\n'
    '  <StrictMode>\n'
    '    <App />\n'
    '  </StrictMode>\n'
    ');\n'
)

print("\n✅ 분리 완료!")
print("   다음: cd apps/web && npm install && npm run build")
