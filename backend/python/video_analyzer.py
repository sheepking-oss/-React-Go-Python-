import json
import subprocess
import os
from typing import Dict, Any, Optional


class VideoAnalyzer:
    def __init__(self, ffmpeg_path: str = "ffmpeg", ffprobe_path: str = "ffprobe"):
        self.ffmpeg_path = ffmpeg_path
        self.ffprobe_path = ffprobe_path

    def analyze(self, input_path: str) -> Dict[str, Any]:
        if not os.path.exists(input_path):
            raise FileNotFoundError(f"Input file not found: {input_path}")

        probe_result = self._probe(input_path)
        
        video_stream = self._get_video_stream(probe_result)
        audio_stream = self._get_audio_stream(probe_result)
        format_info = probe_result.get("format", {})

        result = {
            "duration": self._parse_duration(format_info, video_stream),
            "width": video_stream.get("width", 0) if video_stream else 0,
            "height": video_stream.get("height", 0) if video_stream else 0,
            "codec": video_stream.get("codec_name", "") if video_stream else "",
            "bitrate": self._parse_bitrate(format_info, video_stream),
            "fps": self._parse_fps(video_stream) if video_stream else 0.0,
            "pixel_format": video_stream.get("pix_fmt", "") if video_stream else "",
            "audio_codec": audio_stream.get("codec_name", "") if audio_stream else "",
            "audio_bitrate": self._parse_audio_bitrate(audio_stream) if audio_stream else 0,
            "audio_channels": audio_stream.get("channels", 0) if audio_stream else 0,
            "audio_sample_rate": int(audio_stream.get("sample_rate", 0)) if audio_stream else 0,
            "file_size": int(format_info.get("size", 0)),
            "format": format_info.get("format_name", ""),
            "streams": len(probe_result.get("streams", [])),
        }

        return result

    def _probe(self, input_path: str) -> Dict[str, Any]:
        cmd = [
            self.ffprobe_path,
            "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            "-show_streams",
            input_path
        ]

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=60
        )

        if result.returncode != 0:
            raise RuntimeError(f"FFprobe failed: {result.stderr}")

        return json.loads(result.stdout)

    def _get_video_stream(self, probe_result: Dict) -> Optional[Dict]:
        streams = probe_result.get("streams", [])
        for stream in streams:
            if stream.get("codec_type") == "video":
                return stream
        return None

    def _get_audio_stream(self, probe_result: Dict) -> Optional[Dict]:
        streams = probe_result.get("streams", [])
        for stream in streams:
            if stream.get("codec_type") == "audio":
                return stream
        return None

    def _parse_duration(self, format_info: Dict, video_stream: Optional[Dict]) -> float:
        duration_str = format_info.get("duration")
        if duration_str:
            try:
                return float(duration_str)
            except (ValueError, TypeError):
                pass
        
        if video_stream:
            duration_str = video_stream.get("duration")
            if duration_str:
                try:
                    return float(duration_str)
                except (ValueError, TypeError):
                    pass

        return 0.0

    def _parse_bitrate(self, format_info: Dict, video_stream: Optional[Dict]) -> int:
        bitrate_str = format_info.get("bit_rate")
        if bitrate_str:
            try:
                return int(bitrate_str)
            except (ValueError, TypeError):
                pass
        
        if video_stream:
            bitrate_str = video_stream.get("bit_rate")
            if bitrate_str:
                try:
                    return int(bitrate_str)
                except (ValueError, TypeError):
                    pass

        return 0

    def _parse_fps(self, video_stream: Dict) -> float:
        avg_frame_rate = video_stream.get("avg_frame_rate", "")
        if avg_frame_rate and "/" in avg_frame_rate:
            try:
                num, den = map(int, avg_frame_rate.split("/"))
                if den != 0:
                    return num / den
            except (ValueError, ZeroDivisionError):
                pass

        r_frame_rate = video_stream.get("r_frame_rate", "")
        if r_frame_rate and "/" in r_frame_rate:
            try:
                num, den = map(int, r_frame_rate.split("/"))
                if den != 0:
                    return num / den
            except (ValueError, ZeroDivisionError):
                pass

        return 0.0

    def _parse_audio_bitrate(self, audio_stream: Dict) -> int:
        bitrate_str = audio_stream.get("bit_rate")
        if bitrate_str:
            try:
                return int(bitrate_str)
            except (ValueError, TypeError):
                pass
        return 0

    def get_video_info(self, input_path: str) -> Dict[str, Any]:
        return self.analyze(input_path)
