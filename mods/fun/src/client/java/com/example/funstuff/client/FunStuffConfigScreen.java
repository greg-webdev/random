package com.example.funstuff.client;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;
import net.minecraft.sounds.SoundEvents;

import java.awt.FileDialog;
import java.awt.Frame;
import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.zip.ZipFile;

public class FunStuffConfigScreen extends Screen {
	private final Screen parent;
	private String statusMessage = "Ready. Select an action below.";
	private int statusColor = 0xFFCCCCCC; // light grey

	public FunStuffConfigScreen(Screen parent) {
		super(Component.translatable("title.funstuff.config"));
		this.parent = parent;
	}

	@Override
	protected void init() {
		int centerX = this.width / 2;
		int startY = this.height / 4 + 10;

		// Button 1: Live Hot-Reload Textures & Assets
		this.addRenderableWidget(Button.builder(
			Component.literal("⚡ Live Hot-Reload Textures & Assets"),
			button -> hotReloadAssets()
		).bounds(centerX - 130, startY, 260, 20).build());

		// Button 2: Upload & Deploy New Mod JAR File
		this.addRenderableWidget(Button.builder(
			Component.literal("📂 Upload New Mod Version (.jar)"),
			button -> uploadNewVersionJar()
		).bounds(centerX - 130, startY + 28, 260, 20).build());

		// Button 3: Auto-Deploy from build/libs/
		this.addRenderableWidget(Button.builder(
			Component.literal("🔄 Auto-Deploy Latest Build JAR"),
			button -> autoDeployFromBuildLibs()
		).bounds(centerX - 130, startY + 56, 260, 20).build());

		// Button 4: Back to Mod Menu / Parent
		this.addRenderableWidget(Button.builder(
			Component.literal("Back"),
			button -> this.minecraft.setScreen(this.parent)
		).bounds(centerX - 100, this.height - 36, 200, 20).build());
	}

	private void hotReloadAssets() {
		statusMessage = "Reloading textures, models & resources...";
		statusColor = 0xFFFFFF55; // yellow
		if (this.minecraft != null) {
			this.minecraft.reloadResourcePacks().thenRun(() -> {
				statusMessage = "✅ Live Assets & Textures reloaded successfully!";
				statusColor = 0xFF55FF55; // green
				if (this.minecraft.player != null) {
					this.minecraft.player.playSound(SoundEvents.EXPERIENCE_ORB_PICKUP, 1.0f, 1.2f);
				}
			});
		}
	}

	private void uploadNewVersionJar() {
		try {
			FileDialog dialog = new FileDialog((Frame) null, "Select New Fun Stuff Mod JAR", FileDialog.LOAD);
			dialog.setFile("*.jar");
			dialog.setVisible(true);

			String filename = dialog.getFile();
			String dirname = dialog.getDirectory();

			if (filename != null && dirname != null) {
				File selectedFile = new File(dirname, filename);
				deployJar(selectedFile);
			} else {
				statusMessage = "File selection cancelled.";
				statusColor = 0xFFAAAAAA;
			}
		} catch (Exception e) {
			statusMessage = "Error opening file dialog: " + e.getMessage();
			statusColor = 0xFFFF5555;
		}
	}

	private void autoDeployFromBuildLibs() {
		try {
			File buildLibs = new File("build/libs");
			if (!buildLibs.exists()) {
				buildLibs = new File("../build/libs");
			}

			if (buildLibs.exists() && buildLibs.isDirectory()) {
				File[] jars = buildLibs.listFiles((dir, name) -> name.endsWith(".jar") && !name.endsWith("-sources.jar"));
				if (jars != null && jars.length > 0) {
					// Pick the most recently modified jar
					File newest = jars[0];
					for (File j : jars) {
						if (j.lastModified() > newest.lastModified()) {
							newest = j;
						}
					}
					deployJar(newest);
					return;
				}
			}
			statusMessage = "No built JAR found in build/libs/. Run gradle build first!";
			statusColor = 0xFFFF5555;
		} catch (Exception e) {
			statusMessage = "Error auto-deploying: " + e.getMessage();
			statusColor = 0xFFFF5555;
		}
	}

	private void deployJar(File jarFile) {
		try {
			// Verify it is a valid jar with fabric.mod.json
			try (ZipFile zip = new ZipFile(jarFile)) {
				if (zip.getEntry("fabric.mod.json") == null) {
					statusMessage = "❌ Invalid mod JAR: Missing fabric.mod.json!";
					statusColor = 0xFFFF5555;
					return;
				}
			}

			// Deploy to run/mods or mods directory
			File targetDir = new File("mods");
			if (!targetDir.exists()) {
				targetDir = new File("run/mods");
			}
			targetDir.mkdirs();

			File targetFile = new File(targetDir, "funstuff-hotload.jar");
			Files.copy(jarFile.toPath(), targetFile.toPath(), StandardCopyOption.REPLACE_EXISTING);

			// Trigger live asset reload
			if (this.minecraft != null) {
				this.minecraft.reloadResourcePacks().thenRun(() -> {
					statusMessage = "✅ Deployed '" + jarFile.getName() + "' and reloaded assets!";
					statusColor = 0xFF55FF55;
					if (this.minecraft.player != null) {
						this.minecraft.player.playSound(SoundEvents.PLAYER_LEVELUP, 1.0f, 1.4f);
					}
				});
			}
		} catch (Exception e) {
			statusMessage = "❌ Deploy failed: " + e.getMessage();
			statusColor = 0xFFFF5555;
		}
	}

	@Override
	public void render(GuiGraphics guiGraphics, int mouseX, int mouseY, float partialTick) {
		super.render(guiGraphics, mouseX, mouseY, partialTick);

		int centerX = this.width / 2;

		// Title
		guiGraphics.drawCenteredString(this.font, this.title, centerX, 18, 0xFFFFFFFF);

		// Subtitle & info
		guiGraphics.drawCenteredString(this.font, "Fun Stuff Mod v1.0.0 (Minecraft 1.21.11)", centerX, 34, 0xFFAAAAAA);
		guiGraphics.drawCenteredString(this.font, "Total Gadgets Loaded: 12 Fun Items & Blocks", centerX, 46, 0xFF55FF55);

		// Status notification box
		int statusY = this.height / 4 + 92;
		guiGraphics.fill(centerX - 140, statusY - 4, centerX + 140, statusY + 16, 0x88000000);
		guiGraphics.drawCenteredString(this.font, this.statusMessage, centerX, statusY, this.statusColor);
	}

	@Override
	public void onClose() {
		if (this.minecraft != null) {
			this.minecraft.setScreen(this.parent);
		}
	}
}
