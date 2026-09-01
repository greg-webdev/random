#pragma once
#include <vector>
#include <stack>
#include <queue>
#include <random>
#include <algorithm>
#include <cstring>
#include <cmath>
#include <fstream>
#include "common.hpp"

constexpr int CANVAS_RES = 200; // 200x200 fine grid (4px per cell)
constexpr float CANVAS_CELL_SIZE = 800.0f / static_cast<float>(CANVAS_RES);

struct SpinnerHazard {
    Vector2 center{ 400.0f, 400.0f };
    float angle{ 0.0f };
    float speed{ 0.35f }; // Slower than cars (0.35 deg/tick) so cars must learn to slow down & match pace
    float arm_length{ 620.0f }; // Longer than arena border (diagonal is 565.7px) so no corner is safe
    float arm_thickness{ 12.0f };
    int num_arms{ 4 };
    float hub_radius{ 26.0f };

    void update() {
        angle += speed;
        if (angle >= 360.0f) angle -= 360.0f;
    }

    bool check_collision(Vector2 p, float car_radius) const {
        float d2_hub = (p.x - center.x)*(p.x - center.x) + (p.y - center.y)*(p.y - center.y);
        if (d2_hub <= (hub_radius + car_radius)*(hub_radius + car_radius)) {
            return true;
        }

        float total_thick = arm_thickness * 0.5f + car_radius;
        float total_thick_sq = total_thick * total_thick;

        for (int i = 0; i < num_arms; ++i) {
            float arm_rad = (angle + (360.0f / num_arms) * i) * DEG2RAD;
            Vector2 arm_end = { center.x + std::cos(arm_rad) * arm_length,
                                center.y + std::sin(arm_rad) * arm_length };
            if (dist_point_to_segment_sq(p, center, arm_end) <= total_thick_sq) {
                return true;
            }
        }
        return false;
    }

    bool raycast(Vector2 origin, float ray_angle_deg, float max_dist, Vector2& out_hit, float& out_dist_pct) const {
        float rad = ray_angle_deg * DEG2RAD;
        Vector2 r_dir = { std::cos(rad), std::sin(rad) };
        Vector2 r_p2 = { origin.x + r_dir.x * max_dist, origin.y + r_dir.y * max_dist };

        bool hit_any = false;
        float closest_dist = max_dist;

        for (int i = 0; i < num_arms; ++i) {
            float arm_rad = (angle + (360.0f / num_arms) * i) * DEG2RAD;
            Vector2 arm_end = { center.x + std::cos(arm_rad) * arm_length,
                                center.y + std::sin(arm_rad) * arm_length };

            Vector2 hit_pt;
            float t_out;
            if (get_line_intersection(origin, r_p2, center, arm_end, hit_pt, t_out)) {
                float d = std::sqrt((hit_pt.x - origin.x)*(hit_pt.x - origin.x) + (hit_pt.y - origin.y)*(hit_pt.y - origin.y));
                if (d < closest_dist) {
                    closest_dist = d;
                    out_hit = hit_pt;
                    hit_any = true;
                }
            }
        }

        if (hit_any) {
            out_dist_pct = closest_dist / max_dist;
            return true;
        }
        return false;
    }
};

struct MazeCell {
    int r, c;
    bool walls[4]; // 0: Top, 1: Right, 2: Bottom, 3: Left
    bool visited;

    MazeCell() : r(0), c(0), visited(false) {
        walls[0] = true;
        walls[1] = true;
        walls[2] = true;
        walls[3] = true;
    }
};

class Maze {
public:
    MazeCell grid[ROWS][COLS];
    bool free_canvas[CANVAS_RES][CANVAS_RES]; // true = Yellow Wall, false = Black floor
    bool is_freehand_mode;
    bool is_maze_mode;
    bool spinner_mode;
    SpinnerHazard spinner;

    Vector2 start_pos_exact;
    Vector2 goal_pos_exact;
    float start_angle_exact;
    float goal_radius;

    std::vector<Vector2> shortest_path_points;
    std::vector<std::pair<int, int>> shortest_path;
    bool path_set[ROWS][COLS];
    bool dead_end_set[ROWS][COLS];
    std::vector<WallSegment> wall_segments;
    std::vector<WallSegment> dead_end_thresholds;

