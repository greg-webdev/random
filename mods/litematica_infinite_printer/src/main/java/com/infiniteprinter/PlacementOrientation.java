package com.infiniteprinter;

import net.minecraft.client.Minecraft;
import net.minecraft.core.Direction;
import net.minecraft.network.protocol.game.ServerboundMovePlayerPacket;
import net.minecraft.util.Mth;
import net.minecraft.world.level.block.BarrelBlock;
import net.minecraft.world.level.block.CrafterBlock;
import net.minecraft.world.level.block.DispenserBlock;
import net.minecraft.world.level.block.DropperBlock;
import net.minecraft.world.level.block.ObserverBlock;
import net.minecraft.world.level.block.StairBlock;
import net.minecraft.world.level.block.piston.PistonBaseBlock;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.block.state.properties.BlockStateProperties;

public class PlacementOrientation {

    public static class RotationData {
        public final float yaw;
        public final float pitch;

        public RotationData(float yaw, float pitch) {
            this.yaw = yaw;
            this.pitch = pitch;
        }
    }

    /**
     * Checks if the currently placed block matches the target block type AND is facing the correct direction.
     * Returns true ONLY if facing matches (block should NOT be broken).
     * Returns false if facing differs (block IS WRONG and MUST BE BROKEN).
     */
    public static boolean isFacingCorrect(BlockState current, BlockState target) {
        if (current == null || target == null) return false;
        if (!current.is(target.getBlock()) && !BlockVariantHelper.isSameOrVariant(current, target)) {
            return false;
        }

        // 1. FACING (Pistons, Observers, Dispensers, Droppers, Barrels, Shulkers)
        if (target.hasProperty(BlockStateProperties.FACING) != current.hasProperty(BlockStateProperties.FACING)) {
            return false;
        }
        if (target.hasProperty(BlockStateProperties.FACING)) {
            if (current.getValue(BlockStateProperties.FACING) != target.getValue(BlockStateProperties.FACING)) {
                return false;
            }
        }

        // 2. HORIZONTAL_FACING (Repeaters, Comparators, Stairs, Furnaces, Chests)
        if (target.hasProperty(BlockStateProperties.HORIZONTAL_FACING) != current.hasProperty(BlockStateProperties.HORIZONTAL_FACING)) {
            return false;
        }
        if (target.hasProperty(BlockStateProperties.HORIZONTAL_FACING)) {
            if (current.getValue(BlockStateProperties.HORIZONTAL_FACING) != target.getValue(BlockStateProperties.HORIZONTAL_FACING)) {
                return false;
            }
        }

        // 3. FACING_HOPPER (Hoppers)
        if (target.hasProperty(BlockStateProperties.FACING_HOPPER) != current.hasProperty(BlockStateProperties.FACING_HOPPER)) {
            return false;
        }
        if (target.hasProperty(BlockStateProperties.FACING_HOPPER)) {
            if (current.getValue(BlockStateProperties.FACING_HOPPER) != target.getValue(BlockStateProperties.FACING_HOPPER)) {
                return false;
            }
        }

        // 4. AXIS (Logs, Pillars, Chains)
        if (target.hasProperty(BlockStateProperties.AXIS) != current.hasProperty(BlockStateProperties.AXIS)) {
            return false;
        }
        if (target.hasProperty(BlockStateProperties.AXIS)) {
            if (current.getValue(BlockStateProperties.AXIS) != target.getValue(BlockStateProperties.AXIS)) {
                return false;
            }
        }

        // 5. SLAB_TYPE (Slabs: Top vs Bottom)
        if (target.hasProperty(BlockStateProperties.SLAB_TYPE) != current.hasProperty(BlockStateProperties.SLAB_TYPE)) {
            return false;
        }
        if (target.hasProperty(BlockStateProperties.SLAB_TYPE)) {
            if (current.getValue(BlockStateProperties.SLAB_TYPE) != target.getValue(BlockStateProperties.SLAB_TYPE)) {
                return false;
            }
        }

        // 6. HALF (Stairs: Top vs Bottom)
        if (target.hasProperty(BlockStateProperties.HALF) != current.hasProperty(BlockStateProperties.HALF)) {
            return false;
        }
        if (target.hasProperty(BlockStateProperties.HALF)) {
            if (current.getValue(BlockStateProperties.HALF) != target.getValue(BlockStateProperties.HALF)) {
                return false;
            }
        }

        // 7. ROTATION_16 (Standing Signs, Standing Banners)
        if (target.hasProperty(BlockStateProperties.ROTATION_16) != current.hasProperty(BlockStateProperties.ROTATION_16)) {
            return false;
        }
        if (target.hasProperty(BlockStateProperties.ROTATION_16)) {
            if (!current.getValue(BlockStateProperties.ROTATION_16).equals(target.getValue(BlockStateProperties.ROTATION_16))) {
                return false;
            }
        }

        // 8. ATTACH_FACE (Buttons, Levers: Floor, Wall, Ceiling)
        if (target.hasProperty(BlockStateProperties.ATTACH_FACE) != current.hasProperty(BlockStateProperties.ATTACH_FACE)) {
            return false;
        }
        if (target.hasProperty(BlockStateProperties.ATTACH_FACE)) {
            if (current.getValue(BlockStateProperties.ATTACH_FACE) != target.getValue(BlockStateProperties.ATTACH_FACE)) {
                return false;
            }
        }

        return true;
    }

