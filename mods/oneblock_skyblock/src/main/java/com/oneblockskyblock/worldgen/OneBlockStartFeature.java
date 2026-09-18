package com.oneblockskyblock.worldgen;

import com.mojang.serialization.Codec;
import com.oneblockskyblock.oneblock.OneBlockManager;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.level.ChunkPos;
import net.minecraft.world.level.levelgen.feature.Feature;
import net.minecraft.world.level.levelgen.feature.FeaturePlaceContext;
import net.minecraft.world.level.levelgen.feature.configurations.NoneFeatureConfiguration;

public class OneBlockStartFeature extends Feature<NoneFeatureConfiguration> {

	public OneBlockStartFeature(Codec<NoneFeatureConfiguration> codec) {
		super(codec);
	}

	@Override
	public boolean place(FeaturePlaceContext<NoneFeatureConfiguration> context) {
		ChunkPos chunkPos = new ChunkPos(context.origin());
		if (chunkPos.x == 0 && chunkPos.z == 0) {
			ServerLevel level = context.level().getLevel();
			OneBlockManager.initSpawn(level);
		}
		return true;
	}
}
