package com.kicklanowner.mixin;

import net.minecraft.server.MinecraftServer;
import net.minecraft.server.commands.KickCommand;
import net.minecraft.server.players.NameAndId;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Redirect;

@Mixin(KickCommand.class)
public abstract class KickCommandMixin {

	/**
	 * Vanilla KickCommand skips any player where server.isSingleplayerOwner(...) is true,
	 * which causes /kick on the LAN host to fail with commands.kick.owner.failed.
	 * By redirecting this check to always return false, the owner is not skipped and gets kicked.
	 */
	@Redirect(
		method = "kickPlayers",
		at = @At(
			value = "INVOKE",
			target = "Lnet/minecraft/server/MinecraftServer;isSingleplayerOwner(Lnet/minecraft/server/players/NameAndId;)Z"
		)
	)
	private static boolean allowKickingLanOwner(MinecraftServer server, NameAndId nameAndId) {
		return false;
	}

	/**
	 * Vanilla KickCommand blocks kicking when server.isPublished() is false (pure singleplayer).
	 * By redirecting this check to return true, the command can be used in singleplayer testing as well.
	 */
	@Redirect(
		method = "kickPlayers",
		at = @At(
			value = "INVOKE",
			target = "Lnet/minecraft/server/MinecraftServer;isPublished()Z"
		)
	)
	private static boolean allowKickIfSingleplayer(MinecraftServer server) {
		return true;
	}
}
