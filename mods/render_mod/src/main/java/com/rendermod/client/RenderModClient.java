package com.rendermod.client;

import com.rendermod.client.gui.RenderListScreen;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.rendering.v1.HudRenderCallback;
import net.fabricmc.fabric.api.client.screen.v1.ScreenEvents;
import net.fabricmc.fabric.api.client.screen.v1.Screens;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.components.Tooltip;
import net.minecraft.client.gui.screens.TitleScreen;
import net.minecraft.network.chat.Component;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class RenderModClient implements ClientModInitializer {
	public static final Logger LOGGER = LoggerFactory.getLogger("render_mod/client");

	@Override
	public void onInitializeClient() {
		LOGGER.info("Initializing 60 FPS RenderMod Client HUD & Main Menu hooks...");

		// In-game 60 FPS recording HUD
		HudRenderCallback.EVENT.register(new RenderHudOverlay());

		// Main Menu Flashback Renders button via Fabric Screen API (100% crash-proof, no mixins needed)
		ScreenEvents.AFTER_INIT.register((client, screen, scaledWidth, scaledHeight) -> {
			if (screen instanceof TitleScreen) {
				int buttonWidth = 98;
				int buttonHeight = 20;
				int x = scaledWidth / 2 + 104;
				int y = scaledHeight / 4 + 48; // Sits neatly beside Singleplayer button

				Button renderBtn = Button.builder(Component.literal("📽 Renders"), btn -> {
					client.setScreen(new RenderListScreen(screen));
				})
				.bounds(x, y, buttonWidth, buttonHeight)
				.tooltip(Tooltip.create(Component.literal("Access 60 FPS Flashback Rendered Worlds")))
				.build();

				Screens.getButtons(screen).add(renderBtn);
			}
		});
	}
}
