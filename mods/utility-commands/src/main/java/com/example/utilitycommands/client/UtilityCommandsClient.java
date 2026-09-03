package com.example.utilitycommands.client;

import com.example.utilitycommands.UtilityCommandsMod;
import com.example.utilitycommands.client.gui.ExtendedInventoryScreen;
import net.fabricmc.api.ClientModInitializer;
import net.minecraft.client.gui.screens.MenuScreens;

public class UtilityCommandsClient implements ClientModInitializer {
	@Override
	public void onInitializeClient() {
		MenuScreens.register(UtilityCommandsMod.EXTENDED_INVENTORY_MENU_TYPE, ExtendedInventoryScreen::new);
	}
}