    Maze() : is_freehand_mode(false),
             is_maze_mode(true),
             spinner_mode(false),
             start_pos_exact{ 60.0f, 60.0f },
             goal_pos_exact{ 740.0f, 740.0f },
             start_angle_exact(0.0f),
             goal_radius(26.0f) {
        clear_free_canvas();
        generate_maze();
    }

    void clear_free_canvas() {
        is_maze_mode = false;
        for (int y = 0; y < CANVAS_RES; ++y) {
            for (int x = 0; x < CANVAS_RES; ++x) {
                // Outer perimeter is solid yellow wall
                if (x == 0 || x == CANVAS_RES - 1 || y == 0 || y == CANVAS_RES - 1) {
                    free_canvas[y][x] = true;
                } else {
                    free_canvas[y][x] = false; // Black floor
                }
            }
        }
        recompute_geometry();
    }

    void fill_free_canvas() {
        is_maze_mode = false;
        for (int y = 0; y < CANVAS_RES; ++y) {
            for (int x = 0; x < CANVAS_RES; ++x) {
                free_canvas[y][x] = true;
            }
        }
        recompute_geometry();
    }

    void setup_spinner_arena() {
        is_maze_mode = false;
        spinner_mode = true;
        clear_free_canvas();
        start_pos_exact = { 180.0f, 180.0f };
        shortest_path_points.clear();
        shortest_path.clear();
        recompute_geometry();
        if (spinner_mode) {
            shortest_path_points.clear();
        }
    }

    void rasterize_line_to_canvas(Vector2 p1, Vector2 p2, float brush_radius, bool is_wall) {
        int r_cells = static_cast<int>(std::ceil(brush_radius / CANVAS_CELL_SIZE));
        float dist_steps = std::max(1.0f, std::sqrt((p2.x - p1.x)*(p2.x - p1.x) + (p2.y - p1.y)*(p2.y - p1.y)) / 2.0f);
        int steps = static_cast<int>(dist_steps);

        for (int s = 0; s <= steps; ++s) {
            float t = (steps == 0) ? 0.0f : static_cast<float>(s) / steps;
            Vector2 p = { p1.x + t * (p2.x - p1.x), p1.y + t * (p2.y - p1.y) };

            int center_x = static_cast<int>(p.x / CANVAS_CELL_SIZE);
            int center_y = static_cast<int>(p.y / CANVAS_CELL_SIZE);

            for (int dy = -r_cells; dy <= r_cells; ++dy) {
                for (int dx = -r_cells; dx <= r_cells; ++dx) {
                    int nx = center_x + dx;
                    int ny = center_y + dy;
                    if (nx > 0 && nx < CANVAS_RES - 1 && ny > 0 && ny < CANVAS_RES - 1) {
                        float dist_sq = (dx * CANVAS_CELL_SIZE) * (dx * CANVAS_CELL_SIZE) + (dy * CANVAS_CELL_SIZE) * (dy * CANVAS_CELL_SIZE);
                        if (dist_sq <= brush_radius * brush_radius) {
                            free_canvas[ny][nx] = is_wall;
                        }
                    }
                }
            }
        }
    }

    void paint_stroke(Vector2 p1, Vector2 p2, float brush_radius, bool is_wall) {
        is_maze_mode = false;
        rasterize_line_to_canvas(p1, p2, brush_radius, is_wall);
        recompute_geometry();
    }

