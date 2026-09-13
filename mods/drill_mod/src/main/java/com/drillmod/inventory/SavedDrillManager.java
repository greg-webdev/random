package com.drillmod.inventory;

import com.drillmod.DrillMod;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.nbt.NbtAccounter;
import net.minecraft.nbt.NbtIo;
import net.minecraft.server.MinecraftServer;
import net.minecraft.world.level.storage.LevelResource;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

public class SavedDrillManager {
	private static final Map<UUID, DrillStorage> BACKUP_CACHE = new ConcurrentHashMap<>();

	private static Path getBackupPath(MinecraftServer server, UUID uuid) {
		Path dir = server.getWorldPath(LevelResource.ROOT).resolve("saved_drills");
		try {
			Files.createDirectories(dir);
		} catch (Exception ignored) {}
		return dir.resolve(uuid.toString() + ".dat");
	}

	public static void saveBackup(MinecraftServer server, UUID uuid, DrillStorage storage) {
		if (storage == null || uuid == null) return;
		BACKUP_CACHE.put(uuid, storage);

		if (server != null) {
			try {
				Path file = getBackupPath(server, uuid);
				CompoundTag tag = new CompoundTag();
				tag.put("DrillBackup", storage.toNbt(server.registryAccess()));
				NbtIo.writeCompressed(tag, file);
			} catch (Exception e) {
				DrillMod.LOGGER.error("Failed to save drill backup for {}", uuid, e);
			}
		}
	}

	public static DrillStorage loadBackup(MinecraftServer server, UUID uuid) {
		if (uuid == null) return null;
		DrillStorage cached = BACKUP_CACHE.get(uuid);
		if (cached != null) {
			return cached;
		}

		if (server != null) {
			Path file = getBackupPath(server, uuid);
			if (Files.exists(file)) {
				try {
					CompoundTag tag = NbtIo.readCompressed(file, NbtAccounter.unlimitedHeap());
					if (tag.contains("DrillBackup")) {
						DrillStorage loaded = DrillStorage.fromNbt(tag.getCompoundOrEmpty("DrillBackup"), server.registryAccess());
						BACKUP_CACHE.put(uuid, loaded);
						return loaded;
					}
				} catch (Exception e) {
					DrillMod.LOGGER.error("Failed to load drill backup for {}", uuid, e);
				}
			}
		}
		return null;
	}

	public static boolean hasBackup(MinecraftServer server, UUID uuid) {
		if (uuid == null) return false;
		if (BACKUP_CACHE.containsKey(uuid) && BACKUP_CACHE.get(uuid).size() > 0) {
			return true;
		}
		if (server != null) {
			Path file = getBackupPath(server, uuid);
			return Files.exists(file);
		}
		return false;
	}
}
