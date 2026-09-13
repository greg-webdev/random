package com.drillmod.client.gui;

import com.drillmod.inventory.DrillMenu;
import com.drillmod.inventory.DrillStorage;
import com.drillmod.network.DrillActionPayload;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.components.Tooltip;
import net.minecraft.client.gui.screens.inventory.AbstractContainerScreen;
import net.minecraft.client.input.KeyEvent;
import net.minecraft.client.input.MouseButtonEvent;
import net.minecraft.network.chat.Component;
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.inventory.Slot;

import java.util.ArrayList;
import java.util.List;

public class DrillScreen extends AbstractContainerScreen<DrillMenu> {

	private Button prevButton;
	private Button nextButton;
	private Button depositAllButton;
	private Button restoreButton;
	private Button backupButton;

	public DrillScreen(DrillMenu menu, Inventory playerInventory, Component title) {
		super(menu, playerInventory, title);
		this.imageWidth = 176;
		this.imageHeight = 216;
		this.inventoryLabelY = 122;
	}

	@Override
	protected void init() {
		this.imageWidth = 176;
		this.imageHeight = 216;
		super.init();

		int btnY = this.topPos + 3;

		// Page Prev Button
		prevButton = Button.builder(Component.literal("◀"), btn -> {
			ClientPlayNetworking.send(new DrillActionPayload(DrillActionPayload.ACTION_PAGE_PREV, 0));
			if (this.menu.getPage() > 0) {
				this.menu.handleAction(DrillActionPayload.ACTION_PAGE_PREV, 0, null);
			}
		}).bounds(this.leftPos + 62, btnY, 14, 12).tooltip(Tooltip.create(Component.literal("Previous Page"))).build();
		this.addRenderableWidget(prevButton);

		// Page Next Button
		nextButton = Button.builder(Component.literal("▶"), btn -> {
			ClientPlayNetworking.send(new DrillActionPayload(DrillActionPayload.ACTION_PAGE_NEXT, 0));
			this.menu.handleAction(DrillActionPayload.ACTION_PAGE_NEXT, 0, null);
		}).bounds(this.leftPos + 98, btnY, 14, 12).tooltip(Tooltip.create(Component.literal("Next Page"))).build();
		this.addRenderableWidget(nextButton);

		// Deposit All Button
		depositAllButton = Button.builder(Component.literal("📥"), btn -> {
			ClientPlayNetworking.send(new DrillActionPayload(DrillActionPayload.ACTION_DEPOSIT_ALL, 0));
		}).bounds(this.leftPos + 118, btnY, 16, 12).tooltip(Tooltip.create(Component.literal("Quick-Deposit All items from inventory into Drill"))).build();
		this.addRenderableWidget(depositAllButton);

		// Restore Backup Button
		restoreButton = Button.builder(Component.literal("📂"), btn -> {
			ClientPlayNetworking.send(new DrillActionPayload(DrillActionPayload.ACTION_RESTORE, 0));
		}).bounds(this.leftPos + 136, btnY, 16, 12).tooltip(Tooltip.create(Component.literal("Restore Inventory Backup into this Drill (from Save Drill enchantment)"))).build();
		this.addRenderableWidget(restoreButton);

		// Save Backup Button
		backupButton = Button.builder(Component.literal("💾"), btn -> {
			ClientPlayNetworking.send(new DrillActionPayload(DrillActionPayload.ACTION_BACKUP, 0));
		}).bounds(this.leftPos + 154, btnY, 16, 12).tooltip(Tooltip.create(Component.literal("Save Drill Inventory Backup"))).build();
		this.addRenderableWidget(backupButton);
	}

	@Override
	public void render(GuiGraphics graphics, int mouseX, int mouseY, float delta) {
		super.render(graphics, mouseX, mouseY, delta);

		// Render custom infinite stack count strings on top of drill display slots
		for (int i = 0; i < DrillMenu.DRILL_SLOTS_COUNT; i++) {
			DrillStorage.Entry entry = this.menu.getEntryForSlot(i);
			if (entry != null && entry.getCount() > 0) {
				Slot slot = this.menu.slots.get(i);
				int sx = this.leftPos + slot.x;
				int sy = this.topPos + slot.y;

				String formatted = DrillStorage.formatCount(entry.getCount());
				int strWidth = this.font.width(formatted);
				int textX = sx + 17 - strWidth;
				int textY = sy + 9;

				// Background shadow pill for maximum readability
				graphics.fill(textX - 1, textY - 1, textX + strWidth + 1, textY + 8, 0xAA0A0B0E);
				graphics.drawString(this.font, formatted, textX, textY, 0xFFFFAA00, true);
			}
		}

		// Tooltips for drill storage slots
		for (int i = 0; i < DrillMenu.DRILL_SLOTS_COUNT; i++) {
			Slot slot = this.menu.slots.get(i);
			if (isHovering(slot.x, slot.y, 16, 16, mouseX, mouseY)) {
				DrillStorage.Entry entry = this.menu.getEntryForSlot(i);
				if (entry != null && entry.getCount() > 0) {
					List<Component> lines = new ArrayList<>();
					lines.add(entry.getItem().getHoverName());
					lines.add(Component.literal("§7Quantity: §6" + DrillStorage.formatExact(entry.getCount()) + " §8(§e" + DrillStorage.formatCount(entry.getCount()) + "§8)"));
					lines.add(Component.literal("§8[Left-Click] §fTake 64"));
					lines.add(Component.literal("§8[Right-Click] §fTake 1"));
					lines.add(Component.literal("§8[Shift+Click] §fTake Max"));
					graphics.setComponentTooltipForNextFrame(this.font, lines, mouseX, mouseY);
					return;
				}
			}
		}

		this.renderTooltip(graphics, mouseX, mouseY);
	}

