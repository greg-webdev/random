package com.infiniteprinter;

import net.minecraft.client.Minecraft;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.item.AxeItem;
import net.minecraft.world.item.HoeItem;
import net.minecraft.world.item.ShovelItem;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.block.state.properties.BlockStateProperties;
import net.minecraft.world.phys.BlockHitResult;
import net.minecraft.world.phys.Vec3;

public class BlockStateAdjuster {

    public static boolean canAdjust(BlockState current, BlockState target) {
        if (current == null || target == null || current.isAir()) {
            return false;
        }

        // 1. Repeater delay
        if (current.hasProperty(BlockStateProperties.DELAY) && target.hasProperty(BlockStateProperties.DELAY)) {
            if (!current.getValue(BlockStateProperties.DELAY).equals(target.getValue(BlockStateProperties.DELAY))) {
                return true;
            }
        }

        // 2. Comparator mode (Compare vs Subtract)
        if (current.hasProperty(BlockStateProperties.MODE_COMPARATOR) && target.hasProperty(BlockStateProperties.MODE_COMPARATOR)) {
            if (!current.getValue(BlockStateProperties.MODE_COMPARATOR).equals(target.getValue(BlockStateProperties.MODE_COMPARATOR))) {
                return true;
            }
        }

        // 3. Daylight detector inverted
        if (current.hasProperty(BlockStateProperties.INVERTED) && target.hasProperty(BlockStateProperties.INVERTED)) {
            if (!current.getValue(BlockStateProperties.INVERTED).equals(target.getValue(BlockStateProperties.INVERTED))) {
                return true;
            }
        }

        // 4. Note block pitch / note
        if (current.hasProperty(BlockStateProperties.NOTE) && target.hasProperty(BlockStateProperties.NOTE)) {
            if (!current.getValue(BlockStateProperties.NOTE).equals(target.getValue(BlockStateProperties.NOTE))) {
                return true;
            }
        }

        // 5. Trapdoors & Fence Gates (open/closed)
        if (current.hasProperty(BlockStateProperties.OPEN) && target.hasProperty(BlockStateProperties.OPEN)) {
            if (!current.getValue(BlockStateProperties.OPEN).equals(target.getValue(BlockStateProperties.OPEN))) {
                return true;
            }
        }

        // 6. Campfire extinguishing (unlit schematic vs lit world)
        if (current.hasProperty(BlockStateProperties.LIT) && target.hasProperty(BlockStateProperties.LIT)) {
            if (current.getValue(BlockStateProperties.LIT) && !target.getValue(BlockStateProperties.LIT)) {
                return true;
            }
        }

        // 7. Log stripping
        if (target.getBlock().getDescriptionId().contains("stripped") && !current.getBlock().getDescriptionId().contains("stripped")) {
            String currentId = current.getBlock().getDescriptionId();
            if (currentId.contains("log") || currentId.contains("wood") || currentId.contains("stem") || currentId.contains("hyphae")) {
                return true;
            }
        }

        // 8. Farmland tilling
        if (target.is(Blocks.FARMLAND) && (current.is(Blocks.DIRT) || current.is(Blocks.GRASS_BLOCK) || current.is(Blocks.DIRT_PATH))) {
            return true;
        }

        return false;
    }

    public static boolean adjust(Minecraft client, BlockPos pos, BlockState current, BlockState target) {
        if (client.player == null || client.gameMode == null) {
            return false;
        }

        boolean adjusted = false;

        // 1. Repeater delay adjustment
        if (current.hasProperty(BlockStateProperties.DELAY) && target.hasProperty(BlockStateProperties.DELAY)) {
            int curDelay = current.getValue(BlockStateProperties.DELAY);
            int targetDelay = target.getValue(BlockStateProperties.DELAY);
            if (curDelay != targetDelay) {
                int clicks = (targetDelay - curDelay + 4) % 4;
                for (int i = 0; i < clicks; i++) {
                    interactBlock(client, pos);
                }
                adjusted = true;
            }
        }

        // 2. Comparator mode toggle
        if (current.hasProperty(BlockStateProperties.MODE_COMPARATOR) && target.hasProperty(BlockStateProperties.MODE_COMPARATOR)) {
            if (!current.getValue(BlockStateProperties.MODE_COMPARATOR).equals(target.getValue(BlockStateProperties.MODE_COMPARATOR))) {
                interactBlock(client, pos);
                adjusted = true;
            }
        }

        // 3. Daylight detector toggle
        if (current.hasProperty(BlockStateProperties.INVERTED) && target.hasProperty(BlockStateProperties.INVERTED)) {
            if (!current.getValue(BlockStateProperties.INVERTED).equals(target.getValue(BlockStateProperties.INVERTED))) {
                interactBlock(client, pos);
                adjusted = true;
            }
        }

        // 4. Note block note tune
        if (current.hasProperty(BlockStateProperties.NOTE) && target.hasProperty(BlockStateProperties.NOTE)) {
            int curNote = current.getValue(BlockStateProperties.NOTE);
            int targetNote = target.getValue(BlockStateProperties.NOTE);
            if (curNote != targetNote) {
                int clicks = (targetNote - curNote + 25) % 25;
                for (int i = 0; i < clicks; i++) {
                    interactBlock(client, pos);
                }
                adjusted = true;
            }
        }

        // 5. Trapdoor / Fence Gate open
        if (current.hasProperty(BlockStateProperties.OPEN) && target.hasProperty(BlockStateProperties.OPEN)) {
            if (!current.getValue(BlockStateProperties.OPEN).equals(target.getValue(BlockStateProperties.OPEN))) {
                interactBlock(client, pos);
                adjusted = true;
            }
        }

        // 6. Campfire extinguishing
        if (current.hasProperty(BlockStateProperties.LIT) && target.hasProperty(BlockStateProperties.LIT)) {
            if (current.getValue(BlockStateProperties.LIT) && !target.getValue(BlockStateProperties.LIT)) {
                if (InventoryHelper.selectToolOfType(client, ShovelItem.class)) {
                    interactBlock(client, pos);
                    adjusted = true;
                }
            }
        }

        // 7. Log stripping
        if (target.getBlock().getDescriptionId().contains("stripped") && !current.getBlock().getDescriptionId().contains("stripped")) {
            if (InventoryHelper.selectToolOfType(client, AxeItem.class)) {
                interactBlock(client, pos);
                adjusted = true;
            }
        }

        // 8. Farmland tilling
        if (target.is(Blocks.FARMLAND) && (current.is(Blocks.DIRT) || current.is(Blocks.GRASS_BLOCK) || current.is(Blocks.DIRT_PATH))) {
            if (InventoryHelper.selectToolOfType(client, HoeItem.class)) {
                interactBlock(client, pos);
                adjusted = true;
            }
        }

        return adjusted;
    }

    private static void interactBlock(Minecraft client, BlockPos pos) {
        BlockHitResult hitResult = new BlockHitResult(Vec3.atCenterOf(pos), Direction.UP, pos, false);
        client.gameMode.useItemOn(client.player, InteractionHand.MAIN_HAND, hitResult);
        client.player.swing(InteractionHand.MAIN_HAND);
    }
}
