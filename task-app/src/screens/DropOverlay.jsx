// 파일 끌어다 놓기: 컴퓨터에서 파일을 끌어 화면 어디에든 가져오면 "여기에 놓으세요" 판이 뜨고, 놓으면 onFiles 로 넘김.
// (글자·링크를 끌 때는 반응하지 않음)
import { useEffect, useRef, useState } from 'react';
import { filesFrom } from '../lib/files.js';

const hasFiles = (e) => [...(e.dataTransfer?.types ?? [])].includes('Files');

export default function DropOverlay({ label, hint, onFiles }) {
  const [shown, setShown] = useState(false);
  const depth = useRef(0); // 안쪽 요소를 지날 때마다 들어옴/나감이 겹쳐 오므로 세어 둠
  const latest = useRef(onFiles);
  useEffect(() => { latest.current = onFiles; });

  useEffect(() => {
    const enter = (e) => { if (!hasFiles(e)) return; e.preventDefault(); depth.current += 1; setShown(true); };
    const over = (e) => { if (!hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; };
    const leave = (e) => { if (!hasFiles(e)) return; depth.current = Math.max(0, depth.current - 1); if (!depth.current) setShown(false); };
    const drop = (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current = 0;
      setShown(false);
      const files = filesFrom(e.dataTransfer);
      if (files.length) latest.current(files);
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
    };
  }, []);

  if (!shown) return null;
  return (
    <div className="drop-overlay" aria-live="polite">
      <div className="drop-box">
        <span className="drop-icon" aria-hidden="true">📎</span>
        <b>{label}</b>
        {hint && <span className="small">{hint}</span>}
      </div>
    </div>
  );
}
