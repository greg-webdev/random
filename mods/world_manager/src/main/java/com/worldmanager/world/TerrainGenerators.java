package com.worldmanager.world;

import com.worldmanager.changes.ChunkChangesManager;
import com.worldmanager.oneblock.OneBlockManager;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.level.ChunkPos;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.ChestBlock;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.entity.ChestBlockEntity;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.chunk.ChunkGenerator;
import net.minecraft.world.level.chunk.LevelChunk;
import net.minecraft.world.level.chunk.LevelChunkSection;
import net.minecraft.world.level.levelgen.Heightmap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;

public class TerrainGenerators {
	private static final Logger LOGGER = LoggerFactory.getLogger("WorldManager/Terrain");
	private static final Random RANDOM = new Random();

	public static boolean isSpawnIslandChunk(WorldType type, int cx, int cz) {
		if (cx == 0 && cz == 0) return true;
		if (type == WorldType.SKYBLOCK_V2) {
			return (cx == 3 && cz == 0) || (cx == 0 && cz == 3) || (cx == -4 && cz == 0);
		}
		return false;
	}

	public static boolean isVoidChunk(LevelChunk chunk) {
		if (chunk == null) return true;
		if (!chunk.getBlockEntities().isEmpty()) return false;
		for (LevelChunkSection section : chunk.getSections()) {
			if (section != null && !section.hasOnlyAir()) {
				return false;
			}
		}
		return true;
	}

	public static void clearWorldToVoid(ServerLevel level, WorldType targetType, WorldType previousType, int radiusChunks) {
		int clearedCount = 0;
		for (int cx = -radiusChunks; cx <= radiusChunks; cx++) {
			for (int cz = -radiusChunks; cz <= radiusChunks; cz++) {
				if (isSpawnIslandChunk(targetType, cx, cz)) {
					continue;
				}
				LevelChunk chunk = level.getChunkSource().getChunkNow(cx, cz);
				if (chunk != null && !isVoidChunk(chunk)) {
					ChunkChangesManager.saveLevelChunk(level, chunk, previousType);
					clearChunk(level, cx, cz);
					clearedCount++;
				}
			}
		}
		if (clearedCount > 0) {
			LOGGER.info("Cleared {} loaded chunks to void (saved changes to world_changes/) for {}", clearedCount, targetType.getId());
		}
	}

	public static void clearSpawnChunks(ServerLevel level, int radiusChunks) {
		for (int cx = -radiusChunks; cx <= radiusChunks; cx++) {
			for (int cz = -radiusChunks; cz <= radiusChunks; cz++) {
				clearChunk(level, cx, cz);
			}
		}
	}

	public static void clearChunk(ServerLevel level, int chunkX, int chunkZ) {
		LevelChunk chunk = level.getChunk(chunkX, chunkZ);
		chunk.clearAllBlockEntities();
		LevelChunkSection[] sections = chunk.getSections();
		BlockState air = Blocks.AIR.defaultBlockState();

		for (LevelChunkSection section : sections) {
			if (section != null && !section.hasOnlyAir()) {
				for (int y = 0; y < 16; y++) {
					for (int z = 0; z < 16; z++) {
						for (int x = 0; x < 16; x++) {
							section.setBlockState(x, y, z, air, false);
						}
					}
				}
				section.recalcBlockCounts();
			}
		}
		chunk.markUnsaved();
	}

	public static BlockPos generateSkyblockV1(ServerLevel level) {
		return generateSkyblockV1(level, null);
	}

