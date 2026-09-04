package com.example.utilitycommands;

import com.example.utilitycommands.commands.*;
import com.example.utilitycommands.inventory.ExtendedInventoryMenu;
import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerWorldEvents;
import net.fabricmc.fabric.api.screenhandler.v1.ExtendedScreenHandlerType;
import net.minecraft.core.Registry;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.network.codec.ByteBufCodecs;
import net.minecraft.resources.Identifier;
import net.minecraft.world.inventory.MenuType;
import net.minecraft.world.level.gamerules.GameRules;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class UtilityCommandsMod implements ModInitializer {
	public static final String MOD_ID = "utility_commands";
	public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

	public static final MenuType<ExtendedInventoryMenu> EXTENDED_INVENTORY_MENU_TYPE = Registry.register(
		BuiltInRegistries.MENU,
		Identifier.fromNamespaceAndPath(MOD_ID, "extended_inventory"),
		new ExtendedScreenHandlerType<>(ExtendedInventoryMenu::new, ByteBufCodecs.INT)
	);

	@Override
	public void onInitialize() {
		LOGGER.info("Initializing Utility Commands Mod for Minecraft 1.21.11!");

		CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) -> {
			HomeCommand.register(dispatcher);
			SpawnCommand.register(dispatcher);
			TpaCommand.register(dispatcher);
			SeeInvCommand.register(dispatcher);
			DupeEnableCommand.register(dispatcher);
			SetInvSizeCommand.register(dispatcher);
			HideGegCommand.register(dispatcher);
			Cmd2Command.register(dispatcher);
		});

		// Auto-enable command_blocks_work gamerule
		ServerLifecycleEvents.SERVER_STARTED.register(server -> {
			try {
				if (server.overworld() != null) {
					server.overworld().getGameRules().set(GameRules.COMMAND_BLOCKS_WORK, true, server);
				}
				server.getCommands().performPrefixedCommand(server.createCommandSourceStack().withSuppressedOutput(), "gamerule command_blocks_work true");
				LOGGER.info("Gamerule command_blocks_work set to true.");
			} catch (Exception e) {
				LOGGER.error("Failed to run gamerule command_blocks_work true", e);
			}
		});

		ServerWorldEvents.LOAD.register((server, level) -> {
			try {
				level.getGameRules().set(GameRules.COMMAND_BLOCKS_WORK, true, server);
			} catch (Exception ignored) {}
		});

		LOGGER.info("Utility Commands Mod successfully initialized.");
	}
}
