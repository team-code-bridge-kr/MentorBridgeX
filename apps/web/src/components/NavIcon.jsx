export const NAV_ICON_PATHS = {
  home:      <><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/><path d="M9.5 20v-6h5v6"/></>,
  graph:     <><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="7" r="2.5"/><circle cx="7" cy="18" r="2.5"/><circle cx="17" cy="17" r="2.5"/><path d="M8 7l8 0.6M7.5 8.4l-0.3 7M8.8 16.9l6.5-7.8M9.3 17.6l5.9-0.4"/></>,
  text:      <><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/><path d="M9.5 12h5M9.5 15.5h5"/></>,
  voice:     <><rect x="9.5" y="3" width="5" height="11" rx="2.5"/><path d="M6 11a6 6 0 0 0 12 0"/><path d="M12 17v3M9 20h6"/></>,
  form:      <><rect x="4" y="3.5" width="16" height="17" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
  comment:   <><path d="M4 5h16v11H8l-4 4z"/><path d="M8 9h8M8 12.5h5"/></>,
  bell:      <><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6z"/><path d="M10 20a2 2 0 0 0 4 0"/></>,
  stats:     <><path d="M4 20V4M20 20H4"/><path d="M8 17v-4M12 17V9M16 17v-6"/></>,
  settings:  <><circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4 5.3 5.3"/></>,
  users:     <><circle cx="9" cy="8" r="3"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><path d="M16 5.5a3 3 0 0 1 0 5.8M16.5 13.5a5.5 5.5 0 0 1 4 6.5"/></>,
  report:    <><path d="M9 4h9v16H6V7z"/><path d="M9 4v3H6"/><path d="M9 11h6M9 14.5h6"/><circle cx="8" cy="4" r="0"/></>,
  check:     <><circle cx="12" cy="12" r="9"/><path d="M8 12l2.5 2.5L16 9"/></>,
  system:    <><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/><path d="M7 10l2 2-2 2M12 14h4"/></>,
  metric:    <><path d="M4 20V4M20 20H4"/><path d="M6 15l4-4 3 3 5-6"/><path d="M18 8h-3M18 8v3"/></>,
  alert:     <><path d="M12 4 3 19h18z"/><path d="M12 10v4M12 16.5v.5"/></>,
  master:    <><path d="M5 5.5C5 4.7 8.1 4 12 4s7 0.7 7 1.5v13c0 0.8-3.1 1.5-7 1.5s-7-0.7-7-1.5z"/><path d="M5 5.5C5 6.3 8.1 7 12 7s7-0.7 7-1.5M5 12c0 0.8 3.1 1.5 7 1.5s7-0.7 7-1.5"/></>,
  shield:    <><path d="M12 3l7 3v6c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6z"/><path d="M9 12l2 2 4-4"/></>,
  /* 그래프 화면 전용 */
  core:      <><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/></>,
  branch:    <><circle cx="6" cy="6" r="2.2"/><circle cx="18" cy="12" r="2.2"/><circle cx="7" cy="18" r="2.2"/><path d="M8 7l8 4M8.5 16.5 16 13"/></>,
  leaf:      <><path d="M5 19c0-8 6-13 14-13 0 8-5 14-13 14a6 6 0 0 1-1-1z"/><path d="M9 15c2-3 4-4 7-5"/></>,
  sparkle:   <><path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6z"/><path d="M18 15l.7 2.3L21 18l-2.3.7L18 21l-.7-2.3L15 18l2.3-.7z"/></>,
  history:   <><path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3.5 4.5V9H8"/><path d="M12 8v4.5l3 1.8"/></>,
  exportIco: <><path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/></>,
  plusSeed:  <><circle cx="12" cy="12" r="8.5"/><path d="M12 8v8M8 12h8"/></>,

  /* 그래프 노드 아이콘 — 색은 노드 유형, 아이콘은 과목·분야를 뜻한다.
     기존 아이콘과 같은 24x24 / stroke 1.7 선 스타일로 맞춘다. */
  record:    <><path d="M5.5 5A2 2 0 0 1 7.5 3H14l4.5 4.5V19a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2z"/><path d="M14 3v4.5h4.5"/><path d="M9 12.5h6M9 16h4"/></>,
  bookOpen:  <><path d="M12 6.8C10.6 5.3 8.6 4.7 4.5 4.7v12.6c4.1 0 6.1.6 7.5 2.1"/><path d="M12 6.8c1.4-1.5 3.4-2.1 7.5-2.1v12.6c-4.1 0-6.1.6-7.5 2.1"/><path d="M12 6.8v12.6"/></>,
  language:  <><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5c2.4 2.7 2.4 14.3 0 17M12 3.5c-2.4 2.7-2.4 14.3 0 17"/></>,
  sigma:     <><path d="M17 5.5H7l5.4 6.5L7 18.5h10"/></>,
  flask:     <><path d="M9.5 3.5v6L4.9 17.2A2 2 0 0 0 6.6 20.3h10.8a2 2 0 0 0 1.7-3.1L14.5 9.5v-6"/><path d="M8.3 3.5h7.4"/><path d="M7.3 14.2h9.4"/></>,
  landmark:  <><path d="M3.5 9.5 12 4.2l8.5 5.3"/><path d="M6.3 11.5v6M10.1 11.5v6M13.9 11.5v6M17.7 11.5v6"/><path d="M3.8 20h16.4"/></>,
  hourglass: <><path d="M7 3.5h10M7 20.5h10"/><path d="M8 3.5v3.2c0 2 4 3.4 4 5.3s-4 3.3-4 5.3v3.2"/><path d="M16 3.5v3.2c0 2-4 3.4-4 5.3s4 3.3 4 5.3v3.2"/></>,
  code:      <><path d="M9 8.5 5 12l4 3.5"/><path d="M15 8.5 19 12l-4 3.5"/><path d="M13.4 5.5 10.6 18.5"/></>,
  cpu:       <><rect x="7" y="7" width="10" height="10" rx="2"/><path d="M10.6 10.6h2.8v2.8h-2.8z"/><path d="M10 4v3M14 4v3M10 17v3M14 17v3M4 10h3M4 14h3M17 10h3M17 14h3"/></>,
  palette:   <><path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.2 0 2.1-.9 2.1-2 0-.6-.2-1-.6-1.4-.4-.4-.6-.8-.6-1.3 0-1 .9-1.8 1.9-1.8h1.5a4.2 4.2 0 0 0 4.2-4.2c0-3.6-3.8-6.3-8.5-6.3z"/><circle cx="7.6" cy="11.3" r=".9"/><circle cx="10.2" cy="7.6" r=".9"/><circle cx="14.6" cy="7.9" r=".9"/></>,
  music:     <><path d="M9 17.5v-12l10-2v12"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="15.5" r="2.5"/></>,
  dumbbell:  <><path d="M6.5 8v8M4 10v4M17.5 8v8M20 10v4"/><path d="M6.5 12h11"/></>,
  compass:   <><circle cx="12" cy="12" r="8.5"/><path d="m15.6 8.4-2.1 5.1-5.1 2.1 2.1-5.1z"/></>,
  trophy:    <><path d="M7.5 4h9v4.6a4.5 4.5 0 0 1-9 0z"/><path d="M7.5 5.6H5A2.5 2.5 0 0 0 7.6 10M16.5 5.6H19a2.5 2.5 0 0 1-2.6 4.4"/><path d="M12 13.1v3.4M9 20h6"/></>,
  heart:     <><path d="M12 20s-7.2-4.3-7.2-9.3A3.9 3.9 0 0 1 12 8.2a3.9 3.9 0 0 1 7.2 2.5C19.2 15.7 12 20 12 20z"/></>,
  search:    <><circle cx="11" cy="11" r="6.2"/><path d="m15.6 15.6 4.4 4.4"/></>,
  flag:      <><path d="M6 21V3.8"/><path d="M6 4.5h11.5l-2.2 3.6 2.2 3.6H6"/></>,
  calendar:  <><rect x="3.5" y="5.2" width="17" height="15.3" rx="2"/><path d="M8 3v4.2M16 3v4.2M3.5 10.2h17"/></>,
};

export function NavIcon({ name, size=18, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      {NAV_ICON_PATHS[name] || NAV_ICON_PATHS.home}
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────────
   NAV CONFIGS
────────────────────────────────────────────────────────────── */

