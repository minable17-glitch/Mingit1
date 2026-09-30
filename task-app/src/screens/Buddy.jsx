// 업무 친구 캐릭터 한 명 (SVG). 몸 색 = 분류 색, 표정 = 기분, 머리 위 상자 = 남은 단계, 크기 = 챙긴 정도.
const FACE = '#2b2b33';

function Eyes({ mood }) {
  if (mood === 'happy') {
    return <g stroke={FACE} strokeWidth="3" strokeLinecap="round" fill="none"><path d="M32,86 Q38,78 44,86" /><path d="M56,86 Q62,78 68,86" /></g>;
  }
  if (mood === 'sleepy') {
    return <g stroke={FACE} strokeWidth="3" strokeLinecap="round" fill="none"><path d="M32,84 Q38,89 44,84" /><path d="M56,84 Q62,89 68,84" /></g>;
  }
  if (mood === 'panic') {
    return <g stroke={FACE} strokeWidth="3" strokeLinecap="round"><path d="M33,79 L43,89 M43,79 L33,89" /><path d="M57,79 L67,89 M67,79 L57,89" /></g>;
  }
  if (mood === 'worried') {
    return (
      <g>
        <circle cx="38" cy="84" r="7" fill="#fff" stroke={FACE} strokeWidth="1.5" /><circle cx="38" cy="85" r="3.4" fill={FACE} />
        <circle cx="62" cy="84" r="7" fill="#fff" stroke={FACE} strokeWidth="1.5" /><circle cx="62" cy="85" r="3.4" fill={FACE} />
        <path d="M30,74 L44,77 M70,74 L56,77" stroke={FACE} strokeWidth="2.5" strokeLinecap="round" />
      </g>
    );
  }
  const dx = mood === 'waiting' ? 3 : 0;
  return <g fill={FACE}><circle cx={38 + dx} cy="84" r="3.6" /><circle cx={62 + dx} cy="84" r="3.6" /></g>;
}

function Mouth({ mood }) {
  const p = { stroke: FACE, strokeWidth: 3, strokeLinecap: 'round', fill: 'none' };
  if (mood === 'happy') return <path d="M42,96 Q50,106 58,96" {...p} fill="#e8667a" />;
  if (mood === 'calm') return <path d="M44,97 Q50,102 56,97" {...p} />;
  if (mood === 'sleepy') return <path d="M45,100 Q50,97 55,100" {...p} />;
  if (mood === 'waiting') return <path d="M45,99 L55,99" {...p} />;
  if (mood === 'worried') return <ellipse cx="50" cy="100" rx="4" ry="5" fill={FACE} />;
  return <path d="M40,101 L45,97 L50,101 L55,97 L60,101" {...p} />;
}

function Extras({ mood }) {
  if (mood === 'happy') {
    return (
      <g>
        <ellipse cx="29" cy="94" rx="6" ry="3.5" fill="#ff8fa3" opacity="0.7" />
        <ellipse cx="71" cy="94" rx="6" ry="3.5" fill="#ff8fa3" opacity="0.7" />
        <path className="sparkle" d="M88,50 l2.5,6 6,2.5 -6,2.5 -2.5,6 -2.5,-6 -6,-2.5 6,-2.5 z" fill="#ffd23f" />
      </g>
    );
  }
  if (mood === 'sleepy') {
    return <g className="zzz" fill="#8a93a6" fontWeight="800"><text x="78" y="62" fontSize="13">z</text><text x="87" y="50" fontSize="17">Z</text></g>;
  }
  if (mood === 'waiting') {
    return (
      <g>
        <path d="M74,40 h24 a6,6 0 0 1 6,6 v10 a6,6 0 0 1 -6,6 h-16 l-6,6 v-6 a6,6 0 0 1 -6,-6 v-10 a6,6 0 0 1 6,-6 z" fill="#fff" stroke="#8a93a6" strokeWidth="1.5" />
        <g fill="#8a93a6"><circle cx="80" cy="51" r="2" /><circle cx="86" cy="51" r="2" /><circle cx="92" cy="51" r="2" /></g>
      </g>
    );
  }
  const drop = (x, y, s = 1) => <path key={x} d={`M${x},${y} q${4 * s},${7 * s} 0,${10 * s} q${-4 * s},${-3 * s} 0,${-10 * s} z`} fill="#6ec3f4" stroke="#3a9ad9" strokeWidth="1" />;
  if (mood === 'worried') return <g className="sweat">{drop(80, 64)}</g>;
  if (mood === 'panic') {
    return (
      <g>
        <g className="sweat">{drop(82, 62)}{drop(16, 70, 0.8)}</g>
        <text x="86" y="52" fontSize="22" fontWeight="900" fill="#d03b3b">!</text>
      </g>
    );
  }
  return null;
}

// 머리 위: 단계가 없으면 잎 두 장, 있으면 남은 단계만큼 상자 (5개 넘으면 +n)
function Top({ boxes }) {
  if (!boxes) {
    return (
      <g>
        <path d="M50,50 Q50,42 50,36" stroke="#4d9a45" strokeWidth="3" strokeLinecap="round" fill="none" />
        <path d="M50,40 C44,30 34,31 34,37 C39,42 46,42 50,40 Z" fill="#6cc070" />
        <path d="M50,38 C56,28 66,29 66,35 C61,40 54,40 50,38 Z" fill="#7fd083" />
      </g>
    );
  }
  const n = Math.min(boxes, 5);
  return (
    <g>
      {Array.from({ length: n }, (_, i) => (
        <g key={i} transform={`translate(${38 + (i % 2 ? 2 : -1)} ${40 - i * 9})`}>
          <rect width="24" height="9" rx="2" fill="#e0a868" stroke="#a8743a" strokeWidth="1.2" />
          <path d="M12,0 v9" stroke="#a8743a" strokeWidth="1" />
        </g>
      ))}
      {boxes > 5 && <text x="66" y={40 - 4 * 9 + 8} fontSize="11" fontWeight="800" fill="#a8743a">+{boxes - 5}</text>}
    </g>
  );
}

export default function Buddy({ color, mood, boxes, size = 1, delay = 0 }) {
  const w = Math.round(64 * size);
  return (
    <svg className={`buddy-svg mood-${mood}`} width={w} height={Math.round(w * 1.3)} viewBox="0 0 100 130" aria-hidden="true"
      style={{ animationDelay: `${delay}s` }}>
      <ellipse cx="50" cy="124" rx="44" ry="7" className="buddy-grass" />
      <ellipse cx="50" cy="124" rx="28" ry="3.5" className="buddy-shadow" />
      <Top boxes={boxes} />
      <g className="buddy-body">
        <ellipse cx="36" cy="121" rx="9" ry="4.5" fill={color} className="foot" />
        <ellipse cx="64" cy="121" rx="9" ry="4.5" fill={color} className="foot" />
        {mood === 'panic' && <g stroke={color} strokeWidth="6" strokeLinecap="round"><path d="M16,86 L6,70" /><path d="M84,86 L94,70" /></g>}
        <path d="M50,50 C74,50 88,70 88,93 C88,112 74,122 50,122 C26,122 12,112 12,93 C12,70 26,50 50,50 Z" fill={color} stroke="rgba(0,0,0,0.18)" strokeWidth="1.5" />
        <ellipse cx="35" cy="68" rx="10" ry="6" fill="#fff" opacity="0.28" transform="rotate(-20 35 68)" />
        <Eyes mood={mood} />
        <Mouth mood={mood} />
      </g>
      <Extras mood={mood} />
    </svg>
  );
}
