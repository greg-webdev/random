package com.infiniteprinter;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import net.minecraft.client.Minecraft;

import java.io.File;
import java.io.FileReader;
import java.io.FileWriter;
import java.nio.file.Path;

public class PrinterConfig {
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static PrinterConfig INSTANCE = new PrinterConfig();

    public boolean enabled = false;
    public boolean autoBreak = true;
    public boolean breakAirBlocks = false;
    public boolean infiniteReach = true;
    public double reachDistance = 64.0;
    public int blocksPerTick = 8;
    public int breaksPerTick = 4;
    public boolean autoSwitchTool = true;
    public boolean autoSwitchItem = true;
    public boolean autoAdjustBlockState = true;
    public boolean creativePickItem = true;
    public boolean bottomToTop = true;
    public boolean redstoneSafeOrder = true;
    public boolean suppressRedstoneUpdates = true;
    public int placementCooldownTicks = 6;
    public boolean respectLayerRange = true;
    public boolean renderOverlay = true;
    public boolean useCommands = true;
    public boolean forceCommands = false;
    public boolean autoSpawnMobs = true;
    public boolean lagWatchdog = true;
    public int lagPauseTicks = 40; // 2.0 seconds pause (20 tps * 2)
    public int maxTickDeltaMs = 250; // If client freezes > 250ms (quarter-second freeze)
    public float maxServerTickTimeMs = 52.0f; // If server tick average > 52ms (TPS dropping below 20)
    public int minFpsThreshold = 5; // If client FPS drops below 5

    public static PrinterConfig getInstance() {
        return INSTANCE;
    }

    private static File getConfigFile() {
        Minecraft client = Minecraft.getInstance();
        File baseDir = client.gameDirectory != null ? client.gameDirectory : new File(".");
        File configDir = new File(baseDir, "config");
        if (!configDir.exists()) {
            configDir.mkdirs();
        }
        return new File(configDir, "litematica_infinite_printer.json");
    }

    public static void load() {
        File file = getConfigFile();
        if (file.exists()) {
            try (FileReader reader = new FileReader(file)) {
                PrinterConfig loaded = GSON.fromJson(reader, PrinterConfig.class);
                if (loaded != null) {
                    INSTANCE = loaded;
                }
            } catch (Exception e) {
                InfinitePrinterMod.LOGGER.error("Failed to load printer config", e);
            }
        } else {
            save();
        }
    }

    public static void save() {
        File file = getConfigFile();
        try (FileWriter writer = new FileWriter(file)) {
            GSON.toJson(INSTANCE, writer);
        } catch (Exception e) {
            InfinitePrinterMod.LOGGER.error("Failed to save printer config", e);
        }
    }
}
