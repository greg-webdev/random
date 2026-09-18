package com.oneblockskyblock.worldgen;

import com.mojang.serialization.Codec;
import com.oneblockskyblock.skyblock.SkyblockGenerator;
import net.minecraft.core.BlockPos;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.level.ChunkPos;
import net.minecraft.world.level.levelgen.feature.Feature;
import net.minecraft.world.level.levelgen.feature.FeaturePlaceContext;
import net.minecraft.world.level.levelgen.feature.configurations.NoneFeatureConfiguration;

public class SkyblockIslandFeature extends Feature<NoneFeatureConfiguration> {

	public SkyblockIslandFeature(Codec<NoneFeatureConfiguration> codec) {
		super(codec);
	}

	@Override
	public boolean place(FeaturePlaceContext<NoneFeatureConfiguration> context) {
		ChunkPos chunkPos = new ChunkPos(context.origin());
		if (chunkPos.x == 0 && chunkPos.z == 0) {
			ServerLevel level = context.level().getLevel();
			SkyblockGenerator.generateIsland(level, new BlockPos(0, 64, 0), true);
		}
		return true;
	}
}
