package com.rendermod.client.gui;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import net.minecraft.ChatFormatting;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.worldselection.SelectWorldScreen;
import net.minecraft.network.chat.Component;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

public class RenderListScreen extends Screen {
	private static final Gson GSON = new Gson();
	private final Screen parent;
	private final List<RenderEntry> renderEntries = new ArrayList<>();

	public static class RenderEntry {
		public final String folderName;
		public final String displayName;
		public final String durationText;
		public final String ticksText;
		public final Path path;

		public RenderEntry(String folderName, String displayName, String durationText, String ticksText, Path path) {
			this.folderName = folderName;
			this.displayName = displayName;
			this.durationText = durationText;
			this.ticksText = ticksText;
			this.path = path;
		}
	}

	public RenderListScreen(Screen parent) {
		super(Component.literal("Flashback Renders & Saved Worlds"));
		this.parent = parent;
	}

	@Override
	protected void init() {
		loadRenders();

		int listWidth = Math.min(this.width - 40, 480);
		int startX = (this.width - listWidth) / 2;
		int startY = 48;
		int itemHeight = 24;

		// Add interactive buttons for up to 6 most recent renders
		int maxDisplay = Math.min(renderEntries.size(), 6);
		for (int i = 0; i < maxDisplay; i++) {
			RenderEntry entry = renderEntries.get(i);
			int itemY = startY + i * (itemHeight + 4);

			// Play button for this world
			String label = "▶ " + entry.displayName + " (" + entry.durationText + ")";
			if (label.length() > 50) {
				label = label.substring(0, 47) + "..";
			}
			this.addRenderableWidget(Button.builder(Component.literal(label).withStyle(ChatFormatting.WHITE), btn -> {
				loadWorld(entry.folderName);
			}).bounds(startX, itemY, listWidth, itemHeight).build());
		}

		// Bottom action buttons
		int bottomY = this.height - 36;
		int btnWidth = 120;
		int spacing = 12;
		int totalWidth = btnWidth * 3 + spacing * 2;
		int bStartX = (this.width - totalWidth) / 2;

		// Singleplayer Menu Button
		this.addRenderableWidget(Button.builder(Component.literal("Singleplayer Worlds"), btn -> {
			if (this.minecraft != null) {
				this.minecraft.setScreen(new SelectWorldScreen(this.parent));
			}
		}).bounds(bStartX, bottomY, btnWidth, 20).build());

		// Open Saves Folder Button
		this.addRenderableWidget(Button.builder(Component.literal("Open Saves Folder"), btn -> {
			openSavesFolder();
		}).bounds(bStartX + btnWidth + spacing, bottomY, btnWidth, 20).build());

		// Back / Done Button
		this.addRenderableWidget(Button.builder(Component.literal("Done"), btn -> {
			if (this.minecraft != null) {
				this.minecraft.setScreen(this.parent);
			}
		}).bounds(bStartX + (btnWidth + spacing) * 2, bottomY, btnWidth, 20).build());
	}

	private void loadRenders() {
		renderEntries.clear();
		Minecraft client = Minecraft.getInstance();
		Path savesDir = client.gameDirectory.toPath().resolve("saves");

		if (!Files.exists(savesDir)) {
			return;
		}

		File[] folders = savesDir.toFile().listFiles(File::isDirectory);
		if (folders != null) {
			for (File f : folders) {
				String name = f.getName();
				if (name.startsWith("Render_") || new File(f, "render_info.json").exists()) {
					String displayName = name;
					String durationText = "60 FPS Render";
					String ticksText = "";

					File infoFile = new File(f, "render_info.json");
					if (infoFile.exists()) {
						try {
							String content = Files.readString(infoFile.toPath());
							JsonObject json = GSON.fromJson(content, JsonObject.class);
							if (json.has("displayName")) {
								displayName = json.get("displayName").getAsString();
							}
							if (json.has("durationSeconds")) {
								durationText = String.format("%.1fs", json.get("durationSeconds").getAsDouble());
							}
							if (json.has("ticksElapsed")) {
								ticksText = json.get("ticksElapsed").getAsInt() + " ticks";
							}
						} catch (Exception ignored) {}
					}

					renderEntries.add(new RenderEntry(name, displayName, durationText, ticksText, f.toPath()));
				}
			}
		}
	}

	private void loadWorld(String levelId) {
		if (this.minecraft == null) return;
		try {
			this.minecraft.createWorldOpenFlows().openWorld(levelId, () -> {
				this.minecraft.setScreen(this);
			});
		} catch (Exception e) {
			this.minecraft.setScreen(new SelectWorldScreen(this.parent));
		}
	}

	private void openSavesFolder() {
		try {
			Minecraft client = Minecraft.getInstance();
			Path savesDir = client.gameDirectory.toPath().resolve("saves");
			if (System.getProperty("os.name").toLowerCase().contains("win")) {
				new ProcessBuilder("explorer.exe", savesDir.toAbsolutePath().toString()).start();
			} else if (java.awt.Desktop.isDesktopSupported()) {
				java.awt.Desktop.getDesktop().open(savesDir.toFile());
			}
		} catch (Exception ignored) {}
	}

	@Override
	public void render(GuiGraphics guiGraphics, int mouseX, int mouseY, float partialTick) {
		super.render(guiGraphics, mouseX, mouseY, partialTick);

		// Header titles
		guiGraphics.drawCenteredString(this.font, "📽 Flashback Renders & Saved Worlds", this.width / 2, 16, 0xFFFFAA00);
		guiGraphics.drawCenteredString(this.font, "Saved renders are standard worlds directly accessible from the Main Menu", this.width / 2, 28, 0xFFAAAAAA);

		if (renderEntries.isEmpty()) {
			guiGraphics.drawCenteredString(this.font, "No saved renders found yet in saves/ folder.", this.width / 2, this.height / 2 - 10, 0xFF888888);
			guiGraphics.drawCenteredString(this.font, "Run /render start in-game to record extreme simulation (e.g. 100k TNT) at 60 FPS!", this.width / 2, this.height / 2 + 6, 0xFF666666);
		}
	}
}
