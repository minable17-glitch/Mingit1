// 캐치볼 영상을 브라우저 없이 검사하는 개발용 도구 (ffmpeg 필요, 포즈/손 인식은 제외).
// 실제 촬영 영상으로 공 색 기준값·판정 기준을 맞춰 볼 때 씁니다.
//
//   node scripts/catchball-offline.mjs 영상파일.mp4 [초당프레임=15] [분석너비=640]
//   DUMP=8-12 node scripts/catchball-offline.mjs 영상파일.mp4   ← 8~12초 구간의 공 위치를 프레임마다 출력
import { execFileSync } from 'node:child_process';
import { createBallTracker, createStaticMap, detectBall, detectEvents, DEFAULT_BALL_PARAMS } from '../src/catchball/analysis.js';

const [video, fpsArg = '15', widthArg = '640'] = process.argv.slice(2);
const fps = Number(fpsArg), W = Number(widthArg);
const probe = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', video]).toString().trim().split(',').map(Number);
const H = Math.round(probe[1] * W / probe[0]);
const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', video, '-vf', `fps=${fps},scale=${W}:${H}`, '-pix_fmt', 'rgba', '-f', 'rawvideo', '-'], { maxBuffer: 4 * 1024 * 1024 * 1024 });
const frameBytes = W * H * 4;
const n = Math.floor(raw.length / frameBytes);
const tracker = createBallTracker();
const staticMap = createStaticMap({ staticFrames: Math.round(fps * 3) });
const track = [];
for (let i = 0; i < n; i++) {
  const t = i / fps;
  const data = new Uint8ClampedArray(raw.buffer, raw.byteOffset + i * frameBytes, frameBytes);
  const ball = detectBall(data, W, H, DEFAULT_BALL_PARAMS, tracker.predict(t), staticMap);
  tracker.update(ball, t);
  track.push({ t, x: ball?.x ?? null, y: ball?.y ?? null, r: ball?.r ?? null, area: ball?.area ?? null, found: !!ball });
}
const { events, stats, groundY } = detectEvents(track);
console.log(`frames=${n} found=${track.filter(f => f.found).length} groundY=${groundY.toFixed(3)}`);
console.log('stats', stats);
for (const e of events) console.log(`${e.t.toFixed(2)}s ${e.type} ${(e.confidence*100)|0}% ${e.reason}`);
if (process.env.DUMP) {
  const [a, b] = process.env.DUMP.split('-').map(Number);
  for (const f of track) if (f.t >= a && f.t <= b) console.log(f.t.toFixed(2), f.found ? `${f.x.toFixed(3)},${f.y.toFixed(3)} area=${f.area}` : '--');
}
