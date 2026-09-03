package com.example.utilitycommands;

public class DupeManager {
	private static boolean dupeEnabled = false;

	public static boolean isDupeEnabled() {
		return dupeEnabled;
	}

	public static void setDupeEnabled(boolean enabled) {
		dupeEnabled = enabled;
	}

	public static boolean toggleDupe() {
		dupeEnabled = !dupeEnabled;
		return dupeEnabled;
	}
}
