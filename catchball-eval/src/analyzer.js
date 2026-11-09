// 영상을 일정 간격으로 한 장씩 넘기며 공 위치와 사람(손목) 위치를 기록합니다.
// 영상은 브라우저 안에서만 읽고, 어디로도 올라가지 않습니다.
import { createBallTracker, createStaticMap, detectBall } from './analysis.js';
import { extractPeople } from './pose.js';

export const ANALYSIS_WIDTH = 640; // 분석용 축소 화면 너비 (속도와 정확도의 절충; 멀리 있는 작은 공도 잡으려면 이 정도는 필요)

function seekTo(video, t) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      video.removeEventListener('seeked', finish);
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(finish, 1500); // 혹시 seeked 가 안 오면 그냥 진행
    video.addEventListener('seeked', finish);
    video.currentTime = t;
  });
}

/**
 * @param video  로드가 끝난 <video> 요소 (readyState >= 1)
 * @param opts   { fps, ballParams, poseLandmarker|null, onFrame, signal }
 * @returns track  [{ t, x, y, r, found, people }]
 */
export async function analyzeVideo(video, { fps = 15, ballParams, poseLandmarker = null, onFrame, signal } = {}) {
  const duration = video.duration;
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('영상 길이를 읽을 수 없습니다.');

  const scale = ANALYSIS_WIDTH / video.videoWidth;
  const width = ANALYSIS_WIDTH;
  const height = Math.max(1, Math.round(video.videoHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const tracker = createBallTracker();
  const staticMap = createStaticMap({ staticFrames: Math.round(fps * 3) });
  const track = [];
  const step = 1 / fps;
  let lastPoseTs = -1;

  for (let i = 0, t = 0; t < duration; i++, t = i * step) {
    if (signal?.aborted) throw new DOMException('분석이 취소되었습니다.', 'AbortError');
    await seekTo(video, Math.min(t, duration - 0.001));
    ctx.drawImage(video, 0, 0, width, height);

    // 1) 공: 색으로 찾기
    const img = ctx.getImageData(0, 0, width, height);
    const ball = detectBall(img.data, width, height, ballParams, tracker.predict(t), staticMap);
    tracker.update(ball, t);

    // 2) 사람: 포즈 인식 (켜져 있을 때만)
    let people = null;
    if (poseLandmarker) {
      // MediaPipe 는 타임스탬프가 계속 커져야 함
      const ts = Math.max(lastPoseTs + 1, Math.round(t * 1000));
      lastPoseTs = ts;
      try {
        people = extractPeople(poseLandmarker.detectForVideo(canvas, ts));
      } catch (e) {
        console.warn('포즈 인식 오류 (이 프레임은 건너뜀)', e);
      }
    }

    const frame = {
      t,
      x: ball ? ball.x : null,
      y: ball ? ball.y : null,
      r: ball ? ball.r : null,
      found: !!ball,
      people: people || undefined,
    };
    track.push(frame);
    onFrame?.({ frame, index: i, total: Math.ceil(duration / step), t, duration });
  }
  return track;
}

// 현재 화면에서 '공 색'으로 잡히는 부분을 빨갛게 칠해 보여주기 위한 마스크 이미지 생성
export function previewMask(video, ballParams, outWidth = ANALYSIS_WIDTH) {
  const scale = outWidth / video.videoWidth;
  const width = outWidth, height = Math.max(1, Math.round(video.videoHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(video, 0, 0, width, height);
  const img = ctx.getImageData(0, 0, width, height);
  const ball = detectBall(img.data, width, height, ballParams, null);
  return { canvas, img, ball, width, height };
}