	public static BlockPos generateSkyblockV1(ServerLevel level, WorldType previousType) {
		clearChunk(level, 0, 0);
		clearWorldToVoid(level, WorldType.SKYBLOCK_V1, previousType, 16);

		BlockPos origin = new BlockPos(0, 64, 0);
		buildSkyblockIsland(level, origin);
		generateOakTree(level, new BlockPos(-1, 65, -1));

		// Classic Starter Chest
		BlockPos chestPos = new BlockPos(1, 65, 4);
		BlockState chestState = Blocks.CHEST.defaultBlockState().setValue(ChestBlock.FACING, Direction.NORTH);
		level.setBlock(chestPos, chestState, 3);
		BlockEntity be = level.getBlockEntity(chestPos);
		if (be instanceof ChestBlockEntity chest) {
			chest.setItem(0, new ItemStack(Items.LAVA_BUCKET, 1));
			chest.setItem(1, new ItemStack(Items.ICE, 2));
			chest.setItem(2, new ItemStack(Items.OAK_SAPLING, 1));
			chest.setItem(3, new ItemStack(Items.SUGAR_CANE, 1));
			chest.setItem(4, new ItemStack(Items.CACTUS, 1));
			chest.setItem(5, new ItemStack(Items.MELON_SLICE, 1));
			chest.setItem(6, new ItemStack(Items.PUMPKIN_SEEDS, 1));
			chest.setItem(7, new ItemStack(Items.RED_MUSHROOM, 1));
			chest.setItem(8, new ItemStack(Items.BROWN_MUSHROOM, 1));
			chest.setItem(9, new ItemStack(Items.STRING, 12));
			chest.setItem(10, new ItemStack(Items.BONE, 1));
		}

		return new BlockPos(0, 65, 0);
	}

	public static BlockPos generateSkyblockV2(ServerLevel level) {
		return generateSkyblockV2(level, null);
	}

	public static BlockPos generateSkyblockV2(ServerLevel level, WorldType previousType) {
		// Base V1 main island and void clear
		BlockPos spawnPos = generateSkyblockV1(level, previousType);

		// Sand Island at (50, 64, 0) -> chunk (3, 0)
		clearChunk(level, 3, 0);
		int sx = 50, sy = 64, sz = 0;
		for (int dx = -2; dx <= 2; dx++) {
			for (int dz = -2; dz <= 2; dz++) {
				level.setBlock(new BlockPos(sx + dx, sy - 2, sz + dz), Blocks.SANDSTONE.defaultBlockState(), 3);
				level.setBlock(new BlockPos(sx + dx, sy - 1, sz + dz), Blocks.SANDSTONE.defaultBlockState(), 3);
				level.setBlock(new BlockPos(sx + dx, sy, sz + dz), Blocks.SAND.defaultBlockState(), 3);
			}
		}
		level.setBlock(new BlockPos(sx, sy + 1, sz), Blocks.CACTUS.defaultBlockState(), 3);
		level.setBlock(new BlockPos(sx, sy + 2, sz), Blocks.CACTUS.defaultBlockState(), 3);

		BlockPos sandChestPos = new BlockPos(sx + 1, sy + 1, sz + 1);
		level.setBlock(sandChestPos, Blocks.CHEST.defaultBlockState(), 3);
		BlockEntity sbe = level.getBlockEntity(sandChestPos);
		if (sbe instanceof ChestBlockEntity sandChest) {
			sandChest.setItem(0, new ItemStack(Items.OBSIDIAN, 10));
			sandChest.setItem(1, new ItemStack(Items.PUMPKIN_SEEDS, 2));
		}

		// Nether Mini Island at (0, 64, 50) -> chunk (0, 3)
		clearChunk(level, 0, 3);
		int nx = 0, ny = 64, nz = 50;
		for (int dx = -2; dx <= 2; dx++) {
			for (int dz = -2; dz <= 2; dz++) {
				level.setBlock(new BlockPos(nx + dx, ny - 1, nz + dz), Blocks.NETHERRACK.defaultBlockState(), 3);
				level.setBlock(new BlockPos(nx + dx, ny, nz + dz), Blocks.WARPED_NYLIUM.defaultBlockState(), 3);
			}
		}
		level.setBlock(new BlockPos(nx, ny + 1, nz), Blocks.WARPED_STEM.defaultBlockState(), 3);
		level.setBlock(new BlockPos(nx, ny + 2, nz), Blocks.WARPED_STEM.defaultBlockState(), 3);
		level.setBlock(new BlockPos(nx, ny + 3, nz), Blocks.GLOWSTONE.defaultBlockState(), 3);

		// Ice Island at (-50, 64, 0) -> chunk (-4, 0)
		clearChunk(level, -4, 0);
		int ix = -50, iy = 64, iz = 0;
		for (int dx = -2; dx <= 2; dx++) {
			for (int dz = -2; dz <= 2; dz++) {
				level.setBlock(new BlockPos(ix + dx, iy - 1, iz + dz), Blocks.PACKED_ICE.defaultBlockState(), 3);
				level.setBlock(new BlockPos(ix + dx, iy, iz + dz), Blocks.SNOW_BLOCK.defaultBlockState(), 3);
			}
		}
		generateSpruceTree(level, new BlockPos(ix, iy + 1, iz));

		return spawnPos;
	}

