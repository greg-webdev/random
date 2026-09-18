package com.worldmanager.config;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.worldmanager.world.WorldType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.File;
import java.io.FileReader;
import java.io.FileWriter;
import java.nio.file.Files;
import java.nio.file.Path;

public class WorldConfig {
	private static final Logger LOGGER = LoggerFactory.getLogger("WorldManager/Config");
	private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
	private static final Path CONFIG_DIR = Path.of("world_manager_data");
	private static final Path CONFIG_FILE = CONFIG_DIR.resolve("config.json");

	private static WorldConfig instance = new WorldConfig();

	private String currentWorldType = WorldType.SKYBLOCK_V1.getId();
	private String inventoryMode = "single"; // "single" or "all"
	private int oneblockMinedCount = 0;

	public static WorldConfig get() {
		return instance;
	}

	public static void load() {
		try {
			if (Files.exists(CONFIG_FILE)) {
				try (FileReader reader = new FileReader(CONFIG_FILE.toFile())) {
					WorldConfig loaded = GSON.fromJson(reader, WorldConfig.class);
					if (loaded != null) {
						instance = loaded;
						LOGGER.info("Loaded config: WorldType={}, InvMode={}, OneBlockMined={}",
							instance.currentWorldType, instance.inventoryMode, instance.oneblockMinedCount);
						return;
					}
				}
			}
			save();
		} catch (Exception e) {
			LOGGER.error("Failed to load WorldManager config: ", e);
		}
	}

	public static void save() {
		try {
			if (!Files.exists(CONFIG_DIR)) {
				Files.createDirectories(CONFIG_DIR);
			}
			try (FileWriter writer = new FileWriter(CONFIG_FILE.toFile())) {
				GSON.toJson(instance, writer);
			}
		} catch (Exception e) {
			LOGGER.error("Failed to save WorldManager config: ", e);
		}
	}

	public WorldType getCurrentWorldType() {
		return WorldType.fromString(currentWorldType).orElse(WorldType.SKYBLOCK_V1);
	}

	public void setCurrentWorldType(WorldType type) {
		this.currentWorldType = type.getId();
		save();
	}

	public String getInventoryMode() {
		return inventoryMode != null ? inventoryMode : "single";
	}

	public boolean isPerWorldInventory() {
		return "single".equalsIgnoreCase(getInventoryMode());
	}

	public void setInventoryMode(String mode) {
		this.inventoryMode = "all".equalsIgnoreCase(mode) ? "all" : "single";
		save();
	}

	public int getOneblockMinedCount() {
		return oneblockMinedCount;
	}

	public void setOneblockMinedCount(int count) {
		this.oneblockMinedCount = Math.max(0, count);
		save();
	}

	public void incrementOneblockMined() {
		this.oneblockMinedCount++;
		if (this.oneblockMinedCount % 10 == 0) {
			save();
		}
	}
}
