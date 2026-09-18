import tkinter as tk
import time

class SadFaceOverlay(tk.Toplevel):
    """Fullscreen 2-second Sad Face Reaction Window."""
    def __init__(self, master=None, duration=2.0):
        super().__init__(master)
        self.duration = duration

        self.title("Sad Face Reaction")
        self.attributes("-fullscreen", True)
        self.attributes("-topmost", True)
        self.configure(bg="#0b0f19", cursor="none")
        self.focus_force()

        # Block closing
        self.protocol("WM_DELETE_WINDOW", lambda: None)
        self.bind("<Key>", lambda e: "break")
        self.bind("<Button-1>", lambda e: "break")

        sw = self.winfo_screenwidth()
        sh = self.winfo_screenheight()

        canvas = tk.Canvas(self, bg="#0b0f19", highlightthickness=0, width=sw, height=sh)
        canvas.pack(fill=tk.BOTH, expand=True)

        cx, cy = sw // 2, sh // 2
        r = min(sw, sh) // 4

        # Face circle
        canvas.create_oval(cx - r, cy - r, cx + r, cy + r, outline="#38bdf8", width=8, fill="#0f172a")

        # Sad Eyes
        eye_r = r // 5
        eye_y = cy - r // 3
        # Left eye
        canvas.create_oval(cx - r//2 - eye_r, eye_y - eye_r, cx - r//2 + eye_r, eye_y + eye_r, fill="#38bdf8", outline="")
        # Right eye
        canvas.create_oval(cx + r//2 - eye_r, eye_y - eye_r, cx + r//2 + eye_r, eye_y + eye_r, fill="#38bdf8", outline="")

        # Tear drop on left eye
        tear_x = cx - r//2 + eye_r//2
        tear_y = eye_y + eye_r * 2
        canvas.create_polygon(
            tear_x, tear_y - 15,
            tear_x + 10, tear_y + 10,
            tear_x, tear_y + 15,
            tear_x - 10, tear_y + 10,
            fill="#60a5fa", outline=""
        )

        # Sad downturned mouth (arc)
        mouth_r = r // 2
        mouth_y = cy + r // 6
        canvas.create_arc(
            cx - mouth_r, mouth_y,
            cx + mouth_r, mouth_y + mouth_r * 1.4,
            start=30, extent=120,
            style="arc", outline="#38bdf8", width=10
        )

        # Subtitle
        canvas.create_text(
            cx, cy + r + 60,
            text=":( Why so mean?",
            font=("Segoe UI", 28, "bold"),
            fill="#94a3b8"
        )

        # Auto-destroy after duration
        self.after(int(duration * 1000), self._auto_close)

    def _auto_close(self):
        try:
            self.destroy()
        except Exception:
            pass

if __name__ == "__main__":
    root = tk.Tk()
    root.withdraw()
    overlay = SadFaceOverlay(root, duration=2.0)
    root.after(2200, root.destroy)
    root.mainloop()
    print("SadFaceOverlay test completed cleanly!")