	public static BlockPos generateOneBlock(ServerLevel level) {
		return generateOneBlock(level, null);
	}

	public static BlockPos generateOneBlock(ServerLevel level, WorldType previousType) {
		clearChunk(level, 0, 0);
		clearWorldToVoid(level, WorldType.ONEBLOCK, previousType, 16);
		OneBlockManager.initSpawn(level);
		return new BlockPos(0, 65, 0);
	}

	public static void setFlatChunk(LevelChunk chunk) {
		if (chunk == null) return;
		chunk.clearAllBlockEntities();
		BlockState bedrock = Blocks.BEDROCK.defaultBlockState();
		BlockState dirt = Blocks.DIRT.defaultBlockState();
		BlockState grass = Blocks.GRASS_BLOCK.defaultBlockState();
		BlockState air = Blocks.AIR.defaultBlockState();

		LevelChunkSection[] sections = chunk.getSections();
		for (LevelChunkSection section : sections) {
			if (section != null && !section.hasOnlyAir()) {
				for (int y = 0; y < 16; y++) {
					for (int z = 0; z < 16; z++) {
						for (int x = 0; x < 16; x++) {
							section.setBlockState(x, y, z, air, false);
						}
					}
				}
				section.recalcBlockCounts();
			}
		}

		ChunkPos pos = chunk.getPos();
		for (int lx = 0; lx < 16; lx++) {
			for (int lz = 0; lz < 16; lz++) {
				int gx = pos.x * 16 + lx;
				int gz = pos.z * 16 + lz;
				chunk.setBlockState(new BlockPos(gx, -64, gz), bedrock, 0);
				chunk.setBlockState(new BlockPos(gx, -63, gz), dirt, 0);
				chunk.setBlockState(new BlockPos(gx, -62, gz), dirt, 0);
				chunk.setBlockState(new BlockPos(gx, -61, gz), grass, 0);
			}
		}
		chunk.markUnsaved();
	}

	public static boolean isFlatTerrainChunk(LevelChunk chunk) {
		if (chunk == null) return false;
		LevelChunkSection[] sections = chunk.getSections();
		for (int i = 1; i < sections.length; i++) {
			LevelChunkSection s = sections[i];
			if (s != null && !s.hasOnlyAir()) {
				return false;
			}
		}
		LevelChunkSection bottom = sections[0];
		return bottom != null && !bottom.hasOnlyAir();
	}

	public static BlockPos generateFlat(ServerLevel level) {
		int radius = 16;
		for (int cx = -radius; cx <= radius; cx++) {
			for (int cz = -radius; cz <= radius; cz++) {
				LevelChunk chunk = level.getChunkSource().getChunkNow(cx, cz);
				if (chunk != null) {
					if (!isFlatTerrainChunk(chunk)) {
						setFlatChunk(chunk);
					}
				} else if (Math.abs(cx) <= 4 && Math.abs(cz) <= 4) {
					setFlatChunk(level.getChunk(cx, cz));
				}
			}
		}

		return new BlockPos(0, -60, 0);
	}

