package com.example.utilitycommands.client;

import com.example.utilitycommands.UtilityCommandsMod;
import com.example.utilitycommands.client.gui.ExtendedInventoryScreen;
import com.example.utilitycommands.client.gui.HiddenCommandRunnerScreen;
import com.mojang.brigadier.arguments.StringArgumentType;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.command.v2.ClientCommandManager;
import net.fabricmc.fabric.api.client.command.v2.ClientCommandRegistrationCallback;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.screens.MenuScreens;
import net.minecraft.network.protocol.game.ServerboundChatCommandPacket;

public class UtilityCommandsClient implements ClientModInitializer {
	@Override
	public void onInitializeClient() {
		MenuScreens.register(UtilityCommandsMod.EXTENDED_INVENTORY_MENU_TYPE, ExtendedInventoryScreen::new);

		ClientCommandRegistrationCallback.EVENT.register((dispatcher, registryAccess) -> {
			dispatcher.register(ClientCommandManager.literal("cmd2")
				.executes(context -> {
					Minecraft mc = Minecraft.getInstance();
					mc.execute(() -> mc.setScreen(new HiddenCommandRunnerScreen()));
					return 1;
				})
				.then(ClientCommandManager.argument("command", StringArgumentType.greedyString())
					.executes(context -> {
						String cmd = StringArgumentType.getString(context, "command").trim();
						if (cmd.startsWith("/")) {
							cmd = cmd.substring(1).trim();
						}
						Minecraft mc = Minecraft.getInstance();
						if (mc.getConnection() != null && !cmd.isEmpty()) {
							mc.getConnection().send(new ServerboundChatCommandPacket("cmd2 " + cmd));
						}
						return 1;
					}))
			);
		});
	}
}
