package com.example.utilitycommands.mixin;

import com.example.utilitycommands.ExtendedInventoryManager;
import com.example.utilitycommands.client.ClientInvState;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.inventory.InventoryScreen;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(Minecraft.class)
public abstract class MinecraftClientMixin {

	@Inject(method = "setScreen", at = @At("HEAD"), cancellable = true)
	private void onSetScreen(Screen screen, CallbackInfo ci) {
		if (screen instanceof InventoryScreen) {
			if (ClientInvState.bypassBiggerInv) {
				ClientInvState.bypassBiggerInv = false;
				return;
			}
			Minecraft mc = (Minecraft) (Object) this;
			if (mc.player != null && mc.getConnection() != null) {
				int sideCols = ExtendedInventoryManager.getSideColumns(mc.player.getUUID());
				if (sideCols > 5) {
					mc.getConnection().sendCommand("setinvsize");
					ci.cancel();
				}
			}
		}
	}
}
