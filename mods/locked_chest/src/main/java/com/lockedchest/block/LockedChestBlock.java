package com.lockedchest.block;

import com.lockedchest.LockedChestMod;
import com.lockedchest.block.entity.LockedChestBlockEntity;
import com.lockedchest.item.KeyItem;
import com.mojang.serialization.MapCodec;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.network.chat.Component;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.Containers;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.inventory.AbstractContainerMenu;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.context.BlockPlaceContext;
import net.minecraft.world.level.BlockGetter;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.BaseEntityBlock;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.Mirror;
import net.minecraft.world.level.block.RenderShape;
import net.minecraft.world.level.block.Rotation;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.block.state.StateDefinition;
import net.minecraft.world.level.block.state.properties.BlockStateProperties;
import net.minecraft.world.level.block.state.properties.EnumProperty;
import net.minecraft.world.phys.BlockHitResult;
import net.minecraft.world.phys.shapes.CollisionContext;
import net.minecraft.world.phys.shapes.VoxelShape;

public class LockedChestBlock extends BaseEntityBlock {
	public static final MapCodec<LockedChestBlock> CODEC = simpleCodec(LockedChestBlock::new);
	public static final EnumProperty<Direction> FACING = BlockStateProperties.HORIZONTAL_FACING;
	public static final VoxelShape SHAPE = Block.box(1.0, 0.0, 1.0, 15.0, 14.0, 15.0);

	public LockedChestBlock(Properties properties) {
		super(properties);
		this.registerDefaultState(this.stateDefinition.any().setValue(FACING, Direction.NORTH));
	}

	@Override
	protected MapCodec<? extends BaseEntityBlock> codec() {
		return CODEC;
	}

	@Override
	protected VoxelShape getShape(BlockState state, BlockGetter level, BlockPos pos, CollisionContext context) {
		return SHAPE;
	}

	@Override
	protected RenderShape getRenderShape(BlockState state) {
		return RenderShape.MODEL;
	}

	@Override
	public BlockEntity newBlockEntity(BlockPos pos, BlockState state) {
		return new LockedChestBlockEntity(pos, state);
	}

	@Override
	protected void createBlockStateDefinition(StateDefinition.Builder<Block, BlockState> builder) {
		builder.add(FACING);
	}

	@Override
	public BlockState getStateForPlacement(BlockPlaceContext context) {
		return this.defaultBlockState().setValue(FACING, context.getHorizontalDirection().getOpposite());
	}

	@Override
	protected BlockState rotate(BlockState state, Rotation rotation) {
		return state.setValue(FACING, rotation.rotate(state.getValue(FACING)));
	}

	@Override
	protected BlockState mirror(BlockState state, Mirror mirror) {
		return state.rotate(mirror.getRotation(state.getValue(FACING)));
	}

