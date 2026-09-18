import os
import sys
import time
import math
import threading

try:
    import cv2
except ImportError:
    cv2 = None

try:
    import mediapipe as mp
    from mediapipe.tasks import python
    from mediapipe.tasks.python import vision
except ImportError:
    mp = None

def get_hand_model_path():
    """Locate bundled or local hand_landmarker.task model."""
    candidates = []
    if getattr(sys, 'frozen', False):
        candidates.append(os.path.join(getattr(sys, '_MEIPASS', ''), 'hand_landmarker.task'))
        candidates.append(os.path.join(getattr(sys, '_MEIPASS', ''), 'server', 'hand_landmarker.task'))
        candidates.append(os.path.join(os.path.dirname(sys.executable), 'hand_landmarker.task'))
    candidates.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'hand_landmarker.task'))
    candidates.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'hand_landmarker.task'))

    for c in candidates:
        if os.path.isfile(c):
            return os.path.abspath(c)
    return None

# Hand landmark connections (MediaPipe 21-point hand model)
_HAND_CONNECTIONS = [
    (0, 1), (1, 2), (2, 3), (3, 4),          # Thumb
    (0, 5), (5, 6), (6, 7), (7, 8),           # Index
    (0, 9), (9, 10), (10, 11), (11, 12),      # Middle
    (0, 13), (13, 14), (14, 15), (15, 16),    # Ring
    (0, 17), (17, 18), (18, 19), (19, 20),    # Pinky
    (5, 9), (9, 13), (13, 17),                # Palm knuckles
]
_MIDDLE_FINGER_IDS = {9, 10, 11, 12}          # MCP, PIP, DIP, TIP
_MIDDLE_CONNECTIONS = {(9, 10), (10, 11), (11, 12)}


def _draw_hand_overlay(frame, landmarks_list, is_gesture_list):
    """
    Draw hand skeleton + highlighted middle finger onto frame (in-place).
    landmarks_list: list of hand landmark lists (one per detected hand)
    is_gesture_list: list of bools (True = middle finger detected for that hand)
    """
    if not cv2 or frame is None:
        return
    h, w = frame.shape[:2]

    for hand_idx, (hand_lms, is_gest) in enumerate(zip(landmarks_list, is_gesture_list)):
        pts = [(int(lm.x * w), int(lm.y * h)) for lm in hand_lms]

        # Draw skeleton connections
        for (a, b) in _HAND_CONNECTIONS:
            if a >= len(pts) or b >= len(pts):
                continue
            if (a, b) in _MIDDLE_CONNECTIONS or (b, a) in _MIDDLE_CONNECTIONS:
                # Middle finger segment — bright colour based on detection
                color = (0, 80, 255) if is_gest else (0, 255, 120)
                thickness = 4
            else:
                color = (160, 160, 160)
                thickness = 2
            cv2.line(frame, pts[a], pts[b], color, thickness, cv2.LINE_AA)

        # Draw joint dots
        for idx, pt in enumerate(pts):
            if idx in _MIDDLE_FINGER_IDS:
                dot_color = (0, 60, 255) if is_gest else (0, 230, 90)
                radius = 7 if idx == 12 else 5   # tip is larger
            else:
                dot_color = (200, 200, 200)
                radius = 4
            cv2.circle(frame, pt, radius, dot_color, -1, cv2.LINE_AA)
            cv2.circle(frame, pt, radius + 1, (0, 0, 0), 1, cv2.LINE_AA)  # outline

        # Label at wrist
        label = "🖕 DETECTED" if is_gest else f"Hand {hand_idx + 1}"
        lbl_color = (0, 60, 255) if is_gest else (200, 200, 200)
        wrist_pt = pts[0] if pts else (10, 30)
        cv2.putText(frame, label, (wrist_pt[0] + 8, wrist_pt[1] - 8),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, lbl_color, 2, cv2.LINE_AA)


