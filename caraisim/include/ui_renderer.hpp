#pragma once
#include <string>
#include <vector>
#include <cstdio>
#include <cmath>
#include "common.hpp"
#include "simulation.hpp"
#include "file_dialog.hpp"
#include "rlgl.h"

// Twentieth Century Font Global Handles
inline Font g_font_tw_cen;
inline Font g_font_tw_cen_bold;
inline bool g_font_loaded = false;

inline void init_twentieth_century_font() {
    if (g_font_loaded) return;

    if (FileExists("fonts/tw_century.ttf")) {
        g_font_tw_cen = LoadFontEx("fonts/tw_century.ttf", 48, NULL, 250);
    } else if (FileExists("C:\\Windows\\Fonts\\TCM_____.TTF")) {
        g_font_tw_cen = LoadFontEx("C:\\Windows\\Fonts\\TCM_____.TTF", 48, NULL, 250);
    } else {
        g_font_tw_cen = GetFontDefault();
    }

    if (FileExists("fonts/tw_century_bold.ttf")) {
        g_font_tw_cen_bold = LoadFontEx("fonts/tw_century_bold.ttf", 48, NULL, 250);
    } else if (FileExists("C:\\Windows\\Fonts\\TCB_____.TTF")) {
        g_font_tw_cen_bold = LoadFontEx("C:\\Windows\\Fonts\\TCB_____.TTF", 48, NULL, 250);
    } else {
        g_font_tw_cen_bold = g_font_tw_cen;
    }

    SetTextureFilter(g_font_tw_cen.texture, TEXTURE_FILTER_BILINEAR);
    SetTextureFilter(g_font_tw_cen_bold.texture, TEXTURE_FILTER_BILINEAR);
    g_font_loaded = true;
}

inline void draw_tw_text(const char* text, float x, float y, float size, Color color, bool bold = false) {
    if (!g_font_loaded) init_twentieth_century_font();
    Font f = bold ? g_font_tw_cen_bold : g_font_tw_cen;
    DrawTextEx(f, text, { x, y }, size, 1.0f, color);
}

inline float measure_tw_text(const char* text, float size, bool bold = false) {
    if (!g_font_loaded) init_twentieth_century_font();
    Font f = bold ? g_font_tw_cen_bold : g_font_tw_cen;
    Vector2 dim = MeasureTextEx(f, text, size, 1.0f);
    return dim.x;
}

struct Button {
    Rectangle rect;
    std::string text;
    bool hovered;
    bool clicked;
    Color custom_bg{0, 0, 0, 0};

    Button(float x, float y, float w, float h, const std::string& t, Color bg = {0, 0, 0, 0})
        : rect{x, y, w, h}, text(t), hovered(false), clicked(false), custom_bg(bg) {}

    void update(Vector2 mouse_pos, bool mouse_pressed) {
        hovered = CheckCollisionPointRec(mouse_pos, rect);
        clicked = hovered && mouse_pressed;
    }

    void draw(float font_size = 12.0f, bool bold = false) const {
        Color bg_color = (custom_bg.a > 0) ? custom_bg : (hovered ? Color{55, 65, 90, 255} : Color{30, 35, 50, 255});
        if (hovered && custom_bg.a > 0) {
            bg_color = Color{ static_cast<unsigned char>(std::min(255, custom_bg.r + 30)),
                              static_cast<unsigned char>(std::min(255, custom_bg.g + 30)),
                              static_cast<unsigned char>(std::min(255, custom_bg.b + 30)), 255 };
        }
        Color border_color = hovered ? Color{100, 160, 255, 255} : Color{60, 70, 95, 255};
        DrawRectangleRounded(rect, 0.25f, 4, bg_color);
        DrawRectangleRoundedLines(rect, 0.25f, 4, 1.2f, border_color);

        float text_w = measure_tw_text(text.c_str(), font_size, bold);
        float text_x = rect.x + (rect.width - text_w) * 0.5f;
        float text_y = rect.y + (rect.height - font_size) * 0.5f - 1.0f;
        draw_tw_text(text.c_str(), text_x, text_y, font_size, hovered ? Color{255, 255, 255, 255} : Color{215, 225, 245, 255}, bold);
    }
};

struct Win7CaptionButtons {
    Rectangle rect_min{ 1195.0f, 0.0f, 38.0f, 28.0f };
    Rectangle rect_close{ 1233.0f, 0.0f, 47.0f, 28.0f };
    bool min_hovered{ false };
    bool close_hovered{ false };

    int update(Vector2 mouse, bool pressed) {
        min_hovered = CheckCollisionPointRec(mouse, rect_min);
        close_hovered = CheckCollisionPointRec(mouse, rect_close);

        if (min_hovered && pressed) return 1;
        if (close_hovered && pressed) return 2;
        return 0;
    }

    void draw() const {
        Color min_bg = min_hovered ? Color{65, 160, 245, 220} : Color{45, 85, 135, 120};
        Color min_border = min_hovered ? Color{150, 220, 255, 240} : Color{80, 120, 170, 140};
        DrawRectangleRec(rect_min, min_bg);
        DrawRectangleLinesEx(rect_min, 1.0f, min_border);

        DrawRectangle(static_cast<int>(rect_min.x + 1), static_cast<int>(rect_min.y + 1), 
                      static_cast<int>(rect_min.width - 2), 12, 
                      Color{255, 255, 255, min_hovered ? (unsigned char)110 : (unsigned char)45});
        DrawLine(static_cast<int>(rect_min.x + 1), static_cast<int>(rect_min.y + 1), 
                 static_cast<int>(rect_min.x + rect_min.width - 2), static_cast<int>(rect_min.y + 1), 
                 Color{255, 255, 255, min_hovered ? (unsigned char)220 : (unsigned char)120});

        DrawRectangle(static_cast<int>(rect_min.x + 14), static_cast<int>(rect_min.y + 18), 10, 2, Color{255, 255, 255, 250});

        Color close_bg = close_hovered ? Color{230, 40, 40, 255} : Color{170, 45, 45, 140};
        Color close_border = close_hovered ? Color{255, 160, 160, 255} : Color{195, 80, 80, 160};
        DrawRectangleRec(rect_close, close_bg);
        DrawRectangleLinesEx(rect_close, 1.0f, close_border);

        DrawRectangle(static_cast<int>(rect_close.x + 1), static_cast<int>(rect_close.y + 1), 
                      static_cast<int>(rect_close.width - 2), 12, 
                      Color{255, 255, 255, close_hovered ? (unsigned char)120 : (unsigned char)50});
        DrawLine(static_cast<int>(rect_close.x + 1), static_cast<int>(rect_close.y + 1), 
                 static_cast<int>(rect_close.x + rect_close.width - 2), static_cast<int>(rect_close.y + 1), 
                 Color{255, 255, 255, close_hovered ? (unsigned char)240 : (unsigned char)140});

        Vector2 c_p1 = { rect_close.x + 18.0f, rect_close.y + 9.0f };
        Vector2 c_p2 = { rect_close.x + 29.0f, rect_close.y + 20.0f };
        Vector2 c_p3 = { rect_close.x + 29.0f, rect_close.y + 9.0f };
        Vector2 c_p4 = { rect_close.x + 18.0f, rect_close.y + 20.0f };
        DrawLineEx(c_p1, c_p2, 2.0f, Color{255, 255, 255, 255});
        DrawLineEx(c_p3, c_p4, 2.0f, Color{255, 255, 255, 255});
    }
};

enum EditorTool {
    TOOL_BRUSH_WALL,
    TOOL_BRUSH_ERASER,
    TOOL_START,
    TOOL_GOAL
};

struct KillEffect {
    Vector2 pos;
    float timer;
};

class UIRenderer {
public:
    Win7CaptionButtons win7_buttons;
    Button btn_editor;
    Button btn_spinner;
    Button btn_headless;
    Button btn_slowmo;
    Button btn_follow_mode;
    Button btn_view_mode;
    Button btn_import;
    Button btn_export;

    // Drawing Page Buttons
    Button btn_go;
    Button btn_tool_brush_wall;
    Button btn_tool_brush_erase;
    Button btn_tool_start;
    Button btn_tool_goal;
    Button btn_brush_small;
    Button btn_brush_med;
    Button btn_brush_large;
    Button btn_clear_canvas;
    Button btn_gen_maze;
    Button btn_save_map;
    Button btn_load_map;
    Button btn_car_size_minus;
    Button btn_car_size_plus;

    bool is_3d_mode;
    bool follow_best_mode;
    bool is_slowmo;
    bool is_headless_training;
    bool is_map_editor_mode;
    EditorTool current_tool;
    float current_brush_radius;
    Vector2 last_draw_pos;
    bool is_drawing_stroke;

