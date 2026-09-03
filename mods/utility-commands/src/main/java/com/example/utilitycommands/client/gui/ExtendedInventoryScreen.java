package com.example.utilitycommands.client.gui;

import com.example.utilitycommands.client.ClientInvState;
import com.example.utilitycommands.inventory.ExtendedInventoryMenu;
import com.example.utilitycommands.mixin.MinecraftClientMixin;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.components.Tooltip;
import net.minecraft.client.gui.screens.inventory.AbstractContainerScreen;
import net.minecraft.client.gui.screens.inventory.InventoryScreen;
import net.minecraft.network.chat.Component;
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.inventory.Slot;

public class ExtendedInventoryScreen extends AbstractContainerScreen<ExtendedInventoryMenu> {

	public ExtendedInventoryScreen(ExtendedInventoryMenu menu, Inventory playerInventory, Component title) {
		super(menu, playerInventory, title);
		this.imageWidth = Math.max(176, 16 + menu.getTotalColumns() * 18);
		this.imageHeight = 130;
	}

	@Override
	protected void init() {
		this.imageWidth = Math.max(176, 16 + this.menu.getTotalColumns() * 18);
		this.imageHeight = 130;
		super.init();

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

		// 7. Vanilla 2x2 Craft toggle
		this.addRenderableWidget(Button.builder(Component.literal("§f2x2"), btn -> {
			Minecraft mc = Minecraft.getInstance();
			if (mc.player != null) {
				ClientInvState.bypassBiggerInv = true;
				mc.setScreen(new InventoryScreen(mc.player));
			}
		})
			.bounds(startX + (btnW + gap) * 6, startY, 28, btnH)
			.tooltip(Tooltip.create(Component.literal("Switch to Vanilla Crafting Grid & Recipe Book")))
			.build());

		// 8. Recipe Book Button at the bottom
		int bookX = this.leftPos + (this.imageWidth / 2) - 10;
		int bookY = this.topPos + this.imageHeight + 4;
		this.addRenderableWidget(Button.builder(Component.literal("§2📖"), btn -> {
			ClientInvState.bypassBiggerInv = true;
			Minecraft mc = Minecraft.getInstance();
			if (mc.player != null) {
				mc.setScreen(new InventoryScreen(mc.player));
			}
		})
			.bounds(bookX, bookY, 20, 18)
			.tooltip(Tooltip.create(Component.literal("Recipe Book & 2x2 Crafting\n§7Click to open")))
			.build());
	}

	private void runCommand(String cmd) {
		Minecraft mc = Minecraft.getInstance();
		if (mc.getConnection() != null) {
			mc.getConnection().sendCommand(cmd);
		}
	}

	@Override
	public void render(GuiGraphics graphics, int mouseX, int mouseY, float delta) {
		super.render(graphics, mouseX, mouseY, delta);
		this.renderTooltip(graphics, mouseX, mouseY);
	}

	@Override
	protected void renderBg(GuiGraphics graphics, float delta, int mouseX, int mouseY) {
		// Dark modern container panel
		graphics.fill(this.leftPos, this.topPos, this.leftPos + this.imageWidth, this.topPos + this.imageHeight, 0xF013141C);
		graphics.renderOutline(this.leftPos, this.topPos, this.imageWidth, this.imageHeight, 0xFF3E4154);

		// Render slot background frames
		for (Slot slot : this.menu.slots) {
			int sx = this.leftPos + slot.x;
			int sy = this.topPos + slot.y;
			graphics.fill(sx - 1, sy - 1, sx + 17, sy + 17, 0xFF2A2D3C);
			graphics.fill(sx, sy, sx + 16, sy + 16, 0xFF0E0F16);
		}
	}

	@Override
	protected void renderLabels(GuiGraphics graphics, int mouseX, int mouseY) {
		int side = this.menu.getSideColumns();
		int total = this.menu.getTotalColumns();
		graphics.drawString(this.font, "§6Inventory §8(§e" + side + " on each side§8 - §f" + total + " cols§8)", 8, 6, 0xFFFFFF, false);
		graphics.drawString(this.font, "§7Gear", 8 + side * 18, 18 + 4 * 18 + 8 - 10, 0xAAAAAA, false);
	}
}
