export function GullakLogo({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 200"
      className={className}
    >
      <rect width="200" height="200" fill="#FAF6F1" rx="32"/>
      <circle cx="100" cy="50" r="18" fill="#E8D5B0" stroke="#2C1A0E" strokeWidth="3"/>
      <text x="100" y="55" fontFamily="system-ui, sans-serif" fontSize="14" fontWeight="800" fill="#2C1A0E" textAnchor="middle">Rs</text>
      <path d="M 100 70 L 100 85" stroke="#8C7355" strokeWidth="3" strokeDasharray="4 4" strokeLinecap="round"/>
      <path d="M75 90 C40 90 25 130 45 160 C60 180 140 180 155 160 C175 130 160 90 125 90 Z" fill="#C4622D"/>
      <rect x="80" y="80" width="40" height="12" rx="4" fill="#8C7355"/>
      <ellipse cx="100" cy="80" rx="22" ry="6" fill="#C4622D"/>
      <rect x="85" y="115" width="30" height="6" rx="3" fill="#2C1A0E"/>
      <path d="M 145 105 Q 155 105 155 95 Q 155 105 165 105 Q 155 105 155 115 Q 155 105 145 105 Z" fill="#E8D5B0"/>
      <path d="M 35 135 Q 42 135 42 128 Q 42 135 49 135 Q 42 135 42 142 Q 42 135 35 135 Z" fill="#FAF6F1"/>
      <circle cx="125" cy="140" r="3" fill="#E8D5B0" opacity="0.8"/>
    </svg>
  )
}