    public static boolean isDirectional(BlockState state) {
        if (state == null) return false;
        return state.hasProperty(BlockStateProperties.FACING)
            || state.hasProperty(BlockStateProperties.HORIZONTAL_FACING)
            || state.hasProperty(BlockStateProperties.ROTATION_16);
    }

    /**
     * Determines the exact yaw and pitch the player should look at when placing this blockstate
     * so that the server places it with the matching orientation.
     */
    public static RotationData getRequiredRotation(BlockState state) {
        if (state == null) {
            return null;
        }

        // 1. Standing Sign / Standing Banner: rotation (0..15)
        if (state.hasProperty(BlockStateProperties.ROTATION_16)) {
            int rot = state.getValue(BlockStateProperties.ROTATION_16);
            float yaw = Mth.wrapDegrees((rot * 22.5f) - 180.0f);
            return new RotationData(yaw, 0.0f);
        }

        // 2. Observer: FACING is the EXACT SAME direction player looks!
        // Verified from decompiled ObserverBlock.getStateForPlacement:
        // context.getNearestLookingDirection().getOpposite().getOpposite() == context.getNearestLookingDirection()
        if (state.getBlock() instanceof ObserverBlock) {
            if (state.hasProperty(BlockStateProperties.FACING)) {
                Direction facing = state.getValue(BlockStateProperties.FACING);
                switch (facing) {
                    case UP:    return new RotationData(0.0f, -90.0f); // player looks straight UP
                    case DOWN:  return new RotationData(0.0f, 90.0f);  // player looks straight DOWN
                    case SOUTH: return new RotationData(0.0f, 0.0f);   // player looks SOUTH
                    case WEST:  return new RotationData(90.0f, 0.0f);  // player looks WEST
                    case NORTH: return new RotationData(180.0f, 0.0f); // player looks NORTH
                    case EAST:  return new RotationData(270.0f, 0.0f); // player looks EAST
                }
            }
        }

        // 3. Piston, Dispenser, Dropper, Crafter, Barrel: face OPPOSITE of player look direction!
        // Verified from decompiled PistonBaseBlock / DispenserBlock.getStateForPlacement:
        // context.getNearestLookingDirection().getOpposite()
        if (state.getBlock() instanceof PistonBaseBlock
                || state.getBlock() instanceof DispenserBlock
                || state.getBlock() instanceof DropperBlock
                || state.getBlock() instanceof CrafterBlock
                || state.getBlock() instanceof BarrelBlock) {
            if (state.hasProperty(BlockStateProperties.FACING)) {
                Direction facing = state.getValue(BlockStateProperties.FACING);
                switch (facing) {
                    case UP:    return new RotationData(0.0f, 90.0f);   // look DOWN -> places UP
                    case DOWN:  return new RotationData(0.0f, -90.0f);  // look UP -> places DOWN
                    case NORTH: return new RotationData(0.0f, 0.0f);    // look SOUTH -> places NORTH
                    case EAST:  return new RotationData(90.0f, 0.0f);   // look WEST -> places EAST
                    case SOUTH: return new RotationData(180.0f, 0.0f);  // look NORTH -> places SOUTH
                    case WEST:  return new RotationData(270.0f, 0.0f);  // look EAST -> places WEST
                }
            }
        }

        // 4. Stairs: face in the horizontal direction player looks!
        // Verified from decompiled StairBlock.getStateForPlacement:
        // context.getHorizontalDirection()
        if (state.getBlock() instanceof StairBlock) {
            if (state.hasProperty(BlockStateProperties.HORIZONTAL_FACING)) {
                Direction facing = state.getValue(BlockStateProperties.HORIZONTAL_FACING);
                switch (facing) {
                    case SOUTH: return new RotationData(0.0f, 0.0f);
                    case WEST:  return new RotationData(90.0f, 0.0f);
                    case NORTH: return new RotationData(180.0f, 0.0f);
                    case EAST:  return new RotationData(270.0f, 0.0f);
                }
            }
        }

        // 5. Repeaters, Comparators, Furnaces, Chests: face OPPOSITE of horizontal direction!
        // Verified from decompiled DiodeBlock / AbstractFurnaceBlock.getStateForPlacement:
        // context.getHorizontalDirection().getOpposite()
        if (state.hasProperty(BlockStateProperties.HORIZONTAL_FACING)) {
            Direction targetFacing = state.getValue(BlockStateProperties.HORIZONTAL_FACING);
            switch (targetFacing) {
                case NORTH: return new RotationData(0.0f, 0.0f);   // player looks SOUTH -> places NORTH
                case EAST:  return new RotationData(90.0f, 0.0f);  // player looks WEST -> places EAST
                case SOUTH: return new RotationData(180.0f, 0.0f); // player looks NORTH -> places SOUTH
                case WEST:  return new RotationData(270.0f, 0.0f); // player looks EAST -> places WEST
            }
        }

        // 6. Generic full 6-direction FACING fallback (default to opposite of look direction)
        if (state.hasProperty(BlockStateProperties.FACING)) {
            Direction targetFacing = state.getValue(BlockStateProperties.FACING);
            switch (targetFacing) {
                case UP:    return new RotationData(0.0f, 90.0f);
                case DOWN:  return new RotationData(0.0f, -90.0f);
                case NORTH: return new RotationData(0.0f, 0.0f);
                case EAST:  return new RotationData(90.0f, 0.0f);
                case SOUTH: return new RotationData(180.0f, 0.0f);
                case WEST:  return new RotationData(270.0f, 0.0f);
            }
        }

        return null;
    }

    /**
     * Orients the player's view angles on client and sends one MovePlayer packet to server.
     */
    public static void applyPlacementRotation(Minecraft client, BlockState targetState) {
        if (client.player == null) return;
        RotationData rot = getRequiredRotation(targetState);
        if (rot == null) return;

        float wrappedYaw = Mth.wrapDegrees(rot.yaw);
        float pitch = Mth.clamp(rot.pitch, -90.0f, 90.0f);

        client.player.setYRot(wrappedYaw);
        client.player.setXRot(pitch);
        client.player.yHeadRot = wrappedYaw;
        client.player.yBodyRot = wrappedYaw;
        client.player.yRotO = wrappedYaw;
        client.player.xRotO = pitch;

        client.player.connection.send(new ServerboundMovePlayerPacket.Rot(
            wrappedYaw,
            pitch,
            client.player.onGround(),
            client.player.horizontalCollision
        ));
    }
}
