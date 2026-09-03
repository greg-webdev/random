package com.example.utilitycommands.mixin;

import net.minecraft.client.gui.screens.inventory.AbstractContainerScreen;
import net.minecraft.world.inventory.Slot;
import org.jetbrains.annotations.Nullable;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(AbstractContainerScreen.class)
public abstract class AbstractContainerScreenMixin {

	@Shadow @Nullable protected Slot hoveredSlot;

	@Inject(method = "hasClickedOutside", at = @At("HEAD"), cancellable = true)
	private void onHasClickedOutside(double mouseX, double mouseY, int leftPos, int topPos, CallbackInfoReturnable<Boolean> cir) {
		if (this.hoveredSlot != null && this.hoveredSlot.isActive()) {
			cir.setReturnValue(false);
		}
	}
}
