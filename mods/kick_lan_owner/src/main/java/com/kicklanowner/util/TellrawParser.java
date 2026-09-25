package com.kicklanowner.util;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import net.minecraft.ChatFormatting;
import net.minecraft.network.chat.Component;
import net.minecraft.network.chat.MutableComponent;
import net.minecraft.network.chat.Style;
import net.minecraft.network.chat.TextColor;

import java.util.ArrayList;
import java.util.List;

public class TellrawParser {
	private static final Gson GSON = new GsonBuilder().disableHtmlEscaping().create();

	public static class StyledSegment {
		public String text;
		public String colorName;
		public boolean bold;
		public boolean italic;
		public boolean underlined;
		public boolean strikethrough;
		public boolean obfuscated;

		public StyledSegment(String text, String colorName, boolean bold, boolean italic, boolean underlined, boolean strikethrough, boolean obfuscated) {
			this.text = text;
			this.colorName = colorName;
			this.bold = bold;
			this.italic = italic;
			this.underlined = underlined;
			this.strikethrough = strikethrough;
			this.obfuscated = obfuscated;
		}
	}

	public static List<StyledSegment> parseSegments(String input) {
		List<StyledSegment> segments = new ArrayList<>();
		if (input == null || input.isEmpty()) {
			segments.add(new StyledSegment("", null, false, false, false, false, false));
			return segments;
		}

		StringBuilder currentText = new StringBuilder();
		String currentColor = null;
		boolean bold = false;
		boolean italic = false;
		boolean underlined = false;
		boolean strikethrough = false;
		boolean obfuscated = false;

		int len = input.length();
		for (int i = 0; i < len; i++) {
			char c = input.charAt(i);

			if ((c == '&' || c == '§') && i + 1 < len) {
				// Check for hex color: &#RRGGBB
				if (input.charAt(i + 1) == '#' && i + 7 < len) {
					String hexCandidate = input.substring(i + 2, i + 8);
					if (isValidHex(hexCandidate)) {
						if (currentText.length() > 0) {
							segments.add(new StyledSegment(currentText.toString(), currentColor, bold, italic, underlined, strikethrough, obfuscated));
							currentText.setLength(0);
						}
						currentColor = "#" + hexCandidate;
						i += 7;
						continue;
					}
				}

				char code = Character.toLowerCase(input.charAt(i + 1));
				ChatFormatting cf = ChatFormatting.getByCode(code);

				if (cf != null) {
					if (currentText.length() > 0) {
						segments.add(new StyledSegment(currentText.toString(), currentColor, bold, italic, underlined, strikethrough, obfuscated));
						currentText.setLength(0);
					}

					if (cf == ChatFormatting.RESET) {
						currentColor = null;
						bold = false;
						italic = false;
						underlined = false;
						strikethrough = false;
						obfuscated = false;
					} else if (cf == ChatFormatting.BOLD) {
						bold = true;
					} else if (cf == ChatFormatting.ITALIC) {
						italic = true;
					} else if (cf == ChatFormatting.UNDERLINE) {
						underlined = true;
					} else if (cf == ChatFormatting.STRIKETHROUGH) {
						strikethrough = true;
					} else if (cf == ChatFormatting.OBFUSCATED) {
						obfuscated = true;
					} else if (cf.isColor()) {
						currentColor = cf.getName();
					}

					i++; // Skip the code character
					continue;
				}
			}

			currentText.append(c);
		}

		if (currentText.length() > 0 || segments.isEmpty()) {
			segments.add(new StyledSegment(currentText.toString(), currentColor, bold, italic, underlined, strikethrough, obfuscated));
		}

		return segments;
	}

	public static MutableComponent parseToComponent(String input) {
		List<StyledSegment> segments = parseSegments(input);
		MutableComponent root = Component.empty();

		for (StyledSegment seg : segments) {
			if (seg.text.isEmpty() && segments.size() > 1) {
				continue;
			}
			Style style = Style.EMPTY;
			if (seg.colorName != null) {
				if (seg.colorName.startsWith("#")) {
					TextColor tc = TextColor.parseColor(seg.colorName).result().orElse(null);
					if (tc != null) style = style.withColor(tc);
				} else {
					ChatFormatting cf = ChatFormatting.getByName(seg.colorName);
					if (cf != null) style = style.withColor(cf);
				}
			}
			if (seg.bold) style = style.withBold(true);
			if (seg.italic) style = style.withItalic(true);
			if (seg.underlined) style = style.withUnderlined(true);
			if (seg.strikethrough) style = style.withStrikethrough(true);
			if (seg.obfuscated) style = style.withObfuscated(true);

			root.append(Component.literal(seg.text).setStyle(style));
		}

		return root;
	}

	public static String parseToJson(String input) {
		List<StyledSegment> segments = parseSegments(input);
		JsonArray array = new JsonArray();

		JsonObject root = new JsonObject();
		root.addProperty("text", "");
		array.add(root);

		for (StyledSegment seg : segments) {
			if (seg.text.isEmpty() && segments.size() > 1) {
				continue;
			}
			JsonObject obj = new JsonObject();
			obj.addProperty("text", seg.text);
			if (seg.colorName != null) {
				obj.addProperty("color", seg.colorName);
			}
			if (seg.bold) obj.addProperty("bold", true);
			if (seg.italic) obj.addProperty("italic", true);
			if (seg.underlined) obj.addProperty("underlined", true);
			if (seg.strikethrough) obj.addProperty("strikethrough", true);
			if (seg.obfuscated) obj.addProperty("obfuscated", true);

			array.add(obj);
		}

		return GSON.toJson(array);
	}

	public static String buildTellrawCommand(String target, String input) {
		String targetSelector = (target == null || target.trim().isEmpty()) ? "@a" : target.trim();
		return "/tellraw " + targetSelector + " " + parseToJson(input);
	}

	private static boolean isValidHex(String s) {
		if (s.length() != 6) return false;
		for (int i = 0; i < 6; i++) {
			char c = s.charAt(i);
			if (!((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F'))) {
				return false;
			}
		}
		return true;
	}
}