	@Override
	protected void renderBg(GuiGraphics graphics, float delta, int mouseX, int mouseY) {
		// Sleek industrial dark sci-fi background container
		int x0 = this.leftPos;
		int y0 = this.topPos;
		int x1 = x0 + this.imageWidth;
		int y1 = y0 + this.imageHeight;

		// Main panel fill & borders
		graphics.fill(x0, y0, x1, y1, 0xF2111319);
		graphics.renderOutline(x0, y0, this.imageWidth, this.imageHeight, 0xFFD97706);
		graphics.renderOutline(x0 + 1, y0 + 1, this.imageWidth - 2, this.imageHeight - 2, 0xFF3F2B15);

		// Top header panel
		graphics.fill(x0 + 2, y0 + 2, x1 - 2, y0 + 16, 0xFF1C222D);

		// Render drill storage slot frames (0-53)
		for (int i = 0; i < DrillMenu.DRILL_SLOTS_COUNT; i++) {
			Slot slot = this.menu.slots.get(i);
			int sx = x0 + slot.x;
			int sy = y0 + slot.y;
			graphics.fill(sx - 1, sy - 1, sx + 17, sy + 17, 0xFF2F3746);
			graphics.fill(sx, sy, sx + 16, sy + 16, 0xFF151921);
		}

		// Divider line above player inventory
		graphics.fill(x0 + 6, y0 + 128, x1 - 6, y0 + 129, 0xFF3A4252);

		// Render player inventory slot frames (54-89)
		for (int i = DrillMenu.DRILL_SLOTS_COUNT; i < this.menu.slots.size(); i++) {
			Slot slot = this.menu.slots.get(i);
			int sx = x0 + slot.x;
			int sy = y0 + slot.y;
			graphics.fill(sx - 1, sy - 1, sx + 17, sy + 17, 0xFF2A2D3C);
			graphics.fill(sx, sy, sx + 16, sy + 16, 0xFF0E0F16);
		}
	}

	@Override
	protected void renderLabels(GuiGraphics graphics, int mouseX, int mouseY) {
		// Header title
		graphics.drawString(this.font, "§6⚡ DRILL ⚡", 6, 5, 0xFFFFFF, false);

		// Page indicator
		int curPage = this.menu.getPage() + 1;
		int maxPage = this.menu.getMaxPages();
		String pageStr = "§e" + curPage + "§7/§e" + maxPage;
		int pWidth = this.font.width(pageStr);
		graphics.drawString(this.font, pageStr, 84 - (pWidth / 2), 5, 0xFFFFFF, false);

		// Player inventory label
		graphics.drawString(this.font, "§7Inventory", 8, 121, 0xAAAAAA, false);
	}

	@Override
	public boolean mouseClicked(MouseButtonEvent event, boolean doubleClick) {
		// Check if clicked inside one of the 54 storage slots
		for (int i = 0; i < DrillMenu.DRILL_SLOTS_COUNT; i++) {
			Slot slot = this.menu.slots.get(i);
			if (isHovering(slot.x, slot.y, 16, 16, (int) event.x(), (int) event.y())) {
				if (!this.menu.getCarried().isEmpty()) {
					// Deposit cursor item
					ClientPlayNetworking.send(new DrillActionPayload(DrillActionPayload.ACTION_DEPOSIT_CURSOR, 0));
					return true;
				} else {
					DrillStorage.Entry entry = this.menu.getEntryForSlot(i);
					if (entry != null && entry.getCount() > 0) {
						if (event.hasShiftDown()) {
							ClientPlayNetworking.send(new DrillActionPayload(DrillActionPayload.ACTION_WITHDRAW_MAX, i));
						} else if (event.button() == 0) {
							ClientPlayNetworking.send(new DrillActionPayload(DrillActionPayload.ACTION_WITHDRAW_STACK, i));
						} else if (event.button() == 1) {
							ClientPlayNetworking.send(new DrillActionPayload(DrillActionPayload.ACTION_WITHDRAW_ONE, i));
						}
						return true;
					}
				}
			}
		}

		return super.mouseClicked(event, doubleClick);
	}

	@Override
	public boolean keyPressed(KeyEvent event) {
		if (this.minecraft != null && this.minecraft.options.keyInventory.matches(event)) {
			this.onClose();
			return true;
		}
		return super.keyPressed(event);
	}
}
