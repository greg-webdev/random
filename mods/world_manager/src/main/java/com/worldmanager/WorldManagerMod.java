package com.worldmanager;

import com.worldmanager.command.WorldCommand;
import com.worldmanager.config.WorldConfig;
import com.worldmanager.oneblock.OneBlockManager;
import com.worldmanager.world.WorldTransitionManager;
import com.worldmanager.world.WorldType;
import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.fabricmc.fabric.api.event.player.PlayerBlockBreakEvents;
import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class WorldManagerMod implements ModInitializer {
	public static final String MOD_ID = "world_manager";
	public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

	@Override
	public void onInitialize() {
		LOGGER.info("Initializing World Manager Mod for Minecraft 1.21.11 Fabric Server!");

		// Load configuration
		WorldConfig.load();

		// Initialize ChunkChangesManager for .changes preservation
		com.worldmanager.changes.ChunkChangesManager.init();
		Runtime.getRuntime().addShutdownHook(new Thread(com.worldmanager.changes.ChunkChangesManager::flush, "WorldManager-ShutdownHook"));

		// Register /world commands
		CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) -> {
			WorldCommand.register(dispatcher);
		});

		// Server tick listener for world transition state machine
		ServerTickEvents.END_SERVER_TICK.register(WorldTransitionManager::tick);

		// Block break listener for OneBlock infinite regeneration
		PlayerBlockBreakEvents.AFTER.register((world, player, pos, state, blockEntity) -> {
			if (world instanceof ServerLevel serverLevel && player instanceof ServerPlayer serverPlayer) {
				OneBlockManager.onBlockBreak(serverLevel, serverPlayer, pos);
			}
		});

		// Player join notifications
		ServerPlayConnectionEvents.JOIN.register((handler, sender, server) -> {
			ServerPlayer player = handler.getPlayer();
			WorldType current = WorldConfig.get().getCurrentWorldType();
			String mode = WorldConfig.get().getInventoryMode().toUpperCase();

			player.sendSystemMessage(Component.literal("§6§l========================================"), false);
			player.sendSystemMessage(Component.literal("§e§lWelcome! §7Active World: §b" + current.getDisplayName()), false);
			player.sendSystemMessage(Component.literal("§7Inventory Mode: §a" + mode + " §7(Use §b/world info §7or §b/world help§7)"), false);
			if (current == WorldType.ONEBLOCK) {
				player.sendSystemMessage(Component.literal("§aMine the block beneath you to progress deeper into the world!"), false);
			}
			player.sendSystemMessage(Component.literal("§6§l========================================"), false);
		});
	}
}