    void generate_maze(unsigned int seed = 0) {
        is_maze_mode = true;
        spinner_mode = false;
        start_pos_exact = { CELL_SIZE * 0.5f, CELL_SIZE * 0.5f };
        goal_pos_exact = { 800.0f - CELL_SIZE * 0.5f, 800.0f - CELL_SIZE * 0.5f };
        start_angle_exact = 0.0f;

        for (int r = 0; r < ROWS; ++r) {
            for (int c = 0; c < COLS; ++c) {
                grid[r][c].r = r;
                grid[r][c].c = c;
                grid[r][c].walls[0] = true;
                grid[r][c].walls[1] = true;
                grid[r][c].walls[2] = true;
                grid[r][c].walls[3] = true;
                grid[r][c].visited = false;
                path_set[r][c] = false;
                dead_end_set[r][c] = false;
            }
        }

        std::mt19937 rng(seed == 0 ? std::random_device{}() : seed);
        std::stack<std::pair<int, int>> cell_stack;
        grid[0][0].visited = true;
        cell_stack.push({0, 0});

        const int dr[4] = { -1, 0, 1, 0 };
        const int dc[4] = { 0, 1, 0, -1 };
        const int opposite_wall[4] = { 2, 3, 0, 1 };

        while (!cell_stack.empty()) {
            auto [curr_r, curr_c] = cell_stack.top();

            std::vector<int> neighbors;
            for (int d = 0; d < 4; ++d) {
                int nr = curr_r + dr[d];
                int nc = curr_c + dc[d];
                if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && !grid[nr][nc].visited) {
                    neighbors.push_back(d);
                }
            }

            if (!neighbors.empty()) {
                std::uniform_int_distribution<size_t> dist(0, neighbors.size() - 1);
                int chosen_dir = neighbors[dist(rng)];

                int next_r = curr_r + dr[chosen_dir];
                int next_c = curr_c + dc[chosen_dir];

                grid[curr_r][curr_c].walls[chosen_dir] = false;
                grid[next_r][next_c].walls[opposite_wall[chosen_dir]] = false;

                grid[next_r][next_c].visited = true;
                cell_stack.push({next_r, next_c});
            } else {
                cell_stack.pop();
            }
        }

