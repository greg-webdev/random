package com.infiniteprinter;

import net.minecraft.client.multiplayer.ClientLevel;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.world.level.block.*;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.block.state.properties.BlockStateProperties;
import net.minecraft.world.level.block.state.properties.Half;
import net.minecraft.world.level.block.state.properties.SlabType;
import net.minecraft.world.phys.BlockHitResult;
import net.minecraft.world.phys.Vec3;

public class PlacementHelper {

    /**
     * Verifies that a block CAN physically be placed right now:
     * 1. target.canSurvive(world, pos) is satisfied (floor for repeaters, wall for wall torches, etc.)
     * 2. Hoppers: if horizontal, the target container must exist first!
     * 3. Shulker Boxes / Rods: supporting block matching facing must exist first!
     * 4. Logs / Pillars: supporting block along the target axis must exist first!
     * 5. Wall blocks: wall block behind must exist first!
     * 6. There is a valid solid block face nearby to click against
     */
    public static boolean canPlace(ClientLevel world, BlockPos pos, BlockState target, boolean infiniteReach) {
        if (world == null || target == null) {
            return false;
        }

        // Must survive (prevents repeaters, dust, torches from being placed in midair)
        if (!target.canSurvive(world, pos)) {
            return false;
        }

        // 1. Hoppers: If pointing horizontally, the container block must exist in world first!
        if (target.getBlock() instanceof HopperBlock && target.hasProperty(BlockStateProperties.FACING_HOPPER)) {
            Direction facing = target.getValue(BlockStateProperties.FACING_HOPPER);
            if (facing != Direction.DOWN) {
                BlockPos targetNeighbor = pos.relative(facing);
                if (!isSolid(world, targetNeighbor)) {
                    return false; // Wait until container exists!
                }
            }
        }

        // 2. Wall blocks (Wall Sign, Wall Torch, Wall Hanging Sign, Ladder):
        // MUST have the wall block behind them!
        if ((target.getBlock() instanceof WallSignBlock
                || target.getBlock() instanceof WallTorchBlock
                || target.getBlock() instanceof RedstoneWallTorchBlock
                || target.getBlock() instanceof WallHangingSignBlock
                || target.getBlock() instanceof LadderBlock)
                && target.hasProperty(BlockStateProperties.HORIZONTAL_FACING)) {
            Direction facing = target.getValue(BlockStateProperties.HORIZONTAL_FACING);
            BlockPos wallPos = pos.relative(facing.getOpposite());
            if (!isSolid(world, wallPos)) {
                return false;
            }
        }

        // 3. Shulker Boxes & Rods (facing determined by clickedFace):
        if ((target.getBlock() instanceof ShulkerBoxBlock || target.getBlock() instanceof RodBlock)
                && target.hasProperty(BlockStateProperties.FACING)) {
            Direction facing = target.getValue(BlockStateProperties.FACING);
            BlockPos supportPos = pos.relative(facing.getOpposite());
            if (!isSolid(world, supportPos)) {
                return false; // Wait until supporting face exists so it doesn't get placed facing wrong direction!
            }
        }

        // 4. Rotated Pillars (Logs, Bark, Pillars, Chains):
        if (target.hasProperty(RotatedPillarBlock.AXIS)) {
            Direction.Axis axis = target.getValue(RotatedPillarBlock.AXIS);
            if (axis == Direction.Axis.X) {
                if (!isSolid(world, pos.west()) && !isSolid(world, pos.east())) {
                    return false; // Need an X-aligned neighbor to click against!
                }
            } else if (axis == Direction.Axis.Z) {
                if (!isSolid(world, pos.north()) && !isSolid(world, pos.south())) {
                    return false; // Need a Z-aligned neighbor to click against!
                }
            } else if (axis == Direction.Axis.Y) {
                if (!isSolid(world, pos.below()) && !isSolid(world, pos.above())) {
                    return false;
                }
            }
        }

        // 5. Check for supporting solid neighbors
        for (Direction dir : Direction.values()) {
            BlockPos neighbor = pos.relative(dir);
            if (isSolid(world, neighbor)) {
                return true;
            }
        }

        // Allow air place only for solid blocks in infinite reach mode
        return infiniteReach && (target.canOcclude() || target.blocksMotion());
    }

