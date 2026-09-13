package com.drillmod.network;

import com.drillmod.DrillMod;
import com.drillmod.inventory.DrillStorage;
import net.minecraft.network.RegistryFriendlyByteBuf;
import net.minecraft.network.codec.StreamCodec;
import net.minecraft.network.protocol.common.custom.CustomPacketPayload;
import net.minecraft.resources.Identifier;
import net.minecraft.world.item.ItemStack;

import java.util.ArrayList;
import java.util.List;

public record DrillSyncPayload(List<DrillStorage.Entry> entries) implements CustomPacketPayload {
	public static final Type<DrillSyncPayload> TYPE = new Type<>(Identifier.fromNamespaceAndPath(DrillMod.MOD_ID, "drill_sync"));

	public static final StreamCodec<RegistryFriendlyByteBuf, DrillSyncPayload> STREAM_CODEC = StreamCodec.of(
		(buf, payload) -> {
			buf.writeVarInt(payload.entries.size());
			for (DrillStorage.Entry entry : payload.entries) {
				ItemStack.STREAM_CODEC.encode(buf, entry.getItem());
				buf.writeVarLong(entry.getCount());
			}
		},
		buf -> {
			int size = buf.readVarInt();
			List<DrillStorage.Entry> entries = new ArrayList<>(size);
			for (int i = 0; i < size; i++) {
				ItemStack item = ItemStack.STREAM_CODEC.decode(buf);
				long count = buf.readVarLong();
				entries.add(new DrillStorage.Entry(item, count));
			}
			return new DrillSyncPayload(entries);
		}
	);

	@Override
	public Type<? extends CustomPacketPayload> type() {
		return TYPE;
	}
}