    std::vector<KillEffect> kill_effects;

    Camera3D camera;
    Vector3 cam_target;
    float cam_yaw;
    float cam_pitch;
    float cam_dist;
    float follow_dist;
    float follow_yaw_offset;

    UIRenderer()
        // Header Toolbar: 810px to 1272px cleanly spaced
        : btn_editor(810.0f, 35.0f, 52.0f, 24.0f, "DRAW"),
          btn_spinner(866.0f, 35.0f, 68.0f, 24.0f, "SPINNER", Color{170, 70, 0, 200}),
          btn_headless(938.0f, 35.0f, 46.0f, 24.0f, "50X"),
          btn_slowmo(988.0f, 35.0f, 56.0f, 24.0f, "SLOW"),
          btn_follow_mode(1048.0f, 35.0f, 64.0f, 24.0f, "FOLLOW"),
          btn_view_mode(1116.0f, 35.0f, 46.0f, 24.0f, "3D"),
          btn_import(1166.0f, 35.0f, 50.0f, 24.0f, "IMP"),
          btn_export(1220.0f, 35.0f, 52.0f, 24.0f, "EXP"),
          // Drawing Page Specific Buttons:
          btn_go(815.0f, 64.0f, 450.0f, 36.0f, "▶ GO! (LET CARS RACE)", Color{0, 160, 70, 255}),
          btn_tool_brush_wall(815.0f, 108.0f, 106.0f, 26.0f, "🟡 WALL", Color{180, 150, 0, 220}),
          btn_tool_brush_erase(929.0f, 108.0f, 106.0f, 26.0f, "⬛ ERASE"),
          btn_tool_start(1043.0f, 108.0f, 106.0f, 26.0f, "🎯 START", Color{0, 120, 200, 220}),
          btn_tool_goal(1157.0f, 108.0f, 108.0f, 26.0f, "🏆 GOAL", Color{200, 80, 0, 220}),
          btn_brush_small(815.0f, 142.0f, 50.0f, 24.0f, "8px"),
          btn_brush_med(870.0f, 142.0f, 50.0f, 24.0f, "16px"),
          btn_brush_large(925.0f, 142.0f, 50.0f, 24.0f, "28px"),
          btn_clear_canvas(983.0f, 142.0f, 85.0f, 24.0f, "CLEAR"),
          btn_gen_maze(1074.0f, 142.0f, 92.0f, 24.0f, "GEN MAZE"),
          btn_save_map(815.0f, 174.0f, 105.0f, 26.0f, "💾 SAVE MAP"),
          btn_load_map(928.0f, 174.0f, 105.0f, 26.0f, "📂 LOAD MAP"),
          btn_car_size_minus(1178.0f, 174.0f, 38.0f, 26.0f, "-"),
          btn_car_size_plus(1224.0f, 174.0f, 38.0f, 26.0f, "+"),
          is_3d_mode(false),
          follow_best_mode(false),
          is_slowmo(false),
          is_headless_training(false),
          is_map_editor_mode(false),
          current_tool(TOOL_BRUSH_WALL),
          current_brush_radius(14.0f),
          last_draw_pos{ 0.0f, 0.0f },
          is_drawing_stroke(false),
          cam_target{ 0.0f, 0.0f, 0.0f },
          cam_yaw(45.0f),
          cam_pitch(42.0f),
          cam_dist(68.0f),
          follow_dist(14.0f),
          follow_yaw_offset(0.0f) {
        init_twentieth_century_font();
        camera = { 0 };
        camera.position = { 0.0f, 50.0f, 50.0f };
        camera.target = { 0.0f, 0.0f, 0.0f };
        camera.up = { 0.0f, 1.0f, 0.0f };
        camera.fovy = 45.0f;
        camera.projection = CAMERA_PERSPECTIVE;
        update_camera_vectors();
    }

    void update_camera_vectors() {
        float rad_yaw = cam_yaw * DEG2RAD;
        float rad_pitch = cam_pitch * DEG2RAD;
        camera.target = cam_target;
        camera.position.x = cam_target.x + cam_dist * std::cos(rad_pitch) * std::sin(rad_yaw);
        camera.position.y = cam_target.y + cam_dist * std::sin(rad_pitch);
        camera.position.z = cam_target.z + cam_dist * std::cos(rad_pitch) * std::cos(rad_yaw);
        camera.up = { 0.0f, 1.0f, 0.0f };
    }

