import sys
import os
import subprocess
import imageio_ffmpeg

VIDEO_URL = "https://www.youtube.com/watch?v=Q1FSCSyFJ7U"
OUTPUT_DIR = "/Volumes/MAC STORAGE/Desktop/DESKIMON-V1/video_sd"
FFMPEG_EXE = imageio_ffmpeg.get_ffmpeg_exe()
YT_DLP_EXE = "/Users/pankaj/Library/Python/3.9/bin/yt-dlp"

os.makedirs(OUTPUT_DIR, exist_ok=True)
frames_dir = os.path.join(OUTPUT_DIR, "frames")
os.makedirs(frames_dir, exist_ok=True)

video_mp4 = os.path.join(OUTPUT_DIR, "raw_video.mp4")

if not os.path.exists(video_mp4):
    print(f"Downloading YouTube video from {VIDEO_URL}...")
    cmd_dl = f"'{YT_DLP_EXE}' --extractor-args \"youtube:player_client=android\" -f \"b\" -o '{video_mp4}' '{VIDEO_URL}'"
    subprocess.run(cmd_dl, shell=True, check=True)

print("Extracting 412x412 JPEG video frames at 15 FPS...")
cmd_ffmpeg_frames = f"'{FFMPEG_EXE}' -y -i '{video_mp4}' -vf 'fps=15,scale=412:412:force_original_aspect_ratio=increase,crop=412:412' '{frames_dir}/frame_%04d.jpg'"
subprocess.run(cmd_ffmpeg_frames, shell=True, check=True)

print("Extracting MP3 audio for PCM5101 DAC...")
audio_mp3 = os.path.join(OUTPUT_DIR, "audio.mp3")
cmd_ffmpeg_audio = f"'{FFMPEG_EXE}' -y -i '{video_mp4}' -ar 22050 -ac 2 -ab 128k '{audio_mp3}'"
subprocess.run(cmd_ffmpeg_audio, shell=True, check=True)

# Count frames
frame_files = sorted([f for f in os.listdir(frames_dir) if f.endswith(".jpg")])
meta_file = os.path.join(OUTPUT_DIR, "meta.txt")
with open(meta_file, "w") as f:
    f.write(f"total_frames={len(frame_files)}\nfps=15\nwidth=412\nheight=412\n")

print(f"Extraction complete! Total frames: {len(frame_files)}")
print(f"Files saved in directory: {OUTPUT_DIR}")
print("Copy the contents of 'video_sd' folder directly to your SD card root (/sdcard/video/)")
