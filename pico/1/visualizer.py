import sys
import time
import math
import pygame
import serial
import serial.tools.list_ports

# Configuration
BAUD_RATE = 115200
WIN_WIDTH = 800
WIN_HEIGHT = 600

# Colors
BG_COLOR = (15, 17, 26)
PANEL_BG = (26, 29, 45)
GRID_COLOR = (45, 52, 75)
TEXT_COLOR = (220, 225, 240)
ACCENT_BLUE = (0, 180, 255)
ACCENT_GREEN = (0, 230, 140)
ACCENT_RED = (255, 75, 90)
BUTTON_PRESSED_COLOR = (255, 180, 0)

def find_pico_port():
    """Auto-detect connected Raspberry Pi Pico serial port."""
    ports = serial.tools.list_ports.comports()
    for port in ports:
        # Common Pico VID/PID or serial descriptions
        if "2E8A" in port.hwid.upper() or "Pico" in port.description or "Serial" in port.description:
            return port.device
    return ports[0].device if ports else None

def main():
    pygame.init()
    pygame.font.init()
    
    screen = pygame.display.set_mode((WIN_WIDTH, WIN_HEIGHT))
    pygame.display.set_caption("Raspberry Pi Pico - Joystick Visualizer")
    clock = pygame.time.Clock()
    
    font_large = pygame.font.SysFont("Segoe UI", 24, bold=True)
    font_small = pygame.font.SysFont("Segoe UI", 16)
    font_mono = pygame.font.SysFont("Consolas", 18)

    port = find_pico_port()
    ser = None
    
    if port:
        try:
            ser = serial.Serial(port, BAUD_RATE, timeout=0.05)
            print(f"Connected to Pico on {port}")
        except Exception as e:
            print(f"Could not open port {port}: {e}")

    # Joystick State Variables
    x_val = 32768
    y_val = 32768
    button_pressed = False
    
    # Smooth animated values for visual rendering
    smooth_x = 32768.0
    smooth_y = 32768.0

    # Grid / Visualizer dimensions
    center_x = WIN_WIDTH // 2
    center_y = WIN_HEIGHT // 2 - 20
    radius = 180

    running = True
    while running:
        # Handle Events
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_ESCAPE:
                    running = False

        # Read Serial Data from Pico
        if ser and ser.is_open and ser.in_waiting > 0:
            try:
                line = ser.readline().decode('utf-8', errors='ignore').strip()
                if line:
                    parts = line.split(',')
                    if len(parts) == 3:
                        x_val = int(parts[0])
                        y_val = int(parts[1])
                        button_pressed = bool(int(parts[2]))
            except Exception:
                pass

        # Smooth interpolation for stick movement (Lerp)
        smooth_x += (x_val - smooth_x) * 0.3
        smooth_y += (y_val - smooth_y) * 0.3

        # Clear Background
        screen.fill(BG_COLOR)

        # Title Card
        title_surface = font_large.render("Pico Joystick 2D Visualizer", True, TEXT_COLOR)
        screen.blit(title_surface, (30, 25))
        
        status_str = f"Status: Connected ({port})" if ser and ser.is_open else "Status: Simulation / Searching Port..."
        status_color = ACCENT_GREEN if ser and ser.is_open else ACCENT_RED
        status_surface = font_small.render(status_str, True, status_color)
        screen.blit(status_surface, (30, 60))

        # Render Main Boundary Circle
        pygame.draw.circle(screen, PANEL_BG, (center_x, center_y), radius)
        pygame.draw.circle(screen, GRID_COLOR, (center_x, center_y), radius, 2)
        pygame.draw.circle(screen, GRID_COLOR, (center_x, center_y), radius // 2, 1)

        # Draw Crosshair Axes
        pygame.draw.line(screen, GRID_COLOR, (center_x - radius, center_y), (center_x + radius, center_y), 1)
        pygame.draw.line(screen, GRID_COLOR, (center_x, center_y - radius), (center_x, center_y + radius), 1)

        # Map ADC values (0 to 65535) to Screen Coordinates
        # Standard Joystick: X maps Left->Right, Y maps Up->Down (ADC 0 top/left to 65535 bottom/right)
        norm_x = (smooth_x - 32768) / 32768.0
        norm_y = (smooth_y - 32768) / 32768.0
        
        # Clamp within circle
        stick_pos_x = int(center_x + norm_x * radius)
        stick_pos_y = int(center_y + norm_y * radius)

        # Draw Direction Vector Line
        pygame.draw.line(screen, ACCENT_BLUE, (center_x, center_y), (stick_pos_x, stick_pos_y), 3)

        # Draw Joystick Puck Indicator
        puck_color = BUTTON_PRESSED_COLOR if button_pressed else ACCENT_BLUE
        puck_radius = 24 if button_pressed else 18
        pygame.draw.circle(screen, puck_color, (stick_pos_x, stick_pos_y), puck_radius)
        pygame.draw.circle(screen, TEXT_COLOR, (stick_pos_x, stick_pos_y), puck_radius, 2)

        # Draw Data Dashboard Box (Bottom Panel)
        dash_rect = pygame.Rect(50, WIN_HEIGHT - 110, WIN_WIDTH - 100, 80)
        pygame.draw.rect(screen, PANEL_BG, dash_rect, border_radius=10)
        pygame.draw.rect(screen, GRID_COLOR, dash_rect, 2, border_radius=10)

        # Compute percentages & angles
        pct_x = int((x_val / 65535.0) * 100)
        pct_y = int((y_val / 65535.0) * 100)
        angle = math.degrees(math.atan2(-norm_y, norm_x)) % 360

        # Render Telemetry Metrics
        metric_x = font_mono.render(f"X ADC: {x_val:5d} ({pct_x:3d}%)", True, TEXT_COLOR)
        metric_y = font_mono.render(f"Y ADC: {y_val:5d} ({pct_y:3d}%)", True, TEXT_COLOR)
        metric_angle = font_mono.render(f"Angle: {angle:5.1f}°", True, TEXT_COLOR)
        
        btn_text = "PRESSED" if button_pressed else "RELEASED"
        btn_color = BUTTON_PRESSED_COLOR if button_pressed else TEXT_COLOR
        metric_btn = font_mono.render(f"Switch: {btn_text}", True, btn_color)

        screen.blit(metric_x, (80, WIN_HEIGHT - 95))
        screen.blit(metric_y, (80, WIN_HEIGHT - 65))
        screen.blit(metric_angle, (330, WIN_HEIGHT - 95))
        screen.blit(metric_btn, (330, WIN_HEIGHT - 65))

        pygame.display.flip()
        clock.tick(60)

    if ser and ser.is_open:
        ser.close()
    pygame.quit()
    sys.exit()

if __name__ == "__main__":
    main()
