package com.worldmanager.world;

import com.worldmanager.config.WorldConfig;
import net.minecraft.core.HolderGetter;
import net.minecraft.core.registries.Registries;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.biome.Biome;
import net.minecraft.world.level.chunk.ChunkGenerator;
import net.minecraft.world.level.levelgen.FlatLevelSource;
import net.minecraft.world.level.levelgen.flat.FlatLevelGeneratorSettings;
import net.minecraft.world.level.levelgen.placement.PlacedFeature;
import net.minecraft.world.level.levelgen.structure.StructureSet;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class DynamicTerrainManager {
	private static final Logger LOGGER = LoggerFactory.getLogger("WorldManager/DynamicTerrain");

	private static ChunkGenerator originalGenerator = null;
	private static FlatLevelSource flatGenerator = null;
	private static VoidChunkGenerator voidGenerator = null;

	public static void setOriginalGenerator(ChunkGenerator generator) {
		if (originalGenerator == null && generator != null
			&& !(generator instanceof VoidChunkGenerator)
			&& !(generator instanceof FlatLevelSource)) {
			originalGenerator = generator;
			LOGGER.info("Captured original overworld generator: {}", generator.getClass().getName());
		}
	}

	public static ChunkGenerator getStandardGenerator(ServerLevel level) {
		if (originalGenerator != null) {
			return originalGenerator;
		}
		ChunkGenerator current = level.getChunkSource().getGenerator();
		setOriginalGenerator(current);
		return originalGenerator != null ? originalGenerator : current;
	}

	public static synchronized FlatLevelSource getOrCreateFlatGenerator(ServerLevel level) {
		if (flatGenerator == null) {
			try {
				HolderGetter<Biome> biomes = level.registryAccess().lookupOrThrow(Registries.BIOME);
				HolderGetter<StructureSet> structures = level.registryAccess().lookupOrThrow(Registries.STRUCTURE_SET);
				HolderGetter<PlacedFeature> features = level.registryAccess().lookupOrThrow(Registries.PLACED_FEATURE);
				FlatLevelGeneratorSettings settings = FlatLevelGeneratorSettings.getDefault(biomes, structures, features);
				flatGenerator = new FlatLevelSource(settings);
				LOGGER.info("Initialized dynamic FlatLevelSource");
			} catch (Exception e) {
				LOGGER.error("Failed to initialize FlatLevelSource, falling back to original", e);
				return null;
			}
		}
		return flatGenerator;
	}

	public static synchronized VoidChunkGenerator getOrCreateVoidGenerator(ServerLevel level) {
		if (voidGenerator == null) {
			try {
				ChunkGenerator baseGen = getStandardGenerator(level);
				voidGenerator = new VoidChunkGenerator(baseGen.getBiomeSource());
				LOGGER.info("Initialized dynamic VoidChunkGenerator");
			} catch (Exception e) {
				LOGGER.error("Failed to initialize VoidChunkGenerator, falling back to original", e);
				return null;
			}
		}
		return voidGenerator;
	}

	public static ChunkGenerator getActiveGenerator(ServerLevel level) {
		if (level == null || level.dimension() != Level.OVERWORLD) {
			return null;
		}

		WorldType type = WorldConfig.get().getCurrentWorldType();
		if (type == null) {
			return null;
		}

		return switch (type) {
			case STANDARD -> null; // Uses original NoiseBasedChunkGenerator (Terralith/Normal)
			case FLAT -> getOrCreateFlatGenerator(level);
			case SKYBLOCK_V1, SKYBLOCK_V2, ONEBLOCK -> getOrCreateVoidGenerator(level);
		};
	}
}
