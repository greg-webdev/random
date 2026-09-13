package com.drillmod.mixin;

import com.drillmod.DrillMod;
import com.drillmod.item.DrillItem;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.damagesource.DamageSource;
import net.minecraft.world.entity.player.Player;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(Player.class)
public abstract class PlayerDamageMixin {

	@Inject(method = "hurtServer", at = @At("HEAD"), cancellable = true)
	private void cancelDrillDamage(ServerLevel level, DamageSource source, float amount, CallbackInfoReturnable<Boolean> cir) {
		Player player = (Player) (Object) this;
		if (DrillItem.isDrilling(player) || player.getMainHandItem().is(DrillMod.DRILL) || player.getOffhandItem().is(DrillMod.DRILL)) {
			// Complete damage immunity while using or holding the drill!
			cir.setReturnValue(false);
		}
	}

	@Inject(method = "causeFallDamage", at = @At("HEAD"), cancellable = true)
	private void cancelDrillFallDamage(double fallDistance, float multiplier, DamageSource source, CallbackInfoReturnable<Boolean> cir) {
		Player player = (Player) (Object) this;
		if (DrillItem.isDrilling(player) || player.getMainHandItem().is(DrillMod.DRILL) || player.getOffhandItem().is(DrillMod.DRILL)) {
			cir.setReturnValue(false);
		}
	}
}
