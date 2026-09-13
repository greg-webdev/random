package com.lockedchest.block.entity;

import com.lockedchest.LockedChestMod;
import net.minecraft.core.BlockPos;
import net.minecraft.core.NonNullList;
import net.minecraft.network.chat.Component;
import net.minecraft.sounds.SoundEvent;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.ContainerHelper;
import net.minecraft.world.entity.ContainerUser;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.inventory.AbstractContainerMenu;
import net.minecraft.world.inventory.ChestMenu;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.entity.ContainerOpenersCounter;
import net.minecraft.world.level.block.entity.RandomizableContainerBlockEntity;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.storage.ValueInput;
import net.minecraft.world.level.storage.ValueOutput;

public class LockedChestBlockEntity extends RandomizableContainerBlockEntity {
	private NonNullList<ItemStack> items = NonNullList.withSize(27, ItemStack.EMPTY);
	private String boundKeyId = "";
	private String ownerName = "";

	private final ContainerOpenersCounter openersCounter = new ContainerOpenersCounter() {
		@Override
		protected void onOpen(Level level, BlockPos pos, BlockState state) {
			playSound(level, pos, SoundEvents.CHEST_OPEN);
		}

		@Override
		protected void onClose(Level level, BlockPos pos, BlockState state) {
			playSound(level, pos, SoundEvents.CHEST_CLOSE);
		}

		@Override
		protected void openerCountChanged(Level level, BlockPos pos, BlockState state, int count, int openCount) {
		}

		@Override
		public boolean isOwnContainer(Player player) {
			if (player.containerMenu instanceof ChestMenu menu) {
				return menu.getContainer() == LockedChestBlockEntity.this;
			}
			return false;
		}
	};

	public LockedChestBlockEntity(BlockPos pos, BlockState state) {
		super(LockedChestMod.LOCKED_CHEST_BLOCK_ENTITY, pos, state);
	}

	@Override
	public int getContainerSize() {
		return 27;
	}

	@Override
	protected NonNullList<ItemStack> getItems() {
		return this.items;
	}

	@Override
	protected void setItems(NonNullList<ItemStack> items) {
		this.items = items;
	}

	@Override
	protected Component getDefaultName() {
		return Component.translatable("container.locked_chest.locked_chest");
	}

	@Override
	protected AbstractContainerMenu createMenu(int syncId, Inventory inventory) {
		return ChestMenu.threeRows(syncId, inventory, this);
	}

	@Override
	protected void saveAdditional(ValueOutput output) {
		super.saveAdditional(output);
		if (!this.trySaveLootTable(output)) {
			ContainerHelper.saveAllItems(output, this.items);
		}
		if (!this.boundKeyId.isEmpty()) {
			output.putString("bound_key_id", this.boundKeyId);
		}
		if (!this.ownerName.isEmpty()) {
			output.putString("owner_name", this.ownerName);
		}
	}

	@Override
	protected void loadAdditional(ValueInput input) {
		super.loadAdditional(input);
		this.items = NonNullList.withSize(this.getContainerSize(), ItemStack.EMPTY);
		if (!this.tryLoadLootTable(input)) {
			ContainerHelper.loadAllItems(input, this.items);
		}
		this.boundKeyId = input.getStringOr("bound_key_id", "");
		this.ownerName = input.getStringOr("owner_name", "");
	}

	@Override
	public void startOpen(ContainerUser user) {
		if (!this.remove && user instanceof LivingEntity living && !living.isSpectator()) {
			this.openersCounter.incrementOpeners(living, this.getLevel(), this.getBlockPos(), this.getBlockState(), user.getContainerInteractionRange());
		}
	}

	@Override
	public void stopOpen(ContainerUser user) {
		if (!this.remove && user instanceof LivingEntity living && !living.isSpectator()) {
			this.openersCounter.decrementOpeners(living, this.getLevel(), this.getBlockPos(), this.getBlockState());
		}
	}

	public void recheckOpen() {
		if (!this.remove) {
			this.openersCounter.recheckOpeners(this.getLevel(), this.getBlockPos(), this.getBlockState());
		}
	}

	private void playSound(Level level, BlockPos pos, SoundEvent soundEvent) {
		double x = pos.getX() + 0.5;
		double y = pos.getY() + 0.5;
		double z = pos.getZ() + 0.5;
		level.playSound(null, x, y, z, soundEvent, SoundSource.BLOCKS, 0.5F, level.random.nextFloat() * 0.1F + 0.9F);
	}

	public String getBoundKeyId() {
		return this.boundKeyId;
	}

	public void setBoundKeyId(String keyId) {
		this.boundKeyId = keyId == null ? "" : keyId;
		setChanged();
	}

	public boolean isBound() {
		return this.boundKeyId != null && !this.boundKeyId.trim().isEmpty();
	}

	public boolean matchesKey(String keyId) {
		return isBound() && this.boundKeyId.equals(keyId);
	}

	public String getOwnerName() {
		return this.ownerName;
	}

	public void setOwnerName(String ownerName) {
		this.ownerName = ownerName == null ? "" : ownerName;
		setChanged();
	}
}
