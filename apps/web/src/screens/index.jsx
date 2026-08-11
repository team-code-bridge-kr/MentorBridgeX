import { S01 } from "./student/S01.jsx";
import { S02 } from "./student/S02.jsx";
import { S03 } from "./student/S03.jsx";
import { S04 } from "./student/S04.jsx";
import { S05 } from "./student/S05.jsx";
import { S06 } from "./student/S06.jsx";
import { S09 } from "./student/S09.jsx";
import { S11 } from "./student/S11.jsx";
import { S12 } from "./student/S12.jsx";
import { S13 } from "./student/S13.jsx";
import { S14 } from "./student/S14.jsx";
import { S15 } from "./student/S15.jsx";
import { S17 } from "./student/S17.jsx";
import { S20 } from "./student/S20.jsx";
import { S21 } from "./student/S21.jsx";
import { S22 } from "./student/S22.jsx";
import { S23 } from "./student/S23.jsx";
import { S24 } from "./student/S24.jsx";
import { S25 } from "./student/S25.jsx";
import { S28 } from "./student/S28.jsx";
import { S30 } from "./student/S30.jsx";
import { S32 } from "./student/S32.jsx";
import { S40 } from "./student/S40.jsx";
import { S41 } from "./student/S41.jsx";
import { S42 } from "./student/S42.jsx";
import { S43 } from "./student/S43.jsx";
import { S44 } from "./student/S44.jsx";
import { T01 } from "./teacher/T01.jsx";
import { T02 } from "./teacher/T02.jsx";
import { T03 } from "./teacher/T03.jsx";
import { T04 } from "./teacher/T04.jsx";
import { T05 } from "./teacher/T05.jsx";
import { T06 } from "./teacher/T06.jsx";
import { T07 } from "./teacher/T07.jsx";
import { T09 } from "./teacher/T09.jsx";
import { T10 } from "./teacher/T10.jsx";
import { A00 } from "./admin/A00.jsx";
import { A01 } from "./admin/A01.jsx";
import { A02 } from "./admin/A02.jsx";
import { A03 } from "./admin/A03.jsx";
import { A04 } from "./admin/A04.jsx";
import { A05 } from "./admin/A05.jsx";
import { A06 } from "./admin/A06.jsx";
import { A07 } from "./admin/A07.jsx";
import { A08 } from "./admin/A08.jsx";
import { A09 } from "./admin/A09.jsx";
import { A10 } from "./admin/A10.jsx";
import { A11 } from "./admin/A11.jsx";
import { A12 } from "./admin/A12.jsx";
import { A13 } from "./admin/A13.jsx";
import { A14 } from "./admin/A14.jsx";
import { A15 } from "./admin/A15.jsx";
import { A16 } from "./admin/A16.jsx";
import { A17 } from "./admin/A17.jsx";
import { A18 } from "./admin/A18.jsx";
import { A19 } from "./admin/A19.jsx";
import { A20 } from "./admin/A20.jsx";
import { A21 } from "./admin/A21.jsx";
import { A22 } from "./admin/A22.jsx";
import { A23 } from "./admin/A23.jsx";
import { A24 } from "./admin/A24.jsx";
import { A25 } from "./admin/A25.jsx";
import { A26 } from "./admin/A26.jsx";
import { A27 } from "./admin/A27.jsx";
import { A28 } from "./admin/A28.jsx";
import { A29 } from "./admin/A29.jsx";
import { A30 } from "./admin/A30.jsx";
import { A31 } from "./admin/A31.jsx";
import { A32 } from "./admin/A32.jsx";
import { Placeholder } from "../components/Placeholder.jsx";

