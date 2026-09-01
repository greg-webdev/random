#include "raylib.h"
#include "include/common.hpp"
#include "include/simulation.hpp"
#include "include/ui_renderer.hpp"

int main() {
    // Enable borderless custom window for authentic Windows 7 Aero titlebar
    SetConfigFlags(FLAG_WINDOW_UNDECORATED | FLAG_MSAA_4X_HINT | FLAG_VSYNC_HINT);
    InitWindow(SCREEN_WIDTH, SCREEN_HEIGHT, "Maze AI Simulation - High Performance C++ (Raylib)");

    SetTargetFPS(60);

    Simulation simulation;
    UIRenderer ui_renderer;

    int sim_speed_multiplier = 1;

    while (!WindowShouldClose()) {
        // Keyboard controls
        if (IsKeyPressed(KEY_SPACE)) {
            // Cycle simulation speed: 1x -> 2x -> 5x -> 10x -> 1x
            if (sim_speed_multiplier == 1) sim_speed_multiplier = 2;
            else if (sim_speed_multiplier == 2) sim_speed_multiplier = 5;
            else if (sim_speed_multiplier == 5) sim_speed_multiplier = 10;
            else sim_speed_multiplier = 1;
        }

        // Handle UI button clicks, Windows 7 Aero caption controls, and hotkeys
        if (ui_renderer.handle_input(simulation)) {
            break;
        }

        // Update simulation steps based on active mode
        if (ui_renderer.is_headless_training) {
            // High-speed headless training: 50x simulation steps per frame
            for (int step = 0; step < 50; ++step) {
                simulation.update();
            }
        } else if (ui_renderer.is_slowmo) {
            // 120 FPS high refresh rate slowed down: update physics every 4th frame (0.25x speed)
            static int slowmo_tick_counter = 0;
            if (++slowmo_tick_counter % 4 == 0) {
                simulation.update();
            }
        } else {
            // Normal simulation speed with speed multiplier
            for (int step = 0; step < sim_speed_multiplier; ++step) {
                simulation.update();
            }
        }

        // Render Frame
        BeginDrawing();
        ClearBackground(Color{16, 18, 24, 255});

        ui_renderer.draw(simulation);

        // Render FPS and Speed indicator with Twentieth Century font
        DrawFPS(SCREEN_WIDTH - 90, SCREEN_HEIGHT - 24);
        if (ui_renderer.is_headless_training) {
            draw_tw_text("TRAINING: 50X SPEED (~3,000 TPS)", SCREEN_WIDTH - 360.0f, SCREEN_HEIGHT - 24.0f, 13.0f, Color{255, 100, 40, 240}, true);
        } else if (ui_renderer.is_slowmo) {
            draw_tw_text("SLOW-MO: 120 FPS (0.25X SPEED)", SCREEN_WIDTH - 320.0f, SCREEN_HEIGHT - 24.0f, 13.0f, Color{255, 200, 50, 240}, true);
        } else if (sim_speed_multiplier > 1) {
            char speed_buf[32];
            std::snprintf(speed_buf, sizeof(speed_buf), "SPEED: %dx", sim_speed_multiplier);
            draw_tw_text(speed_buf, SCREEN_WIDTH - 200.0f, SCREEN_HEIGHT - 24.0f, 14.0f, Color{255, 215, 0, 240}, true);
        }

        EndDrawing();
    }

    CloseWindow();
    return 0;
}
