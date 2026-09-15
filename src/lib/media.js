// 유튜브 링크(watch?v=, youtu.be/, shorts/)를 iframe embed 주소로 바꿔줌.
// 유튜브가 아니면(드라이브 영상 등) 원본 그대로 돌려줌 → <video> 태그로 재생.
export function toYoutubeEmbedUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace('www.', '');
    if (host === 'youtu.be') {
      return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    }
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (u.pathname === '/watch') {
        const id = u.searchParams.get('v');
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }
      if (u.pathname.startsWith('/shorts/')) {
        return `https://www.youtube.com/embed/${u.pathname.split('/')[2]}`;
      }
      if (u.pathname.startsWith('/embed/')) {
        return url;
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function splitUrls(text) {
  if (!text) return [];
  return text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