def is_middle_finger_gesture(landmarks, sensitivity=100):
    """
    Evaluates whether the 21 normalized landmarks represent a middle finger gesture.
    sensitivity: int from 1 to 100 (default 100).
    Formula remapped so slider=100 equals old neutral midpoint (factor=1.0),
    making the full range 2x more permissive than before.
    Higher sensitivity = easier to trigger; lower = stricter.
    """
    def dist(i, j):
        dx = landmarks[i].x - landmarks[j].x
        dy = landmarks[i].y - landmarks[j].y
        dz = landmarks[i].z - landmarks[j].z
        return math.sqrt(dx*dx + dy*dy + dz*dz)

    # Remap: slider 100 → factor 1.0 (old neutral at slider=50)
    # slider 200 would be factor 2.0, but UI caps at 100 → factor max 1.0
    # This makes 100% effectively the old 50% midpoint, much easier by default
    factor = max(1, min(100, int(sensitivity))) / 100.0

    # Sensitivity ratio adjustments
    # factor=1.0 at slider=100 (very permissive), factor~0 at slider=1 (very strict)
    ext_mcp_ratio = max(1.05, 1.45 - factor * 0.35)   # 1.45 strict → 1.10 permissive
    ext_pip_ratio = max(1.02, 1.20 - factor * 0.18)   # 1.20 strict → 1.02 permissive
    curl_mcp_ratio = min(1.80, 1.10 + factor * 0.70)  # 1.10 strict → 1.80 permissive
    sep_ratio = max(1.05, 1.35 - factor * 0.30)       # 1.35 strict → 1.05 permissive

    # 0 = Wrist
    # MCPs: Index=5, Middle=9, Ring=13, Pinky=17
    # PIPs: Index=6, Middle=10, Ring=14, Pinky=18
    # Tips: Thumb=4, Index=8, Middle=12, Ring=16, Pinky=20

    d_wrist_middle_tip = dist(0, 12)
    d_wrist_middle_mcp = dist(0, 9)
    d_wrist_middle_pip = dist(0, 10)

    # 1. Middle finger must be extended
    if d_wrist_middle_tip < d_wrist_middle_mcp * ext_mcp_ratio:
        return False
    if d_wrist_middle_tip < d_wrist_middle_pip * ext_pip_ratio:
        return False

    # 2. Index finger must be folded
    d_wrist_index_tip = dist(0, 8)
    d_wrist_index_mcp = dist(0, 5)
    if d_wrist_index_tip > d_wrist_index_mcp * curl_mcp_ratio:
        return False

    # 3. Ring finger must be folded
    d_wrist_ring_tip = dist(0, 16)
    d_wrist_ring_mcp = dist(0, 13)
    if d_wrist_ring_tip > d_wrist_ring_mcp * curl_mcp_ratio:
        return False

    # 4. Pinky finger must be folded
    d_wrist_pinky_tip = dist(0, 20)
    d_wrist_pinky_mcp = dist(0, 17)
    if d_wrist_pinky_tip > d_wrist_pinky_mcp * curl_mcp_ratio:
        return False

    # 5. Middle finger must noticeably surpass Index and Ring fingers
    if d_wrist_middle_tip < d_wrist_index_tip * sep_ratio:
        return False
    if d_wrist_middle_tip < d_wrist_ring_tip * sep_ratio:
        return False

    return True