	@Override
	protected InteractionResult useItemOn(ItemStack stack, BlockState state, Level level, BlockPos pos, Player player, InteractionHand hand, BlockHitResult hitResult) {
		if (level.getBlockEntity(pos) instanceof LockedChestBlockEntity chest) {
			// 1. SECRET MASTER KEY: silently opens any chest or resets lock when shifting
			if (stack.is(LockedChestMod.MASTER_KEY)) {
				if (player.isShiftKeyDown()) {
					if (!level.isClientSide()) {
						chest.setBoundKeyId("");
						player.displayClientMessage(Component.literal("§e[Locked Chest] Lock reset! Chest is now unbound."), true);
						level.playSound(null, pos, SoundEvents.ANVIL_USE, SoundSource.BLOCKS, 0.5f, 1.2f);
					}
					return InteractionResult.SUCCESS;
				}
				if (!level.isClientSide()) {
					level.playSound(null, pos, SoundEvents.IRON_TRAPDOOR_OPEN, SoundSource.BLOCKS, 0.7f, 1.3f);
					player.openMenu(chest);
				}
				return InteractionResult.SUCCESS;
			}

			// 2. NORMAL KEY
			if (stack.is(LockedChestMod.KEY)) {
				String keyId = KeyItem.getOrCreateKeyId(stack);
				if (!chest.isBound()) {
					if (!level.isClientSide()) {
						chest.setBoundKeyId(keyId);
						chest.setOwnerName(player.getScoreboardName());
						player.displayClientMessage(Component.literal("§a[Locked Chest] Chest bound to Key §e#" + keyId + "§a!"), true);
						level.playSound(null, pos, SoundEvents.IRON_DOOR_OPEN, SoundSource.BLOCKS, 0.7f, 1.0f);
						player.openMenu(chest);
					}
					return InteractionResult.SUCCESS;
				} else if (chest.matchesKey(keyId)) {
					if (player.isShiftKeyDown()) {
						if (!level.isClientSide()) {
							chest.setBoundKeyId("");
							player.displayClientMessage(Component.literal("§e[Locked Chest] Lock removed! Chest is now unbound."), true);
							level.playSound(null, pos, SoundEvents.ANVIL_USE, SoundSource.BLOCKS, 0.5f, 1.2f);
						}
						return InteractionResult.SUCCESS;
					}
					if (!level.isClientSide()) {
						player.openMenu(chest);
					}
					return InteractionResult.SUCCESS;
				} else {
					if (!level.isClientSide()) {
						player.displayClientMessage(Component.literal("§c[Locked Chest] This key does not fit this chest!"), true);
						level.playSound(null, pos, SoundEvents.CHEST_LOCKED, SoundSource.BLOCKS, 0.8f, 0.8f);
					}
					return InteractionResult.SUCCESS;
				}
			}

			// 3. OTHER ITEMS / UNBOUND OR LOCKED
			if (!chest.isBound()) {
				if (!level.isClientSide()) {
					player.displayClientMessage(Component.literal("§e[Locked Chest] Unbound chest. Right-click with a Key to lock it."), true);
					player.openMenu(chest);
				}
				return InteractionResult.SUCCESS;
			} else {
				if (!level.isClientSide()) {
					player.displayClientMessage(Component.literal("§c[Locked Chest] This chest is locked!"), true);
					level.playSound(null, pos, SoundEvents.CHEST_LOCKED, SoundSource.BLOCKS, 0.8f, 0.8f);
				}
				return InteractionResult.SUCCESS;
			}
		}
		return InteractionResult.SUCCESS;
	}

	@Override
	protected InteractionResult useWithoutItem(BlockState state, Level level, BlockPos pos, Player player, BlockHitResult hitResult) {
		if (level.getBlockEntity(pos) instanceof LockedChestBlockEntity chest) {
			if (!chest.isBound()) {
				if (!level.isClientSide()) {
					player.displayClientMessage(Component.literal("§e[Locked Chest] Unbound chest. Right-click with a Key to lock it."), true);
					player.openMenu(chest);
				}
				return InteractionResult.SUCCESS;
			} else {
				if (!level.isClientSide()) {
					player.displayClientMessage(Component.literal("§c[Locked Chest] This chest is locked!"), true);
					level.playSound(null, pos, SoundEvents.CHEST_LOCKED, SoundSource.BLOCKS, 0.8f, 0.8f);
				}
				return InteractionResult.SUCCESS;
			}
		}
		return InteractionResult.SUCCESS;
	}

	@Override
	public BlockState playerWillDestroy(Level level, BlockPos pos, BlockState state, Player player) {
		BlockEntity be = level.getBlockEntity(pos);
		if (be instanceof LockedChestBlockEntity chest && !level.isClientSide()) {
			Containers.dropContents(level, pos, chest);
		}
		return super.playerWillDestroy(level, pos, state, player);
	}

	@Override
	protected float getDestroyProgress(BlockState state, Player player, BlockGetter level, BlockPos pos) {
		if (player.isCreative()) {
			return super.getDestroyProgress(state, player, level, pos);
		}
		if (level.getBlockEntity(pos) instanceof LockedChestBlockEntity chest && chest.isBound()) {
			ItemStack main = player.getMainHandItem();
			ItemStack off = player.getOffhandItem();
			boolean hasMaster = main.is(LockedChestMod.MASTER_KEY) || off.is(LockedChestMod.MASTER_KEY);
			boolean hasKey = (main.is(LockedChestMod.KEY) && chest.matchesKey(KeyItem.getKeyId(main)))
				|| (off.is(LockedChestMod.KEY) && chest.matchesKey(KeyItem.getKeyId(off)));
			if (!hasMaster && !hasKey) {
				return 0.0f;
			}
		}
		return super.getDestroyProgress(state, player, level, pos);
	}

	@Override
	protected boolean hasAnalogOutputSignal(BlockState state) {
		return true;
	}

	@Override
	protected int getAnalogOutputSignal(BlockState state, Level level, BlockPos pos, Direction direction) {
		return AbstractContainerMenu.getRedstoneSignalFromBlockEntity(level.getBlockEntity(pos));
	}
}
