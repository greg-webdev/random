package com.example.utilitycommands;

import com.example.utilitycommands.commands.*;
import com.example.utilitycommands.inventory.ExtendedInventoryMenu;
import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
import net.fabricmc.fabric.api.screenhandler.v1.ExtendedScreenHandlerType;
import net.minecraft.core.Registry;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.network.codec.ByteBufCodecs;
import net.minecraft.resources.Identifier;
import net.minecraft.world.inventory.MenuType;
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
		});

		LOGGER.info("Utility Commands Mod successfully initialized.");
	}
}
