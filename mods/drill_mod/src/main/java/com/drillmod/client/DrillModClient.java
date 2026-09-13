package com.drillmod.client;

import com.drillmod.DrillMod;
import com.drillmod.client.gui.DrillScreen;
import com.drillmod.inventory.DrillMenu;
import com.drillmod.inventory.DrillStorage;
import com.drillmod.network.DrillSyncPayload;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking;
import net.minecraft.client.gui.screens.MenuScreens;

public class DrillModClient implements ClientModInitializer {
	@Override
	public void onInitializeClient() {
		// Register GUI Screen
		MenuScreens.register(DrillMod.DRILL_MENU_TYPE, DrillScreen::new);

		// Handle storage sync from server
		ClientPlayNetworking.registerGlobalReceiver(DrillSyncPayload.TYPE, (payload, context) -> {
			context.client().execute(() -> {
				if (context.client().player != null && context.client().player.containerMenu instanceof DrillMenu menu) {
					menu.setEntries(payload.entries());
				}
			});
		});
	}
}
