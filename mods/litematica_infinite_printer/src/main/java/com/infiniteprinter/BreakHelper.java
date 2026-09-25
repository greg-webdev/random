package com.infiniteprinter;

import net.minecraft.client.Minecraft;
import net.minecraft.client.multiplayer.ClientLevel;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.network.protocol.game.ServerboundPlayerActionPacket;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.level.block.state.BlockState;

public class BreakHelper {

    public static boolean isBreakable(ClientLevel world, BlockPos pos, BlockState state, boolean isCreative) {
        if (state == null || state.isAir()) {
            return false;
        }
        if (isCreative) {
            return true;
        }
        // Blocks with negative hardness (bedrock, barrier, portal) cannot be mined in survival
        return state.getDestroySpeed(world, pos) >= 0.0f;
    }

    public static void breakBlock(Minecraft client, BlockPos pos, BlockState state) {
        if (client.player == null || client.gameMode == null || client.level == null) {
            return;
        }

        // Select the optimal tool (pickaxe, axe, shovel, etc.)
        InventoryHelper.selectBestTool(client, state);

        // 1. startDestroyBlock handles creative instant destruction + predictive network sequence
        client.gameMode.startDestroyBlock(pos, Direction.UP);

        // 2. Send START and STOP destroy packets to server
        client.player.connection.send(new ServerboundPlayerActionPacket(
            ServerboundPlayerActionPacket.Action.START_DESTROY_BLOCK,
            pos,
            Direction.UP
        ));
        client.player.connection.send(new ServerboundPlayerActionPacket(
            ServerboundPlayerActionPacket.Action.STOP_DESTROY_BLOCK,
            pos,
            Direction.UP
        ));

        // 3. Destroy on client level immediately
        client.gameMode.destroyBlock(pos);
        client.level.removeBlock(pos, false);
        client.player.swing(InteractionHand.MAIN_HAND);
    }
}
