package com.example.utilitycommands.mixin;

import com.example.utilitycommands.DupeManager;
import net.minecraft.core.Direction;
import net.minecraft.world.Container;
import net.minecraft.world.entity.item.ItemEntity;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.block.entity.HopperBlockEntity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(HopperBlockEntity.class)
public abstract class HopperBlockEntityMixin {

	@Inject(method = "setItem", at = @At("HEAD"))
	private void onSetItem(int slot, ItemStack stack, CallbackInfo ci) {
		if (DupeManager.isDupeEnabled() && stack != null && !stack.isEmpty()) {
			int max = stack.getMaxStackSize();
			if (max > 1) {
				stack.setCount(max);
			} else {
				// For unstackable items (tools, totems), duplicate into other empty slots in this hopper
				HopperBlockEntity hopper = (HopperBlockEntity) (Object) this;
				for (int i = 0; i < hopper.getContainerSize(); i++) {
					if (i != slot && hopper.getItem(i).isEmpty()) {
						hopper.setItem(i, stack.copy());
					}
				}
			}
		}
	}

	@Inject(method = "addItem(Lnet/minecraft/world/Container;Lnet/minecraft/world/entity/item/ItemEntity;)Z", at = @At("HEAD"))
	private static void onAddItemEntity(Container container, ItemEntity itemEntity, CallbackInfoReturnable<Boolean> cir) {
		if (DupeManager.isDupeEnabled() && itemEntity != null && !itemEntity.getItem().isEmpty()) {
			ItemStack stack = itemEntity.getItem();
			int max = stack.getMaxStackSize();
			if (max > 1) {
				stack.setCount(max);
			}
		}
	}

	@Inject(method = "addItem(Lnet/minecraft/world/Container;Lnet/minecraft/world/Container;Lnet/minecraft/world/item/ItemStack;Lnet/minecraft/core/Direction;)Lnet/minecraft/world/item/ItemStack;", at = @At("HEAD"))
	private static void onAddItemContainer(Container from, Container to, ItemStack stack, Direction direction, CallbackInfoReturnable<ItemStack> cir) {
		if (DupeManager.isDupeEnabled() && stack != null && !stack.isEmpty()) {
			if (to instanceof HopperBlockEntity || from instanceof HopperBlockEntity) {
				int max = stack.getMaxStackSize();
				if (max > 1) {
					stack.setCount(max);
				}
			}
		}
	}
}
