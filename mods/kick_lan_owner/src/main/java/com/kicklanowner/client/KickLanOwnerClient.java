package com.kicklanowner.client;

import com.kicklanowner.client.gui.TalkScreen;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.command.v2.ClientCommandManager;
import net.fabricmc.fabric.api.client.command.v2.ClientCommandRegistrationCallback;
import net.minecraft.client.Minecraft;

public class KickLanOwnerClient implements ClientModInitializer {

	@Override
	public void onInitializeClient() {
		ClientCommandRegistrationCallback.EVENT.register((dispatcher, registryAccess) -> {
			dispatcher.register(ClientCommandManager.literal("talk")
				.executes(ctx -> {
					openTalkScreen();
					return 1;
				})
			);

			dispatcher.register(ClientCommandManager.literal("tellrawgui")
				.executes(ctx -> {
					openTalkScreen();
					return 1;
				})
			);

			dispatcher.register(ClientCommandManager.literal("talkgui")
				.executes(ctx -> {
					openTalkScreen();
					return 1;
				})
			);
		});
	}

	private static void openTalkScreen() {
		Minecraft client = Minecraft.getInstance();
		client.execute(() -> client.setScreen(new TalkScreen()));
	}
}
