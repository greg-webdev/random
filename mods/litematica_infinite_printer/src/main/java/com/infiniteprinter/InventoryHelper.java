package com.infiniteprinter;

import net.minecraft.client.Minecraft;
import net.minecraft.network.protocol.game.ServerboundSetCarriedItemPacket;
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.level.block.state.BlockState;

public class InventoryHelper {

    public static boolean selectOrProvideItem(Minecraft client, Item item) {
        if (client.player == null || item == null || item == Items.AIR) {
            return false;
        }
        Inventory inv = client.player.getInventory();

        // Already held in main hand
        if (inv.getSelectedItem().is(item)) {
            return true;
        }

        // Check hotbar (slots 0..8)
        for (int i = 0; i < 9; i++) {
            if (inv.getItem(i).is(item)) {
                inv.setSelectedSlot(i);
                client.player.connection.send(new ServerboundSetCarriedItemPacket(i));
                return true;
            }
        }

        // Check main inventory (slots 9..35)
        for (int i = 9; i < 36; i++) {
            if (inv.getItem(i).is(item)) {
                inv.pickSlot(i);
                client.player.connection.send(new ServerboundSetCarriedItemPacket(inv.getSelectedSlot()));
                return true;
            }
        }

        // Creative mode auto-give
        if (client.player.isCreative() && PrinterConfig.getInstance().creativePickItem) {
            ItemStack stack = new ItemStack(item, item.getDefaultMaxStackSize());
            int slot = inv.getSelectedSlot();
            inv.setItem(slot, stack);
            if (client.gameMode != null) {
                client.gameMode.handleCreativeModeItemAdd(stack, slot + 36);
            }
            client.player.connection.send(new ServerboundSetCarriedItemPacket(slot));
            return true;
        }

        return false;
    }

    public static void selectBestTool(Minecraft client, BlockState state) {
        if (client.player == null || !PrinterConfig.getInstance().autoSwitchTool) {
            return;
        }
        Inventory inv = client.player.getInventory();
        int bestSlot = inv.getSelectedSlot();
        float bestSpeed = inv.getSelectedItem().getDestroySpeed(state);

        for (int i = 0; i < 9; i++) {
            ItemStack stack = inv.getItem(i);
            if (!stack.isEmpty()) {
                float speed = stack.getDestroySpeed(state);
                if (speed > bestSpeed) {
                    bestSpeed = speed;
                    bestSlot = i;
                }
            }
        }

        if (bestSlot != inv.getSelectedSlot()) {
            inv.setSelectedSlot(bestSlot);
            client.player.connection.send(new ServerboundSetCarriedItemPacket(bestSlot));
        }
    }

    public static boolean selectToolOfType(Minecraft client, Class<?> toolClass) {
        if (client.player == null || toolClass == null) {
            return false;
        }
        Inventory inv = client.player.getInventory();

        // Check if currently holding it
        if (toolClass.isInstance(inv.getSelectedItem().getItem())) {
            return true;
        }

        // Check hotbar
        for (int i = 0; i < 9; i++) {
            if (toolClass.isInstance(inv.getItem(i).getItem())) {
                inv.setSelectedSlot(i);
                client.player.connection.send(new ServerboundSetCarriedItemPacket(i));
                return true;
            }
        }

        // Check main inventory
        for (int i = 9; i < 36; i++) {
            if (toolClass.isInstance(inv.getItem(i).getItem())) {
                inv.pickSlot(i);
                client.player.connection.send(new ServerboundSetCarriedItemPacket(inv.getSelectedSlot()));
                return true;
            }
        }

        return false;
    }
}
