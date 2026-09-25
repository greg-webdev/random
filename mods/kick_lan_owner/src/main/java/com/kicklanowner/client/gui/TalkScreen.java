package com.kicklanowner.client.gui;

import com.kicklanowner.util.TellrawParser;
import net.minecraft.ChatFormatting;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.components.EditBox;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;

public class TalkScreen extends Screen {
	private EditBox targetBox;
	private EditBox messageBox;
	private Component previewComponent = Component.empty();
	private String lastHighlightedText = "";
	private String feedbackMessage = "";
	private long feedbackTime = 0;

	private static final String[][] COLOR_ROWS = {
		{"&4", "Dark Red", "#AA0000"},
		{"&c", "Red", "#FF5555"},
		{"&6", "Gold", "#FFAA00"},
		{"&e", "Yellow", "#FFFF55"},
		{"&2", "Dark Green", "#00AA00"},
		{"&a", "Green", "#55FF55"},
		{"&b", "Aqua", "#55FFFF"},
		{"&3", "Dark Aqua", "#00AAAA"},
		{"&1", "Dark Blue", "#0000AA"},
		{"&9", "Blue", "#5555FF"},
		{"&d", "Pink", "#FF55FF"},
		{"&5", "Purple", "#AA00AA"},
		{"&f", "White", "#FFFFFF"},
		{"&7", "Gray", "#AAAAAA"},
		{"&8", "Dark Gray", "#555555"},
		{"&0", "Black", "#000000"}
	};

	public TalkScreen() {
		super(Component.literal("Tellraw Talk Studio"));
	}

