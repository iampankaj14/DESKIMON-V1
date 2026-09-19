import os
import sys
import time
import serial
import base64
import glob

PORT = "/dev/cu.usbmodem14101"
BAUD = 115200
VIDEO_DIR = "/Volumes/MAC STORAGE/Desktop/DESKIMON-V1/video_sd"

if not os.path.exists(VIDEO_DIR):
    print(f"Error: {VIDEO_DIR} does not exist!")
    sys.exit(1)

print(f"Connecting to ESP32 on {PORT} at {BAUD} baud...")
try:
    ser = serial.Serial(PORT, BAUD, timeout=2.0)
except Exception as e:
    print(f"Failed to open serial port {PORT}: {e}")
    sys.exit(1)

time.sleep(1)
ser.reset_input_buffer()

def send_line_and_wait(cmd_str, expected_ack, timeout=3.0):
    ser.write((cmd_str + "\n").encode("utf-8"))
    ser.flush()
    start_t = time.time()
    while time.time() - start_t < timeout:
        if ser.in_waiting:
            line = ser.readline().decode("utf-8", errors="ignore").strip()
            if expected_ack in line:
                return True
            elif "@@FAIL" in line:
                return False
        time.sleep(0.005)
    return False

def upload_file(local_path, remote_path):
    if not send_line_and_wait(f"@@OPEN {remote_path}", "@@OK_OPEN"):
        print(f"\nFailed to open {remote_path} on ESP32")
        return False

    with open(local_path, "rb") as f:
        while True:
            chunk = f.read(1024)
            if not chunk:
                break
            b64_str = base64.b64encode(chunk).decode("ascii")
            if not send_line_and_wait(f"@@DATA {b64_str}", "@@OK_DATA"):
                print(f"\nFailed data chunk for {remote_path}")
                send_line_and_wait("@@CLOSE", "@@OK_CLOSE")
                return False

    return send_line_and_wait("@@CLOSE", "@@OK_CLOSE")

# Build file list
files_to_upload = []

audio_file = os.path.join(VIDEO_DIR, "audio.mp3")
if os.path.exists(audio_file):
    files_to_upload.append((audio_file, "/sdcard/video/audio.mp3"))

meta_file = os.path.join(VIDEO_DIR, "meta.txt")
if os.path.exists(meta_file):
    files_to_upload.append((meta_file, "/sdcard/video/meta.txt"))

frame_files = sorted(glob.glob(os.path.join(VIDEO_DIR, "frames", "frame_*.jpg")))
for f in frame_files:
    fname = os.path.basename(f)
    files_to_upload.append((f, f"/sdcard/video/frames/{fname}"))

print(f"Total files to upload: {len(files_to_upload)}")

success_count = 0
for idx, (local_p, remote_p) in enumerate(files_to_upload, 1):
    sys.stdout.write(f"\rUploading [{idx}/{len(files_to_upload)}] {os.path.basename(remote_p)}... ")
    sys.stdout.flush()
    if upload_file(local_p, remote_p):
        success_count += 1
    else:
        # Retry once
        time.sleep(0.1)
        if upload_file(local_p, remote_p):
            success_count += 1

print(f"\nUpload finished! Successfully uploaded {success_count}/{len(files_to_upload)} files to ESP32 SD Card.")
ser.close()