	public static BlockPos generateStandard(ServerLevel level) {
		// 1. If natural terrain already exists at spawn (e.g. non-air, non-void), preserve it
		int existingHeight = level.getHeight(Heightmap.Types.MOTION_BLOCKING, 0, 0);
		if (existingHeight > 55 && existingHeight < 256) {
			BlockState atSurface = level.getBlockState(new BlockPos(0, existingHeight - 1, 0));
			if (!atSurface.isAir()) {
				BlockState below = level.getBlockState(new BlockPos(0, 30, 0));
				if (!below.isAir()) {
					LOGGER.info("Natural terrain detected at spawn (Y={}), preserving world!", existingHeight);
					return new BlockPos(0, existingHeight, 0);
				}
			}
		}

		clearSpawnChunks(level, 4);

		ChunkGenerator gen = DynamicTerrainManager.getStandardGenerator(level);
		net.minecraft.world.level.levelgen.RandomState randomState = level.getChunkSource().randomState();
		int spawnSurfaceY = 64;

		for (int cx = -4; cx <= 4; cx++) {
			for (int cz = -4; cz <= 4; cz++) {
				LevelChunk chunk = level.getChunk(cx, cz);

				for (int lx = 0; lx < 16; lx++) {
					for (int lz = 0; lz < 16; lz++) {
						int gx = cx * 16 + lx;
						int gz = cz * 16 + lz;

						net.minecraft.world.level.NoiseColumn col = gen.getBaseColumn(gx, gz, level, randomState);
						int highestSolidY = -64;

						for (int y = -64; y <= 256; y++) {
							BlockState bs = col.getBlock(y);
							if (!bs.isAir()) {
								chunk.setBlockState(new BlockPos(gx, y, gz), bs, 0);
								highestSolidY = Math.max(highestSolidY, y);
							} else if (y <= 62 && highestSolidY < y) {
								chunk.setBlockState(new BlockPos(gx, y, gz), Blocks.WATER.defaultBlockState(), 0);
							}
						}

						// Top soil cap
						if (highestSolidY >= 62) {
							BlockState topState = chunk.getBlockState(new BlockPos(gx, highestSolidY, gz));
							if (topState.is(Blocks.STONE) || topState.is(Blocks.DIRT)) {
								chunk.setBlockState(new BlockPos(gx, highestSolidY, gz), Blocks.GRASS_BLOCK.defaultBlockState(), 0);
								for (int dy = 1; dy <= 3; dy++) {
									BlockState sub = chunk.getBlockState(new BlockPos(gx, highestSolidY - dy, gz));
									if (sub.is(Blocks.STONE)) {
										chunk.setBlockState(new BlockPos(gx, highestSolidY - dy, gz), Blocks.DIRT.defaultBlockState(), 0);
									}
								}
							}
						}

						if (gx == 0 && gz == 0) {
							spawnSurfaceY = Math.max(64, highestSolidY);
						}
					}
				}
				chunk.markUnsaved();
			}
		}

		// Starter survival chest near spawn
		BlockPos chestPos = new BlockPos(1, spawnSurfaceY + 1, 1);
		level.setBlock(chestPos, Blocks.CHEST.defaultBlockState(), 3);
		BlockEntity be = level.getBlockEntity(chestPos);
		if (be instanceof ChestBlockEntity chest) {
			chest.setItem(0, new ItemStack(Items.STONE_PICKAXE, 1));
			chest.setItem(1, new ItemStack(Items.STONE_AXE, 1));
			chest.setItem(2, new ItemStack(Items.BREAD, 16));
			chest.setItem(3, new ItemStack(Items.TORCH, 16));
			chest.setItem(4, new ItemStack(Items.OAK_SAPLING, 4));
		}

		BlockPos spawnPos = new BlockPos(0, spawnSurfaceY + 1, 0);
		LOGGER.info("Generated standard terrain spawn at {}", spawnPos);
		return spawnPos;
	}

	private static BlockState pickDeepOre() {
		int r = RANDOM.nextInt(100);
		if (r < 10) return Blocks.DEEPSLATE_DIAMOND_ORE.defaultBlockState();
		if (r < 30) return Blocks.DEEPSLATE_GOLD_ORE.defaultBlockState();
		if (r < 60) return Blocks.DEEPSLATE_REDSTONE_ORE.defaultBlockState();
		return Blocks.DEEPSLATE_IRON_ORE.defaultBlockState();
	}

	private static BlockState pickStoneOre() {
		int r = RANDOM.nextInt(100);
		if (r < 40) return Blocks.COAL_ORE.defaultBlockState();
		if (r < 75) return Blocks.IRON_ORE.defaultBlockState();
		return Blocks.COPPER_ORE.defaultBlockState();
	}

