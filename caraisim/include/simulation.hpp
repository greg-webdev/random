#pragma once
#include <vector>
#include <set>
#include <algorithm>
#include <iostream>
#include "common.hpp"
#include "maze.hpp"
#include "car.hpp"

class Simulation {
public:
    Maze maze;
    std::vector<Car> population;
    int generation;
    int current_tick;
    int leader_idx;
    float best_overall_fitness;
    int max_checkpoint_overall;
    int stagnation_generations;
    float current_mutation_rate;
    float current_mutation_stddev;
    NeuralNetwork champion_brain;
    std::set<std::pair<int, int>> global_visited_correct_squares;

    Simulation() : generation(1), current_tick(0), leader_idx(0),
                   best_overall_fitness(0.0f), max_checkpoint_overall(0),
                   stagnation_generations(0),
                   current_mutation_rate(MUTATION_RATE),
                   current_mutation_stddev(MUTATION_STDDEV) {
        init_population();
    }

    void init_population() {
        population.clear();
        for (int i = 0; i < POPULATION_SIZE; ++i) {
            population.emplace_back(i);
            population.back().reset_to_start(&maze);
        }
        champion_brain.copy_from(population[0].brain);
        leader_idx = 0;
        global_visited_correct_squares.clear();
        int sr = static_cast<int>(maze.start_pos_exact.y / CELL_SIZE);
        int sc = static_cast<int>(maze.start_pos_exact.x / CELL_SIZE);
        global_visited_correct_squares.insert({sr, sc});
        best_overall_fitness = 0.0f;
        max_checkpoint_overall = 0;
        stagnation_generations = 0;
        current_mutation_rate = MUTATION_RATE;
        current_mutation_stddev = MUTATION_STDDEV;
    }

    void reset_maze(unsigned int seed = 0) {
        maze.generate_maze(seed);
        global_visited_correct_squares.clear();
        int sr = static_cast<int>(maze.start_pos_exact.y / CELL_SIZE);
        int sc = static_cast<int>(maze.start_pos_exact.x / CELL_SIZE);
        global_visited_correct_squares.insert({sr, sc});
        for (auto& car : population) {
            car.reset_to_start(&maze);
        }
        current_tick = 0;
        leader_idx = 0;
        best_overall_fitness = 0.0f;
        max_checkpoint_overall = 0;
        stagnation_generations = 0;
        current_mutation_rate = MUTATION_RATE;
        current_mutation_stddev = MUTATION_STDDEV;
    }

    void apply_custom_map() {
        maze.recompute_geometry();
        global_visited_correct_squares.clear();
        int sr = static_cast<int>(maze.start_pos_exact.y / CELL_SIZE);
        int sc = static_cast<int>(maze.start_pos_exact.x / CELL_SIZE);
        global_visited_correct_squares.insert({sr, sc});
        for (auto& car : population) {
            car.reset_to_start(&maze);
        }
        current_tick = 0;
        leader_idx = 0;
        best_overall_fitness = 0.0f;
        max_checkpoint_overall = 0;
    }

    void update() {
        current_tick++;
        if (maze.spinner_mode) {
            maze.spinner.update();
        }
        int alive_count = 0;
        float max_fitness_on_course = -1.0f;
        int best_alive_on_course = -1;
        float max_fitness_any = -1.0f;
        int best_alive_any = -1;

        for (int i = 0; i < POPULATION_SIZE; ++i) {
            auto& car = population[i];
            if (car.alive) {
                car.update(current_tick, maze);

                // Collect visited correct squares
                for (const auto& sq : car.visited_correct_squares) {
                    global_visited_correct_squares.insert(sq);
                }

                if (car.alive) {
                    alive_count++;
                    if (!car.has_gone_off_course && car.fitness > max_fitness_on_course) {
                        max_fitness_on_course = car.fitness;
                        best_alive_on_course = i;
                    }
                    if (car.fitness > max_fitness_any) {
                        max_fitness_any = car.fitness;
                        best_alive_any = i;
                    }
                }
            }
        }

        // Update leader: Strict priority to cars that stayed on-course
        if (best_alive_on_course != -1) {
            leader_idx = best_alive_on_course;
        } else if (best_alive_any != -1) {
            leader_idx = best_alive_any;
        }

        // Generation concludes only when all cars are dead/finished (or safety max limit)
        if (alive_count == 0 || current_tick >= MAX_GEN_TICKS) {
            next_generation();
        }
    }

