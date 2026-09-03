package com.example.utilitycommands.mixin;

import com.example.utilitycommands.ExtendedInventoryManager;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.components.Tooltip;
import net.minecraft.client.gui.navigation.ScreenPosition;
import net.minecraft.client.gui.screens.inventory.AbstractRecipeBookScreen;
import net.minecraft.client.gui.screens.inventory.InventoryScreen;
import net.minecraft.network.chat.Component;
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.inventory.InventoryMenu;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(InventoryScreen.class)
public abstract class InventoryScreenMixin extends AbstractRecipeBookScreen<InventoryMenu> {

	protected InventoryScreenMixin(InventoryMenu menu, net.minecraft.client.gui.screens.recipebook.RecipeBookComponent<?> recipeBookComponent, Inventory playerInventory, Component title) {
		super(menu, recipeBookComponent, playerInventory, title);
	}

	@Inject(method = "getRecipeBookButtonPosition", at = @At("HEAD"), cancellable = true)
	private void onGetRecipeBookButtonPosition(CallbackInfoReturnable<ScreenPosition> cir) {
		// Place the recipe book button at the bottom center of the inventory
		cir.setReturnValue(new ScreenPosition(this.leftPos + 88 - 10, this.topPos + 168));
	}

	@Inject(method = "init", at = @At("RETURN"))
	private void onInit(CallbackInfo ci) {
		int startX = 6;
		int startY = 6;
		int btnW = 22;
		int btnH = 20;
		int gap = 2;

		// 1. Day
		this.addRenderableWidget(Button.builder(Component.literal("§e☀"), btn -> runCommand("time set day"))
			.bounds(startX, startY, btnW, btnH)
			.tooltip(Tooltip.create(Component.literal("Set Time: Day\n§7/time set day")))
			.build());

		// 2. Night
		this.addRenderableWidget(Button.builder(Component.literal("§9☽"), btn -> runCommand("time set night"))
			.bounds(startX + (btnW + gap), startY, btnW, btnH)
			.tooltip(Tooltip.create(Component.literal("Set Time: Night\n§7/time set night")))
			.build());

		// 3. Survival
		this.addRenderableWidget(Button.builder(Component.literal("§c⚔"), btn -> runCommand("gamemode survival"))
			.bounds(startX + (btnW + gap) * 2, startY, btnW, btnH)
			.tooltip(Tooltip.create(Component.literal("Gamemode: Survival\n§7/gamemode survival")))
			.build());

		// 4. Creative
		this.addRenderableWidget(Button.builder(Component.literal("§a🎨"), btn -> runCommand("gamemode creative"))
			.bounds(startX + (btnW + gap) * 3, startY, btnW, btnH)
			.tooltip(Tooltip.create(Component.literal("Gamemode: Creative\n§7/gamemode creative")))
			.build());

		// 5. Adventure
		this.addRenderableWidget(Button.builder(Component.literal("§6🗺"), btn -> runCommand("gamemode adventure"))
			.bounds(startX + (btnW + gap) * 4, startY, btnW, btnH)
			.tooltip(Tooltip.create(Component.literal("Gamemode: Adventure\n§7/gamemode adventure")))
			.build());

		// 6. Spectator
		this.addRenderableWidget(Button.builder(Component.literal("§b👁"), btn -> runCommand("gamemode spectator"))
			.bounds(startX + (btnW + gap) * 5, startY, btnW, btnH)
			.tooltip(Tooltip.create(Component.literal("Gamemode: Spectator\n§7/gamemode spectator")))
			.build());

		// 7. Multi-Column Inventory
		this.addRenderableWidget(Button.builder(Component.literal("§d📦"), btn -> runCommand("setinvsize"))
			.bounds(startX + (btnW + gap) * 6, startY, btnW, btnH)
			.tooltip(Tooltip.create(Component.literal("Open Multi-Column Inventory\n§7/setinvsize")))
			.build());
	}

	@Inject(method = "renderBg", at = @At("TAIL"))
	private void onRenderBg(GuiGraphics graphics, float delta, int mouseX, int mouseY, CallbackInfo ci) {
		Minecraft mc = Minecraft.getInstance();
		if (mc.player == null) return;
		int sideCols = Math.min(5, ExtendedInventoryManager.getSideColumns(mc.player.getUUID()));

		// Render bottom recipe book button backing tab
		int bookTabX = this.leftPos + 88 - 12;
		int bookTabY = this.topPos + 166;
		graphics.fill(bookTabX, bookTabY, bookTabX + 24, bookTabY + 22, 0xF013141C);
		graphics.renderOutline(bookTabX, bookTabY, 24, 22, 0xFF3E4154);

		if (sideCols <= 0) return;

		boolean bookOpen = false;
		if (this instanceof AbstractRecipeBookScreenAccessor accessor) {
			var comp = accessor.getRecipeBookComponent();
			if (comp != null && comp.isVisible()) {
				bookOpen = true;
			}
		}

		int panelY = this.topPos + 76;
		int panelH = 90;

		// 1. Left Wing Background (only if recipe book is not occupying the left)
		if (!bookOpen) {
			int leftWingW = sideCols * 18 + 4;
			int leftWingX = this.leftPos - leftWingW;
			graphics.fill(leftWingX, panelY, this.leftPos, panelY + panelH, 0xF013141C);
			graphics.renderOutline(leftWingX, panelY, leftWingW, panelH, 0xFF3E4154);

			for (int r = 0; r < 4; r++) {
				int sy = this.topPos + ((r == 3) ? 142 : 84 + r * 18);
				for (int c = 0; c < sideCols; c++) {
					int sxLeft = this.leftPos - 10 - c * 18;
					graphics.fill(sxLeft - 1, sy - 1, sxLeft + 17, sy + 17, 0xFF2A2D3C);
					graphics.fill(sxLeft, sy, sxLeft + 16, sy + 16, 0xFF0E0F16);
				}
			}
		}

		// 2. Right Wing Background
		int rightWingX = this.leftPos + 176;
		int rightWingW = sideCols * 18 + 4;
		graphics.fill(rightWingX, panelY, rightWingX + rightWingW, panelY + panelH, 0xF013141C);
		graphics.renderOutline(rightWingX, panelY, rightWingW, panelH, 0xFF3E4154);

		for (int r = 0; r < 4; r++) {
			int sy = this.topPos + ((r == 3) ? 142 : 84 + r * 18);
			for (int c = 0; c < sideCols; c++) {
				int sxRight = this.leftPos + 176 + c * 18;
				graphics.fill(sxRight - 1, sy - 1, sxRight + 17, sy + 17, 0xFF2A2D3C);
				graphics.fill(sxRight, sy, sxRight + 16, sy + 16, 0xFF0E0F16);
			}
		}
	}

	private void runCommand(String cmd) {
		Minecraft mc = Minecraft.getInstance();
		if (mc.getConnection() != null) {
			mc.getConnection().sendCommand(cmd);
		}
	}
}
