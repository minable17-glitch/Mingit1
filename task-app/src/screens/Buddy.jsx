// 업무 친구 캐릭터 (SVG): 동글동글한 찹쌀떡 모양. 몸 색 = 분류 색(파스텔), 표정 = 기분,
// 오른쪽 위 숫자 = 남은 단계, 크기 = 최근에 챙긴 정도.
import { useId } from 'react';

const INK = '#3a3440';
const BLUSH = '#ff8fab';

// 색 섞기: 분류 색을 파스텔·진한 색으로
function mix(hex, to, t) {
  const h = (hex || '#9aa5b8').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0');
  const n = parseInt(full, 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const [tr, tg, tb] = to === 'white' ? [255, 255, 255] : [40, 30, 50];
  const c = (a, z) => Math.round(a + (z - a) * t);
  return `rgb(${c(r, tr)}, ${c(g, tg)}, ${c(b, tb)})`;
}

// 반짝이는 큰 눈
const Shiny = ({ x, y, look = 0 }) => (
  <g>
    <ellipse cx={x} cy={y} rx="6.8" ry="8.2" fill={INK} />
    <circle cx={x + 2.4 + look} cy={y - 3.2} r="2.8" fill="#fff" />
    <circle cx={x - 2.2 + look} cy={y + 3} r="1.3" fill="#fff" />
  </g>
);

function Face({ mood }) {
  const line = { stroke: INK, strokeWidth: 3.2, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' };
  switch (mood) {
    case 'happy': // ^ ^ 웃는 눈 + 벌린 입
      return (
        <g>
          <path d="M37,68 Q44,59 51,68" {...line} />
          <path d="M69,68 Q76,59 83,68" {...line} />
          <path d="M53,77 Q60,88 67,77 Z" fill={INK} />
          <path d="M56,82 Q60,86 64,82" fill="#ff7a93" />
        </g>
      );
    case 'sleepy': // 감은 눈 + 콧방울
      return (
        <g>
          <path d="M37,68 Q44,73 51,68" {...line} />
          <path d="M69,68 Q76,73 83,68" {...line} />
          <path d="M56,81 Q60,79 64,81" {...line} strokeWidth="2.6" />
          <circle className="snot" cx="70" cy="78" r="5" fill="#cfe8ff" stroke="#9cc9f2" strokeWidth="1.2" opacity="0.9" />
        </g>
      );
    case 'waiting': // 위를 보는 눈 + 작은 입
      return (
        <g>
          <Shiny x={44} y={66} look={1.5} />
          <Shiny x={76} y={66} look={1.5} />
          <circle cx="61" cy="81" r="2.6" fill={INK} />
        </g>
      );
    case 'worried': // 처진 눈썹 + 물결 입
      return (
        <g>
          <path d="M36,55 L49,58 M84,55 L71,58" {...line} strokeWidth="2.6" />
          <Shiny x={44} y={67} />
          <Shiny x={76} y={67} />
          <path d="M52,82 q2,-3 4,0 q2,3 4,0 q2,-3 4,0 q2,3 4,0" {...line} strokeWidth="2.6" />
        </g>
      );
    case 'panic': // > < 눈 + 동그란 입 + 눈물
      return (
        <g>
          <path d="M37,61 L48,67 L37,73" {...line} />
          <path d="M83,61 L72,67 L83,73" {...line} />
          <ellipse cx="60" cy="83" rx="5.5" ry="6.5" fill={INK} />
          <path d="M36,76 q-3,8 0,10 q3,-2 0,-10 z" fill="#8fd3ff" />
          <path d="M84,76 q3,8 0,10 q-3,-2 0,-10 z" fill="#8fd3ff" />
        </g>
      );
    default: // calm: 반짝 눈 + ω 입
      return (
        <g>
          <Shiny x={44} y={66} />
          <Shiny x={76} y={66} />
          <path d="M53,78 q3.5,4 7,0 q3.5,4 7,0" {...line} strokeWidth="2.6" />
        </g>
      );
  }
}

function Extras({ mood }) {
  if (mood === 'happy') {
    return (
      <g className="sparkle">
        <path d="M100,30 l2.2,5.3 5.3,2.2 -5.3,2.2 -2.2,5.3 -2.2,-5.3 -5.3,-2.2 5.3,-2.2 z" fill="#ffd54f" />
        <path d="M16,40 l1.4,3.4 3.4,1.4 -3.4,1.4 -1.4,3.4 -1.4,-3.4 -3.4,-1.4 3.4,-1.4 z" fill="#ffe082" />
      </g>
    );
  }
  if (mood === 'sleepy') {
    return <g className="zzz" fill="#9aa3b5" fontWeight="800" fontFamily="sans-serif"><text x="92" y="40" fontSize="12">z</text><text x="101" y="28" fontSize="16">Z</text></g>;
  }
  if (mood === 'waiting') {
    return (
      <g>
        <rect x="86" y="18" width="28" height="18" rx="9" fill="#fff" stroke="#c3c9d6" strokeWidth="1.5" />
        <g fill="#9aa3b5"><circle cx="93" cy="27" r="2" /><circle cx="100" cy="27" r="2" /><circle cx="107" cy="27" r="2" /></g>
      </g>
    );
  }
  const drop = (x, y) => <path key={x} d={`M${x},${y} q5,8 0,11 q-5,-3 0,-11 z`} fill="#8fd3ff" stroke="#5bb4ea" strokeWidth="1" />;
  if (mood === 'worried') return <g className="sweat">{drop(96, 46)}</g>;
  if (mood === 'panic') return <g className="sweat">{drop(100, 40)}{drop(18, 44)}</g>;
  return null;
}

export default function Buddy({ color, mood, boxes = 0, size = 1, delay = 0 }) {
  const id = useId().replace(/:/g, '');
  const base = mix(color, 'white', 0.38);
  const light = mix(color, 'white', 0.7);
  const edge = mix(color, 'ink', 0.18);
  const w = Math.round(76 * size);
  const armsUp = mood === 'panic' || mood === 'happy';
  return (
    <svg className={`buddy-svg mood-${mood}`} width={w} height={w} viewBox="0 0 120 120" aria-hidden="true" style={{ animationDelay: `${delay}s` }}>
      <defs>
        <radialGradient id={`g${id}`} cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor={light} />
          <stop offset="70%" stopColor={base} />
        </radialGradient>
      </defs>
      <ellipse cx="60" cy="110" rx="34" ry="5" className="buddy-shadow" />
      <g className="buddy-body">
        {/* 새싹 */}
        <path d="M60,26 Q59,18 60,12" stroke="#6dbb73" strokeWidth="3" strokeLinecap="round" fill="none" />
        <path d="M60,15 C54,6 44,8 45,14 C50,19 56,18 60,15 Z" fill="#8fd694" />
        <path d="M60,14 C66,4 77,6 76,12 C71,18 64,17 60,14 Z" fill="#a5e0a9" />
        {/* 팔 */}
        {armsUp ? (
          <g fill={base} stroke={edge} strokeWidth="2">
            <ellipse cx="16" cy="62" rx="7" ry="10" transform="rotate(-35 16 62)" />
            <ellipse cx="104" cy="62" rx="7" ry="10" transform="rotate(35 104 62)" />
          </g>
        ) : (
          <g fill={base} stroke={edge} strokeWidth="2">
            <ellipse cx="15" cy="84" rx="7" ry="9" transform="rotate(25 15 84)" />
            <ellipse cx="105" cy="84" rx="7" ry="9" transform="rotate(-25 105 84)" />
          </g>
        )}
        {/* 발 */}
        <ellipse cx="44" cy="105" rx="10" ry="5.5" fill={edge} opacity="0.55" />
        <ellipse cx="76" cy="105" rx="10" ry="5.5" fill={edge} opacity="0.55" />
        {/* 몸 */}
        <path d="M60,24 C93,24 109,50 109,73 C109,97 89,107 60,107 C31,107 11,97 11,73 C11,50 27,24 60,24 Z"
          fill={`url(#g${id})`} stroke={edge} strokeWidth="2.5" />
        <ellipse cx="38" cy="44" rx="9" ry="5" fill="#fff" opacity="0.55" transform="rotate(-25 38 44)" />
        {/* 볼 */}
        <ellipse cx="32" cy="78" rx="8.5" ry="5" fill={BLUSH} opacity={mood === 'sleepy' ? 0.3 : 0.55} />
        <ellipse cx="88" cy="78" rx="8.5" ry="5" fill={BLUSH} opacity={mood === 'sleepy' ? 0.3 : 0.55} />
        <Face mood={mood} />
      </g>
      <Extras mood={mood} />
      {/* 남은 단계 수 */}
      {boxes > 0 && (
        <g>
          <circle cx="20" cy="28" r="12" fill="#fff" stroke={edge} strokeWidth="2" />
          <text x="20" y="33" textAnchor="middle" fontSize="13" fontWeight="800" fill={INK} fontFamily="sans-serif">{boxes > 99 ? '99' : boxes}</text>
        </g>
      )}
    </svg>
  );
}
