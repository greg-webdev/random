package com.example.utilitycommands.inventory;

import com.example.utilitycommands.ExtendedInventoryManager;
import net.minecraft.world.Container;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.inventory.Slot;

public class SideInventorySlot extends Slot {
	private final Player player;
	private final int column; // 0 to 4

	public SideInventorySlot(Container container, int index, int x, int y, Player player, int column) {
		super(container, index, x, y);
		this.player = player;
		this.column = column;
	}

	@Override
	public boolean isActive() {
		return ExtendedInventoryManager.getSideColumns(this.player.getUUID()) > this.column;
	}
}