        rasterize_grid_to_canvas();
        is_maze_mode = true;
        recompute_geometry();
    }

    void rasterize_grid_to_canvas() {
        for (int y = 0; y < CANVAS_RES; ++y) {
            for (int x = 0; x < CANVAS_RES; ++x) {
                free_canvas[y][x] = false;
            }
        }

        // Outer borders
        for (int x = 0; x < CANVAS_RES; ++x) {
            free_canvas[0][x] = true;
            free_canvas[CANVAS_RES - 1][x] = true;
            free_canvas[x][0] = true;
            free_canvas[x][CANVAS_RES - 1] = true;
        }

        // Raster internal maze walls as yellow lines
        for (int r = 0; r < ROWS; ++r) {
            for (int c = 0; c < COLS; ++c) {
                float x = c * CELL_SIZE;
                float y = r * CELL_SIZE;
                if (r > 0 && grid[r][c].walls[0]) {
                    rasterize_line_to_canvas({x, y}, {x + CELL_SIZE, y}, 2.8f, true);
                }
                if (c > 0 && grid[r][c].walls[3]) {
                    rasterize_line_to_canvas({x, y}, {x, y + CELL_SIZE}, 2.8f, true);
                }
            }
        }
    }

    void set_start_exact(Vector2 pos) {
        start_pos_exact.x = clampf(pos.x, 15.0f, 785.0f);
        start_pos_exact.y = clampf(pos.y, 15.0f, 785.0f);
        recompute_geometry();
    }

    void set_goal_exact(Vector2 pos) {
        goal_pos_exact.x = clampf(pos.x, 15.0f, 785.0f);
        goal_pos_exact.y = clampf(pos.y, 15.0f, 785.0f);
        recompute_geometry();
    }

    void recompute_geometry() {
        compute_shortest_path();
        build_wall_segments();
    }

    void compute_shortest_path() {
        shortest_path_points.clear();
        shortest_path.clear();
        std::memset(path_set, 0, sizeof(path_set));
        std::memset(dead_end_set, 0, sizeof(dead_end_set));

        if (spinner_mode) {
            return;
        }

        if (is_maze_mode) {
            // 1. Grid-Based Discrete Maze Pathfinding (Exact Cell-by-Cell Solution)
            int start_r = static_cast<int>(start_pos_exact.y / CELL_SIZE);
            int start_c = static_cast<int>(start_pos_exact.x / CELL_SIZE);
            int goal_r = static_cast<int>(goal_pos_exact.y / CELL_SIZE);
            int goal_c = static_cast<int>(goal_pos_exact.x / CELL_SIZE);
            start_r = static_cast<int>(clampf(static_cast<float>(start_r), 0.0f, static_cast<float>(ROWS - 1)));
            start_c = static_cast<int>(clampf(static_cast<float>(start_c), 0.0f, static_cast<float>(COLS - 1)));
            goal_r = static_cast<int>(clampf(static_cast<float>(goal_r), 0.0f, static_cast<float>(ROWS - 1)));
            goal_c = static_cast<int>(clampf(static_cast<float>(goal_c), 0.0f, static_cast<float>(COLS - 1)));

            bool visited[ROWS][COLS] = { false };
            std::pair<int, int> parent[ROWS][COLS];
            std::queue<std::pair<int, int>> q;
            q.push({start_r, start_c});
            visited[start_r][start_c] = true;
            parent[start_r][start_c] = {-1, -1};

            const int dr[4] = { -1, 0, 1, 0 };
            const int dc[4] = { 0, 1, 0, -1 };

            bool found = false;
            while (!q.empty()) {
                auto [curr_r, curr_c] = q.front();
                q.pop();

                if (curr_r == goal_r && curr_c == goal_c) {
                    found = true;
                    break;
                }

                for (int d = 0; d < 4; ++d) {
                    if (!grid[curr_r][curr_c].walls[d]) {
                        int nr = curr_r + dr[d];
                        int nc = curr_c + dc[d];
                        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && !visited[nr][nc]) {
                            visited[nr][nc] = true;
                            parent[nr][nc] = {curr_r, curr_c};
                            q.push({nr, nc});
                        }
                    }
                }
            }

            if (found) {
                std::pair<int, int> curr = {goal_r, goal_c};
                while (curr.first != -1 && curr.second != -1) {
                    shortest_path.push_back(curr);
                    path_set[curr.first][curr.second] = true;
                    curr = parent[curr.first][curr.second];
                }
                std::reverse(shortest_path.begin(), shortest_path.end());

                for (auto cell : shortest_path) {
                    shortest_path_points.push_back({ (cell.second + 0.5f) * CELL_SIZE, (cell.first + 0.5f) * CELL_SIZE });
                }
            } else {
                shortest_path_points.push_back(start_pos_exact);
                shortest_path_points.push_back(goal_pos_exact);
            }

            for (int r = 0; r < ROWS; ++r) {
                for (int c = 0; c < COLS; ++c) {
                    dead_end_set[r][c] = !path_set[r][c];
                }
            }
            return;
        }

        // 2. Freehand Canvas Pathfinding
        int start_cx = static_cast<int>(start_pos_exact.x / CANVAS_CELL_SIZE);
        int start_cy = static_cast<int>(start_pos_exact.y / CANVAS_CELL_SIZE);
        int goal_cx = static_cast<int>(goal_pos_exact.x / CANVAS_CELL_SIZE);
        int goal_cy = static_cast<int>(goal_pos_exact.y / CANVAS_CELL_SIZE);

        start_cx = static_cast<int>(clampf(static_cast<float>(start_cx), 1.0f, static_cast<float>(CANVAS_RES - 2)));
        start_cy = static_cast<int>(clampf(static_cast<float>(start_cy), 1.0f, static_cast<float>(CANVAS_RES - 2)));
        goal_cx = static_cast<int>(clampf(static_cast<float>(goal_cx), 1.0f, static_cast<float>(CANVAS_RES - 2)));
        goal_cy = static_cast<int>(clampf(static_cast<float>(goal_cy), 1.0f, static_cast<float>(CANVAS_RES - 2)));

        static bool visited[CANVAS_RES][CANVAS_RES];
        static std::pair<short, short> parent[CANVAS_RES][CANVAS_RES];
        std::memset(visited, 0, sizeof(visited));

        std::queue<std::pair<short, short>> q;
        q.push({static_cast<short>(start_cx), static_cast<short>(start_cy)});
        visited[start_cy][start_cx] = true;
        parent[start_cy][start_cx] = {-1, -1};

        const int dx[8] = { 0, 1, 0, -1, 1, -1, 1, -1 };
        const int dy[8] = { -1, 0, 1, 0, -1, -1, 1, 1 };

        bool found = false;
        while (!q.empty()) {
            auto [cx, cy] = q.front();
            q.pop();

            if (std::abs(cx - goal_cx) <= 3 && std::abs(cy - goal_cy) <= 3) {
                goal_cx = cx;
                goal_cy = cy;
                found = true;
                break;
            }

            for (int d = 0; d < 8; ++d) {
                int nx = cx + dx[d];
                int ny = cy + dy[d];

                if (nx >= 0 && nx < CANVAS_RES && ny >= 0 && ny < CANVAS_RES) {
                    if (!free_canvas[ny][nx] && !visited[ny][nx]) {
                        visited[ny][nx] = true;
                        parent[ny][nx] = {cx, cy};
                        q.push({static_cast<short>(nx), static_cast<short>(ny)});
                    }
                }
            }
        }

        if (found) {
            std::vector<Vector2> raw_pts;
            std::pair<short, short> curr = {static_cast<short>(goal_cx), static_cast<short>(goal_cy)};
            while (curr.first != -1 && curr.second != -1) {
                raw_pts.push_back({ (curr.first + 0.5f) * CANVAS_CELL_SIZE, (curr.second + 0.5f) * CANVAS_CELL_SIZE });
                int r = static_cast<int>(curr.second * CANVAS_CELL_SIZE / CELL_SIZE);
                int c = static_cast<int>(curr.first * CANVAS_CELL_SIZE / CELL_SIZE);
                if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
                    path_set[r][c] = true;
                }
                curr = parent[curr.second][curr.first];
            }
            std::reverse(raw_pts.begin(), raw_pts.end());

            shortest_path_points.push_back(start_pos_exact);
            float accum_dist = 0.0f;
            for (size_t i = 1; i < raw_pts.size(); ++i) {
                float seg_len = std::sqrt((raw_pts[i].x - raw_pts[i-1].x)*(raw_pts[i].x - raw_pts[i-1].x) + 
                                          (raw_pts[i].y - raw_pts[i-1].y)*(raw_pts[i].y - raw_pts[i-1].y));
                accum_dist += seg_len;
                if (accum_dist >= 28.0f || i == raw_pts.size() - 1) {
                    shortest_path_points.push_back(raw_pts[i]);
                    accum_dist = 0.0f;
                }
            }
        } else {
            shortest_path_points.push_back(start_pos_exact);
            shortest_path_points.push_back(goal_pos_exact);
        }

        for (int r = 0; r < ROWS; ++r) {
            for (int c = 0; c < COLS; ++c) {
                dead_end_set[r][c] = !path_set[r][c];
            }
        }
    }

    void build_wall_segments() {
        wall_segments.clear();
        wall_segments.push_back({ {0.0f, 0.0f}, {800.0f, 0.0f} });
        wall_segments.push_back({ {800.0f, 0.0f}, {800.0f, 800.0f} });
        wall_segments.push_back({ {800.0f, 800.0f}, {0.0f, 800.0f} });
        wall_segments.push_back({ {0.0f, 800.0f}, {0.0f, 0.0f} });
    }

    // High-performance continuous raycast against Yellow Wall canvas and Rotating Spinner Blades
    float cast_ray(Vector2 origin, float angle_deg, Vector2& out_hit_point) const {
        float rad = angle_deg * DEG2RAD;
        float dir_x = std::cos(rad);
        float dir_y = std::sin(rad);

        float step_size = 2.0f;
        float cur_dist = 0.0f;
        out_hit_point = { origin.x + dir_x * MAX_RAY_DIST, origin.y + dir_y * MAX_RAY_DIST };
        float wall_dist_pct = 1.0f;

        while (cur_dist < MAX_RAY_DIST) {
            cur_dist += step_size;
            float px = origin.x + dir_x * cur_dist;
            float py = origin.y + dir_y * cur_dist;

            if (px <= 2.0f || px >= 798.0f || py <= 2.0f || py >= 798.0f) {
                out_hit_point = { px, py };
                wall_dist_pct = cur_dist / MAX_RAY_DIST;
                break;
            }

            int cx = static_cast<int>(px / CANVAS_CELL_SIZE);
            int cy = static_cast<int>(py / CANVAS_CELL_SIZE);

            if (cx >= 0 && cx < CANVAS_RES && cy >= 0 && cy < CANVAS_RES) {
                if (free_canvas[cy][cx]) {
                    out_hit_point = { px, py };
                    wall_dist_pct = cur_dist / MAX_RAY_DIST;
                    break;
                }
            }
        }

        // Test spinner blade intersection if spinner is active
        if (spinner_mode) {
            Vector2 spinner_hit;
            float spinner_dist_pct;
            if (spinner.raycast(origin, angle_deg, MAX_RAY_DIST, spinner_hit, spinner_dist_pct)) {
                if (spinner_dist_pct < wall_dist_pct) {
                    out_hit_point = spinner_hit;
                    return spinner_dist_pct;
                }
            }
        }

        return wall_dist_pct;
    }

    // Wall & Spinner collision
    bool check_wall_collision(Vector2 pos, float radius = 3.2f) const {
        if (pos.x < radius || pos.x > 800.0f - radius || pos.y < radius || pos.y > 800.0f - radius) {
            return true;
        }

        // Spinner blade collision
        if (spinner_mode && spinner.check_collision(pos, radius)) {
            return true;
        }

        int r_cells = static_cast<int>(std::ceil(radius / CANVAS_CELL_SIZE));
        int cx = static_cast<int>(pos.x / CANVAS_CELL_SIZE);
        int cy = static_cast<int>(pos.y / CANVAS_CELL_SIZE);

        for (int dy = -r_cells; dy <= r_cells; ++dy) {
            for (int dx = -r_cells; dx <= r_cells; ++dx) {
                int nx = cx + dx;
                int ny = cy + dy;
                if (nx >= 0 && nx < CANVAS_RES && ny >= 0 && ny < CANVAS_RES) {
                    if (free_canvas[ny][nx]) {
                        float cell_x = (nx + 0.5f) * CANVAS_CELL_SIZE;
                        float cell_y = (ny + 0.5f) * CANVAS_CELL_SIZE;
                        float d2 = (pos.x - cell_x)*(pos.x - cell_x) + (pos.y - cell_y)*(pos.y - cell_y);
                        if (d2 < (radius + CANVAS_CELL_SIZE * 0.45f) * (radius + CANVAS_CELL_SIZE * 0.45f)) {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }

    bool save_to_file(const std::string& path) const {
        std::ofstream f(path, std::ios::binary);
        if (!f.is_open()) return false;
        const char header[8] = "MAZEFRE";
        f.write(header, 8);
        f.write(reinterpret_cast<const char*>(&start_pos_exact), sizeof(Vector2));
        f.write(reinterpret_cast<const char*>(&goal_pos_exact), sizeof(Vector2));
        f.write(reinterpret_cast<const char*>(&start_angle_exact), sizeof(float));
        f.write(reinterpret_cast<const char*>(&g_car_scale), sizeof(float));
        f.write(reinterpret_cast<const char*>(&spinner_mode), sizeof(bool));
        f.write(reinterpret_cast<const char*>(free_canvas), sizeof(free_canvas));
        return true;
    }

    bool load_from_file(const std::string& path) {
        std::ifstream f(path, std::ios::binary);
        if (!f.is_open()) return false;
        char header[8];
        f.read(header, 8);
        if (std::memcmp(header, "MAZEFRE", 7) != 0) return false;
        f.read(reinterpret_cast<char*>(&start_pos_exact), sizeof(Vector2));
        f.read(reinterpret_cast<char*>(&goal_pos_exact), sizeof(Vector2));
        f.read(reinterpret_cast<char*>(&start_angle_exact), sizeof(float));
        f.read(reinterpret_cast<char*>(&g_car_scale), sizeof(float));
        f.read(reinterpret_cast<char*>(&spinner_mode), sizeof(bool));
        f.read(reinterpret_cast<char*>(free_canvas), sizeof(free_canvas));
        recompute_geometry();
        return true;
    }
};
