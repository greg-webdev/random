package com.worldmanager.changes;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.worldmanager.world.WorldType;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.nbt.NbtAccounter;
import net.minecraft.nbt.NbtIo;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.level.ChunkPos;
import net.minecraft.world.level.chunk.LevelChunk;
import net.minecraft.world.level.chunk.storage.SerializableChunkData;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.FileReader;
import java.io.FileWriter;
import java.io.IOException;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

public class ChunkChangesManager {
	private static final Logger LOGGER = LoggerFactory.getLogger("WorldManager/Changes");
	private static final Path CHANGES_DIR = Path.of("world_changes");
	private static final Path INDEX_FILE = CHANGES_DIR.resolve("index.json");
	private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

	private static final Set<Long> SAVED_CHUNKS = ConcurrentHashMap.newKeySet();
	private static final Map<String, ChangeEntry> INDEX_ENTRIES = new ConcurrentHashMap<>();

	private static final ExecutorService SAVE_EXECUTOR = Executors.newSingleThreadExecutor(r -> {
		Thread t = new Thread(r, "WorldManager-ChangesSaver");
		t.setDaemon(true);
		return t;
	});

	public static class ChangeEntry {
		public int chunkX;
		public int chunkZ;
		public String file;
		public String savedAt;
		public String previousWorldType;

		public ChangeEntry(int chunkX, int chunkZ, String file, String savedAt, String previousWorldType) {
			this.chunkX = chunkX;
			this.chunkZ = chunkZ;
			this.file = file;
			this.savedAt = savedAt;
			this.previousWorldType = previousWorldType;
		}
	}

	public static void init() {
		try {
			if (!Files.exists(CHANGES_DIR)) {
				Files.createDirectories(CHANGES_DIR);
			}

			// Load existing .changes files into memory cache
			int count = 0;
			try (DirectoryStream<Path> stream = Files.newDirectoryStream(CHANGES_DIR, "*.changes")) {
				for (Path entry : stream) {
					String fileName = entry.getFileName().toString();
					// format: chunk_<x>_<z>.changes
					if (fileName.startsWith("chunk_") && fileName.endsWith(".changes")) {
						String part = fileName.substring(6, fileName.length() - 8);
						String[] split = part.split("_");
						if (split.length == 2) {
							try {
								int x = Integer.parseInt(split[0]);
								int z = Integer.parseInt(split[1]);
								SAVED_CHUNKS.add(ChunkPos.asLong(x, z));
								count++;
							} catch (NumberFormatException ignored) {
							}
						}
					}
				}
			}

			// Load index.json if present
			if (Files.exists(INDEX_FILE)) {
				try (FileReader reader = new FileReader(INDEX_FILE.toFile())) {
					Map<String, ChangeEntry> loaded = GSON.fromJson(reader,
						new com.google.gson.reflect.TypeToken<Map<String, ChangeEntry>>() {}.getType());
					if (loaded != null) {
						INDEX_ENTRIES.putAll(loaded);
					}
				}
			}

			LOGGER.info("Initialized ChunkChangesManager: found {} saved chunk change files in {}", count, CHANGES_DIR.toAbsolutePath());
		} catch (Exception e) {
			LOGGER.error("Failed to initialize ChunkChangesManager: ", e);
		}
	}

	public static boolean hasChanges(int chunkX, int chunkZ) {
		return SAVED_CHUNKS.contains(ChunkPos.asLong(chunkX, chunkZ));
	}

	public static int getSavedChunksCount() {
		return SAVED_CHUNKS.size();
	}

	public static Path getChangesDir() {
		return CHANGES_DIR;
	}

	public static void saveChunkTag(int chunkX, int chunkZ, CompoundTag tag, String previousWorldType) {
		if (tag == null) return;

		long key = ChunkPos.asLong(chunkX, chunkZ);
		SAVED_CHUNKS.add(key);

		String fileName = "chunk_" + chunkX + "_" + chunkZ + ".changes";
		Path filePath = CHANGES_DIR.resolve(fileName);
		String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));

		ChangeEntry entry = new ChangeEntry(chunkX, chunkZ, fileName, timestamp, previousWorldType);
		INDEX_ENTRIES.put("chunk_" + chunkX + "_" + chunkZ, entry);

		// Asynchronously compress and write to avoid blocking server tick loop
		CompoundTag copy = tag.copy();
		SAVE_EXECUTOR.submit(() -> {
			try {
				if (!Files.exists(CHANGES_DIR)) {
					Files.createDirectories(CHANGES_DIR);
				}
				NbtIo.writeCompressed(copy, filePath);
				saveIndex();
				LOGGER.debug("Saved chunk changes to {} for chunk [{}, {}]", fileName, chunkX, chunkZ);
			} catch (Exception e) {
				LOGGER.error("Failed to write chunk changes file {}: ", fileName, e);
			}
		});
	}

	public static void saveLevelChunk(ServerLevel level, LevelChunk chunk, WorldType previousType) {
		if (level == null || chunk == null) return;
		try {
			ChunkPos pos = chunk.getPos();
			CompoundTag tag = SerializableChunkData.copyOf(level, chunk).write();
			saveChunkTag(pos.x, pos.z, tag, previousType != null ? previousType.getId() : "standard");
		} catch (Exception e) {
			LOGGER.error("Failed to serialize LevelChunk at [{}, {}]: ", chunk.getPos().x, chunk.getPos().z, e);
		}
	}

	public static Optional<CompoundTag> loadChunkTag(int chunkX, int chunkZ) {
		String fileName = "chunk_" + chunkX + "_" + chunkZ + ".changes";
		Path filePath = CHANGES_DIR.resolve(fileName);

		if (!Files.exists(filePath)) {
			return Optional.empty();
		}

		try {
			CompoundTag tag = NbtIo.readCompressed(filePath, NbtAccounter.unlimitedHeap());
			return Optional.ofNullable(tag);
		} catch (Exception e) {
			LOGGER.error("Failed to read chunk changes file {}: ", fileName, e);
			return Optional.empty();
		}
	}

	private static synchronized void saveIndex() {
		try {
			if (!Files.exists(CHANGES_DIR)) {
				Files.createDirectories(CHANGES_DIR);
			}
			try (FileWriter writer = new FileWriter(INDEX_FILE.toFile())) {
				GSON.toJson(INDEX_ENTRIES, writer);
			}
		} catch (Exception e) {
			LOGGER.error("Failed to save changes index.json: ", e);
		}
	}

	public static int restoreAll(ServerLevel level) {
		if (level == null) return 0;
		int restoredCount = 0;

		for (long key : SAVED_CHUNKS) {
			int cx = ChunkPos.getX(key);
			int cz = ChunkPos.getZ(key);
			Optional<CompoundTag> opt = loadChunkTag(cx, cz);
			if (opt.isPresent()) {
				ChunkPos pos = new ChunkPos(cx, cz);
				level.getChunkSource().chunkMap.write(pos, opt.get());
				restoredCount++;
			}
		}

		LOGGER.info("Restored {} chunks from .changes files into world", restoredCount);
		return restoredCount;
	}

	public static void flush() {
		try {
			SAVE_EXECUTOR.shutdown();
			if (!SAVE_EXECUTOR.awaitTermination(3, TimeUnit.SECONDS)) {
				SAVE_EXECUTOR.shutdownNow();
			}
			saveIndex();
		} catch (Exception e) {
			LOGGER.error("Error flushing ChunkChangesManager: ", e);
		}
	}
}
