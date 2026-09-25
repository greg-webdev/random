package com.infiniteprinter;

import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.resources.Identifier;
import net.minecraft.world.level.block.*;
import net.minecraft.world.level.block.state.BlockState;

public class BlockVariantHelper {

    /**
     * Checks if current world block matches the target schematic block,
     * including wall vs standing variants of the same block family
     * (e.g. Oak Sign vs Oak Wall Sign, Torch vs Wall Torch).
     */
    public static boolean isSameOrVariant(BlockState current, BlockState target) {
        if (current == null || target == null) return false;
        if (current.isAir() || target.isAir()) return false;

        Block bCurrent = current.getBlock();
        Block bTarget = target.getBlock();

        // Exact block match
        if (bCurrent == bTarget) {
            return true;
        }

        // 1. Sign variants (Standing sign vs Wall sign vs Hanging sign of same wood)
        if (isSign(bCurrent) && isSign(bTarget)) {
            String woodCurrent = getSignWood(bCurrent);
            String woodTarget = getSignWood(bTarget);
            if (!woodCurrent.isEmpty() && woodCurrent.equals(woodTarget)) {
                return true;
            }
        }

        // 2. Torch variants (Standing torch vs Wall torch)
        if (isTorch(bCurrent) && isTorch(bTarget)) {
            String typeCurrent = getTorchType(bCurrent);
            String typeTarget = getTorchType(bTarget);
            if (!typeCurrent.isEmpty() && typeCurrent.equals(typeTarget)) {
                return true;
            }
        }

        // 3. Banner variants (Standing banner vs Wall banner)
        if (isBanner(bCurrent) && isBanner(bTarget)) {
            String colorCurrent = getBannerColor(bCurrent);
            String colorTarget = getBannerColor(bTarget);
            if (!colorCurrent.isEmpty() && colorCurrent.equals(colorTarget)) {
                return true;
            }
        }

        return false;
    }

    public static boolean isSign(Block block) {
        return block instanceof SignBlock || block instanceof WallSignBlock ||
               block instanceof CeilingHangingSignBlock || block instanceof WallHangingSignBlock;
    }

    private static String getSignWood(Block block) {
        Identifier id = BuiltInRegistries.BLOCK.getKey(block);
        if (id == null) return "";
        String path = id.getPath();
        return path.replace("_wall_hanging_sign", "")
                   .replace("_hanging_sign", "")
                   .replace("_wall_sign", "")
                   .replace("_sign", "");
    }

    public static boolean isTorch(Block block) {
        return block instanceof TorchBlock || block instanceof WallTorchBlock;
    }

    private static String getTorchType(Block block) {
        Identifier id = BuiltInRegistries.BLOCK.getKey(block);
        if (id == null) return "";
        String path = id.getPath();
        return path.replace("_wall_torch", "").replace("_torch", "");
    }

    public static boolean isBanner(Block block) {
        return block instanceof BannerBlock || block instanceof WallBannerBlock;
    }

    private static String getBannerColor(Block block) {
        Identifier id = BuiltInRegistries.BLOCK.getKey(block);
        if (id == null) return "";
        String path = id.getPath();
        return path.replace("_wall_banner", "").replace("_banner", "");
    }
}
