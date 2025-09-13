declare module 'ffprobe-static' {
  const ffprobeStatic: { path: string } | { path?: string } | string;
  export default ffprobeStatic as any;
}

declare module 'ffmpeg-static' {
  const ffmpegStatic: string | null;
  export default ffmpegStatic;
}