    void next_generation() {
        generation++;
        current_tick = 0;

        // 1. Find top performer that stayed strictly on course
        int best_idx = -1;
        float highest_fit = -1.0f;
        int max_gen_checkpoint = 0;
        int finished_count = 0;

        for (int i = 0; i < POPULATION_SIZE; ++i) {
            if (population[i].finished) {
                finished_count++;
            }
            if (!population[i].has_gone_off_course) {
                if (population[i].current_checkpoint_idx > max_gen_checkpoint) {
                    max_gen_checkpoint = population[i].current_checkpoint_idx;
                }
                if (population[i].fitness > highest_fit) {
                    highest_fit = population[i].fitness;
                    best_idx = i;
                }
            }
        }

        bool made_progress = false;
        if (best_idx != -1) {
            if (finished_count > 0 || max_gen_checkpoint > max_checkpoint_overall || highest_fit > best_overall_fitness + 2.0f) {
                made_progress = true;
            }
        }

        NeuralNetwork parent_brain;

        if (finished_count == 0) {
            // Rule: If NO ONE reached the end, ALL of them get punished and NONE of them mutate (0% mutation rate)
            stagnation_generations++;
            current_mutation_rate = 0.0f;
            current_mutation_stddev = 0.0f;

            for (int i = 0; i < POPULATION_SIZE; ++i) {
                population[i].fitness = std::max(0.0f, population[i].fitness * 0.40f - 150.0f);
                population[i].cumulative_score = std::max(0.0f, population[i].cumulative_score * 0.40f - 150.0f);
            }

            if (best_idx != -1) {
                parent_brain.copy_from(population[best_idx].brain);
            } else {
                parent_brain.copy_from(champion_brain);
            }

            std::cout << "[ZERO FINISHERS PUNISHED] 0 cars reached the goal in Gen " << (generation - 1)
                      << ". Universal punishment applied & mutation locked to 0%." << std::endl;
        } else if (finished_count >= static_cast<int>(POPULATION_SIZE * 0.25f)) {
            // Over 25% reached the goal successfully! Revert mutation to 5% for precise fine-tuning
            stagnation_generations = 0;
            current_mutation_rate = 0.05f; // 5% fine-tuning rate
            current_mutation_stddev = 0.08f;
            max_checkpoint_overall = std::max(max_checkpoint_overall, max_gen_checkpoint);
            best_overall_fitness = std::max(best_overall_fitness, highest_fit);

            champion_brain.copy_from(population[best_idx].brain);
            parent_brain.copy_from(population[best_idx].brain);
            std::cout << "[MASTERY] " << finished_count << "/" << POPULATION_SIZE 
                      << " cars (" << (finished_count * 100 / POPULATION_SIZE) 
                      << "%) reached the goal! Reverting mutation rate to 5%." << std::endl;
        } else {
            // Progress: 1 to 49 cars reached the goal! Standard adaptive progression
            stagnation_generations = 0;
            current_mutation_rate = MUTATION_RATE;
            current_mutation_stddev = MUTATION_STDDEV;
            max_checkpoint_overall = std::max(max_checkpoint_overall, max_gen_checkpoint);
            best_overall_fitness = std::max(best_overall_fitness, highest_fit);

            champion_brain.copy_from(population[best_idx].brain);
            parent_brain.copy_from(population[best_idx].brain);
            std::cout << "[PROGRESS] " << finished_count << "/" << POPULATION_SIZE 
                      << " cars reached the goal! Standard mutation rate active." << std::endl;
        }

        // Elitism: Car 0 keeps champion/best brain without mutation
        population[0].brain.copy_from(parent_brain);
        population[0].reset_to_start(&maze);

        // Mutate cars 1 to POPULATION_SIZE-1 from the parent brain using current mutation rate
        for (int i = 1; i < POPULATION_SIZE; ++i) {
            population[i].brain.clone_and_mutate_from(parent_brain, current_mutation_rate, current_mutation_stddev);
            population[i].reset_to_start(&maze);
        }

        leader_idx = 0;
    }

    int get_alive_count() const {
        int count = 0;
        for (const auto& car : population) {
            if (car.alive) count++;
        }
        return count;
    }

    bool import_brain(const std::string& filepath) {
        NeuralNetwork imported;
        if (imported.load_from_file(filepath)) {
            champion_brain.copy_from(imported);
            population[0].brain.copy_from(imported);
            population[0].reset_to_start(&maze);

            for (int i = 1; i < POPULATION_SIZE; ++i) {
                population[i].brain.clone_and_mutate_from(imported, MUTATION_RATE, MUTATION_STDDEV);
                population[i].reset_to_start(&maze);
            }
            current_tick = 0;
            leader_idx = 0;
            return true;
        }
        return false;
    }

    bool export_brain(const std::string& filepath) {
        // Export leader or champion brain
        if (population[leader_idx].fitness >= best_overall_fitness) {
            return population[leader_idx].brain.save_to_file(filepath);
        } else {
            return champion_brain.save_to_file(filepath);
        }
    }
};
