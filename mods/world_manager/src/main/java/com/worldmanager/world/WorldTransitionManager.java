package com.worldmanager.world;

import com.worldmanager.config.WorldConfig;
import com.worldmanager.inventory.InventoryManager;
import com.worldmanager.oneblock.OneBlockManager;
import net.minecraft.core.BlockPos;
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.network.chat.Component;
import net.minecraft.network.protocol.game.ClientboundForgetLevelChunkPacket;
import net.minecraft.network.protocol.game.ClientboundLevelChunkWithLightPacket;
import net.minecraft.network.protocol.game.ClientboundSetSubtitleTextPacket;
import net.minecraft.network.protocol.game.ClientboundSetTitleTextPacket;
import net.minecraft.network.protocol.game.ClientboundSetTitlesAnimationPacket;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.level.ChunkPos;
import net.minecraft.world.level.GameType;
import net.minecraft.world.level.chunk.LevelChunk;
import net.minecraft.world.level.storage.LevelData;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;

public class WorldTransitionManager {
	private static final Logger LOGGER = LoggerFactory.getLogger("WorldManager/Transition");

	private static boolean transitioning = false;
	private static WorldType targetWorld = null;
	private static WorldType previousWorld = null;
	private static int currentTick = 0;
	private static BlockPos calculatedSpawnPos = null;

	public static boolean isTransitioning() {
		return transitioning;
	}

	public static boolean startTransition(MinecraftServer server, WorldType targetType) {
		if (transitioning) {
			return false;
		}

		transitioning = true;
		targetWorld = targetType;
		currentTick = 0;
		calculatedSpawnPos = null;

		ServerLevel level = server.overworld();
		previousWorld = WorldConfig.get().getCurrentWorldType();
		List<ServerPlayer> players = level.players();

		LOGGER.info("Starting world transition: {} -> {}", previousWorld.getId(), targetType.getId());

		for (ServerPlayer player : players) {
			// 1. Save inventory for current world (if per-world mode enabled)
			InventoryManager.savePlayerInventory(player, previousWorld);

			// 2. Change all players to Spectator mode
			player.setGameMode(GameType.SPECTATOR);

			// 3. Elevate players safely into observation vantage point
			player.teleportTo(0.5, 95.0, 0.5);

			// 4. Send Transition Titles & Sound
			player.connection.send(new ClientboundSetTitlesAnimationPacket(10, 60, 10));
			player.connection.send(new ClientboundSetTitleTextPacket(Component.literal("§c§lUNLOADING TERRAIN")));
			player.connection.send(new ClientboundSetSubtitleTextPacket(Component.literal("§7Switching to §b" + targetType.getDisplayName())));

			player.sendSystemMessage(Component.literal("§6§l[WorldManager] §eUnloading world chunks... Changing to §b" + targetType.getDisplayName()), false);
		}

		level.playSound(null, 0, 95, 0, SoundEvents.BEACON_DEACTIVATE, SoundSource.AMBIENT, 1.2f, 0.6f);
		return true;
	}