	@Override
	protected void init() {
		int panelWidth = Math.min(this.width - 24, 480);
		int startX = (this.width - panelWidth) / 2;

		// 1. Target Selector Row (Y: 34)
		int targetY = 34;
		int selectorBtnW = 44;
		int spacing = 3;

		// Quick target buttons: @a, @p, @s, @r
		String[] quickTargets = {"@a", "@p", "@s", "@r"};
		String[] quickLabels = {"@a (All)", "@p (Near)", "@s (Self)", "@r (Rand)"};
		int curX = startX + 46;
		for (int i = 0; i < quickTargets.length; i++) {
			final String t = quickTargets[i];
			int btnW = (i == 1 || i == 3) ? 56 : 50;
			this.addRenderableWidget(Button.builder(Component.literal(quickLabels[i]), btn -> {
				if (this.targetBox != null) {
					this.targetBox.setValue(t);
					updatePreview();
				}
			}).bounds(curX, targetY, btnW, 18).build());
			curX += btnW + spacing;
		}

		// Custom Target Input Box
		int targetBoxX = startX + panelWidth - 110;
		this.targetBox = new EditBox(this.font, targetBoxX, targetY, 110, 18, Component.literal("Target"));
		this.targetBox.setValue("@a");
		this.targetBox.setResponder(t -> updatePreview());
		this.addRenderableWidget(this.targetBox);

		// 2. Message Input Box (Y: 58)
		int msgY = 58;
		this.messageBox = new EditBox(this.font, startX, msgY, panelWidth, 20, Component.literal("Message"));
		this.messageBox.setMaxLength(2048);
		this.messageBox.setHint(Component.literal("Type message or select text and click styling buttons below..."));
		this.messageBox.setResponder(t -> updatePreview());
		this.addRenderableWidget(this.messageBox);
		this.setInitialFocus(this.messageBox);

		// 3. Color Palette (Y: 84 & 102 - two rows of 8)
		int colorRow1Y = 84;
		int colorRow2Y = 102;
		int colorBtnW = (panelWidth - (7 * 3)) / 8;
		int colorBtnH = 16;

		for (int i = 0; i < 16; i++) {
			final String code = COLOR_ROWS[i][0];
			final String name = COLOR_ROWS[i][1];
			int row = i / 8;
			int col = i % 8;
			int bx = startX + col * (colorBtnW + 3);
			int by = row == 0 ? colorRow1Y : colorRow2Y;

			ChatFormatting cf = ChatFormatting.getByCode(code.charAt(1));
			Component label = Component.literal(name).withStyle(cf != null ? cf : ChatFormatting.WHITE);

			this.addRenderableWidget(Button.builder(label, btn -> {
				applyFormatting(code, "&r");
			}).bounds(bx, by, colorBtnW, colorBtnH).build());
		}

		// 4. Style & Text Attribute Buttons (Y: 122)
		int styleY = 122;
		int styleBtnH = 18;
		int sx = startX;

		// Bold
		this.addRenderableWidget(Button.builder(Component.literal("Bold").withStyle(ChatFormatting.BOLD), btn -> {
			applyFormatting("&l", "&r");
		}).bounds(sx, styleY, 52, styleBtnH).build());
		sx += 52 + spacing;

		// Italic
		this.addRenderableWidget(Button.builder(Component.literal("Italic").withStyle(ChatFormatting.ITALIC), btn -> {
			applyFormatting("&o", "&r");
		}).bounds(sx, styleY, 54, styleBtnH).build());
		sx += 54 + spacing;

		// Underline
		this.addRenderableWidget(Button.builder(Component.literal("Underline").withStyle(ChatFormatting.UNDERLINE), btn -> {
			applyFormatting("&n", "&r");
		}).bounds(sx, styleY, 68, styleBtnH).build());
		sx += 68 + spacing;

		// Strike
		this.addRenderableWidget(Button.builder(Component.literal("Strike").withStyle(ChatFormatting.STRIKETHROUGH), btn -> {
			applyFormatting("&m", "&r");
		}).bounds(sx, styleY, 52, styleBtnH).build());
		sx += 52 + spacing;

		// Obfuscated / Glitched
		this.addRenderableWidget(Button.builder(Component.literal("§kXX§r Glitch §kXX§r"), btn -> {
			applyFormatting("&k", "&r");
		}).bounds(sx, styleY, 82, styleBtnH).build());
		sx += 82 + spacing;

		// Reset Style
		this.addRenderableWidget(Button.builder(Component.literal("§cReset"), btn -> {
			applyFormatting("&r", "");
		}).bounds(sx, styleY, 50, styleBtnH).build());
		sx += 50 + spacing;

		// Custom Hex
		this.addRenderableWidget(Button.builder(Component.literal("§6Hex #"), btn -> {
			applyFormatting("&#FFAA00", "&r");
		}).bounds(sx, styleY, panelWidth - (sx - startX), styleBtnH).build());

		// 5. Presets Row (Y: 144)
		int presetY = 144;
		int px = startX;

		// [Server] Preset
		this.addRenderableWidget(Button.builder(Component.literal("§4[Server]"), btn -> {
			insertPreset("&4&l[SERVER] &c");
		}).bounds(px, presetY, 66, 16).build());
		px += 66 + spacing;

		// [Alert] Preset
		this.addRenderableWidget(Button.builder(Component.literal("§6[Alert]"), btn -> {
			insertPreset("&6&l[ALERT] &e");
		}).bounds(px, presetY, 60, 16).build());
		px += 60 + spacing;

		// <Chat> Preset
		this.addRenderableWidget(Button.builder(Component.literal("§f<Chat>"), btn -> {
			insertPreset("&f<Player> &7");
		}).bounds(px, presetY, 58, 16).build());
		px += 58 + spacing;

		// Secret Preset
		this.addRenderableWidget(Button.builder(Component.literal("§5TopSecret"), btn -> {
			insertPreset("&4&kXXX&r &c&lTOP SECRET: &e");
		}).bounds(px, presetY, 78, 16).build());
		px += 78 + spacing;

		// Clear Message Button
		int clearBtnW = 54;
		this.addRenderableWidget(Button.builder(Component.literal("§7Clear"), btn -> {
			if (this.messageBox != null) {
				this.messageBox.setValue("");
				updatePreview();
			}
		}).bounds(startX + panelWidth - clearBtnW, presetY, clearBtnW, 16).build());

		// 6. Action Buttons Row (Bottom: height - 26)
		int bottomY = this.height - 26;
		int actionBtnH = 20;

		// Send Button
		this.addRenderableWidget(Button.builder(Component.literal("▶ Send /tellraw").withStyle(ChatFormatting.GREEN), btn -> {
			sendTellraw();
		}).bounds(startX, bottomY, 130, actionBtnH).build());

		// Copy Command Button
		this.addRenderableWidget(Button.builder(Component.literal("📋 Copy /tellraw"), btn -> {
			copyCommand();
		}).bounds(startX + 134, bottomY, 120, actionBtnH).build());

		// Copy JSON Button
		this.addRenderableWidget(Button.builder(Component.literal("Copy JSON"), btn -> {
			copyJson();
		}).bounds(startX + 258, bottomY, 86, actionBtnH).build());

		// Done / Close Button
		int doneW = panelWidth - 348;
		this.addRenderableWidget(Button.builder(Component.literal("Close"), btn -> {
			this.onClose();
		}).bounds(startX + 348, bottomY, Math.max(doneW, 60), actionBtnH).build());

		updatePreview();
	}

	private void applyFormatting(String prefix, String suffix) {
		if (this.messageBox == null) return;

		String highlighted = this.messageBox.getHighlighted();
		if ((highlighted == null || highlighted.isEmpty()) && !lastHighlightedText.isEmpty()) {
			highlighted = lastHighlightedText;
		}

		if (highlighted != null && !highlighted.isEmpty()) {
			this.messageBox.insertText(prefix + highlighted + suffix);
		} else {
			this.messageBox.insertText(prefix);
		}

		lastHighlightedText = "";
		this.setFocused(this.messageBox);
		this.messageBox.setFocused(true);
		updatePreview();
	}

