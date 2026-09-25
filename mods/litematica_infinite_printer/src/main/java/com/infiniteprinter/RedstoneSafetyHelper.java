package com.infiniteprinter;

import fi.dy.masa.litematica.util.IWorldUpdateSuppressor;
import net.minecraft.client.multiplayer.ClientLevel;
import net.minecraft.world.level.block.*;
import net.minecraft.world.level.block.piston.PistonBaseBlock;
import net.minecraft.world.level.block.piston.PistonHeadBlock;
import net.minecraft.world.level.block.state.BlockState;

public class RedstoneSafetyHelper {

    public static boolean isRedstonePowerComponent(BlockState state) {
        if (state == null) return false;
        Block block = state.getBlock();
        return block instanceof RedStoneWireBlock
            || block instanceof DiodeBlock                // Repeaters & Comparators
            || block instanceof ObserverBlock
            || block instanceof RedstoneTorchBlock
            || block instanceof RedstoneWallTorchBlock
            || block instanceof LeverBlock
            || block instanceof ButtonBlock
            || block instanceof DaylightDetectorBlock
            || block instanceof TargetBlock
            || block == Blocks.TRIPWIRE_HOOK
            || block == Blocks.TRIPWIRE
            || block instanceof PressurePlateBlock
            || block instanceof RedstoneLampBlock
            || block instanceof LightningRodBlock
            || block instanceof SculkSensorBlock;
    }

    public static boolean isPureStorage(BlockState state) {
        if (state == null) return false;
        Block block = state.getBlock();
        return block instanceof ChestBlock           // Chest, Trapped Chest
            || block instanceof BarrelBlock          // Barrel
            || block instanceof ShulkerBoxBlock      // Shulker Boxes (all colors)
            || block instanceof EnderChestBlock      // Ender Chest
            || block instanceof DecoratedPotBlock    // Decorated Pot
            || block instanceof ChiseledBookShelfBlock; // Chiseled Bookshelf
    }

    public static boolean isTransferStorage(BlockState state) {
        if (state == null) return false;
        Block block = state.getBlock();
        return block instanceof HopperBlock          // Hopper
            || block instanceof DispenserBlock       // Dispenser
            || block instanceof DropperBlock         // Dropper
            || block instanceof CrafterBlock         // Crafter
            || block instanceof AbstractFurnaceBlock // Furnace, Blast Furnace, Smoker
            || block instanceof BrewingStandBlock;   // Brewing Stand
    }

    public static boolean isStorage(BlockState state) {
        return isPureStorage(state) || isTransferStorage(state);
    }

    public static boolean isPiston(BlockState state) {
        if (state == null) return false;
        Block block = state.getBlock();
        return block instanceof PistonBaseBlock || block instanceof PistonHeadBlock;
    }

    public static boolean isMechanical(BlockState state) {
        if (state == null) return false;
        Block block = state.getBlock();
        return block instanceof TrapDoorBlock
            || block instanceof FenceGateBlock
            || block instanceof DoorBlock
            || block instanceof NoteBlock;
    }

    /**
     * Determines placement stage in Redstone Safe Mode:
     * Stage 0: Pure Storages (Chests, Barrels, Shulker Boxes, Ender Chests) - PLACED FIRST!
     * Stage 1: Transfer Containers (Hoppers, Droppers, Dispensers, Crafters, Furnaces) - PLACED SECOND!
     * Stage 2: Structural & Support Blocks (Solid stone, glass, wood, etc.)
     * Stage 3: Mechanical Actuators & Pistons (Pistons, Trapdoors, Doors, Gates)
     * Stage 4: Redstone Power & Logic (Wire, Repeaters, Comparators, Observers, Torches) - PLACED LAST!
     */
    public static int getPlacementStage(BlockState state) {
        if (state == null) return 2;
        if (isPureStorage(state)) {
            return 0; // Pure storages are placed FIRST before everything else
        }
        if (isTransferStorage(state)) {
            return 1; // Hoppers and transfer containers are placed next, attaching to storages
        }
        if (isRedstonePowerComponent(state)) {
            return 4; // Redstone logic & power placed LAST so machines never misfire
        }
        if (isPiston(state) || isMechanical(state)) {
            return 3; // Pistons & mechanical actuators placed before power
        }
        return 2; // Structural & solid support blocks
    }

    /**
     * Toggles Litematica's built-in block update suppressor on the client level.
     */
    public static void setBlockUpdateSuppression(ClientLevel level, boolean suppress) {
        if (level instanceof IWorldUpdateSuppressor suppressor) {
            try {
                suppressor.litematica_setShouldPreventBlockUpdates(suppress);
            } catch (Throwable ignored) {}
        }
    }
}
