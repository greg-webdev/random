package com.drillmod.network;

import com.drillmod.DrillMod;
import net.minecraft.network.RegistryFriendlyByteBuf;
import net.minecraft.network.codec.ByteBufCodecs;
import net.minecraft.network.codec.StreamCodec;
import net.minecraft.network.protocol.common.custom.CustomPacketPayload;
import net.minecraft.resources.Identifier;

public record DrillActionPayload(int action, int param) implements CustomPacketPayload {
	public static final Type<DrillActionPayload> TYPE = new Type<>(Identifier.fromNamespaceAndPath(DrillMod.MOD_ID, "drill_action"));

	public static final int ACTION_WITHDRAW_STACK = 0;
	public static final int ACTION_WITHDRAW_ONE = 1;
	public static final int ACTION_WITHDRAW_MAX = 2;
	public static final int ACTION_DEPOSIT_CURSOR = 3;
	public static final int ACTION_DEPOSIT_SLOT = 4;
	public static final int ACTION_DEPOSIT_ALL = 5;
	public static final int ACTION_PAGE_PREV = 6;
	public static final int ACTION_PAGE_NEXT = 7;
	public static final int ACTION_RESTORE = 8;
	public static final int ACTION_BACKUP = 9;

	public static final StreamCodec<RegistryFriendlyByteBuf, DrillActionPayload> STREAM_CODEC = StreamCodec.composite(
		ByteBufCodecs.INT, DrillActionPayload::action,
		ByteBufCodecs.INT, DrillActionPayload::param,
		DrillActionPayload::new
	);

	@Override
	public Type<? extends CustomPacketPayload> type() {
		return TYPE;
	}
}