    bool handle_input(Simulation& sim) {
        Vector2 mouse = GetMousePosition();
        bool pressed = IsMouseButtonPressed(MOUSE_BUTTON_LEFT);

        if (poll_tray_restore_event()) {
            restore_window_from_tray(GetWindowHandle());
        }

        if (IsMouseButtonPressed(MOUSE_BUTTON_LEFT) && mouse.y < static_cast<float>(TITLEBAR_HEIGHT) && mouse.x < 1190.0f) {
            native_start_window_drag(GetWindowHandle());
        }

        int cap_res = win7_buttons.update(mouse, pressed);
        if (cap_res == 1) {
            if (is_headless_training) hide_window_to_tray(GetWindowHandle());
            else MinimizeWindow();
        } else if (cap_res == 2) {
            if (is_headless_training) hide_window_to_tray(GetWindowHandle());
            else return true;
        }

        btn_editor.update(mouse, pressed);
        btn_spinner.update(mouse, pressed);
        btn_headless.update(mouse, pressed);
        btn_slowmo.update(mouse, pressed);
        btn_follow_mode.update(mouse, pressed);
        btn_view_mode.update(mouse, pressed);
        btn_import.update(mouse, pressed);
        btn_export.update(mouse, pressed);

        if (btn_editor.clicked || IsKeyPressed(KEY_M)) {
            is_map_editor_mode = !is_map_editor_mode;
            btn_editor.text = is_map_editor_mode ? "RUN" : "DRAW";
            if (!is_map_editor_mode) {
                sim.apply_custom_map();
            }
        }

        if (btn_spinner.clicked || IsKeyPressed(KEY_P)) {
            sim.maze.spinner_mode = !sim.maze.spinner_mode;
            btn_spinner.text = sim.maze.spinner_mode ? "SURVIVING" : "SPINNER";
            btn_spinner.custom_bg = sim.maze.spinner_mode ? Color{220, 50, 0, 240} : Color{170, 70, 0, 200};
            if (sim.maze.spinner_mode) {
                sim.maze.setup_spinner_arena();
                sim.apply_custom_map();
            }
        }

        if (btn_headless.clicked || IsKeyPressed(KEY_H)) {
            is_headless_training = !is_headless_training;
            btn_headless.text = is_headless_training ? "MAZE" : "50X";
            if (is_headless_training) SetTargetFPS(60);
            else if (is_slowmo) SetTargetFPS(120);
            else SetTargetFPS(60);
        }

        if (btn_slowmo.clicked || IsKeyPressed(KEY_S)) {
            is_slowmo = !is_slowmo;
            btn_slowmo.text = is_slowmo ? "1X" : "SLOW";
            if (is_slowmo) SetTargetFPS(120);
            else SetTargetFPS(60);
        }

        if (btn_follow_mode.clicked || IsKeyPressed(KEY_F)) {
            follow_best_mode = !follow_best_mode;
            btn_follow_mode.text = follow_best_mode ? "FREE" : "FOLLOW";
            if (!follow_best_mode) update_camera_vectors();
        }

        if (btn_view_mode.clicked || IsKeyPressed(KEY_V)) {
            is_3d_mode = !is_3d_mode;
            btn_view_mode.text = is_3d_mode ? "2D" : "3D";
        }

        if (is_map_editor_mode) {
            btn_go.update(mouse, pressed);
            btn_tool_brush_wall.update(mouse, pressed);
            btn_tool_brush_erase.update(mouse, pressed);
            btn_tool_start.update(mouse, pressed);
            btn_tool_goal.update(mouse, pressed);
            btn_brush_small.update(mouse, pressed);
            btn_brush_med.update(mouse, pressed);
            btn_brush_large.update(mouse, pressed);
            btn_clear_canvas.update(mouse, pressed);
            btn_gen_maze.update(mouse, pressed);
            btn_save_map.update(mouse, pressed);
            btn_load_map.update(mouse, pressed);
            btn_car_size_minus.update(mouse, pressed);
            btn_car_size_plus.update(mouse, pressed);

            if (btn_go.clicked || IsKeyPressed(KEY_G)) {
                is_map_editor_mode = false;
                btn_editor.text = "DRAW";
                sim.apply_custom_map();
                std::cout << "[LAUNCH] Cars unleashed onto custom track!" << std::endl;
            }

            if (btn_tool_brush_wall.clicked) current_tool = TOOL_BRUSH_WALL;
            if (btn_tool_brush_erase.clicked) current_tool = TOOL_BRUSH_ERASER;
            if (btn_tool_start.clicked) current_tool = TOOL_START;
            if (btn_tool_goal.clicked) current_tool = TOOL_GOAL;

            if (btn_brush_small.clicked) current_brush_radius = 8.0f;
            if (btn_brush_med.clicked) current_brush_radius = 16.0f;
            if (btn_brush_large.clicked) current_brush_radius = 28.0f;

            if (btn_clear_canvas.clicked) {
                sim.maze.clear_free_canvas();
                sim.apply_custom_map();
            }
            if (btn_gen_maze.clicked) {
                sim.reset_maze();
            }

            if (btn_save_map.clicked) {
                std::string path = save_map_dialog();
                if (!path.empty()) {
                    sim.maze.save_to_file(path);
                    std::cout << "[MAP SAVED] to: " << path << std::endl;
                }
            }
            if (btn_load_map.clicked) {
                std::string path = open_map_dialog();
                if (!path.empty()) {
                    if (sim.maze.load_from_file(path)) {
                        sim.apply_custom_map();
                        std::cout << "[MAP LOADED] from: " << path << std::endl;
                    }
                }
            }

            if (btn_car_size_minus.clicked) g_car_scale = clampf(g_car_scale - 0.15f, 0.4f, 2.5f);
            if (btn_car_size_plus.clicked) g_car_scale = clampf(g_car_scale + 0.15f, 0.4f, 2.5f);

            if (mouse.x >= 0.0f && mouse.x < static_cast<float>(MAZE_WIDTH) && 
                mouse.y >= static_cast<float>(TITLEBAR_HEIGHT) && mouse.y < static_cast<float>(SCREEN_HEIGHT)) {
                Vector2 canvas_pos = { mouse.x, mouse.y - TITLEBAR_HEIGHT };

                if (IsMouseButtonPressed(MOUSE_BUTTON_LEFT) || IsMouseButtonPressed(MOUSE_BUTTON_RIGHT)) {
                    last_draw_pos = canvas_pos;
                    is_drawing_stroke = true;
                }

                if (IsMouseButtonDown(MOUSE_BUTTON_LEFT)) {
                    if (current_tool == TOOL_START) {
                        sim.maze.set_start_exact(canvas_pos);
                        sim.apply_custom_map();
                    } else if (current_tool == TOOL_GOAL) {
                        sim.maze.set_goal_exact(canvas_pos);
                        sim.apply_custom_map();
                    } else if (current_tool == TOOL_BRUSH_WALL) {
                        sim.maze.paint_stroke(last_draw_pos, canvas_pos, current_brush_radius, true);
                        last_draw_pos = canvas_pos;
                    } else if (current_tool == TOOL_BRUSH_ERASER) {
                        sim.maze.paint_stroke(last_draw_pos, canvas_pos, current_brush_radius, false);
                        last_draw_pos = canvas_pos;
                    }
                } else if (IsMouseButtonDown(MOUSE_BUTTON_RIGHT)) {
                    sim.maze.paint_stroke(last_draw_pos, canvas_pos, current_brush_radius, false);
                    last_draw_pos = canvas_pos;
                } else {
                    is_drawing_stroke = false;
                }
            }
        }

        // ================= CLICK-TO-KILL SYSTEM =================
        if (!is_headless_training && !is_map_editor_mode) {
            // 1. Direct Click-to-Kill on the 2D Arena Grid
            if (pressed && mouse.x >= 0.0f && mouse.x < static_cast<float>(MAZE_WIDTH) && 
                mouse.y >= static_cast<float>(TITLEBAR_HEIGHT) && mouse.y < static_cast<float>(SCREEN_HEIGHT)) {
                Vector2 click_arena = { mouse.x, mouse.y - TITLEBAR_HEIGHT };
                float closest_dist = 28.0f * g_car_scale;
                int kill_target = -1;

                for (int i = 0; i < POPULATION_SIZE; ++i) {
                    const auto& car = sim.population[i];
                    if (car.alive && !car.finished) {
                        float d = std::sqrt((car.pos.x - click_arena.x)*(car.pos.x - click_arena.x) + 
                                            (car.pos.y - click_arena.y)*(car.pos.y - click_arena.y));
                        if (d < closest_dist) {
                            closest_dist = d;
                            kill_target = i;
                        }
                    }
                }

                if (kill_target != -1) {
                    sim.population[kill_target].alive = false;
                    kill_effects.push_back({ { sim.population[kill_target].pos.x, sim.population[kill_target].pos.y + TITLEBAR_HEIGHT }, 1.0f });
                    std::cout << "[USER ACTION] ELIMINATED car #" << kill_target << " directly on the arena grid!" << std::endl;
                }
            }

            // 2. Click-to-Kill on the Population Matrix (Exact Matched Coordinates)
            const float grid_start_x = 815.0f;
            const float grid_start_y = static_cast<float>(TITLEBAR_HEIGHT + 64);
            const float grid_box_size = 20.0f;
            const float grid_pitch = 23.0f;
            const int grid_cols = 20;

            if (pressed && mouse.x >= grid_start_x && mouse.y >= grid_start_y) {
                for (int i = 0; i < POPULATION_SIZE; ++i) {
                    int col = i % grid_cols;
                    int row = i / grid_cols;
                    float bx = grid_start_x + col * grid_pitch;
                    float by = grid_start_y + row * grid_pitch;
                    Rectangle box_rec = { bx, by, grid_box_size, grid_box_size };
                    if (CheckCollisionPointRec(mouse, box_rec)) {
                        if (sim.population[i].alive && !sim.population[i].finished) {
                            sim.population[i].alive = false;
                            kill_effects.push_back({ { sim.population[i].pos.x, sim.population[i].pos.y + TITLEBAR_HEIGHT }, 1.0f });
                            std::cout << "[USER ACTION] ELIMINATED car #" << i << " via population matrix!" << std::endl;
                        }
                        break;
                    }
                }
            }
        }

        if (is_3d_mode && !is_headless_training && !is_map_editor_mode && mouse.x < static_cast<float>(MAZE_WIDTH) && mouse.y >= static_cast<float>(TITLEBAR_HEIGHT)) {
            if (IsMouseButtonDown(MOUSE_BUTTON_LEFT)) {
                Vector2 delta = GetMouseDelta();
                if (follow_best_mode) {
                    follow_yaw_offset -= delta.x * 0.4f;
                } else {
                    cam_yaw -= delta.x * 0.4f;
                    cam_pitch += delta.y * 0.4f;
                    cam_pitch = clampf(cam_pitch, 8.0f, 85.0f);
                }
            }

            if (IsMouseButtonDown(MOUSE_BUTTON_RIGHT) && !follow_best_mode) {
                Vector2 delta = GetMouseDelta();
                float rad_yaw = cam_yaw * DEG2RAD;
                Vector3 cam_right = { std::cos(rad_yaw), 0.0f, -std::sin(rad_yaw) };
                Vector3 cam_fwd = { -std::sin(rad_yaw), 0.0f, -std::cos(rad_yaw) };
                float pan_speed = cam_dist * 0.0018f;
                cam_target.x += (-cam_right.x * delta.x + cam_fwd.x * delta.y) * pan_speed;
                cam_target.z += (-cam_right.z * delta.x + cam_fwd.z * delta.y) * pan_speed;
            }

            float wheel = GetMouseWheelMove();
            if (wheel != 0.0f) {
                if (follow_best_mode) {
                    follow_dist -= wheel * 3.0f;
                    follow_dist = clampf(follow_dist, 3.5f, 75.0f);
                } else {
                    cam_dist -= wheel * 4.0f;
                    cam_dist = clampf(cam_dist, 15.0f, 150.0f);
                }
            }

            if (!follow_best_mode) update_camera_vectors();
        }

        if (btn_import.clicked) {
            std::string path = open_file_dialog();
            if (!path.empty()) sim.import_brain(path);
        }

        if (btn_export.clicked) {
            std::string path = save_file_dialog();
            if (!path.empty()) sim.export_brain(path);
        }

        if (IsKeyPressed(KEY_R)) sim.reset_maze();
        if (IsKeyPressed(KEY_I)) {
            std::string path = open_file_dialog();
            if (!path.empty()) sim.import_brain(path);
        }
        if (IsKeyPressed(KEY_E)) {
            std::string path = save_file_dialog();
            if (!path.empty()) sim.export_brain(path);
        }

        // Update kill visual effects
        for (auto& eff : kill_effects) {
            eff.timer -= 0.04f;
        }
        kill_effects.erase(std::remove_if(kill_effects.begin(), kill_effects.end(), [](const KillEffect& e) { return e.timer <= 0.0f; }), kill_effects.end());

        return false;
    }