	private static void buildSkyblockIsland(ServerLevel level, BlockPos origin) {
		int ox = origin.getX(), oy = origin.getY(), oz = origin.getZ();
		List<BlockPos> base = new ArrayList<>();

		// Main 3x3
		for (int x = -1; x <= 1; x++) {
			for (int z = -1; z <= 1; z++) {
				base.add(new BlockPos(ox + x, oy, oz + z));
			}
		}
		// L-stem 3x3
		for (int x = 0; x <= 2; x++) {
			for (int z = 2; z <= 4; z++) {
				base.add(new BlockPos(ox + x, oy, oz + z));
			}
		}

		for (BlockPos p : base) {
			BlockPos bBottom = p.atY(oy - 2);
			if (p.getX() == ox && p.getZ() == oz) {
				level.setBlock(bBottom, Blocks.BEDROCK.defaultBlockState(), 3);
			} else {
				level.setBlock(bBottom, Blocks.DIRT.defaultBlockState(), 3);
			}
			level.setBlock(p.atY(oy - 1), Blocks.DIRT.defaultBlockState(), 3);
			level.setBlock(p, Blocks.GRASS_BLOCK.defaultBlockState(), 3);
		}
	}

	private static void generateOakTree(ServerLevel level, BlockPos base) {
		int tx = base.getX(), ty = base.getY(), tz = base.getZ();
		for (int dy = 0; dy < 5; dy++) {
			level.setBlock(new BlockPos(tx, ty + dy, tz), Blocks.OAK_LOG.defaultBlockState(), 3);
		}
		for (int dy = 3; dy <= 4; dy++) {
			for (int dx = -2; dx <= 2; dx++) {
				for (int dz = -2; dz <= 2; dz++) {
					if (Math.abs(dx) == 2 && Math.abs(dz) == 2) continue;
					BlockPos lp = new BlockPos(tx + dx, ty + dy, tz + dz);
					if (level.getBlockState(lp).isAir()) {
						level.setBlock(lp, Blocks.OAK_LEAVES.defaultBlockState(), 3);
					}
				}
			}
		}
		for (int dx = -1; dx <= 1; dx++) {
			for (int dz = -1; dz <= 1; dz++) {
				if (Math.abs(dx) == 1 && Math.abs(dz) == 1) continue;
				BlockPos lp = new BlockPos(tx + dx, ty + 5, tz + dz);
				if (level.getBlockState(lp).isAir()) {
					level.setBlock(lp, Blocks.OAK_LEAVES.defaultBlockState(), 3);
				}
			}
		}
		level.setBlock(new BlockPos(tx, ty + 6, tz), Blocks.OAK_LEAVES.defaultBlockState(), 3);
	}

	private static void generateSpruceTree(ServerLevel level, BlockPos base) {
		int tx = base.getX(), ty = base.getY(), tz = base.getZ();
		for (int dy = 0; dy < 6; dy++) {
			level.setBlock(new BlockPos(tx, ty + dy, tz), Blocks.SPRUCE_LOG.defaultBlockState(), 3);
		}
		for (int dy = 2; dy <= 3; dy++) {
			for (int dx = -2; dx <= 2; dx++) {
				for (int dz = -2; dz <= 2; dz++) {
					if (Math.abs(dx) == 2 && Math.abs(dz) == 2) continue;
					BlockPos lp = new BlockPos(tx + dx, ty + dy, tz + dz);
					if (level.getBlockState(lp).isAir()) {
						level.setBlock(lp, Blocks.SPRUCE_LEAVES.defaultBlockState(), 3);
					}
				}
			}
		}
		for (int dy = 4; dy <= 5; dy++) {
			for (int dx = -1; dx <= 1; dx++) {
				for (int dz = -1; dz <= 1; dz++) {
					BlockPos lp = new BlockPos(tx + dx, ty + dy, tz + dz);
					if (level.getBlockState(lp).isAir()) {
						level.setBlock(lp, Blocks.SPRUCE_LEAVES.defaultBlockState(), 3);
					}
				}
			}
		}
		level.setBlock(new BlockPos(tx, ty + 6, tz), Blocks.SPRUCE_LEAVES.defaultBlockState(), 3);
	}
}
