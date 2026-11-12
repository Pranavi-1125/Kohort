const P = {
  home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  book: 'M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3zM5 17a3 3 0 013-3h11',
  timer: 'M12 8v5l3 2M9 2h6M12 4a8 8 0 100 16 8 8 0 000-16z',
  users: 'M9 11a4 4 0 100-8 4 4 0 000 8zM2 21v-1a6 6 0 0112 0v1M17 11a3 3 0 100-6M22 21v-1a5 5 0 00-4-4.9',
  message: 'M21 12a8 8 0 01-11.6 7.1L3 21l1.9-5.4A8 8 0 1121 12z',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21v-1a6 6 0 0116 0v1',
  plus: 'M12 5v14M5 12h14', check: 'M5 12l5 5 9-10', trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4', x: 'M6 6l12 12M18 6L6 18', logout: 'M9 4H5v16h4M16 8l4 4-4 4M20 12H9',
  clock: 'M12 7v5l3 2M12 3a9 9 0 100 18 9 9 0 000-18z', send: 'M22 2L11 13M22 2l-7 20-4-9-9-4z',
  lock: 'M6 11h12v10H6zM8 11V8a4 4 0 018 0v3', globe: 'M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
  search: 'M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-5-5', flame: 'M12 3c1 4 5 5 5 10a5 5 0 01-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-4-1-6 1-9z',
  chevL: 'M15 5l-7 7 7 7', chevR: 'M9 5l7 7-7 7', play: 'M7 4l13 8-13 8z', pause: 'M8 5v14M16 5v14', reset: 'M4 12a8 8 0 108-8M4 4v5h5',
  mail: 'M3 6h18v12H3zM3 7l9 7 9-7', alert: 'M12 4l9 16H3zM12 10v4M12 17v.01', menu: 'M4 7h16M4 12h16M4 17h16',
};
export default function Icon({ name, size = 20, stroke = 1.9, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      <path d={P[name]} />
    </svg>
  );
}
