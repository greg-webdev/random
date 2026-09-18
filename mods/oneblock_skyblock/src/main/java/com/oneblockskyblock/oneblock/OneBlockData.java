package com.oneblockskyblock.oneblock;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import net.minecraft.core.BlockPos;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.level.storage.LevelResource;

import java.io.File;
import java.io.FileReader;
import java.io.FileWriter;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.Set;

public class OneBlockData {
	private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
	private static OneBlockData INSTANCE;

	private int oneBlockX = 0;
	private int oneBlockY = 64;
	private int oneBlockZ = 0;
	private int totalMined = 0;
	private int currentPhase = 1;
	private boolean initialized = false;
	private boolean oneBlockWorld = false;
	private boolean skyblockWorld = false;
	private Set<String> customBlockPositions = new HashSet<>();

	public OneBlockData() {
	}

	public static synchronized OneBlockData get(ServerLevel level) {
		if (INSTANCE == null) {
			load(level);
		}
		return INSTANCE;
	}

	public static synchronized void load(ServerLevel level) {
		try {
			Path saveDir = level.getServer().getWorldPath(LevelResource.ROOT);
			File file = saveDir.resolve("oneblock_skyblock_data.json").toFile();
			if (file.exists()) {
				try (FileReader reader = new FileReader(file)) {
					INSTANCE = GSON.fromJson(reader, OneBlockData.class);
					if (INSTANCE != null) {
						return;
					}
				}
			}
		} catch (Exception e) {
			e.printStackTrace();
		}
		INSTANCE = new OneBlockData();
	}

	public synchronized void save(ServerLevel level) {
		try {
			Path saveDir = level.getServer().getWorldPath(LevelResource.ROOT);
			File file = saveDir.resolve("oneblock_skyblock_data.json").toFile();
			try (FileWriter writer = new FileWriter(file)) {
				GSON.toJson(this, writer);
			}
		} catch (Exception e) {
			e.printStackTrace();
		}
	}

	public BlockPos getOneBlockPos() {
		return new BlockPos(oneBlockX, oneBlockY, oneBlockZ);
	}

	public void setOneBlockPos(BlockPos pos) {
		this.oneBlockX = pos.getX();
		this.oneBlockY = pos.getY();
		this.oneBlockZ = pos.getZ();
	}

	public int getTotalMined() {
		return totalMined;
	}

	public void setTotalMined(int totalMined) {
		this.totalMined = totalMined;
	}

	public void incrementMined() {
		this.totalMined++;
	}

	public int getCurrentPhase() {
		return currentPhase;
	}

	public void setCurrentPhase(int currentPhase) {
		this.currentPhase = Math.max(1, Math.min(8, currentPhase));
	}

	public boolean isInitialized() {
		return initialized;
	}

	public void setInitialized(boolean initialized) {
		this.initialized = initialized;
	}

	public boolean isOneBlockWorld() {
		return oneBlockWorld;
	}

	public void setOneBlockWorld(boolean oneBlockWorld) {
		this.oneBlockWorld = oneBlockWorld;
	}

	public boolean isSkyblockWorld() {
		return skyblockWorld;
	}

	public void setSkyblockWorld(boolean skyblockWorld) {
		this.skyblockWorld = skyblockWorld;
	}

	public void addCustomPosition(BlockPos pos) {
		if (customBlockPositions == null) {
			customBlockPositions = new HashSet<>();
		}
		customBlockPositions.add(pos.getX() + "," + pos.getY() + "," + pos.getZ());
	}

	public boolean isCustomPosition(BlockPos pos) {
		if (customBlockPositions == null) return false;
		return customBlockPositions.contains(pos.getX() + "," + pos.getY() + "," + pos.getZ());
	}
}