    void draw(const Simulation& sim) const {
        draw_win7_titlebar();

        if (is_headless_training) {
            draw_headless_neural_training_view(sim);
        } else if (is_map_editor_mode) {
            draw_freehand_canvas(sim);
            draw_editor_sidebar(sim);
        } else {
            if (is_3d_mode) {
                draw_3d_maze_area(sim);
            } else {
                draw_freehand_canvas(sim);
            }
            draw_sidebar(sim);
        }
    }

private:
    void draw_win7_titlebar() const {
        DrawRectangleGradientV(0, 0, SCREEN_WIDTH, TITLEBAR_HEIGHT, 
                               Color{160, 195, 235, 255}, Color{28, 48, 78, 255});
        
        DrawLine(0, 0, SCREEN_WIDTH, 0, Color{255, 255, 255, 180});
        DrawLine(0, TITLEBAR_HEIGHT - 1, SCREEN_WIDTH, TITLEBAR_HEIGHT - 1, Color{15, 20, 30, 255});

        DrawRectangleRounded({ 10.0f, 6.0f, 18.0f, 18.0f }, 0.25f, 3, Color{0, 160, 255, 220});
        DrawCircle(19, 15, 4.0f, Color{255, 255, 255, 255});

        draw_tw_text("Maze AI Simulation - Spinner Survival & Neural Network (Twentieth Century Edition)", 35.0f, 8.0f, 14.0f, Color{0, 0, 0, 190}, true);
        draw_tw_text("Maze AI Simulation - Spinner Survival & Neural Network (Twentieth Century Edition)", 34.0f, 7.0f, 14.0f, Color{245, 250, 255, 255}, true);

        win7_buttons.draw();
    }

    void draw_editor_sidebar(const Simulation& sim) const {
        const float offset_y = static_cast<float>(TITLEBAR_HEIGHT);

        DrawRectangle(SIDEBAR_X, static_cast<int>(offset_y), SIDEBAR_WIDTH, SIDEBAR_HEIGHT, Color{18, 20, 28, 255});
        DrawLine(SIDEBAR_X, static_cast<int>(offset_y), SIDEBAR_X, static_cast<int>(offset_y + SIDEBAR_HEIGHT), Color{45, 52, 72, 255});

        DrawRectangleGradientV(SIDEBAR_X, static_cast<int>(offset_y), SIDEBAR_WIDTH, 32, Color{28, 36, 54, 255}, Color{18, 20, 28, 255});
        draw_tw_text("FREE DRAWING TRACK BUILDER (YELLOW WALLS / BLACK FLOOR)", 815.0f, offset_y + 8.0f, 13.0f, Color{255, 225, 0, 255}, true);

        btn_go.draw(14.0f, true);

        btn_tool_brush_wall.draw(11.0f, true);
        btn_tool_brush_erase.draw(11.0f, true);
        btn_tool_start.draw(11.0f, true);
        btn_tool_goal.draw(11.0f, true);

        if (current_tool == TOOL_BRUSH_WALL) DrawRectangleRoundedLines(btn_tool_brush_wall.rect, 0.25f, 4, 2.0f, Color{255, 255, 255, 255});
        if (current_tool == TOOL_BRUSH_ERASER) DrawRectangleRoundedLines(btn_tool_brush_erase.rect, 0.25f, 4, 2.0f, Color{255, 255, 255, 255});
        if (current_tool == TOOL_START) DrawRectangleRoundedLines(btn_tool_start.rect, 0.25f, 4, 2.0f, Color{0, 240, 255, 255});
        if (current_tool == TOOL_GOAL) DrawRectangleRoundedLines(btn_tool_goal.rect, 0.25f, 4, 2.0f, Color{255, 120, 0, 255});

        btn_brush_small.draw(11.0f);
        btn_brush_med.draw(11.0f);
        btn_brush_large.draw(11.0f);
        btn_clear_canvas.draw(11.0f);
        btn_gen_maze.draw(11.0f);

        btn_save_map.draw(11.0f);
        btn_load_map.draw(11.0f);

        char size_buf[64];
        std::snprintf(size_buf, sizeof(size_buf), "CAR SIZE: %.2fx", g_car_scale);
        draw_tw_text(size_buf, 1050.0f, offset_y + 180.0f, 13.0f, Color{240, 245, 255, 255}, true);
        btn_car_size_minus.draw(13.0f, true);
        btn_car_size_plus.draw(13.0f, true);

        draw_tw_text("• Left-Click: Paint Yellow Wall | Right-Click: Erase to Black", 815.0f, offset_y + 208.0f, 12.0f, Color{200, 215, 235, 255});
        draw_tw_text("• Drag START / GOAL with tool selected to place finely anywhere", 815.0f, offset_y + 224.0f, 12.0f, Color{120, 215, 255, 255});

        draw_neuron_map(sim, offset_y - 190.0f);
    }

    void draw_freehand_canvas(const Simulation& sim) const {
        const float offset_y = static_cast<float>(TITLEBAR_HEIGHT);

        BeginScissorMode(0, TITLEBAR_HEIGHT, MAZE_WIDTH, MAZE_HEIGHT);

        DrawRectangle(0, static_cast<int>(offset_y), MAZE_WIDTH, MAZE_HEIGHT, Color{0, 0, 0, 255});

        for (int y = 0; y < CANVAS_RES; ++y) {
            for (int x = 0; x < CANVAS_RES; ++x) {
                if (sim.maze.free_canvas[y][x]) {
                    float px = x * CANVAS_CELL_SIZE;
                    float py = offset_y + y * CANVAS_CELL_SIZE;
                    DrawRectangleRec({ px, py, CANVAS_CELL_SIZE + 0.5f, CANVAS_CELL_SIZE + 0.5f }, Color{255, 220, 0, 255});
                }
            }
        }

        // ================= DRAW GREEN CORRECT PATH SQUARES =================
        if (sim.maze.is_maze_mode && !sim.maze.spinner_mode) {
            for (const auto& sq : sim.global_visited_correct_squares) {
                int r = sq.first;
                int c = sq.second;
                if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
                    float cell_x = c * CELL_SIZE;
                    float cell_y = offset_y + r * CELL_SIZE;
                    DrawRectangleRec({ cell_x + 1.5f, cell_y + 1.5f, CELL_SIZE - 3.0f, CELL_SIZE - 3.0f }, Color{0, 230, 80, 110});
                    DrawRectangleLinesEx({ cell_x + 1.5f, cell_y + 1.5f, CELL_SIZE - 3.0f, CELL_SIZE - 3.0f }, 1.8f, Color{0, 255, 120, 210});
                }
            }
        }

        // ================= DRAW SPINNER HAZARD (IF ACTIVE) =================
        if (sim.maze.spinner_mode) {
            const auto& sp = sim.maze.spinner;
            Vector2 sp_center = { sp.center.x, sp.center.y + offset_y };

            // Draw rotating hazard arms with yellow/black hazard warning stripes
            for (int i = 0; i < sp.num_arms; ++i) {
                float arm_rad = (sp.angle + (360.0f / sp.num_arms) * i) * DEG2RAD;
                Vector2 arm_end = { sp_center.x + std::cos(arm_rad) * sp.arm_length,
                                    sp_center.y + std::sin(arm_rad) * sp.arm_length };

                // Glowing hazard outline
                DrawLineEx(sp_center, arm_end, sp.arm_thickness + 4.0f, Color{255, 60, 0, 160});
                DrawLineEx(sp_center, arm_end, sp.arm_thickness, Color{255, 200, 0, 255});
                DrawCircleV(arm_end, sp.arm_thickness * 0.8f, Color{255, 40, 0, 255});
            }

            // Central rotating Rotor Hub
            DrawCircleV(sp_center, sp.hub_radius + 4.0f, Color{40, 45, 60, 255});
            DrawCircleLines(static_cast<int>(sp_center.x), static_cast<int>(sp_center.y), sp.hub_radius + 4.0f, Color{255, 200, 0, 255});
            DrawCircleV(sp_center, sp.hub_radius, Color{200, 30, 30, 255});
            DrawCircle(static_cast<int>(sp_center.x), static_cast<int>(sp_center.y), 6.0f, Color{255, 255, 255, 255});

            DrawRectangleRounded({ 12.0f, static_cast<float>(TITLEBAR_HEIGHT + 10), 320.0f, 24.0f }, 0.3f, 4, Color{220, 40, 10, 230});
            draw_tw_text("🔥 SPINNER SURVIVAL: SURVIVE THE LONGEST!", 20.0f, TITLEBAR_HEIGHT + 15.0f, 13.0f, Color{255, 255, 255, 255}, true);
        }

