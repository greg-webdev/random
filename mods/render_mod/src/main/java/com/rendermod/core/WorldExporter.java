package com.rendermod.core;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.nbt.NbtAccounter;
import net.minecraft.nbt.NbtIo;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.level.storage.LevelResource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;

public class WorldExporter {
	private static final Logger LOGGER = LoggerFactory.getLogger("render_mod/WorldExporter");
	private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

	public static boolean exportSessionWorld(MinecraftServer server, RenderSession session) {
		try {
			LOGGER.info("Flushing and saving world data for render: {}", session.getDisplayName());
			
			// Force save all levels and chunks
			for (ServerLevel level : server.getAllLevels()) {
				level.save(null, true, false);
			}
			server.saveEverything(true, true, true);

			Path activeWorldDir = server.getWorldPath(LevelResource.ROOT);
			Path savesDir = activeWorldDir.getParent();
			if (savesDir == null) {
				savesDir = activeWorldDir;
			}

			Path targetWorldDir = savesDir.resolve(session.getWorldFolderName());
			LOGGER.info("Exporting rendered world from [{}] to [{}]", activeWorldDir, targetWorldDir);

			if (!Files.exists(targetWorldDir)) {
				Files.createDirectories(targetWorldDir);
			}

			// Copy world files recursively (excluding active locks)
			copyWorldFiles(activeWorldDir, targetWorldDir);

			// Update LevelName inside level.dat so it displays clearly in Main Menu Singleplayer list
			updateLevelDat(targetWorldDir, session);

			// Save render_info.json
			Path infoPath = targetWorldDir.resolve("render_info.json");
			Files.writeString(infoPath, GSON.toJson(session.toJson()), StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);

			// Also create a copy in .minecraft/renders/
			try {
				Path gameDir = server.getServerDirectory();
				Path rendersDir = gameDir.resolve("renders");
				if (!Files.exists(rendersDir)) {
					Files.createDirectories(rendersDir);
				}
				Path renderSummaryPath = rendersDir.resolve(session.getWorldFolderName() + ".json");
				Files.writeString(renderSummaryPath, GSON.toJson(session.toJson()), StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
			} catch (Exception e) {
				LOGGER.warn("Could not save secondary render summary to renders/: {}", e.getMessage());
			}

			LOGGER.info("Render export completed successfully! Saved as world: {}", session.getWorldFolderName());
			return true;
		} catch (Exception e) {
			LOGGER.error("Failed to export rendered world: ", e);
			return false;
		}
	}

	private static void copyWorldFiles(Path sourceDir, Path targetDir) throws IOException {
		Files.walkFileTree(sourceDir, new SimpleFileVisitor<Path>() {
			@Override
			public FileVisitResult preVisitDirectory(Path dir, BasicFileAttributes attrs) throws IOException {
				Path rel = sourceDir.relativize(dir);
				String dirName = dir.getFileName() != null ? dir.getFileName().toString() : "";
				// Skip temp or backup folders
				if (dirName.equals("session.lock") || dirName.startsWith(".temp")) {
					return FileVisitResult.SKIP_SUBTREE;
				}
				Path target = targetDir.resolve(rel);
				if (!Files.exists(target)) {
					Files.createDirectories(target);
				}
				return FileVisitResult.CONTINUE;
			}

			@Override
			public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) throws IOException {
				String fileName = file.getFileName().toString();
				// Do not copy active session.lock so the new world isn't locked
				if (fileName.equals("session.lock")) {
					return FileVisitResult.CONTINUE;
				}
				Path rel = sourceDir.relativize(file);
				Path target = targetDir.resolve(rel);
				try {
					Files.copy(file, target, StandardCopyOption.REPLACE_EXISTING);
				} catch (IOException ex) {
					LOGGER.warn("Could not copy world file {}: {}", fileName, ex.getMessage());
				}
				return FileVisitResult.CONTINUE;
			}
		});
	}

	private static void updateLevelDat(Path worldDir, RenderSession session) {
		Path levelDatPath = worldDir.resolve("level.dat");
		if (!Files.exists(levelDatPath)) {
			LOGGER.warn("level.dat not found at {}", levelDatPath);
			return;
		}

		try {
			CompoundTag root = NbtIo.readCompressed(levelDatPath, NbtAccounter.unlimitedHeap());
			if (root != null && root.contains("Data")) {
				root.getCompound("Data").ifPresent(dataTag -> {
					String formattedName = "Render: " + session.getDisplayName() + " [60 FPS]";
					dataTag.putString("LevelName", formattedName);
					LOGGER.info("Updated level.dat LevelName to '{}'", formattedName);
				});
				NbtIo.writeCompressed(root, levelDatPath);
			}
		} catch (Exception e) {
			LOGGER.warn("Could not modify level.dat LevelName: {}", e.getMessage());
		}
	}
}
