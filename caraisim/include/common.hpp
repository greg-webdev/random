#pragma once
#include <cmath>
#include <vector>
#include <string>
#include <algorithm>
#include <iostream>
#include "raylib.h"

// Screen & Titlebar Dimensions
constexpr int TITLEBAR_HEIGHT = 30;
constexpr int SCREEN_WIDTH = 1280;
constexpr int SCREEN_HEIGHT = 830; // 30px Windows 7 Titlebar + 800px Content

// Maze Dimensions
constexpr int MAZE_WIDTH = 800;
constexpr int MAZE_HEIGHT = 800;
constexpr int ROWS = 15;
constexpr int COLS = 15;
constexpr float CELL_SIZE = 800.0f / 15.0f; // ~53.3333f

// Sidebar Dimensions
constexpr int SIDEBAR_X = 800;
constexpr int SIDEBAR_WIDTH = 480;
constexpr int SIDEBAR_HEIGHT = 800;

// AI & Physics Parameters
constexpr int POPULATION_SIZE = 200;
constexpr int NUM_RAYS = 64;
constexpr float FOV_DEG = 170.0f; // -85 to +85 degrees
constexpr float MAX_RAY_DIST = 100.0f;
constexpr int MAX_GEN_TICKS = 3000; // Generous limit: runs until all cars die or reach the end
constexpr int STAGNATION_LIMIT = 1500; // 25 seconds (1500 ticks at 60 FPS) without moving to a new square
constexpr float MUTATION_RATE = 0.10f; // 10%
constexpr float MUTATION_STDDEV = 0.15f;

// Layer Dimensions (1 Input + 20 Hidden + 1 Output = 22 Stages)
constexpr int NUM_LAYERS = 22;
constexpr int LAYER_SIZES[22] = { 
    64,                                         // Input (64 rays)
    52, 48, 44, 42, 40,                         // Hidden 1-5
    38, 36, 34, 32, 30,                         // Hidden 6-10
    28, 26, 24, 22, 20,                         // Hidden 11-15
    18, 16, 14, 12, 8,                          // Hidden 16-20
    3                                           // Output (Steering, Throttle, Brake)
};

struct WallSegment {
    Vector2 p1;
    Vector2 p2;
};

inline float clampf(float val, float min_val, float max_val) {
    if (val < min_val) return min_val;
    if (val > max_val) return max_val;
    return val;
}

inline float normalize_angle_deg(float angle) {
    while (angle > 180.0f) angle -= 360.0f;
    while (angle < -180.0f) angle += 360.0f;
    return angle;
}

inline float angle_diff_deg(float a, float b) {
    return normalize_angle_deg(a - b);
}

// Fast line-line segment intersection
inline bool get_line_intersection(Vector2 p1, Vector2 p2, Vector2 p3, Vector2 p4, Vector2& hit_point, float& t_out) {
    float s1_x = p2.x - p1.x;
    float s1_y = p2.y - p1.y;
    float s2_x = p4.x - p3.x;
    float s2_y = p4.y - p3.y;

    float denom = (-s2_x * s1_y + s1_x * s2_y);
    if (std::fabs(denom) < 1e-6f) return false;

    float s = (-s1_y * (p1.x - p3.x) + s1_x * (p1.y - p3.y)) / denom;
    float t = ( s2_x * (p1.y - p3.y) - s2_y * (p1.x - p3.x)) / denom;

    if (s >= 0.0f && s <= 1.0f && t >= 0.0f && t <= 1.0f) {
        hit_point.x = p1.x + (t * s1_x);
        hit_point.y = p1.y + (t * s1_y);
        t_out = t;
        return true;
    }
    return false;
}

// Distance squared from point to line segment
inline float dist_point_to_segment_sq(Vector2 p, Vector2 a, Vector2 b) {
    float l2 = (b.x - a.x)*(b.x - a.x) + (b.y - a.y)*(b.y - a.y);
    if (l2 == 0.0f) return (p.x - a.x)*(p.x - a.x) + (p.y - a.y)*(p.y - a.y);
    float t = ((p.x - a.x)*(b.x - a.x) + (p.y - a.y)*(b.y - a.y)) / l2;
    t = clampf(t, 0.0f, 1.0f);
    Vector2 proj = { a.x + t * (b.x - a.x), a.y + t * (b.y - a.y) };
    return (p.x - proj.x)*(p.x - proj.x) + (p.y - proj.y)*(p.y - proj.y);
}

// Global Car Scaling Parameter (Adjustable in Map Editor / Simulation)
inline float g_car_scale = 1.0f;