        if (sim.maze.shortest_path_points.size() > 1 && !sim.maze.spinner_mode) {
            for (size_t i = 0; i < sim.maze.shortest_path_points.size() - 1; ++i) {
                Vector2 p1 = { sim.maze.shortest_path_points[i].x, offset_y + sim.maze.shortest_path_points[i].y };
                Vector2 p2 = { sim.maze.shortest_path_points[i + 1].x, offset_y + sim.maze.shortest_path_points[i + 1].y };
                DrawLineEx(p1, p2, 2.0f, Color{0, 220, 255, 90});
                DrawCircleV(p1, 2.2f, Color{0, 220, 255, 120});
            }
        }

        // START Marker
        Vector2 start_render = { sim.maze.start_pos_exact.x, offset_y + sim.maze.start_pos_exact.y };
        DrawCircleV(start_render, 14.0f, Color{0, 150, 255, 90});
        DrawCircleLines(static_cast<int>(start_render.x), static_cast<int>(start_render.y), 14.0f, Color{0, 220, 255, 255});
        DrawCircle(static_cast<int>(start_render.x), static_cast<int>(start_render.y), 4.0f, Color{255, 255, 255, 255});
        draw_tw_text("START", start_render.x - 18.0f, start_render.y + 16.0f, 11.0f, Color{0, 240, 255, 255}, true);

        // GOAL Marker
        if (!sim.maze.spinner_mode) {
            Vector2 goal_render = { sim.maze.goal_pos_exact.x, offset_y + sim.maze.goal_pos_exact.y };
            DrawCircleV(goal_render, sim.maze.goal_radius, Color{255, 200, 0, 75});
            DrawCircleLines(static_cast<int>(goal_render.x), static_cast<int>(goal_render.y), sim.maze.goal_radius, Color{255, 215, 0, 255});
            DrawCircle(static_cast<int>(goal_render.x), static_cast<int>(goal_render.y), 5.0f, Color{255, 240, 100, 255});
            draw_tw_text("GOAL", goal_render.x - 14.0f, goal_render.y + sim.maze.goal_radius + 3.0f, 11.0f, Color{255, 220, 0, 255}, true);
        }

        if (!is_map_editor_mode) {
            const Car& leader = sim.population[sim.leader_idx];
            if (leader.alive) {
                Vector2 leader_render_pos = { leader.pos.x, leader.pos.y + offset_y };
                for (int i = 0; i < NUM_RAYS; ++i) {
                    Vector2 endpoint_render = { leader.ray_endpoints[i].x, leader.ray_endpoints[i].y + offset_y };
                    DrawLineV(leader_render_pos, endpoint_render, Color{0, 255, 0, 130});
                }

                if (sim.maze.shortest_path_points.size() > 1 && !sim.maze.spinner_mode) {
                    int next_k = std::min(leader.current_checkpoint_idx + 1, static_cast<int>(sim.maze.shortest_path_points.size()) - 1);
                    Vector2 target_pt = sim.maze.shortest_path_points[next_k];
                    Vector2 target_render = { target_pt.x, offset_y + target_pt.y };
                    DrawLineEx(leader_render_pos, target_render, 2.0f, Color{0, 240, 255, 180});
                    DrawCircleV(target_render, 3.5f, Color{0, 240, 255, 240});
                }
            }

            for (int i = 0; i < POPULATION_SIZE; ++i) {
                const auto& car = sim.population[i];
                if (!car.alive && !car.finished) continue;
                bool is_leader = (i == sim.leader_idx);
                draw_car(car, is_leader, offset_y);
            }
        }

        // Draw Kill Effects (Red Flash / Skull)
        for (const auto& eff : kill_effects) {
            float rad = (1.0f - eff.timer) * 32.0f;
            unsigned char a = static_cast<unsigned char>(eff.timer * 255.0f);
            DrawCircleLines(static_cast<int>(eff.pos.x), static_cast<int>(eff.pos.y), rad, Color{255, 30, 30, a});
            draw_tw_text("💀", eff.pos.x - 7.0f, eff.pos.y - 8.0f, 14.0f, Color{255, 60, 60, a}, true);
        }

        if (is_map_editor_mode) {
            Vector2 mouse = GetMousePosition();
            if (mouse.x < MAZE_WIDTH && mouse.y >= TITLEBAR_HEIGHT) {
                Color brush_col = (current_tool == TOOL_BRUSH_WALL) ? Color{255, 220, 0, 150} : Color{150, 150, 150, 150};
                if (current_tool == TOOL_BRUSH_WALL || current_tool == TOOL_BRUSH_ERASER) {
                    DrawCircleLines(static_cast<int>(mouse.x), static_cast<int>(mouse.y), current_brush_radius, brush_col);
                }
            }
        }

        if (is_slowmo) {
            DrawRectangleRounded({ 12.0f, static_cast<float>(TITLEBAR_HEIGHT + 38), 180.0f, 22.0f }, 0.3f, 4, Color{190, 80, 20, 220});
            draw_tw_text("SLOW-MO (120 FPS)", 22.0f, TITLEBAR_HEIGHT + 42.0f, 13.0f, Color{255, 255, 255, 255}, true);
        }

