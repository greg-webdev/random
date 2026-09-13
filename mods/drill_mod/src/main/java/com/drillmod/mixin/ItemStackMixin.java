package com.drillmod.mixin;

import com.drillmod.item.DrillItem;
import net.minecraft.world.item.ItemStack;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(ItemStack.class)
public abstract class ItemStackMixin {

	@Inject(method = "getDamageValue", at = @At("HEAD"), cancellable = true)
	private void getDrillVisualDamageValue(CallbackInfoReturnable<Integer> cir) {
		ItemStack self = (ItemStack) (Object) this;
		if (self.getItem() instanceof DrillItem && DrillItem.hasIndestructible(self)) {
			cir.setReturnValue(DrillItem.getVisualDamage(self));
		}
	}

	@Inject(method = "setDamageValue", at = @At("HEAD"), cancellable = true)
	private void cancelDrillSetDamage(int damage, CallbackInfo ci) {
		ItemStack self = (ItemStack) (Object) this;
		if (self.getItem() instanceof DrillItem && DrillItem.hasIndestructible(self)) {
			ci.cancel();
		}
	}

	@Inject(method = "isDamaged", at = @At("HEAD"), cancellable = true)
	private void isDrillVisuallyDamaged(CallbackInfoReturnable<Boolean> cir) {
		ItemStack self = (ItemStack) (Object) this;
		if (self.getItem() instanceof DrillItem && DrillItem.hasIndestructible(self)) {
			cir.setReturnValue(true);
		}
	}
}
