package com.example.utilitycommands;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.core.registries.Registries;
import net.minecraft.resources.Identifier;
import net.minecraft.resources.ResourceKey;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.level.Level;

import java.io.Reader;
import java.io.Writer;
import java.lang.reflect.Type;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

public class HomeManager {
	public record HomeLocation(String dimension, double x, double y, double z, float yaw, float pitch) {}

	private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
	private static final Path FILE_PATH = FabricLoader.getInstance().getConfigDir().resolve("utility_commands_homes.json");
	private static final Map<UUID, HomeLocation> HOMES = new HashMap<>();

	static {
		load();
	}

	public static synchronized void setHome(ServerPlayer player) {
		String dim = player.level().dimension().identifier().toString();
		HomeLocation loc = new HomeLocation(
			dim,
			player.getX(),
			player.getY(),
			player.getZ(),
			player.getYRot(),
			player.getXRot()
		);
		HOMES.put(player.getUUID(), loc);
		save();
	}

	public static synchronized HomeLocation getHome(UUID playerUuid) {
		return HOMES.get(playerUuid);
	}

	public static boolean teleportToHome(ServerPlayer player) {
		HomeLocation home = getHome(player.getUUID());
		if (home == null) {
			return false;
		}

		ResourceKey<Level> dimKey = ResourceKey.create(
			Registries.DIMENSION,
			Identifier.parse(home.dimension())
		);
		MinecraftServer server = player.level().getServer();
		ServerLevel targetLevel = server.getLevel(dimKey);
		if (targetLevel == null) {
			targetLevel = server.overworld();
		}

		player.teleportTo(
			targetLevel,
			home.x(),
			home.y(),
			home.z(),
			Set.of(),
			home.yaw(),
			home.pitch(),
			false
		);
		return true;
	}

	private static synchronized void load() {
		if (!Files.exists(FILE_PATH)) return;
		try (Reader reader = Files.newBufferedReader(FILE_PATH)) {
			Type type = new TypeToken<Map<UUID, HomeLocation>>() {}.getType();
			Map<UUID, HomeLocation> loaded = GSON.fromJson(reader, type);
			if (loaded != null) {
				HOMES.putAll(loaded);
			}
		} catch (Exception e) {
			UtilityCommandsMod.LOGGER.error("Failed to load homes from " + FILE_PATH, e);
		}
	}

	private static synchronized void save() {
		try {
			Files.createDirectories(FILE_PATH.getParent());
			try (Writer writer = Files.newBufferedWriter(FILE_PATH)) {
				GSON.toJson(HOMES, writer);
			}
		} catch (Exception e) {
			UtilityCommandsMod.LOGGER.error("Failed to save homes to " + FILE_PATH, e);
		}
	}
}