	private void insertPreset(String preset) {
		if (this.messageBox == null) return;
		this.messageBox.insertText(preset);
		this.setFocused(this.messageBox);
		this.messageBox.setFocused(true);
		updatePreview();
	}

	private void updatePreview() {
		if (this.messageBox == null) return;
		String msg = this.messageBox.getValue();
		if (msg.isEmpty()) {
			this.previewComponent = Component.literal("§8[Message preview will display here live...]");
		} else {
			this.previewComponent = TellrawParser.parseToComponent(msg);
		}
	}

	private void sendTellraw() {
		if (this.minecraft == null || this.minecraft.getConnection() == null) {
			setFeedback("§c✖ Error: Not connected to a world or server!");
			return;
		}
		String target = (this.targetBox != null && !this.targetBox.getValue().trim().isEmpty())
			? this.targetBox.getValue().trim()
			: "@a";
		String json = TellrawParser.parseToJson(this.messageBox != null ? this.messageBox.getValue() : "");
		String command = "tellraw " + target + " " + json;

		try {
			this.minecraft.getConnection().sendCommand(command);
			setFeedback("§a✔ Command successfully sent to " + target + "!");
		} catch (Exception e) {
			setFeedback("§c✖ Error sending command: " + e.getMessage());
		}
	}

	private void copyCommand() {
		if (this.minecraft == null) return;
		String target = (this.targetBox != null && !this.targetBox.getValue().trim().isEmpty())
			? this.targetBox.getValue().trim()
			: "@a";
		String command = TellrawParser.buildTellrawCommand(target, this.messageBox != null ? this.messageBox.getValue() : "");
		this.minecraft.keyboardHandler.setClipboard(command);
		setFeedback("§a✔ Copied /tellraw command to clipboard!");
	}

	private void copyJson() {
		if (this.minecraft == null) return;
		String json = TellrawParser.parseToJson(this.messageBox != null ? this.messageBox.getValue() : "");
		this.minecraft.keyboardHandler.setClipboard(json);
		setFeedback("§a✔ Copied JSON text component to clipboard!");
	}

	private void setFeedback(String msg) {
		this.feedbackMessage = msg;
		this.feedbackTime = System.currentTimeMillis();
	}

	@Override
	public void render(GuiGraphics guiGraphics, int mouseX, int mouseY, float partialTick) {
		super.render(guiGraphics, mouseX, mouseY, partialTick);

		int panelWidth = Math.min(this.width - 24, 480);
		int startX = (this.width - panelWidth) / 2;

		// Track highlighted text before button clicks
		if (this.messageBox != null && !this.messageBox.getHighlighted().isEmpty()) {
			this.lastHighlightedText = this.messageBox.getHighlighted();
		}

		// Titles
		guiGraphics.drawCenteredString(this.font, "§6§lTellraw Talk Studio", this.width / 2, 8, 0xFFFFFFFF);
		guiGraphics.drawCenteredString(this.font, "§7Craft rich tellraw messages: select text to apply colors, bold, or obfuscation", this.width / 2, 20, 0xFFAAAAAA);

		// Label for target
		guiGraphics.drawString(this.font, "§fTarget:", startX, 38, 0xFFFFFFFF);

		// 7. Live Preview Box (Y: 166, height: 34)
		int previewY = 166;
		int previewH = 34;
		guiGraphics.fill(startX, previewY, startX + panelWidth, previewY + previewH, 0xD0101010);
		guiGraphics.renderOutline(startX, previewY, panelWidth, previewH, 0xFF555555);
		guiGraphics.drawString(this.font, "§e✦ Live Chat Preview:", startX + 6, previewY + 4, 0xFFFFFF);
		if (this.previewComponent != null) {
			guiGraphics.drawString(this.font, this.previewComponent, startX + 8, previewY + 18, 0xFFFFFFFF);
		}

		// 8. Generated Command Box (Y: 204, height: 22)
		int cmdY = 204;
		int cmdH = 22;
		guiGraphics.fill(startX, cmdY, startX + panelWidth, cmdY + cmdH, 0xD0101010);
		guiGraphics.renderOutline(startX, cmdY, panelWidth, cmdH, 0xFF333333);
		String target = (this.targetBox != null && !this.targetBox.getValue().trim().isEmpty()) ? this.targetBox.getValue().trim() : "@a";
		String fullCmd = TellrawParser.buildTellrawCommand(target, this.messageBox != null ? this.messageBox.getValue() : "");
		String displayCmd = this.font.plainSubstrByWidth(fullCmd, panelWidth - 14);
		guiGraphics.drawString(this.font, "§8" + displayCmd, startX + 6, cmdY + 7, 0x888888);

		// Feedback message (if recently triggered)
		if (!this.feedbackMessage.isEmpty() && System.currentTimeMillis() - this.feedbackTime < 3500) {
			guiGraphics.drawCenteredString(this.font, this.feedbackMessage, this.width / 2, cmdY + cmdH + 5, 0xFFFFFFFF);
		}
	}
}
