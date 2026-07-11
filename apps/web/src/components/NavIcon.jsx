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

