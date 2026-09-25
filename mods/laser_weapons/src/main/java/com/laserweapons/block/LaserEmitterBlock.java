/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  net.minecraft.core.BlockPos
 *  net.minecraft.core.Direction
 *  net.minecraft.network.chat.Component
 *  net.minecraft.sounds.SoundEvent
 *  net.minecraft.sounds.SoundEvents
 *  net.minecraft.sounds.SoundSource
 *  net.minecraft.world.InteractionHand
 *  net.minecraft.world.InteractionResult
 *  net.minecraft.world.entity.Entity
 *  net.minecraft.world.entity.LivingEntity
 *  net.minecraft.world.entity.player.Player
 *  net.minecraft.world.item.ItemStack
 *  net.minecraft.world.item.context.BlockPlaceContext
 *  net.minecraft.world.level.Level
 *  net.minecraft.world.level.block.Block
 *  net.minecraft.world.level.block.EntityBlock
 *  net.minecraft.world.level.block.entity.BlockEntity
 *  net.minecraft.world.level.block.entity.BlockEntityTicker
 *  net.minecraft.world.level.block.entity.BlockEntityType
 *  net.minecraft.world.level.block.state.BlockBehaviour$Properties
 *  net.minecraft.world.level.block.state.BlockState
 *  net.minecraft.world.level.block.state.StateDefinition$Builder
 *  net.minecraft.world.level.block.state.properties.BlockStateProperties
 *  net.minecraft.world.level.block.state.properties.EnumProperty
 *  net.minecraft.world.level.block.state.properties.Property
 *  net.minecraft.world.phys.BlockHitResult
 *  org.jetbrains.annotations.Nullable
 */
package com.laserweapons.block;

import com.laserweapons.block.entity.LaserEmitterBlockEntity;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.network.chat.Component;
import net.minecraft.sounds.SoundEvent;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.context.BlockPlaceContext;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.EntityBlock;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.entity.BlockEntityTicker;
import net.minecraft.world.level.block.entity.BlockEntityType;
import net.minecraft.world.level.block.state.BlockBehaviour;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.block.state.StateDefinition;
import net.minecraft.world.level.block.state.properties.BlockStateProperties;
import net.minecraft.world.level.block.state.properties.EnumProperty;
import net.minecraft.world.level.block.state.properties.Property;
import net.minecraft.world.phys.BlockHitResult;
import org.jetbrains.annotations.Nullable;

public class LaserEmitterBlock
extends Block
implements EntityBlock {
    public static final EnumProperty<Direction> FACING = BlockStateProperties.FACING;

    public LaserEmitterBlock(BlockBehaviour.Properties properties) {
        super(properties);
        this.registerDefaultState(this.stateDefinition.any().setValue(FACING, Direction.UP));
    }

    protected void createBlockStateDefinition(StateDefinition.Builder<Block, BlockState> builder) {
        builder.add(new Property[]{FACING});
    }

    @Nullable
    public BlockState getStateForPlacement(BlockPlaceContext context) {
        Direction clickedFace = context.getClickedFace();
        return this.defaultBlockState().setValue(FACING, clickedFace);
    }

    public void setPlacedBy(Level level, BlockPos pos, BlockState state, @Nullable LivingEntity placer, ItemStack stack) {
        BlockEntity be;
        super.setPlacedBy(level, pos, state, placer, stack);
        if (!level.isClientSide() && (be = level.getBlockEntity(pos)) instanceof LaserEmitterBlockEntity) {
            LaserEmitterBlockEntity laserBe = (LaserEmitterBlockEntity)be;
            Direction facing = (Direction)state.getValue(FACING);
            laserBe.setFromDirection(facing);
        }
    }

    @Nullable
    public BlockEntity newBlockEntity(BlockPos pos, BlockState state) {
        LaserEmitterBlockEntity be = new LaserEmitterBlockEntity(pos, state);
        if (state.hasProperty(FACING)) {
            be.setFromDirection((Direction)state.getValue(FACING));
        }
        return be;
    }

    @Nullable
    public <T extends BlockEntity> BlockEntityTicker<T> getTicker(Level level, BlockState state, BlockEntityType<T> blockEntityType) {
        return level.isClientSide() ? null : (lvl, p, s, be) -> {
            if (be instanceof LaserEmitterBlockEntity) {
                LaserEmitterBlockEntity laserBe = (LaserEmitterBlockEntity)be;
                LaserEmitterBlockEntity.tick(lvl, p, s, laserBe);
            }
        };
    }

    private InteractionResult handleInteraction(Level level, BlockPos pos, BlockState state, Player player) {
        if (level.isClientSide()) {
            return InteractionResult.SUCCESS;
        }
        BlockEntity be = level.getBlockEntity(pos);
        if (be instanceof LaserEmitterBlockEntity) {
            LaserEmitterBlockEntity laserBe = (LaserEmitterBlockEntity)be;
            if (player.isShiftKeyDown()) {
                laserBe.toggleActive();
                player.displayClientMessage((Component)Component.literal((String)(laserBe.isActive() ? "\u00a7a[Laser Emitter: ACTIVE]" : "\u00a7c[Laser Emitter: STANDBY]")), true);
                level.playSound(null, pos, (SoundEvent)SoundEvents.UI_BUTTON_CLICK.value(), SoundSource.BLOCKS, 0.5f, 1.2f);
            } else {
                float yaw = player.getYRot();
                float pitch = player.getXRot();
                laserBe.setAngles(yaw, pitch);
                Direction closest = Direction.orderedByNearest((Entity)player)[0];
                if (state.getValue(FACING) != closest) {
                    level.setBlock(pos, state.setValue(FACING, closest), 3);
                }
                player.displayClientMessage((Component)Component.literal((String)("\u00a7b[Laser Emitter] Aimed: \u00a7f" + (int)yaw + "\u00b0 Yaw, " + (int)pitch + "\u00b0 Pitch (" + closest.getName().toUpperCase() + ")")), true);
                level.playSound(null, pos, SoundEvents.DISPENSER_DISPENSE, SoundSource.BLOCKS, 0.5f, 1.6f);
            }
        }
        return InteractionResult.SUCCESS;
    }

    protected InteractionResult useWithoutItem(BlockState state, Level level, BlockPos pos, Player player, BlockHitResult hitResult) {
        return this.handleInteraction(level, pos, state, player);
    }

    protected InteractionResult useItemOn(ItemStack stack, BlockState state, Level level, BlockPos pos, Player player, InteractionHand hand, BlockHitResult hitResult) {
        return this.handleInteraction(level, pos, state, player);
    }
}

