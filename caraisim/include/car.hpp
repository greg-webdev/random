#pragma once
#include <vector>
#include <cmath>
#include <algorithm>
#include <set>
#include <cstring>
#include <cstdio>
#include "common.hpp"
#include "neural_net.hpp"
#include "maze.hpp"

struct AIThoughtTelemetry {
    int target_checkpoint{0};
    int total_checkpoints{0};
    float target_angle{0.0f};
    float angle_delta{0.0f};
    float front_clearance{1.0f};
    float left_clearance{1.0f};
    float right_clearance{1.0f};
    bool dead_end_rejected{false};
    char dead_end_msg[64]{"Corridor Clear"};
    char thought_summary[128]{"Initializing"};
    float nn_steer{0.0f};
    float nn_throttle{0.0f};
    float nn_brake{0.0f};
    float final_steer{0.0f};
    float final_speed{0.0f};
};

class Car {
public:
    int id;
    Vector2 pos;
    float angle; // Heading in degrees
    float speed;
    bool alive;
    bool finished;

    float fitness;
    float cumulative_score;
    int current_checkpoint_idx;
    int last_progress_tick;
    int ticks_alive;

    float sensor_values[NUM_RAYS];
    Vector2 ray_endpoints[NUM_RAYS];

    NeuralNetwork brain;
    std::set<std::pair<int, int>> visited_correct_squares;
    std::set<std::pair<int, int>> all_visited_squares;
    int last_new_square_tick;
    bool has_gone_off_course;
    int off_course_ticks;

    AIThoughtTelemetry telemetry;

    Car(int car_id = 0) : id(car_id), speed(1.0f), alive(true), finished(false),
                          fitness(0.0f), cumulative_score(0.0f), current_checkpoint_idx(0),
                          last_progress_tick(0), ticks_alive(0), last_new_square_tick(0),
                          has_gone_off_course(false), off_course_ticks(0) {
        reset_to_start(nullptr);
    }

    void reset_to_start(const Maze* maze) {
        if (maze) {
            pos = maze->start_pos_exact;
            angle = maze->start_angle_exact;
        } else {
            pos = { 40.0f, 40.0f };
            angle = 0.0f;
        }

        speed = 1.0f;
        alive = true;
        finished = false;
        fitness = 0.0f;
        cumulative_score = 0.0f;
        current_checkpoint_idx = 0;
        last_progress_tick = 0;
        ticks_alive = 0;
        last_new_square_tick = 0;
        has_gone_off_course = false;
        off_course_ticks = 0;
        visited_correct_squares.clear();
        all_visited_squares.clear();

        int start_r = static_cast<int>(pos.y / CELL_SIZE);
        int start_c = static_cast<int>(pos.x / CELL_SIZE);
        visited_correct_squares.insert({start_r, start_c});
        all_visited_squares.insert({start_r, start_c});

        telemetry = AIThoughtTelemetry{};

        if (maze && maze->shortest_path_points.size() > 1) {
            auto next_pt = maze->shortest_path_points[1];
            angle = std::atan2(next_pt.y - pos.y, next_pt.x - pos.x) * RAD2DEG;
        }

        for (int i = 0; i < NUM_RAYS; ++i) {
            sensor_values[i] = 1.0f;
            ray_endpoints[i] = pos;
        }
    }

    void update_sensors(const Maze& maze) {
        if (!alive) return;

        float step = FOV_DEG / (NUM_RAYS - 1);
        for (int i = 0; i < NUM_RAYS; ++i) {
            float rel_angle = -85.0f + i * step;
            float ray_angle = angle + rel_angle;
            sensor_values[i] = maze.cast_ray(pos, ray_angle, ray_endpoints[i]);
        }
    }