    public static BlockHitResult calculateHitResult(ClientLevel world, BlockPos targetPos, BlockState schematicState) {
        double hitX = targetPos.getX() + 0.5;
        double hitY = targetPos.getY() + 0.5;
        double hitZ = targetPos.getZ() + 0.5;


        // 2. Wall Signs: MUST click the wall block behind them!
        if (schematicState.getBlock() instanceof WallSignBlock && schematicState.hasProperty(BlockStateProperties.HORIZONTAL_FACING)) {
            Direction facing = schematicState.getValue(BlockStateProperties.HORIZONTAL_FACING);
            BlockPos wallPos = targetPos.relative(facing.getOpposite());
            if (isSolid(world, wallPos)) {
                return createHitResult(wallPos, facing, hitX, hitY, hitZ);
            }
        }

        // 3. Wall Torches & Redstone Wall Torches: MUST click the wall block behind them!
        if ((schematicState.getBlock() instanceof WallTorchBlock || schematicState.getBlock() instanceof RedstoneWallTorchBlock)
                && schematicState.hasProperty(BlockStateProperties.HORIZONTAL_FACING)) {
            Direction facing = schematicState.getValue(BlockStateProperties.HORIZONTAL_FACING);
            BlockPos wallPos = targetPos.relative(facing.getOpposite());
            if (isSolid(world, wallPos)) {
                return createHitResult(wallPos, facing, hitX, hitY, hitZ);
            }
        }

        // 4. Wall Hanging Signs: MUST click the wall block behind them!
        if (schematicState.getBlock() instanceof WallHangingSignBlock && schematicState.hasProperty(BlockStateProperties.HORIZONTAL_FACING)) {
            Direction facing = schematicState.getValue(BlockStateProperties.HORIZONTAL_FACING);
            BlockPos wallPos = targetPos.relative(facing.getOpposite());
            if (isSolid(world, wallPos)) {
                return createHitResult(wallPos, facing, hitX, hitY, hitZ);
            }
        }

        // 5. Ladders: MUST click the wall block behind them!
        if (schematicState.getBlock() instanceof LadderBlock && schematicState.hasProperty(BlockStateProperties.HORIZONTAL_FACING)) {
            Direction facing = schematicState.getValue(BlockStateProperties.HORIZONTAL_FACING);
            BlockPos wallPos = targetPos.relative(facing.getOpposite());
            if (isSolid(world, wallPos)) {
                return createHitResult(wallPos, facing, hitX, hitY, hitZ);
            }
        }

        // 6. Handle Shulker Boxes & Rods (facing is set to clickedFace)
        if ((schematicState.getBlock() instanceof ShulkerBoxBlock || schematicState.getBlock() instanceof RodBlock)
                && schematicState.hasProperty(BlockStateProperties.FACING)) {
            Direction facing = schematicState.getValue(BlockStateProperties.FACING);
            BlockPos supportPos = targetPos.relative(facing.getOpposite());
            if (isSolid(world, supportPos)) {
                return createHitResult(supportPos, facing, hitX, hitY, hitZ);
            }
        }

        // 7. Handle Hopper spout orientation (points into clicked face's opposite)
        if (schematicState.getBlock() instanceof HopperBlock && schematicState.hasProperty(BlockStateProperties.FACING_HOPPER)) {
            Direction facing = schematicState.getValue(BlockStateProperties.FACING_HOPPER);
            if (facing == Direction.DOWN) {
                BlockPos below = targetPos.below();
                if (isSolid(world, below)) {
                    return new BlockHitResult(new Vec3(hitX, targetPos.getY(), hitZ), Direction.UP, below, false);
                }
            } else {
                BlockPos targetNeighbor = targetPos.relative(facing);
                if (isSolid(world, targetNeighbor)) {
                    return createHitResult(targetNeighbor, facing.getOpposite(), hitX, hitY, hitZ);
                }
            }
        }

        // 8. Handle Slab top/bottom half
        if (schematicState.hasProperty(BlockStateProperties.SLAB_TYPE)) {
            SlabType type = schematicState.getValue(BlockStateProperties.SLAB_TYPE);
            if (type == SlabType.TOP) {
                BlockPos above = targetPos.above();
                if (isSolid(world, above)) {
                    return new BlockHitResult(new Vec3(hitX, targetPos.getY() + 1.0, hitZ), Direction.DOWN, above, false);
                }
            } else if (type == SlabType.BOTTOM) {
                BlockPos below = targetPos.below();
                if (isSolid(world, below)) {
                    return new BlockHitResult(new Vec3(hitX, targetPos.getY(), hitZ), Direction.UP, below, false);
                }
            }
        }

        // 9. Handle Stairs half
        if (schematicState.hasProperty(BlockStateProperties.HALF)) {
            Half half = schematicState.getValue(BlockStateProperties.HALF);
            if (half == Half.TOP) {
                BlockPos above = targetPos.above();
                if (isSolid(world, above)) {
                    return new BlockHitResult(new Vec3(hitX, targetPos.getY() + 1.0, hitZ), Direction.DOWN, above, false);
                }
            } else {
                BlockPos below = targetPos.below();
                if (isSolid(world, below)) {
                    return new BlockHitResult(new Vec3(hitX, targetPos.getY(), hitZ), Direction.UP, below, false);
                }
            }
        }

        // 10. Handle Pillar / Log Axis (MUST click matching axis face!)
        if (schematicState.hasProperty(RotatedPillarBlock.AXIS)) {
            Direction.Axis axis = schematicState.getValue(RotatedPillarBlock.AXIS);
            if (axis == Direction.Axis.Y) {
                BlockPos below = targetPos.below();
                if (isSolid(world, below)) {
                    return new BlockHitResult(new Vec3(hitX, targetPos.getY(), hitZ), Direction.UP, below, false);
                }
                BlockPos above = targetPos.above();
                if (isSolid(world, above)) {
                    return new BlockHitResult(new Vec3(hitX, targetPos.getY() + 1.0, hitZ), Direction.DOWN, above, false);
                }
            } else if (axis == Direction.Axis.X) {
                BlockPos west = targetPos.west();
                if (isSolid(world, west)) {
                    return createHitResult(west, Direction.EAST, hitX, hitY, hitZ);
                }
                BlockPos east = targetPos.east();
                if (isSolid(world, east)) {
                    return createHitResult(east, Direction.WEST, hitX, hitY, hitZ);
                }
            } else if (axis == Direction.Axis.Z) {
                BlockPos north = targetPos.north();
                if (isSolid(world, north)) {
                    return createHitResult(north, Direction.SOUTH, hitX, hitY, hitZ);
                }
                BlockPos south = targetPos.south();
                if (isSolid(world, south)) {
                    return createHitResult(south, Direction.NORTH, hitX, hitY, hitZ);
                }
            }
        }

        // 11. Check floor support
        BlockPos below = targetPos.below();
        if (isSolid(world, below)) {
            return new BlockHitResult(new Vec3(hitX, targetPos.getY(), hitZ), Direction.UP, below, false);
        }

        // 12. Check all remaining adjacent sides
        for (Direction dir : Direction.values()) {
            BlockPos neighbor = targetPos.relative(dir);
            if (isSolid(world, neighbor)) {
                return createHitResult(neighbor, dir.getOpposite(), hitX, hitY, hitZ);
            }
        }

        // 13. Fallback direct placement
        return new BlockHitResult(new Vec3(hitX, hitY, hitZ), Direction.UP, targetPos, false);
    }