class CameraGestureService:
    """
    Combined Live Webcam Capture & Gesture Recognition Service.
    - Captures continuous frames at up to 30 FPS.
    - Encodes and caches JPEG stream for client remote viewing & local server UI preview.
    - Evaluates MediaPipe HandLandmarker for middle-finger sad-face reaction.
    """
    def __init__(self, on_middle_finger=None, on_frame=None, log_callback=None, sensitivity=100):
        self.on_middle_finger = on_middle_finger
        self.on_frame = on_frame
        self.log = log_callback or (lambda msg: None)
        self.is_running = False
        self.thread = None

        self.gesture_enabled = True
        self.sensitivity = max(1, min(100, int(sensitivity)))
        self.last_trigger_time = 0.0
        self.cooldown_seconds = 3.5

        # Latest hand landmark annotation state (updated at inference rate, drawn at frame rate)
        self._last_landmarks_list = []
        self._last_gesture_list = []

        # Streaming cache & stats
        self._lock = threading.Lock()
        self.latest_bgr = None
        self.latest_jpeg = None
        self.latest_timestamp = 0.0
        self.frame_width = 0
        self.frame_height = 0
        self.measured_fps = 0.0
        self.is_camera_connected = False

    def start(self):
        if self.is_running:
            return
        self.is_running = True
        self.thread = threading.Thread(target=self._worker, daemon=True)
        self.thread.start()
        self.log(f"[CAMERA/GESTURE] Live camera service started (sensitivity: {self.sensitivity}%).")

    def stop(self):
        self.is_running = False
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=1.5)
        with self._lock:
            self.is_camera_connected = False
        self.log("[CAMERA/GESTURE] Live camera service stopped.")

    def set_sensitivity(self, val):
        try:
            self.sensitivity = max(1, min(100, int(val)))
            self.log(f"[GESTURE] Sensitivity updated to {self.sensitivity}%.")
        except (ValueError, TypeError):
            pass

    def get_latest_jpeg(self):
        """Returns (bytes_or_none, timestamp) of the latest camera frame."""
        with self._lock:
            return self.latest_jpeg, self.latest_timestamp

    def get_status(self):
        """Returns camera stream and gesture status dict."""
        with self._lock:
            return {
                "active": self.is_camera_connected,
                "width": self.frame_width,
                "height": self.frame_height,
                "fps": round(self.measured_fps, 1),
                "gesture_enabled": self.gesture_enabled,
                "sensitivity": self.sensitivity
            }

    def _worker(self):
        if not cv2:
            self.log("[CAMERA ERROR] OpenCV (cv2) not available. Camera disabled.")
            return

        detector = None
        if mp:
            model_path = get_hand_model_path()
            if model_path and os.path.exists(model_path):
                try:
                    base_options = python.BaseOptions(model_asset_path=model_path)
                    options = vision.HandLandmarkerOptions(
                        base_options=base_options,
                        num_hands=2,
                        min_hand_detection_confidence=0.5,
                        min_hand_presence_confidence=0.5
                    )
                    detector = vision.HandLandmarker.create_from_options(options)
                except Exception as e:
                    self.log(f"[GESTURE ERROR] MediaPipe HandLandmarker init error: {e}")
            else:
                self.log(f"[GESTURE ERROR] hand_landmarker.task model not found.")

        cap = None
        last_infer_time = 0.0
        frame_counter = 0
        fps_timer = time.time()

        while self.is_running:
            # 1. Connect or reconnect to webcam
            if cap is None or not cap.isOpened():
                with self._lock:
                    self.is_camera_connected = False
                for cam_idx in (0, 1, 2):
                    try:
                        c = cv2.VideoCapture(cam_idx)
                        if c.isOpened():
                            ret, probe_f = c.read()
                            if ret and probe_f is not None:
                                cap = c
                                h, w = probe_f.shape[:2]
                                with self._lock:
                                    self.frame_width = w
                                    self.frame_height = h
                                    self.is_camera_connected = True
                                self.log(f"[CAMERA] Connected to camera {cam_idx} ({w}x{h}).")
                                break
                            c.release()
                    except Exception:
                        pass

                if cap is None or not cap.isOpened():
                    time.sleep(2.5)
                    continue

            # 2. Read frame
            try:
                ret, frame = cap.read()
                if not ret or frame is None:
                    cap.release()
                    cap = None
                    with self._lock:
                        self.is_camera_connected = False
                    time.sleep(1.0)
                    continue

                now = time.time()
                frame_counter += 1
                if now - fps_timer >= 1.0:
                    self.measured_fps = frame_counter / (now - fps_timer)
                    frame_counter = 0
                    fps_timer = now

                # 3. Gesture Detection (Throttled to ~8 FPS for optimal CPU)
                if self.gesture_enabled and detector and (now - last_infer_time >= 0.12):
                    last_infer_time = now
                    try:
                        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
                        result = detector.detect(mp_image)

                        new_lm_list = []
                        new_gest_list = []
                        triggered = False

                        if result and result.hand_landmarks:
                            for hand_landmarks in result.hand_landmarks:
                                is_gest = is_middle_finger_gesture(hand_landmarks, sensitivity=self.sensitivity)
                                new_lm_list.append(hand_landmarks)
                                new_gest_list.append(is_gest)
                                if is_gest and not triggered:
                                    if now - self.last_trigger_time >= self.cooldown_seconds:
                                        triggered = True
                                        self.last_trigger_time = now
                                        self.log("[GESTURE] Middle finger detected! Triggering sad face.")
                                        if self.on_middle_finger:
                                            try:
                                                self.on_middle_finger()
                                            except Exception as ex:
                                                self.log(f"[GESTURE ERROR] Callback error: {ex}")

                        self._last_landmarks_list = new_lm_list
                        self._last_gesture_list = new_gest_list
                    except Exception:
                        pass

                # Annotate frame with hand skeleton overlay (uses cached landmarks at full 30 FPS)
                display_frame = frame.copy()
                if self._last_landmarks_list:
                    _draw_hand_overlay(display_frame, self._last_landmarks_list, self._last_gesture_list)

                # Encode annotated JPEG for streaming
                success, encoded_jpg = cv2.imencode('.jpg', display_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 75])
                jpg_bytes = encoded_jpg.tobytes() if success else None

                with self._lock:
                    self.latest_bgr = display_frame
                    self.latest_jpeg = jpg_bytes
                    self.latest_timestamp = now
                    self.is_camera_connected = True

                # Notify GUI callback for live preview (annotated frame)
                if self.on_frame:
                    try:
                        self.on_frame(display_frame)
                    except Exception:
                        pass

            except Exception as e:
                time.sleep(0.05)

            # Cap frame loop at ~30 FPS
            time.sleep(0.03)

        if cap and cap.isOpened():
            cap.release()
        with self._lock:
            self.is_camera_connected = False