        EndScissorMode();
    }

    void draw_headless_neural_training_view(const Simulation& sim) const {
        const float offset_y = static_cast<float>(TITLEBAR_HEIGHT);

        DrawRectangle(0, static_cast<int>(offset_y), SCREEN_WIDTH, SCREEN_HEIGHT - TITLEBAR_HEIGHT, Color{12, 14, 20, 255});

        DrawRectangleGradientV(0, static_cast<int>(offset_y), SCREEN_WIDTH, 65, Color{18, 24, 38, 255}, Color{12, 14, 20, 255});
        DrawLine(0, static_cast<int>(offset_y + 65), SCREEN_WIDTH, static_cast<int>(offset_y + 65), Color{35, 45, 65, 255});

        DrawRectangleRounded({ 20.0f, offset_y + 14.0f, 210.0f, 28.0f }, 0.3f, 4, Color{230, 70, 20, 220});
        draw_tw_text("⚡ HEADLESS 50X TRAINING", 30.0f, offset_y + 20.0f, 14.0f, Color{255, 255, 255, 255}, true);

        char gen_str[64];
        std::snprintf(gen_str, sizeof(gen_str), "GEN: %d", sim.generation);
        draw_tw_text(gen_str, 250.0f, offset_y + 20.0f, 15.0f, Color{230, 240, 255, 255}, true);

        char fit_str[64];
        const auto& leader = sim.population[sim.leader_idx];
        std::snprintf(fit_str, sizeof(fit_str), "LEADER FITNESS: %.1f", leader.fitness);
        draw_tw_text(fit_str, 360.0f, offset_y + 20.0f, 15.0f, Color{200, 130, 255, 255}, true);

        char mut_str[64];
        const char* mut_tag = (sim.current_mutation_rate == 0.0f) ? " (PUNISHED)" :
                              ((sim.current_mutation_rate <= 0.051f) ? " (FINE-TUNE)" : 
                              ((sim.stagnation_generations > 0) ? " (BOOST)" : ""));
        std::snprintf(mut_str, sizeof(mut_str), "MUTATION: %.0f%%%s", 
                      sim.current_mutation_rate * 100.0f, mut_tag);
        Color mut_col = (sim.current_mutation_rate == 0.0f) ? Color{255, 60, 60, 255} :
                        ((sim.current_mutation_rate <= 0.051f) ? Color{0, 255, 180, 255} :
                        ((sim.stagnation_generations > 0) ? Color{255, 130, 40, 255} : Color{160, 200, 240, 255}));
        draw_tw_text(mut_str, 600.0f, offset_y + 20.0f, 15.0f, mut_col, true);

        char speed_str[64];
        std::snprintf(speed_str, sizeof(speed_str), "THROUGHPUT: ~3,000 TPS (50X)");
        draw_tw_text(speed_str, 780.0f, offset_y + 20.0f, 15.0f, Color{0, 255, 160, 255}, true);

        btn_headless.draw(12.0f, true);
        btn_import.draw(12.0f);
        btn_export.draw(12.0f);

        const auto& t = leader.telemetry;
        char telemetry_str[256];
        std::snprintf(telemetry_str, sizeof(telemetry_str), 
                      "AI STATUS: %s | Target Checkpoint: #%d / %d | Steering: %+.2f | Throttle: %.0f%% | Speed: %.1f px/s",
                      t.thought_summary, t.target_checkpoint, t.total_checkpoints, t.final_steer, (t.nn_throttle + 1.0f) * 50.0f, t.final_speed);
        DrawRectangleRounded({ 20.0f, offset_y + 75.0f, SCREEN_WIDTH - 40.0f, 30.0f }, 0.2f, 4, Color{20, 24, 34, 255});
        DrawRectangleRoundedLines({ 20.0f, offset_y + 75.0f, SCREEN_WIDTH - 40.0f, 30.0f }, 0.2f, 4, 1.0f, Color{45, 55, 80, 255});
        draw_tw_text(telemetry_str, 32.0f, offset_y + 82.0f, 13.0f, Color{255, 235, 130, 255});

        Rectangle net_container = { 20.0f, offset_y + 114.0f, SCREEN_WIDTH - 40.0f, SCREEN_HEIGHT - TITLEBAR_HEIGHT - 128.0f };
        DrawRectangleRounded(net_container, 0.02f, 6, Color{16, 20, 28, 255});
        DrawRectangleRoundedLines(net_container, 0.02f, 6, 1.5f, Color{40, 48, 70, 255});

        draw_tw_text("FULLSCREEN REAL-TIME NEURAL MAP (20 HIDDEN LAYERS | TWENTIETH CENTURY ARCHITECTURE)", 
                     net_container.x + 18.0f, net_container.y + 12.0f, 14.0f, Color{130, 190, 255, 255}, true);

        draw_neural_net_nodes_and_synapses(leader.brain, net_container);
    }

    void draw_neural_net_nodes_and_synapses(const NeuralNetwork& brain, Rectangle container) const {
        const auto& activations = brain.activations;
        const int num_stages = NUM_LAYERS;
        float col_spacing = (container.width - 80.0f) / (num_stages - 1);
        float margin_left = container.x + 35.0f;
        float content_top = container.y + 30.0f;
        float content_height = container.height - 44.0f;

        std::vector<std::vector<Vector2>> node_positions(num_stages);

        for (int s = 0; s < num_stages; ++s) {
            int count = LAYER_SIZES[s];
            float x = margin_left + s * col_spacing;
            node_positions[s].resize(count);

            float vertical_step = content_height / (count + 1);
            for (int i = 0; i < count; ++i) {
                float y = content_top + (i + 1) * vertical_step;
                node_positions[s][i] = { x, y };
            }
        }

        for (int s = 0; s < num_stages - 1; ++s) {
            const auto& layer = brain.layers[s];
            int stride_in = (s == 0) ? 4 : (layer.in_size > 20 ? 4 : 2);
            int stride_out = (s == num_stages - 2) ? 1 : (layer.out_size > 20 ? 4 : 2);

            for (int i = 0; i < layer.in_size; i += stride_in) {
                for (int j = 0; j < layer.out_size; j += stride_out) {
                    float w = layer.weights[i * layer.out_size + j];
                    float abs_w = std::fabs(w);
                    if (abs_w > 0.40f) {
                        unsigned char alpha = static_cast<unsigned char>(clampf(abs_w * 40.0f, 12.0f, 65.0f));
                        Color syn_color = (w > 0.0f) ? Color{0, 220, 255, alpha} : Color{255, 70, 70, alpha};
                        DrawLineV(node_positions[s][i], node_positions[s + 1][j], syn_color);
                    }
                }
            }
        }

        for (int s = 0; s < num_stages; ++s) {
            int count = LAYER_SIZES[s];
            float radius = (s == 0) ? 1.4f : (s == num_stages - 1 ? 4.5f : 1.8f);

            for (int i = 0; i < count; ++i) {
                Vector2 pos = node_positions[s][i];
                float act = (s < static_cast<int>(activations.size()) && i < static_cast<int>(activations[s].size())) ? activations[s][i] : 0.0f;
                Color node_color;

                if (act > 0.05f) {
                    unsigned char glow = static_cast<unsigned char>(clampf(act * 200.0f, 100.0f, 255.0f));
                    node_color = Color{0, glow, 255, 255};
                } else if (act < -0.05f) {
                    unsigned char glow = static_cast<unsigned char>(clampf(std::fabs(act) * 200.0f, 100.0f, 255.0f));
                    node_color = Color{255, 50, 50, glow};
                } else {
                    node_color = Color{75, 85, 110, 255};
                }

                DrawCircleV(pos, radius, node_color);
            }
        }

        const char* out_labels[3] = { "St", "Th", "Br" };
        for (int i = 0; i < 3; ++i) {
            Vector2 pos = node_positions[num_stages - 1][i];
            draw_tw_text(out_labels[i], pos.x + 6.0f, pos.y - 5.0f, 10.0f, Color{220, 235, 255, 255}, true);
        }
    }

    void draw_3d_maze_area(const Simulation& sim) const {
        BeginScissorMode(0, TITLEBAR_HEIGHT, MAZE_WIDTH, MAZE_HEIGHT);
        ClearBackground(Color{0, 0, 0, 255});

        Camera3D render_cam = camera;

        if (follow_best_mode) {
            const auto& leader = sim.population[sim.leader_idx];
            Vector3 leader_3d = { (leader.pos.x - 400.0f) * 0.08f, 0.38f * g_car_scale, (leader.pos.y - 400.0f) * 0.08f };
            float angle_follow = leader.angle + follow_yaw_offset;
            float rad = angle_follow * DEG2RAD;
            Vector3 fwd = { std::cos(rad), 0.0f, std::sin(rad) };

            render_cam.target = leader_3d;
            render_cam.position = {
                leader_3d.x - fwd.x * follow_dist,
                leader_3d.y + follow_dist * 0.52f,
                leader_3d.z - fwd.z * follow_dist
            };
        }

        BeginMode3D(render_cam);

        DrawPlane({0.0f, 0.0f, 0.0f}, {64.0f, 64.0f}, Color{10, 10, 15, 255});
        DrawGrid(16, 4.0f);

        // 3D Green Visited Correct Solution Tiles
        if (sim.maze.is_maze_mode && !sim.maze.spinner_mode) {
            for (const auto& sq : sim.global_visited_correct_squares) {
                int r = sq.first;
                int c = sq.second;
                if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
                    float px = ((c + 0.5f) * CELL_SIZE - 400.0f) * 0.08f;
                    float pz = ((r + 0.5f) * CELL_SIZE - 400.0f) * 0.08f;
                    DrawCube({ px, 0.02f, pz }, CELL_SIZE * 0.08f - 0.15f, 0.02f, CELL_SIZE * 0.08f - 0.15f, Color{0, 230, 80, 120});
                    DrawCubeWires({ px, 0.02f, pz }, CELL_SIZE * 0.08f - 0.15f, 0.02f, CELL_SIZE * 0.08f - 0.15f, Color{0, 255, 120, 200});
                }
            }
        }

        const float wall_h = 2.8f;
        for (int y = 0; y < CANVAS_RES; y += 2) {
            for (int x = 0; x < CANVAS_RES; x += 2) {
                if (sim.maze.free_canvas[y][x]) {
                    float px = (x * CANVAS_CELL_SIZE + CANVAS_CELL_SIZE - 400.0f) * 0.08f;
                    float pz = (y * CANVAS_CELL_SIZE + CANVAS_CELL_SIZE - 400.0f) * 0.08f;
                    DrawCube({px, wall_h * 0.5f, pz}, CANVAS_CELL_SIZE * 0.08f * 2.0f, wall_h, CANVAS_CELL_SIZE * 0.08f * 2.0f, Color{255, 220, 0, 255});
                }
            }
        }

        // ================= 3D SPINNER HAZARD RENDERING =================
        if (sim.maze.spinner_mode) {
            const auto& sp = sim.maze.spinner;
            Vector3 sp_center_3d = { (sp.center.x - 400.0f) * 0.08f, 1.2f, (sp.center.y - 400.0f) * 0.08f };

            // Central Rotor
            DrawCylinder(sp_center_3d, sp.hub_radius * 0.08f, sp.hub_radius * 0.08f, 2.2f, 16, Color{200, 30, 30, 255});
            DrawCylinderWires(sp_center_3d, sp.hub_radius * 0.08f, sp.hub_radius * 0.08f, 2.2f, 16, Color{255, 200, 0, 255});

            // 3D Rotating Blades
            for (int i = 0; i < sp.num_arms; ++i) {
                float arm_deg = sp.angle + (360.0f / sp.num_arms) * i;
                float arm_rad = arm_deg * DEG2RAD;
                float half_len = sp.arm_length * 0.08f * 0.5f;
                Vector3 arm_pos = {
                    sp_center_3d.x + std::cos(arm_rad) * half_len,
                    1.2f,
                    sp_center_3d.z + std::sin(arm_rad) * half_len
                };

                rlPushMatrix();
                rlTranslatef(arm_pos.x, arm_pos.y, arm_pos.z);
                rlRotatef(-arm_deg, 0.0f, 1.0f, 0.0f);

                DrawCube({ 0.0f, 0.0f, 0.0f }, sp.arm_length * 0.08f, 1.8f, sp.arm_thickness * 0.08f, Color{255, 200, 0, 255});
                DrawCubeWires({ 0.0f, 0.0f, 0.0f }, sp.arm_length * 0.08f, 1.8f, sp.arm_thickness * 0.08f, Color{255, 40, 0, 255});
                rlPopMatrix();
            }
        }

        float start_px = (sim.maze.start_pos_exact.x - 400.0f) * 0.08f;
        float start_pz = (sim.maze.start_pos_exact.y - 400.0f) * 0.08f;
        DrawCube({start_px, 0.04f, start_pz}, 2.2f, 0.05f, 2.2f, Color{0, 160, 255, 180});

        if (!sim.maze.spinner_mode) {
            float goal_px = (sim.maze.goal_pos_exact.x - 400.0f) * 0.08f;
            float goal_pz = (sim.maze.goal_pos_exact.y - 400.0f) * 0.08f;
            DrawCube({goal_px, 0.04f, goal_pz}, 2.5f, 0.05f, 2.5f, Color{255, 215, 0, 180});
        }

        for (int i = 0; i < POPULATION_SIZE; ++i) {
            const auto& car = sim.population[i];
            if (!car.alive && !car.finished) continue;

            bool is_leader = (i == sim.leader_idx);
            Vector3 car_pos = { (car.pos.x - 400.0f) * 0.08f, 0.38f * g_car_scale, (car.pos.y - 400.0f) * 0.08f };
            Color car_col = car.finished ? Color{0, 230, 100, 255} : Color{225, 38, 38, 255};

            rlPushMatrix();
            rlTranslatef(car_pos.x, car_pos.y, car_pos.z);
            rlRotatef(-car.angle, 0.0f, 1.0f, 0.0f);

            DrawCube({ 0.0f, 0.0f, 0.0f }, 1.1f * g_car_scale, 0.30f * g_car_scale, 0.58f * g_car_scale, car_col);
            DrawCubeWires({ 0.0f, 0.0f, 0.0f }, 1.1f * g_car_scale, 0.30f * g_car_scale, 0.58f * g_car_scale, is_leader ? Color{255, 255, 255, 255} : Color{120, 15, 15, 255});
            DrawCube({ 0.0f, 0.16f * g_car_scale, 0.0f }, 0.45f * g_car_scale, 0.12f * g_car_scale, 0.52f * g_car_scale, Color{30, 40, 60, 240});

            if (is_leader) {
                DrawCylinderWires({ 0.0f, 0.0f, 0.0f }, 1.2f * g_car_scale, 1.2f * g_car_scale, 0.04f, 16, Color{255, 255, 255, 240});
            }

            rlPopMatrix();
        }

        EndMode3D();
        EndScissorMode();

        DrawRectangleRounded({ 12.0f, static_cast<float>(TITLEBAR_HEIGHT + 10), 450.0f, 24.0f }, 0.3f, 4, Color{15, 20, 30, 210});
        char hud_msg[128];
        std::snprintf(hud_msg, sizeof(hud_msg), "3D VIEW %s | 'M': DRAW | 'P': SPINNER | 'H': TRAIN", 
                      is_slowmo ? "[SLOW-MO 120FPS]" : (follow_best_mode ? "[FOLLOWING BEST]" : "[FREE CAM]"));
        draw_tw_text(hud_msg, 20.0f, TITLEBAR_HEIGHT + 15.0f, 13.0f, is_slowmo ? Color{255, 180, 50, 255} : Color{180, 220, 255, 255}, true);
    }

    void draw_car(const Car& car, bool is_leader, float offset_y) const {
        float rad = car.angle * DEG2RAD;
        float length = 14.0f * g_car_scale;
        float width = 7.5f * g_car_scale;
        Vector2 render_pos = { car.pos.x, car.pos.y + offset_y };

        Vector2 forward = { std::cos(rad), std::sin(rad) };
        Vector2 right = { -forward.y, forward.x };

        Vector2 p_fl = { render_pos.x + forward.x * (length * 0.5f) - right.x * (width * 0.5f),
                         render_pos.y + forward.y * (length * 0.5f) - right.y * (width * 0.5f) };
        Vector2 p_fr = { render_pos.x + forward.x * (length * 0.5f) + right.x * (width * 0.5f),
                         render_pos.y + forward.y * (length * 0.5f) + right.y * (width * 0.5f) };
        Vector2 p_bl = { render_pos.x - forward.x * (length * 0.5f) - right.x * (width * 0.5f),
                         render_pos.y - forward.y * (length * 0.5f) - right.y * (width * 0.5f) };
        Vector2 p_br = { render_pos.x - forward.x * (length * 0.5f) + right.x * (width * 0.5f),
                         render_pos.y - forward.y * (length * 0.5f) + right.y * (width * 0.5f) };

        Color body_color = car.finished ? Color{0, 230, 100, 255} : Color{225, 38, 38, 255};

        DrawTriangle(p_fl, p_bl, p_fr, body_color);
        DrawTriangle(p_fr, p_bl, p_br, body_color);

        DrawLineEx(p_fl, p_fr, 1.2f, is_leader ? Color{255, 255, 255, 255} : Color{120, 15, 15, 255});
        DrawLineEx(p_fr, p_br, 1.2f, is_leader ? Color{255, 255, 255, 255} : Color{120, 15, 15, 255});
        DrawLineEx(p_br, p_bl, 1.2f, is_leader ? Color{255, 255, 255, 255} : Color{120, 15, 15, 255});
        DrawLineEx(p_bl, p_fl, 1.2f, is_leader ? Color{255, 255, 255, 255} : Color{120, 15, 15, 255});

        Vector2 w_l = { render_pos.x + forward.x * (1.5f * g_car_scale) - right.x * (width * 0.4f), render_pos.y + forward.y * (1.5f * g_car_scale) - right.y * (width * 0.4f) };
        Vector2 w_r = { render_pos.x + forward.x * (1.5f * g_car_scale) + right.x * (width * 0.4f), render_pos.y + forward.y * (1.5f * g_car_scale) + right.y * (width * 0.4f) };
        DrawLineEx(w_l, w_r, 2.0f, Color{30, 40, 60, 240});

        DrawCircleV(p_fl, 1.2f * g_car_scale, Color{255, 255, 200, 255});
        DrawCircleV(p_fr, 1.2f * g_car_scale, Color{255, 255, 200, 255});

        if (is_leader) {
            DrawCircleLines(static_cast<int>(render_pos.x), static_cast<int>(render_pos.y), 11.0f * g_car_scale, Color{255, 255, 255, 200});
        }
    }

    void draw_sidebar(const Simulation& sim) const {
        const float offset_y = static_cast<float>(TITLEBAR_HEIGHT);

        DrawRectangle(SIDEBAR_X, static_cast<int>(offset_y), SIDEBAR_WIDTH, SIDEBAR_HEIGHT, Color{16, 18, 24, 255});
        DrawLine(SIDEBAR_X, static_cast<int>(offset_y), SIDEBAR_X, static_cast<int>(offset_y + SIDEBAR_HEIGHT), Color{45, 52, 72, 255});

        // Row 1: GEN, MUTATION, ALIVE
        char gen_str[64];
        std::snprintf(gen_str, sizeof(gen_str), "GEN: %d", sim.generation);
        draw_tw_text(gen_str, 815.0f, offset_y + 6.0f, 15.0f, Color{230, 240, 255, 255}, true);

        char mut_str[64];
        const char* mut_tag = (sim.current_mutation_rate == 0.0f) ? " (PUNISHED)" :
                              ((sim.current_mutation_rate <= 0.051f) ? " (FINE-TUNE)" : 
                              ((sim.stagnation_generations > 0) ? " (BOOST)" : ""));
        std::snprintf(mut_str, sizeof(mut_str), "MUTATION: %.0f%%%s", 
                      sim.current_mutation_rate * 100.0f, mut_tag);
        Color mut_col = (sim.current_mutation_rate == 0.0f) ? Color{255, 60, 60, 255} :
                        ((sim.current_mutation_rate <= 0.051f) ? Color{0, 255, 180, 255} :
                        ((sim.stagnation_generations > 0) ? Color{255, 130, 40, 255} : Color{160, 200, 240, 255}));
        draw_tw_text(mut_str, 915.0f, offset_y + 6.0f, 14.0f, mut_col, true);

        char alive_str[64];
        std::snprintf(alive_str, sizeof(alive_str), "ALIVE: %d / %d", sim.get_alive_count(), POPULATION_SIZE);
        draw_tw_text(alive_str, 1100.0f, offset_y + 6.0f, 14.0f, Color{0, 240, 120, 255}, true);

        // Header Menu Buttons Bar
        btn_editor.draw(11.0f);
        btn_spinner.draw(11.0f, true);
        btn_headless.draw(11.0f);
        btn_slowmo.draw(11.0f);
        btn_follow_mode.draw(11.0f);
        btn_view_mode.draw(11.0f);
        btn_import.draw(11.0f);
        btn_export.draw(11.0f);

        draw_population_matrix(sim, offset_y);
        draw_ai_thought_inspector(sim, offset_y);
        draw_neuron_map(sim, offset_y);
    }

    void draw_population_matrix(const Simulation& sim, float offset_y) const {
        const float start_x = 815.0f;
        const float start_y = offset_y + 64.0f;
        const float box_size = 20.0f;
        const float pitch = 23.0f;
        const int cols = 20;

        for (int i = 0; i < POPULATION_SIZE; ++i) {
            int col = i % cols;
            int row = i / cols;
            float x = start_x + col * pitch;
            float y = start_y + row * pitch;
            Rectangle box_rec = { x, y, box_size, box_size };

            const auto& car = sim.population[i];
            Color box_color;

            if (car.finished) {
                box_color = Color{0, 255, 0, 255};
            } else if (!car.alive) {
                box_color = car.has_gone_off_course ? Color{25, 12, 16, 255} : Color{15, 15, 15, 255};
            } else {
                if (car.has_gone_off_course) {
                    box_color = Color{195, 85, 25, 255};
                } else if (car.cumulative_score >= 10.0f) {
                    unsigned char g = static_cast<unsigned char>(clampf(80.0f + car.cumulative_score * 0.5f, 80.0f, 210.0f));
                    box_color = Color{30, g, 230, 255};
                } else {
                    box_color = Color{210, 45, 45, 255};
                }
            }

            DrawRectangleRounded(box_rec, 0.2f, 2, box_color);

            if (i == sim.leader_idx) {
                DrawRectangleRoundedLines(box_rec, 0.2f, 2, 2.0f, Color{255, 255, 255, 255});
            } else {
                DrawRectangleRoundedLines(box_rec, 0.2f, 2, 1.0f, Color{45, 50, 70, 255});
            }

            char idx_str[8];
            std::snprintf(idx_str, sizeof(idx_str), "%d", i);
            float font_size = (i >= 100) ? 9.0f : 10.0f;
            float text_w = measure_tw_text(idx_str, font_size);
            float text_x = x + (box_size - text_w) * 0.5f;
            float text_y = y + (box_size - font_size) * 0.5f - 1.0f;
            Color text_color = (!car.alive && !car.finished) ? Color{80, 85, 105, 255} : Color{255, 255, 255, 255};
            draw_tw_text(idx_str, text_x, text_y, font_size, text_color);
        }
    }

    void draw_ai_thought_inspector(const Simulation& sim, float offset_y) const {
        Rectangle container = { 815.0f, offset_y + 298.0f, 450.0f, 130.0f };
        DrawRectangleRounded(container, 0.06f, 4, Color{22, 24, 32, 255});
        DrawRectangleRoundedLines(container, 0.06f, 4, 1.2f, Color{48, 55, 75, 255});

        draw_tw_text("AI THOUGHT PROCESS & DECISION INSPECTOR", container.x + 12.0f, container.y + 6.0f, 13.0f, Color{100, 200, 255, 255}, true);

        const auto& leader = sim.population[sim.leader_idx];
        const auto& t = leader.telemetry;

        if (sim.maze.spinner_mode) {
            char spin_str[128];
            std::snprintf(spin_str, sizeof(spin_str), "MODE: SPINNER SURVIVAL | Survived: %d ticks (%.1fs)", leader.ticks_alive, leader.ticks_alive / 60.0f);
            draw_tw_text(spin_str, container.x + 12.0f, container.y + 24.0f, 12.0f, Color{255, 140, 40, 255}, true);
        } else {
            float progress_pct = (t.total_checkpoints > 0) ? (t.target_checkpoint * 100.0f / t.total_checkpoints) : 0.0f;
            char goal_str[128];
            std::snprintf(goal_str, sizeof(goal_str), "Target: Checkpoint #%d / %d (%.1f%% Path Complete)", t.target_checkpoint, t.total_checkpoints, progress_pct);
            draw_tw_text(goal_str, container.x + 12.0f, container.y + 24.0f, 12.0f, Color{220, 230, 245, 255});
        }

        char thought_str[160];
        std::snprintf(thought_str, sizeof(thought_str), "Thought: %s", t.thought_summary);
        draw_tw_text(thought_str, container.x + 12.0f, container.y + 42.0f, 12.0f, Color{255, 230, 110, 255}, true);

        draw_tw_text("Hazard Sensor:", container.x + 12.0f, container.y + 62.0f, 12.0f, Color{170, 185, 210, 255});
        Rectangle badge_rec = { container.x + 115.0f, container.y + 60.0f, 315.0f, 18.0f };
        Color badge_bg = sim.maze.spinner_mode ? Color{180, 70, 0, 220} : (t.dead_end_rejected ? Color{180, 45, 25, 220} : Color{25, 130, 70, 200});
        DrawRectangleRounded(badge_rec, 0.3f, 2, badge_bg);
        draw_tw_text(sim.maze.spinner_mode ? "SPINNER ROTOR HAZARD ACTIVE" : t.dead_end_msg, badge_rec.x + 8.0f, badge_rec.y + 2.0f, 11.0f, Color{255, 255, 255, 255}, true);

        char ctrl_str[128];
        std::snprintf(ctrl_str, sizeof(ctrl_str), "Steer: %+.2f | Throttle: %.0f%% | Speed: %.1f px/s | Front: %.2fm", 
                      t.final_steer, (t.nn_throttle + 1.0f) * 50.0f, t.final_speed, t.front_clearance * 100.0f);
        draw_tw_text(ctrl_str, container.x + 12.0f, container.y + 84.0f, 12.0f, Color{160, 215, 255, 255});

        float bar_x = container.x + 12.0f;
        float bar_y = container.y + 104.0f;
        float bar_w = 426.0f;
        float bar_h = 10.0f;
        DrawRectangleRec({ bar_x, bar_y, bar_w, bar_h }, Color{35, 40, 55, 255});
        DrawLine(static_cast<int>(bar_x + bar_w * 0.5f), static_cast<int>(bar_y), static_cast<int>(bar_x + bar_w * 0.5f), static_cast<int>(bar_y + bar_h), Color{120, 130, 160, 255});
        
        float steer_indicator_x = (bar_x + bar_w * 0.5f) + (t.final_steer * (bar_w * 0.46f));
        DrawRectangle(static_cast<int>(steer_indicator_x - 3), static_cast<int>(bar_y - 1), 6, static_cast<int>(bar_h + 2), Color{0, 255, 200, 255});
        draw_tw_text("L", bar_x + 2.0f, bar_y - 2.0f, 10.0f, Color{140, 150, 175, 255});
        draw_tw_text("R", bar_x + bar_w - 9.0f, bar_y - 2.0f, 10.0f, Color{140, 150, 175, 255});
    }

    void draw_neuron_map(const Simulation& sim, float offset_y) const {
        Rectangle container = { 815.0f, offset_y + 434.0f, 450.0f, 356.0f };
        DrawRectangleRounded(container, 0.04f, 6, Color{20, 20, 24, 255});
        DrawRectangleRoundedLines(container, 0.04f, 6, 1.2f, Color{45, 48, 65, 255});

        draw_tw_text("LIVE NEURAL MAP (20 HIDDEN LAYERS | TWENTIETH CENTURY ARCHITECTURE)", container.x + 12.0f, offset_y + 440.0f, 12.0f, Color{150, 165, 195, 255}, true);

        const auto& leader = sim.population[sim.leader_idx];
        draw_neural_net_nodes_and_synapses(leader.brain, container);
    }
};
