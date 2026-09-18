package com.oneblockskyblock.skyblock;

import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.ChestBlock;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.entity.ChestBlockEntity;
import net.minecraft.world.level.block.state.BlockState;

import java.util.ArrayList;
import java.util.List;

public class SkyblockGenerator {

	public static void generateIsland(ServerLevel level, BlockPos origin, boolean generateSandIsland) {
		int ox = origin.getX();
		int oy = origin.getY(); // 64
		int oz = origin.getZ();

		// Compute L-shape island block positions
		List<BlockPos> islandBase = new ArrayList<>();
		// Main 3x3 at Z: -1 .. 1, X: -1 .. 1
		for (int x = -1; x <= 1; x++) {
			for (int z = -1; z <= 1; z++) {
				islandBase.add(new BlockPos(ox + x, oy, oz + z));
			}
		}
		// L-stem 3x3 at Z: 2 .. 4, X: 0 .. 2
		for (int x = 0; x <= 2; x++) {
			for (int z = 2; z <= 4; z++) {
				islandBase.add(new BlockPos(ox + x, oy, oz + z));
			}
		}

		// Place island layers
		for (BlockPos p : islandBase) {
			// Y = 62 (Bottom layer): Bedrock at center, Dirt everywhere else
			BlockPos bBottom = p.atY(oy - 2);
			if (p.getX() == ox && p.getZ() == oz) {
				level.setBlock(bBottom, Blocks.BEDROCK.defaultBlockState(), 3);
			} else {
				level.setBlock(bBottom, Blocks.DIRT.defaultBlockState(), 3);
			}

			// Y = 63 (Middle layer): Dirt
			BlockPos bMid = p.atY(oy - 1);
			level.setBlock(bMid, Blocks.DIRT.defaultBlockState(), 3);

			// Y = 64 (Top layer): Grass Block
			level.setBlock(p, Blocks.GRASS_BLOCK.defaultBlockState(), 3);
		}

		// Generate Oak Tree at (-1, 65, -1)
		generateTree(level, new BlockPos(ox - 1, oy + 1, oz - 1));

		// Generate Starter Chest at (ox + 1, oy + 1, oz + 4)
		BlockPos chestPos = new BlockPos(ox + 1, oy + 1, oz + 4);
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

		// Optional Sand Island in the distance (at X+60)
		if (generateSandIsland) {
			int sx = ox + 60;
			int sz = oz;
			for (int dx = -1; dx <= 1; dx++) {
				for (int dz = -1; dz <= 1; dz++) {
					level.setBlock(new BlockPos(sx + dx, oy - 2, sz + dz), Blocks.SANDSTONE.defaultBlockState(), 3);
					level.setBlock(new BlockPos(sx + dx, oy - 1, sz + dz), Blocks.SANDSTONE.defaultBlockState(), 3);
					level.setBlock(new BlockPos(sx + dx, oy, sz + dz), Blocks.SAND.defaultBlockState(), 3);
				}
			}
			// Cactus at center
			level.setBlock(new BlockPos(sx, oy + 1, sz), Blocks.CACTUS.defaultBlockState(), 3);
			level.setBlock(new BlockPos(sx, oy + 2, sz), Blocks.CACTUS.defaultBlockState(), 3);

			// Sand island chest
			BlockPos sandChestPos = new BlockPos(sx + 1, oy + 1, sz + 1);
			level.setBlock(sandChestPos, Blocks.CHEST.defaultBlockState(), 3);
			BlockEntity sbe = level.getBlockEntity(sandChestPos);
			if (sbe instanceof ChestBlockEntity sandChest) {
				sandChest.setItem(0, new ItemStack(Items.OBSIDIAN, 10));
				sandChest.setItem(1, new ItemStack(Items.PUMPKIN_SEEDS, 1));
			}
		}

		// Set default spawn position
		level.setRespawnData(net.minecraft.world.level.storage.LevelData.RespawnData.of(level.dimension(), new BlockPos(ox, oy + 1, oz), 0.0f, 0.0f));
	}

	private static void generateTree(ServerLevel level, BlockPos base) {
		int tx = base.getX();
		int ty = base.getY();
		int tz = base.getZ();

		// Trunk (5 logs)
		for (int dy = 0; dy < 5; dy++) {
			level.setBlock(new BlockPos(tx, ty + dy, tz), Blocks.OAK_LOG.defaultBlockState(), 3);
		}

		// Leaves at height 3 and 4 (5x5 layer without corners)
		for (int dy = 3; dy <= 4; dy++) {
			for (int dx = -2; dx <= 2; dx++) {
				for (int dz = -2; dz <= 2; dz++) {
					if (Math.abs(dx) == 2 && Math.abs(dz) == 2) continue; // Skip corners
					BlockPos lp = new BlockPos(tx + dx, ty + dy, tz + dz);
					if (level.getBlockState(lp).isAir()) {
						level.setBlock(lp, Blocks.OAK_LEAVES.defaultBlockState(), 3);
					}
				}
			}
		}

		// Leaves at height 5 (3x3 layer without corners)
		for (int dx = -1; dx <= 1; dx++) {
			for (int dz = -1; dz <= 1; dz++) {
				if (Math.abs(dx) == 1 && Math.abs(dz) == 1) continue;
				BlockPos lp = new BlockPos(tx + dx, ty + 5, tz + dz);
				if (level.getBlockState(lp).isAir()) {
					level.setBlock(lp, Blocks.OAK_LEAVES.defaultBlockState(), 3);
				}
			}
		}

		// Leaves at height 6 (Top cap)
		level.setBlock(new BlockPos(tx, ty + 5, tz), Blocks.OAK_LEAVES.defaultBlockState(), 3);
		level.setBlock(new BlockPos(tx, ty + 6, tz), Blocks.OAK_LEAVES.defaultBlockState(), 3);
	}
}
