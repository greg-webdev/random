package com.rendermod.client;

import com.rendermod.core.RenderManager;
import com.rendermod.core.RenderSession;
import net.fabricmc.fabric.api.client.rendering.v1.HudRenderCallback;
import net.minecraft.client.DeltaTracker;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Font;
import net.minecraft.client.gui.GuiGraphics;

public class RenderHudOverlay implements HudRenderCallback {

	@Override
	public void onHudRender(GuiGraphics guiGraphics, DeltaTracker deltaTracker) {
		RenderManager manager = RenderManager.getInstance();
		if (!manager.isRendering()) {
			return;
		}

		RenderSession session = manager.getCurrentSession();
		if (session == null) {
			return;
		}

		Minecraft client = Minecraft.getInstance();
		if (client.options.hideGui) {
			return;
		}

		Font font = client.font;
		int width = client.getWindow().getGuiScaledWidth();

		// Top-right corner box
		int boxWidth = 190;
		int boxHeight = 52;
		int margin = 8;
		int x1 = width - boxWidth - margin;
		int y1 = margin;
		int x2 = width - margin;
		int y2 = margin + boxHeight;

		// Pulsing red indicator
		long time = System.currentTimeMillis();
		boolean blink = (time / 500) % 2 == 0;
		int dotColor = blink ? 0xFFFF2222 : 0xFF881111;

		// Semi-transparent sleek dark background with subtle red border
		guiGraphics.fill(x1, y1, x2, y2, 0xDD111318);
		guiGraphics.fill(x1, y1, x2, y1 + 1, 0xFFE53935); // Top accent line

		// Red recording dot
		guiGraphics.fill(x1 + 8, y1 + 7, x1 + 14, y1 + 13, dotColor);

		// Header: "REC [60 FPS]"
		guiGraphics.drawString(font, "REC", x1 + 18, y1 + 6, 0xFFFF4444, true);
		guiGraphics.drawString(font, "[60 FPS WORLD RENDER]", x1 + 42, y1 + 6, 0xFFFFAA00, true);

		// Render Name
		String nameText = "Name: " + session.getDisplayName();
		if (nameText.length() > 27) {
			nameText = nameText.substring(0, 25) + "..";
		}
		guiGraphics.drawString(font, nameText, x1 + 8, y1 + 18, 0xFFE0E0E0, false);

		// Stats: Ticks & Duration
		String statsText = String.format("Ticks: %d | Time: %.1fs", session.getTicksElapsed(), session.getDurationSeconds());
		guiGraphics.drawString(font, statsText, x1 + 8, y1 + 29, 0xFF4CAF50, false);

		// Subtitle: Explosions / Stop hint
		String hintText = (session.getExplosionsRecorded() > 0)
			? String.format("Explosions: %d (100k+ safe)", session.getExplosionsRecorded())
			: "Decoupled 60fps | /render stop";
		guiGraphics.drawString(font, hintText, x1 + 8, y1 + 40, 0xFF9E9E9E, false);
	}
}
