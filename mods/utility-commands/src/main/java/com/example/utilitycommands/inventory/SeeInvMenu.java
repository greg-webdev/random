package com.example.utilitycommands.inventory;

import net.minecraft.world.Container;
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.inventory.AbstractContainerMenu;
import net.minecraft.world.inventory.MenuType;
import net.minecraft.world.inventory.Slot;
import net.minecraft.world.item.ItemStack;

public class SeeInvMenu extends AbstractContainerMenu {
	private final PlayerInvWrapper wrapper;

	public SeeInvMenu(int syncId, Inventory viewerInventory, PlayerInvWrapper wrapper) {
		super(MenuType.GENERIC_9x6, syncId);
		this.wrapper = wrapper;

		// 1. Target player container (6 rows x 9 columns = 54 slots)
		for (int row = 0; row < 6; row++) {
			for (int col = 0; col < 9; col++) {
				int index = col + row * 9;
				int x = 8 + col * 18;
				int y = 18 + row * 18;

				if (wrapper.isDecorativeSlot(index)) {
					this.addSlot(new Slot(wrapper, index, x, y) {
						@Override
						public boolean mayPickup(Player player) {
							return false;
						}

						@Override
						public boolean mayPlace(ItemStack stack) {
							return false;
						}
					});
				} else {
					this.addSlot(new Slot(wrapper, index, x, y));
				}
			}
		}

		// 2. Viewer's player inventory (3 rows x 9 columns)
		int playerInvY = 139;
		for (int row = 0; row < 3; row++) {
			for (int col = 0; col < 9; col++) {
				int index = col + row * 9 + 9;
				int x = 8 + col * 18;
				int y = playerInvY + row * 18;
				this.addSlot(new Slot(viewerInventory, index, x, y));
			}
		}

		// 3. Viewer's hotbar (1 row x 9 columns)
		int hotbarY = 197;
		for (int col = 0; col < 9; col++) {
			int x = 8 + col * 18;
			this.addSlot(new Slot(viewerInventory, col, x, hotbarY));
		}
	}

	@Override
	public boolean stillValid(Player player) {
		return this.wrapper.stillValid(player);
	}

	@Override
	public ItemStack quickMoveStack(Player player, int index) {
		ItemStack itemStack = ItemStack.EMPTY;
		Slot slot = this.slots.get(index);
		if (slot != null && slot.hasItem()) {
			ItemStack slotStack = slot.getItem();
			itemStack = slotStack.copy();

			if (index < 54) {
				// Target's slots -> Viewer inventory
				if (this.wrapper.isDecorativeSlot(index)) {
					return ItemStack.EMPTY;
				}
				if (!this.moveItemStackTo(slotStack, 54, this.slots.size(), true)) {
					return ItemStack.EMPTY;
				}
			} else {
				// Viewer inventory -> Target's inventory (main items 0-35)
				if (!this.moveItemStackTo(slotStack, 0, 36, false)) {
					return ItemStack.EMPTY;
				}
			}

			if (slotStack.isEmpty()) {
				slot.setByPlayer(ItemStack.EMPTY);
			} else {
				slot.setChanged();
			}
		}
		return itemStack;
	}
}