    void update(int current_tick, const Maze& maze) {
        if (!alive) return;
        ticks_alive++;

        update_sensors(maze);

        float front_min = 1.0f;
        float left_clearance = 0.0f;
        float right_clearance = 0.0f;

        for (int i = 0; i < NUM_RAYS; ++i) {
            float rel_angle = -85.0f + i * (FOV_DEG / (NUM_RAYS - 1));
            float d = sensor_values[i];

            if (std::fabs(rel_angle) < 30.0f && d < front_min) {
                front_min = d;
            }

            if (rel_angle < -10.0f) {
                left_clearance += d;
            } else if (rel_angle > 10.0f) {
                right_clearance += d;
            }
        }
        left_clearance /= 28.0f;
        right_clearance /= 28.0f;

        // 2. Target Vector & Angle (Disabled in Spinner Survival Mode)
        float optimal_steer = 0.0f;
        float path_delta = 0.0f;
        Vector2 target_pt = pos;
        int total_ckpts = static_cast<int>(maze.shortest_path_points.size());

        if (!maze.spinner_mode) {
            target_pt = maze.goal_pos_exact;
            if (total_ckpts > 0) {
                int next_ckpt_idx = std::min(current_checkpoint_idx + 1, total_ckpts - 1);
                target_pt = maze.shortest_path_points[next_ckpt_idx];
            }
            float target_angle = std::atan2(target_pt.y - pos.y, target_pt.x - pos.x) * RAD2DEG;
            path_delta = angle_diff_deg(target_angle, angle);
            optimal_steer = clampf(path_delta / 32.0f, -1.0f, 1.0f);
        }

        // 3. Neural Engine Output
        std::vector<float> outputs = brain.feed_forward(sensor_values);
        float nn_steering = outputs[0];
        float nn_throttle = outputs[1];
        float nn_brake = outputs[2];

        // 4. Centering & Corner Steering Assistance
        float centering_steer = (left_clearance < 0.35f) ? (0.35f - left_clearance) * 2.2f :
                               ((right_clearance < 0.35f) ? -(0.35f - right_clearance) * 2.2f : 0.0f);

        float corner_turn = 0.0f;
        if (front_min < 0.50f) {
            float turn_intensity = (0.50f - front_min) / 0.50f;
            corner_turn = (left_clearance > right_clearance) ? -1.0f * turn_intensity * 2.5f : 1.0f * turn_intensity * 2.5f;
        }

        float total_steering;
        if (maze.spinner_mode) {
            total_steering = clampf(centering_steer * 0.40f + corner_turn * 1.2f + nn_steering * 0.50f, -1.0f, 1.0f);
        } else {
            total_steering = clampf(optimal_steer * 0.65f + centering_steer * 0.30f + corner_turn + nn_steering * 0.20f, -1.0f, 1.0f);
        }

        angle += total_steering * 12.0f;
        angle = normalize_angle_deg(angle);

        float max_safe_speed = 1.3f + front_min * front_min * 35.0f;
        float desired_speed = 1.5f + (nn_throttle + 1.0f) * 0.5f * 58.5f;
        if (nn_brake > 0.0f) desired_speed -= nn_brake * 15.0f;

        float target_speed = clampf(std::min(desired_speed, max_safe_speed), 1.2f, 60.0f);
        speed += (target_speed - speed) * 0.25f;
        speed = clampf(speed, 1.2f, 60.0f);

        telemetry.target_checkpoint = current_checkpoint_idx;
        telemetry.total_checkpoints = total_ckpts;
        telemetry.target_angle = 0.0f;
        telemetry.angle_delta = path_delta;
        telemetry.front_clearance = front_min;
        telemetry.left_clearance = left_clearance;
        telemetry.right_clearance = right_clearance;
        telemetry.dead_end_rejected = false;
        std::strncpy(telemetry.dead_end_msg, maze.spinner_mode ? "SPINNER HAZARD ACTIVE" : (maze.is_maze_mode ? "Dead-End Block [Active]" : "Freehand Canvas Mode"), sizeof(telemetry.dead_end_msg));
        telemetry.nn_steer = nn_steering;
        telemetry.nn_throttle = nn_throttle;
        telemetry.nn_brake = nn_brake;
        telemetry.final_steer = total_steering;
        telemetry.final_speed = speed;

        if (maze.spinner_mode) {
            if (front_min < 0.35f) {
                std::snprintf(telemetry.thought_summary, sizeof(telemetry.thought_summary), "Hazard ahead! Slowing & evading (%.1f px/s)", speed);
            } else {
                std::snprintf(telemetry.thought_summary, sizeof(telemetry.thought_summary), "Surviving: Orbiting clear sector (%d ticks)", ticks_alive);
            }
        } else {
            if (front_min < 0.35f) {
                std::snprintf(telemetry.thought_summary, sizeof(telemetry.thought_summary), "Wall ahead: Corner-braking to %.1f px/s", speed);
            } else {
                std::snprintf(telemetry.thought_summary, sizeof(telemetry.thought_summary), "Full throttle along track (Delta %.1f°)", path_delta);
            }
        }

        // Sub-stepped movement
        float rad = angle * DEG2RAD;
        Vector2 dir = { std::cos(rad), std::sin(rad) };
        float remaining_dist = speed;
        const float max_step = 1.5f;

        while (remaining_dist > 0.0f) {
            float step = std::min(remaining_dist, max_step);
            Vector2 next_pos = { pos.x + dir.x * step, pos.y + dir.y * step };

            pos = next_pos;
            remaining_dist -= step;

            // Strict Wall & Spinner Collision Rule
            if (maze.check_wall_collision(pos, 2.2f * g_car_scale)) {
                alive = false;
                return;
            }

            int curr_r = static_cast<int>(pos.y / CELL_SIZE);
            int curr_c = static_cast<int>(pos.x / CELL_SIZE);

            if (curr_r >= 0 && curr_r < ROWS && curr_c >= 0 && curr_c < COLS) {
                if (all_visited_squares.find({curr_r, curr_c}) == all_visited_squares.end()) {
                    all_visited_squares.insert({curr_r, curr_c});
                    last_new_square_tick = current_tick;
                }
                if (maze.path_set[curr_r][curr_c]) {
                    visited_correct_squares.insert({curr_r, curr_c});
                }
            }

            // Normal Maze mode checkpoint and goal triggers (Disabled in Spinner Survival Mode)
            if (!maze.spinner_mode) {
                float d_to_ckpt = std::sqrt((target_pt.x - pos.x)*(target_pt.x - pos.x) + (target_pt.y - pos.y)*(target_pt.y - pos.y));
                if (d_to_ckpt < 30.0f * g_car_scale && current_checkpoint_idx + 1 < total_ckpts) {
                    current_checkpoint_idx++;
                    last_progress_tick = current_tick;
                    cumulative_score += 50.0f + (speed * 12.0f);
                }

                float d_to_goal = std::sqrt((maze.goal_pos_exact.x - pos.x)*(maze.goal_pos_exact.x - pos.x) + 
                                            (maze.goal_pos_exact.y - pos.y)*(maze.goal_pos_exact.y - pos.y));
                if (d_to_goal <= maze.goal_radius) {
                    finished = true;
                    alive = false;
                    cumulative_score += 2000.0f + std::max(0, MAX_GEN_TICKS - current_tick) * 5.0f;
                    fitness = (current_checkpoint_idx * 150.0f) + cumulative_score + 3000.0f;
                    return;
                }
            }
        }

        // Speed & Survival rewards
        if (speed > 0.0f) {
            float speed_reward = 0.5f + (speed * 1.5f) + ((speed * speed) * 0.08f);
            cumulative_score += speed_reward;
        }

        if (maze.spinner_mode) {
            fitness = (ticks_alive * 3.0f) + cumulative_score + (speed * 1.5f);
            if (front_min < 0.40f) {
                std::snprintf(telemetry.thought_summary, sizeof(telemetry.thought_summary), "EVADING SPINNER! (Dist %.1fm | %d ticks)", front_min * 100.0f, ticks_alive);
            } else {
                std::snprintf(telemetry.thought_summary, sizeof(telemetry.thought_summary), "SURVIVING: Orbiting Spinner Hazard (%d ticks)", ticks_alive);
            }
        } else {
            fitness = (current_checkpoint_idx * 150.0f) + cumulative_score;
        }
    }
};