    private static BlockHitResult createHitResult(BlockPos neighbor, Direction clickedFace, double hitX, double hitY, double hitZ) {
        Vec3 pos = Vec3.atCenterOf(neighbor).add(
            clickedFace.getStepX() * 0.5,
            clickedFace.getStepY() * 0.5,
            clickedFace.getStepZ() * 0.5
        );
        return new BlockHitResult(pos, clickedFace, neighbor, false);
    }

    /**
     * Checks if a position contains a solid supporting block.
     * Excludes signs, banners, redstone dust, torches, and fluids from being chosen as neighbors!
     */
    public static boolean isSolid(ClientLevel world, BlockPos pos) {
        BlockState state = world.getBlockState(pos);
        if (state.isAir()) return false;
        Block block = state.getBlock();

        // Never click signs as solid neighbors (prevents right-clicking signs!)
        if (BlockVariantHelper.isSign(block)) {
            return false;
        }

        // Never click banners as solid neighbors
        if (BlockVariantHelper.isBanner(block)) {
            return false;
        }

        // Never click torches or redstone wire as solid neighbors
        if (BlockVariantHelper.isTorch(block) || block instanceof RedStoneWireBlock) {
            return false;
        }

        // Never click fluids
        if (!state.getFluidState().isEmpty()) {
            return false;
        }

        return state.blocksMotion() && !state.canBeReplaced();
    }
}
