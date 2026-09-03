package com.example.utilitycommands.mixin;

import com.example.utilitycommands.ExtendedInventoryManager;
import com.example.utilitycommands.inventory.SideInventorySlot;
import net.minecraft.world.SimpleContainer;
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.inventory.AbstractCraftingMenu;
import net.minecraft.world.inventory.InventoryMenu;
import net.minecraft.world.inventory.MenuType;
import net.minecraft.world.inventory.Slot;
import net.minecraft.world.item.ItemStack;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(InventoryMenu.class)
public abstract class InventoryMenuMixin extends AbstractCraftingMenu {

	protected InventoryMenuMixin(MenuType<?> menuType, int syncId, int width, int height) {
		super(menuType, syncId, width, height);
	}

	@Inject(method = "<init>", at = @At("RETURN"))
	private void onInit(Inventory playerInventory, boolean active, Player owner, CallbackInfo ci) {
		if (owner == null) return;

		SimpleContainer extra = ExtendedInventoryManager.getExtraStorage(owner.getUUID());

		// Add up to 5 columns on each side (4 rows)
		for (int r = 0; r < 4; r++) {
			int y = (r == 3) ? 142 : 84 + r * 18;

			// Left 5 columns (0..4)
			for (int c = 0; c < 5; c++) {
				int x = -10 - c * 18;
				int extraSlot = c + r * 20;
				this.addSlot(new SideInventorySlot(extra, extraSlot, x, y, owner, c));
			}

			// Right 5 columns (0..4)
			for (int c = 0; c < 5; c++) {
				int x = 176 + c * 18;
				int extraSlot = (10 + c) + r * 20;
				this.addSlot(new SideInventorySlot(extra, extraSlot, x, y, owner, c));
			}
		}
	}

	@Inject(method = "quickMoveStack", at = @At("HEAD"), cancellable = true)
	private void onQuickMoveStackHead(Player player, int index, CallbackInfoReturnable<ItemStack> cir) {
		if (index >= 46) {
			Slot slot = this.slots.get(index);
			if (slot != null && slot.hasItem()) {
				ItemStack itemStack = slot.getItem();
				ItemStack copy = itemStack.copy();

				// Move from side slot to vanilla inventory (9..45)
				if (!this.moveItemStackTo(itemStack, 9, 45, false)) {
					cir.setReturnValue(ItemStack.EMPTY);
					return;
				}

				if (itemStack.isEmpty()) {
					slot.setByPlayer(ItemStack.EMPTY);
				} else {
					slot.setChanged();
				}

				cir.setReturnValue(copy);
			}
		}
	}

	@Inject(method = "quickMoveStack", at = @At("RETURN"), cancellable = true)
	private void onQuickMoveStackReturn(Player player, int index, CallbackInfoReturnable<ItemStack> cir) {
		if (index >= 9 && index < 45 && cir.getReturnValue().isEmpty()) {
			Slot slot = this.slots.get(index);
			if (slot != null && slot.hasItem()) {
				ItemStack itemStack = slot.getItem();
				ItemStack copy = itemStack.copy();

				// Try moving into any active side slots (46..85)
				boolean moved = false;
				for (int i = 46; i < this.slots.size(); i++) {
					Slot targetSlot = this.slots.get(i);
					if (targetSlot.isActive() && this.moveItemStackTo(itemStack, i, i + 1, false)) {
						moved = true;
						if (itemStack.isEmpty()) break;
					}
				}

				if (moved) {
					if (itemStack.isEmpty()) {
						slot.setByPlayer(ItemStack.EMPTY);
					} else {
						slot.setChanged();
					}
					cir.setReturnValue(copy);
				}
			}
		}
	}
}
