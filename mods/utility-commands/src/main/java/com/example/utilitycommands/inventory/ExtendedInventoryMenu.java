package com.example.utilitycommands.inventory;

import com.example.utilitycommands.ExtendedInventoryManager;
import com.example.utilitycommands.UtilityCommandsMod;
import net.minecraft.world.Container;
import net.minecraft.world.SimpleContainer;
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.inventory.AbstractContainerMenu;
import net.minecraft.world.inventory.Slot;
import net.minecraft.world.item.ItemStack;

public class ExtendedInventoryMenu extends AbstractContainerMenu {
	private final int sideColumns;
	private final int totalColumns;
	private final Container extraContainer;

	// Client constructor called by ExtendedScreenHandlerType
	public ExtendedInventoryMenu(int syncId, Inventory playerInventory, int sideColumns) {
		this(syncId, playerInventory, sideColumns, new SimpleContainer(ExtendedInventoryManager.MAX_EXTRA_SLOTS));
	}

	// Server constructor
	public ExtendedInventoryMenu(int syncId, Inventory playerInventory, int sideColumns, Container extraContainer) {
		super(UtilityCommandsMod.EXTENDED_INVENTORY_MENU_TYPE, syncId);
		this.sideColumns = Math.clamp(sideColumns, ExtendedInventoryManager.MIN_SIDE_COLUMNS, ExtendedInventoryManager.MAX_SIDE_COLUMNS);
		this.totalColumns = this.sideColumns * 2 + 9;
		this.extraContainer = extraContainer;

		// 1. Main Inventory (3 rows x totalColumns)
		for (int r = 0; r < 3; r++) {
			for (int c = 0; c < this.totalColumns; c++) {
				int x = 8 + c * 18;
				int y = 18 + r * 18;

				if (c >= this.sideColumns && c < this.sideColumns + 9) {
					// Vanilla inventory slot (9-35)
					int vanillaCol = c - this.sideColumns;
					int vanillaSlot = vanillaCol + (r + 1) * 9;
					this.addSlot(new Slot(playerInventory, vanillaSlot, x, y));
				} else if (c < this.sideColumns) {
					// Left side extra slot
					int extraSlot = c + r * 20;
					this.addSlot(new Slot(extraContainer, extraSlot, x, y));
				} else {
					// Right side extra slot
					int extraCol = 10 + (c - (this.sideColumns + 9));
					int extraSlot = extraCol + r * 20;
					this.addSlot(new Slot(extraContainer, extraSlot, x, y));
				}
			}
		}

		// 2. Hotbar (1 row x totalColumns)
		int hotbarY = 18 + 3 * 18 + 4;
		for (int c = 0; c < this.totalColumns; c++) {
			int x = 8 + c * 18;
			if (c >= this.sideColumns && c < this.sideColumns + 9) {
				// Vanilla hotbar slot (0-8)
				int vanillaCol = c - this.sideColumns;
				this.addSlot(new Slot(playerInventory, vanillaCol, x, hotbarY));
			} else if (c < this.sideColumns) {
				// Left side extra hotbar slot
				int extraSlot = c + 3 * 20;
				this.addSlot(new Slot(extraContainer, extraSlot, x, hotbarY));
			} else {
				// Right side extra hotbar slot
				int extraCol = 10 + (c - (this.sideColumns + 9));
				int extraSlot = extraCol + 3 * 20;
				this.addSlot(new Slot(extraContainer, extraSlot, x, hotbarY));
			}
		}

		// 3. Armor Slots (centered under the 9 vanilla columns)
		int gearStartX = 8 + this.sideColumns * 18;
		int gearY = hotbarY + 22;
		for (int i = 0; i < 4; i++) {
			int x = gearStartX + i * 18;
			this.addSlot(new Slot(playerInventory, 39 - i, x, gearY));
		}

		// 4. Offhand Slot
		this.addSlot(new Slot(playerInventory, 40, gearStartX + 5 * 18, gearY));
	}

	public int getSideColumns() {
		return sideColumns;
	}

	public int getTotalColumns() {
		return totalColumns;
	}

	@Override
	public boolean stillValid(Player player) {
		return player.isAlive();
	}

	@Override
	public ItemStack quickMoveStack(Player player, int index) {
		ItemStack itemStack = ItemStack.EMPTY;
		Slot slot = this.slots.get(index);
		if (slot != null && slot.hasItem()) {
			ItemStack slotStack = slot.getItem();
			itemStack = slotStack.copy();

			int totalGridSlots = this.totalColumns * 4;
			int hotbarStart = this.totalColumns * 3;

			if (index < totalGridSlots) {
				if (index >= hotbarStart) {
					// Hotbar -> Main grid
					if (!this.moveItemStackTo(slotStack, 0, hotbarStart, false)) {
						return ItemStack.EMPTY;
					}
				} else {
					// Main grid -> Hotbar
					if (!this.moveItemStackTo(slotStack, hotbarStart, totalGridSlots, false)) {
						return ItemStack.EMPTY;
					}
				}
			} else {
				// Armor/offhand -> Grid
				if (!this.moveItemStackTo(slotStack, 0, totalGridSlots, false)) {
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
