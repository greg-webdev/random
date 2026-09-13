package com.drillmod.inventory;

import net.minecraft.network.RegistryFriendlyByteBuf;
import net.minecraft.network.codec.StreamCodec;
import net.minecraft.world.item.ItemStack;

import java.util.ArrayList;
import java.util.List;

public record DrillMenuData(int drillSlot, List<DrillStorage.Entry> initialEntries) {
	public static final StreamCodec<RegistryFriendlyByteBuf, DrillMenuData> STREAM_CODEC = StreamCodec.of(
		(buf, data) -> {
			buf.writeVarInt(data.drillSlot);
			buf.writeVarInt(data.initialEntries.size());
			for (DrillStorage.Entry entry : data.initialEntries) {
				ItemStack.STREAM_CODEC.encode(buf, entry.getItem());
				buf.writeVarLong(entry.getCount());
			}
		},
		buf -> {
			int slot = buf.readVarInt();
			int size = buf.readVarInt();
			List<DrillStorage.Entry> entries = new ArrayList<>(size);
			for (int i = 0; i < size; i++) {
				ItemStack item = ItemStack.STREAM_CODEC.decode(buf);
				long count = buf.readVarLong();
				entries.add(new DrillStorage.Entry(item, count));
			}
			return new DrillMenuData(slot, entries);
		}
	);
}

