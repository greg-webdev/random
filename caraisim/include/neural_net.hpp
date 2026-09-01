#pragma once
#include <vector>
#include <cmath>
#include <random>
#include <fstream>
#include <cstring>
#include "common.hpp"

struct Layer {
    int in_size;
    int out_size;
    std::vector<float> weights; // Size: in_size * out_size
    std::vector<float> biases;  // Size: out_size

    Layer() : in_size(0), out_size(0) {}
    Layer(int in_s, int out_s) : in_size(in_s), out_size(out_s) {
        weights.resize(in_size * out_size);
        biases.resize(out_size);
    }
};

class NeuralNetwork {
public:
    std::vector<Layer> layers;
    // Activations for visualization (7 layers: 1 input + 5 hidden + 1 output)
    std::vector<std::vector<float>> activations;

    NeuralNetwork() {
        init_network();
    }

    void init_network() {
        layers.clear();
        activations.clear();

        // NUM_LAYERS - 1 weight transitions across NUM_LAYERS stages:
        for (int i = 0; i < NUM_LAYERS - 1; ++i) {
            layers.emplace_back(LAYER_SIZES[i], LAYER_SIZES[i + 1]);
        }

        for (int i = 0; i < NUM_LAYERS; ++i) {
            activations.emplace_back(LAYER_SIZES[i], 0.0f);
        }

        randomize();
    }

    void randomize() {
        static std::mt19937 rng(std::random_device{}());
        for (auto& layer : layers) {
            // Xavier / Glorot uniform initialization
            float limit = std::sqrt(6.0f / (layer.in_size + layer.out_size));
            std::uniform_real_distribution<float> dist(-limit, limit);
            for (auto& w : layer.weights) {
                w = dist(rng);
            }
            for (auto& b : layer.biases) {
                b = dist(rng) * 0.1f;
            }
        }
    }

    // Forward pass
    // inputs: 64 float values
    // outputs: 3 float values (Steering, Throttle, Brake)
    std::vector<float> feed_forward(const float* inputs) {
        // Copy inputs to activation layer 0
        for (int i = 0; i < LAYER_SIZES[0]; ++i) {
            activations[0][i] = inputs[i];
        }

        // Propagate through all layers with dot_product(inputs, weights) + bias and tanh()
        for (size_t l = 0; l < layers.size(); ++l) {
            const Layer& layer = layers[l];
            const auto& prev_act = activations[l];
            auto& curr_act = activations[l + 1];

            for (int j = 0; j < layer.out_size; ++j) {
                float sum = layer.biases[j];
                for (int i = 0; i < layer.in_size; ++i) {
                    sum += prev_act[i] * layer.weights[i * layer.out_size + j];
                }
                curr_act[j] = std::tanh(sum);
            }
        }

        return activations.back();
    }

    // Clone from parent and mutate weights & biases
    void clone_and_mutate_from(const NeuralNetwork& parent, float rate = MUTATION_RATE, float stddev = MUTATION_STDDEV) {
        static std::mt19937 rng(std::random_device{}());
        std::uniform_real_distribution<float> prob_dist(0.0f, 1.0f);
        std::normal_distribution<float> norm_dist(0.0f, stddev);

        for (size_t l = 0; l < layers.size(); ++l) {
            const Layer& p_layer = parent.layers[l];
            Layer& my_layer = layers[l];

            for (size_t i = 0; i < my_layer.weights.size(); ++i) {
                my_layer.weights[i] = p_layer.weights[i];
                if (prob_dist(rng) < rate) {
                    my_layer.weights[i] += norm_dist(rng);
                }
            }

            for (size_t i = 0; i < my_layer.biases.size(); ++i) {
                my_layer.biases[i] = p_layer.biases[i];
                if (prob_dist(rng) < rate) {
                    my_layer.biases[i] += norm_dist(rng);
                }
            }
        }
    }

    // Direct copy
    void copy_from(const NeuralNetwork& other) {
        for (size_t l = 0; l < layers.size(); ++l) {
            layers[l].weights = other.layers[l].weights;
            layers[l].biases = other.layers[l].biases;
        }
    }

    // Binary file serialization (.AI format)
    bool save_to_file(const std::string& filepath) const {
        std::ofstream out(filepath, std::ios::binary);
        if (!out.is_open()) return false;

        const char magic[8] = "MAZEAI1";
        out.write(magic, 8);

        int num_layers = NUM_LAYERS;
        out.write(reinterpret_cast<const char*>(&num_layers), sizeof(int));
        out.write(reinterpret_cast<const char*>(LAYER_SIZES), sizeof(int) * NUM_LAYERS);

        for (const auto& layer : layers) {
            int w_size = static_cast<int>(layer.weights.size());
            out.write(reinterpret_cast<const char*>(&w_size), sizeof(int));
            out.write(reinterpret_cast<const char*>(layer.weights.data()), sizeof(float) * w_size);

            int b_size = static_cast<int>(layer.biases.size());
            out.write(reinterpret_cast<const char*>(&b_size), sizeof(int));
            out.write(reinterpret_cast<const char*>(layer.biases.data()), sizeof(float) * b_size);
        }

        return out.good();
    }

    // Binary file deserialization (.AI format)
    bool load_from_file(const std::string& filepath) {
        std::ifstream in(filepath, std::ios::binary);
        if (!in.is_open()) return false;

        char magic[8];
        in.read(magic, 8);
        if (std::memcmp(magic, "MAZEAI1", 7) != 0) {
            std::cerr << "Invalid .ai file format: bad magic header." << std::endl;
            return false;
        }

        int num_layers = 0;
        in.read(reinterpret_cast<char*>(&num_layers), sizeof(int));
        if (num_layers != NUM_LAYERS) {
            std::cerr << "Incompatible layer count: " << num_layers << std::endl;
            return false;
        }

        int file_sizes[NUM_LAYERS];
        in.read(reinterpret_cast<char*>(file_sizes), sizeof(int) * NUM_LAYERS);
        for (int i = 0; i < NUM_LAYERS; ++i) {
            if (file_sizes[i] != LAYER_SIZES[i]) {
                std::cerr << "Mismatch in layer size at index " << i << std::endl;
                return false;
            }
        }

        for (auto& layer : layers) {
            int w_size = 0;
            in.read(reinterpret_cast<char*>(&w_size), sizeof(int));
            if (w_size != static_cast<int>(layer.weights.size())) return false;
            in.read(reinterpret_cast<char*>(layer.weights.data()), sizeof(float) * w_size);

            int b_size = 0;
            in.read(reinterpret_cast<char*>(&b_size), sizeof(int));
            if (b_size != static_cast<int>(layer.biases.size())) return false;
            in.read(reinterpret_cast<char*>(layer.biases.data()), sizeof(float) * b_size);
        }

        return in.good();
    }
};