	public static void tick(MinecraftServer server) {
		if (!transitioning) return;

		currentTick++;
		ServerLevel level = server.overworld();
		List<ServerPlayer> players = level.players();

		// Phase 1: Slowly unload chunks in outward rings (Ticks 6 to 30)
		if (currentTick >= 6 && currentTick <= 30 && currentTick % 6 == 0) {
			int step = (currentTick - 6) / 6; // 0, 1, 2, 3, 4
			int ring = 4 - step; // ring 4, 3, 2, 1, 0

			for (int cx = -ring; cx <= ring; cx++) {
				for (int cz = -ring; cz <= ring; cz++) {
					if (Math.max(Math.abs(cx), Math.abs(cz)) == ring) {
						ClientboundForgetLevelChunkPacket forgetPacket = new ClientboundForgetLevelChunkPacket(new ChunkPos(cx, cz));
						for (ServerPlayer player : players) {
							player.connection.send(forgetPacket);
						}
					}
				}
			}

			level.playSound(null, 0, 95, 0, SoundEvents.ELYTRA_FLYING, SoundSource.AMBIENT, 0.8f, 0.5f);
			for (ServerPlayer player : players) {
				player.sendSystemMessage(Component.literal("§8[Transition] §7Unloading chunks: sector §e" + (step + 1) + "/5..."), true);
			}
		}

		// Phase 2: Generate new world terrain (Tick 38)
		if (currentTick == 38) {
			for (ServerPlayer player : players) {
				player.sendSystemMessage(Component.literal("§a[Transition] Generating " + targetWorld.getDisplayName() + "..."), true);
			}

			// Update active world type so generator delegates to target world immediately
			WorldConfig.get().setCurrentWorldType(targetWorld);
			WorldConfig.save();

			calculatedSpawnPos = switch (targetWorld) {
				case SKYBLOCK_V1 -> TerrainGenerators.generateSkyblockV1(level, previousWorld);
				case SKYBLOCK_V2 -> TerrainGenerators.generateSkyblockV2(level, previousWorld);
				case ONEBLOCK -> TerrainGenerators.generateOneBlock(level, previousWorld);
				case FLAT -> TerrainGenerators.generateFlat(level);
				case STANDARD -> TerrainGenerators.generateStandard(level);
			};

			// Set Level Respawn Point
			level.setRespawnData(LevelData.RespawnData.of(level.dimension(), calculatedSpawnPos, 0.0f, 0.0f));

			// Resend chunk packets so players see freshly generated world
			int packetRadius = 10;
			for (int cx = -packetRadius; cx <= packetRadius; cx++) {
				for (int cz = -packetRadius; cz <= packetRadius; cz++) {
					LevelChunk chunk = level.getChunkSource().getChunkNow(cx, cz);
					if (chunk != null) {
						ClientboundLevelChunkWithLightPacket chunkPacket =
							new ClientboundLevelChunkWithLightPacket(chunk, level.getLightEngine(), null, null);
						for (ServerPlayer player : players) {
							player.connection.send(chunkPacket);
						}
					}
				}
			}
		}

		// Phase 3: Teleport all players to safety and restore GameMode & Inventory (Tick 52)
		if (currentTick >= 52) {
			BlockPos spawn = calculatedSpawnPos != null ? calculatedSpawnPos : new BlockPos(0, 65, 0);

			for (ServerPlayer player : players) {
				// 1. Teleport to safe block at spawn
				player.teleportTo(spawn.getX() + 0.5, spawn.getY(), spawn.getZ() + 0.5);

				// 2. Restore / Load Inventory for target world
				InventoryManager.loadPlayerInventory(player, targetWorld);

				// 3. Switch back to Survival mode
				player.setGameMode(GameType.SURVIVAL);

				// 4. Celebration Titles & Sound
				player.connection.send(new ClientboundSetTitlesAnimationPacket(10, 50, 10));
				player.connection.send(new ClientboundSetTitleTextPacket(Component.literal("§a§l" + targetWorld.getDisplayName().toUpperCase())));
				player.connection.send(new ClientboundSetSubtitleTextPacket(Component.literal("§eTerrain reloaded! Safe at spawn.")));

				player.sendSystemMessage(Component.literal("§6§l========================================"), false);
				player.sendSystemMessage(Component.literal("§a§lWorld changed to §b§l" + targetWorld.getDisplayName() + "!"), false);
				if (targetWorld == WorldType.ONEBLOCK) {
					player.sendSystemMessage(Component.literal("§e★ Mine the block beneath your feet to progress deeper!"), false);
					player.sendSystemMessage(Component.literal("§7Use §b/world oneblock reset §7anytime to reset."), false);
				}
				player.sendSystemMessage(Component.literal("§6§l========================================"), false);
			}

			level.playSound(null, spawn, SoundEvents.UI_TOAST_CHALLENGE_COMPLETE, SoundSource.PLAYERS, 1.0f, 1.0f);
			level.playSound(null, spawn, SoundEvents.PLAYER_LEVELUP, SoundSource.PLAYERS, 0.8f, 1.2f);
			level.sendParticles(ParticleTypes.HAPPY_VILLAGER, spawn.getX() + 0.5, spawn.getY() + 1.2, spawn.getZ() + 0.5, 30, 0.5, 0.5, 0.5, 0.1);

			// Update persistent config
			WorldConfig.get().setCurrentWorldType(targetWorld);
			WorldConfig.save();

			transitioning = false;
			LOGGER.info("World transition complete. Active world: {}", targetWorld.getId());
		}
	}
}
