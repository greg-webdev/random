package com.worldmanager.mixin;

import com.worldmanager.world.DynamicTerrainManager;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.level.chunk.ChunkGenerator;
import net.minecraft.world.level.chunk.status.WorldGenContext;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(WorldGenContext.class)
public abstract class WorldGenContextMixin {
	@Shadow private ServerLevel level;
	@Shadow private ChunkGenerator generator;

	@Inject(method = "generator", at = @At("HEAD"), cancellable = true)
	private void onGetGenerator(CallbackInfoReturnable<ChunkGenerator> cir) {
		if (this.level != null) {
			DynamicTerrainManager.setOriginalGenerator(this.generator);

			ChunkGenerator dynamicGen = DynamicTerrainManager.getActiveGenerator(this.level);
			if (dynamicGen != null) {
				cir.setReturnValue(dynamicGen);
			}
		}
	}
}
