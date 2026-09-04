package com.example.utilitycommands.client.gui;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.components.EditBox;
import net.minecraft.client.gui.components.Tooltip;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.input.KeyEvent;
import net.minecraft.network.chat.Component;
import org.lwjgl.glfw.GLFW;

import java.util.ArrayList;
import java.util.List;

public class HiddenCommandRunnerScreen extends Screen {
	private EditBox commandInput;
	private final List<String> logLines = new ArrayList<>();
	private final List<String> history = new ArrayList<>();
	private int historyIndex = -1;

	private int panelX;
	private int panelY;
	private final int panelW = 370;
	private final int panelH = 220;

	public HiddenCommandRunnerScreen() {
		super(Component.literal("Hidden Command Runner"));
		logLines.add("§aReady. §7Commands run privately with §call broadcast suppressed§7.");
	}

	@Override
	protected void init() {
		super.init();

		this.panelX = (this.width - this.panelW) / 2;
		this.panelY = (this.height - this.panelH) / 2;

		// 1. Text Input Field
		this.commandInput = new EditBox(this.font, this.panelX + 12, this.panelY + 36, 275, 20, Component.literal("Command"));
		this.commandInput.setMaxLength(1024);
		this.commandInput.setHint(Component.literal("§8Type command here (e.g. give @s diamond 64)..."));
		this.addRenderableWidget(this.commandInput);
		this.setInitialFocus(this.commandInput);

		// 2. Execute Button
		this.addRenderableWidget(Button.builder(Component.literal("§a▶ Run"), btn -> executeCurrent())
			.bounds(this.panelX + 293, this.panelY + 36, 65, 20)
			.tooltip(Tooltip.create(Component.literal("Run Command Silently\n§7No broadcast to anyone")))
			.build());

		// 3. Quick Preset Buttons Row
		int presetY = this.panelY + 62;
		int pW = 55;
		int pH = 18;
		int gap = 3;
		int curX = this.panelX + 12;

		this.addRenderableWidget(Button.builder(Component.literal("Creative"), btn -> runQuick("gamemode creative"))
			.bounds(curX, presetY, pW, pH).build());
		curX += pW + gap;

		this.addRenderableWidget(Button.builder(Component.literal("Survival"), btn -> runQuick("gamemode survival"))
			.bounds(curX, presetY, pW, pH).build());
		curX += pW + gap;

		this.addRenderableWidget(Button.builder(Component.literal("Day"), btn -> runQuick("time set day"))
			.bounds(curX, presetY, 40, pH).build());
		curX += 40 + gap;

		this.addRenderableWidget(Button.builder(Component.literal("Night"), btn -> runQuick("time set night"))
			.bounds(curX, presetY, 45, pH).build());
		curX += 45 + gap;

		this.addRenderableWidget(Button.builder(Component.literal("Heal"), btn -> runQuick("effect give @s instant_health 1 255"))
			.bounds(curX, presetY, 40, pH).build());
		curX += 40 + gap;

		this.addRenderableWidget(Button.builder(Component.literal("God"), btn -> runQuick("effect give @s resistance 99999 255 true"))
			.bounds(curX, presetY, 40, pH).build());
		curX += 40 + gap;

		this.addRenderableWidget(Button.builder(Component.literal("Feed"), btn -> runQuick("effect give @s saturation 99999 255 true"))
			.bounds(curX, presetY, 40, pH).build());

		// 4. Close Button
		this.addRenderableWidget(Button.builder(Component.literal("Close"), btn -> this.onClose())
			.bounds(this.panelX + (this.panelW - 80) / 2, this.panelY + this.panelH - 24, 80, 18)
			.build());
	}

	private void runQuick(String cmd) {
		this.commandInput.setValue(cmd);
		executeCurrent();
	}

	private void executeCurrent() {
		String cmd = this.commandInput.getValue().trim();
		if (cmd.isEmpty()) return;
		if (cmd.startsWith("/")) cmd = cmd.substring(1);

		this.history.add(cmd);
		this.historyIndex = this.history.size();

		this.logLines.add("§8> §f/" + cmd);
		if (this.logLines.size() > 7) {
			this.logLines.remove(0);
		}

		Minecraft mc = Minecraft.getInstance();
		if (mc.getConnection() != null) {
			mc.getConnection().sendCommand("cmd2 " + cmd);
		}

		this.commandInput.setValue("");
	}

	@Override
	public boolean keyPressed(KeyEvent event) {
		if (event.key() == GLFW.GLFW_KEY_ENTER || event.key() == GLFW.GLFW_KEY_KP_ENTER) {
			executeCurrent();
			return true;
		}

		if (event.key() == GLFW.GLFW_KEY_UP) {
			if (!history.isEmpty() && historyIndex > 0) {
				historyIndex--;
				commandInput.setValue(history.get(historyIndex));
				return true;
			}
		} else if (event.key() == GLFW.GLFW_KEY_DOWN) {
			if (!history.isEmpty() && historyIndex < history.size() - 1) {
				historyIndex++;
				commandInput.setValue(history.get(historyIndex));
				return true;
			} else {
				historyIndex = history.size();
				commandInput.setValue("");
				return true;
			}
		}

		return super.keyPressed(event);
	}

	@Override
	public void render(GuiGraphics graphics, int mouseX, int mouseY, float delta) {
		// Dark backdrop
		graphics.fill(this.panelX, this.panelY, this.panelX + this.panelW, this.panelY + this.panelH, 0xF011121A);
		graphics.renderOutline(this.panelX, this.panelY, this.panelW, this.panelH, 0xFF7A1B28);

		// Header accent bar
		graphics.fill(this.panelX, this.panelY, this.panelX + this.panelW, this.panelY + 24, 0xFF1C1D28);
		graphics.renderOutline(this.panelX, this.panelY, this.panelW, 24, 0xFF4A1520);

		// Title and notice
		graphics.drawString(this.font, "§c🔒 §fHidden Command Runner §7(Private)", this.panelX + 12, this.panelY + 8, 0xFFFFFF, false);
		graphics.drawString(this.font, "§8Never broadcasted", this.panelX + this.panelW - 105, this.panelY + 8, 0xAAAAAA, false);

		// Log Box
		int logBoxY = this.panelY + 86;
		int logBoxH = 104;
		graphics.fill(this.panelX + 12, logBoxY, this.panelX + this.panelW - 12, logBoxY + logBoxH, 0xF00A0B10);
		graphics.renderOutline(this.panelX + 12, logBoxY, this.panelW - 24, logBoxH, 0xFF282A38);

		// Render log lines
		for (int i = 0; i < logLines.size(); i++) {
			graphics.drawString(this.font, logLines.get(i), this.panelX + 16, logBoxY + 6 + i * 13, 0xCCCCCC, false);
		}

		super.render(graphics, mouseX, mouseY, delta);
	}
}
