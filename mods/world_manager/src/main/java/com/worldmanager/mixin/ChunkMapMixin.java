package com.worldmanager.mixin;

import com.worldmanager.changes.ChunkChangesManager;
import com.worldmanager.config.WorldConfig;
import com.worldmanager.world.TerrainGenerators;
import com.worldmanager.world.WorldType;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.nbt.ListTag;
import net.minecraft.server.level.ChunkMap;
import net.minecraft.world.level.ChunkPos;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Unique;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

import java.util.Optional;
import java.util.concurrent.CompletableFuture;

@Mixin(ChunkMap.class)
public abstract class ChunkMapMixin {

	@Inject(method = "readChunk", at = @At("RETURN"), cancellable = true)
	private void onReadChunk(ChunkPos pos, CallbackInfoReturnable<CompletableFuture<Optional<CompoundTag>>> cir) {
		cir.setReturnValue(cir.getReturnValue().thenApply(opt -> {
			if (opt.isEmpty()) {
				return opt;
			}

			CompoundTag tag = opt.get();
			WorldType currentType = WorldConfig.get().getCurrentWorldType();
			if (currentType == null) {
				return opt;
			}

			if (currentType == WorldType.STANDARD) {
				// In standard world: if the chunk on disk is void or flat, regenerate it with normal Overworld terrain!
				if (isVoidChunk(tag) || isFlatTerrain(tag)) {
					return Optional.empty();
				}
			} else if (currentType == WorldType.FLAT) {
				// In flat world: if the chunk on disk is void, standard terrain, or anything not flat, regenerate with flat terrain!
				if (!isFlatTerrain(tag)) {
					return Optional.empty();
				}
			} else {
				// All other gamemodes (SKYBLOCK_V1, SKYBLOCK_V2, ONEBLOCK, etc.):
				// Check if this chunk is one of the starter islands (spawn island)
				if (!TerrainGenerators.isSpawnIslandChunk(currentType, pos.x, pos.z)) {
					// "The rest of the world" must be void!
					if (!isVoidChunk(tag)) {
						// Save changes before voiding
						if (!ChunkChangesManager.hasChanges(pos.x, pos.z)) {
							String prev = isFlatTerrain(tag) ? "flat" : "standard";
							ChunkChangesManager.saveChunkTag(pos.x, pos.z, tag.copy(), prev);
							return Optional.empty();
						}
					}
				}
			}

			return opt;
		}));
	}

	@Unique
	private static boolean isVoidChunk(CompoundTag tag) {
		if (tag == null) return true;
		if (hasBlockEntities(tag)) return false;
		if (!tag.contains("sections")) return true;

		ListTag sections = tag.getListOrEmpty("sections");
		if (sections.isEmpty()) return true;

		for (int i = 0; i < sections.size(); i++) {
			CompoundTag section = sections.getCompoundOrEmpty(i);
			if (hasNonAirBlocks(section)) {
				return false;
			}
		}
		return true;
	}

	@Unique
	private static boolean isFlatTerrain(CompoundTag tag) {
		if (tag == null || !tag.contains("sections")) return false;
		if (isVoidChunk(tag)) return false;

		ListTag sections = tag.getListOrEmpty("sections");
		boolean hasBottom = false;

		for (int i = 0; i < sections.size(); i++) {
			CompoundTag section = sections.getCompoundOrEmpty(i);
			byte y = section.getByteOr("Y", (byte) -128);
			// In flat terrain, only section Y = -4 (Y -64 to -49) has bedrock/dirt/grass.
			// Any section Y >= -3 with blocks means it's standard terrain, hills, or tall builds
			if (y >= -3 && hasNonAirBlocks(section)) {
				return false;
			}
			if (y == -4 && hasNonAirBlocks(section)) {
				hasBottom = true;
			}
		}

		return hasBottom;
	}

	@Unique
	private static boolean hasBlockEntities(CompoundTag tag) {
		if (tag.contains("block_entities")) {
			ListTag blockEntities = tag.getListOrEmpty("block_entities");
			return !blockEntities.isEmpty();
		}
		return false;
	}

	@Unique
	private static boolean hasNonAirBlocks(CompoundTag section) {
		if (!section.contains("block_states")) {
			return false;
		}
		CompoundTag blockStates = section.getCompoundOrEmpty("block_states");
		if (!blockStates.contains("palette")) {
			return false;
		}
		ListTag palette = blockStates.getListOrEmpty("palette");
		for (int j = 0; j < palette.size(); j++) {
			CompoundTag entry = palette.getCompoundOrEmpty(j);
			String name = entry.getStringOr("Name", "minecraft:air");
			if (!name.equals("minecraft:air") &&
				!name.equals("minecraft:cave_air") &&
				!name.equals("minecraft:void_air")) {
				return true;
			}
		}
		return false;
	}
}