export function renderScreen(id, onNav) {
  const M={
    S01:<S01 onNav={onNav}/>,S02:<S02 onNav={onNav}/>,S03:<S03 onNav={onNav}/>,S04:<S04 onNav={onNav}/>,
    S05:<S05 onNav={onNav}/>,S06:<S06 onNav={onNav}/>,
    S09:<S09 onNav={onNav}/>,
    S11:<S11 onNav={onNav}/>,
    S12:<S12 onNav={onNav}/>,S13:<S13 onNav={onNav}/>,
    S14:<S14 onNav={onNav}/>,S15:<S15 onNav={onNav}/>,
    S17:<S17 onNav={onNav}/>,
    S20:<S20 onNav={onNav}/>,S21:<S21 onNav={onNav}/>,
    S22:<S22 onNav={onNav}/>,S23:<S23 onNav={onNav}/>,
    S24:<S24 onNav={onNav}/>,S25:<S25 onNav={onNav}/>,
    S28:<S28 onNav={onNav}/>,
    S30:<S30 onNav={onNav}/>,
    S32:<S32 onNav={onNav}/>,
    S40:<S40 onNav={onNav}/>,S41:<S41 onNav={onNav}/>,S42:<S42 onNav={onNav}/>,S43:<S43 onNav={onNav}/>,S44:<S44 onNav={onNav}/>,
    T01:<T01 onNav={onNav}/>,T02:<T02 onNav={onNav}/>,
    T03:<T03 onNav={onNav}/>,T04:<T04 onNav={onNav}/>,
    T05:<T05 onNav={onNav}/>,T06:<T06 onNav={onNav}/>,
    T07:<T07 onNav={onNav}/>,T08:<S06 onNav={onNav}/>,T09:<T09 onNav={onNav}/>,
    T10:<T10 onNav={onNav}/>,T11:<S24 onNav={onNav}/>,T12:<S15 onNav={onNav}/>,
    A00:<A00 onNav={onNav}/>,A01:<A01 onNav={onNav}/>,A02:<A02 onNav={onNav}/>,
    A03:<A03 onNav={onNav}/>,A04:<A04 onNav={onNav}/>,
    A05:<A05 onNav={onNav}/>,A06:<A06 onNav={onNav}/>,
    A07:<A07 onNav={onNav}/>,A08:<A08 onNav={onNav}/>,
    A09:<A09 onNav={onNav}/>,A10:<A10 onNav={onNav}/>,
    A11:<A11 onNav={onNav}/>,A12:<A12 onNav={onNav}/>,
    A13:<A13 onNav={onNav}/>,A14:<A14 onNav={onNav}/>,
    A15:<A15 onNav={onNav}/>,A16:<A16 onNav={onNav}/>,
    A17:<A17 onNav={onNav}/>,A18:<A18 onNav={onNav}/>,
    A19:<A19 onNav={onNav}/>,A20:<A20 onNav={onNav}/>,
    A21:<A21 onNav={onNav}/>,A22:<A22 onNav={onNav}/>,
    A23:<A23 onNav={onNav}/>,A24:<A24 onNav={onNav}/>,
    A25:<A25 onNav={onNav}/>,A26:<A26 onNav={onNav}/>,
    A27:<A27 onNav={onNav}/>,A28:<A28 onNav={onNav}/>,
    A29:<A29 onNav={onNav}/>,A30:<A30 onNav={onNav}/>,
    A31:<A31 onNav={onNav}/>,A32:<A32 onNav={onNav}/>,
  };
  return M[id]||<Placeholder title={id} screen={id} />;
}

/* ──────────────────────────────────────────────────────────────
   LAYOUT HELPER
────────────────────────────────────────────────────────────── */
/* 역할 공용 화면: 음성·양식·알림·설정 등은 학생/교사가 함께 사용 →
   어느 역할로 로그인해도 접근 가능하고, 현재 로그인한 역할의 레이아웃(사이드바)로 표시 */
const SHARED_SCREENS = ["S15","S17","S20","S21","S22","S25","S30","S32"];
function getLayout(s, sessionRole){
  if(["S01","S03","S04","A00"].includes(s))return "full";
  // 공용 화면(음성·양식·알림·설정)은 현재 로그인한 역할의 레이아웃으로 표시
  if(SHARED_SCREENS.includes(s) && sessionRole){
    return sessionRole==="teacher"?"teacher":sessionRole==="admin"?"admin":"student";
  }
  if(s.startsWith("T"))return "teacher";
  if(s.startsWith("A"))return "admin";
  return "student";
}
const NO_HDR=["S06","T07","T08"];

/* ──────────────────────────────────────────────────────────────
   SCREEN PICKER FAB
────────────────────────────────────────────────────────────── */

